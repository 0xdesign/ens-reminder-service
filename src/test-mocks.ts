#!/usr/bin/env node

/**
 * Simple test runner for mock services without Jest
 * This allows us to verify our mock implementations work correctly
 */

import { mockXMTPService } from "./services/mock-xmtp.js";
import { mockCronService } from "./services/mock-cron.js";
import { mockDatabaseService } from "./services/mock-database.js";
import { ReminderService } from "./services/reminder-service.js";

class SimpleTestRunner {
  private passed = 0;
  private failed = 0;
  private tests: { name: string; fn: () => Promise<void> }[] = [];

  test(name: string, fn: () => Promise<void>) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log("🧪 Running Mock Service Tests\n");

    for (const { name, fn } of this.tests) {
      try {
        console.log(`⏳ ${name}`);
        await fn();
        console.log(`✅ ${name} - PASSED\n`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name} - FAILED`);
        console.log(`   Error: ${error.message}\n`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results:`);
    console.log(`   ✅ Passed: ${this.passed}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   📈 Total: ${this.passed + this.failed}`);

    if (this.failed > 0) {
      process.exit(1);
    }
  }

  assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertTrue(condition: boolean, message?: string) {
    if (!condition) {
      throw new Error(message || "Expected condition to be true");
    }
  }
}

// Test runner instance
const test = new SimpleTestRunner();

// Mock XMTP Service Tests
test.test("Mock XMTP Service - Connect and Disconnect", async () => {
  mockXMTPService.reset();
  test.assert(!mockXMTPService.isReady(), "Should start disconnected");
  
  await mockXMTPService.connect();
  test.assert(mockXMTPService.isReady(), "Should be connected after connect()");
  
  await mockXMTPService.disconnect();
  test.assert(!mockXMTPService.isReady(), "Should be disconnected after disconnect()");
});

test.test("Mock XMTP Service - Send Messages", async () => {
  mockXMTPService.reset();
  await mockXMTPService.connect();
  
  const message = await mockXMTPService.sendMessage(
    "0x1234567890123456789012345678901234567890",
    "Test message"
  );
  
  test.assert(message.id, "Message should have an ID");
  test.assertEqual(message.recipient, "0x1234567890123456789012345678901234567890", "Recipient should match");
  test.assertEqual(message.content, "Test message", "Content should match");
  
  const stats = mockXMTPService.getStats();
  test.assertEqual(stats.totalSentMessages, 1, "Should have 1 sent message");
  
  await mockXMTPService.disconnect();
});

test.test("Mock XMTP Service - Message Verification", async () => {
  mockXMTPService.reset();
  await mockXMTPService.connect();
  
  const recipient = "0xtest123";
  await mockXMTPService.sendMessage(recipient, "Domain expires soon!");
  
  test.assertTrue(mockXMTPService.wasMessageSentTo(recipient), "Should confirm message was sent");
  test.assertTrue(mockXMTPService.wasMessageSentTo(recipient, "expires"), "Should find message with substring");
  test.assert(!mockXMTPService.wasMessageSentTo("0xother"), "Should not find message to other recipient");
  
  await mockXMTPService.disconnect();
});

// Mock Cron Service Tests
test.test("Mock Cron Service - Schedule and Trigger Jobs", async () => {
  mockCronService.reset();
  
  let jobExecuted = false;
  const jobCallback = () => {
    jobExecuted = true;
  };
  
  mockCronService.schedule("test-job", "0 9 * * *", jobCallback);
  
  const job = mockCronService.getJob("test-job");
  test.assert(job, "Job should exist");
  test.assertEqual(job.runCount, 0, "Job should not have run yet");
  
  await mockCronService.triggerJob("test-job");
  
  test.assert(jobExecuted, "Job callback should have been executed");
  test.assertEqual(job.runCount, 1, "Job run count should be 1");
});

test.test("Mock Cron Service - Multiple Jobs", async () => {
  mockCronService.reset();
  
  let job1Executed = false;
  let job2Executed = false;
  
  mockCronService.schedule("job1", "0 9 * * *", () => { job1Executed = true; });
  mockCronService.schedule("job2", "0 10 * * *", () => { job2Executed = true; });
  
  await mockCronService.triggerAllJobs();
  
  test.assert(job1Executed, "Job 1 should have executed");
  test.assert(job2Executed, "Job 2 should have executed");
  
  const stats = mockCronService.getStats();
  test.assertEqual(stats.totalJobs, 2, "Should have 2 jobs");
  test.assertEqual(stats.totalRuns, 2, "Should have 2 total runs");
});

