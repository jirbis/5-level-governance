import * as vscode from "vscode";
import * as path from "path";
import { GateResult, Check } from "./gates";

let diagnosticCollection: vscode.DiagnosticCollection;

export function initDiagnostics(
  context: vscode.ExtensionContext
): vscode.DiagnosticCollection {
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection("governance");
  context.subscriptions.push(diagnosticCollection);
  return diagnosticCollection;
}

export function updateDiagnostics(
  ...results: GateResult[]
): void {
  diagnosticCollection.clear();

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return;
  }

  // Group checks by file
  const byFile = new Map<string, Check[]>();
  for (const result of results) {
    for (const check of result.checks) {
      if (!check.pass && check.file) {
        const existing = byFile.get(check.file) || [];
        existing.push(check);
        byFile.set(check.file, existing);
      }
    }
  }

  for (const [file, checks] of byFile) {
    const uri = vscode.Uri.file(path.join(root, file));
    const diagnostics: vscode.Diagnostic[] = checks.map((check) => {
      let range: vscode.Range;
      if (
        check.line !== undefined &&
        check.matchStart !== undefined &&
        check.matchEnd !== undefined
      ) {
        range = new vscode.Range(
          check.line,
          check.matchStart,
          check.line,
          check.matchEnd
        );
      } else if (check.line !== undefined) {
        range = new vscode.Range(check.line, 0, check.line, 1000);
      } else {
        range = new vscode.Range(0, 0, 0, 0);
      }

      const diagnostic = new vscode.Diagnostic(
        range,
        check.message,
        check.message.toLowerCase().includes("missing")
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = "Governance";
      return diagnostic;
    });

    diagnosticCollection.set(uri, diagnostics);
  }
}

export function clearDiagnostics(): void {
  diagnosticCollection?.clear();
}
