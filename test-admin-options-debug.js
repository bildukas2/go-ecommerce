const { chromium } = require("playwright");

const TARGET_URL = "http://localhost:3000";

(async () => {
  console.log("Starting admin UI test for custom options...\n");
  
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  try {
    console.log("1️⃣  Navigating to admin custom options create page...");
    await page.goto(`${TARGET_URL}/admin/catalog/custom-options/new`, {
      waitUntil: "networkidle",
    });
    console.log("✅ Page loaded\n");

    // Fill in the title
    await page.fill('input[name="title"]', "Size");
    console.log("✅ Set title to 'Size'");

    // Wait for code to be auto-filled
    await page.waitForTimeout(500);
    
    // Change type to dropdown (select)
    await page.selectOption('select[name="type"]', "dropdown");
    console.log("✅ Set type to 'dropdown'");

    // Wait for Display section to appear
    await page.waitForSelector("h2", { timeout: 5000 });
    console.log("✅ Waiting for Display Mode section...");
    
    // Take screenshot to see the form
    await page.screenshot({ path: "H:/Projects/go-ecommerce/debug-form.png", fullPage: true });
    console.log("✅ Screenshot taken");
    
    // Get all radio buttons
    const radioInputs = await page.locator('input[type="radio"]').all();
    console.log(`\nFound ${radioInputs.length} radio buttons total`);
    
    // Get all radio buttons with their values
    const radios = await page.locator('input[type="radio"]').evaluateAll(els => 
      els.map(el => ({
        name: el.getAttribute('name'),
        value: el.getAttribute('value'),
        checked: el.checked
      }))
    );
    console.log("Radio buttons:");
    radios.forEach((r, i) => {
      console.log(`  ${i}: name="${r.name}", value="${r.value}", checked=${r.checked}`);
    });

    // Try to find the display mode section
    const displaySections = await page.locator("section").evaluateAll(sections =>
      sections
        .filter(s => s.textContent.includes("Display"))
        .map(s => ({
          text: s.textContent.substring(0, 200)
        }))
    );
    console.log(`\nDisplay sections found: ${displaySections.length}`);
    displaySections.forEach(s => {
      console.log(`  - ${s.text}`);
    });

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    await browser.close();
  }
})();
