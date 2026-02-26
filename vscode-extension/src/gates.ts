import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { GOVERNANCE_FILES } from "./templates";

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
