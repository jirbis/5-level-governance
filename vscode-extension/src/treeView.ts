import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { parsePathMd, parseRealityMd, parseTraceMd } from "./parsers";
import { GOVERNANCE_FILES } from "./templates";

type TreeItem = StatusItem | FileItem | TraceItem;

class StatusItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly value: string,
    icon: vscode.ThemeIcon
  ) {
    super(`${label}: ${value}`, vscode.TreeItemCollapsibleState.None);
    this.iconPath = icon;
    this.contextValue = "status";
  }
}

class FileItem extends vscode.TreeItem {
  constructor(
    public readonly filename: string,
    exists: boolean,
    root: string
  ) {
    super(filename, vscode.TreeItemCollapsibleState.None);
    this.iconPath = exists
      ? new vscode.ThemeIcon("file")
      : new vscode.ThemeIcon("warning");
    this.contextValue = "governanceFile";
    if (exists) {
      this.command = {
        command: "vscode.open",
        title: "Open",
        arguments: [vscode.Uri.file(path.join(root, filename))],
      };
    }
    this.description = exists ? "" : "missing";
  }
}

class TraceItem extends vscode.TreeItem {
  constructor(date: string, label: string) {
    super(`${date} — ${label}`, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("history");
    this.contextValue = "traceEntry";
  }
}

class SectionItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly children: TreeItem[],
    icon: vscode.ThemeIcon
  ) {
    super(
      label,
      children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
    this.iconPath = icon;
    this.contextValue = "section";
  }
}

type Element = StatusItem | SectionItem | FileItem | TraceItem;

export class GovernanceTreeProvider
  implements vscode.TreeDataProvider<Element>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    Element | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private watcher: vscode.FileSystemWatcher | undefined;

  constructor() {
    // Watch for changes to governance files
    this.watcher = vscode.workspace.createFileSystemWatcher("**/*.md");
    this.watcher.onDidChange(() => this.refresh());
    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  dispose(): void {
    this.watcher?.dispose();
    this._onDidChangeTreeData.dispose();
  }

  getTreeItem(element: Element): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Element): Element[] {
    if (!element) {
      return this.getRootElements();
    }
    if (element instanceof SectionItem) {
      return element.children;
    }
    return [];
  }

  private getRootElements(): Element[] {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) {
      return [
        new StatusItem(
          "Status",
          "No workspace open",
          new vscode.ThemeIcon("error")
        ),
      ];
    }

    const elements: Element[] = [];

    // Parse governance state
    const pathContent = this.readFile(root, "PATH.md");
    const realityContent = this.readFile(root, "REALITY.md");
    const traceContent = this.readFile(root, "TRACE.md");

    // Active step
    if (pathContent) {
      const parsed = parsePathMd(pathContent);
      elements.push(
        new StatusItem(
          "Active Step",
          parsed.activeStep || "none",
          new vscode.ThemeIcon("debug-step-over")
        )
      );
    }

    // Gate status
    if (realityContent) {
      const parsed = parseRealityMd(realityContent);
      const status = parsed.gateStatus || "UNKNOWN";
      const icon =
        status === "PASS"
          ? new vscode.ThemeIcon("pass")
          : status === "FAIL"
            ? new vscode.ThemeIcon("error")
            : new vscode.ThemeIcon("question");
      elements.push(new StatusItem("Gate Status", status, icon));
    }

    // Files section
    const fileItems = GOVERNANCE_FILES.map(
      (f) => new FileItem(f, fs.existsSync(path.join(root, f)), root)
    );
    elements.push(
      new SectionItem("Files", fileItems, new vscode.ThemeIcon("folder"))
    );

    // TRACE entries
    if (traceContent) {
      const parsed = parseTraceMd(traceContent);
      const traceItems = parsed.entries.map(
        (e) => new TraceItem(e.date, e.label)
      );
      elements.push(
        new SectionItem(
          `TRACE (${traceItems.length} entries)`,
          traceItems,
          new vscode.ThemeIcon("list-ordered")
        )
      );
    }

    return elements;
  }

  private readFile(root: string, filename: string): string | null {
    const p = path.join(root, filename);
    if (!fs.existsSync(p)) {
      return null;
    }
    return fs.readFileSync(p, "utf-8");
  }
}

export function createStatusBarItem(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50
  );
  item.command = "governance.gateAll";
  item.tooltip = "Click to run all governance gates";
  updateStatusBarItem(item);
  return item;
}

export function updateStatusBarItem(item: vscode.StatusBarItem): void {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    item.hide();
    return;
  }

  // Only show if governance is initialized (LAW.md exists)
  const lawPath = path.join(root, "LAW.md");
  if (!fs.existsSync(lawPath)) {
    item.hide();
    return;
  }

  let stepText = "??";
  let gateText = "??";

  const pathFile = path.join(root, "PATH.md");
  if (fs.existsSync(pathFile)) {
    const content = fs.readFileSync(pathFile, "utf-8");
    const parsed = parsePathMd(content);
    stepText = parsed.activeStep || "??";
  }

  const realityFile = path.join(root, "REALITY.md");
  if (fs.existsSync(realityFile)) {
    const content = fs.readFileSync(realityFile, "utf-8");
    const parsed = parseRealityMd(content);
    gateText = parsed.gateStatus || "??";
  }

  item.text = `$(law) ${stepText} | Gate: ${gateText}`;
  item.show();
}
