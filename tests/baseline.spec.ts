import { test, expect } from '@playwright/test';

// ─── Homepage ─────────────────────────────────────────────────────────────────

test.describe('Homepage', () => {
  test('homepage loads and shows product listing', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ShopApp/);
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  });

  test('product cards display name and price', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.product-card').first();
    await expect(card.locator('.product-name')).toBeVisible();
    await expect(card.locator('.product-price')).toBeVisible();
  });
});

// ─── Cart ─────────────────────────────────────────────────────────────────────

test.describe('Cart', () => {
  test('add to cart updates cart count', async ({ page }) => {
    await page.goto('/');
    await page.locator('.product-card .add-to-cart').first().click();
    await expect(page.locator('.cart-count')).toHaveText('1');
  });

  test('cart page shows added items', async ({ page }) => {
    await page.goto('/');
    await page.locator('.product-card .add-to-cart').first().click();
    await page.goto('/cart');
    await expect(page.locator('.cart-item')).toHaveCount(1);
  });

  test('cart displays total price', async ({ page }) => {
    await page.goto('/');
    await page.locator('.product-card .add-to-cart').first().click();
    await page.goto('/cart');
    const total = page.locator('.cart-total');
    await expect(total).toBeVisible();
    await expect(total).not.toHaveText('$0');
  });
});

// ─── Checkout ─────────────────────────────────────────────────────────────────

test.describe('Checkout', () => {
  test('checkout form accepts user details', async ({ page }) => {
    await page.goto('/cart');
    await page.locator('#checkout-name').fill('Jane Doe');
    await page.locator('#checkout-email').fill('jane@example.com');
    await page.locator('#checkout-address').fill('123 Main St');
    await page.locator('#checkout-submit').click();
    await expect(page.locator('.order-confirmation')).toBeVisible();
  });

  test('order confirmation page loads after checkout', async ({ page }) => {
    await page.goto('/cart');
    await page.locator('#checkout-name').fill('Test User');
    await page.locator('#checkout-email').fill('test@example.com');
    await page.locator('#checkout-address').fill('456 Oak Ave');
    await page.locator('#checkout-submit').click();
    await expect(page.getByText('Your order has been placed')).toBeVisible();
  });
});

// ─── Authentication ───────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('unauthenticated user is redirected from account page', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
  });
});
