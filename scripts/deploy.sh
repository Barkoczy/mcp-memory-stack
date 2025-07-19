#!/bin/bash

# Production Deployment Script for MCP Memory Stack
# Following security best practices 2025

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
PROJECT_NAME="mcp-memory-stack"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose v2 is not available"
        exit 1
    fi
    
    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Compose file $COMPOSE_FILE not found"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

check_system_resources() {
    log_info "Checking system resources..."
    
    # Check available memory (minimum 4GB)
    AVAILABLE_MEM=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    if [ "$AVAILABLE_MEM" -lt 4096 ]; then
        log_warning "Available memory is less than 4GB: ${AVAILABLE_MEM}MB"
    fi
    
    # Check available disk space (minimum 10GB)
    AVAILABLE_DISK=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
    if [ "$AVAILABLE_DISK" -lt 10 ]; then
        log_warning "Available disk space is less than 10GB: ${AVAILABLE_DISK}GB"
    fi
    
    log_success "System resources check completed"
}

setup_secrets() {
    log_info "Setting up secrets..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        if [ ! -d "secrets" ]; then
            log_error "Secrets directory not found. Run ./secrets/generate-secrets.sh first"
            exit 1
        fi
        
        # Check if all required secrets exist
        REQUIRED_SECRETS=("db_password.txt" "jwt_secret.txt" "api_key.txt")
        for secret in "${REQUIRED_SECRETS[@]}"; do
            if [ ! -f "secrets/$secret" ]; then
                log_error "Required secret file secrets/$secret not found"
                exit 1
            fi
        done
        
        # Check file permissions
        for secret in "${REQUIRED_SECRETS[@]}"; do
            PERMS=$(stat -c "%a" "secrets/$secret")
            if [ "$PERMS" != "600" ]; then
                log_warning "Fixing permissions for secrets/$secret"
                chmod 600 "secrets/$secret"
            fi
        done
    fi
    
    log_success "Secrets setup completed"
}

validate_configuration() {
    log_info "Validating Docker Compose configuration..."
    
    if ! docker compose -f "$COMPOSE_FILE" config &> /dev/null; then
        log_error "Docker Compose configuration is invalid"
        docker compose -f "$COMPOSE_FILE" config
        exit 1
    fi
    
    log_success "Configuration validation passed"
}

pull_images() {
    log_info "Pulling Docker images..."
    
    docker compose -f "$COMPOSE_FILE" pull
    
    log_success "Images pulled successfully"
}

deploy_services() {
    log_info "Deploying services..."
    
    # Start services in detached mode
    docker compose -f "$COMPOSE_FILE" up -d
    
    log_success "Services deployed"
}

wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    # Wait for health checks to pass
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker compose -f "$COMPOSE_FILE" ps | grep -q "healthy"; then
            log_success "Services are healthy"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts - waiting for services..."
        sleep 10
        ((attempt++))
    done
    
    log_error "Services failed to become healthy within timeout"
    docker compose -f "$COMPOSE_FILE" ps
    return 1
}

run_health_checks() {
    log_info "Running health checks..."
    
    # Check if health endpoint is responding
    if [ "$ENVIRONMENT" = "production" ]; then
        HEALTH_URL="http://localhost:3334/health"
    else
        HEALTH_URL="http://localhost:3334/health"
    fi
    
    if curl -f "$HEALTH_URL" &> /dev/null; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        return 1
    fi
}

show_status() {
    log_info "Deployment status:"
    echo ""
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    
    log_info "Service logs (last 10 lines):"
    docker compose -f "$COMPOSE_FILE" logs --tail=10
}

cleanup_old_resources() {
    log_info "Cleaning up old resources..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes (be careful in production)
    if [ "$ENVIRONMENT" != "production" ]; then
        docker volume prune -f
    fi
    
    log_success "Cleanup completed"
}

main() {
    echo "🚀 MCP Memory Stack Deployment Script"
    echo "Environment: $ENVIRONMENT"
    echo "Compose file: $COMPOSE_FILE"
    echo ""
    
    check_prerequisites
    check_system_resources
    setup_secrets
    validate_configuration
    pull_images
    deploy_services
    wait_for_services
    run_health_checks
    show_status
    cleanup_old_resources
    
    echo ""
    log_success "🎉 Deployment completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "  - Monitor logs: docker compose -f $COMPOSE_FILE logs -f"
    echo "  - Check status: docker compose -f $COMPOSE_FILE ps"
    echo "  - Access health: curl http://localhost:3334/health"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "  - Setup monitoring: docker compose -f docker-compose.monitoring.yml up -d"
        echo "  - Review security: ./scripts/security-check.sh"
    fi
}

# Handle script arguments
case "${1:-}" in
    "production"|"staging"|"dev")
        main
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [environment]"
        echo "Environments: production, staging, dev"
        echo "Default: production"
        exit 0
        ;;
    *)
        if [ $# -eq 0 ]; then
            main
        else
            log_error "Invalid environment: $1"
            echo "Valid environments: production, staging, dev"
            exit 1
        fi
        ;;
esac
