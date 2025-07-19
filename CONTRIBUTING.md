# Contributing to MCP Memory Stack

We welcome contributions to MCP Memory Stack! This document provides guidelines
for contributing to the project.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Git
- Basic understanding of MCP protocol and vector databases

### Development Setup

1. **Fork the repository**

   ```bash
   git clone https://github.com/your-username/mcp-memory-stack.git
   cd mcp-memory-stack
   ```

2. **Set up development environment**

   ```bash
   # Copy environment template
   cp .env.example .env

   # Start development stack
   docker-compose -f docker-compose.dev.yml up -d

   # Install dependencies
   npm install
   ```

3. **Verify setup**

   ```bash
   # Check health
   curl http://localhost:3334/health

   # Run tests
   npm test
   ```

## 📋 Contribution Process

### 1. Issue-First Development

- **Check existing issues** before creating new ones
- **Create an issue** for new features or bug reports
- **Get approval** for major changes before starting work
- **Use issue templates** when available

### 2. Branch Strategy

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Create bugfix branch
git checkout -b bugfix/issue-description

# Create documentation branch
git checkout -b docs/improvement-description
```

### 3. Development Workflow

1. **Write code** following our style guidelines
2. **Add tests** for new functionality
3. **Update documentation** if needed
4. **Test thoroughly** in development environment
5. **Commit with clear messages**

### 4. Pull Request Process

1. **Ensure all tests pass**

   ```bash
   npm test
   npm run lint
   ```

2. **Update documentation** if needed

3. **Create pull request** with:
   - Clear title and description
   - Reference to related issues
   - Screenshots if UI changes
   - Testing instructions

4. **Wait for review** and address feedback

## 🎨 Code Style Guidelines

### JavaScript/Node.js

- **ES6+ modules** (import/export)
- **Async/await** over Promises when possible
- **Descriptive variable names**
- **JSDoc comments** for functions
- **Error handling** with try/catch

```javascript
/**
 * Creates a new memory with semantic embedding
 * @param {Object} memoryData - Memory content and metadata
 * @param {string} memoryData.type - Memory type
 * @param {Object} memoryData.content - Memory content
 * @returns {Promise<Object>} Created memory with ID
 */
async function createMemory(memoryData) {
  try {
    // Implementation here
  } catch (error) {
    logger.error('Failed to create memory:', error);
    throw error;
  }
}
```

### File Organization

```
src/
├── core/           # Protocol handlers (MCP, REST)
├── services/       # Business logic (memory, embedding, search)
├── database/       # Data layer (connection, queries)
├── utils/          # Utilities (logger, cache, metrics)
└── index.js        # Application entry point
```

### Configuration

- **Environment variables** for configuration
- **Validation** for all config values
- **Defaults** for optional settings
- **Documentation** for all variables

## 🧪 Testing Guidelines

### Test Structure

```
tests/
├── unit/           # Unit tests for individual functions
├── integration/    # Integration tests for components
└── e2e/           # End-to-end tests for full workflows
```

### Writing Tests

```javascript
// Unit test example
describe('Memory Service', () => {
  describe('createMemory', () => {
    it('should create memory with valid data', async () => {
      const memoryData = {
        type: 'learning',
        content: { topic: 'test' },
        source: 'test',
      };

      const result = await memoryService.createMemory(memoryData);

      expect(result).toHaveProperty('id');
      expect(result.type).toBe('learning');
    });

    it('should throw error with invalid data', async () => {
      await expect(memoryService.createMemory({})).rejects.toThrow(
        'Invalid memory data'
      );
    });
  });
});
```

### Test Requirements

- **Unit tests** for all business logic
- **Integration tests** for API endpoints
- **Error case testing** for failure scenarios
- **Performance tests** for critical paths

## 📚 Documentation Guidelines

### Code Documentation

- **JSDoc comments** for all public functions
- **README updates** for new features
- **API documentation** for endpoint changes
- **Configuration documentation** for new options

### Documentation Types

Following the [Diátaxis framework](https://diataxis.fr/):

1. **Tutorials** (`docs/tutorials/`) - Step-by-step learning
2. **How-to Guides** (`docs/how-to/`) - Problem-solving
3. **Reference** (`docs/reference/`) - Technical specifications
4. **Explanations** (`docs/explanation/`) - Concepts and design

### Writing Style

- **Clear and concise** language
- **Active voice** when possible
- **Code examples** for technical concepts
- **Screenshots** for UI changes
- **Cross-references** between related docs

## 🔒 Security Guidelines

### Secure Coding

- **Input validation** for all user data
- **Parameterized queries** for database operations
- **No hardcoded secrets** in code
- **Error handling** without information leakage

### Security Review

- **Dependency scanning** for vulnerabilities
- **Code review** for security issues
- **Secrets rotation** in development
- **OWASP guidelines** compliance

## 🐛 Bug Reports

### Information Required

- **MCP Memory Stack version**
- **Environment** (OS, Node.js version, Docker version)
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Error logs** and stack traces
- **Configuration** (sanitized, no secrets)

### Bug Report Template

```markdown
## Bug Description

Brief description of the issue

## Environment

- OS: [e.g., Ubuntu 22.04]
- Node.js: [e.g., 20.10.0]
- Docker: [e.g., 24.0.0]
- MCP Memory Stack: [e.g., 2.0.0]

## Steps to Reproduce

1. Step one
2. Step two
3. Step three

## Expected Behavior

What should happen

## Actual Behavior

What actually happens

## Error Logs
```

Paste error logs here

```

## Additional Context
Any other relevant information
```

## 💡 Feature Requests

### Feature Request Process

1. **Search existing issues** for similar requests
2. **Create detailed issue** with use case
3. **Discuss with maintainers** before implementation
4. **Create design document** for large features
5. **Break down** into smaller, manageable tasks

### Feature Request Template

```markdown
## Feature Description

Clear description of the proposed feature

## Use Case

Why is this feature needed? What problem does it solve?

## Proposed Solution

How should this feature work?

## Alternative Solutions

What other approaches could solve this problem?

## Additional Context

Any other relevant information
```

## 🏆 Recognition

### Contributors

All contributors are recognized in:

- **README.md** acknowledgments section
- **Release notes** for significant contributions
- **Contributors graph** on GitHub

### Types of Contributions

We value all types of contributions:

- **Code** - Bug fixes, features, performance improvements
- **Documentation** - Guides, examples, API docs
- **Testing** - Test cases, bug reports, QA
- **Design** - UI/UX improvements, graphics
- **Community** - Support, discussions, outreach

## 📞 Getting Help

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and community support
- **Documentation** - Comprehensive guides and references

### Maintainer Response

- **Issues**: Response within 48 hours
- **Pull Requests**: Review within 1 week
- **Security Issues**: Response within 24 hours

## 🎯 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Schedule

- **Patch releases**: As needed for critical fixes
- **Minor releases**: Monthly for new features
- **Major releases**: Quarterly for breaking changes

## 📄 License

By contributing to MCP Memory Stack, you agree that your contributions will be
licensed under the [MIT License](LICENSE).

---

Thank you for contributing to MCP Memory Stack! Together we're building the
future of AI memory systems. 🚀
