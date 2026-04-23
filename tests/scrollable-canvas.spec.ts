import { test, expect, type Page } from "@playwright/test";

function getScrollableCanvas(page: Page) {
  return page.locator('[data-testid="scrollable-canvas"] > div');
}

test.describe("ScrollableCanvas test page", () => {
  test("initial scroll position is at the bottom showing Block 0", async ({ page }) => {
    await page.goto("/test/scrollable-canvas");
    await expect(page.getByText("Block 0", { exact: true })).toBeVisible();
  });

  test("scrolling to the top shows the highest block", async ({ page }) => {
    await page.goto("/test/scrollable-canvas");
    const canvas = getScrollableCanvas(page);
    await canvas.evaluate((el: HTMLElement) => {
      el.scrollTop = 0;
    });
    await expect(page.getByText("Block 124", { exact: true })).toBeVisible();
  });

  test("extending blocks keeps current view stable", async ({ page }) => {
    await page.goto("/test/scrollable-canvas");
    const canvas = getScrollableCanvas(page);

    await canvas.evaluate((el: HTMLElement) => {
      el.scrollTop = 2304;
    });
    await expect(page.getByText("Block 75", { exact: true })).toBeVisible();

    const scrollTopBefore = await canvas.evaluate((el: HTMLElement) => el.scrollTop);

    await page.getByRole("button", { name: "Extend +20 blocks" }).click();

    await expect(page.getByText("Block 75", { exact: true })).toBeVisible();

    const scrollTopAfter = await canvas.evaluate((el: HTMLElement) => el.scrollTop);
    expect(scrollTopAfter).toBeGreaterThan(scrollTopBefore);

    await canvas.evaluate((el: HTMLElement) => {
      el.scrollTop = 0;
    });
    await expect(page.getByText("Block 144", { exact: true })).toBeVisible();
  });

  test("shrinking blocks keeps current view stable", async ({ page }) => {
    await page.goto("/test/scrollable-canvas");
    const canvas = getScrollableCanvas(page);

    await canvas.evaluate((el: HTMLElement) => {
      el.scrollTop = 2304;
    });
    await expect(page.getByText("Block 75", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Shrink -20 blocks" }).click();
    await page.getByRole("button", { name: "Shrink -20 blocks" }).click();

    await expect(page.getByText("Block 75", { exact: true })).toBeVisible();

    await canvas.evaluate((el: HTMLElement) => {
      el.scrollTop = 0;
    });
    await expect(page.getByText("Block 84", { exact: true })).toBeVisible();
    await expect(page.getByText("Block 85", { exact: true })).toHaveCount(0);
  });
});
