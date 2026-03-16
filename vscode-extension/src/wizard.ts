import * as vscode from "vscode";
import { TemplateVars } from "./templates";
import { todayISO } from "./parsers";
import { scanWorkspace, formatScanSummary } from "./scanner";

/**
 * Multi-step wizard that scans the workspace for real project info,
 * shows a summary, then collects remaining manual inputs.
 * Returns undefined if the user cancels at any step.
 */
export async function runInitWizard(
  workspaceName: string,
  workspaceRoot: string
): Promise<TemplateVars | undefined> {
  // Step 0: Auto-discover workspace metadata
  const info = scanWorkspace(workspaceRoot);
  const summary = formatScanSummary(info);

  const proceed = await vscode.window.showInformationMessage(
    "Workspace scanned. Review detected configuration?",
    { modal: false },
    "Review & Continue",
    "Skip Scan"
  );
  if (proceed === undefined) {
    return undefined;
  }

  if (proceed === "Review & Continue") {
    // Show discovered info and let user confirm or cancel
    const doc = await vscode.workspace.openTextDocument({
      content: `# Detected Workspace Configuration\n\n${summary}\n\n# Close this tab and continue the wizard prompts.`,
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  }

  // Step 1: Project Goal — pre-fill from discovered description
  const projectGoal = await vscode.window.showInputBox({
    title: "Governance Init (1/3): Project Goal",
    prompt: "What is the concrete goal for this workspace?",
    value: info.projectDescription || undefined,
    placeHolder: "e.g., Build a REST API for user authentication",
    validateInput: (v: string) => (v.trim() ? null : "Project goal is required"),
  });
  if (projectGoal === undefined) {
    return undefined;
  }

  // Step 2: Out of Scope
  const outOfScope = await vscode.window.showInputBox({
    title: "Governance Init (2/3): Out of Scope",
    prompt: "What is explicitly out of scope?",
    placeHolder: "e.g., UI work, database migration, performance tuning",
    validateInput: (v: string) => (v.trim() ? null : "Out-of-scope definition is required"),
  });
  if (outOfScope === undefined) {
    return undefined;
  }

  // Step 3: Project Description — pre-fill from discovered description
  const projectDescription = await vscode.window.showInputBox({
    title: "Governance Init (3/3): Project Description (optional)",
    prompt: "One-line project description (press Enter to skip)",
    value: info.projectDescription || undefined,
    placeHolder: "e.g., Node.js microservice for auth tokens",
  });
  if (projectDescription === undefined) {
    return undefined;
  }

  return {
    workspaceName: info.projectName || workspaceName,
    date: todayISO(),
    projectGoal: projectGoal.trim(),
    outOfScope: outOfScope.trim(),
    projectDescription: projectDescription.trim() || undefined,
    // auto-discovered fields
    languages: info.languages.length ? info.languages : undefined,
    testFrameworks: info.testFrameworks.length ? info.testFrameworks : undefined,
    ciPlatforms: info.ciPlatforms.length ? info.ciPlatforms : undefined,
    license: info.license || undefined,
    repositoryUrl: info.repositoryUrl || undefined,
    sourceDir: info.sourceDir || undefined,
    testDir: info.testDir || undefined,
    existingFiles: info.existingFiles.length ? info.existingFiles : undefined,
    dockerized: info.dockerized || undefined,
  };
}
