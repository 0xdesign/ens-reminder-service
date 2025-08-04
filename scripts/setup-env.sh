#!/bin/bash

# ENS Reminder Bot - Environment Setup Script
# This script helps set up the environment variables needed for deployment

set -e

echo "🔧 ENS Reminder Bot - Environment Setup"
echo "======================================"

# Check if .env.local already exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists. Backing up to .env.local.backup"
    cp .env.local .env.local.backup
fi

# Create .env.local file
echo "📝 Creating .env.local file..."

cat > .env.local << EOF
# ENS Reminder Bot Environment Configuration
# =========================================

# Ethereum Configuration
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_KEY_HERE

# Supabase Configuration
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE

# XMTP Configuration
XMTP_PRIVATE_KEY=YOUR_BOT_WALLET_PRIVATE_KEY_HERE
XMTP_ENVIRONMENT=production

# Bot Configuration
BOT_NAME=ENS Reminder Bot
BOT_DESCRIPTION=XMTP bot for ENS domain expiry reminders
REMINDER_INTERVALS=30,7,1

# Mock Mode (set to "true" for testing)
MOCK_MODE=false

# Deployment Configuration
DEPLOY_ENVIRONMENT=testnet
SUPABASE_PROJECT_ID=YOUR_PROJECT_ID
EOF

echo "✅ .env.local file created!"
echo ""

echo "🔑 Required Configuration:"
echo "========================="
echo "Please update the following values in .env.local:"
echo ""
echo "1. ETHEREUM_RPC_URL - Get from Alchemy or Infura"
echo "   - Sign up at https://alchemy.com/"
echo "   - Create a new app for Ethereum Mainnet"
echo "   - Copy the HTTP URL"
echo ""
echo "2. Supabase Configuration - Get from Supabase Dashboard"
echo "   - Sign up at https://supabase.com/"
echo "   - Create a new project"
echo "   - Go to Settings > API"
echo "   - Copy Project URL and anon public key"
echo "   - Copy service_role secret key (for server operations)"
echo ""
echo "3. XMTP_PRIVATE_KEY - Bot wallet private key"
echo "   - Create a new wallet for the bot"
echo "   - Export the private key (keep this secure!)"
echo "   - This wallet will send reminder messages"
echo ""
echo "4. SUPABASE_PROJECT_ID - Your Supabase project ID"
echo "   - Found in your Supabase project URL"
echo ""

echo "🚀 Next Steps:"
echo "=============="
echo "1. Edit .env.local with your actual values"
echo "2. Run: npm run setup-database"
echo "3. Run: npm run test:integration"
echo "4. Run: npm run deploy"
echo ""

echo "⚠️  Security Note:"
echo "=================="
echo "Never commit .env.local to version control!"
echo "Keep your private keys and API keys secure!"
echo ""

echo "✅ Environment setup complete!"