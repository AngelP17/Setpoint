#!/usr/bin/env bash
#
# Setpoint flagship proof.
#
# Boots a local Kubernetes target (kind or current context), deploys the
# Setpoint operator + mock PLC + flagship sample IndustrialPLC, waits for
# the operator to converge to in-sync, injects deterministic drift on
# the Alert-policy register, and captures every artifact the proof needs.
#
# Outputs (all under artifacts/latest/):
#   drift-before.json        status snapshot at convergence
#   drift-after.json         status snapshot after drift injection
#   prometheus-metrics.txt   /metrics scrape at peak drift
#   kubernetes-events.txt    Warning/Normal events on the PLC
#   operator-logs.txt        last N lines of operator logs
#   proof.json               aggregate machine-readable proof
#   report.md                human-readable summary
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ARTIFACTS_DIR="${ARTIFACTS_DIR:-$REPO_ROOT/artifacts/latest}"
DRIFT_REGISTER="${DRIFT_REGISTER:-4002}"
DRIFT_VALUE="${DRIFT_VALUE:-9999}"
DRIFT_INTERVAL="${DRIFT_INTERVAL:-5}"
PROOF_PLC="${PROOF_PLC:-line-1-printer-plc}"
PROOF_NAMESPACE="${PROOF_NAMESPACE:-default}"
OPERATOR_POD_LABEL="app=setpoint-operator"
MOCK_PLC_POD_LABEL="app=setpoint-mock-plc"
CONVERGE_TIMEOUT="${CONVERGE_TIMEOUT:-90}"
DRIFT_DURATION="${DRIFT_DURATION:-45}"

C_RESET='\033[0m'
C_BLUE='\033[0;34m'
C_GREEN='\033[0;32m'
C_YELLOW='\033[1;33m'
C_RED='\033[0;31m'
C_CYAN='\033[0;36m'

step() { printf "\n${C_BLUE}==>${C_RESET} %s\n" "$*"; }
ok()   { printf "${C_GREEN}    ✓${C_RESET} %s\n" "$*"; }
warn() { printf "${C_YELLOW}    !${C_RESET} %s\n" "$*"; }
fail() { printf "${C_RED}    ✗${C_RESET} %s\n" "$*"; }

banner() {
    printf "\n${C_CYAN}"
    cat << 'EOF'
   ____  _ _   _   _   _____             _   _   _ _____
  / ___|(_) |_| \ | | |  _  \___ _ __   | \ | | / |_   _|
  \___ \| | __|  \| | | | | / _ \ '_ \  |  \| | | | | |
   ___) | | |_| |\  | | |_| \  __/ | | | | |\  | | | | |
  |____/|_|\__|_| \_| |____/ \___|_| |_| |_| \_| |_| |_|

  Flagship proof run — GitOps for the factory floor.
EOF
    printf "${C_RESET}\n"
}

require() {
    if ! command -v "$1" >/dev/null 2>&1; then
        fail "Missing prerequisite: $1"
        exit 1
    fi
}

now_iso() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

relpath() {
    local target="$1"
    if realpath --relative-to=. "$target" >/dev/null 2>&1; then
        realpath --relative-to=. "$target"
    elif [[ "$target" == "$REPO_ROOT/"* ]]; then
        printf '%s\n' "${target#$REPO_ROOT/}"
    else
        realpath "$target"
    fi
}

# ---- Subcommands ----

do_cleanup() {
    step "Cleaning up proof resources"
    kubectl delete -f k8s/sample-plc.yaml --ignore-not-found >/dev/null 2>&1 || true
    kubectl delete -f k8s/mock-plc.yaml --ignore-not-found >/dev/null 2>&1 || true
    kubectl delete -f k8s/deployment-local.yaml --ignore-not-found >/dev/null 2>&1 || true
    kubectl delete -f k8s/rbac.yaml --ignore-not-found >/dev/null 2>&1 || true
    kubectl delete -f k8s/crd.yaml --ignore-not-found >/dev/null 2>&1 || true
    pkill -f drift-simulator 2>/dev/null || true
    ok "Cleanup complete"
}

