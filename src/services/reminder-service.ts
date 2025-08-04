/**
 * Enhanced Reminder Service that integrates all mock services
 * This service handles the complete reminder workflow including cron jobs and XMTP messaging
 */

import { IAgentRuntime } from "@elizaos/core";
import { mockXMTPService } from "./mock-xmtp";
import { mockCronService } from "./mock-cron";
import { mockDatabaseService } from "./mock-database";

export interface ReminderServiceConfig {
  runtime: IAgentRuntime;
  enableXMTP?: boolean;
  enableCron?: boolean;
  reminderIntervals?: number[]; // Days before expiry to send reminders
}

export class ReminderService {
  private runtime: IAgentRuntime;
  private enableXMTP: boolean;
  private enableCron: boolean;
  private reminderIntervals: number[];
  private isInitialized: boolean = false;

  constructor(config: ReminderServiceConfig) {
    this.runtime = config.runtime;
    this.enableXMTP = config.enableXMTP !== false; // Default to true
    this.enableCron = config.enableCron !== false; // Default to true
    this.reminderIntervals = config.reminderIntervals || [30, 7, 1]; // Default intervals
  }

  /**
   * Initialize the reminder service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("[ReminderService] Already initialized");
      return;
    }

    console.log("[ReminderService] Initializing reminder service");

    try {
      // Initialize XMTP if enabled
      if (this.enableXMTP) {
        await mockXMTPService.connect();
        console.log("[ReminderService] XMTP service connected");
      }

      // Initialize cron if enabled
      if (this.enableCron) {
        this.setupCronJobs();
        mockCronService.start();
        console.log("[ReminderService] Cron service started");
      }

      this.isInitialized = true;
      console.log("[ReminderService] Reminder service initialized successfully");
    } catch (error) {
      console.error("[ReminderService] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Shutdown the reminder service
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log("[ReminderService] Shutting down reminder service");

    try {
      if (this.enableCron) {
        mockCronService.stop();
      }

      if (this.enableXMTP) {
        await mockXMTPService.disconnect();
      }

      this.isInitialized = false;
      console.log("[ReminderService] Reminder service shut down");
    } catch (error) {
      console.error("[ReminderService] Error during shutdown:", error);
    }
  }

  /**
   * Send a reminder message to a user
   */
  async sendReminder(walletAddress: string, domain: string, daysUntilExpiry: number): Promise<boolean> {
    if (!this.enableXMTP) {
      console.log("[ReminderService] XMTP disabled, skipping reminder");
      return true;
    }

    try {
      const message = this.createReminderMessage(domain, daysUntilExpiry);
      await mockXMTPService.sendMessage(walletAddress, message);
      
      console.log(`[ReminderService] Sent reminder to ${walletAddress} for ${domain}`);
      return true;
    } catch (error) {
      console.error(`[ReminderService] Failed to send reminder:`, error);
      return false;
    }
  }

  /**
   * Record that a reminder was sent
   */
  async recordSentReminder(reminderId: number, reminderType: 'day_30' | 'day_7' | 'day_1', messageId?: string): Promise<void> {
    try {
      const result = await mockDatabaseService.from('sent_reminders').insert({
        reminder_id: reminderId,
        sent_at: new Date().toISOString(),
        reminder_type: reminderType,
        message_id: messageId
      });

      console.log(`[ReminderService] Recorded sent reminder: ${reminderType} for reminder ${reminderId}`);
    } catch (error) {
      console.error(`[ReminderService] Failed to record sent reminder:`, error);
    }
  }

