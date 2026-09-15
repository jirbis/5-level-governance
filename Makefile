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
	bash ./scripts/test_decision_log.sh
	bash ./scripts/test_gate_report.sh
	bash ./scripts/test_reality_gen.sh
	bash ./scripts/test_shard_store.sh
	node ./scripts/test_extension_parity.mjs
	node ./scripts/test_init_integration.mjs

.PHONY: trace decisions
trace:
	@bash -c 'source ./scripts/shard_store.sh && shard_render . trace'

decisions:
	@bash -c 'source ./scripts/shard_store.sh && shard_render . decisions'

.PHONY: reality
reality:
	@bash ./scripts/reality_update.sh

.PHONY: report
report:
	@bash ./scripts/gate_report.sh
