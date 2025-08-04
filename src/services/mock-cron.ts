/**
 * Mock Cron Service for testing ENS reminder bot without waiting for real cron schedules
 * This service simulates cron job functionality for development and testing
 */

export interface CronJob {
  id: string;
  schedule: string;
  callback: () => Promise<void> | void;
  lastRun?: Date;
  nextRun?: Date;
  isRunning: boolean;
  runCount: number;
}

export class MockCronService {
  private jobs: Map<string, CronJob> = new Map();
  private isActive: boolean = false;
  private simulationInterval?: NodeJS.Timeout;

  constructor() {
    console.log("[MockCron] Initializing mock cron service");
  }

  /**
   * Schedule a new cron job
   */
  schedule(id: string, cronExpression: string, callback: () => Promise<void> | void): CronJob {
    const job: CronJob = {
      id,
      schedule: cronExpression,
      callback,
      isRunning: false,
      runCount: 0,
      nextRun: this.calculateNextRun(cronExpression)
    };

    this.jobs.set(id, job);
    console.log(`[MockCron] Scheduled job '${id}' with expression '${cronExpression}'`);
    
    return job;
  }

  /**
   * Start the cron service
   */
  start(): void {
    if (this.isActive) {
      console.log("[MockCron] Service already active");
      return;
    }

    this.isActive = true;
    console.log("[MockCron] Starting cron service");

    // In mock mode, we'll check for jobs every second instead of waiting for real cron schedules
    this.simulationInterval = setInterval(() => {
      this.checkAndRunJobs();
    }, 1000);
  }

  /**
   * Stop the cron service
   */
  stop(): void {
    if (!this.isActive) {
      console.log("[MockCron] Service already stopped");
      return;
    }

    this.isActive = false;
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = undefined;
    }

    console.log("[MockCron] Stopped cron service");
  }

  /**
   * Manually trigger a specific job (for testing)
   */
  async triggerJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job '${jobId}' not found`);
    }

    if (job.isRunning) {
      console.log(`[MockCron] Job '${jobId}' is already running`);
      return;
    }

    await this.executeJob(job);
  }

  /**
   * Trigger all jobs immediately (for testing)
   */
  async triggerAllJobs(): Promise<void> {
    console.log("[MockCron] Triggering all jobs");
    
    const jobPromises = Array.from(this.jobs.values())
      .filter(job => !job.isRunning)
      .map(job => this.executeJob(job));

    await Promise.all(jobPromises);
  }

  /**
   * Get information about all scheduled jobs
   */
  getJobs(): CronJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get information about a specific job
   */
  getJob(jobId: string): CronJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Remove a scheduled job
   */
  removeJob(jobId: string): boolean {
    if (this.jobs.has(jobId)) {
      this.jobs.delete(jobId);
      console.log(`[MockCron] Removed job '${jobId}'`);
      return true;
    }
    return false;
  }

  /**
   * Check if the service is active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalJobs: number;
    runningJobs: number;
    totalRuns: number;
    isActive: boolean;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      totalJobs: jobs.length,
      runningJobs: jobs.filter(job => job.isRunning).length,
      totalRuns: jobs.reduce((sum, job) => sum + job.runCount, 0),
      isActive: this.isActive
    };
  }

  /**
   * Reset all jobs and statistics (for testing)
   */
  reset(): void {
    this.stop();
    this.jobs.clear();
    console.log("[MockCron] Reset all jobs and stopped service");
  }

  /**
   * Set up a job to run immediately and then at intervals (for testing)
   */
  scheduleImmediate(id: string, callback: () => Promise<void> | void): CronJob {
    const job = this.schedule(id, "* * * * *", callback); // Every minute in real cron
    
    // In mock mode, run immediately
    setTimeout(() => {
      if (this.jobs.has(id)) {
        this.executeJob(job);
      }
    }, 100);

    return job;
  }

  /**
   * Execute a specific job
   */
  private async executeJob(job: CronJob): Promise<void> {
    if (job.isRunning) {
      return;
    }

    job.isRunning = true;
    job.lastRun = new Date();
    job.runCount++;

    console.log(`[MockCron] Executing job '${job.id}' (run #${job.runCount})`);

    try {
      await job.callback();
      console.log(`[MockCron] Job '${job.id}' completed successfully`);
    } catch (error) {
      console.error(`[MockCron] Job '${job.id}' failed:`, error);
    } finally {
      job.isRunning = false;
      job.nextRun = this.calculateNextRun(job.schedule);
    }
  }

  /**
   * Check all jobs and run those that should be executed
   */
  private checkAndRunJobs(): void {
    if (!this.isActive) {
      return;
    }

    const now = new Date();
    
    for (const job of this.jobs.values()) {
      if (!job.isRunning && job.nextRun && now >= job.nextRun) {
        this.executeJob(job);
      }
    }
  }

  /**
   * Calculate the next run time for a cron expression
   * In mock mode, we'll use simplified logic
   */
  private calculateNextRun(cronExpression: string): Date {
    const now = new Date();
    
    // For mock mode, let's simulate different intervals based on common patterns
    if (cronExpression.includes("0 9 * * *")) {
      // Daily at 9 AM - simulate as 10 seconds from now
      return new Date(now.getTime() + 10000);
    } else if (cronExpression.includes("* * * * *")) {
      // Every minute - simulate as 5 seconds from now
      return new Date(now.getTime() + 5000);
    } else {
      // Default - 30 seconds from now
      return new Date(now.getTime() + 30000);
    }
  }
}

// Singleton instance for the mock service
export const mockCronService = new MockCronService();