# ENS Reminder Bot

An intelligent XMTP bot that sends timely reminders for ENS domain expirations, built with the ElizaOS framework.

## 🎯 Overview

The ENS Reminder Bot helps ENS domain owners avoid losing their domains by sending automated reminders via XMTP messages. The bot monitors domain expiry dates and sends notifications at 30, 7, and 1 day intervals before expiration.

### Key Features

- 📅 **Automated Reminders** - Sends notifications at 30, 7, and 1 day intervals
- 💬 **XMTP Integration** - Direct messaging to wallet addresses
- 🔍 **Real-time ENS Lookup** - Fetches live expiry data from Ethereum
- 🗄️ **Persistent Storage** - Tracks reminders and delivery status
- 🤖 **Natural Language** - Conversational interface for setting up reminders
- ⏰ **Daily Processing** - Automated cron job checks for pending reminders
- 🧪 **Mock Services** - Complete testing framework without real credentials

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Ethereum RPC endpoint (Alchemy/Infura)
- Supabase project
- XMTP-compatible wallet for the bot

### Installation

```bash
# Clone and navigate to the project
cd ens-service/agents/ens-reminder-bot

# Install dependencies
npm install

# Set up environment
npm run setup-env

# Edit .env.local with your credentials
nano .env.local

# Set up database
npm run setup-database

# Run tests
npm run test:mocks

# Deploy to production
npm run deploy
```

## 🛠️ Configuration

### Environment Variables

Create `.env.local` with the following configuration:

```bash
# Ethereum Configuration
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_ALCHEMY_KEY

# Supabase Configuration  
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# XMTP Configuration
XMTP_PRIVATE_KEY=your_bot_wallet_private_key
XMTP_ENVIRONMENT=production

# Bot Configuration
REMINDER_INTERVALS=30,7,1
MOCK_MODE=false
```

### Database Schema

The bot uses 3 Supabase tables:

```sql
-- Stores user reminder preferences
CREATE TABLE reminders (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  reminders_sent JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tracks sent reminders to avoid duplicates
CREATE TABLE sent_reminders (
  id SERIAL PRIMARY KEY,
  reminder_id INTEGER REFERENCES reminders(id),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reminder_type TEXT CHECK (reminder_type IN ('day_30', 'day_7', 'day_1')),
  message_id TEXT
);

-- Stores XMTP conversation history
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  conversation_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE
);
```

## 💬 Usage

### User Commands

Users can interact with the bot via XMTP messages:

**Set a Reminder:**
```
"remind me about vitalik.eth"
"set reminder for mydomain.eth"
"track ethereum.eth"
```

**List Reminders:**
```
"list my reminders"
"show my domains"
"my reminders"
```

**Check Domain Status:**
```
"when does vitalik.eth expire?"
"check ethereum.eth"
"expiry date for mydomain.eth"
```

### Bot Responses

The bot provides detailed, contextual responses:

```
✅ Reminder set for "vitalik.eth"!

📅 Expires: March 15, 2025 (245 days from now)

I'll send you notifications at 30, 7, and 1 day intervals before expiration.
```

## 🏗️ Architecture

### Core Components

- **ENS Plugin** (`src/plugins/ens-reminder-plugin.ts`) - Main bot logic with 3 actions
- **ENS Service** - Ethereum integration for domain lookups
- **Mock Services** - Testing framework (XMTP, Cron, Database)
- **Reminder Service** - Orchestrates the complete reminder workflow
- **Database Client** - Supabase integration with fallback to mocks

### Plugin Actions

1. **SET_REMINDER** - Validates domains and stores reminder preferences
2. **LIST_REMINDERS** - Shows user's active reminders with status
3. **CHECK_EXPIRY** - Provides domain expiry information

### Reminder Workflow

1. **Daily Cron Job** - Runs at 9 AM UTC via Supabase cron
2. **Query Processing** - Finds domains expiring in 30/7/1 days
3. **XMTP Delivery** - Sends personalized reminder messages
4. **Status Tracking** - Records sent reminders to prevent duplicates

## 🧪 Testing

### Mock Services

The bot includes comprehensive mock services for testing:

```bash
# Test mock services
npm run test:mocks

# Run specific test suites
npm run test:unit
npm run test:integration
```

### Test Coverage

- ✅ ENS domain validation and lookup
- ✅ Reminder storage and retrieval  
- ✅ Message delivery simulation
- ✅ Cron job triggering
- ✅ Error handling and edge cases
- ✅ Multi-user scenarios
- ✅ Complete user journeys

