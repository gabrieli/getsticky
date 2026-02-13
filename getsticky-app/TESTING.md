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

---

## MCP-Based Automated Test Suites

All automated testing below uses the GetSticky MCP tools directly. The MCP server shares the same SQLite database as the WebSocket server — tests via MCP exercise data persistence, node lifecycle, layout correctness, and the type system.

### Suite 1: Sticky Note CRUD

1. `create_node` type=`stickyNote`, content=`{ "text": "Test note", "color": "yellow", "position": { "x": 100, "y": 100 } }`
2. `get_node` → verify text="Test note", color="yellow"
3. `update_node` → change color to "purple"
4. `get_node` → verify color="purple"
5. `update_node` → change text to "Updated note"
6. `get_node` → verify text="Updated note"
7. `delete_node` → confirm deleted
8. `get_node` → confirm returns "not found"

### Suite 2: Sticky Note Color Variants

1. Create 11 sticky notes, one per color key: yellow, blue, purple, pink, green, teal, orange, rose, lavender, sage, peach
2. `get_all_nodes` type=`stickyNote` → verify count = 11
3. `get_canvas_layout` → verify all 11 nodes appear with correct positions
4. Cleanup: delete all 11

### Suite 3: Copy/Paste Data Model (Stacked Positioning)

1. `create_node` sticky note at position (200, 200)
2. Create 4 "pasted" copies with offsets: (225, 225), (250, 250), (275, 275), (300, 300)
3. `get_canvas_layout` → verify 5 nodes exist
4. Verify overlaps are detected (expected — stacked notes overlap)
5. Verify each node's position is offset by exactly 25px from the previous
6. Cleanup

### Suite 4: Mixed Node Types

1. Create nodes of each type: stickyNote, richtext, diagram, diagramBox, conversation, terminal
2. `get_all_nodes` → verify total count
3. `get_all_nodes` type=`stickyNote` → verify only sticky notes returned
4. `get_stats` → verify counts match
5. `export_graph` → verify all nodes present in export
6. Cleanup

### Suite 5: Position and Layout

1. Create 3 sticky notes at non-overlapping positions
2. `get_canvas_layout` → verify `overlaps: "none"`
3. `move_node` to create an overlap
4. `get_canvas_layout` → verify overlap detected
5. `arrange_nodes` → verify nodes rearranged to non-overlapping positions
6. Cleanup

### Suite 6: Edge Connections with Sticky Notes

1. Create 2 sticky notes
2. `create_edge` between them
3. `export_graph` → verify edge exists
4. Delete one note → verify edge is cascade-cleaned
5. Cleanup

### What MCP Cannot Test (Manual Verification Only)

These are pure client-side interactions that require visual verification:

- **Drag selection box** rendering and visual behavior
- **Click-to-place** cursor change and click interaction
- **Keyboard shortcuts** (Cmd+C/V) firing in the browser
- **Contextual menu** appearing/disappearing in toolbar
- **ContentEditable** text editing within sticky notes
- **Folded corner** CSS visual effect

### Manual Verification Checklist

1. **Selection box**: Left-drag on empty canvas creates blue selection rectangle. Nodes inside are selected. Middle-click/right-click drag pans.
2. **Sticky notes**: Click sticky note tool → click canvas → yellow sticky appears → type text → text persists on refresh.
3. **Click-to-place**: Click any tool → cursor changes to crosshair → click on canvas → node appears there → tool deselects.
4. **Copy/paste**: Select nodes → Cmd+C → Cmd+V → copies appear offset by 25px diagonally. Multiple Cmd+V creates a visible stack.
5. **Contextual menu**: Select a sticky note → toolbar shows color palette → click a color → sticky note changes color. Works for multi-selection too.
6. **End-to-end**: Create multiple sticky notes with different colors → select all with drag box → Cmd+C → Cmd+V → pasted copies retain colors and stack visually.
