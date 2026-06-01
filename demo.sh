#!/bin/bash
set -e

# Setpoint Demo Script
# Demonstrates the full Setpoint GitOps-for-PLC workflow

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
    echo -e "${CYAN}"
    cat << 'EOF'
   ____  _ _   _   _   _____             _   _   _ _____ 
  / ___|(_) |_| \ | | |  _  \___ _ __   | \ | | / |_   _|
  \___ \| | __|  \| | | | | / _ \ '_ \  |  \| | | | | |  
   ___) | | |_| |\  | | |_| \  __/ | | | | |\  | | | | |  
  |____/|_|\__|_| \_| |____/ \___|_| |_| |_| \_| |_| |_|  
                                                        
   _____           _       _       
  |_   _|__   ___ | |_ ___| |_ ___ 
    | |/ _ \ / _ \| __/ _ \ __/ _ \
    | | (_) | (_) | ||  __/ ||  __/
    |_|\___/ \___/ \__\___|\__\___|
EOF
    echo -e "${NC}"
    echo -e "${GREEN}GitOps for the factory floor.${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

wait_for_enter() {
    echo ""
    read -p "Press Enter to continue..."
    echo ""
}

check_prerequisites() {
    print_step "Checking prerequisites..."

    command -v docker >/dev/null 2>&1 || { print_error "Docker is required but not installed."; exit 1; }
    command -v kubectl >/dev/null 2>&1 || { print_error "kubectl is required but not installed."; exit 1; }
    command -v helm >/dev/null 2>&1 || { print_error "Helm is required but not installed."; exit 1; }

    print_success "All prerequisites found"
}

build_binaries() {
    print_step "Building Setpoint binaries..."

    if [ ! -f "target/release/operator" ] || [ ! -f "target/release/setpointctl" ] || [ ! -f "target/release/mock-plc" ] || [ ! -f "target/release/drift-simulator" ]; then
        print_info "Building release binaries (this may take a while)..."
        cargo build --release --workspace
    else
        print_info "Binaries already built, skipping..."
    fi

    print_success "Binaries ready"
}

start_observability() {
    print_step "Starting Observability Stack (Prometheus + Grafana)..."

    docker compose up -d

    print_success "Prometheus available at: http://localhost:9090"
    print_success "Grafana available at: http://localhost:3000 (admin/setpoint)"
}

start_mock_plc() {
    print_step "Building and deploying Mock PLC into Kind cluster..."

    pkill -f mock-plc 2>/dev/null || true

    print_info "Building mock-plc Docker image..."
    docker build -t setpoint-mock-plc:latest -f Dockerfile.mock-plc .

    print_info "Loading mock-plc image into Kind cluster..."
    kind load docker-image setpoint-mock-plc:latest --name setpoint 2>/dev/null || \
        print_warning "Kind cluster 'setpoint' not found; assuming image is already loaded"

    kubectl apply -f k8s/mock-plc.yaml

    print_info "Waiting for mock-plc to be ready..."
    kubectl rollout status deployment/setpoint-mock-plc --timeout=120s

    print_success "Mock PLC deployed in-cluster (chaos mode, multi-register)"
}

deploy_operator() {
    print_step "Deploying Setpoint Operator to Kubernetes..."

    kubectl apply -f k8s/crd.yaml
    print_info "CRD applied"

    kubectl apply -f k8s/rbac.yaml
    print_info "RBAC applied"

    kubectl apply -f k8s/deployment-local.yaml
    print_info "Operator deployment applied"

    print_info "Waiting for operator to be ready..."
    kubectl rollout status deployment/setpoint-operator --timeout=120s

    print_success "Operator deployed"
}

create_plcs() {
    print_step "Creating sample PLC resources..."

    kubectl apply -f k8s/sample-plc.yaml

    print_info "Waiting for PLC reconciliation..."
    sleep 5

    print_success "PLCs created"
}

show_status() {
    print_step "Current PLC Status (Git vs Reality)"
    echo ""
    ./target/release/setpointctl get-status
}

watch_demo() {
    print_step "Starting Live Dashboard (Press Ctrl+C to stop watching)"
    print_info "Watch how the operator detects and corrects drift!"
    echo ""

    timeout 30 ./target/release/setpointctl watch --interval 2 || true
}

manual_sync_demo() {
    print_step "Manual Sync Demonstration"

    print_info "Triggering manual sync for line-1-printer-plc..."
    ./target/release/setpointctl sync line-1-printer-plc --force

    sleep 2

    print_info "Current status after manual sync:"
    ./target/release/setpointctl get-status
}

show_grafana_info() {
    print_step "Grafana Dashboard"

    print_info "Open http://localhost:3000 in your browser"
    print_info "Login: admin / setpoint"
    print_info "Navigate to Dashboards -> Setpoint Dashboard"
    print_info ""
    print_info "You should see:"
    print_info "  - drift_events_total counter increasing (labeled by register)"
    print_info "  - corrections_total counter increasing (labeled by register + strategy)"
    print_info "  - register_value gauge per-register"
    print_info "  - plc_connection_status showing connected"
}

cleanup() {
    print_step "Cleaning up..."

    docker compose down

    kubectl delete -f k8s/sample-plc.yaml 2>/dev/null || true
    kubectl delete -f k8s/mock-plc.yaml 2>/dev/null || true
    kubectl delete -f k8s/deployment-local.yaml 2>/dev/null || true
    kubectl delete -f k8s/rbac.yaml 2>/dev/null || true
    kubectl delete -f k8s/crd.yaml 2>/dev/null || true

    print_success "Cleanup complete"
}

main() {
    print_banner

    if [ "$1" == "cleanup" ]; then
        cleanup
        exit 0
    fi

    if [ "$1" == "quick" ]; then
        print_info "Running quick demo..."
        check_prerequisites
        build_binaries
        start_observability
        start_mock_plc
        deploy_operator
        create_plcs
        show_status
        echo ""
        print_success "Quick demo setup complete!"
        print_info "Run './demo.sh watch' to see the live dashboard"
        print_info "Run './demo.sh cleanup' to clean up resources"
        exit 0
    fi

    if [ "$1" == "watch" ]; then
        watch_demo
        exit 0
    fi

    check_prerequisites
    wait_for_enter

    build_binaries
    wait_for_enter

    start_observability
    wait_for_enter

    start_mock_plc
    wait_for_enter

    deploy_operator
    wait_for_enter

    create_plcs
    wait_for_enter

    show_status
    wait_for_enter

    watch_demo
    wait_for_enter

    manual_sync_demo
    wait_for_enter

    show_grafana_info

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Demo Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    print_info "To clean up resources, run: ./demo.sh cleanup"
}

trap cleanup EXIT

main "$@"
