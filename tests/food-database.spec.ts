import { test, expect } from "@playwright/test";

const MENTEE_EMAIL = "test@example.com";
const MENTEE_PASSWORD = "testpassword123";
const COACH_EMAIL = "coach@example.com";
const COACH_PASSWORD = "coachpassword123";

async function loginAsMentee(page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', MENTEE_EMAIL);
  await page.fill('input[name="password"]', MENTEE_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
}

async function loginAsCoach(page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', COACH_EMAIL);
  await page.fill('input[name="password"]', COACH_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
}

test.describe("Apex Reps E2E - Food Database & Selector", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("Coach can search food items via autocomplete", async ({ page }) => {
    await loginAsCoach(page);
    await page.goto("/coach/diet-plans/new");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000); // wait for hydration

    // Find the food selector component
    const searchInput = page.locator('input[type="search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type search query
    await searchInput.fill("chicken");
    await page.waitForTimeout(500); // debounce

    // Check dropdown appears with results
    const dropdown = page.locator('[role="listbox"]').first();
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Check for chicken results
    await expect(dropdown.locator("text=Chicken breast")).toBeVisible();
    await expect(dropdown.locator("text=Chicken thigh")).toBeVisible();
  });

  test("Coach can select food and see macro preview", async ({ page }) => {
    await loginAsCoach(page);
    await page.goto("/coach/diet-plans/new");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const searchInput = page.locator('input[type="search"]').first();
    await searchInput.fill("chicken");
    await page.waitForTimeout(500);

    // Click on first result
    const dropdown = page.locator('[role="listbox"]').first();
    await dropdown.locator("role=option").first().click();
    await page.waitForTimeout(200);

    // Check macro preview appears
    await expect(page.locator("text=Cal")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Protein")).toBeVisible();
    await expect(page.locator("text=Carbs")).toBeVisible();
    await expect(page.locator("text=Fat")).toBeVisible();
    await expect(page.locator("text=Fiber")).toBeVisible();
  });

  test("Coach can add custom food", async ({ page }) => {
    await loginAsCoach(page);
    await page.goto("/coach/diet-plans/new");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Click Add Custom Food button
    await page.click('button:has-text("Add Custom Food")');

    // Wait for modal
    await expect(page.locator("text=Add Custom Food")).toBeVisible({
      timeout: 5000,
    });

    // Fill form
    await page.fill("#name", "Test Custom Food");
    await page.fill("#calories", "200");
    await page.fill("#protein", "20");
    await page.fill("#carbs", "10");
    await page.fill("#fat", "5");
    await page.fill("#fiber", "2");

    // Submit
    await page.click('button:has-text("Save Food")');

    // Wait for modal to close
    await expect(page.locator("text=Add Custom Food")).not.toBeVisible({
      timeout: 5000,
    });

    // Search for the custom food
    const searchInput = page.locator('input[type="search"]').first();
    await searchInput.fill("test custom");
    await page.waitForTimeout(500);

    const dropdown = page.locator('[role="listbox"]').first();
    await expect(dropdown.locator("text=Test Custom Food")).toBeVisible();
  });

  test("Mentee cannot access coach pages", async ({ page }) => {
    await loginAsMentee(page);
    await page.goto("/coach/diet-plans/new");
    await page.waitForLoadState("networkidle");
    // Should redirect or show access denied
    await expect(page.locator("text=Create Diet Plan")).not.toBeVisible({
      timeout: 3000,
    });
  });
});

test.describe("Apex Reps E2E - Mentee Diet Plan Tracking", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await loginAsMentee(page);
  });

  test("Mentee can view diet plan page", async ({ page }) => {
    await page.goto("/diet-plan");
    await page.waitForLoadState("networkidle");
    // Check page loads
    await expect(page.locator("text=Diet Plan")).toBeVisible({ timeout: 5000 });
  });
});
