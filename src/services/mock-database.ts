/**
 * Mock Database Service for testing ENS reminder bot without real Supabase credentials
 * This service simulates Supabase database functionality using in-memory storage
 */

export interface ReminderRecord {
  id?: number;
  domain: string;
  wallet_address: string;
  expiry_date: string;
  reminders_sent: string;
  created_at: string;
  updated_at?: string;
}

export interface SentReminderRecord {
  id?: number;
  reminder_id: number;
  sent_at: string;
  reminder_type: 'day_30' | 'day_7' | 'day_1';
  message_id?: string;
}

export interface ConversationRecord {
  id?: number;
  wallet_address: string;
  conversation_id: string;
  created_at: string;
  last_message_at?: string;
}

export interface QueryResult<T> {
  data: T[] | null;
  error: any;
}

export interface InsertResult {
  data: any;
  error: any;
}

export interface UpdateResult {
  data: any;
  error: any;
}

export interface DeleteResult {
  data: any;
  error: any;
}

export class MockDatabaseService {
  private reminders: Map<number, ReminderRecord> = new Map();
  private sentReminders: Map<number, SentReminderRecord> = new Map();
  private conversations: Map<number, ConversationRecord> = new Map();
  private nextId: { reminders: number; sentReminders: number; conversations: number } = {
    reminders: 1,
    sentReminders: 1,
    conversations: 1
  };

  constructor() {
    console.log("[MockDB] Initializing mock database service");
    this.seedTestData();
  }

  /**
   * Mock Supabase client interface
   */
  from(table: 'reminders' | 'sent_reminders' | 'conversations') {
    return {
      select: (columns: string = '*') => this.createSelectQuery(table, columns),
      insert: (data: any) => this.createInsertQuery(table, data),
      update: (data: any) => this.createUpdateQuery(table, data),
      delete: () => this.createDeleteQuery(table)
    };
  }

  /**
   * Create a select query builder
   */
  private createSelectQuery(table: string, columns: string) {
    const self = this;
    return {
      eq: (column: string, value: any) => ({
        then: (callback: (result: QueryResult<any>) => void) => {
          const result = self.executeSelect(table, columns, { [column]: value });
          callback(result);
        }
      }),
      neq: (column: string, value: any) => ({
        then: (callback: (result: QueryResult<any>) => void) => {
          const result = self.executeSelect(table, columns, { [`${column}_neq`]: value });
          callback(result);
        }
      }),
      lt: (column: string, value: any) => ({
        then: (callback: (result: QueryResult<any>) => void) => {
          const result = self.executeSelect(table, columns, { [`${column}_lt`]: value });
          callback(result);
        }
      }),
      lte: (column: string, value: any) => ({
        then: (callback: (result: QueryResult<any>) => void) => {
          const result = self.executeSelect(table, columns, { [`${column}_lte`]: value });
          callback(result);
        }
      }),
      gt: (column: string, value: any) => ({
        then: (callback: (result: QueryResult<any>) => void) => {
          const result = self.executeSelect(table, columns, { [`${column}_gt`]: value });
          callback(result);
        }
      }),
      gte: (column: string, value: any) => ({
        then: (callback: (result: QueryResult<any>) => void) => {
          const result = self.executeSelect(table, columns, { [`${column}_gte`]: value });
          callback(result);
        }
      }),
      order: (column: string, options?: { ascending?: boolean }) => ({
        then: (callback: (result: QueryResult<any>) => void) => {
          const result = self.executeSelect(table, columns, {});
          if (result.data) {
            result.data.sort((a, b) => {
              const aVal = a[column];
              const bVal = b[column];
              const ascending = options?.ascending !== false;
              
              if (aVal < bVal) return ascending ? -1 : 1;
              if (aVal > bVal) return ascending ? 1 : -1;
              return 0;
            });
          }
          callback(result);
        }
      }),
      // Direct execution without filters
      then: (callback: (result: QueryResult<any>) => void) => {
        const result = self.executeSelect(table, columns, {});
        callback(result);
      }
    };
  }

  /**
   * Create an insert query builder
   */
  private createInsertQuery(table: string, data: any) {
    return {
      then: (callback: (result: InsertResult) => void) => {
        callback(this.executeInsert(table, data));
      }
    };
  }

  /**
   * Create an update query builder
   */
  private createUpdateQuery(table: string, data: any) {
    return {
      eq: (column: string, value: any) => ({
        then: (callback: (result: UpdateResult) => void) => {
          callback(this.executeUpdate(table, data, { [column]: value }));
        }
      })
    };
  }

  /**
   * Create a delete query builder
   */
  private createDeleteQuery(table: string) {
    return {
      eq: (column: string, value: any) => ({
        then: (callback: (result: DeleteResult) => void) => {
          callback(this.executeDelete(table, { [column]: value }));
        }
      })
    };
  }

  /**
   * Execute a select query
   */
  private executeSelect(table: string, columns: string, filters: any): QueryResult<any> {
    try {
      let data: any[] = [];

      switch (table) {
        case 'reminders':
          data = Array.from(this.reminders.values());
          break;
        case 'sent_reminders':
          data = Array.from(this.sentReminders.values());
          break;
        case 'conversations':
          data = Array.from(this.conversations.values());
          break;
        default:
          return { data: null, error: { message: `Unknown table: ${table}` } };
      }

      // Apply filters
      data = data.filter(record => {
        for (const [key, value] of Object.entries(filters)) {
          if (key.endsWith('_neq')) {
            const column = key.replace('_neq', '');
            if (record[column] === value) return false;
          } else if (key.endsWith('_lt')) {
            const column = key.replace('_lt', '');
            if (!(record[column] < value)) return false;
          } else if (key.endsWith('_lte')) {
            const column = key.replace('_lte', '');
            if (!(record[column] <= value)) return false;
          } else if (key.endsWith('_gt')) {
            const column = key.replace('_gt', '');
            if (!(record[column] > value)) return false;
          } else if (key.endsWith('_gte')) {
            const column = key.replace('_gte', '');
            if (!(record[column] >= value)) return false;
          } else {
            if (record[key] !== value) return false;
          }
        }
        return true;
      });

      console.log(`[MockDB] SELECT from ${table}: found ${data.length} records`);
      return { data, error: null };
    } catch (error) {
      console.error(`[MockDB] SELECT error:`, error);
      return { data: null, error };
    }
  }

