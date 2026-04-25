import { test, expect } from "@playwright/test";

test.describe("Project view timeline", () => {
  test("renders BPM change markers", async ({ page }) => {
    await page.goto("/projects/__demo__");
    await expect(page.locator('[data-testid="bpm-change-marker"]:has-text("128")')).toBeVisible();
    await expect(page.locator('[data-testid="bpm-change-marker"]:has-text("160")')).toBeVisible();
  });

  test("renders time signature markers", async ({ page }) => {
    await page.goto("/projects/__demo__");
    await expect(page.locator('[data-testid="time-sig-marker"]:has-text("4/4")')).toBeVisible();
  });
});

test.describe("Command palette", () => {
  test("smoke: open, search, execute zoom in", async ({ page }) => {
    await page.goto("/projects/__demo__");
    await page.waitForLoadState("networkidle");

    // Default zoom is 100%
    await expect(page.locator("text=100%").first()).toBeVisible();

    // Open palette with Ctrl/Cmd+K
    await page.keyboard.press("ControlOrMeta+k");
    const input = page.locator('[placeholder="Type a command..."]');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    // Type "zoom" — should see Zoom In and Zoom Out
    await input.fill("zoom");
    await expect(page.locator("text=Zoom In")).toBeVisible();
    await expect(page.locator("text=Zoom Out")).toBeVisible();

    // Refine to "zoom in" — should still show Zoom In
    await input.fill("zoom in");
    await expect(page.locator("text=Zoom In")).toBeVisible();

    // Execute via Enter — zoom changes to 125%
    await page.keyboard.press("Enter");
    await expect(input).not.toBeVisible();
    await expect(page.locator("text=125%").first()).toBeVisible();
  });
});
