/**
 * Jest test setup file
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // Only show important logs during tests
  console.log = jest.fn((message, ...args) => {
    if (typeof message === 'string' && (
      message.includes('[ERROR]') ||
      message.includes('[Integration Test]') ||
      message.includes('FAIL')
    )) {
      originalConsoleLog(message, ...args);
    }
  });

  console.error = jest.fn((message, ...args) => {
    // Always show errors
    originalConsoleError(message, ...args);
  });
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toContainText(text: string): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toContainText(received: any, text: string) {
    const pass = typeof received === 'string' && received.includes(text);
    if (pass) {
      return {
        message: () => `expected "${received}" not to contain "${text}"`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected "${received}" to contain "${text}"`,
        pass: false,
      };
    }
  },
});

export {};