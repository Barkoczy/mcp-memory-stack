/* eslint-env node */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only changes
        'style', // Code style changes (formatting, missing semi-colons, etc)
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'test', // Adding missing tests or correcting existing tests
        'chore', // Changes to build process, auxiliary tools, libraries
        'perf', // Performance improvement
        'ci', // Changes to CI configuration files and scripts
        'build', // Changes that affect the build system or external dependencies
        'revert', // Reverts a previous commit
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'core', // Core functionality
        'api', // REST API changes
        'mcp', // MCP protocol changes
        'database', // Database related changes
        'docker', // Docker configuration
        'ci', // CI/CD pipeline
        'deps', // Dependencies
        'config', // Configuration files
        'docs', // Documentation
        'test', // Test files
        'monitor', // Monitoring and metrics
        'security', // Security related changes
        'performance', // Performance optimizations
        'fastify', // Fastify migration (Phase 1)
        'rust', // Rust microservices (Phase 2)
        'elasticsearch', // Search integration
        'observability', // Monitoring stack
        'migration', // Migration-related changes
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-min-length': [2, 'always', 3],
    'subject-max-length': [2, 'always', 50],
    'body-max-line-length': [2, 'always', 72],
  },
};
