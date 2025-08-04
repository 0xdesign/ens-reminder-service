/**
 * Integration tests for complete user journeys
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
  TEST_WALLETS,
  sleep
} from "./test-utils";
import { mockXMTPService } from "../services/mock-xmtp";
import { mockCronService } from "../services/mock-cron";
import { mockDatabaseService } from "../services/mock-database";

describe("Integration Tests - Complete User Journeys", () => {
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

  describe("Complete User Journey 1: First-time User", () => {
    test("should handle new user setting their first reminder", async () => {
      // Step 1: User asks to check a domain
      const checkAction = ensReminderPlugin.actions.find(action => action.name === "CHECK_EXPIRY");
      const checkMessage = createTestMessage(TEST_WALLETS.USER1, "when does vitalik.eth expire?");
      
      await checkAction.handler(runtime, checkMessage, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "ENS Domain Info: vitalik.eth");
      expectCallbackToContain(callback, "Want me to set a reminder?");
      
      callback.clear();

      // Step 2: User decides to set a reminder
      const setAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
      const setMessage = createTestMessage(TEST_WALLETS.USER1, "remind me about vitalik.eth");
      
      await setAction.handler(runtime, setMessage, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "Reminder set for \"vitalik.eth\"");
      expectCallbackToContain(callback, "I'll send you notifications");
      
      callback.clear();

      // Step 3: User lists their reminders to confirm
      const listAction = ensReminderPlugin.actions.find(action => action.name === "LIST_REMINDERS");
      const listMessage = createTestMessage(TEST_WALLETS.USER1, "list my reminders");
      
      await listAction.handler(runtime, listMessage, undefined, undefined, callback.call.bind(callback));
      
      expectCallbackToContain(callback, "Your ENS Domain Reminders:");
      expectCallbackToContain(callback, "vitalik.eth");
      
      // Verify database state
      const stats = mockDatabaseService.getStats();
      expect(stats.reminders).toBeGreaterThan(0);
    });
  });

  describe("Complete User Journey 2: Power User", () => {
    test("should handle user managing multiple domains", async () => {
      const setAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
      const listAction = ensReminderPlugin.actions.find(action => action.name === "LIST_REMINDERS");
      
      // Set reminders for multiple domains
      const domains = ["vitalik.eth", "ethereum.eth"];
      
      for (const domain of domains) {
        const message = createTestMessage(TEST_WALLETS.USER1, `remind me about ${domain}`);
        await setAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
        callback.clear();
      }

      // List all reminders
      const listMessage = createTestMessage(TEST_WALLETS.USER1, "show my reminders");
      await listAction.handler(runtime, listMessage, undefined, undefined, callback.call.bind(callback));
      
      const result = callback.getLastResult();
      expect(result.text).toContain("Your ENS Domain Reminders:");
      
      // Should contain both domains
      for (const domain of domains) {
        expect(result.text).toContain(domain);
      }
    });
  });

  describe("Complete User Journey 3: Reminder Delivery System", () => {
    test("should simulate complete reminder delivery workflow", async () => {
      // Setup: User has a domain expiring soon (test data includes test.eth expiring in 7 days)
      await mockXMTPService.connect();
      mockCronService.start();

      // Create a reminder delivery job that would normally run daily
      const reminderDeliveryJob = async () => {
        console.log("[Integration Test] Running reminder delivery job");
        
        // Query for domains expiring within 30 days
        const reminders = mockDatabaseService.from('reminders').select();
        
        reminders.then(async (result: any) => {
          if (result.data) {
            for (const reminder of result.data) {
              const expiryDate = new Date(reminder.expiry_date);
              const now = new Date();
              const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              
              // Send reminder if expiring in 30, 7, or 1 days
              if ([30, 7, 1].includes(daysUntilExpiry)) {
                const message = `🚨 Reminder: Your ENS domain "${reminder.domain}" expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}!`;
                
                await mockXMTPService.sendMessage(reminder.wallet_address, message);
                
                // Record the sent reminder
                await mockDatabaseService.from('sent_reminders').insert({
                  reminder_id: reminder.id,
                  sent_at: new Date().toISOString(),
                  reminder_type: `day_${daysUntilExpiry}` as 'day_30' | 'day_7' | 'day_1'
                });
                
                console.log(`[Integration Test] Sent reminder for ${reminder.domain} to ${reminder.wallet_address}`);
              }
            }
          }
        });
      };

      // Schedule and run the reminder job
      mockCronService.schedule("reminder-delivery", "0 9 * * *", reminderDeliveryJob);
      await mockCronService.triggerJob("reminder-delivery");

      // Wait for async operations to complete
      await sleep(100);

      // Verify reminders were sent
      const stats = mockXMTPService.getStats();
      expect(stats.totalSentMessages).toBeGreaterThan(0);

      // Verify we can find a reminder message
      const sentMessages = mockXMTPService.getSentMessages();
      const reminderMessage = sentMessages.find(msg => msg.content.includes("expires in"));
      expect(reminderMessage).toBeTruthy();

      // Cleanup
      mockCronService.stop();
      await mockXMTPService.disconnect();
    });
  });

  describe("Complete User Journey 4: Error Recovery", () => {
    test("should handle and recover from various error conditions", async () => {
      const setAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
      
      // Test 1: Invalid domain format
      let message = createTestMessage(TEST_WALLETS.USER1, "remind me about invalid-domain");
      await setAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      expectCallbackToContain(callback, "doesn't appear to be a valid ENS domain");
      callback.clear();

      // Test 2: Non-existent domain
      message = createTestMessage(TEST_WALLETS.USER1, "remind me about thisdomaindoesnotexist12345.eth");
      await setAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      expectCallbackToContain(callback, "couldn't find an expiry date");
      callback.clear();

      // Test 3: Database connection error
      runtime.setSetting("SUPABASE_URL", "");
      message = createTestMessage(TEST_WALLETS.USER1, "remind me about vitalik.eth");
      await setAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      expectCallbackToContain(callback, "Database configuration is missing");
      callback.clear();

      // Test 4: Recovery - fix database config and try again
      runtime.setSetting("SUPABASE_URL", "mock://localhost");
      runtime.setSetting("SUPABASE_ANON_KEY", "mock-key");
      message = createTestMessage(TEST_WALLETS.USER1, "remind me about vitalik.eth");
      await setAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      expectCallbackToContain(callback, "Reminder set for \"vitalik.eth\"");
    });
  });

  describe("Complete User Journey 5: Multi-User Scenarios", () => {
    test("should handle multiple users independently", async () => {
      const setAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
      const listAction = ensReminderPlugin.actions.find(action => action.name === "LIST_REMINDERS");

      // User 1 sets reminders
      let message = createTestMessage(TEST_WALLETS.USER1, "remind me about vitalik.eth");
      await setAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      callback.clear();

      // User 2 sets different reminders
      message = createTestMessage(TEST_WALLETS.USER2, "remind me about ethereum.eth");
      await setAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      callback.clear();

      // User 1 lists their reminders
      message = createTestMessage(TEST_WALLETS.USER1, "list my reminders");
      await listAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      let result = callback.getLastResult();
      expect(result.text).toContain("vitalik.eth");
      expect(result.text).not.toContain("ethereum.eth");
      callback.clear();

      // User 2 lists their reminders
      message = createTestMessage(TEST_WALLETS.USER2, "list my reminders");
      await listAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
      
      result = callback.getLastResult();
      expect(result.text).toContain("ethereum.eth");
      expect(result.text).not.toContain("vitalik.eth");
    });
  });

  describe("Performance and Stress Tests", () => {
    test("should handle rapid message processing", async () => {
      const checkAction = ensReminderPlugin.actions.find(action => action.name === "CHECK_EXPIRY");
      const callbacks: any[] = [];
      
      // Send 10 rapid requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const testCallback = createTestCallback();
        callbacks.push(testCallback);
        
        const message = createTestMessage(TEST_WALLETS.USER1, "check vitalik.eth");
        promises.push(
          checkAction.handler(runtime, message, undefined, undefined, testCallback.call.bind(testCallback))
        );
      }

      // Wait for all to complete
      await Promise.all(promises);

      // Verify all requests were handled
      for (const cb of callbacks) {
        const result = cb.getLastResult();
        expect(result).toBeTruthy();
        expect(result.text).toContain("vitalik.eth");
      }
    });

    test("should handle large reminder lists", async () => {
      const setAction = ensReminderPlugin.actions.find(action => action.name === "SET_REMINDER");
      const listAction = ensReminderPlugin.actions.find(action => action.name === "LIST_REMINDERS");

      // Create many reminders for one user
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const message = createTestMessage(TEST_WALLETS.USER1, `remind me about domain${i}.eth`);
        promises.push(
          setAction.handler(runtime, message, undefined, undefined, () => {})
        );
      }

      await Promise.all(promises);

      // List all reminders
      const listMessage = createTestMessage(TEST_WALLETS.USER1, "list my reminders");
      await listAction.handler(runtime, listMessage, undefined, undefined, callback.call.bind(callback));

      const result = callback.getLastResult();
      expect(result).toBeTruthy();
      expect(result.text).toContain("Your ENS Domain Reminders:");
      
      // Should contain multiple domains
      expect(result.text.match(/domain\d+\.eth/g)?.length).toBeGreaterThanOrEqual(5);
    });
  });
});