import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export interface WorkspaceInfo {
  projectName: string;
  projectDescription: string;
  languages: string[];
  testFrameworks: string[];
  ciPlatforms: string[];
  license: string;
  repositoryUrl: string;
  sourceDir: string;
  testDir: string;
  existingFiles: string[];
  dockerized: boolean;
}

/**
 * Scans the workspace root and returns auto-discovered metadata.
 * Every field has a safe default — missing files are silently skipped.
 */
export function scanWorkspace(root: string): WorkspaceInfo {
  const info: WorkspaceInfo = {
    projectName: path.basename(root),
    projectDescription: "",
    languages: [],
    testFrameworks: [],
    ciPlatforms: [],
    license: "",
    repositoryUrl: "",
    sourceDir: "",
    testDir: "",
    existingFiles: [],
    dockerized: false,
  };

  collectPackageJson(root, info);
  collectCargoToml(root, info);
  collectPyproject(root, info);
  collectGoMod(root, info);
  collectReadme(root, info);
  collectGitInfo(root, info);
  collectDirectoryStructure(root, info);
  collectCICD(root, info);
  collectTestFrameworks(root, info);
  collectLicense(root, info);
  collectDockerInfo(root, info);
  collectExistingFiles(root, info);

  // deduplicate
  info.languages = [...new Set(info.languages)];
  info.testFrameworks = [...new Set(info.testFrameworks)];
  info.ciPlatforms = [...new Set(info.ciPlatforms)];

  return info;
}

/** Format discovered info as a human-readable summary string. */
export function formatScanSummary(info: WorkspaceInfo): string {
  const parts: string[] = [];
  parts.push(`Project: ${info.projectName}`);
  if (info.projectDescription) {
    parts.push(`Description: ${info.projectDescription}`);
  }
  if (info.languages.length) {
    parts.push(`Languages: ${info.languages.join(", ")}`);
  }
  if (info.testFrameworks.length) {
    parts.push(`Tests: ${info.testFrameworks.join(", ")}`);
  }
  if (info.ciPlatforms.length) {
    parts.push(`CI/CD: ${info.ciPlatforms.join(", ")}`);
  }
  if (info.license) {
    parts.push(`License: ${info.license}`);
  }
  if (info.repositoryUrl) {
    parts.push(`Repository: ${info.repositoryUrl}`);
  }
  if (info.dockerized) {
    parts.push("Dockerized: yes");
  }
  return parts.join("\n");
}

// ---- collectors ----

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function collectPackageJson(root: string, info: WorkspaceInfo): void {
  const raw = readFileSafe(path.join(root, "package.json"));
  if (!raw) { return; }
  try {
    const pkg = JSON.parse(raw);
    if (pkg.name) { info.projectName = pkg.name; }
    if (pkg.description) { info.projectDescription = pkg.description; }
    if (pkg.license) { info.license = pkg.license; }

    // languages
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.typescript || fs.existsSync(path.join(root, "tsconfig.json"))) {
      info.languages.push("TypeScript");
    } else {
      info.languages.push("JavaScript");
    }

    // test frameworks from deps
    if (deps.jest || deps["@jest/core"]) { info.testFrameworks.push("Jest"); }
    if (deps.vitest) { info.testFrameworks.push("Vitest"); }
    if (deps.mocha) { info.testFrameworks.push("Mocha"); }
    if (deps.cypress) { info.testFrameworks.push("Cypress"); }
    if (deps.playwright || deps["@playwright/test"]) { info.testFrameworks.push("Playwright"); }
  } catch {
    // malformed JSON — skip
  }
}

function collectCargoToml(root: string, info: WorkspaceInfo): void {
  const raw = readFileSafe(path.join(root, "Cargo.toml"));
  if (!raw) { return; }
  info.languages.push("Rust");
  const nameMatch = raw.match(/^name\s*=\s*"([^"]+)"/m);
  if (nameMatch) { info.projectName = nameMatch[1]; }
  const descMatch = raw.match(/^description\s*=\s*"([^"]+)"/m);
  if (descMatch && !info.projectDescription) { info.projectDescription = descMatch[1]; }
  const licMatch = raw.match(/^license\s*=\s*"([^"]+)"/m);
  if (licMatch && !info.license) { info.license = licMatch[1]; }
}

function collectPyproject(root: string, info: WorkspaceInfo): void {
  const raw = readFileSafe(path.join(root, "pyproject.toml")) ??
              readFileSafe(path.join(root, "setup.py"));
  if (!raw) {
    // also check requirements.txt
    if (fs.existsSync(path.join(root, "requirements.txt"))) {
      info.languages.push("Python");
    }
    return;
  }
  info.languages.push("Python");
  const nameMatch = raw.match(/^name\s*=\s*"([^"]+)"/m);
  if (nameMatch && !info.projectDescription) { info.projectName = nameMatch[1]; }
  if (raw.includes("pytest")) { info.testFrameworks.push("pytest"); }
}

