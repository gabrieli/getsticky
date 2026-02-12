# Integration Tests

These tests verify the complete GetSticky system working end-to-end.

## Requirements

Integration tests require:
- ✅ Backend server running (`cd server && npm run dev`)
- ✅ ANTHROPIC_API_KEY configured in backend environment
- ✅ Network connection for Claude API calls
- ✅ WebSocket connection to ws://localhost:8080

## Running Integration Tests

### Run all integration tests:
```bash
npm run test:integration
```

### Run specific integration test:
```bash
npm test -- src/__tests__/integration/websocket-flow.test.ts
```

### Run with watch mode:
```bash
npm test -- src/__tests__/integration/
```

## Test Files

### `websocket-flow.test.ts`
Tests the complete WebSocket communication flow:
- ✅ WebSocket connection establishment
- ✅ Send ask_claude event
- ✅ Receive claude_response
- ✅ Verify AgentNode structure
- ✅ Verify edge creation
- ✅ Error handling (invalid messages, missing fields)
- ✅ Multiple sequential questions

**Note:** Makes real Claude API calls. Each test may take 10-30 seconds.

### `full-flow.test.tsx`
Tests the complete UI flow (coming soon):
- User interaction with RichTextNode
- Button clicks and form submission
- AgentNode rendering
- Loading states
- Error handling in UI

## Integration Test Workflow

1. **Start Backend**
   ```bash
   cd /Users/gabrielionescu/projects/getsticky/server
   npm run dev
   ```

2. **Verify Backend Running**
   - Check terminal shows "WebSocket server listening on ws://localhost:8080"
   - Check ANTHROPIC_API_KEY is set

3. **Run Integration Tests**
   ```bash
   cd /Users/gabrielionescu/projects/getsticky/getsticky-app
   npm run test:integration
   ```

4. **Review Results**
   - All tests should pass
   - Check for any timeout errors (may indicate backend not running)
   - Check for API errors (may indicate invalid ANTHROPIC_API_KEY)

## Test Structure

Integration tests follow this pattern:

```typescript
describe('Feature Integration', () => {
  test('should complete full flow', async () => {
    // 1. Setup - Connect to real services
    const ws = new WebSocket('ws://localhost:8080');
    await waitForConnection(ws);

    // 2. Act - Perform real operations
    ws.send(JSON.stringify({ type: 'ask_claude', data: {...} }));

    // 3. Assert - Verify real responses
    const response = await waitForMessage(ws, 'claude_response');
    expect(response.data.node).toBeDefined();

    // 4. Cleanup
    ws.close();
  });
});
```

## Debugging Integration Tests

### Test times out
- **Check:** Is backend server running?
- **Check:** Is WebSocket port 8080 open?
- **Check:** Any firewall blocking localhost connections?

### Test fails with API error
- **Check:** Is ANTHROPIC_API_KEY set in backend?
- **Check:** Is the API key valid?
- **Check:** Check backend terminal for error messages

### Test fails with connection error
- **Check:** Backend server logs for errors
- **Check:** WebSocket URL is correct (ws://localhost:8080)
- **Check:** No other service using port 8080

### Response format unexpected
- **Check:** Backend code matches expected message format
- **Check:** Frontend and backend are in sync
- **Check:** Console.log the actual response to debug

## CI/CD Considerations

**⚠️ Important:** Integration tests should NOT run in CI by default because:
- They require ANTHROPIC_API_KEY (security risk in CI)
- They make real API calls (costs money)
- They require backend server running (complex CI setup)

**Recommendation:**
- Run unit tests in CI automatically
- Run integration tests manually before releases
- Use mocked integration tests in CI (coming soon)

## Next Steps

Once these integration tests pass:
1. Run confidence check to update scores
2. Document test results in INTEGRATION-TEST-GUIDE.md
3. Create automated UI integration tests
4. Add more edge case scenarios
5. Consider adding mocked versions for CI

## Resources

- Main testing guide: `/Users/gabrielionescu/projects/getsticky/getsticky-app/TESTING.md`
- Integration test guide: `/Users/gabrielionescu/projects/getsticky/INTEGRATION-TEST-GUIDE.md`
- Backend server: `/Users/gabrielionescu/projects/getsticky/server/`
