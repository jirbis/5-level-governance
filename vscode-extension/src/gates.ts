import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { GOVERNANCE_FILES } from "./templates";
import {
  IMPLICIT_ALLOWED_PATHS,
  parsePathMd,
  pathMatchesGlob,
} from "./parsers";
import { hasApprovedEntry, prefixViolation } from "./traceRules";

export interface Check {
  pass: boolean;
  message: string;
  file?: string;
  line?: number;
  matchStart?: number;
  matchEnd?: number;
}

export interface GateResult {
  gate: "Gate 1" | "Gate 2";
  pass: boolean;
  checks: Check[];
}

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function fileExists(root: string, filename: string): boolean {
  return fs.existsSync(path.join(root, filename));
}

function readFile(root: string, filename: string): string | null {
  const p = path.join(root, filename);
  if (!fs.existsSync(p)) {
    return null;
  }
  return fs.readFileSync(p, "utf-8");
}

function findLineNumber(content: string, pattern: RegExp): number | undefined {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i; // 0-based line number
    }
  }
  return undefined;
}

function findLineAndColumn(
  content: string,
  pattern: RegExp
): { line: number; matchStart: number; matchEnd: number } | undefined {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (match && match.index !== undefined) {
      return {
        line: i,
        matchStart: match.index,
        matchEnd: match.index + match[0].length,
      };
    }
  }
  return undefined;
}

