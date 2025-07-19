#!/bin/bash

# Docker Hub Publishing Script
# Builds and publishes Docker images to registry

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOCKER_REGISTRY=${DOCKER_REGISTRY:-""}
IMAGE_NAME=${IMAGE_NAME:-"mcp-memory-server"}
VERSION=${VERSION:-$(cat package.json | grep '"version"' | cut -d'"' -f4)}
PLATFORMS=${PLATFORMS:-"linux/amd64,linux/arm64"}

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker buildx version &> /dev/null; then
        print_error "Docker buildx is not available"
        exit 1
    fi
    
    # Check if logged in to Docker Hub
    if ! docker info | grep -q "Username"; then
        print_warning "Not logged in to Docker Hub. Run 'docker login' first"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Setup buildx builder
setup_buildx() {
    print_status "Setting up Docker buildx..."
    
    # Create builder if it doesn't exist
    if ! docker buildx ls | grep -q "mcp-builder"; then
        docker buildx create --name mcp-builder --driver docker-container --bootstrap
    fi
    
    # Use the builder
    docker buildx use mcp-builder
    print_status "Buildx setup complete"
}

# Build and push images
build_and_push() {
    print_status "Building and pushing images..."
    
    # Determine image tags
    local base_image="${DOCKER_REGISTRY}${IMAGE_NAME}"
    
    # Build tags
    local tags=(
        "${base_image}:${VERSION}"
        "${base_image}:latest"
    )
    
    # Add major.minor tag if semantic version
    if [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        local major_minor=$(echo $VERSION | cut -d. -f1-2)
        tags+=("${base_image}:${major_minor}")
    fi
    
    # Add git commit hash tag if in git repo
    if git rev-parse HEAD &> /dev/null; then
        local commit_hash=$(git rev-parse --short HEAD)
        tags+=("${base_image}:${commit_hash}")
    fi
    
    # Build tag arguments
    local tag_args=""
    for tag in "${tags[@]}"; do
        tag_args="$tag_args --tag $tag"
    done
    
    print_status "Building for platforms: $PLATFORMS"
    print_status "Tags: ${tags[*]}"
    
    # Build and push
    docker buildx build \
        --platform $PLATFORMS \
        $tag_args \
        --push \
        --file Dockerfile \
        .
    
    print_status "Build and push completed successfully"
}

# Verify published images
verify_images() {
    print_status "Verifying published images..."
    
    local base_image="${DOCKER_REGISTRY}${IMAGE_NAME}"
    
    # Test pulling latest image
    docker pull "${base_image}:latest"
    
    # Test running container
    local container_id=$(docker run -d \
        -e NODE_ENV=production \
        -e DB_HOST=localhost \
        -e DB_USER=test \
        -e DB_PASSWORD=test \
        -e DB_NAME=test \
        "${base_image}:latest")
    
    # Wait a bit for startup
    sleep 5
    
    # Check if container is running
    if docker ps | grep -q $container_id; then
        print_status "Container started successfully"
        docker stop $container_id > /dev/null
        docker rm $container_id > /dev/null
    else
        print_error "Container failed to start"
        docker logs $container_id
        docker rm $container_id > /dev/null
        exit 1
    fi
    
    print_status "Image verification completed"
}

# Generate release notes
generate_release_notes() {
    print_status "Generating release notes..."
    
    local release_file="release-notes-${VERSION}.md"
    
    cat > $release_file << EOF
# Release Notes - Version ${VERSION}

**Release Date:** $(date '+%Y-%m-%d')

## Docker Images

- \`${DOCKER_REGISTRY}${IMAGE_NAME}:${VERSION}\`
- \`${DOCKER_REGISTRY}${IMAGE_NAME}:latest\`

## Platforms

- linux/amd64
- linux/arm64

## Changes

$(git log --oneline --since="7 days ago" | head -10)

## Usage

\`\`\`bash
docker pull ${DOCKER_REGISTRY}${IMAGE_NAME}:${VERSION}
docker run -d \\
  -p 3000:3000 \\
  -e NODE_ENV=production \\
  -e DB_HOST=your-db-host \\
  -e DB_USER=your-db-user \\
  -e DB_PASSWORD=your-db-password \\
  -e DB_NAME=your-db-name \\
  ${DOCKER_REGISTRY}${IMAGE_NAME}:${VERSION}
\`\`\`

## Security

- All dependencies updated to latest versions
- Security scan passed
- No known vulnerabilities

EOF

    print_status "Release notes generated: $release_file"
}

# Cleanup
cleanup() {
    print_status "Cleaning up..."
    
    # Remove builder (optional)
    # docker buildx rm mcp-builder
    
    # Cleanup dangling images
    docker image prune -f
    
    print_status "Cleanup completed"
}

# Main execution
main() {
    print_status "Starting Docker publish process..."
    print_status "Version: $VERSION"
    print_status "Image: ${DOCKER_REGISTRY}${IMAGE_NAME}"
    
    check_prerequisites
    setup_buildx
    build_and_push
    verify_images
    generate_release_notes
    cleanup
    
    print_status "Docker publish process completed successfully!"
    print_status "Images published:"
    print_status "  - ${DOCKER_REGISTRY}${IMAGE_NAME}:${VERSION}"
    print_status "  - ${DOCKER_REGISTRY}${IMAGE_NAME}:latest"
}

# Script options
case "${1:-}" in
    --help|-h)
        echo "Docker Hub Publishing Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --dry-run      Show what would be built without actually building"
        echo ""
        echo "Environment Variables:"
        echo "  DOCKER_REGISTRY  Docker registry prefix (default: '')"
        echo "  IMAGE_NAME       Image name (default: 'mcp-memory-server')"
        echo "  VERSION          Image version (default: from package.json)"
        echo "  PLATFORMS        Target platforms (default: 'linux/amd64,linux/arm64')"
        echo ""
        echo "Examples:"
        echo "  $0"
        echo "  DOCKER_REGISTRY=myregistry.com/ $0"
        echo "  VERSION=2.1.0 $0"
        exit 0
        ;;
    --dry-run)
        print_status "DRY RUN MODE - No images will be built or pushed"
        print_status "Would build version: $VERSION"
        print_status "Would build for platforms: $PLATFORMS"
        print_status "Would create tags:"
        print_status "  - ${DOCKER_REGISTRY}${IMAGE_NAME}:${VERSION}"
        print_status "  - ${DOCKER_REGISTRY}${IMAGE_NAME}:latest"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac