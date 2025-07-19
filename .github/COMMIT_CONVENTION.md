# Commit Message Convention

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification with Angular conventions for consistent, semantic commit messages that enable automated versioning and changelog generation.

## Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
- **ci**: Changes to our CI configuration files and scripts (examples: .github, Travis, Circle, BrowserStack, SauceLabs)
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scope

The scope should be the name of the component affected (as perceived by the person reading the changelog):

- **core**: Core MCP server functionality
- **api**: REST API changes
- **db**: Database related changes
- **auth**: Authentication and authorization
- **monitoring**: Logging, metrics, and monitoring
- **docker**: Docker and containerization
- **tests**: Test-related changes
- **docs**: Documentation changes
- **config**: Configuration changes

### Subject

The subject contains a succinct description of the change:

- Use the imperative, present tense: "change" not "changed" nor "changes"
- Don't capitalize the first letter
- No dot (.) at the end
- Maximum 50 characters

### Body

Just as in the subject, use the imperative, present tense: "change" not "changed" nor "changes". The body should include the motivation for the change and contrast this with previous behavior.

### Footer

The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit **Closes**.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

## Examples

### Feature
```
feat(monitoring): add Prometheus metrics collection

Implement comprehensive metrics collection including:
- HTTP request/response metrics
- Database operation timing
- Memory usage tracking
- Custom business logic metrics

Closes #123
```

### Bug Fix
```
fix(auth): resolve JWT token validation error

Fix issue where expired tokens were not properly rejected,
causing security vulnerability in protected endpoints.

Fixes #456
```

### Breaking Change
```
feat(api)!: change memory search endpoint response format

BREAKING CHANGE: Memory search API now returns results in a different structure.
The 'items' field is now 'memories' and includes additional metadata.

Migration guide:
- Update client code to use 'memories' instead of 'items'
- Handle new metadata fields in response

Closes #789
```

### Documentation
```
docs(readme): update installation instructions

Add Docker Compose setup instructions and environment
configuration examples for development workflow.
```

### Refactor
```
refactor(core): extract memory service into separate module

Split large memory handler into focused service classes
for better maintainability and testing.
```

## Semantic Versioning Impact

- `fix:` triggers a **PATCH** release (0.1.0 → 0.1.1)
- `feat:` triggers a **MINOR** release (0.1.0 → 0.2.0)  
- `BREAKING CHANGE:` triggers a **MAJOR** release (0.1.0 → 1.0.0)

## Tools and Automation

### Commitlint
This project uses commitlint to enforce conventional commit format:

```bash
npm run commit:lint
```

### Semantic Release
Automated versioning and changelog generation:

```bash
npm run release
```

### Commit Templates
Use the provided commit template:

```bash
git config commit.template .gitmessage
```

## Pre-commit Hooks

Pre-commit hooks automatically:
- Lint commit messages
- Run code formatting
- Execute tests
- Check for secrets

## Best Practices

1. **Atomic Commits**: Each commit should represent a single logical change
2. **Descriptive Messages**: Explain the "why" not just the "what"
3. **Reference Issues**: Link commits to GitHub issues when applicable
4. **Breaking Changes**: Always document breaking changes clearly
5. **Consistent Scope**: Use consistent scope names throughout the project
6. **Review History**: Keep commit history clean and meaningful

## Common Mistakes to Avoid

❌ **Don't:**
```
fix: stuff
feat: Added new feature
Fixed bug in login
```

✅ **Do:**
```
fix(auth): resolve login validation error
feat(api): add user profile endpoint
fix(db): handle connection timeout gracefully
```

## Commit Message Validation

All commit messages are validated using:
- **commitlint** with Angular convention
- **husky** pre-commit hooks
- **GitHub Actions** workflow checks

For more information, see:
- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Angular Commit Convention](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- [Semantic Versioning](https://semver.org/)