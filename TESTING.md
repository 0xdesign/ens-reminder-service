# ENS Reminder Bot - Testing Guide

This guide explains how to test the ENS reminder bot using the mock services for development and testing.

## Overview

The ENS reminder bot includes comprehensive mock services that simulate:
- **XMTP messaging** - Send and receive messages without real XMTP credentials
- **Cron scheduling** - Trigger jobs immediately for testing
- **Supabase database** - In-memory database operations

## Quick Start

```bash
# Install dependencies
npm install

# Run mock service tests
npm run test:mocks

# Run full test suite (when Jest is configured)
npm test
```

## Mock Services

### 1. Mock XMTP Service

Located in `src/services/mock-xmtp.ts`

**Features:**
- Simulates XMTP client connection/disconnection
- Tracks sent messages and conversations
- Provides message verification methods
- No real XMTP credentials required

**Usage Example:**
```typescript
import { mockXMTPService } from './services/mock-xmtp';

// Connect and send a message
await mockXMTPService.connect();
await mockXMTPService.sendMessage('0x123...', 'Your domain expires soon!');

// Verify message was sent
const wasSent = mockXMTPService.wasMessageSentTo('0x123...');
console.log('Message sent:', wasSent);
```

### 2. Mock Cron Service

Located in `src/services/mock-cron.ts`

**Features:**
- Schedule jobs with cron expressions
- Trigger jobs immediately for testing
- Track job execution statistics
- No waiting for real cron schedules

**Usage Example:**
```typescript
import { mockCronService } from './services/mock-cron';

// Schedule a job
mockCronService.schedule('daily-reminders', '0 9 * * *', async () => {
  console.log('Processing reminders...');
});

// Trigger immediately for testing
await mockCronService.triggerJob('daily-reminders');
```

### 3. Mock Database Service

Located in `src/services/mock-database.ts`

**Features:**
- In-memory storage for all 3 tables (reminders, sent_reminders, conversations)
- Supabase-compatible API interface
- Query building with filters
- No real database connection required

**Usage Example:**
```typescript
import { mockDatabaseService } from './services/mock-database';

// Insert a reminder
const result = mockDatabaseService.from('reminders').insert({
  domain: 'vitalik.eth',
  wallet_address: '0x123...',
  expiry_date: new Date().toISOString(),
  reminders_sent: JSON.stringify([])
});

// Query reminders
const query = mockDatabaseService.from('reminders').select();
query.eq('wallet_address', '0x123...').then((result) => {
  console.log('Reminders:', result.data);
});
```

## Test Structure

### Unit Tests

Test individual components and services:

```bash
# Run unit tests only
npm run test:unit
```

### Integration Tests

Test complete user workflows:

```bash
# Run integration tests
npm run test:integration
```

### Mock Service Tests

Test the mock services themselves:

```bash
# Run mock service verification
npm run test:mocks
```

## Test Scenarios Covered

### 1. ENS Plugin Actions

- **SET_REMINDER**: Setting reminders for ENS domains
- **LIST_REMINDERS**: Listing user's active reminders  
- **CHECK_EXPIRY**: Checking domain expiry dates

### 2. Error Handling

- Invalid domain formats
- Non-existent domains
- Database connection errors
- Network failures
- Missing configuration

### 3. User Journeys

- First-time user setting up reminders
- Power user managing multiple domains
- Reminder delivery workflow
- Error recovery scenarios
- Multi-user scenarios

### 4. Performance

- Rapid message processing
- Large reminder lists
- Concurrent operations

## Running Tests

### Simple Mock Tests (Recommended)

```bash
npm run test:mocks
```

This runs a simple test suite without Jest configuration issues.

### Full Test Suite

```bash
npm test
```

Note: Jest configuration may need adjustment for ES modules.

### Individual Test Files

```bash
# Test specific functionality
npx tsx src/test-mocks.ts
```

## Mock Data

The mock database comes pre-seeded with test data:

- `test.eth` - Domain expiring in 7 days
- Associated with wallet `0xtest123`

You can reset mock data anytime:

```typescript
mockDatabaseService.reset();
mockXMTPService.reset();
mockCronService.reset();
```

## Configuration

Set mock mode in your runtime:

```typescript
const runtime = createTestRuntime();
runtime.setSetting("MOCK_MODE", "true");
runtime.setSetting("SUPABASE_URL", "mock://localhost");
```

## Debugging

All mock services include extensive logging:

```
[MockXMTP] Connected to mock XMTP network
[MockCron] Executing job 'daily-reminders' (run #1)
[MockDB] SELECT from reminders: found 2 records
```

Filter logs by service prefix to focus on specific components.

## Best Practices

1. **Reset services** before each test to ensure clean state
2. **Use test wallets** like `TEST_WALLETS.USER1` from test-utils
3. **Verify operations** with mock service methods like `wasMessageSentTo()`
4. **Test error cases** by manipulating mock service state
5. **Use async/await** for proper test sequencing

## Troubleshooting

### Common Issues

**Jest ES Module Errors**
- Use `npm run test:mocks` instead of `npm test`
- Or configure Jest for ES modules properly

**Test Timeouts**
- Increase timeout in test files
- Ensure async operations are properly awaited

**Mock Services Not Reset**
- Call `resetAllServices()` in test setup
- Check that services are properly initialized

**Database Query Issues**
- Remember mock database uses `.then()` callbacks
- Ensure proper promise handling in tests

## Contributing

When adding new tests:

1. Use the existing test utilities in `src/test/test-utils.ts`
2. Follow the naming convention: `describe()` blocks for features
3. Include both positive and negative test cases
4. Test error conditions and edge cases
5. Update this documentation if adding new mock features

## Example Test

```typescript
test("should handle complete reminder workflow", async () => {
  // Setup
  resetAllServices();
  await initializeTestServices();
  
  // Test setting a reminder
  const message = createTestMessage(TEST_WALLETS.USER1, "remind me about vitalik.eth");
  await setReminderAction.handler(runtime, message, undefined, undefined, callback.call.bind(callback));
  
  // Verify reminder was stored
  expectCallbackToContain(callback, "Reminder set");
  
  // Test reminder delivery
  await mockCronService.triggerJob("daily-reminders");
  
  // Verify message was sent
  expect(mockXMTPService.wasMessageSentTo(TEST_WALLETS.USER1)).toBe(true);
});
```

This testing framework ensures the ENS reminder bot works correctly before deployment with real services.