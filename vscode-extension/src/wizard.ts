import * as vscode from "vscode";
import { TemplateVars } from "./templates";
import { todayISO } from "./parsers";

/**
 * Multi-step wizard that collects workspace configuration for governance init.
 * Returns undefined if the user cancels at any step.
 */
export async function runInitWizard(
  workspaceName: string
): Promise<TemplateVars | undefined> {
  const projectGoal = await vscode.window.showInputBox({
    title: "Governance Init (1/3): Project Goal",
    prompt: "What is the concrete goal for this workspace?",
    placeHolder: "e.g., Build a REST API for user authentication",
    validateInput: (v: string) => (v.trim() ? null : "Project goal is required"),
  });
  if (projectGoal === undefined) {
    return undefined;
  }

  const outOfScope = await vscode.window.showInputBox({
    title: "Governance Init (2/3): Out of Scope",
    prompt: "What is explicitly out of scope?",
    placeHolder: "e.g., UI work, database migration, performance tuning",
    validateInput: (v: string) => (v.trim() ? null : "Out-of-scope definition is required"),
  });
  if (outOfScope === undefined) {
    return undefined;
  }

  const projectDescription = await vscode.window.showInputBox({
    title: "Governance Init (3/3): Project Description (optional)",
    prompt: "One-line project description (press Enter to skip)",
    placeHolder: "e.g., Node.js microservice for auth tokens",
  });
  if (projectDescription === undefined) {
    return undefined;
  }

  return {
    workspaceName,
    date: todayISO(),
    projectGoal: projectGoal.trim(),
    outOfScope: outOfScope.trim(),
    projectDescription: projectDescription.trim() || undefined,
  };
}
