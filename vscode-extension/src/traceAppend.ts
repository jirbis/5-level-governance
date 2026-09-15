import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { parsePathMd, todayISO } from "./parsers";
import { renderReality, SnapshotFacts } from "./realityRules";
import { GOVERNANCE_FILES } from "./templates";
import { shardFileName } from "./shardRules";

/** The newest entry by filename, which sorts chronologically. */
function latestTraceEntry(root: string): string {
  const dir = path.join(root, "trace");
  if (!fs.existsSync(dir)) {
    return path.join(dir, "missing.md");
  }
  const entries = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();
  return path.join(dir, entries[entries.length - 1] ?? "missing.md");
}

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function appendTraceEntry(): Promise<void> {
  const root = workspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  const traceDir = path.join(root, "trace");
  if (!fs.existsSync(traceDir)) {
    vscode.window.showErrorMessage("trace/ not found. Run 'Initialize Governance' first.");
    return;
  }

  const label = await vscode.window.showInputBox({
    prompt: "Step label (e.g., INIT, ADD FEATURE, FIX BUG)",
    placeHolder: "LABEL",
  });
  if (!label) {
    return;
  }

  const description = await vscode.window.showInputBox({
    prompt: "Description of what changed",
    placeHolder: "Brief description of changes",
  });
  if (!description) {
    return;
  }

  const gate1 = await vscode.window.showQuickPick(["PASS", "FAIL"], {
    placeHolder: "Gate 1 result",
  });
  if (!gate1) {
    return;
  }

  const gate1Reason = await vscode.window.showInputBox({
    prompt: "Gate 1 reason (brief)",
    placeHolder: "e.g., structure aligns with LAW",
  });
  if (!gate1Reason) {
    return;
  }

  const gate2 = await vscode.window.showQuickPick(["PASS", "FAIL"], {
    placeHolder: "Gate 2 result",
  });
  if (!gate2) {
    return;
  }

  const gate2Reason = await vscode.window.showInputBox({
    prompt: "Gate 2 reason (brief)",
    placeHolder: "e.g., REALITY matches created files",
  });
  if (!gate2Reason) {
    return;
  }

  const date = todayISO();
  const entry = `# ${date} — ${label}

${description}

- \`gate_1\`: ${gate1} — ${gate1Reason}
- \`gate_2\`: ${gate2} — ${gate2Reason}
`;

  // A new file per entry, never an edit to an existing one: that is what makes
  // the record append-only and what keeps parallel agents from colliding.
  let name = shardFileName(date, label);
  let n = 2;
  while (fs.existsSync(path.join(traceDir, name))) {
    name = shardFileName(date, label).replace(/\.md$/, `-${n}.md`);
    n += 1;
  }
  fs.writeFileSync(path.join(traceDir, name), entry, "utf-8");

  vscode.window.showInformationMessage(`TRACE entry written: trace/${name}`);
}

export async function updateReality(): Promise<void> {
  const root = workspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  const realityPath = path.join(root, "REALITY.md");
  if (!fs.existsSync(realityPath)) {
    vscode.window.showErrorMessage("REALITY.md not found. Run 'Initialize Governance' first.");
    return;
  }

  const pathContent = fs.existsSync(path.join(root, "PATH.md"))
    ? fs.readFileSync(path.join(root, "PATH.md"), "utf-8")
    : "";
  const activeStep = parsePathMd(pathContent).activeStep ?? "unknown";

  const run = (args: string[]): string | null => {
    try {
      return execFileSync("git", ["-C", root, ...args], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch {
      return null;
    }
  };

  // Tracked plus untracked-but-not-ignored, matching scripts/reality_gen.sh.
  const tracked = [
    ...new Set(
      [run(["ls-files"]) ?? "", run(["ls-files", "--others", "--exclude-standard"]) ?? ""]
        .join("\n")
        .split("\n")
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
    ),
  ].sort();

  const facts: SnapshotFacts = {
    date: todayISO(),
    workspaceName: path.basename(root),
    activeStep,
    headSha: (run(["rev-parse", "--short", "HEAD"]) ?? "unknown").trim(),
    treeState: (run(["status", "--porcelain"]) ?? "").trim().length > 0 ? "dirty" : "clean",
  };

  const current = fs.readFileSync(realityPath, "utf-8");
  const next = renderReality(current, facts, tracked);

  // Refuse rather than overwrite. The hand-written sections are the reason only
  // part of this file is generated, and a template would discard them.
  if (next === null) {
    vscode.window.showErrorMessage(
      "REALITY.md has no generated regions. Add the generated:snapshot and " +
        "generated:artifacts markers, or run `make reality`, before using this command."
    );
    return;
  }

  fs.writeFileSync(realityPath, next, "utf-8");
  vscode.window.showInformationMessage(
    `REALITY.md regenerated: step=${activeStep}, ${tracked.length} artifact(s)`
  );
}
