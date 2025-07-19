#!/bin/bash

# rollback.sh - Emergency rollback script for MCP Memory Stack
# Usage: ./scripts/rollback.sh [version] [--force] [--backup]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
ROLLBACK_LOG="$PROJECT_ROOT/rollback.log"

# Default options
FORCE_ROLLBACK="false"
CREATE_BACKUP="false"
TARGET_VERSION=""
CURRENT_VERSION=""

# Function to print colored output
print_status() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    log_message "SUCCESS: $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    log_message "WARNING: $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    log_message "ERROR: $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    log_message "INFO: $1"
}

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$ROLLBACK_LOG"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get current version
get_current_version() {
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        node -p "require('$PROJECT_ROOT/package.json').version" 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

# Function to get current Git tag/commit
get_current_git_version() {
    cd "$PROJECT_ROOT"
    git describe --tags --exact-match HEAD 2>/dev/null || git rev-parse --short HEAD
}

# Function to validate target version
validate_target_version() {
    local version="$1"
    
    cd "$PROJECT_ROOT"
    
    # Check if it's a git tag
    if git tag -l | grep -q "^$version$"; then
        return 0
    fi
    
    # Check if it's a commit hash
    if git cat-file -e "$version^{commit}" 2>/dev/null; then
        return 0
    fi
    
    # Check if it's a branch
    if git show-ref --verify --quiet "refs/heads/$version"; then
        return 0
    fi
    
    return 1
}

# Function to create backup before rollback
create_backup() {
    print_info "Creating backup before rollback..."
    
    local backup_timestamp
    backup_timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="rollback_backup_${backup_timestamp}"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$backup_path"
    
    # Backup current code
    print_info "Backing up current codebase..."
    tar -czf "$backup_path/codebase.tar.gz" \
        --exclude=".git" \
        --exclude="node_modules" \
        --exclude="backups" \
        --exclude="logs" \
        -C "$PROJECT_ROOT" .
    
    # Backup database if possible
    if [[ -n "${DATABASE_URL:-}" ]] && command_exists pg_dump; then
        print_info "Backing up database..."
        pg_dump "$DATABASE_URL" > "$backup_path/database.sql" 2>/dev/null || {
            print_warning "Failed to backup database - continuing without DB backup"
        }
    fi
    
    # Backup Docker volumes if using Docker
    if command_exists docker && docker-compose ps -q >/dev/null 2>&1; then
        print_info "Backing up Docker volumes..."
        
        # Get list of volumes
        local volumes
        volumes=$(docker-compose config --volumes 2>/dev/null || echo "")
        
        if [[ -n "$volumes" ]]; then
            mkdir -p "$backup_path/volumes"
            
            for volume in $volumes; do
                docker run --rm \
                    -v "$volume:/source:ro" \
                    -v "$backup_path/volumes:/backup" \
                    alpine tar -czf "/backup/${volume}.tar.gz" -C /source . 2>/dev/null || {
                    print_warning "Failed to backup volume: $volume"
                }
            done
        fi
    fi
    
    # Save current environment
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        cp "$PROJECT_ROOT/.env" "$backup_path/env.backup"
    fi
    
    # Save version information
    echo "CURRENT_VERSION=$CURRENT_VERSION" > "$backup_path/version_info.txt"
    echo "CURRENT_GIT_VERSION=$(get_current_git_version)" >> "$backup_path/version_info.txt"
    echo "ROLLBACK_TARGET=$TARGET_VERSION" >> "$backup_path/version_info.txt"
    echo "ROLLBACK_TIMESTAMP=$backup_timestamp" >> "$backup_path/version_info.txt"
    
    print_status "Backup created: $backup_path"
    echo "$backup_path" > "$PROJECT_ROOT/.last_backup"
}

# Function to stop services gracefully
stop_services() {
    print_info "Stopping services..."
    
    # Stop Docker services if running
    if command_exists docker-compose && docker-compose ps -q >/dev/null 2>&1; then
        print_info "Stopping Docker services..."
        docker-compose down --timeout 30 || {
            print_warning "Graceful shutdown failed, forcing stop..."
            docker-compose kill
            docker-compose down
        }
    fi
    
    # Stop systemd service if exists
    if systemctl is-active --quiet mcp-memory 2>/dev/null; then
        print_info "Stopping systemd service..."
        sudo systemctl stop mcp-memory || print_warning "Failed to stop systemd service"
    fi
    
    # Kill any remaining Node.js processes related to the project
    local node_pids
    node_pids=$(pgrep -f "node.*mcp-memory" || echo "")
    if [[ -n "$node_pids" ]]; then
        print_info "Stopping remaining Node.js processes..."
        echo "$node_pids" | xargs kill -TERM 2>/dev/null || true
        sleep 5
        echo "$node_pids" | xargs kill -KILL 2>/dev/null || true
    fi
    
    print_status "Services stopped"
}

# Function to rollback code
rollback_code() {
    print_info "Rolling back code to version: $TARGET_VERSION"
    
    cd "$PROJECT_ROOT"
    
    # Stash any uncommitted changes
    if [[ -n "$(git status --porcelain)" ]]; then
        print_info "Stashing uncommitted changes..."
        git stash push -m "Pre-rollback stash $(date)"
    fi
    
    # Checkout target version
    if ! git checkout "$TARGET_VERSION" 2>/dev/null; then
        print_error "Failed to checkout version: $TARGET_VERSION"
        return 1
    fi
    
    # Reset to clean state
    git reset --hard HEAD
    git clean -fd
    
    print_status "Code rolled back to: $(git describe --always)"
}

# Function to restore dependencies
restore_dependencies() {
    print_info "Restoring dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Remove existing node_modules to ensure clean install
    rm -rf node_modules package-lock.json
    
    # Install dependencies
    if npm install; then
        print_status "Dependencies restored"
    else
        print_error "Failed to restore dependencies"
        return 1
    fi
}

# Function to restore database from backup
restore_database() {
    local backup_path="$1"
    
    if [[ ! -f "$backup_path/database.sql" ]]; then
        print_info "No database backup found, skipping database restore"
        return 0
    fi
    
    if [[ -z "${DATABASE_URL:-}" ]]; then
        print_warning "DATABASE_URL not set, cannot restore database"
        return 1
    fi
    
    if ! command_exists psql; then
        print_warning "psql not available, cannot restore database"
        return 1
    fi
    
    print_warning "Database restore will overwrite current data!"
    if [[ "$FORCE_ROLLBACK" != "true" ]]; then
        read -p "Continue with database restore? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping database restore"
            return 0
        fi
    fi
    
    print_info "Restoring database from backup..."
    
    # Drop and recreate database (be very careful here)
    local db_name
    db_name=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    if [[ -n "$db_name" ]]; then
        # Connect to postgres database to recreate the target database
        local postgres_url
        postgres_url=$(echo "$DATABASE_URL" | sed "s/$db_name/postgres/")
        
        psql "$postgres_url" -c "DROP DATABASE IF EXISTS $db_name;" 2>/dev/null || true
        psql "$postgres_url" -c "CREATE DATABASE $db_name;" 2>/dev/null || {
            print_error "Failed to recreate database"
            return 1
        }
    fi
    
    # Restore from backup
    if psql "$DATABASE_URL" < "$backup_path/database.sql" >/dev/null 2>&1; then
        print_status "Database restored from backup"
    else
        print_error "Failed to restore database"
        return 1
    fi
}

# Function to start services
start_services() {
    print_info "Starting services..."
    
    cd "$PROJECT_ROOT"
    
    # Start Docker services if docker-compose.yml exists
    if [[ -f "docker-compose.yml" ]] && command_exists docker-compose; then
        print_info "Starting Docker services..."
        
        # Pull images for the target version
        docker-compose pull 2>/dev/null || print_warning "Failed to pull images"
        
        # Start services
        if docker-compose up -d; then
            print_status "Docker services started"
            
            # Wait for services to be ready
            print_info "Waiting for services to be ready..."
            sleep 10
            
            # Check health
            if ./scripts/health-check.sh >/dev/null 2>&1; then
                print_status "Health check passed"
            else
                print_warning "Health check failed - services may still be starting"
            fi
        else
            print_error "Failed to start Docker services"
            return 1
        fi
    fi
    
    # Start systemd service if exists
    if systemctl list-unit-files | grep -q mcp-memory; then
        print_info "Starting systemd service..."
        sudo systemctl start mcp-memory || print_warning "Failed to start systemd service"
    fi
    
    print_status "Services started"
}

# Function to verify rollback
verify_rollback() {
    print_info "Verifying rollback..."
    
    # Check version
    local new_version
    new_version=$(get_current_version)
    print_info "Current version: $new_version"
    
    # Check Git version
    local git_version
    git_version=$(get_current_git_version)
    print_info "Current Git version: $git_version"
    
    # Run health check
    if ./scripts/health-check.sh --json > /tmp/health-check.json 2>&1; then
        local overall_status
        overall_status=$(jq -r '.overall_status' /tmp/health-check.json 2>/dev/null || echo "UNKNOWN")
        
        if [[ "$overall_status" == "HEALTHY" ]]; then
            print_status "Health check passed"
        else
            print_warning "Health check shows warnings: $overall_status"
        fi
    else
        print_warning "Health check failed or not available"
    fi
    
    # Test API endpoint if available
    if command_exists curl; then
        local api_url="http://localhost:3333/health"
        if curl -s "$api_url" >/dev/null 2>&1; then
            print_status "API endpoint responding"
        else
            print_warning "API endpoint not responding at $api_url"
        fi
    fi
    
    print_status "Rollback verification completed"
}

# Function to cleanup after rollback
cleanup_rollback() {
    print_info "Cleaning up after rollback..."
    
    # Remove temporary files
    rm -f /tmp/health-check.json
    
    # Log rollback completion
    log_message "Rollback completed successfully to version: $TARGET_VERSION"
    
    print_status "Cleanup completed"
}

# Function to show rollback summary
show_summary() {
    echo ""
    echo "Rollback Summary:"
    echo "=================="
    echo "Target version:     $TARGET_VERSION"
    echo "Previous version:   $CURRENT_VERSION"
    echo "Rollback time:      $(date)"
    
    if [[ -f "$PROJECT_ROOT/.last_backup" ]]; then
        local backup_path
        backup_path=$(cat "$PROJECT_ROOT/.last_backup")
        echo "Backup location:    $backup_path"
    fi
    
    echo ""
    echo "Next steps:"
    echo "1. Verify application functionality"
    echo "2. Check logs for any issues"
    echo "3. Update monitoring and alerting if needed"
    echo "4. Communicate rollback to team"
    
    if [[ "$CREATE_BACKUP" == "true" ]]; then
        echo "5. Clean up backup when confident rollback was successful"
    fi
    
    echo ""
    print_status "Rollback completed successfully!"
}

# Main rollback function
perform_rollback() {
    print_info "Starting rollback to version: $TARGET_VERSION"
    print_info "Current version: $CURRENT_VERSION"
    
    # Confirmation
    if [[ "$FORCE_ROLLBACK" != "true" ]]; then
        echo ""
        print_warning "This will rollback MCP Memory Stack to version: $TARGET_VERSION"
        print_warning "Current version: $CURRENT_VERSION"
        
        if [[ "$CREATE_BACKUP" == "true" ]]; then
            print_info "A backup will be created before rollback"
        else
            print_warning "No backup will be created"
        fi
        
        echo ""
        read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Rollback cancelled"
            exit 0
        fi
    fi
    
    # Create backup if requested
    if [[ "$CREATE_BACKUP" == "true" ]]; then
        create_backup
    fi
    
    # Perform rollback steps
    stop_services
    rollback_code
    restore_dependencies
    
    # Restore database if backup exists and user confirms
    if [[ "$CREATE_BACKUP" == "true" && -f "$PROJECT_ROOT/.last_backup" ]]; then
        local backup_path
        backup_path=$(cat "$PROJECT_ROOT/.last_backup")
        restore_database "$backup_path"
    fi
    
    start_services
    verify_rollback
    cleanup_rollback
    show_summary
}

# Main function
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force|-f)
                FORCE_ROLLBACK="true"
                shift
                ;;
            --backup|-b)
                CREATE_BACKUP="true"
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [version] [options]"
                echo ""
                echo "Arguments:"
                echo "  version     Target version to rollback to (git tag, commit, or branch)"
                echo ""
                echo "Options:"
                echo "  --force, -f     Skip confirmation prompts"
                echo "  --backup, -b    Create backup before rollback"
                echo "  --help, -h      Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0 v2.0.1              # Rollback to tag v2.0.1"
                echo "  $0 abc123f             # Rollback to commit abc123f"
                echo "  $0 v2.0.1 --backup    # Rollback with backup"
                echo "  $0 v2.0.1 --force     # Rollback without confirmation"
                echo ""
                echo "IMPORTANT:"
                echo "  - Always test rollback procedures in staging first"
                echo "  - Consider creating a backup (--backup) for production rollbacks"
                echo "  - Ensure target version is compatible with current data"
                exit 0
                ;;
            *)
                if [[ -z "$TARGET_VERSION" ]]; then
                    TARGET_VERSION="$1"
                else
                    print_error "Unknown argument: $1"
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Validate requirements
    if [[ -z "$TARGET_VERSION" ]]; then
        print_error "Target version is required"
        print_error "Usage: $0 [version] [options]"
        exit 1
    fi
    
    # Get current version
    CURRENT_VERSION=$(get_current_version)
    
    # Validate target version
    if ! validate_target_version "$TARGET_VERSION"; then
        print_error "Invalid target version: $TARGET_VERSION"
        print_error "Version must be a valid git tag, commit hash, or branch"
        exit 1
    fi
    
    # Check if we're in project directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        print_error "Not in MCP Memory Stack project directory"
        exit 1
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Initialize log
    log_message "Starting rollback from $CURRENT_VERSION to $TARGET_VERSION"
    
    # Perform rollback
    perform_rollback
}

# Run main function with all arguments
main "$@"