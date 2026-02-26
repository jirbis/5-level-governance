import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { parsePathMd, parseRealityMd, parseTraceMd, todayISO } from "./parsers";
import { GOVERNANCE_FILES } from "./templates";

function workspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function appendTraceEntry(): Promise<void> {
  const root = workspaceRoot();
  if (!root) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  const tracePath = path.join(root, "TRACE.md");
  if (!fs.existsSync(tracePath)) {
    vscode.window.showErrorMessage("TRACE.md not found. Run 'Initialize Governance' first.");
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
  const entry = `- ${date} — ${label}: ${description}; gate_1=${gate1} (${gate1Reason}), gate_2=${gate2} (${gate2Reason}).`;

  const content = fs.readFileSync(tracePath, "utf-8");
  const newContent = content.trimEnd() + "\n" + entry + "\n";
  fs.writeFileSync(tracePath, newContent, "utf-8");

  vscode.window.showInformationMessage(`TRACE entry appended: ${label}`);
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

  const date = todayISO();
  const workspaceName = path.basename(root);

  // Get active step from PATH.md
  let activeStep = "P1";
  const pathFile = path.join(root, "PATH.md");
  if (fs.existsSync(pathFile)) {
    const pathContent = fs.readFileSync(pathFile, "utf-8");
    const parsed = parsePathMd(pathContent);
    activeStep = parsed.activeStep || "P1";
  }

  // Get last gate status from TRACE.md
  let gateStatus = "UNKNOWN";
  const traceFile = path.join(root, "TRACE.md");
  if (fs.existsSync(traceFile)) {
    const traceContent = fs.readFileSync(traceFile, "utf-8");
    const parsed = parseTraceMd(traceContent);
    if (parsed.entries.length > 0) {
      const last = parsed.entries[parsed.entries.length - 1];
      if (last.gate1 && last.gate2) {
        gateStatus =
          last.gate1 === "PASS" && last.gate2 === "PASS" ? "PASS" : "FAIL";
      }
    }
  }

  // Discover existing governance artifacts
  const artifacts: string[] = [];
  for (const file of GOVERNANCE_FILES) {
    if (fs.existsSync(path.join(root, file))) {
      artifacts.push(file);
    }
  }

  // Check for additional common files
  for (const extra of ["README.md", "Makefile", "scripts/gate_enforce.sh"]) {
    if (fs.existsSync(path.join(root, extra))) {
      artifacts.push(extra);
    }
  }

  // Build open risks
  const risks: string[] = [];
  if (fs.existsSync(pathFile)) {
    const pathContent = fs.readFileSync(pathFile, "utf-8");
    const parsed = parsePathMd(pathContent);
    if (parsed.placeholders.length > 0) {
      risks.push("PATH values still contain placeholders and must be set before operational use.");
    }
    if (parsed.hasBlockingQuestions) {
      risks.push("PATH has unresolved blocking questions.");
    }
  }
  if (gateStatus === "UNKNOWN") {
    risks.push("Gate status has not been resolved yet.");
  }

  const artifactLines = artifacts.map((a) => `- \`${a}\``).join("\n");
  const riskLines =
    risks.length > 0
      ? risks.map((r) => `- ${r}`).join("\n")
      : "- (none)";

  const newContent = `# REALITY

## Current State Snapshot
- Date: \`${date}\`
- Workspace root: \`${workspaceName}\`
- Active PATH step: \`${activeStep}\`
- Last gate status: \`${gateStatus}\`

## Existing Artifacts
${artifactLines}

## Open Risks
${riskLines}

## Notes
- This file represents current truth and must be updated after each admissible execution step.
`;

  fs.writeFileSync(realityPath, newContent, "utf-8");
  vscode.window.showInformationMessage(
    `REALITY.md updated: step=${activeStep}, gate=${gateStatus}`
  );
}
