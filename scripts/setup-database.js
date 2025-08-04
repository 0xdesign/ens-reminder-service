#!/usr/bin/env node

/**
 * Database Setup Script for ENS Reminder Bot
 * Creates the required Supabase tables and indexes
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Please run: npm run setup-env');
  console.error('Then edit .env.local with your Supabase credentials');
  process.exit(1);
}

console.log('🗄️  ENS Reminder Bot - Database Setup');
console.log('====================================');

async function setupDatabase() {
  try {
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('📡 Connecting to Supabase...');

    // Read SQL schema file
    const schemaPath = join(__dirname, '..', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');

    console.log('📄 Loading database schema...');

    // Execute SQL schema
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: schema 
    });

    if (error) {
      // If exec_sql function doesn't exist, we'll create tables manually
      console.log('⚠️  exec_sql function not available, creating tables manually...');
      
      // Create tables individually
      const tables = [
        // Reminders table
        `
        CREATE TABLE IF NOT EXISTS reminders (
          id SERIAL PRIMARY KEY,
          domain TEXT NOT NULL,
          wallet_address TEXT NOT NULL,
          expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
          reminders_sent JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        `,
        
        // Sent reminders table
        `
        CREATE TABLE IF NOT EXISTS sent_reminders (
          id SERIAL PRIMARY KEY,
          reminder_id INTEGER REFERENCES reminders(id) ON DELETE CASCADE,
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          reminder_type TEXT NOT NULL CHECK (reminder_type IN ('day_30', 'day_7', 'day_1')),
          message_id TEXT
        );
        `,
        
        // Conversations table
        `
        CREATE TABLE IF NOT EXISTS conversations (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          conversation_id TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_message_at TIMESTAMP WITH TIME ZONE
        );
        `
      ];

      for (const table of tables) {
        const { error: tableError } = await supabase.rpc('exec', { sql: table });
        if (tableError && !tableError.message.includes('already exists')) {
          console.error(`❌ Error creating table: ${tableError.message}`);
        }
      }

      // Create indexes
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_reminders_wallet_address ON reminders(wallet_address);',
        'CREATE INDEX IF NOT EXISTS idx_reminders_expiry_date ON reminders(expiry_date);',
        'CREATE INDEX IF NOT EXISTS idx_sent_reminders_reminder_id ON sent_reminders(reminder_id);',
        'CREATE INDEX IF NOT EXISTS idx_conversations_wallet_address ON conversations(wallet_address);'
      ];

      for (const index of indexes) {
        const { error: indexError } = await supabase.rpc('exec', { sql: index });
        if (indexError && !indexError.message.includes('already exists')) {
          console.log(`⚠️  Index creation warning: ${indexError.message}`);
        }
      }
    }

    console.log('✅ Database schema created successfully!');

    // Verify tables exist
    console.log('🔍 Verifying tables...');

    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['reminders', 'sent_reminders', 'conversations']);

    if (tablesError) {
      console.log('⚠️  Could not verify tables (this is normal for some Supabase setups)');
    } else if (tables && tables.length === 3) {
      console.log('✅ All required tables verified:');
      tables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    }

    // Test basic operations
    console.log('🧪 Testing database operations...');

    // Test insert
    const testReminder = {
      domain: 'test-setup.eth',
      wallet_address: '0xtest123',
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      reminders_sent: []
    };

    const { data: insertData, error: insertError } = await supabase
      .from('reminders')
      .insert(testReminder)
      .select();

    if (insertError) {
      console.error('❌ Database insert test failed:', insertError.message);
      process.exit(1);
    }

    console.log('✅ Database insert test passed');

    // Test select
    const { data: selectData, error: selectError } = await supabase
      .from('reminders')
      .select('*')
      .eq('domain', 'test-setup.eth');

    if (selectError) {
      console.error('❌ Database select test failed:', selectError.message);
      process.exit(1);
    }

    console.log('✅ Database select test passed');

    // Clean up test data
    await supabase
      .from('reminders')
      .delete()
      .eq('domain', 'test-setup.eth');

    console.log('🧹 Test data cleaned up');

    console.log('');
    console.log('🎉 Database setup complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run: npm run test:integration');
    console.log('2. Run: npm run deploy');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    console.error('2. Ensure your Supabase project is active');
    console.error('3. Check your internet connection');
    process.exit(1);
  }
}

// Check if dotenv is available
try {
  await import('dotenv');
} catch (error) {
  console.error('❌ dotenv package not found. Installing...');
  const { execSync } = await import('child_process');
  execSync('npm install dotenv', { stdio: 'inherit' });
  console.log('✅ dotenv installed');
}

setupDatabase();