function git(root: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function diffBase(root: string): string {
  const configured = vscode.workspace
    .getConfiguration("governance")
    .get<string>("diffBase");
  if (configured) {
    return configured;
  }
  for (const ref of ["origin/HEAD", "origin/main", "origin/master", "main", "master"]) {
    if (git(root, ["rev-parse", "--verify", "--quiet", ref]) === null) {
      continue;
    }
    const mergeBase = git(root, ["merge-base", "HEAD", ref])?.trim();
    if (mergeBase) {
      return mergeBase;
    }
  }
  return "HEAD";
}

function changedFiles(root: string, base: string): string[] {
  const out = [
    git(root, ["diff", "--name-only", base, "--"]),
    git(root, ["diff", "--name-only", "--cached", base, "--"]),
    git(root, ["ls-files", "--others", "--exclude-standard"]),
  ];
  const files = new Set<string>();
  for (const chunk of out) {
    for (const line of (chunk ?? "").split("\n")) {
      const f = line.trim();
      if (f) {
        files.add(f);
      }
    }
  }
  return [...files].sort();
}

/**
 * Bind the declared PATH scope to the real git diff.
 *
 * The admissible surface is the union of every completed step plus the active
 * step: a branch diff is the cumulative result of the steps already executed.
 * Undeclared scope and unverifiable workspaces fail closed - a control that
 * can be bypassed by omitting a field is not a control.
 */
function checkPathScope(root: string): Check[] {
  const checks: Check[] = [];

  if (git(root, ["rev-parse", "--is-inside-work-tree"]) === null) {
    checks.push({
      pass: false,
      message: "PATH scope: not a git repository, scope cannot be verified",
    });
    return checks;
  }

  const pathContent = readFile(root, "PATH.md");
  if (!pathContent) {
    checks.push({ pass: false, message: "PATH scope: PATH.md is missing", file: "PATH.md" });
    return checks;
  }

  const parsed = parsePathMd(pathContent);
  if (!parsed.activeStep) {
    checks.push({
      pass: false,
      message: "PATH scope: PATH.md has no resolvable active_step",
      file: "PATH.md",
    });
    return checks;
  }

  const inForce = parsed.steps.filter((s) => s.done || s.id === parsed.activeStep);
  const allowed = inForce.flatMap((s) => s.allowedPaths);
  const forbidden = inForce.flatMap((s) => s.forbiddenPaths);

  if (allowed.length === 0) {
    const loc = findLineNumber(pathContent, /`active_step`/);
    checks.push({
      pass: false,
      message:
        `PATH scope: no allowed_paths declared for active step '${parsed.activeStep}' ` +
        "or any completed step; scope is undeclared, so no change is admissible",
      file: "PATH.md",
      line: loc,
    });
    return checks;
  }

  const effective = [...allowed, ...IMPLICIT_ALLOWED_PATHS];
  const base = diffBase(root);
  const changed = changedFiles(root, base);

  if (changed.length === 0) {
    checks.push({
      pass: true,
      message: `PATH scope: no changes against ${base.slice(0, 12)}, nothing to place in scope`,
      file: "PATH.md",
    });
    return checks;
  }

  let clean = true;
  for (const file of changed) {
    const breach = forbidden.find((g) => pathMatchesGlob(file, g));
    if (breach) {
      checks.push({
        pass: false,
        message: `PATH scope: forbidden file changed: ${file} (matches forbidden_paths: ${breach})`,
        file,
      });
      clean = false;
      continue;
    }
    if (!effective.some((g) => pathMatchesGlob(file, g))) {
      checks.push({
        pass: false,
        message:
          `PATH scope: out-of-scope file changed: ${file} (not matched by any ` +
          `allowed_paths of step '${parsed.activeStep}' or completed steps)`,
        file,
      });
      clean = false;
    }
  }

  if (clean) {
    checks.push({
      pass: true,
      message:
        `PATH scope: all ${changed.length} changed file(s) are inside declared ` +
        `allowed_paths (base ${base.slice(0, 12)})`,
      file: "PATH.md",
    });
  }

  return checks;
}

/**
 * TRACE append-only enforcement.
 *
 * `LAW.md` forbids rewriting prior TRACE history. Every version of TRACE.md
 * must have the previous version as an exact byte prefix. The whole commit
 * chain is walked, not just base against the working tree: a branch that
 * rewrites TRACE in one commit and restores it in the next has still destroyed
 * the audit trail, and comparing only the endpoints would miss it.
 */
function traceAt(root: string, rev: string, rel: string): Buffer {
  try {
    execFileSync("git", ["-C", root, "cat-file", "-e", `${rev}:${rel}`], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    return Buffer.alloc(0); // absent == empty, so deletion reads as truncation
  }
  try {
    return execFileSync("git", ["-C", root, "show", `${rev}:${rel}`], {
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return Buffer.alloc(0);
  }
}

// TRACE.md and DECISIONS.md are both append-only records: one of work, one of
// rule changes. They share the prefix rule.
function checkAppendOnly(root: string, rel: string, label: string): Check[] {
  if (git(root, ["rev-parse", "--is-inside-work-tree"]) === null) {
    return [
      {
        pass: false,
        message: `${label} append-only: not a git repository, history cannot be verified`,
        file: rel,
      },
    ];
  }

  const base = diffBase(root);
  const revs = (git(root, ["rev-list", "--reverse", `${base}..HEAD`]) ?? "")
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  const checks: Check[] = [];
  let prev = traceAt(root, base, rel);

  for (const rev of revs) {
    const cur = traceAt(root, rev, rel);
    const violation = prefixViolation(prev, cur);
    if (violation) {
      const short = (git(root, ["rev-parse", "--short", rev]) ?? rev).trim();
      checks.push({
        pass: false,
        message: `${label} append-only: commit ${short} rewrites ${rel} history (${violation})`,
        file: rel,
      });
    }
    prev = cur;
  }

  const worktree = fs.existsSync(path.join(root, rel))
    ? fs.readFileSync(path.join(root, rel))
    : Buffer.alloc(0);
  const violation = prefixViolation(prev, worktree);
  if (violation) {
    checks.push({
      pass: false,
      message: `${label} append-only: working tree rewrites ${rel} history (${violation})`,
      file: rel,
    });
  }

  if (checks.length === 0) {
    checks.push({
      pass: true,
      message: `${rel} is append-only against ${base.slice(0, 12)}`,
      file: rel,
    });
  }
  return checks;
}

/**
 * Policy may not change without a recorded approval: any change to LAW.md must
 * come with a new approved entry in the append-only decision log.
 */
function checkLawAmendmentRecorded(root: string): Check[] {
  const rel = "DECISIONS.md";
  const target = "LAW.md";

  if (git(root, ["rev-parse", "--is-inside-work-tree"]) === null) {
    return [
      {
        pass: false,
        message: "DECISIONS: not a git repository, policy changes cannot be verified",
        file: rel,
      },
    ];
  }

  const base = diffBase(root);
  if (!changedFiles(root, base).includes(target)) {
    return [
      {
        pass: true,
        message: `DECISIONS: no unrecorded policy change against ${base.slice(0, 12)}`,
        file: rel,
      },
    ];
  }

  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    return [
      {
        pass: false,
        message: `DECISIONS: ${target} changed but ${rel} does not exist`,
        file: target,
      },
    ];
  }

  // Append-only is verified separately, so everything past the old length is
  // by definition the newly appended material.
  const oldLength = traceAt(root, base, rel).length;
  const appended = fs.readFileSync(full).subarray(oldLength).toString("utf-8");

  if (hasApprovedEntry(appended, target)) {
    return [
      {
        pass: true,
        message: `DECISIONS: policy change recorded and approved against ${base.slice(0, 12)}`,
        file: rel,
      },
    ];
  }
  return [
    {
      pass: false,
      message:
        `DECISIONS: ${target} changed with no new ${rel} entry naming it and ` +
        "carrying a recorded approved_by",
      file: rel,
    },
  ];
}

export function runGate1(): GateResult {
  const root = workspaceRoot();
  const checks: Check[] = [];

  if (!root) {
    checks.push({ pass: false, message: "No workspace folder open" });
    return { gate: "Gate 1", pass: false, checks };
  }

  // Check all required files exist
  for (const file of GOVERNANCE_FILES) {
    if (fileExists(root, file)) {
      checks.push({ pass: true, message: `File exists: ${file}`, file });
    } else {
      checks.push({
        pass: false,
        message: `Missing required file: ${file}`,
        file,
      });
    }
  }

  // Check PATH.md for placeholders
  const pathContent = readFile(root, "PATH.md");
  if (pathContent) {
    const placeholderRegex = /<set [^>]+>/g;
    let m;
    const placeholders: string[] = [];
    while ((m = placeholderRegex.exec(pathContent)) !== null) {
      placeholders.push(m[0]);
    }
    if (placeholders.length > 0) {
      const loc = findLineAndColumn(pathContent, /<set [^>]+>/);
      checks.push({
        pass: false,
        message: `PATH.md contains placeholder values: ${placeholders.join(", ")}`,
        file: "PATH.md",
        line: loc?.line,
        matchStart: loc?.matchStart,
        matchEnd: loc?.matchEnd,
      });
    } else {
      checks.push({
        pass: true,
        message: "PATH.md has no unresolved placeholders",
        file: "PATH.md",
      });
    }

    // Check active_step
    if (/active_step/.test(pathContent)) {
      checks.push({
        pass: true,
        message: "PATH.md declares active_step",
        file: "PATH.md",
      });
    } else {
      checks.push({
        pass: false,
        message: "PATH.md missing active_step",
        file: "PATH.md",
      });
    }

    // Check Blocking Questions
    if (/## Blocking Questions/.test(pathContent)) {
      if (/^- \(none\)$/m.test(pathContent)) {
        checks.push({
          pass: true,
          message: "PATH.md has no blocking questions",
          file: "PATH.md",
        });
      } else {
        const loc = findLineNumber(pathContent, /## Blocking Questions/);
        checks.push({
          pass: false,
          message: "PATH.md has unresolved blocking questions",
          file: "PATH.md",
          line: loc,
        });
      }
    } else {
      checks.push({
        pass: false,
        message: "PATH.md missing Blocking Questions section",
        file: "PATH.md",
      });
    }
  }

  // Check LAW.md for Non-Negotiables
  const lawContent = readFile(root, "LAW.md");
  if (lawContent) {
    if (/## Non-Negotiables/.test(lawContent)) {
      checks.push({
        pass: true,
        message: "LAW.md contains Non-Negotiables",
        file: "LAW.md",
      });
    } else {
      checks.push({
        pass: false,
        message: "LAW.md missing Non-Negotiables section",
        file: "LAW.md",
      });
    }
  }

  const allPass = checks.every((c) => c.pass);
  return { gate: "Gate 1", pass: allPass, checks };
}

export function runGate2(): GateResult {
  const root = workspaceRoot();
  const checks: Check[] = [];

  if (!root) {
    checks.push({ pass: false, message: "No workspace folder open" });
    return { gate: "Gate 2", pass: false, checks };
  }

  // Check all required files exist
  for (const file of GOVERNANCE_FILES) {
    if (fileExists(root, file)) {
      checks.push({ pass: true, message: `File exists: ${file}`, file });
    } else {
      checks.push({
        pass: false,
        message: `Missing required file: ${file}`,
        file,
      });
    }
  }

  // Bind the declared PATH scope to the real git diff
  checks.push(...checkPathScope(root));

  // The recorded route and the record of rule changes may only grow
  checks.push(...checkAppendOnly(root, "TRACE.md", "TRACE"));
  checks.push(...checkAppendOnly(root, "DECISIONS.md", "DECISIONS"));

  // Policy may not change without a recorded approval
  checks.push(...checkLawAmendmentRecorded(root));

  // Check REALITY.md gate status is not UNKNOWN
  const realityContent = readFile(root, "REALITY.md");
  if (realityContent) {
    if (/Last gate status:\s*`UNKNOWN`/.test(realityContent)) {
      const loc = findLineAndColumn(
        realityContent,
        /Last gate status:\s*`UNKNOWN`/
      );
      checks.push({
        pass: false,
        message: "REALITY.md still has unknown gate status",
        file: "REALITY.md",
        line: loc?.line,
        matchStart: loc?.matchStart,
        matchEnd: loc?.matchEnd,
      });
    } else {
      checks.push({
        pass: true,
        message: "REALITY.md has a resolved gate status",
        file: "REALITY.md",
      });
    }

    // Check all artifacts exist on disk
    const artifactRegex = /^- `([^`]+)`$/gm;
    const artifactSection = realityContent.match(
      /## Existing Artifacts\n([\s\S]*?)(?=\n##|$)/
    );
    if (artifactSection) {
      let am;
      let missing = false;
      while ((am = artifactRegex.exec(artifactSection[1])) !== null) {
        const artifact = am[1];
        if (!fileExists(root, artifact)) {
          checks.push({
            pass: false,
            message: `REALITY artifact missing on disk: ${artifact}`,
            file: "REALITY.md",
          });
          missing = true;
        }
      }
      if (!missing) {
        checks.push({
          pass: true,
          message: "All REALITY.md listed artifacts exist on disk",
          file: "REALITY.md",
        });
      }
    }
  }

  // Check TRACE.md has dated entries with gate status
  const traceContent = readFile(root, "TRACE.md");
  if (traceContent) {
    const hasEvidence =
      /^- \d{4}-\d{2}-\d{2} .*gate_1=.*gate_2=/m.test(traceContent);
    if (hasEvidence) {
      checks.push({
        pass: true,
        message: "TRACE.md has dated gate evidence with gate_1 and gate_2",
        file: "TRACE.md",
      });
    } else {
      checks.push({
        pass: false,
        message:
          "TRACE.md missing dated gate evidence with gate_1 and gate_2",
        file: "TRACE.md",
      });
    }
  }

  const allPass = checks.every((c) => c.pass);
  return { gate: "Gate 2", pass: allPass, checks };
}
