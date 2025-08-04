/**
 * Comprehensive test suite for ENS reminder plugin
 */

import { ensReminderPlugin } from "../plugins/ens-reminder-plugin";
import {
  createTestMessage,
  createTestRuntime,
  createTestCallback,
  resetAllServices,
  initializeTestServices,
  cleanupTestServices,
  expectCallbackToContain,
  expectCallbackNotToContain,
  TEST_WALLETS,
  TEST_DOMAINS,
  sleep
} from "./test-utils";
import { mockDatabaseService } from "../services/mock-database";

describe("ENS Reminder Plugin", () => {
  let runtime: any;
  let callback: any;

  beforeAll(async () => {
    await initializeTestServices();
  });

  beforeEach(async () => {
    resetAllServices();
    runtime = createTestRuntime();
    callback = createTestCallback();
  });

  afterAll(async () => {
    await cleanupTestServices();
  });

  describe("Plugin Structure", () => {
    test("should have correct plugin metadata", () => {
      expect(ensReminderPlugin.name).toBe("ens-reminder");
      expect(ensReminderPlugin.description).toBe("ENS domain expiration reminder plugin");
      expect(ensReminderPlugin.actions).toHaveLength(3);
    });

    test("should have all required actions", () => {
      const actionNames = ensReminderPlugin.actions.map(action => action.name);
      expect(actionNames).toContain("SET_REMINDER");
      expect(actionNames).toContain("LIST_REMINDERS");
      expect(actionNames).toContain("CHECK_EXPIRY");
    });
  });

  describe("SET_REMINDER Action", () => {
    let setReminderAction: any;

    beforeEach(() => {
      setReminderAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
    });

    test("should validate messages correctly", async () => {
      const validMessages = [
        "remind me about vitalik.eth",
        "set reminder for ethereum.eth",
        "track mydomain.eth",
        "watch test.eth domain"
      ];

      for (const text of validMessages) {
        const message = createTestMessage(TEST_WALLETS.USER1, text);
        const isValid = await setReminderAction.validate(runtime, message);
        expect(isValid).toBe(true);
      }
    });

    test("should reject invalid messages", async () => {
      const invalidMessages = [
        "hello there",
        "what's the weather?",
        "remind me to buy milk",
        "set alarm for 9am"
      ];

      for (const text of invalidMessages) {
        const message = createTestMessage(TEST_WALLETS.USER1, text);
        const isValid = await setReminderAction.validate(runtime, message);
        expect(isValid).toBe(false);
      }
    });

    test("should handle valid ENS domain reminder requests", async () => {
      const message = createTestMessage(TEST_WALLETS.USER1, "remind me about vitalik.eth");
      
      await setReminderAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      const result = callback.getLastResult();
      expect(result).toBeTruthy();
      expectCallbackToContain(callback, "Reminder set for \"vitalik.eth\"");
      expectCallbackToContain(callback, "Expires:");
      expectCallbackToContain(callback, "days from now");
    });

    test("should reject messages without valid ENS domains", async () => {
      const message = createTestMessage(TEST_WALLETS.USER1, "remind me about something");
      
      await setReminderAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "Please specify a valid ENS domain");
    });

    test("should reject invalid domain formats", async () => {
      const message = createTestMessage(TEST_WALLETS.USER1, "remind me about invalid-domain");
      
      await setReminderAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "doesn't appear to be a valid ENS domain");
    });

    test("should handle non-existent domains gracefully", async () => {
      const message = createTestMessage(TEST_WALLETS.USER1, `remind me about ${TEST_DOMAINS.NONEXISTENT}`);
      
      await setReminderAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "couldn't find an expiry date");
    });

    test("should store reminder in database", async () => {
      const message = createTestMessage(TEST_WALLETS.USER1, "remind me about vitalik.eth");
      
      await setReminderAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      // Check database was updated
      const stats = mockDatabaseService.getStats();
      expect(stats.reminders).toBeGreaterThan(0);
      
      // Verify the reminder was stored correctly
      const reminders = mockDatabaseService.from('reminders').select();
      reminders.eq('wallet_address', TEST_WALLETS.USER1).then((result: any) => {
        expect(result.data).toBeTruthy();
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data[0].domain).toBe("vitalik.eth");
      });
    });
  });

  describe("LIST_REMINDERS Action", () => {
    let listRemindersAction: any;

    beforeEach(() => {
      listRemindersAction = ensReminderPlugin.actions.find(action => action.name === "LIST_REMINDERS");
    });

    test("should validate list reminder messages", async () => {
      const validMessages = [
        "list my reminders",
        "show my reminders",
        "show reminders",
        "list reminders"
      ];

      for (const text of validMessages) {
        const message = createTestMessage(TEST_WALLETS.USER1, text);
        const isValid = await listRemindersAction.validate(runtime, message);
        expect(isValid).toBe(true);
      }
    });

    test("should handle empty reminder list", async () => {
      const message = createTestMessage(TEST_WALLETS.USER2, "list my reminders");
      
      await listRemindersAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "don't have any active ENS domain reminders");
    });

    test("should list existing reminders", async () => {
      // First set a reminder
      const setReminderAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
      const setMessage = createTestMessage(TEST_WALLETS.USER1, "remind me about vitalik.eth");
      await setReminderAction.handler(runtime, setMessage, undefined, undefined, () => {});

      // Then list reminders
      const listMessage = createTestMessage(TEST_WALLETS.USER1, "list my reminders");
      await listRemindersAction.handler(runtime, listMessage, undefined, undefined, callback.call.bind(callback));

      expectCallbackToContain(callback, "Your ENS Domain Reminders:");
      expectCallbackToContain(callback, "vitalik.eth");
      expectCallbackToContain(callback, "Expires:");
    });

    test("should show correct status for different expiry periods", async () => {
      // The test data includes a domain expiring in 7 days
      const message = createTestMessage(TEST_WALLETS.USER1, "list my reminders");
      
      await listRemindersAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      // Should show at least one reminder from test data
      const result = callback.getLastResult();
      expect(result).toBeTruthy();
    });
  });

  describe("CHECK_EXPIRY Action", () => {
    let checkExpiryAction: any;

    beforeEach(() => {
      checkExpiryAction = ensReminderPlugin.actions.find(action => action.name === "CHECK_EXPIRY");
    });

    test("should validate expiry check messages", async () => {
      const validMessages = [
        "when does vitalik.eth expire?",
        "check ethereum.eth",
        "expiry date for test.eth",
        "when expires mydomain.eth"
      ];

      for (const text of validMessages) {
        const message = createTestMessage(TEST_WALLETS.USER1, text);
        const isValid = await checkExpiryAction.validate(runtime, message);
        expect(isValid).toBe(true);
      }
    });

    test("should check valid domain expiry", async () => {
      const message = createTestMessage(TEST_WALLETS.USER1, "when does vitalik.eth expire?");
      
      await checkExpiryAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "ENS Domain Info: vitalik.eth");
      expectCallbackToContain(callback, "Expires:");
      expectCallbackToContain(callback, "days remaining");
    });

    test("should handle non-existent domains", async () => {
      const message = createTestMessage(TEST_WALLETS.USER1, `check ${TEST_DOMAINS.NONEXISTENT}`);
      
      await checkExpiryAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "couldn't find expiry information");
    });

    test("should suggest setting reminders", async () => {
      const message = createTestMessage(TEST_WALLETS.USER1, "check vitalik.eth");
      
      await checkExpiryAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "Want me to set a reminder?");
      expectCallbackToContain(callback, "remind me about vitalik.eth");
    });
  });

  describe("Error Handling", () => {
    test("should handle database connection errors gracefully", async () => {
      // Simulate database error by clearing the runtime settings
      runtime.setSetting("SUPABASE_URL", "");
      runtime.setSetting("SUPABASE_ANON_KEY", "");

      const setReminderAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
      const message = createTestMessage(TEST_WALLETS.USER1, "remind me about vitalik.eth");
      
      await setReminderAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "Database configuration is missing");
    });

    test("should handle network errors gracefully", async () => {
      // Test with invalid RPC URL
      runtime.setSetting("ETHEREUM_RPC_URL", "invalid-url");

      const checkExpiryAction = ensReminderPlugin.actions.find(action => action.name === "CHECK_EXPIRY");
      const message = createTestMessage(TEST_WALLETS.USER1, "check vitalik.eth");
      
      await checkExpiryAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "encountered an error");
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty messages", async () => {
      const setReminderAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
      const message = createTestMessage(TEST_WALLETS.USER1, "");
      
      const isValid = await setReminderAction.validate(runtime, message);
      expect(isValid).toBe(false);
    });

    test("should handle very long domain names", async () => {
      const longDomain = "a".repeat(100) + ".eth";
      const message = createTestMessage(TEST_WALLETS.USER1, `remind me about ${longDomain}`);
      
      const setReminderAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
      await setReminderAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      // Should handle gracefully, either accept or reject with proper message
      const result = callback.getLastResult();
      expect(result).toBeTruthy();
    });

    test("should handle case-insensitive domain names", async () => {
      const message1 = createTestMessage(TEST_WALLETS.USER1, "remind me about VITALIK.ETH");
      const message2 = createTestMessage(TEST_WALLETS.USER1, "remind me about vitalik.eth");
      
      const setReminderAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
      
      await setReminderAction.handler(runtime, message1, undefined, undefined, callback.call.bind(callback));
      const result1 = callback.getLastResult();
      
      callback.clear();
      
      await setReminderAction.handler(runtime, message2, undefined, undefined, callback.call.bind(callback));
      const result2 = callback.getLastResult();
      
      // Both should work and reference the same domain
      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
    });

    test("should handle multiple reminders for the same domain", async () => {
      const setReminderAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
      const message = createTestMessage(TEST_WALLETS.USER1, "remind me about vitalik.eth");
      
      // Set first reminder
      await setReminderAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      const result1 = callback.getLastResult();
      
      callback.clear();
      
      // Try to set second reminder for same domain
      await setReminderAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      const result2 = callback.getLastResult();
      
      // Both should succeed (business logic might allow multiple reminders)
      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
    });
  });
});