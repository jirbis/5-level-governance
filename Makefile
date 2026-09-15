SHELL := /bin/bash

.PHONY: gate gate1 gate2

gate:
	bash ./scripts/gate_enforce.sh all

gate1:
	bash ./scripts/gate_enforce.sh gate1

gate2:
	bash ./scripts/gate_enforce.sh gate2

.PHONY: test
test:
	bash ./scripts/test_path_scope.sh
	bash ./scripts/test_trace_append_only.sh
	bash ./scripts/test_decision_log.sh
	bash ./scripts/test_gate_report.sh
	node ./scripts/test_extension_parity.mjs

.PHONY: report
report:
	@bash ./scripts/gate_report.sh
