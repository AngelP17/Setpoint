# Setpoint Makefile
# "GitOps for the factory floor."
#
# Top-level orchestration: build, lint, test, helm, run a local demo,
# and run the flagship proof.

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

REGISTRY    ?= ghcr.io/apinzon
OPERATOR_IMG ?= $(REGISTRY)/setpoint-operator
MOCK_IMG    ?= $(REGISTRY)/setpoint-mock-plc
VERSION     ?= 0.2.0

CHART       := charts/setpoint
NAMESPACE   ?= default

# Proof run parameters (override on the command line if needed)
DRIFT_REGISTER   ?= 4002
DRIFT_VALUE      ?= 9999
DRIFT_INTERVAL   ?= 5
PROOF_PLC        ?= line-1-printer-plc
ARTIFACTS_DIR    ?= artifacts/latest

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nSetpoint Makefile\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} \
	/^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ---- Build ----

.PHONY: build
build: ## Build all workspace binaries in release mode
	cargo build --release --workspace

.PHONY: build-debug
build-debug: ## Build all workspace binaries in debug mode
	cargo build --workspace

.PHONY: build-images
build-images: ## Build both Docker images
	docker build -t $(OPERATOR_IMG):$(VERSION) -f Dockerfile.operator .
	docker build -t $(MOCK_IMG):$(VERSION) -f Dockerfile.mock-plc .
	docker tag $(OPERATOR_IMG):$(VERSION) $(OPERATOR_IMG):latest
	docker tag $(MOCK_IMG):$(VERSION) $(MOCK_IMG):latest

.PHONY: build-images-local
build-images-local: ## Build local-only images (no push, used by demo.sh)
	docker build -t setpoint-operator:latest -f Dockerfile.operator .
	docker build -t setpoint-mock-plc:latest -f Dockerfile.mock-plc .

# ---- Lint & Test ----

.PHONY: fmt
fmt: ## Check formatting
	cargo fmt --all -- --check

.PHONY: fmt-fix
fmt-fix: ## Apply formatting
	cargo fmt --all

.PHONY: lint
lint: ## Run clippy with -D warnings
	cargo clippy --workspace --all-targets -- -D warnings

.PHONY: test
test: ## Run all unit tests
	cargo test --workspace

.PHONY: ci-local
ci-local: ## Run the local CI script (fmt + clippy + test + build images + helm lint)
	./ci-local.sh

# ---- Helm ----

.PHONY: helm-lint
helm-lint: ## Lint the Helm chart
	helm lint $(CHART)

.PHONY: helm-template
helm-template: ## Render the Helm chart to stdout
	helm template setpoint $(CHART)

.PHONY: helm-install
helm-install: ## Install the chart into the current cluster
	helm upgrade --install setpoint $(CHART) --namespace $(NAMESPACE) --create-namespace

.PHONY: helm-uninstall
helm-uninstall: ## Uninstall the chart
	helm uninstall setpoint --namespace $(NAMESPACE) || true

# ---- Local demo ----

.PHONY: demo
demo: ## Run the full interactive demo
	./demo.sh

.PHONY: demo-quick
demo-quick: ## Run a non-interactive quick demo
	./demo.sh quick

.PHONY: demo-watch
demo-watch: ## Stream the live operator status
	./demo.sh watch

.PHONY: demo-cleanup
demo-cleanup: ## Tear down demo resources
	./demo.sh cleanup

.PHONY: k8s-apply
k8s-apply: ## Apply raw k8s manifests (CRD, RBAC, deployment, mock, samples)
	kubectl apply -f k8s/crd.yaml
	kubectl apply -f k8s/rbac.yaml
	kubectl apply -f k8s/deployment-local.yaml
	kubectl apply -f k8s/mock-plc.yaml
	kubectl apply -f k8s/sample-plc.yaml

.PHONY: k8s-delete
k8s-delete: ## Delete raw k8s manifests
	kubectl delete -f k8s/sample-plc.yaml 2>/dev/null || true
	kubectl delete -f k8s/mock-plc.yaml 2>/dev/null || true
	kubectl delete -f k8s/deployment-local.yaml 2>/dev/null || true
	kubectl delete -f k8s/rbac.yaml 2>/dev/null || true
	kubectl delete -f k8s/crd.yaml 2>/dev/null || true

# ---- Observability stack ----

.PHONY: obs-up
obs-up: ## Start Prometheus + Grafana via docker compose
	docker compose up -d

.PHONY: obs-down
obs-down: ## Stop Prometheus + Grafana
	docker compose down

# ---- Flagship proof ----
#
# The flagship proof is a deterministic, recorded end-to-end run that
# demonstrates: apply CRD, deploy operator + mock PLC, converge to in-sync,
# inject drift, observe detection (and per-policy remediation), and capture
# every artifact (status, events, metrics, logs) under artifacts/latest/.

.PHONY: flagship-proof
flagship-proof: build ## Run the flagship proof end-to-end and write artifacts to $(ARTIFACTS_DIR)
	./scripts/flagship-proof.sh

.PHONY: proof-cleanup
proof-cleanup: ## Tear down everything the proof run created
	./scripts/flagship-proof.sh --cleanup

.PHONY: proof-report
proof-report: ## Regenerate the human-readable report from already-captured artifacts
	./scripts/generate-report.sh

# ---- Convenience ----

.PHONY: clean
clean: ## Remove build artifacts
	cargo clean
	rm -rf artifacts/latest/*

.PHONY: status
status: ## Show current operator + PLC status
	kubectl get industrialplc -A
	@echo
	kubectl get pods -l app=setpoint-operator
	@echo
	kubectl logs -l app=setpoint-operator --tail=20 || true
