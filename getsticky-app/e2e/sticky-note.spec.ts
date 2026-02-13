import { test, expect, type Page } from '@playwright/test';
import { createBoard, deleteBoard } from './helpers/board';

/**
 * Scan the viewport to find a position that lands on the React Flow pane
 * (not on a node, minimap, toolbar, or other overlay).
 */
async function findEmptyPanePosition(page: Page): Promise<{ x: number; y: number }> {
  const viewport = page.viewportSize()!;
  const candidates: { x: number; y: number }[] = [];
  for (let x = 200; x < viewport.width - 50; x += 50) {
    candidates.push({ x, y: 15 });
    candidates.push({ x, y: 30 });
  }
  for (let y = 50; y < viewport.height - 150; y += 50) {
    candidates.push({ x: viewport.width - 30, y });
  }

  for (const pos of candidates) {
    const isPane = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el?.classList.contains('react-flow__pane') ?? false;
    }, pos);
    if (isPane) return pos;
  }
  throw new Error('No empty pane position found — canvas too crowded');
}

/**
 * Place a sticky note by activating the tool, clicking on empty pane space,
 * and waiting for the node to appear. Returns a locator to the new note's
 * contentEditable area.
 */
async function placeStickyNote(page: Page) {
  // Activate tool
  await page.locator('button[title="Sticky Note"]').click();
  await expect(
    page.locator('button[title="Sticky Note (click canvas to place)"]')
  ).toBeVisible();

  // Click on empty pane
  const pos = await findEmptyPanePosition(page);
  await page.mouse.click(pos.x, pos.y);

  // Wait for tool to deactivate (proves onPaneClick fired and node was created)
  await expect(
    page.locator('button[title="Sticky Note"]')
  ).toBeVisible({ timeout: 5_000 });

  // The newest sticky note is the one just created
  // Use a stable locator that works both before and after typing
  const note = page.locator('[data-placeholder="Type here..."]').last();
  await expect(note).toBeVisible({ timeout: 5_000 });
  return note;
}

test.describe('Sticky Note', () => {
  let boardId: string;

  test.beforeEach(async ({ page }) => {
    boardId = await createBoard();
    await page.goto(`/?board=${boardId}`);
    await page.waitForSelector('.react-flow__renderer', { timeout: 10_000 });
    await page.waitForTimeout(500);

    // Zoom out to create empty pane space around any existing nodes
    const zoomOutBtn = page.locator('button[title="Zoom Out"]');
    for (let i = 0; i < 8; i++) {
      await zoomOutBtn.click();
    }
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    await deleteBoard(boardId);
  });

  test('can be placed via click-to-place and typed into', async ({ page }) => {
    // Place a sticky note
    const newNote = await placeStickyNote(page);

    // Click into it and type
    await newNote.click();
    await newNote.pressSequentially('Hello Sticky!', { delay: 30 });

    // Verify the text was entered
    await expect(newNote).toHaveText('Hello Sticky!');

    // Click away to blur, then verify text persists
    const blurPos = await findEmptyPanePosition(page);
    await page.mouse.click(blurPos.x, blurPos.y);
    await expect(newNote).toHaveText('Hello Sticky!');
  });

  test('persists text after typing and refocusing', async ({ page }) => {
    // Place a sticky note
    const newNote = await placeStickyNote(page);

    // Type into it
    await newNote.click();
    await newNote.pressSequentially('Persist me', { delay: 30 });
    await expect(newNote).toHaveText('Persist me');

    // Click away (blur)
    const blurPos = await findEmptyPanePosition(page);
    await page.mouse.click(blurPos.x, blurPos.y);

    // Wait for debounced save (500ms) to complete
    await page.waitForTimeout(800);

    // Click back into the note — text should still be there
    await newNote.click();
    await expect(newNote).toHaveText('Persist me');
  });
});
