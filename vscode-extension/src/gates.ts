import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { GOVERNANCE_FILES, GOVERNANCE_DIRS } from "./templates";
import {
  IMPLICIT_ALLOWED_PATHS,
  parsePathMd,
  pathMatchesGlob,
} from "./parsers";
import { hasApprovedEntry } from "./traceRules";
import { realityStaleness } from "./realityRules";
import { immutabilityViolation, isEntry, statesGateEvidence } from "./shardRules";

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
// trace/ and decisions/ are append-only records: one of work, one of rule
// changes. Sharded into a file per entry, append-only is per-file immutability:
// a shard that existed at the base must be byte-identical now.
function nameStatusRecords(root: string, args: string[]): [string, string, string?][] {
  const out = git(root, args) ?? "";
  return out
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => l.split("\t"))
    .filter((f) => f.length >= 2)
    .map((f) => [f[0], f[1], f[2]] as [string, string, string?]);
}

/**
 * Shards already part of the record at <base>. Only these are protected: an
 * entry added on this branch may still be corrected before it merges, but one
 * already in the record may not be touched.
 */
function shardsAtBase(root: string, base: string, dir: string): Set<string> {
  const out = git(root, ["ls-tree", "-r", "--name-only", base, "--", `${dir}/`]) ?? "";
  return new Set(
    out.split("\n").map((l) => l.trim()).filter((l) => isEntry(l, dir))
  );
}

function checkShardImmutability(root: string, dir: string, label: string): Check[] {
  if (git(root, ["rev-parse", "--is-inside-work-tree"]) === null) {
    return [
      {
        pass: false,
        message: `${label} append-only: not a git repository, history cannot be verified`,
        file: dir,
      },
    ];
  }

  const base = diffBase(root);
  const checks: Check[] = [];
  const protectedShards = shardsAtBase(root, base, dir);

  // Walk each commit as well as the endpoints: a branch that rewrites an entry
  // in one commit and restores it in the next has still tampered with the
  // record, and comparing only the endpoints would call that clean.
  const revs = (git(root, ["rev-list", "--reverse", `${base}..HEAD`]) ?? "")
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  for (const rev of revs) {
    const records = nameStatusRecords(root, [
      "diff-tree", "--no-commit-id", "--name-status", "-r",
      "--diff-filter=MDRT", rev, "--", `${dir}/`,
    ]);
    for (const [, pathA] of records) {
      if (!protectedShards.has(pathA)) {
        continue;
      }
      const short = (git(root, ["rev-parse", "--short", rev]) ?? rev).trim();
      checks.push({
        pass: false,
        message: `${label} append-only: touched in commit ${short}: ${pathA}`,
        file: pathA,
      });
    }
  }

  const endpoints = [
    ...nameStatusRecords(root, ["diff", "--name-status", base, "--", `${dir}/`]),
    ...nameStatusRecords(root, ["diff", "--name-status", "--cached", base, "--", `${dir}/`]),
  ];
  const seen = new Set<string>();
  for (const [status, pathA, pathB] of endpoints) {
    if (!isEntry(pathA, dir)) {
      continue;
    }
    const violation = immutabilityViolation(status, pathA, pathB);
    if (violation && !seen.has(violation)) {
      seen.add(violation);
      checks.push({
        pass: false,
        message: `${label} append-only: ${violation}`,
        file: pathA,
      });
    }
  }

  if (checks.length === 0) {
    checks.push({
      pass: true,
      message: `${dir}/ is append-only against ${base.slice(0, 12)}`,
      file: dir,
    });
  }
  return checks;
}

/**
 * Every entry must carry its gate evidence. The single-file record could only
 * be asked whether some line somewhere had it; a shard per entry can be asked
 * of each one.
 */
function checkTraceEvidence(root: string): Check[] {
  const dir = "trace";
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) {
    return [{ pass: false, message: "TRACE evidence: trace/ does not exist", file: dir }];
  }
  const entries = fs
    .readdirSync(full)
    .map((f) => `${dir}/${f}`)
    .filter((f) => isEntry(f, dir))
    .sort();

  if (entries.length === 0) {
    return [{ pass: false, message: "TRACE evidence: trace/ contains no entries", file: dir }];
  }

  const checks: Check[] = [];
  for (const entry of entries) {
    if (!statesGateEvidence(fs.readFileSync(path.join(root, entry), "utf-8"))) {
      checks.push({
        pass: false,
        message: `TRACE evidence: ${entry} does not state gate_1 and gate_2`,
        file: entry,
      });
    }
  }
  if (checks.length === 0) {
    checks.push({
      pass: true,
      message: `all ${entries.length} trace entr(ies) state gate_1 and gate_2`,
      file: dir,
    });
  }
  return checks;
}

