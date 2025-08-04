-- ENS Service Database Schema
-- This file contains the SQL schema for the 3 required tables

-- Table 1: reminders - Stores ENS domain reminders
CREATE TABLE IF NOT EXISTS reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL, -- Ethereum address
    expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reminders_sent JSONB DEFAULT '[]'::jsonb, -- Array of reminder types sent (30, 7, 1)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 2: sent_reminders - Log of sent reminder messages  
CREATE TABLE IF NOT EXISTS sent_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reminder_id UUID REFERENCES reminders(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    reminder_type VARCHAR(20) NOT NULL, -- '30 day', '7 day', '1 day'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table 3: conversations - XMTP conversation tracking
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    conversation_id VARCHAR(255) NOT NULL, -- XMTP conversation ID
    peer_address VARCHAR(42) NOT NULL, -- Other party's wallet address
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reminders_wallet_address ON reminders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_reminders_expiry_date ON reminders(expiry_date);
CREATE INDEX IF NOT EXISTS idx_reminders_domain ON reminders(domain);
CREATE INDEX IF NOT EXISTS idx_reminders_wallet_domain ON reminders(wallet_address, domain);

CREATE INDEX IF NOT EXISTS idx_sent_reminders_reminder_id ON sent_reminders(reminder_id);
CREATE INDEX IF NOT EXISTS idx_sent_reminders_wallet_address ON sent_reminders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_sent_reminders_sent_at ON sent_reminders(sent_at);

CREATE INDEX IF NOT EXISTS idx_conversations_wallet_address ON conversations(wallet_address);
CREATE INDEX IF NOT EXISTS idx_conversations_conversation_id ON conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_active ON conversations(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only access their own reminders
CREATE POLICY reminders_user_policy ON reminders
    FOR ALL USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Users can only access their own sent reminders
CREATE POLICY sent_reminders_user_policy ON sent_reminders
    FOR ALL USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Users can only access their own conversations
CREATE POLICY conversations_user_policy ON conversations
    FOR ALL USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

-- Trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_reminders_updated_at
    BEFORE UPDATE ON reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();