# ENS Reminder Service - Demo

This is a demo interface for the ENS Reminder Service bot. It simulates the XMTP messaging experience without requiring any wallet connection or API keys.

## Demo Features

- 🤖 Interactive chat interface with the ENS bot
- 📊 Check ENS domain expiry dates (mock data)
- ⏰ Set and manage reminders
- 📋 View active reminders
- 💾 All data stored locally in browser

## Try It Out

Visit the live demo: https://0xdesign.github.io/ens-reminder-service/

## Sample Commands

- `check vitalik.eth` - Check domain expiry date
- `set reminder for demo.eth` - Create a reminder
- `list my reminders` - View all active reminders
- `help` - Get list of available commands

## Mock Domains

The demo includes several pre-configured domains:
- vitalik.eth (expires 2045)
- demo.eth (expires Dec 2024)
- example.eth (expires Mar 2025)
- test.eth (expires Nov 2024)

## Local Development

To run the demo locally:

```bash
# Clone the repository
git clone https://github.com/0xdesign/ens-reminder-service.git
cd ens-reminder-service/demo

# Open in browser
open index.html
# or use a local server
python -m http.server 8000
```

## Production Bot

The actual ENS Reminder Service is an ElizaOS-based XMTP bot that:
- Connects via XMTP for real messaging
- Queries actual ENS domain data
- Sends real-time notifications
- Stores data in Supabase

See the main [README](../README.md) for production deployment instructions.