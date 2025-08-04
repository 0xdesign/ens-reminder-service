/**
 * Test utilities for ENS reminder bot testing
 */

import { Memory, IAgentRuntime, HandlerCallback } from "@elizaos/core";
import { mockXMTPService } from "../services/mock-xmtp";
import { mockCronService } from "../services/mock-cron";
import { mockDatabaseService } from "../services/mock-database";

export interface TestMessage {
  entityId: string;
  content: {
    text: string;
  };
}

export interface TestCallbackResult {
  text: string;
}

export class MockAgentRuntime implements IAgentRuntime {
  private settings: Map<string, string> = new Map();

  constructor() {
    // Set default test settings
    this.settings.set("ETHEREUM_RPC_URL", "https://eth-mainnet.alchemyapi.io/v2/demo");
    this.settings.set("SUPABASE_URL", "mock://localhost");
    this.settings.set("SUPABASE_ANON_KEY", "mock-key");
  }

  getSetting(key: string): string | undefined {
    return this.settings.get(key);
  }

  setSetting(key: string, value: string): void {
    this.settings.set(key, value);
  }

  // Minimal implementation for testing - add other required methods as needed
  [key: string]: any;
}

export class TestCallback {
  private results: TestCallbackResult[] = [];

  async call(result: TestCallbackResult): Promise<void> {
    this.results.push(result);
    console.log(`[TestCallback] ${result.text}`);
  }

  getResults(): TestCallbackResult[] {
    return [...this.results];
  }

  getLastResult(): TestCallbackResult | null {
    return this.results.length > 0 ? this.results[this.results.length - 1] : null;
  }

  clear(): void {
    this.results = [];
  }

  hasResultContaining(substring: string): boolean {
    return this.results.some(result => result.text.includes(substring));
  }
}

export function createTestMessage(walletAddress: string, text: string): Memory {
  return {
    entityId: walletAddress,
    content: {
      text
    },
    // Add other required Memory fields with defaults
    id: `msg_${Date.now()}`,
    agentId: "test-agent",
    userId: walletAddress,
    roomId: `room_${walletAddress}`,
    createdAt: Date.now()
  } as Memory;
}

export function createTestRuntime(): MockAgentRuntime {
  return new MockAgentRuntime();
}

export function createTestCallback(): TestCallback {
  return new TestCallback();
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function resetAllServices(): void {
  mockXMTPService.reset();
  mockCronService.reset();
  mockDatabaseService.reset();
  console.log("[TestUtils] All services reset");
}

export async function initializeTestServices(): Promise<void> {
  // Initialize mock services for testing
  await mockXMTPService.connect();
  mockCronService.start();
  console.log("[TestUtils] Test services initialized");
}

export async function cleanupTestServices(): Promise<void> {
  await mockXMTPService.disconnect();
  mockCronService.stop();
  console.log("[TestUtils] Test services cleaned up");
}

// Common test wallet addresses
export const TEST_WALLETS = {
  USER1: "0x1234567890123456789012345678901234567890",
  USER2: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  USER3: "0x9876543210987654321098765432109876543210"
};

// Common test domains
export const TEST_DOMAINS = {
  VALID: "vitalik.eth",
  EXPIRING_SOON: "test.eth", // This is in our mock data, expires in 7 days
  EXPIRED: "expired.eth",
  INVALID: "not-a-domain",
  NONEXISTENT: "thisdoesnotexist123456.eth"
};

export function expectCallbackToContain(callback: TestCallback, substring: string): void {
  const lastResult = callback.getLastResult();
  if (!lastResult) {
    throw new Error("No callback result found");
  }
  if (!lastResult.text.includes(substring)) {
    throw new Error(`Expected callback to contain "${substring}", but got: "${lastResult.text}"`);
  }
}

export function expectCallbackNotToContain(callback: TestCallback, substring: string): void {
  const lastResult = callback.getLastResult();
  if (!lastResult) {
    throw new Error("No callback result found");
  }
  if (lastResult.text.includes(substring)) {
    throw new Error(`Expected callback not to contain "${substring}", but got: "${lastResult.text}"`);
  }
}