#!/bin/bash

# Production Secrets Generator for MCP Memory Stack
# Following security best practices for 2025

set -euo pipefail

SECRETS_DIR="$(dirname "$0")"
cd "$SECRETS_DIR"

echo "🔐 Generating production secrets for MCP Memory Stack..."

# Function to generate secure random password
generate_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to generate JWT secret
generate_jwt_secret() {
    openssl rand -hex 64
}

# Function to generate API key
generate_api_key() {
    echo "mcp_$(openssl rand -hex 16)"
}

# Generate database password
if [ ! -f "db_password.txt" ]; then
    echo "Generating database password..."
    generate_password 32 > db_password.txt
    chmod 600 db_password.txt
    echo "✅ Database password generated"
else
    echo "⚠️  Database password already exists, skipping..."
fi

# Generate database root password
if [ ! -f "db_root_password.txt" ]; then
    echo "Generating database root password..."
    generate_password 32 > db_root_password.txt
    chmod 600 db_root_password.txt
    echo "✅ Database root password generated"
else
    echo "⚠️  Database root password already exists, skipping..."
fi

# Generate JWT secret
if [ ! -f "jwt_secret.txt" ]; then
    echo "Generating JWT secret..."
    generate_jwt_secret > jwt_secret.txt
    chmod 600 jwt_secret.txt
    echo "✅ JWT secret generated"
else
    echo "⚠️  JWT secret already exists, skipping..."
fi

# Generate API key
if [ ! -f "api_key.txt" ]; then
    echo "Generating API key..."
    generate_api_key > api_key.txt
    chmod 600 api_key.txt
    echo "✅ API key generated"
else
    echo "⚠️  API key already exists, skipping..."
fi

# Set proper permissions on secrets directory
chmod 700 .

echo ""
echo "🎉 Secrets generation completed!"
echo ""
echo "📋 Generated secrets:"
echo "  - db_password.txt (Database user password)"
echo "  - db_root_password.txt (Database root password)"
echo "  - jwt_secret.txt (JWT signing secret)"
echo "  - api_key.txt (API authentication key)"
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "  1. These files contain sensitive information"
echo "  2. Never commit these files to version control"
echo "  3. Backup these files securely"
echo "  4. Rotate secrets regularly in production"
echo "  5. Use proper access controls (chmod 600)"
echo ""
echo "🔒 File permissions set to 600 (owner read/write only)"
echo "🔒 Directory permissions set to 700 (owner access only)"
