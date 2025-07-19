#!/bin/bash

# prepare-release.sh - Automated release preparation script
# Usage: ./scripts/prepare-release.sh [version] [--dry-run]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PACKAGE_JSON="$PROJECT_ROOT/package.json"
CHANGELOG="$PROJECT_ROOT/CHANGELOG.md"
README="$PROJECT_ROOT/README.md"

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get current version from package.json
get_current_version() {
    if [[ -f "$PACKAGE_JSON" ]]; then
        node -p "require('$PACKAGE_JSON').version" 2>/dev/null || echo "0.0.0"
    else
        echo "0.0.0"
    fi
}

# Function to validate version format
validate_version() {
    local version="$1"
    if [[ ! "$version" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
        print_error "Invalid version format: $version"
        print_error "Expected format: v1.2.3 or 1.2.3 (with optional pre-release suffix)"
        exit 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check required commands
    local required_commands=("git" "node" "npm" "docker")
    for cmd in "${required_commands[@]}"; do
        if ! command_exists "$cmd"; then
            print_error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
    
    # Check if working directory is clean
    if [[ -n "$(git status --porcelain)" ]]; then
        print_error "Working directory is not clean. Please commit or stash your changes."
        git status --short
        exit 1
    fi
    
    # Check if we're on the main branch
    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
        print_warning "Not on main/master branch (currently on: $current_branch)"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    print_status "Prerequisites check passed"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    if [[ -f "package-lock.json" ]]; then
        npm ci
    else
        npm install
    fi
    
    # Run linting
    if npm run lint >/dev/null 2>&1; then
        print_status "Linting passed"
    else
        print_error "Linting failed"
        npm run lint
        exit 1
    fi
    
    # Run type checking
    if npm run typecheck >/dev/null 2>&1; then
        print_status "Type checking passed"
    else
        print_warning "Type checking failed or not configured"
    fi
    
    # Run tests
    if npm test; then
        print_status "Tests passed"
    else
        print_error "Tests failed"
        exit 1
    fi
    
    # Security audit
    if npm audit --audit-level moderate; then
        print_status "Security audit passed"
    else
        print_warning "Security audit found issues"
        read -p "Continue despite security issues? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Function to update version
update_version() {
    local new_version="$1"
    local dry_run="$2"
    
    # Remove 'v' prefix if present
    new_version="${new_version#v}"
    
    print_status "Updating version to $new_version..."
    
    if [[ "$dry_run" == "true" ]]; then
        print_status "[DRY RUN] Would update package.json version to $new_version"
        return
    fi
    
    # Update package.json
    npm version "$new_version" --no-git-tag-version
    
    # Update README badges if they exist
    if grep -q "version-.*-blue" "$README"; then
        sed -i.bak "s/version-.*-blue/version-$new_version-blue/g" "$README"
        rm -f "$README.bak"
        print_status "Updated version badge in README.md"
    fi
}

# Function to update changelog
update_changelog() {
    local new_version="$1"
    local dry_run="$2"
    
    print_status "Updating CHANGELOG.md..."
    
    if [[ "$dry_run" == "true" ]]; then
        print_status "[DRY RUN] Would update CHANGELOG.md for version $new_version"
        return
    fi
    
    local current_date
    current_date=$(date +"%Y-%m-%d")
    
    # Create backup
    cp "$CHANGELOG" "$CHANGELOG.bak"
    
    # Prepare new changelog entry
    local temp_changelog
    temp_changelog=$(mktemp)
    
    echo "# Changelog" > "$temp_changelog"
    echo "" >> "$temp_changelog"
    echo "All notable changes to this project will be documented in this file." >> "$temp_changelog"
    echo "" >> "$temp_changelog"
    echo "## [${new_version#v}] - $current_date" >> "$temp_changelog"
    echo "" >> "$temp_changelog"
    echo "### Added" >> "$temp_changelog"
    echo "- New features and enhancements" >> "$temp_changelog"
    echo "" >> "$temp_changelog"
    echo "### Changed" >> "$temp_changelog"
    echo "- Changes to existing functionality" >> "$temp_changelog"
    echo "" >> "$temp_changelog"
    echo "### Fixed" >> "$temp_changelog"
    echo "- Bug fixes" >> "$temp_changelog"
    echo "" >> "$temp_changelog"
    echo "### Security" >> "$temp_changelog"
    echo "- Security improvements" >> "$temp_changelog"
    echo "" >> "$temp_changelog"
    
    # Append existing changelog (skip header if it exists)
    if [[ -f "$CHANGELOG" ]]; then
        # Skip the first few lines if they contain the standard header
        tail -n +5 "$CHANGELOG" >> "$temp_changelog"
    fi
    
    mv "$temp_changelog" "$CHANGELOG"
    
    print_status "CHANGELOG.md updated. Please edit it to add specific changes."
    print_warning "Don't forget to update the changelog with actual changes!"
}

# Function to create release branch
create_release_branch() {
    local version="$1"
    local dry_run="$2"
    
    local branch_name="release/v${version#v}"
    
    print_status "Creating release branch: $branch_name"
    
    if [[ "$dry_run" == "true" ]]; then
        print_status "[DRY RUN] Would create branch $branch_name"
        return
    fi
    
    git checkout -b "$branch_name"
    git add .
    git commit -m "Prepare release v${version#v}"
    
    print_status "Created release branch: $branch_name"
    print_status "Push with: git push -u origin $branch_name"
}

# Function to build and test Docker images
test_docker_build() {
    local dry_run="$1"
    
    print_status "Testing Docker build..."
    
    if [[ "$dry_run" == "true" ]]; then
        print_status "[DRY RUN] Would test Docker build"
        return
    fi
    
    cd "$PROJECT_ROOT"
    
    # Build production image
    if docker build -f Dockerfile -t mcp-memory-stack:test .; then
        print_status "Docker build successful"
        docker rmi mcp-memory-stack:test
    else
        print_error "Docker build failed"
        exit 1
    fi
    
    # Test docker-compose
    if docker-compose config >/dev/null; then
        print_status "Docker Compose configuration valid"
    else
        print_error "Docker Compose configuration invalid"
        exit 1
    fi
}

# Function to generate release notes
generate_release_notes() {
    local version="$1"
    local dry_run="$2"
    
    print_status "Generating release notes..."
    
    if [[ "$dry_run" == "true" ]]; then
        print_status "[DRY RUN] Would generate release notes"
        return
    fi
    
    local release_notes_file="$PROJECT_ROOT/release-notes-${version#v}.md"
    local previous_tag
    
    # Get previous tag
    previous_tag=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
    
    cat > "$release_notes_file" << EOF
# Release Notes - v${version#v}

## What's Changed

$(if [[ -n "$previous_tag" ]]; then
    git log --pretty=format:"- %s (%h)" "$previous_tag"..HEAD | head -20
else
    echo "- Initial release"
fi)

## Installation

### Docker
\`\`\`bash
docker pull mcp-memory-stack:v${version#v}
\`\`\`

### Docker Compose
\`\`\`bash
curl -O https://raw.githubusercontent.com/your-org/mcp-memory-stack/v${version#v}/docker-compose.yml
docker-compose up -d
\`\`\`

### Manual Installation
\`\`\`bash
git clone https://github.com/your-org/mcp-memory-stack.git
cd mcp-memory-stack
git checkout v${version#v}
npm install
npm start
\`\`\`

## Migration Guide

$(if [[ -n "$previous_tag" ]]; then
    echo "### Upgrading from $previous_tag"
    echo "1. Stop the current service"
    echo "2. Backup your database"
    echo "3. Pull the new version"
    echo "4. Update configuration if needed"
    echo "5. Start the service"
else
    echo "This is the initial release. See installation instructions above."
fi)

## Breaking Changes

- List any breaking changes here
- Include migration instructions

## Known Issues

- List any known issues
- Include workarounds if available

## Support

For questions and support, please:
- Check the [documentation](https://github.com/your-org/mcp-memory-stack/tree/v${version#v}/docs)
- Search [existing issues](https://github.com/your-org/mcp-memory-stack/issues)
- Create a [new issue](https://github.com/your-org/mcp-memory-stack/issues/new)
EOF

    print_status "Release notes generated: $release_notes_file"
    print_warning "Please review and edit the release notes before publishing!"
}

# Main function
main() {
    local version=""
    local dry_run="false"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                dry_run="true"
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [version] [--dry-run]"
                echo ""
                echo "Arguments:"
                echo "  version     Target version (e.g., v2.1.0 or 2.1.0)"
                echo "  --dry-run   Show what would be done without making changes"
                echo "  --help      Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0 v2.1.0              # Prepare release v2.1.0"
                echo "  $0 2.1.0 --dry-run     # Show what would be done for v2.1.0"
                exit 0
                ;;
            *)
                if [[ -z "$version" ]]; then
                    version="$1"
                else
                    print_error "Unknown argument: $1"
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # If no version provided, prompt for it
    if [[ -z "$version" ]]; then
        local current_version
        current_version=$(get_current_version)
        echo "Current version: $current_version"
        echo ""
        echo "Version bump options:"
        echo "  patch - $current_version -> $(npm version patch --dry-run 2>/dev/null | tail -1 || echo 'N/A')"
        echo "  minor - $current_version -> $(npm version minor --dry-run 2>/dev/null | tail -1 || echo 'N/A')"
        echo "  major - $current_version -> $(npm version major --dry-run 2>/dev/null | tail -1 || echo 'N/A')"
        echo ""
        read -p "Enter new version (or 'patch'/'minor'/'major'): " version
        
        if [[ "$version" == "patch" || "$version" == "minor" || "$version" == "major" ]]; then
            version=$(npm version "$version" --dry-run 2>/dev/null | tail -1)
            if [[ -z "$version" ]]; then
                print_error "Failed to determine new version"
                exit 1
            fi
        fi
    fi
    
    # Validate version
    validate_version "$version"
    
    # Normalize version (add 'v' prefix if missing)
    if [[ ! "$version" =~ ^v ]]; then
        version="v$version"
    fi
    
    print_status "Preparing release $version"
    if [[ "$dry_run" == "true" ]]; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi
    
    # Run preparation steps
    check_prerequisites
    run_tests
    update_version "$version" "$dry_run"
    update_changelog "$version" "$dry_run"
    test_docker_build "$dry_run"
    generate_release_notes "$version" "$dry_run"
    create_release_branch "$version" "$dry_run"
    
    print_status "Release preparation complete!"
    
    if [[ "$dry_run" != "true" ]]; then
        echo ""
        print_status "Next steps:"
        echo "1. Review and edit CHANGELOG.md"
        echo "2. Review and edit release-notes-${version#v}.md"
        echo "3. Test the release branch thoroughly"
        echo "4. Push the release branch: git push -u origin release/$version"
        echo "5. Create a pull request for review"
        echo "6. After approval, tag the release: git tag -a $version -m 'Release $version'"
        echo "7. Push the tag: git push origin $version"
    fi
}

# Run main function with all arguments
main "$@"