See [TESTING.md](./TESTING.md) for detailed testing guide.

## 🚢 Deployment

### Automated Deployment

```bash
# Deploy to Supabase Edge Functions
npm run deploy

# Deploy to testnet environment
npm run deploy:test
```

### Manual Steps

1. **Run SQL Setup** - Execute `setup-cron.sql` in Supabase SQL Editor
2. **Test Health Check** - Verify function deployment
3. **Monitor Logs** - Check Supabase function logs
4. **Enable Cron** - Ensure pg_cron extension is enabled

### Production URLs

```
Health Check: https://PROJECT_ID.supabase.co/functions/v1/ens-reminder-bot/health
Process Reminders: https://PROJECT_ID.supabase.co/functions/v1/ens-reminder-bot/process-reminders
```

## 📊 Monitoring

### Supabase Dashboard

Monitor your deployment via:
- **Edge Functions** - View function metrics and logs
- **Database** - Query reminder and message statistics  
- **SQL Editor** - Run custom analytics queries

### Key Metrics

- Active reminders count
- Daily messages sent
- Error rates and types
- User engagement statistics

## 🔧 Development

### Local Development

```bash
# Start in development mode
npm run dev

# Run with mock services
MOCK_MODE=true npm run dev

# Watch for changes
npm run test:watch
```

### Project Structure

```
src/
├── plugins/
│   └── ens-reminder-plugin.ts    # Main bot logic
├── services/
│   ├── mock-xmtp.ts             # XMTP simulation
│   ├── mock-cron.ts             # Cron simulation  
│   ├── mock-database.ts         # Database simulation
│   └── reminder-service.ts      # Core service orchestration
├── test/
│   ├── test-utils.ts            # Testing utilities
│   ├── ens-plugin.test.ts       # Plugin tests
│   ├── mock-services.test.ts    # Mock service tests
│   └── integration.test.ts      # End-to-end tests
└── test-mocks.ts                # Simple test runner
```

## 🤝 Contributing

### Adding Features

1. **Create Tests First** - Use TDD approach
2. **Use Mock Services** - Test without real credentials
3. **Follow Patterns** - Match existing ElizaOS plugin structure
4. **Update Documentation** - Keep README and TESTING.md current

### Code Style

- TypeScript with strict mode
- ESLint configuration
- Clear logging with service prefixes
- Comprehensive error handling

## 🔒 Security

### Best Practices

- **Private Key Management** - Never commit keys to version control
- **Environment Variables** - Use `.env.local` for secrets
- **Wallet Security** - Use dedicated wallet for bot operations
- **Rate Limiting** - Built-in protection against spam
- **Input Validation** - All user inputs are validated

### Threat Model

- Bot wallet compromise → Rotate private key
- Database breach → Minimal PII stored (only wallet addresses)
- XMTP spam → Rate limiting and user blocking features

## 📋 Roadmap

### Current (MVP)
- ✅ Basic reminder functionality
- ✅ XMTP messaging
- ✅ Supabase storage
- ✅ Mock testing framework

### Next Phase
- 🔄 Advanced reminder customization
- 🔄 Bulk domain management
- 🔄 Analytics dashboard
- 🔄 Multi-chain support (L2s)

### Future Features
- 📱 Mobile app integration
- 🌐 Web interface
- 📊 Portfolio tracking
- 🤖 AI-powered insights

## 🆘 Support

### Common Issues

**"Database configuration is missing"**
- Check `.env.local` has correct Supabase credentials
- Run `npm run setup-env` to regenerate template

**"ENS domain not found"**
- Verify domain is registered on Ethereum mainnet
- Check Ethereum RPC endpoint is working

**"XMTP connection failed"**
- Ensure bot wallet has XMTP enabled
- Check wallet has small ETH balance for gas

### Getting Help

- 📖 Check [TESTING.md](./TESTING.md) for testing issues
- 🐛 Open GitHub issue for bugs
- 💬 Join Discord for community support
- 📧 Email support for urgent issues

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **ElizaOS Framework** - For the agent architecture
- **XMTP Protocol** - For decentralized messaging
- **ENS** - For decentralized naming
- **Supabase** - For backend infrastructure
- **Ethereum** - For the underlying blockchain

---

Built with ❤️ by the ENS community. Help users keep their domains safe!