usage() {
    cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --cleanup           Tear down everything the proof created and exit
  --artifacts-dir DIR Override artifacts output directory (default: artifacts/latest)
  --plc NAME          IndustrialPLC name to target (default: line-1-printer-plc)
  --drift-register N  Register address to corrupt (default: 4002)
  --drift-value N     Value to write on each drift tick (default: 9999)
  --drift-interval S  Seconds between drift writes (default: 5)
  --drift-duration S  Seconds to run the drift injection (default: 45)
  --converge-timeout S Max seconds to wait for convergence (default: 90)
  --help              Show this help
EOF
}

# ---- Main flow ----

main() {
    local do_cleanup_only=false
    while [[ $# -gt 0 ]]; do
        case $1 in
            --cleanup) do_cleanup_only=true; shift ;;
            --artifacts-dir) ARTIFACTS_DIR="$2"; shift 2 ;;
            --plc) PROOF_PLC="$2"; shift 2 ;;
            --drift-register) DRIFT_REGISTER="$2"; shift 2 ;;
            --drift-value) DRIFT_VALUE="$2"; shift 2 ;;
            --drift-interval) DRIFT_INTERVAL="$2"; shift 2 ;;
            --drift-duration) DRIFT_DURATION="$2"; shift 2 ;;
            --converge-timeout) CONVERGE_TIMEOUT="$2"; shift 2 ;;
            --help|-h) usage; exit 0 ;;
            *) fail "Unknown option: $1"; usage; exit 1 ;;
        esac
    done

    banner

    if $do_cleanup_only; then
        do_cleanup
        exit 0
    fi

    step "Checking prerequisites"
    for tool in kubectl docker helm cargo jq; do
        require "$tool"
    done
    ok "All prerequisites present"

    mkdir -p "$ARTIFACTS_DIR"

    step "Cleaning any previous proof state"
    do_cleanup

    step "Building workspace binaries"
    cargo build --release --workspace
    ok "Binaries built"

    step "Building local Docker images"
    docker build -t setpoint-operator:latest -f Dockerfile.operator . >/dev/null
    docker build -t setpoint-mock-plc:latest -f Dockerfile.mock-plc . >/dev/null
    ok "Images built"

    step "Loading images into cluster (best-effort)"
    if kubectl get nodes -o jsonpath='{.items[0].spec.providerID}' 2>/dev/null | grep -q "kind"; then
        CLUSTER_NAME="$(kubectl config current-context | sed 's/^kind-//')"
        kind load docker-image setpoint-operator:latest --name "$CLUSTER_NAME" 2>/dev/null || true
        kind load docker-image setpoint-mock-plc:latest --name "$CLUSTER_NAME" 2>/dev/null || true
        ok "Loaded into kind cluster '$CLUSTER_NAME'"
    else
        warn "Not a kind cluster; assuming images are reachable via setpoint-operator:latest / setpoint-mock-plc:latest"
    fi

    step "Applying raw k8s manifests"
    kubectl apply -f k8s/crd.yaml
    kubectl apply -f k8s/rbac.yaml
    kubectl apply -f k8s/deployment-local.yaml
    kubectl apply -f k8s/mock-plc.yaml
    ok "Manifests applied"

    step "Applying flagship sample IndustrialPLC"
    kubectl apply -f k8s/sample-plc.yaml
    ok "Sample applied"

    step "Waiting for operator pod to be ready"
    kubectl rollout status deployment/setpoint-operator --timeout=120s
    ok "Operator ready"

    step "Waiting for mock PLC pod to be ready"
    kubectl rollout status deployment/setpoint-mock-plc --timeout=120s
    ok "Mock PLC ready"

    step "Waiting for PLC to converge (status.phase = Connected)"
    if ! wait_for_phase "$PROOF_PLC" "Connected" "$CONVERGE_TIMEOUT"; then
        fail "PLC did not converge within ${CONVERGE_TIMEOUT}s"
        kubectl describe industrialplc "$PROOF_PLC" || true
        do_cleanup
        exit 1
    fi
    ok "PLC converged"

    step "Capturing drift-before.json"
    kubectl get industrialplc "$PROOF_PLC" -o json \
        | jq '{name: .metadata.name, captured_at: "'"$(now_iso)"'", status: .status}' \
        > "$ARTIFACTS_DIR/drift-before.json"
    ok "Saved $(relpath "$ARTIFACTS_DIR/drift-before.json")"

    step "Launching drift-simulator (register @${DRIFT_REGISTER} -> ${DRIFT_VALUE}, every ${DRIFT_INTERVAL}s, for ${DRIFT_DURATION}s)"
    ./target/release/drift-simulator \
        --target="${MOCK_PLC_POD_LABEL}.${PROOF_NAMESPACE}.svc.cluster.local:5502" \
        --register="$DRIFT_REGISTER" \
        --value="$DRIFT_VALUE" \
        --interval="$DRIFT_INTERVAL" \
        > "$ARTIFACTS_DIR/drift-simulator.log" 2>&1 &
    local DRIFT_PID=$!
    echo "$DRIFT_PID" > "$ARTIFACTS_DIR/.drift-simulator.pid"
    ok "Drift simulator running (pid $DRIFT_PID)"

    step "Letting drift accumulate (${DRIFT_DURATION}s)"
    for ((i = 0; i < DRIFT_DURATION; i += 5)); do
        sleep 5
        printf "    %2ds / %2ds elapsed\n" "$((i + 5))" "$DRIFT_DURATION"
    done

    step "Capturing drift-after.json"
    kubectl get industrialplc "$PROOF_PLC" -o json \
        | jq '{name: .metadata.name, captured_at: "'"$(now_iso)"'", status: .status}' \
        > "$ARTIFACTS_DIR/drift-after.json"
    ok "Saved $(relpath "$ARTIFACTS_DIR/drift-after.json")"

    step "Capturing prometheus-metrics.txt"
    ./scripts/capture-metrics.sh > "$ARTIFACTS_DIR/prometheus-metrics.txt" 2>&1
    ok "Saved $(relpath "$ARTIFACTS_DIR/prometheus-metrics.txt")"

    step "Capturing kubernetes-events.txt"
    kubectl get events \
        --field-selector involvedObject.name="$PROOF_PLC",involvedObject.kind=IndustrialPLC \
        --sort-by=.lastTimestamp \
        -o wide \
        > "$ARTIFACTS_DIR/kubernetes-events.txt" 2>&1 || true
    ok "Saved $(relpath "$ARTIFACTS_DIR/kubernetes-events.txt")"

    step "Capturing operator-logs.txt (last 200 lines)"
    kubectl logs -l "$OPERATOR_POD_LABEL" --tail=200 \
        > "$ARTIFACTS_DIR/operator-logs.txt" 2>&1 || true
    ok "Saved $(relpath "$ARTIFACTS_DIR/operator-logs.txt")"

    step "Stopping drift-simulator (pid $DRIFT_PID)"
    if kill -0 "$DRIFT_PID" 2>/dev/null; then
        kill "$DRIFT_PID" 2>/dev/null || true
        sleep 1
        kill -9 "$DRIFT_PID" 2>/dev/null || true
    fi
    rm -f "$ARTIFACTS_DIR/.drift-simulator.pid"
    ok "Drift simulator stopped"

    step "Generating report.md"
    ./scripts/generate-report.sh
    ok "Saved $(relpath "$ARTIFACTS_DIR/report.md")"

    step "Aggregating proof.json"
    ./scripts/aggregate-proof.sh
    ok "Saved $(relpath "$ARTIFACTS_DIR/proof.json")"

    printf "\n${C_GREEN}"
    cat << 'EOF'
   ____                      _       _
  |  _ \  __ _ _ __   __ _  (_) ___ | |__
  | | | |/ _` | '_ \ / _` | | |/ _ \| '_ \
  | |_| | (_| | | | | (_| | | | (_) | |_) |
  |____/ \__,_|_| |_|\__, | |_|\___/|_.__/
                     |___/

  Flagship proof complete. Artifacts written to artifacts/latest/.
EOF
    printf "${C_RESET}\n"
}

wait_for_phase() {
    local name="$1"
    local phase="$2"
    local timeout="$3"
    local elapsed=0
    while (( elapsed < timeout )); do
        local current
        current="$(kubectl get industrialplc "$name" -o jsonpath='{.status.phase}' 2>/dev/null || echo "")"
        if [[ "$current" == "$phase" ]]; then
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    return 1
}

main "$@"
