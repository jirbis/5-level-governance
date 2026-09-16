/**
 * Filesystem and git side of REALITY generation, kept apart from the pure rules
 * in realityRules.ts so those stay bundleable for the parity suite.
 *
 * Both the init flow and the Update REALITY command go through here, so neither
 * can invent its own idea of what the workspace contains. A hand-assembled file
 * list is how init came to miss nested files: it listed the root directory while
 * the gate read git.
 */
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { parsePathMd, todayISO } from "./parsers";
import { renderReality, SnapshotFacts } from "./realityRules";

function git(root: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

/**
 * Tracked plus untracked-but-not-ignored, exactly as scripts/reality_gen.sh
 * lists them. Listing only the index would leave REALITY one step behind;
 * listing only the root directory would miss every nested file.
 */
export function workspaceFiles(root: string): string[] {
  return [
    ...new Set(
      [
        git(root, ["ls-files"]) ?? "",
        git(root, ["ls-files", "--others", "--exclude-standard"]) ?? "",
      ]
        .join("\n")
        .split("\n")
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
    ),
  ].sort();
}

export function snapshotFacts(root: string): SnapshotFacts {
  const pathFile = path.join(root, "PATH.md");
  const pathContent = fs.existsSync(pathFile) ? fs.readFileSync(pathFile, "utf-8") : "";
  return {
    date: todayISO(),
    workspaceName: path.basename(root),
    activeStep: parsePathMd(pathContent).activeStep ?? "unknown",
    headSha: (git(root, ["rev-parse", "--short", "HEAD"]) ?? "unknown").trim(),
    treeState: (git(root, ["status", "--porcelain"]) ?? "").trim().length > 0 ? "dirty" : "clean",
  };
}

/**
 * Refresh the generated regions of REALITY.md in place.
 * Returns false when the file is missing or has no generated regions, so the
 * caller can refuse rather than overwrite hand-written content.
 */
export function regenerateReality(root: string, limit?: number): boolean {
  const file = path.join(root, "REALITY.md");
  if (!fs.existsSync(file)) {
    return false;
  }
  const next = renderReality(
    fs.readFileSync(file, "utf-8"),
    snapshotFacts(root),
    workspaceFiles(root),
    limit
  );
  if (next === null) {
    return false;
  }
  fs.writeFileSync(file, next, "utf-8");
  return true;
}
