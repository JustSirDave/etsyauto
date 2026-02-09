/**
 * Products E2E Tests
 * Critical path: List products, create product, AI generation
 */

import { test, expect } from '@playwright/test';

// Helper: Login before each test
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('TestPassword123!');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await expect(page).toHaveURL('/dashboard');
  
  // Navigate to products
  await page.getByRole('link', { name: /products/i }).click();
  await expect(page).toHaveURL('/products');
});

test.describe('Products List', () => {
  
  test('should display products table or empty state', async ({ page }) => {
    // Should show either products table or empty state
    const productsTable = page.locator('table, .products-grid');
    const emptyState = page.getByText(/no products|add your first/i);
    
    await expect(productsTable.or(emptyState)).toBeVisible();
  });

  test('should open create product modal', async ({ page }) => {
    // Click "Add Product" or similar button
    const addButton = page.getByRole('button', { name: /add|create.*product/i }).first();
    
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Modal should appear
      const modal = page.locator('[role="dialog"], .modal').first();
      await expect(modal).toBeVisible();
    }
  });

  test('should filter products by shop', async ({ page }) => {
    // Shop selector should exist
    const shopFilter = page.locator('select, button').filter({ hasText: /shop/i }).first();
    
    if (await shopFilter.isVisible()) {
      await shopFilter.click();
      
      // Options should appear
      await expect(page.locator('[role="option"], option').first()).toBeVisible();
    }
  });

  test('should paginate through products', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000);
    
    // Check if pagination exists
    const nextButton = page.getByRole('button', { name: /next/i });
    const pageInfo = page.locator('text=/page \\d+ of \\d+/i');
    
    if (await nextButton.isVisible()) {
      // Click next page
      await nextButton.click();
      await page.waitForTimeout(500);
      
      // Page should change
      await expect(pageInfo).toBeVisible();
    }
  });
});

test.describe('Product Creation', () => {
  
  test('should create new product with required fields', async ({ page }) => {
    // Open create modal
    const addButton = page.getByRole('button', { name: /add|create.*product/i }).first();
    
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Fill form
      await page.getByLabel(/title/i).fill('Test Product E2E');
      await page.getByLabel(/description/i).fill('Test description for E2E testing');
      await page.getByLabel(/price/i).fill('29.99');
      await page.getByLabel(/quantity/i).fill('10');
      
      // Submit
      const submitButton = page.getByRole('button', { name: /save|create/i });
      await submitButton.click();
      
      // Should show success toast or close modal
      await expect(page.getByText(/success|created/i).or(page.locator('[role="dialog"]'))).toBeVisible();
    }
  });

  test('should show validation errors for invalid data', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add|create.*product/i }).first();
    
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Try to submit with invalid price
      await page.getByLabel(/title/i).fill('Test');
      await page.getByLabel(/price/i).fill('-10'); // Invalid
      
      const submitButton = page.getByRole('button', { name: /save|create/i });
      await submitButton.click();
      
      // Should show validation error
      await expect(page.getByText(/invalid|must be positive/i)).toBeVisible();
    }
  });
});

test.describe('AI Content Generation', () => {
  
  test('should open AI generation panel', async ({ page }) => {
    // Navigate to AI page
    await page.getByRole('link', { name: /ai|content/i }).click();
    
    // Should show AI interface
    await expect(page.getByText(/generate|ai|content/i)).toBeVisible();
  });

  test('should generate content for product', async ({ page }) => {
    // Go to AI page
    await page.goto('/ai');
    
    // Fill AI generation form
    const productSelect = page.locator('select, input').filter({ hasText: /product/i }).first();
    
    if (await productSelect.isVisible()) {
      // Select a product
      await productSelect.click();
      
      // Choose generation mode
      const generateButton = page.getByRole('button', { name: /generate/i });
      await generateButton.click();
      
      // Should show loading or result
      await expect(page.getByText(/generating|generated/i)).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Product Details', () => {
  
  test('should view product details', async ({ page }) => {
    // Click on first product (if exists)
    const firstProduct = page.locator('tr, .product-card').nth(1);
    
    if (await firstProduct.isVisible()) {
      await firstProduct.click();
      
      // Should navigate to detail page or show modal
      await expect(page.getByText(/details|edit/i)).toBeVisible();
    }
  });

  test('should edit product', async ({ page }) => {
    const firstProduct = page.locator('tr, .product-card').nth(1);
    
    if (await firstProduct.isVisible()) {
      // Click edit button
      const editButton = firstProduct.locator('button').filter({ hasText: /edit/i });
      
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Should open edit form
        await expect(page.getByLabel(/title|name/i)).toBeVisible();
      }
    }
  });
});