  /**
   * Check if a reminder has already been sent
   */
  async hasReminderBeenSent(reminderId: number, reminderType: 'day_30' | 'day_7' | 'day_1'): Promise<boolean> {
    try {
      const result = mockDatabaseService.from('sent_reminders').select();
      
      return new Promise((resolve) => {
        result.eq('reminder_id', reminderId).then((queryResult: any) => {
          if (queryResult.data) {
            const found = queryResult.data.some((record: any) => record.reminder_type === reminderType);
            resolve(found);
          } else {
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error(`[ReminderService] Error checking sent reminders:`, error);
      return false;
    }
  }

  /**
   * Process all pending reminders
   */
  async processReminders(): Promise<void> {
    console.log("[ReminderService] Processing pending reminders");

    try {
      const result = mockDatabaseService.from('reminders').select();
      
      result.then(async (queryResult: any) => {
        if (!queryResult.data) {
          console.log("[ReminderService] No reminders found");
          return;
        }

        const now = new Date();
        let processedCount = 0;

        for (const reminder of queryResult.data) {
          const expiryDate = new Date(reminder.expiry_date);
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          // Check each interval
          for (const interval of this.reminderIntervals) {
            if (daysUntilExpiry === interval) {
              const reminderType = `day_${interval}` as 'day_30' | 'day_7' | 'day_1';
              
              // Check if we've already sent this reminder
              const alreadySent = await this.hasReminderBeenSent(reminder.id, reminderType);
              if (alreadySent) {
                console.log(`[ReminderService] Reminder ${reminderType} already sent for ${reminder.domain}`);
                continue;
              }

              // Send the reminder
              const success = await this.sendReminder(
                reminder.wallet_address,
                reminder.domain,
                daysUntilExpiry
              );

              if (success) {
                await this.recordSentReminder(reminder.id, reminderType);
                processedCount++;
              }
            }
          }

          // Handle expired domains (grace period reminders)
          if (daysUntilExpiry <= 0) {
            const gracePeriodType = 'day_1' as const; // Use day_1 type for grace period
            const alreadySent = await this.hasReminderBeenSent(reminder.id, gracePeriodType);
            
            if (!alreadySent) {
              const message = `🚨 URGENT: Your ENS domain "${reminder.domain}" has expired! You may still be able to renew it during the grace period. Act quickly to avoid losing your domain.`;
              
              const success = await mockXMTPService.sendMessage(reminder.wallet_address, message);
              if (success) {
                await this.recordSentReminder(reminder.id, gracePeriodType);
                processedCount++;
              }
            }
          }
        }

        console.log(`[ReminderService] Processed ${processedCount} reminders`);
      });
    } catch (error) {
      console.error("[ReminderService] Error processing reminders:", error);
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    isInitialized: boolean;
    xmtpEnabled: boolean;
    cronEnabled: boolean;
    reminderIntervals: number[];
    xmtpStats?: any;
    cronStats?: any;
    dbStats?: any;
  } {
    return {
      isInitialized: this.isInitialized,
      xmtpEnabled: this.enableXMTP,
      cronEnabled: this.enableCron,
      reminderIntervals: this.reminderIntervals,
      xmtpStats: this.enableXMTP ? mockXMTPService.getStats() : undefined,
      cronStats: this.enableCron ? mockCronService.getStats() : undefined,
      dbStats: mockDatabaseService.getStats()
    };
  }

  /**
   * Manually trigger reminder processing (for testing)
   */
  async triggerReminderCheck(): Promise<void> {
    console.log("[ReminderService] Manually triggering reminder check");
    await this.processReminders();
  }

  /**
   * Set up cron jobs for reminder processing
   */
  private setupCronJobs(): void {
    // Daily reminder check at 9 AM (in mock mode, this runs immediately)
    mockCronService.schedule(
      "daily-reminder-check",
      "0 9 * * *",
      async () => {
        console.log("[ReminderService] Running daily reminder check");
        await this.processReminders();
      }
    );

    // Test job that runs immediately (for testing)
    mockCronService.scheduleImmediate(
      "test-reminder-check",
      async () => {
        console.log("[ReminderService] Running test reminder check");
        await this.processReminders();
      }
    );
  }

  /**
   * Create a reminder message based on days until expiry
   */
  private createReminderMessage(domain: string, daysUntilExpiry: number): string {
    if (daysUntilExpiry <= 0) {
      return `🚨 URGENT: Your ENS domain "${domain}" has expired! You may still be able to renew it during the grace period. Act quickly to avoid losing your domain.`;
    } else if (daysUntilExpiry === 1) {
      return `🚨 FINAL NOTICE: Your ENS domain "${domain}" expires TOMORROW! Please renew it immediately to avoid losing your domain.`;
    } else if (daysUntilExpiry <= 7) {
      return `⚡ URGENT: Your ENS domain "${domain}" expires in ${daysUntilExpiry} days! Please renew it soon to avoid losing your domain.`;
    } else if (daysUntilExpiry <= 30) {
      return `⏰ Reminder: Your ENS domain "${domain}" expires in ${daysUntilExpiry} days. Consider renewing it to ensure you don't lose your domain.`;
    } else {
      return `📅 Reminder: Your ENS domain "${domain}" expires in ${daysUntilExpiry} days. You have plenty of time, but it's good to keep track!`;
    }
  }
}

// Global service instance
let reminderServiceInstance: ReminderService | null = null;

/**
 * Get or create the reminder service instance
 */
export function getReminderService(runtime: IAgentRuntime): ReminderService {
  if (!reminderServiceInstance) {
    reminderServiceInstance = new ReminderService({ runtime });
  }
  return reminderServiceInstance;
}

/**
 * Initialize the global reminder service
 */
export async function initializeReminderService(runtime: IAgentRuntime): Promise<ReminderService> {
  const service = getReminderService(runtime);
  await service.initialize();
  return service;
}