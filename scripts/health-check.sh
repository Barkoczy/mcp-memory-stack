#!/bin/bash

# health-check.sh - Comprehensive health check script
# Usage: ./scripts/health-check.sh [environment] [--verbose] [--json]

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

# Default configuration
ENVIRONMENT="development"
VERBOSE="false"
JSON_OUTPUT="false"
TIMEOUT=30

# Health check results
declare -A HEALTH_RESULTS
OVERALL_STATUS="HEALTHY"

# Function to print colored output
print_status() {
    if [[ "$JSON_OUTPUT" != "true" ]]; then
        echo -e "${GREEN}[PASS]${NC} $1"
    fi
}

print_warning() {
    if [[ "$JSON_OUTPUT" != "true" ]]; then
        echo -e "${YELLOW}[WARN]${NC} $1"
    fi
}

print_error() {
    if [[ "$JSON_OUTPUT" != "true" ]]; then
        echo -e "${RED}[FAIL]${NC} $1"
    fi
    OVERALL_STATUS="UNHEALTHY"
}

print_info() {
    if [[ "$JSON_OUTPUT" != "true" && "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to make HTTP request with timeout
http_check() {
    local url="$1"
    local expected_status="${2:-200}"
    local timeout="${3:-$TIMEOUT}"
    
    if command_exists curl; then
        local response
        response=$(curl -s -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")
        local http_code="${response: -3}"
        local body="${response%???}"
        
        if [[ "$http_code" == "$expected_status" ]]; then
            return 0
        else
            if [[ "$VERBOSE" == "true" ]]; then
                print_info "HTTP $http_code for $url (expected $expected_status)"
                print_info "Response: $body"
            fi
            return 1
        fi
    else
        print_warning "curl not available for HTTP checks"
        return 1
    fi
}

# Function to check TCP connection
tcp_check() {
    local host="$1"
    local port="$2"
    local timeout="${3:-5}"
    
    if command_exists nc; then
        nc -z -w "$timeout" "$host" "$port" 2>/dev/null
    elif command_exists telnet; then
        timeout "$timeout" bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null
    else
        print_warning "Neither nc nor telnet available for TCP checks"
        return 1
    fi
}

# Function to check Docker service
check_docker_service() {
    local service_name="$1"
    
    print_info "Checking Docker service: $service_name"
    
    if ! command_exists docker; then
        HEALTH_RESULTS["docker_$service_name"]="FAIL - Docker not available"
        print_error "Docker not installed or not in PATH"
        return 1
    fi
    
    # Check if service is running
    local container_id
    container_id=$(docker-compose ps -q "$service_name" 2>/dev/null || echo "")
    
    if [[ -z "$container_id" ]]; then
        HEALTH_RESULTS["docker_$service_name"]="FAIL - Container not found"
        print_error "Docker service $service_name not found"
        return 1
    fi
    
    # Check container status
    local status
    status=$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || echo "unknown")
    
    if [[ "$status" == "running" ]]; then
        HEALTH_RESULTS["docker_$service_name"]="PASS"
        print_status "Docker service $service_name is running"
        
        # Check container health if healthcheck is defined
        local health_status
        health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "none")
        
        if [[ "$health_status" != "none" ]]; then
            if [[ "$health_status" == "healthy" ]]; then
                print_status "Docker service $service_name health check: $health_status"
            else
                HEALTH_RESULTS["docker_${service_name}_health"]="WARN - Health: $health_status"
                print_warning "Docker service $service_name health check: $health_status"
            fi
        fi
        
        return 0
    else
        HEALTH_RESULTS["docker_$service_name"]="FAIL - Status: $status"
        print_error "Docker service $service_name status: $status"
        return 1
    fi
}

# Function to check API endpoints
check_api_endpoints() {
    local base_url="$1"
    
    print_info "Checking API endpoints at $base_url"
    
    # Health endpoint
    if http_check "$base_url/health" 200; then
        HEALTH_RESULTS["api_health"]="PASS"
        print_status "Health endpoint accessible"
    else
        HEALTH_RESULTS["api_health"]="FAIL"
        print_error "Health endpoint not accessible"
    fi
    
    # API root
    if http_check "$base_url/api/" 200; then
        HEALTH_RESULTS["api_root"]="PASS"
        print_status "API root accessible"
    else
        HEALTH_RESULTS["api_root"]="FAIL"
        print_error "API root not accessible"
    fi
    
    # Memory endpoints (these might require authentication)
    if http_check "$base_url/api/memories" 200; then
        HEALTH_RESULTS["api_memories"]="PASS"
        print_status "Memories endpoint accessible"
    elif http_check "$base_url/api/memories" 401; then
        HEALTH_RESULTS["api_memories"]="PASS - Auth required"
        print_status "Memories endpoint accessible (authentication required)"
    else
        HEALTH_RESULTS["api_memories"]="WARN"
        print_warning "Memories endpoint not accessible"
    fi
}

# Function to check database connectivity
check_database() {
    local db_url="${DATABASE_URL:-}"
    
    print_info "Checking database connectivity"
    
    if [[ -z "$db_url" ]]; then
        HEALTH_RESULTS["database"]="SKIP - No DATABASE_URL configured"
        print_warning "DATABASE_URL not configured, skipping database check"
        return 0
    fi
    
    # Extract host and port from DATABASE_URL
    local db_host
    local db_port
    
    if [[ "$db_url" =~ postgresql://[^@]+@([^:/]+):([0-9]+) ]]; then
        db_host="${BASH_REMATCH[1]}"
        db_port="${BASH_REMATCH[2]}"
    elif [[ "$db_url" =~ postgresql://[^@]+@([^:/]+) ]]; then
        db_host="${BASH_REMATCH[1]}"
        db_port="5432"
    else
        HEALTH_RESULTS["database"]="FAIL - Invalid DATABASE_URL format"
        print_error "Cannot parse DATABASE_URL"
        return 1
    fi
    
    # Check TCP connectivity
    if tcp_check "$db_host" "$db_port"; then
        HEALTH_RESULTS["database_tcp"]="PASS"
        print_status "Database TCP connection successful ($db_host:$db_port)"
    else
        HEALTH_RESULTS["database_tcp"]="FAIL"
        print_error "Database TCP connection failed ($db_host:$db_port)"
        return 1
    fi
    
    # Try to connect with psql if available
    if command_exists psql; then
        if psql "$db_url" -c "SELECT 1;" >/dev/null 2>&1; then
            HEALTH_RESULTS["database_query"]="PASS"
            print_status "Database query test successful"
        else
            HEALTH_RESULTS["database_query"]="FAIL"
            print_error "Database query test failed"
        fi
    else
        HEALTH_RESULTS["database_query"]="SKIP - psql not available"
        print_info "psql not available for database query test"
    fi
}

# Function to check SSL/TLS certificates
check_ssl_certificates() {
    local domain="${1:-localhost}"
    local port="${2:-443}"
    
    print_info "Checking SSL certificate for $domain:$port"
    
    if ! command_exists openssl; then
        HEALTH_RESULTS["ssl_cert"]="SKIP - openssl not available"
        print_warning "openssl not available for SSL certificate check"
        return 0
    fi
    
    # Check if SSL endpoint is accessible
    if ! tcp_check "$domain" "$port"; then
        HEALTH_RESULTS["ssl_cert"]="SKIP - Port $port not accessible"
        print_info "SSL port $port not accessible on $domain"
        return 0
    fi
    
    # Get certificate information
    local cert_info
    cert_info=$(openssl s_client -connect "$domain:$port" -servername "$domain" </dev/null 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
    
    if [[ -z "$cert_info" ]]; then
        HEALTH_RESULTS["ssl_cert"]="FAIL - Cannot retrieve certificate"
        print_error "Cannot retrieve SSL certificate for $domain:$port"
        return 1
    fi
    
    # Check certificate expiration
    local not_after
    not_after=$(echo "$cert_info" | grep notAfter | cut -d= -f2)
    
    if [[ -n "$not_after" ]]; then
        local expiry_timestamp
        local current_timestamp
        local days_remaining
        
        expiry_timestamp=$(date -d "$not_after" +%s 2>/dev/null || echo "0")
        current_timestamp=$(date +%s)
        days_remaining=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [[ "$days_remaining" -gt 30 ]]; then
            HEALTH_RESULTS["ssl_cert"]="PASS - Expires in $days_remaining days"
            print_status "SSL certificate valid (expires in $days_remaining days)"
        elif [[ "$days_remaining" -gt 0 ]]; then
            HEALTH_RESULTS["ssl_cert"]="WARN - Expires in $days_remaining days"
            print_warning "SSL certificate expires soon ($days_remaining days)"
        else
            HEALTH_RESULTS["ssl_cert"]="FAIL - Certificate expired"
            print_error "SSL certificate has expired"
        fi
    else
        HEALTH_RESULTS["ssl_cert"]="WARN - Cannot parse expiration"
        print_warning "Cannot parse SSL certificate expiration"
    fi
}

# Function to check system resources
check_system_resources() {
    print_info "Checking system resources"
    
    # Check disk space
    local disk_usage
    disk_usage=$(df "$PROJECT_ROOT" | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [[ "$disk_usage" -lt 80 ]]; then
        HEALTH_RESULTS["disk_space"]="PASS - ${disk_usage}% used"
        print_status "Disk space: ${disk_usage}% used"
    elif [[ "$disk_usage" -lt 90 ]]; then
        HEALTH_RESULTS["disk_space"]="WARN - ${disk_usage}% used"
        print_warning "Disk space: ${disk_usage}% used"
    else
        HEALTH_RESULTS["disk_space"]="FAIL - ${disk_usage}% used"
        print_error "Disk space critical: ${disk_usage}% used"
    fi
    
    # Check memory usage
    if command_exists free; then
        local memory_usage
        memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        
        if [[ "$memory_usage" -lt 80 ]]; then
            HEALTH_RESULTS["memory_usage"]="PASS - ${memory_usage}% used"
            print_status "Memory usage: ${memory_usage}% used"
        elif [[ "$memory_usage" -lt 90 ]]; then
            HEALTH_RESULTS["memory_usage"]="WARN - ${memory_usage}% used"
            print_warning "Memory usage: ${memory_usage}% used"
        else
            HEALTH_RESULTS["memory_usage"]="FAIL - ${memory_usage}% used"
            print_error "Memory usage critical: ${memory_usage}% used"
        fi
    else
        HEALTH_RESULTS["memory_usage"]="SKIP - free command not available"
    fi
    
    # Check load average
    if [[ -f /proc/loadavg ]]; then
        local load_avg
        load_avg=$(cut -d' ' -f1 /proc/loadavg)
        local cpu_count
        cpu_count=$(nproc 2>/dev/null || echo "1")
        local load_percentage
        load_percentage=$(echo "$load_avg $cpu_count" | awk '{printf "%.0f", $1/$2 * 100}')
        
        if [[ "$load_percentage" -lt 70 ]]; then
            HEALTH_RESULTS["load_average"]="PASS - Load: $load_avg"
            print_status "Load average: $load_avg (${load_percentage}% of CPU capacity)"
        elif [[ "$load_percentage" -lt 100 ]]; then
            HEALTH_RESULTS["load_average"]="WARN - Load: $load_avg"
            print_warning "Load average: $load_avg (${load_percentage}% of CPU capacity)"
        else
            HEALTH_RESULTS["load_average"]="FAIL - Load: $load_avg"
            print_error "Load average high: $load_avg (${load_percentage}% of CPU capacity)"
        fi
    else
        HEALTH_RESULTS["load_average"]="SKIP - /proc/loadavg not available"
    fi
}

# Function to check log files for errors
check_logs() {
    print_info "Checking recent log entries"
    
    local log_files=(
        "/var/log/mcp-memory.log"
        "$PROJECT_ROOT/logs/app.log"
        "$PROJECT_ROOT/logs/error.log"
    )
    
    local error_count=0
    
    for log_file in "${log_files[@]}"; do
        if [[ -f "$log_file" ]]; then
            # Check for errors in the last 1000 lines
            local recent_errors
            recent_errors=$(tail -1000 "$log_file" | grep -i "error\|fatal\|critical" | wc -l)
            
            if [[ "$recent_errors" -eq 0 ]]; then
                print_status "No recent errors in $log_file"
            elif [[ "$recent_errors" -lt 5 ]]; then
                print_warning "$recent_errors recent errors in $log_file"
                error_count=$((error_count + recent_errors))
            else
                print_error "$recent_errors recent errors in $log_file"
                error_count=$((error_count + recent_errors))
            fi
        fi
    done
    
    if [[ "$error_count" -eq 0 ]]; then
        HEALTH_RESULTS["log_errors"]="PASS - No recent errors"
    elif [[ "$error_count" -lt 10 ]]; then
        HEALTH_RESULTS["log_errors"]="WARN - $error_count recent errors"
    else
        HEALTH_RESULTS["log_errors"]="FAIL - $error_count recent errors"
    fi
}

# Function to output JSON results
output_json() {
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    echo "{"
    echo "  \"timestamp\": \"$timestamp\","
    echo "  \"environment\": \"$ENVIRONMENT\","
    echo "  \"overall_status\": \"$OVERALL_STATUS\","
    echo "  \"checks\": {"
    
    local first=true
    for check in "${!HEALTH_RESULTS[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            echo ","
        fi
        
        local status="${HEALTH_RESULTS[$check]}"
        local result_status="UNKNOWN"
        local result_message="$status"
        
        if [[ "$status" =~ ^PASS ]]; then
            result_status="PASS"
        elif [[ "$status" =~ ^WARN ]]; then
            result_status="WARN"
        elif [[ "$status" =~ ^FAIL ]]; then
            result_status="FAIL"
        elif [[ "$status" =~ ^SKIP ]]; then
            result_status="SKIP"
        fi
        
        echo -n "    \"$check\": { \"status\": \"$result_status\", \"message\": \"$result_message\" }"
    done
    
    echo ""
    echo "  }"
    echo "}"
}

# Function to load environment configuration
load_environment_config() {
    local env="$1"
    
    case "$env" in
        development|dev)
            ENVIRONMENT="development"
            API_BASE_URL="http://localhost:3333"
            DB_HOST="localhost"
            DB_PORT="5432"
            SSL_DOMAIN=""
            ;;
        staging)
            ENVIRONMENT="staging"
            API_BASE_URL="https://staging.yourdomain.com"
            DB_HOST="staging-db.yourdomain.com"
            DB_PORT="5432"
            SSL_DOMAIN="staging.yourdomain.com"
            ;;
        production|prod)
            ENVIRONMENT="production"
            API_BASE_URL="https://yourdomain.com"
            DB_HOST="db.yourdomain.com"
            DB_PORT="5432"
            SSL_DOMAIN="yourdomain.com"
            ;;
        *)
            print_error "Unknown environment: $env"
            print_error "Supported environments: development, staging, production"
            exit 1
            ;;
    esac
}

# Main health check function
run_health_checks() {
    if [[ "$JSON_OUTPUT" != "true" ]]; then
        echo "MCP Memory Stack Health Check"
        echo "Environment: $ENVIRONMENT"
        echo "Timestamp: $(date)"
        echo "=============================="
        echo ""
    fi
    
    # System checks
    check_system_resources
    
    # Docker service checks
    if [[ "$ENVIRONMENT" != "production" ]] || command_exists docker-compose; then
        check_docker_service "mcp-memory"
        check_docker_service "postgres"
        check_docker_service "redis"
    fi
    
    # Database connectivity
    check_database
    
    # API endpoint checks
    check_api_endpoints "$API_BASE_URL"
    
    # SSL certificate checks
    if [[ -n "$SSL_DOMAIN" ]]; then
        check_ssl_certificates "$SSL_DOMAIN"
    fi
    
    # Log file checks
    check_logs
    
    # Output results
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        output_json
    else
        echo ""
        echo "Health Check Summary:"
        echo "===================="
        
        local pass_count=0
        local warn_count=0
        local fail_count=0
        local skip_count=0
        
        for result in "${HEALTH_RESULTS[@]}"; do
            if [[ "$result" =~ ^PASS ]]; then
                ((pass_count++))
            elif [[ "$result" =~ ^WARN ]]; then
                ((warn_count++))
            elif [[ "$result" =~ ^FAIL ]]; then
                ((fail_count++))
            elif [[ "$result" =~ ^SKIP ]]; then
                ((skip_count++))
            fi
        done
        
        echo "Checks: ${#HEALTH_RESULTS[@]} total"
        echo "Results: $pass_count passed, $warn_count warnings, $fail_count failed, $skip_count skipped"
        echo "Overall Status: $OVERALL_STATUS"
        
        if [[ "$OVERALL_STATUS" == "UNHEALTHY" ]]; then
            exit 1
        elif [[ "$warn_count" -gt 0 ]]; then
            exit 2  # Exit code 2 for warnings
        else
            exit 0
        fi
    fi
}

# Main function
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            development|dev|staging|production|prod)
                ENVIRONMENT="$1"
                shift
                ;;
            --verbose|-v)
                VERBOSE="true"
                shift
                ;;
            --json|-j)
                JSON_OUTPUT="true"
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            -h|--help)
                echo "Usage: $0 [environment] [options]"
                echo ""
                echo "Environments:"
                echo "  development, dev      Local development environment"
                echo "  staging              Staging environment"
                echo "  production, prod     Production environment"
                echo ""
                echo "Options:"
                echo "  --verbose, -v        Verbose output"
                echo "  --json, -j          JSON output format"
                echo "  --timeout SECONDS   HTTP request timeout (default: 30)"
                echo "  --help, -h          Show this help message"
                echo ""
                echo "Exit codes:"
                echo "  0  All checks passed"
                echo "  1  One or more checks failed"
                echo "  2  Warnings present but no failures"
                exit 0
                ;;
            *)
                print_error "Unknown argument: $1"
                exit 1
                ;;
        esac
    done
    
    # Load environment configuration
    load_environment_config "$ENVIRONMENT"
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Load environment variables if .env file exists
    if [[ -f ".env" ]]; then
        set -a
        source .env
        set +a
    fi
    
    # Run health checks
    run_health_checks
}

# Run main function with all arguments
main "$@"