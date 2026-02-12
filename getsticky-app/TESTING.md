# GetSticky v3 Testing Guide

## Overview

This project follows **strict Test-Driven Development (TDD)**. All production code must have a failing test written first.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

## Test Framework

- **Framework:** Vitest (optimized for Vite)
- **React Testing:** @testing-library/react
- **DOM Assertions:** @testing-library/jest-dom
- **User Interactions:** @testing-library/user-event

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Structure

```
src/
├── nodes/
│   ├── __tests__/
│   │   ├── AgentNode.test.tsx
│   │   ├── RichTextNode.test.tsx
│   │   ├── DiagramNode.test.tsx
│   │   └── TerminalNode.test.tsx
│   ├── AgentNode.tsx
│   ├── RichTextNode.tsx
│   ├── DiagramNode.tsx
│   └── TerminalNode.tsx
├── database/
│   ├── __tests__/
│   │   ├── sqlite.test.ts
│   │   └── lancedb.test.ts
│   ├── sqlite.ts
│   └── lancedb.ts
├── mcp/
│   ├── __tests__/
│   │   └── server.test.ts
│   └── server.ts
└── test/
    └── setup.ts
```

## TDD Workflow: Red-Green-Refactor

### 1. RED - Write Failing Test

Write one minimal test showing what should happen.

```typescript
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

**Requirements:**
- One behavior per test
- Clear, descriptive name
- Real code (avoid mocks unless necessary)

### 2. Verify RED - Watch It Fail

**MANDATORY. Never skip.**

```bash
npm test path/to/test.test.ts
```

Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not typos)

### 3. GREEN - Minimal Code

Write simplest code to pass the test.

```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
```

Don't add features, refactor other code, or "improve" beyond the test.

### 4. Verify GREEN - Watch It Pass

**MANDATORY.**

```bash
npm test path/to/test.test.ts
```

Confirm:
- Test passes
- Other tests still pass
- Output pristine (no errors, warnings)

### 5. REFACTOR - Clean Up

After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green. Don't add behavior.

### 6. Repeat

Next failing test for next feature.

## Test Categories

### Unit Tests: Components & Functions

Test individual components and functions in isolation.

**Location:** `src/*/__tests__/*.test.{ts,tsx}`

**Example:**
```typescript
describe('AgentNode', () => {
  test('renders user question and agent response', () => {
    render(
      <AgentNode
        data={{
          question: 'What is React Flow?',
          response: 'React Flow is a library for building node-based UIs.',
        }}
      />
    );

    expect(screen.getByText('What is React Flow?')).toBeInTheDocument();
    expect(screen.getByText(/React Flow is a library/)).toBeInTheDocument();
  });
});
```

### Integration Tests: Database Layer

Test database operations with real SQLite/LanceDB instances.

**Location:** `src/database/__tests__/*.test.ts`

**Example:**
```typescript
describe('SQLite Database Layer', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  test('creates a new node', () => {
    const node = db.createNode({
      type: 'conversation',
      content: { question: 'test' },
      context: 'test context',
    });

    expect(node.id).toBeDefined();
    expect(node.type).toBe('conversation');
  });
});
```

### Integration Tests: MCP Server

Test MCP server communication and tool execution.

**Location:** `src/mcp/__tests__/*.test.ts`

**Example:**
```typescript
describe('MCP Server', () => {
  test('creates new node via MCP tool', async () => {
    const result = await server.callTool('create_node', {
      type: 'conversation',
      content: { question: 'test' },
    });

    expect(result.success).toBe(true);
    expect(result.nodeId).toBeDefined();
  });
});
```

## Testing Principles

### 1. Test Behavior, Not Implementation

**Good:**
```typescript
test('displays error when email is invalid', () => {
  render(<LoginForm />);
  userEvent.type(screen.getByLabelText('Email'), 'invalid');
  userEvent.click(screen.getByText('Submit'));

  expect(screen.getByText('Invalid email')).toBeInTheDocument();
});
```

**Bad:**
```typescript
test('calls validateEmail with input value', () => {
  const validateEmail = jest.fn();
  render(<LoginForm validateEmail={validateEmail} />);

  // Testing implementation, not behavior
});
```

### 2. Avoid Over-Mocking

Use real implementations whenever possible. Mock only external dependencies:

**Mock:** API calls, WebSocket connections, file system
**Don't mock:** Internal functions, React components (use real ones)

### 3. Clear Test Names

Test names should describe the behavior being tested.

**Good:**
- `'renders markdown with syntax highlighting'`
- `'creates child node when branching conversation'`
- `'searches contexts by semantic similarity'`

**Bad:**
- `'test1'`
- `'it works'`
- `'renders correctly'`

### 4. One Assertion Per Concept

Focus each test on a single behavior, but multiple assertions are fine if they verify the same concept.

**Good:**
```typescript
test('creates node with timestamp metadata', () => {
  const node = createNode({ type: 'conversation' });

  expect(node.created_at).toBeInstanceOf(Date);
  expect(node.updated_at).toBeInstanceOf(Date);
  expect(node.created_at).toEqual(node.updated_at);
});
```

## Common Pitfalls

### Writing Code Before Tests

**Wrong:**
```typescript
// Step 1: Write the function
function addNumbers(a, b) { return a + b; }

// Step 2: Write tests
test('adds numbers', () => { ... });
```

**Right:**
```typescript
// Step 1: Write failing test
test('adds two numbers', () => {
  expect(addNumbers(2, 3)).toBe(5);
});
// → Test fails: addNumbers is not defined

// Step 2: Write minimal code
function addNumbers(a, b) { return a + b; }
// → Test passes
```

### Test Passes Immediately

If your test passes on first run, you're testing existing behavior. Fix the test.

### Skipping Verification Steps

Always run tests and watch them fail/pass. Never assume.

## Integration with Confident Coding

Test coverage and quality contribute to confidence scores across 6 areas:

1. **Input Validation** - Tests for edge cases, invalid input
2. **Business Logic** - Core functionality tests
3. **Data Integrity** - Database constraints, transactions
4. **External Services** - MCP, WebSocket, Claude Code integration
5. **Data Flow** - Context inheritance, node relationships
6. **End-to-End** - Full user workflows

See `.claude/skills/confident-coding/` for detailed confidence tracking.

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/react)
- [TDD Skill](@test-driven-development)
- [Confident Coding](.claude/skills/confident-coding/SKILL.md)

## Checklist Before Marking Work Complete

- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, warnings)
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered

Can't check all boxes? You skipped TDD. Start over.
