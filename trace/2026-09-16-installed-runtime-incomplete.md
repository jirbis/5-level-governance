# 2026-09-16 — INSTALLED RUNTIME INCOMPLETE

CI failed on pull request #7. The cause was mine and the way it hid is the
interesting part.

`gate_report.sh` calls `verify_approval.sh`, and I did not add the new script to
the list the installer copies. So an installed project got a report that invokes
a file it does not have.

Locally the whole suite passed. `gate_report.sh` only calls the verifier when
`GOVERNANCE_APPROVERS_FILE` is set, which it is not on a developer machine, so
the call never happened and the gap was invisible. In CI the workflow sets that
variable for the step that runs `make test`, the installer fixture inherited it,
and the missing file surfaced immediately. Reproduced locally by setting the
same variable.

Two fixes, because shipping the file alone would leave the class open:

- `verify_approval.sh` is now installed with the rest of the runtime.
- A structural assertion walks every installed script, extracts each
  `$ROOT/scripts/*.sh` it references, and requires the referenced file to be
  present. A hand-maintained copy list drifts; a closure check does not.

And the approval path is now exercised deterministically rather than only when
CI happens to export the variable: the suite sets it itself and asserts the row
passes on an unchanged `LAW.md`, fails when the recorded approver did not
approve, passes when the real approver is named, and fails when the approver
list is unavailable. A suite that only runs a path under CI's environment tests
nothing on the machine where the code is written.

The same lesson then landed a second time in one sitting. Running the suite with
the variable exported turned up an assertion in `test_verify_approval.sh` that
had been inheriting it: the case for "the approver list could not be
established" was quietly receiving a real list and passing. In CI, where it
matters, that test verified nothing. It now uses `env -u`. A fixture that does
not control its own environment tests whatever the environment happens to be.

Files: `scripts/install.sh`, `scripts/test_install.sh`,
`scripts/test_verify_approval.sh`, `PATH.md`, `REALITY.md`.

Deviations: none; scope declared in step A7 before the work.

- `gate_1`: PASS — A7 declared and bounded before the fix
- `gate_2`: PASS — scope clean, records append-only, REALITY current

Evidence: installer assertions 42 → 48, including the runtime closure check and
five covering the approval path; the original failure reproduced locally before
the fix and gone after it.
