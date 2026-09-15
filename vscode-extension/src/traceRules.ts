/**
 * Pure append-only rule for TRACE.md, kept free of vscode imports so it can be
 * bundled and diffed against the shell implementation in scripts/.
 *
 * Every version of TRACE.md must have the previous version as an exact byte
 * prefix. An absent file counts as empty content, so deletion surfaces as
 * truncation through the same check rather than needing a separate code path.
 */
export function prefixViolation(prev: Buffer, next: Buffer): string | null {
  if (prev.length === 0) {
    return null;
  }

  // Look for an in-place rewrite before reporting size. An edited entry usually
  // also changes the length, and calling that "truncated" would read as if
  // entries had been dropped.
  const common = Math.min(prev.length, next.length);
  let at = 0;
  while (at < common && prev[at] === next[at]) {
    at += 1;
  }
  if (at < common) {
    const line = prev.subarray(0, at).toString("utf-8").split("\n").length;
    return `diverges at byte ${at + 1}, line ${line}`;
  }
  if (next.length < prev.length) {
    return `truncated from ${prev.length} to ${next.length} bytes`;
  }
  return null;
}

/**
 * Does the newly appended section of DECISIONS.md contain an entry that names
 * `target` and carries a usable approval?
 *
 * The target and the approval must belong to the SAME entry: an approved entry
 * about one file must not justify an amendment to another. An approval that is
 * empty, a placeholder or TBD is not an approval.
 *
 * Honest limit: this verifies that an approval is RECORDED, not that it was
 * GIVEN. Binding `approved_by` to a real identity needs signed commits or a
 * reviewed pull request, which is a property of the repository, not of this rule.
 */
export function hasApprovedEntry(section: string, target: string): boolean {
  let inEntry = false;
  let namesTarget = false;
  let approved = false;

  const settled = () => inEntry && namesTarget && approved;

  for (const line of section.split("\n")) {
    if (line.startsWith("### ")) {
      if (settled()) {
        return true;
      }
      inEntry = true;
      namesTarget = false;
      approved = false;
      continue;
    }
    if (!inEntry) {
      continue;
    }
    if (line.startsWith("- `target_file`:")) {
      if (line.includes(target)) {
        namesTarget = true;
      }
      continue;
    }
    const approval = line.match(/^- `approved_by`:\s*(.*)$/);
    if (approval) {
      const value = approval[1].trim().replace(/^`|`$/g, "");
      if (
        value !== "" &&
        !value.startsWith("<") &&
        !["TBD", "NONE", "PENDING", "N/A"].includes(value.toUpperCase())
      ) {
        approved = true;
      }
    }
  }
  return settled();
}
