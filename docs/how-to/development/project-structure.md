# Project Structure Guide

This document explains the standardized project structure following 2025 best practices for Node.js applications.

## Directory Overview

```
mcp-memory-stack/
├── scripts/                    # 🔧 Automation and deployment scripts
│   ├── deploy.sh              # Production deployment script
│   ├── setup.sh               # Environment setup script
│   ├── test-mcp.js            # MCP protocol testing script
│   ├── prepare-release.sh     # Release preparation automation
│   ├── health-check.sh        # System health monitoring
│   ├── rollback.sh            # Emergency rollback procedures
│   └── generate-secrets.sh    # Security credentials generation
├── config/                     # ⚙️ Configuration files
│   ├── jest.config.js         # Jest testing configuration
│   ├── database/              # Database configurations
│   │   └── init.sql           # PostgreSQL initialization
│   └── nginx/                 # Web server configurations
│       └── nginx.conf         # Nginx proxy configuration
├── src/                        # 💻 Application source code
│   ├── index.js               # Main application entry point
│   ├── config.js              # Application configuration
│   ├── core/                  # Core application modules
│   ├── services/              # Business logic services
│   ├── utils/                 # Utility functions
│   └── middleware/            # Express middleware
├── tests/                      # 🧪 Test suites
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── e2e/                   # End-to-end tests
│   └── setup.js               # Test configuration
├── docs/                       # 📖 Documentation
│   ├── tutorials/             # Learning guides
│   ├── how-to/                # Task-oriented guides
│   ├── reference/             # Technical reference
│   └── explanation/           # Conceptual explanations
├── secrets/                    # 🔐 Security credentials
├── nginx/                      # 🌐 Web server configuration
├── monitoring/                 # 📊 Monitoring configurations
├── migrations/                 # 📊 Database migrations
├── .github/                    # 🤖 GitHub automation
│   ├── workflows/             # CI/CD pipelines
│   └── ISSUE_TEMPLATE/        # Issue templates
├── package.json               # 📦 Project dependencies and scripts
├── Dockerfile                 # 🐳 Container configuration
├── docker-compose*.yml        # 🐳 Multi-container setup
├── .env.example               # 🔧 Environment template
└── README.md                  # 📋 Project overview
```

## Design Principles

### 1. Separation of Concerns
Each directory has a specific purpose and contains related files only:
- **`scripts/`** - All automation, deployment, and operational scripts
- **`config/`** - Configuration files organized by category
- **`src/`** - Application source code with modular structure
- **`tests/`** - Test files organized by testing strategy

### 2. Environment Consistency
Configuration files are organized to support multiple environments:
- Development configurations with debugging enabled
- Staging configurations for testing
- Production configurations optimized for performance

### 3. Modern Tooling Standards
Following 2025 Node.js best practices:
- ES Modules (`"type": "module"` in package.json)
- Centralized configuration files in `config/`
- Automation scripts in dedicated `scripts/` directory
- Comprehensive testing structure

## Script Organization

### Why Scripts in Dedicated Directory?
Modern 2025 standards require all operational scripts to be in a dedicated `scripts/` directory:

#### Benefits:
- ✅ **Clean root directory** - Only essential configuration files
- ✅ **Easy discovery** - All scripts in one location
- ✅ **Security** - Easier to audit and secure script files
- ✅ **Maintainability** - Clear organization for operations team

#### Scripts Included:
```bash
scripts/
├── deploy.sh              # ./scripts/deploy.sh production
├── setup.sh               # ./scripts/setup.sh full
├── test-mcp.js            # node scripts/test-mcp.js
├── test-setup.sh          # ./scripts/test-setup.sh
├── test-mcp-protocol.sh   # ./scripts/test-mcp-protocol.sh
├── prepare-release.sh     # ./scripts/prepare-release.sh v2.1.0
├── health-check.sh        # ./scripts/health-check.sh production
├── rollback.sh            # ./scripts/rollback.sh v2.0.9 --backup
└── generate-secrets.sh    # ./secrets/generate-secrets.sh
```

