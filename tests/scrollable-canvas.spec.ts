import { test, expect, type Page } from "@playwright/test";

function getScrollableCanvas(page: Page) {
  return page.locator('[data-testid="scrollable-canvas-root"]');
}

function getVisibleBlocks(page: Page) {
  return page.locator('[data-testid="test-block"]');
}

test.describe("ScrollableCanvas test page", () => {
  test("initial scroll position is at the bottom showing Block 0", async ({ page }) => {
    await page.goto("/test/scrollable-canvas");
    await expect(page.locator('[data-testid="test-block"][data-index="0"]')).toBeVisible();
  });

  test("scrolling to the top shows the highest block", async ({ page }) => {
    await page.goto("/test/scrollable-canvas");
    const canvas = getScrollableCanvas(page);
    await canvas.evaluate((el: HTMLElement) => {
      el.scrollTop = 0;
    });
    await expect(page.locator('[data-testid="test-block"][data-index="124"]')).toBeVisible();
  });

  test("extending blocks keeps current view stable", async ({ page }) => {
    await page.goto("/test/scrollable-canvas");
    const canvas = getScrollableCanvas(page);

    await canvas.evaluate((el: HTMLElement) => {
      el.scrollTop = 2304;
    });
    await expect(page.locator('[data-testid="test-block"][data-index="75"]')).toBeVisible();

    const scrollTopBefore = await canvas.evaluate((el: HTMLElement) => el.scrollTop);

    await page.getByRole("button", { name: "Extend +20 blocks" }).click();

    await expect(page.locator('[data-testid="test-block"][data-index="75"]')).toBeVisible();

    const scrollTopAfter = await canvas.evaluate((el: HTMLElement) => el.scrollTop);
    expect(scrollTopAfter).toBeGreaterThan(scrollTopBefore);

    await canvas.evaluate((el: HTMLElement) => {
      el.scrollTop = 0;
    });
    await expect(page.locator('[data-testid="test-block"][data-index="144"]')).toBeVisible();
  });

  test("shrinking blocks keeps current view stable", async ({ page }) => {
    await page.goto("/test/scrollable-canvas");
    const canvas = getScrollableCanvas(page);

    await canvas.evaluate((el: HTMLElement) => {
      el.scrollTop = 2304;
    });
    await expect(page.locator('[data-testid="test-block"][data-index="75"]')).toBeVisible();

    await page.getByRole("button", { name: "Shrink -20 blocks" }).click();
    await page.getByRole("button", { name: "Shrink -20 blocks" }).click();

    await expect(page.locator('[data-testid="test-block"][data-index="75"]')).toBeVisible();

    await canvas.evaluate((el: HTMLElement) => {
      el.scrollTop = 0;
    });
    await expect(page.locator('[data-testid="test-block"][data-index="84"]')).toBeVisible();
    await expect(page.locator('[data-testid="test-block"][data-index="85"]')).toHaveCount(0);
  });

  test.skip("resizing viewport increases number of visible blocks", async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 540 });
    await page.goto("/test/scrollable-canvas");

    const countBefore = await getVisibleBlocks(page).count();

    await page.setViewportSize({ width: 1200, height: 800 });
    // Wait for resize to propagate and re-render
    await page.waitForTimeout(100);

    const countAfter = await getVisibleBlocks(page).count();
    expect(countAfter).toBeGreaterThan(countBefore);
  });
});
