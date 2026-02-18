SHELL := /bin/bash

.PHONY: gate gate1 gate2

gate:
	bash ./scripts/gate_enforce.sh all

gate1:
	bash ./scripts/gate_enforce.sh gate1

gate2:
	bash ./scripts/gate_enforce.sh gate2