## Configuration Management

### Centralized Configuration
Configuration files are organized in `config/` directory by category:

```
config/
├── jest.config.js              # Testing configuration
├── database/
│   └── init.sql               # Database initialization
└── nginx/
    └── nginx.conf             # Web server configuration
```

### Jest Configuration
Jest configuration moved to `config/jest.config.js` with proper path resolution:

```javascript
export default {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/../tests/**/*.test.js',
    '<rootDir>/../tests/**/*.spec.js'
  ],
  collectCoverageFrom: [
    '<rootDir>/../src/**/*.js',
    '!<rootDir>/../src/index.js'
  ],
  coverageDirectory: '../coverage',
  setupFilesAfterEnv: ['<rootDir>/../tests/setup.js']
};
```

## Package.json Scripts

Updated scripts to reflect new structure:

```json
{
  "scripts": {
    "test": "jest --config=config/jest.config.js",
    "test:unit": "jest --config=config/jest.config.js tests/unit",
    "test:integration": "jest --config=config/jest.config.js tests/integration",
    "test:e2e": "jest --config=config/jest.config.js tests/e2e",
    "test:mcp": "node scripts/test-mcp.js",
    "test:setup": "./scripts/test-setup.sh",
    "test:protocol": "./scripts/test-mcp-protocol.sh",
    "setup": "./scripts/setup.sh",
    "deploy": "./scripts/deploy.sh",
    "release:prepare": "./scripts/prepare-release.sh",
    "health:check": "./scripts/health-check.sh",
    "rollback": "./scripts/rollback.sh"
  }
}
```

## Docker Configuration Updates

All Docker Compose files updated to use new structure:

```yaml
services:
  postgres:
    volumes:
      - ./config/database/init.sql:/docker-entrypoint-initdb.d/init.sql
```

## Migration from Old Structure

### Moved Files:
- ❌ `deploy.sh` → ✅ `scripts/deploy.sh`
- ❌ `setup.sh` → ✅ `scripts/setup.sh`
- ❌ `test-mcp.js` → ✅ `scripts/test-mcp.js`
- ❌ `test-setup.sh` → ✅ `scripts/test-setup.sh`
- ❌ `test-mcp-protocol.sh` → ✅ `scripts/test-mcp-protocol.sh`
- ❌ `init.sql` → ✅ `config/database/init.sql`
- ❌ `jest.config.js` → ✅ `config/jest.config.js`

### Updated References:
- Package.json scripts updated
- Docker Compose volume paths updated
- Jest configuration paths updated
- Documentation references updated

## Benefits of New Structure

### 1. Industry Standard Compliance
- Follows 2025 Node.js project structure standards
- Compatible with modern CI/CD pipelines
- Easier integration with development tools

### 2. Improved Maintainability
- Clear separation of concerns
- Easier to locate specific files
- Reduced cognitive load for developers

### 3. Enhanced Security
- Scripts isolated in dedicated directory
- Easier to audit and secure
- Clear permission management

### 4. Better Scalability
- Structure supports project growth
- Easy to add new scripts and configurations
- Maintains organization as project expands

## Usage Examples

### Running Scripts
```bash
# Setup development environment
./scripts/setup.sh full

# Deploy to production
./scripts/deploy.sh production

# Run health checks
./scripts/health-check.sh production --verbose

# Test MCP protocol
npm run test:mcp

# Test setup verification
npm run test:setup

# Test MCP protocol directly
npm run test:protocol

# Prepare release
./scripts/prepare-release.sh v2.1.0
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Development Workflow
```bash
# Initial setup
./scripts/setup.sh full

# Start development server
npm run dev

# Run tests
npm test

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production
```

This structure ensures the project follows modern 2025 standards while maintaining clarity, security, and maintainability.