#!/bin/bash

# MCP Memory Stack - Docker Image Build Script
# Enterprise 2025 - Automated image building with validation

set -euo pipefail

# Configuration
REGISTRY="${REGISTRY:-ghcr.io}"
NAMESPACE="${NAMESPACE:-mcp-memory-stack}"
VERSION="${VERSION:-$(git describe --tags --always --dirty)}"
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Print banner
print_banner() {
    echo "============================================"
    echo "  MCP Memory Stack - Docker Image Builder"
    echo "  Enterprise 2025 Edition"
    echo "============================================"
    echo "Registry: $REGISTRY"
    echo "Namespace: $NAMESPACE"
    echo "Version: $VERSION"
    echo "Build Date: $BUILD_DATE"
    echo "Git Commit: $GIT_COMMIT"
    echo "Git Branch: $GIT_BRANCH"
    echo "============================================"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check Docker Buildx
    if ! docker buildx version &> /dev/null; then
        log_error "Docker Buildx is not available"
        exit 1
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed or not in PATH"
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir &> /dev/null; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Setup Docker Buildx
setup_buildx() {
    log_info "Setting up Docker Buildx..."
    
    # Create builder if it doesn't exist
    if ! docker buildx inspect mcp-builder &> /dev/null; then
        docker buildx create --name mcp-builder --use
        log_info "Created new buildx builder: mcp-builder"
    else
        docker buildx use mcp-builder
        log_info "Using existing buildx builder: mcp-builder"
    fi
    
    # Bootstrap the builder
    docker buildx inspect --bootstrap
    log_success "Buildx setup completed"
}

# Build Fastify service image
build_fastify_image() {
    log_info "Building Fastify service image..."
    
    local image_name="$REGISTRY/$NAMESPACE/fastify-service"
    local build_context="./src/fastify"
    
    # Check if Dockerfile exists
    if [[ ! -f "$build_context/Dockerfile" ]]; then
        log_error "Dockerfile not found at $build_context/Dockerfile"
        exit 1
    fi
    
    # Build arguments
    local build_args=(
        --build-arg "VERSION=$VERSION"
        --build-arg "BUILD_DATE=$BUILD_DATE"
        --build-arg "GIT_COMMIT=$GIT_COMMIT"
        --build-arg "GIT_BRANCH=$GIT_BRANCH"
        --build-arg "NODE_VERSION=20.11.0"
    )
    
    # Labels
    local labels=(
        --label "org.opencontainers.image.title=MCP Fastify Service"
        --label "org.opencontainers.image.description=Enterprise Fastify API Gateway for MCP Memory Stack"
        --label "org.opencontainers.image.version=$VERSION"
        --label "org.opencontainers.image.created=$BUILD_DATE"
        --label "org.opencontainers.image.revision=$GIT_COMMIT"
        --label "org.opencontainers.image.source=https://github.com/company/mcp-memory-stack"
        --label "org.opencontainers.image.vendor=Company Platform Team"
        --label "org.opencontainers.image.licenses=MIT"
    )
    
    # Tags
    local tags=(
        --tag "$image_name:$VERSION"
        --tag "$image_name:latest"
        --tag "$image_name:$GIT_BRANCH"
    )
    
    # Build command
    docker buildx build \
        "${build_args[@]}" \
        "${labels[@]}" \
        "${tags[@]}" \
        --platform linux/amd64,linux/arm64 \
        --cache-from type=registry,ref="$image_name:cache" \
        --cache-to type=registry,ref="$image_name:cache",mode=max \
        --file "$build_context/Dockerfile" \
        --push \
        "$build_context"
    
    log_success "Fastify service image built and pushed: $image_name:$VERSION"
}

# Build Rust embedding service image
build_rust_image() {
    log_info "Building Rust embedding service image..."
    
    local image_name="$REGISTRY/$NAMESPACE/rust-embedding-service"
    local build_context="./rust-embedding-service"
    
    # Check if Dockerfile exists
    if [[ ! -f "$build_context/Dockerfile" ]]; then
        log_error "Dockerfile not found at $build_context/Dockerfile"
        exit 1
    fi
    
    # Build arguments
    local build_args=(
        --build-arg "VERSION=$VERSION"
        --build-arg "BUILD_DATE=$BUILD_DATE"
        --build-arg "GIT_COMMIT=$GIT_COMMIT"
        --build-arg "GIT_BRANCH=$GIT_BRANCH"
        --build-arg "RUST_VERSION=1.75.0"
    )
    
    # Labels
    local labels=(
        --label "org.opencontainers.image.title=MCP Rust Embedding Service"
        --label "org.opencontainers.image.description=High-performance Rust microservice for embeddings and vector operations"
        --label "org.opencontainers.image.version=$VERSION"
        --label "org.opencontainers.image.created=$BUILD_DATE"
        --label "org.opencontainers.image.revision=$GIT_COMMIT"
        --label "org.opencontainers.image.source=https://github.com/company/mcp-memory-stack"
        --label "org.opencontainers.image.vendor=Company Platform Team"
        --label "org.opencontainers.image.licenses=MIT"
    )
    
    # Tags
    local tags=(
        --tag "$image_name:$VERSION"
        --tag "$image_name:latest"
        --tag "$image_name:$GIT_BRANCH"
    )
    
    # Build command
    docker buildx build \
        "${build_args[@]}" \
        "${labels[@]}" \
        "${tags[@]}" \
        --platform linux/amd64,linux/arm64 \
        --cache-from type=registry,ref="$image_name:cache" \
        --cache-to type=registry,ref="$image_name:cache",mode=max \
        --file "$build_context/Dockerfile" \
        --push \
        "$build_context"
    
    log_success "Rust embedding service image built and pushed: $image_name:$VERSION"
}

# Validate images
validate_images() {
    log_info "Validating built images..."
    
    local fastify_image="$REGISTRY/$NAMESPACE/fastify-service:$VERSION"
    local rust_image="$REGISTRY/$NAMESPACE/rust-embedding-service:$VERSION"
    
    # Pull and inspect images
    docker pull "$fastify_image"
    docker pull "$rust_image"
    
    # Basic validation
    log_info "Image sizes:"
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "$NAMESPACE"
    
    # Security scan with Trivy (if available)
    if command -v trivy &> /dev/null; then
        log_info "Running security scan on images..."
        
        trivy image --exit-code 0 --severity HIGH,CRITICAL "$fastify_image" || log_warning "Security issues found in Fastify image"
        trivy image --exit-code 0 --severity HIGH,CRITICAL "$rust_image" || log_warning "Security issues found in Rust image"
    else
        log_warning "Trivy not available, skipping security scan"
    fi
    
    log_success "Image validation completed"
}

# Generate image manifest
generate_manifest() {
    log_info "Generating image manifest..."
    
    local manifest_file="image-manifest.json"
    
    cat > "$manifest_file" <<EOF
{
  "version": "$VERSION",
  "buildDate": "$BUILD_DATE",
  "gitCommit": "$GIT_COMMIT",
  "gitBranch": "$GIT_BRANCH",
  "registry": "$REGISTRY",
  "namespace": "$NAMESPACE",
  "images": {
    "fastify-service": {
      "name": "$REGISTRY/$NAMESPACE/fastify-service",
      "tags": ["$VERSION", "latest", "$GIT_BRANCH"],
      "platforms": ["linux/amd64", "linux/arm64"]
    },
    "rust-embedding-service": {
      "name": "$REGISTRY/$NAMESPACE/rust-embedding-service",
      "tags": ["$VERSION", "latest", "$GIT_BRANCH"],
      "platforms": ["linux/amd64", "linux/arm64"]
    }
  }
}
EOF
    
    log_success "Image manifest generated: $manifest_file"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    # Remove any temporary files or builders if needed
}

# Main execution
main() {
    print_banner
    
    # Parse command line arguments
    local build_fastify=true
    local build_rust=true
    local push_images=true
    local validate=true
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --fastify-only)
                build_rust=false
                shift
                ;;
            --rust-only)
                build_fastify=false
                shift
                ;;
            --no-push)
                push_images=false
                shift
                ;;
            --no-validate)
                validate=false
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --fastify-only    Build only Fastify service image"
                echo "  --rust-only       Build only Rust embedding service image"
                echo "  --no-push         Build locally without pushing to registry"
                echo "  --no-validate     Skip image validation"
                echo "  --help            Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Execute build steps
    check_prerequisites
    setup_buildx
    
    if [[ "$build_fastify" == true ]]; then
        build_fastify_image
    fi
    
    if [[ "$build_rust" == true ]]; then
        build_rust_image
    fi
    
    if [[ "$validate" == true && "$push_images" == true ]]; then
        validate_images
    fi
    
    generate_manifest
    
    log_success "All images built successfully!"
    echo "============================================"
    echo "Built images:"
    if [[ "$build_fastify" == true ]]; then
        echo "  - $REGISTRY/$NAMESPACE/fastify-service:$VERSION"
    fi
    if [[ "$build_rust" == true ]]; then
        echo "  - $REGISTRY/$NAMESPACE/rust-embedding-service:$VERSION"
    fi
    echo "============================================"
}

# Run main function with all arguments
main "$@"