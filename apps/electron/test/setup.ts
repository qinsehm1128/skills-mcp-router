/**
 * Vitest test setup file
 * This file is executed before each test file
 */

import { vi } from "vitest";

// Mock electron module for unit tests
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn().mockReturnValue("/mock/path"),
    getName: vi.fn().mockReturnValue("MCP Router"),
    getVersion: vi.fn().mockReturnValue("0.6.1"),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

// Global test utilities
beforeAll(() => {
  // Setup before all tests
});

afterAll(() => {
  // Cleanup after all tests
});
