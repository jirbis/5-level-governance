/**
 * Pure rules for the sharded append-only records, free of vscode imports so
 * they can be bundled and diffed against scripts/shard_store.sh.
 *
 * A single append-only file is correct but not usable: two agents appending on
 * the same day collide on the last line of the same file every time. One file
 * per entry removes the conflict by construction, and turns "the new content
 * must have the old as a prefix" into the sharper "a shard that existed at the
 * base must be byte-identical now" - a per-file question git already answers.
 */

/** README.md holds the directory's own rules, not an entry. */
export function isEntry(relPath: string, dir: string): boolean {
  return relPath.startsWith(`${dir}/`) && relPath.endsWith(".md") && !relPath.endsWith("/README.md");
}

export function shardSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 60);
}

export function shardFileName(date: string, label: string): string {
  const slug = shardSlug(label) || "entry";
  return `${date}-${slug}.md`;
}

/**
 * Classify one `git diff --name-status` record for a record directory.
 * Anything other than an addition is a rewrite of recorded history.
 */
export function immutabilityViolation(
  status: string,
  pathA: string,
  pathB?: string
): string | null {
  if (status.startsWith("A")) {
    return null;
  }
  if (status.startsWith("M")) {
    return `modified: ${pathA}`;
  }
  if (status.startsWith("D")) {
    return `deleted: ${pathA}`;
  }
  if (status.startsWith("R")) {
    return `renamed: ${pathA} -> ${pathB ?? "?"}`;
  }
  if (status.startsWith("C")) {
    return `copied over: ${pathA}`;
  }
  if (status.startsWith("T")) {
    return `type changed: ${pathA}`;
  }
  return `altered (${status}): ${pathA}`;
}

/**
 * `Gate1`/`Gate2` is the older CODIFY output spelling. Entries written that way
 * do state both outcomes, and rewriting them to match today's spelling would be
 * falsifying the record this rule exists to protect.
 */
export function statesGateEvidence(entry: string): boolean {
  return /gate_1|Gate1/.test(entry) && /gate_2|Gate2/.test(entry);
}