/**
 * Policy may not change without a recorded approval: any change to LAW.md must
 * come with a new approved entry in the append-only decision log.
 */
function checkLawAmendmentRecorded(root: string): Check[] {
  const dir = "decisions";
  const target = "LAW.md";

  if (git(root, ["rev-parse", "--is-inside-work-tree"]) === null) {
    return [
      {
        pass: false,
        message: "DECISIONS: not a git repository, policy changes cannot be verified",
        file: dir,
      },
    ];
  }

  const base = diffBase(root);
  if (!changedFiles(root, base).includes(target)) {
    return [
      {
        pass: true,
        message: `DECISIONS: no unrecorded policy change against ${base.slice(0, 12)}`,
        file: dir,
      },
    ];
  }

  const full = path.join(root, dir);
  if (!fs.existsSync(full)) {
    return [
      {
        pass: false,
        message: `DECISIONS: ${target} changed but ${dir}/ does not exist`,
        file: target,
      },
    ];
  }

  // Sharded, "what is new" is simply which files did not exist before - no byte
  // arithmetic, and no ambiguity when two agents added entries in parallel.
  const atBase = shardsAtBase(root, base, dir);
  const added = fs
    .readdirSync(full)
    .map((f) => `${dir}/${f}`)
    .filter((f) => isEntry(f, dir) && !atBase.has(f))
    .sort();
  const section = added
    .map((f) => fs.readFileSync(path.join(root, f), "utf-8"))
    .join("\n");

  if (hasApprovedEntry(section, target)) {
    return [
      {
        pass: true,
        message: `DECISIONS: policy change recorded and approved against ${base.slice(0, 12)}`,
        file: dir,
      },
    ];
  }
  return [
    {
      pass: false,
      message:
        `DECISIONS: ${target} changed with no new ${dir}/ entry naming it and ` +
        "carrying a recorded approved_by",
      file: dir,
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

  // Check all required files and record directories exist
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
  for (const dir of GOVERNANCE_DIRS) {
    if (fs.existsSync(path.join(root, dir))) {
      checks.push({ pass: true, message: `Directory exists: ${dir}/`, file: dir });
    } else {
      checks.push({
        pass: false,
        message: `Missing required directory: ${dir}/`,
        file: dir,
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

  // Check all required files and record directories exist
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
  for (const dir of GOVERNANCE_DIRS) {
    if (fs.existsSync(path.join(root, dir))) {
      checks.push({ pass: true, message: `Directory exists: ${dir}/`, file: dir });
    } else {
      checks.push({
        pass: false,
        message: `Missing required directory: ${dir}/`,
        file: dir,
      });
    }
  }

  // Bind the declared PATH scope to the real git diff
  checks.push(...checkPathScope(root));

  // The recorded route and the record of rule changes may only grow
  checks.push(...checkShardImmutability(root, "trace", "TRACE"));
  checks.push(...checkShardImmutability(root, "decisions", "DECISIONS"));
  checks.push(...checkTraceEvidence(root));

  // Policy may not change without a recorded approval
  checks.push(...checkLawAmendmentRecorded(root));

  // REALITY is generated, so "is it current?" is answerable: compare the
  // recorded artifact region against the tracked tree. This replaces two weaker
  // checks - that the file did not contain the word UNKNOWN, and that
  // everything it listed existed. Neither could see a file that existed but was
  // never recorded, which is the drift this repository actually suffered.
  const realityContent = readFile(root, "REALITY.md");
  if (realityContent) {
    const tracked = (git(root, ["ls-files"]) ?? "")
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
    const staleness = realityStaleness(realityContent, tracked);
    if (staleness.stale) {
      const loc = findLineNumber(realityContent, /generated:artifacts/);
      checks.push({
        pass: false,
        message: `REALITY: ${staleness.reason}`,
        file: "REALITY.md",
        line: loc,
      });
    } else {
      checks.push({
        pass: true,
        message: "REALITY.md matches the tree",
        file: "REALITY.md",
      });
    }
  }

  const allPass = checks.every((c) => c.pass);
  return { gate: "Gate 2", pass: allPass, checks };
}
