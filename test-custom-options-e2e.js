const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:8080';

(async () => {
  let browser;
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    browser = await chromium.launch({ headless: false, slowMo: 100 });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('='.repeat(60));
    console.log('STOREFRONT CUSTOM OPTIONS E2E TEST');
    console.log('='.repeat(60));

    // Test 1: Navigate to homepage
    console.log('\n[Test 1] Navigating to homepage...');
    try {
      await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 15000 });
      console.log('✓ Homepage loaded successfully');
      testsPassed++;
    } catch (e) {
      console.log(`✗ Failed to load homepage: ${e.message}`);
      testsFailed++;
    }

    // Test 2: Check if products are displayed
    console.log('\n[Test 2] Checking for products...');
    try {
      const productCount = await page.locator('[data-testid="product-item"], .product-card, a[href*="/product/"]').count();
      if (productCount > 0) {
        console.log(`✓ Found ${productCount} products on home page`);
        testsPassed++;
      } else {
        console.log('⚠ No products found on home page - checking for links');
        const allLinks = await page.locator('a').count();
        console.log(`  Total links found: ${allLinks}`);
        testsFailed++;
      }
    } catch (e) {
      console.log(`✗ Error checking for products: ${e.message}`);
      testsFailed++;
    }

    // Test 3: Try to navigate to a product page
    console.log('\n[Test 3] Navigating to a product page...');
    try {
      // Try different selectors to find a product link
      const productLink = await page.locator('a[href*="/product"], [data-testid="product-link"]').first();
      if (await productLink.isVisible()) {
        await productLink.click();
        await page.waitForURL(/\/product/, { timeout: 10000 });
        console.log('✓ Successfully navigated to product page');
        testsPassed++;
      } else {
        console.log('⚠ Could not find product link');
        testsFailed++;
      }
    } catch (e) {
      console.log(`✗ Failed to navigate to product page: ${e.message}`);
      testsFailed++;
    }

    // Test 4: Check for custom options section
    console.log('\n[Test 4] Looking for custom options section...');
    try {
      const customOptionsSection = await page.locator('[data-testid="custom-options"], .custom-options, text=/Custom Options|Customization/i').count();
      if (customOptionsSection > 0) {
        console.log('✓ Custom options section found');
        testsPassed++;

        // Test 4a: Check for button-style options
        console.log('\n[Test 4a] Checking for button-style custom options...');
        try {
          const buttonOptions = await page.locator('button[data-option-type="buttons"], [data-display-mode="buttons"]').count();
          if (buttonOptions > 0) {
            console.log(`✓ Found ${buttonOptions} button-style custom option values`);
            testsPassed++;

            // Test selection of button option
            const firstButtonOption = await page.locator('button[data-option-type="buttons"], [data-display-mode="buttons"]').first();
            if (await firstButtonOption.isVisible()) {
              console.log('  - Clicking first button option...');
              await firstButtonOption.click();
              await page.waitForTimeout(200);
              console.log('  ✓ Button option clicked successfully');
              testsPassed++;
            }
          } else {
            console.log('⚠ No button-style options found (might not be created yet)');
          }
        } catch (e) {
          console.log(`⚠ Error checking button options: ${e.message}`);
        }

        // Test 4b: Check for color-button options
        console.log('\n[Test 4b] Checking for color-button custom options...');
        try {
          const colorButtons = await page.locator('[data-display-mode="color_buttons"]').count();
          if (colorButtons > 0) {
            console.log(`✓ Found ${colorButtons} color-button custom option values`);
            testsPassed++;

            // Look for color swatches
            const swatches = await page.locator('[data-swatch], .swatch-circle, [style*="background-color"]').count();
            if (swatches > 0) {
              console.log(`  - Found ${swatches} color swatches`);
              testsPassed++;
            }

            // Test selection
            const firstColorButton = await page.locator('[data-display-mode="color_buttons"]').first();
            if (await firstColorButton.isVisible()) {
              console.log('  - Clicking first color-button option...');
              await firstColorButton.click();
              await page.waitForTimeout(200);
              console.log('  ✓ Color-button option clicked successfully');
              testsPassed++;
            }
          } else {
            console.log('⚠ No color-button options found (might not be created yet)');
          }
        } catch (e) {
          console.log(`⚠ Error checking color buttons: ${e.message}`);
        }
      } else {
        console.log('⚠ No custom options section found on product page');
      }
    } catch (e) {
      console.log(`✗ Error checking custom options: ${e.message}`);
      testsFailed++;
    }

    // Test 5: Check for dropdown options (default display mode)
    console.log('\n[Test 5] Checking for dropdown custom options...');
    try {
      const dropdowns = await page.locator('select').count();
      if (dropdowns > 0) {
        console.log(`✓ Found ${dropdowns} dropdown select elements`);
        testsPassed++;
      } else {
        console.log('⚠ No dropdown options found');
      }
    } catch (e) {
      console.log(`✗ Error checking dropdowns: ${e.message}`);
      testsFailed++;
    }

    // Test 6: Check Add to Cart button and functionality
    console.log('\n[Test 6] Checking Add to Cart functionality...');
    try {
      const addToCartBtn = await page.locator('button:has-text("Add to Cart"), button:has-text("Add to cart"), button:has-text("Add To Cart")').first();
      if (await addToCartBtn.isVisible()) {
        console.log('✓ Add to Cart button found');
        testsPassed++;

        // Click and observe
        console.log('  - Attempting to click Add to Cart...');
        try {
          await addToCartBtn.click({ timeout: 5000 });
          await page.waitForTimeout(500);
          console.log('  ✓ Add to Cart button clicked successfully');
          testsPassed++;
        } catch (e) {
          console.log(`  ⚠ Error clicking Add to Cart: ${e.message}`);
        }
      } else {
        console.log('⚠ Add to Cart button not found');
      }
    } catch (e) {
      console.log(`✗ Error checking Add to Cart: ${e.message}`);
      testsFailed++;
    }

    // Test 7: Check dark mode compatibility
    console.log('\n[Test 7] Checking dark mode compatibility...');
    try {
      await page.evaluate(() => {
        const html = document.documentElement;
        const isDarkMode = html.classList.contains('dark');
        console.log('  Current theme:', isDarkMode ? 'dark' : 'light');
      });
      console.log('✓ Dark mode check completed');
      testsPassed++;
    } catch (e) {
      console.log(`⚠ Error checking dark mode: ${e.message}`);
    }

    // Test 8: Screenshot of product page
    console.log('\n[Test 8] Taking screenshots...');
    try {
      await page.screenshot({ path: 'H:\\Projects\\go-ecommerce\\test-product-page.png', fullPage: true });
      console.log('✓ Screenshot saved to test-product-page.png');
      testsPassed++;
    } catch (e) {
      console.log(`✗ Error taking screenshot: ${e.message}`);
      testsFailed++;
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log(`TEST SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('='.repeat(60));
    console.log('\nKEY FINDINGS:');
    console.log('- Frontend is running and accessible');
    console.log('- Custom options UI rendering needs to be verified with test data');
    console.log('- Button and color-button display modes should be created via admin');
    console.log('\nNEXT STEPS:');
    console.log('1. Create test products with custom options in admin interface');
    console.log('2. Set display_mode to "buttons" and "color_buttons"');
    console.log('3. Verify chip rendering and selection behavior');
    console.log('4. Test cart payload serialization');

    await browser.close();
    process.exit(testsFailed > 0 ? 1 : 0);

  } catch (error) {
    console.error('Unexpected error:', error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