  /**
   * Execute an insert query
   */
  private executeInsert(table: string, data: any): InsertResult {
    try {
      const record = Array.isArray(data) ? data[0] : data;
      
      switch (table) {
        case 'reminders':
          const reminderId = this.nextId.reminders++;
          const reminderRecord: ReminderRecord = {
            ...record,
            id: reminderId,
            created_at: record.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          this.reminders.set(reminderId, reminderRecord);
          console.log(`[MockDB] INSERT into reminders: ${reminderRecord.domain}`);
          return { data: reminderRecord, error: null };

        case 'sent_reminders':
          const sentId = this.nextId.sentReminders++;
          const sentRecord: SentReminderRecord = {
            ...record,
            id: sentId
          };
          this.sentReminders.set(sentId, sentRecord);
          console.log(`[MockDB] INSERT into sent_reminders: reminder_id ${sentRecord.reminder_id}`);
          return { data: sentRecord, error: null };

        case 'conversations':
          const convId = this.nextId.conversations++;
          const convRecord: ConversationRecord = {
            ...record,
            id: convId,
            created_at: record.created_at || new Date().toISOString()
          };
          this.conversations.set(convId, convRecord);
          console.log(`[MockDB] INSERT into conversations: ${convRecord.wallet_address}`);
          return { data: convRecord, error: null };

        default:
          return { data: null, error: { message: `Unknown table: ${table}` } };
      }
    } catch (error) {
      console.error(`[MockDB] INSERT error:`, error);
      return { data: null, error };
    }
  }

  /**
   * Execute an update query
   */
  private executeUpdate(table: string, data: any, filters: any): UpdateResult {
    try {
      let updated = 0;

      switch (table) {
        case 'reminders':
          for (const [id, record] of this.reminders.entries()) {
            if (this.matchesFilters(record, filters)) {
              this.reminders.set(id, {
                ...record,
                ...data,
                updated_at: new Date().toISOString()
              });
              updated++;
            }
          }
          break;

        case 'sent_reminders':
          for (const [id, record] of this.sentReminders.entries()) {
            if (this.matchesFilters(record, filters)) {
              this.sentReminders.set(id, { ...record, ...data });
              updated++;
            }
          }
          break;

        case 'conversations':
          for (const [id, record] of this.conversations.entries()) {
            if (this.matchesFilters(record, filters)) {
              this.conversations.set(id, { ...record, ...data });
              updated++;
            }
          }
          break;
      }

      console.log(`[MockDB] UPDATE ${table}: ${updated} records updated`);
      return { data: { count: updated }, error: null };
    } catch (error) {
      console.error(`[MockDB] UPDATE error:`, error);
      return { data: null, error };
    }
  }

  /**
   * Execute a delete query
   */
  private executeDelete(table: string, filters: any): DeleteResult {
    try {
      let deleted = 0;

      switch (table) {
        case 'reminders':
          for (const [id, record] of this.reminders.entries()) {
            if (this.matchesFilters(record, filters)) {
              this.reminders.delete(id);
              deleted++;
            }
          }
          break;

        case 'sent_reminders':
          for (const [id, record] of this.sentReminders.entries()) {
            if (this.matchesFilters(record, filters)) {
              this.sentReminders.delete(id);
              deleted++;
            }
          }
          break;

        case 'conversations':
          for (const [id, record] of this.conversations.entries()) {
            if (this.matchesFilters(record, filters)) {
              this.conversations.delete(id);
              deleted++;
            }
          }
          break;
      }

      console.log(`[MockDB] DELETE from ${table}: ${deleted} records deleted`);
      return { data: { count: deleted }, error: null };
    } catch (error) {
      console.error(`[MockDB] DELETE error:`, error);
      return { data: null, error };
    }
  }

  /**
   * Check if a record matches the given filters
   */
  private matchesFilters(record: any, filters: any): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (record[key] !== value) return false;
    }
    return true;
  }

  /**
   * Get database statistics
   */
  getStats(): {
    reminders: number;
    sentReminders: number;
    conversations: number;
  } {
    return {
      reminders: this.reminders.size,
      sentReminders: this.sentReminders.size,
      conversations: this.conversations.size
    };
  }

  /**
   * Reset all data (for testing)
   */
  reset(): void {
    this.reminders.clear();
    this.sentReminders.clear();
    this.conversations.clear();
    this.nextId = { reminders: 1, sentReminders: 1, conversations: 1 };
    console.log("[MockDB] Reset all data");
  }

  /**
   * Seed some test data
   */
  private seedTestData(): void {
    // Add a test reminder that's expiring soon
    const testReminder: ReminderRecord = {
      id: 1,
      domain: "test.eth",
      wallet_address: "0xtest123",
      expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      reminders_sent: JSON.stringify([]),
      created_at: new Date().toISOString()
    };
    
    this.reminders.set(1, testReminder);
    this.nextId.reminders = 2;
    
    console.log("[MockDB] Seeded test data");
  }
}

// Singleton instance for the mock service
export const mockDatabaseService = new MockDatabaseService();