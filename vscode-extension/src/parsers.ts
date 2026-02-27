export interface PathStep {
  id: string;
  label: string;
  done: boolean;
}

export interface ParsedPath {
  activeStep: string | null;
  steps: PathStep[];
  placeholders: string[];
  hasBlockingQuestions: boolean;
  blockingQuestions: string[];
}

export interface ParsedReality {
  date: string | null;
  workspaceRoot: string | null;
  activeStep: string | null;
  gateStatus: string | null;
  artifacts: string[];
  risks: string[];
}

export interface TraceEntry {
  date: string;
  label: string;
  description: string;
  gate1: string | null;
  gate2: string | null;
}

export interface ParsedTrace {
  entries: TraceEntry[];
}

export function parsePathMd(content: string): ParsedPath {
  const lines = content.split("\n");

  // Extract active step
  const activeStepMatch = content.match(/`active_step`:\s*`(\w+)`/);
  const activeStep = activeStepMatch ? activeStepMatch[1] : null;

  // Extract steps
  const steps: PathStep[] = [];
  const stepRegex = /^- \[([ x])\] `(\w+)` (.+)/;
  for (const line of lines) {
    const match = line.match(stepRegex);
    if (match) {
      steps.push({
        id: match[2],
        label: match[3].trim().replace(/\.$/, ""),
        done: match[1] === "x",
      });
    }
  }

  // Extract placeholders
  const placeholders: string[] = [];
  const placeholderRegex = /<set [^>]+>/g;
  let m;
  while ((m = placeholderRegex.exec(content)) !== null) {
    placeholders.push(m[0]);
  }

  // Check blocking questions
  const blockingSection = content.match(
    /## Blocking Questions\n([\s\S]*?)(?=\n##|$)/
  );
  let hasBlockingQuestions = false;
  const blockingQuestions: string[] = [];
  if (blockingSection) {
    const sectionLines = blockingSection[1].trim().split("\n");
    for (const line of sectionLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") && trimmed !== "- (none)") {
        hasBlockingQuestions = true;
        blockingQuestions.push(trimmed.slice(2));
      }
    }
  }

  return { activeStep, steps, placeholders, hasBlockingQuestions, blockingQuestions };
}

export function parseRealityMd(content: string): ParsedReality {
  const dateMatch = content.match(/Date:\s*`([^`]+)`/);
  const rootMatch = content.match(/Workspace root:\s*`([^`]+)`/);
  const stepMatch = content.match(/Active PATH step:\s*`([^`]+)`/);
  const gateMatch = content.match(/Last gate status:\s*`([^`]+)`/);

  // Extract artifacts: lines like "- `filename`"
  const artifacts: string[] = [];
  const artifactRegex = /^- `([^`]+)`$/gm;
  const artifactSection = content.match(
    /## Existing Artifacts\n([\s\S]*?)(?=\n##|$)/
  );
  if (artifactSection) {
    let am;
    while ((am = artifactRegex.exec(artifactSection[1])) !== null) {
      artifacts.push(am[1]);
    }
  }

  // Extract risks
  const risks: string[] = [];
  const riskSection = content.match(/## Open Risks\n([\s\S]*?)(?=\n##|$)/);
  if (riskSection) {
    const riskLines = riskSection[1].trim().split("\n");
    for (const line of riskLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ")) {
        risks.push(trimmed.slice(2));
      }
    }
  }

  return {
    date: dateMatch ? dateMatch[1] : null,
    workspaceRoot: rootMatch ? rootMatch[1] : null,
    activeStep: stepMatch ? stepMatch[1] : null,
    gateStatus: gateMatch ? gateMatch[1] : null,
    artifacts,
    risks,
  };
}

export function parseTraceMd(content: string): ParsedTrace {
  const entries: TraceEntry[] = [];
  // Match lines like: - 2026-02-18 — LABEL: description; gate_1=PASS, gate_2=PASS.
  const entryRegex =
    /^- (\d{4}-\d{2}-\d{2}) — ([^:]+):\s*(.+?)(?:;\s*gate_1=(\w+).*?gate_2=(\w+))?\.?\s*$/gm;
  let m;
  while ((m = entryRegex.exec(content)) !== null) {
    entries.push({
      date: m[1],
      label: m[2].trim(),
      description: m[3].trim(),
      gate1: m[4] || null,
      gate2: m[5] || null,
    });
  }
  return { entries };
}

export function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
