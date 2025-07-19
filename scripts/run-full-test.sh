#!/bin/bash

# Test Orchestrator - Complete Docker Test Runner
# This script runs comprehensive tests with automatic Docker management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Cleanup function
cleanup() {
    log "Cleaning up containers and resources..."
    docker-compose down --volumes --remove-orphans 2>/dev/null || true
    docker system prune -f 2>/dev/null || true
    log "Cleanup completed"
}

# Signal handlers
trap cleanup EXIT
trap 'error "Script interrupted"; exit 1' INT TERM

# Main execution
main() {
    log "🚀 Starting Complete Test Orchestrator"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Check if Node.js is available
    if ! command -v node >/dev/null 2>&1; then
        error "Node.js is not installed. Please install Node.js and try again."
        exit 1
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log "Installing dependencies..."
        npm install
    fi
    
    # Run the JavaScript orchestrator
    log "Executing Test Orchestrator..."
    node scripts/test-orchestrator.js
    
    if [ $? -eq 0 ]; then
        success "🎉 All tests completed successfully!"
        exit 0
    else
        error "❌ Tests failed. Check the logs for details."
        exit 1
    fi
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi