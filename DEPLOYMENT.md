# ENS Reminder Service - Deployment Guide

## Prerequisites

- Node.js 18+
- Supabase account
- XMTP account/wallet
- Alchemy or Infura API key

## Deployment Options

### Option 1: Deploy to Railway (Recommended)

1. **Connect GitHub Repository**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Initialize project
   railway init
   ```

2. **Set Environment Variables in Railway Dashboard**
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   XMTP_ENV=production
   XMTP_PRIVATE_KEY=your_bot_wallet_private_key
   ETHEREUM_RPC_URL=your_alchemy_or_infura_url
   ```

3. **Deploy**
   ```bash
   railway up
   ```

### Option 2: Deploy to Supabase Edge Functions

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Login and Link Project**
   ```bash
   supabase login
   supabase link --project-ref your-project-ref
   ```

3. **Deploy Function**
   ```bash
   supabase functions deploy ens-reminder-bot
   ```

### Option 3: Deploy to AWS Lambda

1. **Build for Lambda**
   ```bash
   npm run build
   npm run package:lambda
   ```

2. **Deploy using AWS CLI**
   ```bash
   aws lambda create-function \
     --function-name ens-reminder-bot \
     --runtime nodejs18.x \
     --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-role \
     --handler dist/index.handler \
     --zip-file fileb://ens-bot.zip
   ```

3. **Set Environment Variables**
   ```bash
   aws lambda update-function-configuration \
     --function-name ens-reminder-bot \
     --environment Variables="{SUPABASE_URL=...,SUPABASE_ANON_KEY=...}"
   ```

## Database Setup

1. **Run Database Migration**
   ```bash
   npm run setup:database
   ```

2. **Verify Tables Created**
   - reminders
   - sent_reminders
   - conversations

## Testing Deployment

1. **Check Bot Status**
   ```bash
   curl https://your-deployment-url/health
   ```

2. **Send Test Message**
   - Use XMTP client to message your bot
   - Send "track vitalik.eth" as a test

## Monitoring

- Check Railway/Supabase/AWS logs for errors
- Monitor Supabase database for reminder records
- Set up alerts for function failures

## Staging URL

After deployment, your staging URL will be:
- Railway: `https://ens-reminder-bot-production.up.railway.app`
- Supabase: `https://YOUR_PROJECT.supabase.co/functions/v1/ens-reminder-bot`
- AWS: `https://YOUR_API_GATEWAY_URL/prod/ens-reminder-bot`