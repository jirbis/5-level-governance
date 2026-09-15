export interface PathStep {
  id: string;
  label: string;
  done: boolean;
  allowedPaths: string[];
  forbiddenPaths: string[];
}

/**
 * Always writable: the execution loop mandates writing these every run.
 * PATH.md is deliberately absent - widening the route must be declared in scope.
 */
export const IMPLICIT_ALLOWED_PATHS = ["REALITY.md", "TRACE.md"];

/**
 * Convert a PATH scope glob into a RegExp anchored at the workspace root.
 * `**` crosses path segments, `*` and `?` do not, `dir/` means `dir/**`.
 */
export function globToRegExp(glob: string): RegExp {
  let pat = glob.endsWith("/") ? `${glob}**` : glob;
  let out = "";
  let i = 0;
  while (i < pat.length) {
    if (pat[i] === "*" && pat[i + 1] === "*") {
      if (pat[i + 2] === "/") {
        out += "(?:.*/)?";
        i += 3;
      } else {
        out += ".*";
        i += 2;
      }
      continue;
    }
    const ch = pat[i];
    if (ch === "*") {
      out += "[^/]*";
    } else if (ch === "?") {
      out += "[^/]";
    } else if (".+()[]{}^$|\\".includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
    i += 1;
  }
  return new RegExp(`^${out}$`);
}

export function pathMatchesGlob(filePath: string, glob: string): boolean {
  return globToRegExp(glob).test(filePath);
}

function splitPatterns(value: string): string[] {
  return value
    .split(",")
    .map((p) => p.trim().replace(/^`|`$/g, ""))
    .filter((p) => p.length > 0);
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

  // Extract steps. Only the Step List section counts, and fenced code blocks
  // are skipped so that documented examples are never parsed as real steps.
  const steps: PathStep[] = [];
  const stepRegex = /^- \[([ xX])\]\s*`([^`]+)`\s*(.*)/;
  let fence = false;
  let inList = false;
  let current: PathStep | null = null;
  for (const line of lines) {
    if (/^```/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) {
      continue;
    }
    if (/^## Step List/.test(line)) {
      inList = true;
      continue;
    }
    if (/^## /.test(line)) {
      inList = false;
      current = null;
      continue;
    }
    if (!inList) {
      continue;
    }
    const match = line.match(stepRegex);
    if (match) {
      current = {
        id: match[2],
        label: match[3].trim().replace(/\.$/, ""),
        done: match[1].toLowerCase() === "x",
        allowedPaths: [],
        forbiddenPaths: [],
      };
      steps.push(current);
      continue;
    }
    if (!current) {
      continue;
    }
    const allowed = line.match(/^\s+allowed_paths:\s*(.*)$/);
    if (allowed) {
      current.allowedPaths.push(...splitPatterns(allowed[1]));
      continue;
    }
    const forbidden = line.match(/^\s+forbidden_paths:\s*(.*)$/);
    if (forbidden) {
      current.forbiddenPaths.push(...splitPatterns(forbidden[1]));
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

  // Shard form, one file per entry: "# 2026-02-18 — LABEL" followed by the body
  // and the gate lines. Shards are concatenated before parsing.
  const shardRegex = /^# (\d{4}-\d{2}-\d{2}) [—-] (.+)$/gm;
  let m;
  while ((m = shardRegex.exec(content)) !== null) {
    const rest = content.slice(m.index + m[0].length);
    const body = rest.split(/^# \d{4}-\d{2}-\d{2} [—-] /m)[0];
    const g1 = body.match(/gate_1[`"']?\s*[:=]\s*`?(\w+)/);
    const g2 = body.match(/gate_2[`"']?\s*[:=]\s*`?(\w+)/);
    entries.push({
      date: m[1],
      label: m[2].trim(),
      description: body.trim().split("\n")[0] ?? "",
      gate1: g1 ? g1[1] : null,
      gate2: g2 ? g2[1] : null,
    });
  }

  // Legacy single-file form: "- 2026-02-18 — LABEL: description; gate_1=PASS, ..."
  const legacyRegex =
    /^- (\d{4}-\d{2}-\d{2}) — ([^:]+):\s*(.+?)(?:;\s*gate_1=(\w+).*?gate_2=(\w+))?\.?\s*$/gm;
  while ((m = legacyRegex.exec(content)) !== null) {
    entries.push({
      date: m[1],
      label: m[2].trim(),
      description: m[3].trim(),
      gate1: m[4] || null,
      gate2: m[5] || null,
    });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return { entries };
}

export function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
