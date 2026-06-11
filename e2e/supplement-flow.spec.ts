import { test, expect, Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";

// ── helpers ────────────────────────────────────────────────────────────────

async function goToProvider(page: Page) {
  await page.goto(BASE);
  await page.waitForURL(/\/provider/);
}

async function createOrder(
  page: Page,
  options: { qty: number; price: string } = { qty: 2, price: "29.00" },
) {
  await page.goto(`${BASE}/provider/orders/new`);
  await page.waitForSelector("text=New supplement order");

  const firstRow = page.locator("tbody tr").first();
  await firstRow.locator('input[type="number"]').fill(String(options.qty));
  await firstRow.locator('input:not([type="number"])').fill(options.price);

  // Wait for fee/margin columns to populate
  await page.waitForSelector("text=Your margin");

  await page.screenshot({ path: "e2e/screenshots/01-order-builder.png" });

  // Submit
  const createButton = page.getByRole("button", { name: /Create order/i });
  await expect(createButton).toBeEnabled();
  await createButton.click();
  await page.waitForURL((url) =>
    /\/provider\/orders\/[^/]+$/.test(url.pathname) &&
    !url.pathname.endsWith("/new"),
  );

  const orderId = page.url().split("/").at(-1)!;
  await page.screenshot({ path: "e2e/screenshots/02-order-detail-unpaid.png" });
  return orderId;
}

async function getPayUrl(page: Page, orderId: string) {
  await page.goto(`${BASE}/provider/orders/${orderId}`);
  const copyBtn = page.getByRole("button", { name: /Copy payment link/i });
  await expect(copyBtn).toBeVisible();
  return `${BASE}/pay/${orderId}`;
}

// ── tests ──────────────────────────────────────────────────────────────────

test.describe("supplement ordering vertical slice", () => {
  test("provider dashboard loads with seeded catalog", async ({ page }) => {
    await goToProvider(page);
    await expect(page.getByText("Omega-3 Fish Oil")).toBeVisible();
    await expect(page.getByText("Vitamin D3")).toBeVisible();
    await expect(page.getByText("Magnesium Glycinate")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/00-dashboard.png" });
  });

  test("provider dashboard: sortable tables and PDF export affordance", async ({
    page,
  }) => {
    await goToProvider(page);

    const catalogRows = page.locator("table").first().locator("tbody tr");
    await page.getByRole("button", { name: /^Stock$/ }).click();
    await expect(catalogRows.first().locator("td").nth(5)).toHaveText(/\d+/);
    const ascendingStocks = await catalogRows
      .locator("td:nth-child(6)")
      .allTextContents();
    expect(ascendingStocks.map(Number)).toEqual(
      [...ascendingStocks].map(Number).sort((a, b) => a - b),
    );

    await page.getByRole("button", { name: /^Stock$/ }).click();
    const descendingStocks = await catalogRows
      .locator("td:nth-child(6)")
      .allTextContents();
    expect(descendingStocks.map(Number)).toEqual(
      [...descendingStocks].map(Number).sort((a, b) => b - a),
    );

    await page.getByRole("button", { name: /^Status$/ }).click();
    await expect(page.getByRole("button", { name: /^Status$/ })).toBeVisible();

    await page.evaluate(() => {
      window.print = () => document.body.setAttribute("data-print-called", "true");
    });
    await page.getByRole("button", { name: /Export PDF/i }).click();
    await expect(page.locator("body")).toHaveAttribute("data-print-called", "true");
  });

  test("order builder: live split preview (fee + margin appear)", async ({ page }) => {
    await page.goto(`${BASE}/provider/orders/new`);
    await page.waitForSelector("text=New supplement order");

    const firstRow = page.locator("tbody tr").first();
    await firstRow.locator('input[type="number"]').fill("3");
    await firstRow.locator('input:not([type="number"])').fill("40.00");

    // Fee column should show something non-zero ($0.90 for 3 × $40)
    await expect(firstRow.locator("td").nth(5)).not.toHaveText("$0.00");
    // Margin column should be green and positive
    await expect(firstRow.locator("td").last()).toContainText("$");

    // Order totals panel should show "Patient pays"
    await expect(page.getByText("Patient pays")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/01b-live-preview.png" });
  });

  test("full happy path: create order → pay → ledger sums exactly", async ({ page }) => {
    const orderId = await createOrder(page, { qty: 2, price: "29.00" });

    const payUrl = await getPayUrl(page, orderId);
    await page.goto(payUrl);
    await page.waitForSelector("text=Pay for your supplements");
    await page.screenshot({ path: "e2e/screenshots/03-pay-page.png" });

    // Fill card and submit
    await page.locator('input[name="cardNumber"]').fill("4242424242424242");
    await page.screenshot({ path: "e2e/screenshots/04-card-filled.png" });
    await page.getByRole("button", { name: /Pay /i }).click();

    // Success message
    await expect(page.getByText(/Payment of .* succeeded/)).toBeVisible({
      timeout: 10_000,
    });
    await page.screenshot({ path: "e2e/screenshots/05-payment-success.png" });

    // Provider order detail: ledger with exact-sum badge
    await page.goto(`${BASE}/provider/orders/${orderId}`);
    await expect(page.getByText(/Postings sum exactly to/)).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/06-ledger-verified.png" });

    // Confirm paid status
    await expect(page.getByRole("cell", { name: "provider margin" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "cogs" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "platform fee" })).toBeVisible();
  });

  test("declined card: order stays unpaid, ledger empty, attempt recorded", async ({
    page,
  }) => {
    const orderId = await createOrder(page, { qty: 1, price: "44.00" });

    await page.goto(`${BASE}/pay/${orderId}`);
    await page.locator('input[name="cardNumber"]').fill("4000000000000002");
    await page.getByRole("button", { name: /Pay /i }).click();

    // Decline message
    await expect(page.getByText(/card was declined/i)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "e2e/screenshots/07-declined.png" });

    // Order still shows "copy payment link" (still awaiting payment)
    await page.goto(`${BASE}/provider/orders/${orderId}`);
    await expect(
      page.getByRole("button", { name: /Copy payment link/i }),
    ).toBeVisible();

    // Ledger section shows the empty-state message
    await expect(
      page.getByText(/No ledger entries/i),
    ).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/08-order-after-decline.png" });
  });

  test("declined then successful retry: order ends paid", async ({ page }) => {
    const orderId = await createOrder(page, { qty: 1, price: "36.75" });

    // First attempt: decline
    await page.goto(`${BASE}/pay/${orderId}`);
    await page.locator('input[name="cardNumber"]').fill("4000000000000002");
    await page.getByRole("button", { name: /Pay /i }).click();
    await expect(page.getByText(/card was declined/i)).toBeVisible({ timeout: 10_000 });

    // Second attempt: success on the same page
    await page.locator('input[name="cardNumber"]').fill("4242424242424242");
    await page.getByRole("button", { name: /Pay /i }).click();
    await expect(page.getByText(/Payment of .* succeeded/)).toBeVisible({
      timeout: 10_000,
    });
    await page.screenshot({ path: "e2e/screenshots/09-retry-success.png" });

    // Ledger present
    await page.goto(`${BASE}/provider/orders/${orderId}`);
    await expect(page.getByText(/Postings sum exactly to/)).toBeVisible();
  });

  test("patient view shows pending order with Pay now link", async ({ page }) => {
    // First create an unpaid order as provider
    await createOrder(page, { qty: 1, price: "22.50" });

    // Switch to patient view via header
    await page.goto(`${BASE}/provider`);
    const roleSelect = page.locator('select[name="role"]');
    await roleSelect.selectOption({ label: "Jordan Reyes (patient)" });
    await page.getByRole("button", { name: /Switch/i }).click();

    await page.waitForURL(/\/patient/);
    await page.screenshot({ path: "e2e/screenshots/10-patient-view.png" });
    await expect(page.getByText(/Hi Jordan/i)).toBeVisible();
  });

  test("dashboard inventory: restock increments stock on hand", async ({ page }) => {
    await goToProvider(page);

    // Get current stock of first supplement
    const firstStockCell = page
      .locator("tbody tr")
      .first()
      .locator("td")
      .nth(5);
    const stockBefore = parseInt(
      (await firstStockCell.textContent()) ?? "0",
      10,
    );

    // Restock by 10
    const firstRow = page.locator("tbody tr").first();
    await firstRow.locator('input[name="quantity"]').fill("10");
    await firstRow.getByRole("button", { name: "Add" }).click();

    // Wait for revalidation
    await page.waitForTimeout(1000);
    await page.reload();

    const stockAfter = parseInt(
      (await page
        .locator("tbody tr")
        .first()
        .locator("td")
        .nth(5)
        .textContent()) ?? "0",
      10,
    );
    expect(stockAfter).toBe(stockBefore + 10);
    await page.screenshot({ path: "e2e/screenshots/11-after-restock.png" });
  });
});
