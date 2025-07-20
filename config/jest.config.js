export default {
  rootDir: '../',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/config/jest.setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js', '<rootDir>/tests/**/*.spec.js'],
  collectCoverageFrom: ['<rootDir>/src/**/*.js', '!<rootDir>/src/index.js', '!**/node_modules/**'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 15000,
  moduleNameMapper: {
    '^(.*)src/services/embedding.js$': '<rootDir>/tests/__mocks__/src/services/embedding.js',
  },
};
