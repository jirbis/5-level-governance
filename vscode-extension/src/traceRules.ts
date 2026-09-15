/**
 * Pure rules for the decision log, free of vscode imports so they can be
 * bundled and diffed against the shell implementation in scripts/.
 */
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
