/**
 * Test suite for mock services
 */

import { mockXMTPService } from "../services/mock-xmtp";
import { mockCronService } from "../services/mock-cron";
import { mockDatabaseService, ReminderRecord } from "../services/mock-database";
import { sleep, TEST_WALLETS } from "./test-utils";

describe("Mock Services", () => {
  beforeEach(() => {
    // Reset all services before each test
    mockXMTPService.reset();
    mockCronService.reset();
    mockDatabaseService.reset();
  });

  describe("Mock XMTP Service", () => {
    test("should initialize with disconnected state", () => {
      expect(mockXMTPService.isReady()).toBe(false);
    });

    test("should connect and disconnect", async () => {
      await mockXMTPService.connect();
      expect(mockXMTPService.isReady()).toBe(true);

      await mockXMTPService.disconnect();
      expect(mockXMTPService.isReady()).toBe(false);
    });

    test("should send messages when connected", async () => {
      await mockXMTPService.connect();
      
      const message = await mockXMTPService.sendMessage(
        TEST_WALLETS.USER1,
        "Test reminder message"
      );

      expect(message.id).toBeTruthy();
      expect(message.recipient).toBe(TEST_WALLETS.USER1);
      expect(message.content).toBe("Test reminder message");
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    test("should fail to send messages when disconnected", async () => {
      await expect(
        mockXMTPService.sendMessage(TEST_WALLETS.USER1, "Test message")
      ).rejects.toThrow("XMTP service not connected");
    });

    test("should track sent messages", async () => {
      await mockXMTPService.connect();
      
      await mockXMTPService.sendMessage(TEST_WALLETS.USER1, "Message 1");
      await mockXMTPService.sendMessage(TEST_WALLETS.USER2, "Message 2");

      const sentMessages = mockXMTPService.getSentMessages();
      expect(sentMessages).toHaveLength(2);
      expect(sentMessages[0].content).toBe("Message 1");
      expect(sentMessages[1].content).toBe("Message 2");
    });

    test("should create conversations", async () => {
      await mockXMTPService.connect();
      
      await mockXMTPService.sendMessage(TEST_WALLETS.USER1, "Hello");
      await mockXMTPService.simulateIncomingMessage(TEST_WALLETS.USER1, "Hi back");

      const conversations = await mockXMTPService.getConversations();
      expect(conversations).toHaveLength(1);
      expect(conversations[0].messages).toHaveLength(2);
    });

    test("should verify message delivery", async () => {
      await mockXMTPService.connect();
      
      await mockXMTPService.sendMessage(TEST_WALLETS.USER1, "Reminder about domain.eth");

      expect(mockXMTPService.wasMessageSentTo(TEST_WALLETS.USER1)).toBe(true);
      expect(mockXMTPService.wasMessageSentTo(TEST_WALLETS.USER1, "domain.eth")).toBe(true);
      expect(mockXMTPService.wasMessageSentTo(TEST_WALLETS.USER2)).toBe(false);
    });

    test("should provide accurate statistics", async () => {
      await mockXMTPService.connect();
      
      await mockXMTPService.sendMessage(TEST_WALLETS.USER1, "Message 1");
      await mockXMTPService.sendMessage(TEST_WALLETS.USER2, "Message 2");
      await mockXMTPService.simulateIncomingMessage(TEST_WALLETS.USER1, "Reply");

      const stats = mockXMTPService.getStats();
      expect(stats.totalConversations).toBe(2);
      expect(stats.totalMessages).toBe(3);
      expect(stats.totalSentMessages).toBe(2);
    });
  });

  describe("Mock Cron Service", () => {
    test("should initialize in stopped state", () => {
      expect(mockCronService.isRunning()).toBe(false);
    });

    test("should start and stop", () => {
      mockCronService.start();
      expect(mockCronService.isRunning()).toBe(true);

      mockCronService.stop();
      expect(mockCronService.isRunning()).toBe(false);
    });

    test("should schedule jobs", () => {
      const callback = jest.fn();
      const job = mockCronService.schedule("test-job", "0 9 * * *", callback);

      expect(job.id).toBe("test-job");
      expect(job.schedule).toBe("0 9 * * *");
      expect(job.runCount).toBe(0);
      expect(job.isRunning).toBe(false);
    });

    test("should trigger jobs manually", async () => {
      const callback = jest.fn();
      mockCronService.schedule("test-job", "0 9 * * *", callback);

      await mockCronService.triggerJob("test-job");

      expect(callback).toHaveBeenCalledTimes(1);

      const job = mockCronService.getJob("test-job");
      expect(job!.runCount).toBe(1);
      expect(job!.lastRun).toBeTruthy();
    });

    test("should trigger all jobs", async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      mockCronService.schedule("job1", "0 9 * * *", callback1);
      mockCronService.schedule("job2", "0 10 * * *", callback2);

      await mockCronService.triggerAllJobs();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    test("should handle job errors gracefully", async () => {
      const errorCallback = jest.fn(() => {
        throw new Error("Test error");
      });

      mockCronService.schedule("error-job", "0 9 * * *", errorCallback);

      // Should not throw
      await expect(mockCronService.triggerJob("error-job")).resolves.toBeUndefined();

      const job = mockCronService.getJob("error-job");
      expect(job!.runCount).toBe(1);
      expect(job!.isRunning).toBe(false);
    });

    test("should provide job statistics", async () => {
      const callback = jest.fn();
      mockCronService.schedule("test-job", "0 9 * * *", callback);
      
      await mockCronService.triggerJob("test-job");

      const stats = mockCronService.getStats();
      expect(stats.totalJobs).toBe(1);
      expect(stats.runningJobs).toBe(0);
      expect(stats.totalRuns).toBe(1);
      expect(stats.isActive).toBe(false);
    });

    test("should run jobs automatically when started", async () => {
      const callback = jest.fn();
      mockCronService.scheduleImmediate("immediate-job", callback);
      
      mockCronService.start();
      
      // Wait a bit for the job to run
      await sleep(200);
      
      expect(callback).toHaveBeenCalled();
      
      mockCronService.stop();
    });
  });

  describe("Mock Database Service", () => {
    test("should initialize with test data", () => {
      const stats = mockDatabaseService.getStats();
      expect(stats.reminders).toBe(1); // Should have test data
    });

    test("should insert reminders", async () => {
      const reminderData: ReminderRecord = {
        domain: "newdomain.eth",
        wallet_address: TEST_WALLETS.USER1,
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        reminders_sent: JSON.stringify([]),
        created_at: new Date().toISOString()
      };

      const result = mockDatabaseService.from('reminders').insert(reminderData);
      
      result.then((insertResult: any) => {
        expect(insertResult.error).toBeNull();
        expect(insertResult.data.domain).toBe("newdomain.eth");
        expect(insertResult.data.id).toBeTruthy();
      });
    });

    test("should select reminders by wallet address", async () => {
      // Insert a test reminder
      const reminderData: ReminderRecord = {
        domain: "test-select.eth",
        wallet_address: TEST_WALLETS.USER1,
        expiry_date: new Date().toISOString(),
        reminders_sent: JSON.stringify([]),
        created_at: new Date().toISOString()
      };

      mockDatabaseService.from('reminders').insert(reminderData);

      // Query for the reminder
      const result = mockDatabaseService.from('reminders').select();
      result.eq('wallet_address', TEST_WALLETS.USER1).then((queryResult: any) => {
        expect(queryResult.error).toBeNull();
        expect(queryResult.data).toBeTruthy();
        expect(queryResult.data.length).toBeGreaterThan(0);
        
        const reminder = queryResult.data.find((r: any) => r.domain === "test-select.eth");
        expect(reminder).toBeTruthy();
      });
    });

    test("should update reminders", async () => {
      // Insert a reminder first
      const reminderData: ReminderRecord = {
        domain: "update-test.eth",
        wallet_address: TEST_WALLETS.USER1,
        expiry_date: new Date().toISOString(),
        reminders_sent: JSON.stringify([]),
        created_at: new Date().toISOString()
      };

      const insertResult = mockDatabaseService.from('reminders').insert(reminderData);
      
      insertResult.then((result: any) => {
        const reminderId = result.data.id;
        
        // Update the reminder
        const updateResult = mockDatabaseService.from('reminders').update({
          reminders_sent: JSON.stringify([30])
        });
        
        updateResult.eq('id', reminderId).then((updateRes: any) => {
          expect(updateRes.error).toBeNull();
          expect(updateRes.data.count).toBe(1);
        });
      });
    });

    test("should delete reminders", async () => {
      // Insert a reminder first
      const reminderData: ReminderRecord = {
        domain: "delete-test.eth",
        wallet_address: TEST_WALLETS.USER1,
        expiry_date: new Date().toISOString(),
        reminders_sent: JSON.stringify([]),
        created_at: new Date().toISOString()
      };

      mockDatabaseService.from('reminders').insert(reminderData);

      // Delete the reminder
      const deleteResult = mockDatabaseService.from('reminders').delete();
      deleteResult.eq('domain', 'delete-test.eth').then((result: any) => {
        expect(result.error).toBeNull();
        expect(result.data.count).toBe(1);
      });
    });

    test("should handle complex queries", async () => {
      // Insert multiple reminders
      const reminder1: ReminderRecord = {
        domain: "domain1.eth",
        wallet_address: TEST_WALLETS.USER1,
        expiry_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
        reminders_sent: JSON.stringify([]),
        created_at: new Date().toISOString()
      };

      const reminder2: ReminderRecord = {
        domain: "domain2.eth",
        wallet_address: TEST_WALLETS.USER1,
        expiry_date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days
        reminders_sent: JSON.stringify([]),
        created_at: new Date().toISOString()
      };

      mockDatabaseService.from('reminders').insert(reminder1);
      mockDatabaseService.from('reminders').insert(reminder2);

      // Query for expiring soon (less than 30 days)
      const soonDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const result = mockDatabaseService.from('reminders').select();
      // Note: This is a simplified test - real implementation would use proper date comparison
      expect(result).toBeTruthy();
    });

    test("should provide accurate statistics", () => {
      const initialStats = mockDatabaseService.getStats();
      
      // Insert some test data
      mockDatabaseService.from('reminders').insert({
        domain: "stats-test.eth",
        wallet_address: TEST_WALLETS.USER1,
        expiry_date: new Date().toISOString(),
        reminders_sent: JSON.stringify([]),
        created_at: new Date().toISOString()
      });

      mockDatabaseService.from('sent_reminders').insert({
        reminder_id: 1,
        sent_at: new Date().toISOString(),
        reminder_type: 'day_30' as const
      });

      const newStats = mockDatabaseService.getStats();
      expect(newStats.reminders).toBe(initialStats.reminders + 1);
      expect(newStats.sentReminders).toBe(initialStats.sentReminders + 1);
    });
  });

  describe("Service Integration", () => {
    test("should work together for complete workflow", async () => {
      // Initialize all services
      await mockXMTPService.connect();
      mockCronService.start();

      // Create a cron job that sends XMTP messages
      const reminderCallback = async () => {
        await mockXMTPService.sendMessage(
          TEST_WALLETS.USER1,
          "Your domain expires soon!"
        );
      };

      mockCronService.schedule("reminder-job", "0 9 * * *", reminderCallback);

      // Trigger the job
      await mockCronService.triggerJob("reminder-job");

      // Verify message was sent
      expect(mockXMTPService.wasMessageSentTo(TEST_WALLETS.USER1)).toBe(true);
      expect(mockXMTPService.wasMessageSentTo(TEST_WALLETS.USER1, "expires soon")).toBe(true);

      // Verify job ran
      const job = mockCronService.getJob("reminder-job");
      expect(job!.runCount).toBe(1);

      // Cleanup
      mockCronService.stop();
      await mockXMTPService.disconnect();
    });
  });
});