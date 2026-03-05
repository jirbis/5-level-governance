import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { GOVERNANCE_FILES, getTemplate, GovernanceFile } from "./templates";
import { runGate1, runGate2, GateResult } from "./gates";
import { initDiagnostics, updateDiagnostics, clearDiagnostics } from "./diagnostics";
import { GovernanceTreeProvider, createStatusBarItem, updateStatusBarItem } from "./treeView";
import { appendTraceEntry, updateReality } from "./traceAppend";
import { runInitWizard } from "./wizard";

let outputChannel: vscode.OutputChannel;
let treeProvider: GovernanceTreeProvider;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel("Governance Gates");
  initDiagnostics(context);

  treeProvider = new GovernanceTreeProvider();
  vscode.window.registerTreeDataProvider("governanceStatus", treeProvider);

  statusBarItem = createStatusBarItem();
  context.subscriptions.push(statusBarItem);

  // Watch governance files for status bar updates
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.md");
  watcher.onDidChange(() => updateStatusBarItem(statusBarItem));
  watcher.onDidCreate(() => updateStatusBarItem(statusBarItem));
  watcher.onDidDelete(() => updateStatusBarItem(statusBarItem));
  context.subscriptions.push(watcher);

  context.subscriptions.push(
    vscode.commands.registerCommand("governance.init", handleInit),
    vscode.commands.registerCommand("governance.gate1", handleGate1),
    vscode.commands.registerCommand("governance.gate2", handleGate2),
    vscode.commands.registerCommand("governance.gateAll", handleGateAll),
    vscode.commands.registerCommand("governance.appendTrace", handleAppendTrace),
    vscode.commands.registerCommand("governance.updateReality", handleUpdateReality),
    vscode.commands.registerCommand("governance.openFile", handleOpenFile)
  );
}

export function deactivate(): void {
  treeProvider?.dispose();
  outputChannel?.dispose();
}

// --- Command handlers ---

async function handleInit(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  // Check if any governance files already exist
  const existing = GOVERNANCE_FILES.filter((f) =>
    fs.existsSync(path.join(root, f))
  );
  if (existing.length > 0) {
    const choice = await vscode.window.showWarningMessage(
      `Governance files already exist: ${existing.join(", ")}. Overwrite?`,
      "Overwrite",
      "Cancel"
    );
    if (choice !== "Overwrite") {
      return;
    }
  }

  const workspaceName = path.basename(root);
  const vars = await runInitWizard(workspaceName);
  if (!vars) {
    return; // user cancelled wizard
  }

  for (const file of GOVERNANCE_FILES) {
    const content = getTemplate(file, vars);
    fs.writeFileSync(path.join(root, file), content, "utf-8");
  }

  treeProvider.refresh();
  updateStatusBarItem(statusBarItem);

  vscode.window.showInformationMessage(
    `Governance initialized with ${GOVERNANCE_FILES.length} files.`
  );

  // Open CLAUDE.md
  const claudeUri = vscode.Uri.file(path.join(root, "CLAUDE.md"));
  await vscode.window.showTextDocument(claudeUri);
}

async function handleGate1(): Promise<void> {
  const result = runGate1();
  logGateResult(result);
  updateDiagnostics(result);
  treeProvider.refresh();
  updateStatusBarItem(statusBarItem);
  showGateNotification(result);
}

async function handleGate2(): Promise<void> {
  const result = runGate2();
  logGateResult(result);
  updateDiagnostics(result);
  treeProvider.refresh();
  updateStatusBarItem(statusBarItem);
  showGateNotification(result);
}

async function handleGateAll(): Promise<void> {
  const g1 = runGate1();
  const g2 = runGate2();
  logGateResult(g1);
  logGateResult(g2);
  updateDiagnostics(g1, g2);
  treeProvider.refresh();
  updateStatusBarItem(statusBarItem);

  const allPass = g1.pass && g2.pass;
  if (allPass) {
    vscode.window.showInformationMessage("All gates PASS.");
  } else {
    const failures: string[] = [];
    if (!g1.pass) {
      failures.push("Gate 1");
    }
    if (!g2.pass) {
      failures.push("Gate 2");
    }
    vscode.window.showErrorMessage(`FAIL: ${failures.join(" and ")}.`);
  }
  clearDiagnostics();
  updateDiagnostics(g1, g2);
}

async function handleAppendTrace(): Promise<void> {
  await appendTraceEntry();
  treeProvider.refresh();
  updateStatusBarItem(statusBarItem);
}

async function handleUpdateReality(): Promise<void> {
  await updateReality();
  treeProvider.refresh();
  updateStatusBarItem(statusBarItem);
}

async function handleOpenFile(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    vscode.window.showErrorMessage("No workspace folder open.");
    return;
  }

  const items = GOVERNANCE_FILES.map((f) => ({
    label: f,
    description: fs.existsSync(path.join(root, f)) ? "" : "missing",
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: "Select a governance file to open",
  });

  if (picked) {
    const filePath = path.join(root, picked.label as GovernanceFile);
    if (fs.existsSync(filePath)) {
      await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    } else {
      vscode.window.showWarningMessage(
        `${picked.label} does not exist. Run 'Initialize Governance' first.`
      );
    }
  }
}

// --- Helpers ---

function logGateResult(result: GateResult): void {
  outputChannel.appendLine("");
  outputChannel.appendLine(`== ${result.gate}: ${result.pass ? "PASS" : "FAIL"} ==`);
  for (const check of result.checks) {
    outputChannel.appendLine(`  ${check.pass ? "PASS" : "FAIL"}: ${check.message}`);
  }
  outputChannel.show(true);
}

function showGateNotification(result: GateResult): void {
  const failCount = result.checks.filter((c) => !c.pass).length;
  if (result.pass) {
    vscode.window.showInformationMessage(`${result.gate}: PASS`);
  } else {
    vscode.window.showErrorMessage(
      `${result.gate}: FAIL (${failCount} issue${failCount > 1 ? "s" : ""})`
    );
  }
}