// Mock Database Service Tests
test.test("Mock Database Service - Insert and Select Reminders", async () => {
  mockDatabaseService.reset();
  
  const reminderData = {
    domain: "test.eth",
    wallet_address: "0xtest123",
    expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    reminders_sent: JSON.stringify([]),
    created_at: new Date().toISOString()
  };
  
  // Insert reminder
  const insertResult = mockDatabaseService.from('reminders').insert(reminderData);
  
  await new Promise((resolve) => {
    insertResult.then((result: any) => {
      test.assert(!result.error, "Insert should not have error");
      test.assert(result.data.id, "Inserted record should have ID");
      resolve(result);
    });
  });
  
  // Select reminder
  const selectResult = mockDatabaseService.from('reminders').select();
  
  await new Promise((resolve) => {
    selectResult.eq('wallet_address', '0xtest123').then((result: any) => {
      test.assert(!result.error, "Select should not have error");
      test.assert(result.data.length > 0, "Should find inserted reminder");
      test.assertEqual(result.data[0].domain, "test.eth", "Domain should match");
      resolve(result);
    });
  });
});

test.test("Mock Database Service - Complex Queries", async () => {
  mockDatabaseService.reset();
  
  // Insert multiple reminders
  const reminder1 = {
    domain: "domain1.eth",
    wallet_address: "0xuser1",
    expiry_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    reminders_sent: JSON.stringify([]),
    created_at: new Date().toISOString()
  };
  
  const reminder2 = {
    domain: "domain2.eth",
    wallet_address: "0xuser2",
    expiry_date: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
    reminders_sent: JSON.stringify([]),
    created_at: new Date().toISOString()
  };
  
  // Insert reminders and wait for completion
  const insert1 = mockDatabaseService.from('reminders').insert(reminder1);
  const insert2 = mockDatabaseService.from('reminders').insert(reminder2);
  
  await new Promise((resolve) => {
    insert1.then(() => {
      insert2.then(() => {
        resolve(null);
      });
    });
  });
  
  // Query specific user
  const userResult = mockDatabaseService.from('reminders').select();
  
  await new Promise((resolve) => {
    userResult.eq('wallet_address', '0xuser1').then((result: any) => {
      test.assert(!result.error, "Query should not have error");
      test.assertEqual(result.data.length, 1, "Should find 1 reminder for user1");
      test.assertEqual(result.data[0].domain, "domain1.eth", "Should find correct domain");
      resolve(result);
    });
  });
  
  const stats = mockDatabaseService.getStats();
  test.assert(stats.reminders >= 2, "Should have at least 2 reminders");
});

// Integration Test - All Services Working Together
test.test("Integration - Complete Reminder Workflow", async () => {
  // Reset all services
  mockXMTPService.reset();
  mockCronService.reset();
  mockDatabaseService.reset();
  
  // Initialize services
  await mockXMTPService.connect();
  mockCronService.start();
  
  // Create a reminder that expires in 7 days (should trigger reminder)
  const reminderData = {
    domain: "integration-test.eth",
    wallet_address: "0xintegration",
    expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    reminders_sent: JSON.stringify([]),
    created_at: new Date().toISOString()
  };
  
  // Insert reminder and wait for completion
  const insertResult = mockDatabaseService.from('reminders').insert(reminderData);
  await new Promise((resolve) => {
    insertResult.then(() => {
      resolve(null);
    });
  });
  
  // Create a cron job that processes reminders
  const reminderJob = async () => {
    const result = mockDatabaseService.from('reminders').select();
    
    result.then(async (queryResult: any) => {
      if (queryResult.data) {
        for (const reminder of queryResult.data) {
          const expiryDate = new Date(reminder.expiry_date);
          const now = new Date();
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiry === 7) {
            await mockXMTPService.sendMessage(
              reminder.wallet_address,
              `Your domain ${reminder.domain} expires in ${daysUntilExpiry} days!`
            );
          }
        }
      }
    });
  };
  
  mockCronService.schedule("reminder-job", "0 9 * * *", reminderJob);
  await mockCronService.triggerJob("reminder-job");
  
  // Wait a bit for async operations
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Verify reminder was sent
  test.assertTrue(
    mockXMTPService.wasMessageSentTo("0xintegration"),
    "Should have sent reminder message"
  );
  
  test.assertTrue(
    mockXMTPService.wasMessageSentTo("0xintegration", "expires in 7 days"),
    "Should have sent correct reminder content"
  );
  
  const stats = mockXMTPService.getStats();
  test.assert(stats.totalSentMessages > 0, "Should have sent at least one message");
  
  // Cleanup
  mockCronService.stop();
  await mockXMTPService.disconnect();
});

// Run all tests
test.run().catch(console.error);