function collectGoMod(root: string, info: WorkspaceInfo): void {
  const raw = readFileSafe(path.join(root, "go.mod"));
  if (!raw) { return; }
  info.languages.push("Go");
  const modMatch = raw.match(/^module\s+(\S+)/m);
  if (modMatch) {
    const parts = modMatch[1].split("/");
    info.projectName = parts[parts.length - 1];
  }
}

function collectReadme(root: string, info: WorkspaceInfo): void {
  const raw = readFileSafe(path.join(root, "README.md"));
  if (!raw || info.projectDescription) { return; }
  // Extract first non-heading, non-empty paragraph
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("![")) {
      info.projectDescription = trimmed.slice(0, 200);
      break;
    }
  }
}

function collectGitInfo(root: string, info: WorkspaceInfo): void {
  try {
    const url = execSync("git remote get-url origin", { cwd: root, encoding: "utf-8" }).trim();
    info.repositoryUrl = url;
  } catch {
    // no git or no remote
  }
}

function collectDirectoryStructure(root: string, info: WorkspaceInfo): void {
  const srcCandidates = ["src", "lib", "app", "pkg", "cmd"];
  for (const dir of srcCandidates) {
    if (dirExists(root, dir)) {
      info.sourceDir = dir + "/";
      break;
    }
  }
  const testCandidates = ["test", "tests", "spec", "__tests__"];
  for (const dir of testCandidates) {
    if (dirExists(root, dir)) {
      info.testDir = dir + "/";
      break;
    }
  }
}

function collectCICD(root: string, info: WorkspaceInfo): void {
  if (dirExists(root, ".github/workflows")) { info.ciPlatforms.push("GitHub Actions"); }
  if (fs.existsSync(path.join(root, ".gitlab-ci.yml"))) { info.ciPlatforms.push("GitLab CI"); }
  if (fs.existsSync(path.join(root, "Jenkinsfile"))) { info.ciPlatforms.push("Jenkins"); }
  if (dirExists(root, ".circleci")) { info.ciPlatforms.push("CircleCI"); }
  if (fs.existsSync(path.join(root, "azure-pipelines.yml"))) { info.ciPlatforms.push("Azure Pipelines"); }
}

function collectTestFrameworks(root: string, info: WorkspaceInfo): void {
  // Check config files (supplements deps-based detection in collectPackageJson)
  if (fs.existsSync(path.join(root, "jest.config.js")) ||
      fs.existsSync(path.join(root, "jest.config.ts"))) {
    info.testFrameworks.push("Jest");
  }
  if (fs.existsSync(path.join(root, "vitest.config.ts")) ||
      fs.existsSync(path.join(root, "vitest.config.js"))) {
    info.testFrameworks.push("Vitest");
  }
  if (fs.existsSync(path.join(root, "pytest.ini")) ||
      fs.existsSync(path.join(root, "conftest.py"))) {
    info.testFrameworks.push("pytest");
  }
}

function collectLicense(root: string, info: WorkspaceInfo): void {
  if (info.license) { return; }
  const raw = readFileSafe(path.join(root, "LICENSE")) ??
              readFileSafe(path.join(root, "LICENSE.md"));
  if (!raw) { return; }
  if (raw.includes("MIT License")) { info.license = "MIT"; }
  else if (raw.includes("Apache License")) { info.license = "Apache-2.0"; }
  else if (raw.includes("GNU GENERAL PUBLIC LICENSE")) { info.license = "GPL"; }
  else { info.license = "See LICENSE file"; }
}

function collectDockerInfo(root: string, info: WorkspaceInfo): void {
  info.dockerized = fs.existsSync(path.join(root, "Dockerfile")) ||
                    fs.existsSync(path.join(root, "docker-compose.yml")) ||
                    fs.existsSync(path.join(root, "docker-compose.yaml"));
}

function collectExistingFiles(root: string, info: WorkspaceInfo): void {
  try {
    const entries = fs.readdirSync(root);
    info.existingFiles = entries.filter((e) => {
      const full = path.join(root, e);
      try {
        const stat = fs.statSync(full);
        return stat.isFile();
      } catch {
        return false;
      }
    });
  } catch {
    // empty
  }
}

function dirExists(root: string, dir: string): boolean {
  try {
    return fs.statSync(path.join(root, dir)).isDirectory();
  } catch {
    return false;
  }
}
