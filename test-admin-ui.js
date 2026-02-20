const { chromium } = require("playwright");

const TARGET_URL = "http://localhost:3000";

(async () => {
  console.log("Testing Admin Custom Options Form\n");
  console.log("=" .repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const testResults = [];

  try {
    // Navigate to create custom option page
    console.log("\n📄 Navigating to /admin/catalog/custom-options/new");
    await page.goto(`${TARGET_URL}/admin/catalog/custom-options/new`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    
    // Wait for React to render
    await page.waitForTimeout(1500);
    
    // Test 1: Verify form exists
    const titleInput = page.locator('input[name="title"]');
    if (await titleInput.count() > 0) {
      testResults.push({ test: "Form loads successfully", passed: true });
    } else {
      testResults.push({ test: "Form loads successfully", passed: false });
      throw new Error("Form elements not found");
    }

    // Test 2: Fill title and trigger code generation
    console.log("\n🔧 Testing form interactions...");
    await titleInput.fill("Size Options");
    await page.waitForTimeout(500);
    
    const codeValue = await page.inputValue('input[name="code"]');
    if (codeValue === "size-options") {
      testResults.push({ test: "Code auto-generation works", passed: true });
    } else {
      testResults.push({ test: "Code auto-generation works", passed: false });
    }

    // Test 3: Select a select-type option
    console.log("  Setting type to dropdown...");
    await page.selectOption('select[name="type"]', "dropdown");
    await page.waitForTimeout(800);
    
    // Test 4: Verify Display Mode section appears
    const displaySection = page.locator("section").filter({ hasText: "Display" });
    const displaySectionCount = await displaySection.count();
    
    if (displaySectionCount > 0) {
      testResults.push({ test: "Display Mode section appears for select types", passed: true });
    } else {
      testResults.push({ test: "Display Mode section appears for select types", passed: false });
    }

    // Test 5: Check for display mode radio options
    console.log("  Checking display mode options...");
    
    // Look for the radio buttons by finding them after the Display heading
    const buttonsRadio = page.locator('input[type="radio"][value="buttons"]');
    const colorButtonsRadio = page.locator('input[type="radio"][value="color_buttons"]');
    const defaultRadio = page.locator('input[type="radio"][value="default"]');
    
    const hasButtons = await buttonsRadio.count() > 0;
    const hasColorButtons = await colorButtonsRadio.count() > 0;
    const hasDefault = await defaultRadio.count() > 0;
    
    testResults.push({ 
      test: "Display mode option 'buttons' available", 
      passed: hasButtons 
    });
    testResults.push({ 
      test: "Display mode option 'color_buttons' available", 
      passed: hasColorButtons 
    });
    testResults.push({ 
      test: "Display mode option 'default' available", 
      passed: hasDefault 
    });

    // Test 6: Switch to buttons mode
    console.log("  Switching to buttons mode...");
    if (hasButtons) {
      await buttonsRadio.click();
      await page.waitForTimeout(300);
      
      const buttonsChecked = await buttonsRadio.isChecked();
      testResults.push({ test: "Can select 'buttons' display mode", passed: buttonsChecked });
    }

    // Test 7: Switch to color_buttons mode
    console.log("  Switching to color_buttons mode...");
    if (hasColorButtons) {
      await colorButtonsRadio.click();
      await page.waitForTimeout(300);
      
      const colorButtonsChecked = await colorButtonsRadio.isChecked();
      testResults.push({ test: "Can select 'color_buttons' display mode", passed: colorButtonsChecked });
    }

    // Test 8: Add a value
    console.log("  Adding a value...");
    const addButton = page.locator('button:has-text("Add value")');
    const addButtonCount = await addButton.count();
    
    if (addButtonCount > 0) {
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Check if value row appeared
      const valueRows = page.locator('table tbody tr');
      const rowCount = await valueRows.count();
      testResults.push({ test: "Can add values to select option", passed: rowCount > 0 });
    }

    // Test 9: Verify swatch color input exists
    console.log("  Checking swatch color input...");
    const colorInput = page.locator('input[type="color"]');
    const colorInputCount = await colorInput.count();
    
    testResults.push({ 
      test: "Swatch color input (color picker) available", 
      passed: colorInputCount > 0 
    });

    // Test 10: Verify form includes display_mode field
    console.log("  Checking form submission fields...");
    const displayModeInput = page.locator('input[name="display_mode"]');
    const displayModeExists = await displayModeInput.count() > 0;
    
    testResults.push({ test: "Form includes display_mode hidden input", passed: displayModeExists });
    
    if (displayModeExists) {
      const displayModeValue = await displayModeInput.inputValue();
      testResults.push({ 
        test: `display_mode value set correctly (current: ${displayModeValue})`, 
        passed: displayModeValue === "color_buttons" 
      });
    }

    // Test 11: Check values_json is present
    const valuesJsonInput = page.locator('input[name="values_json"]');
    testResults.push({ test: "Form includes values_json hidden input", passed: await valuesJsonInput.count() > 0 });

  } catch (error) {
    console.error("\n❌ Test error:", error.message);
    testResults.push({ test: "Test execution", passed: false, error: error.message });
  } finally {
    await browser.close();
  }

  // Print results
  console.log("\n" + "=" .repeat(60));
  console.log("TEST RESULTS");
  console.log("=" .repeat(60) + "\n");
  
  let passCount = 0;
  let failCount = 0;
  
  testResults.forEach((result, index) => {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} | ${result.test}`);
    if (result.error) {
      console.log(`       Error: ${result.error}`);
    }
    
    if (result.passed) passCount++;
    else failCount++;
  });
  
  console.log("\n" + "=" .repeat(60));
  console.log(`Results: ${passCount} passed, ${failCount} failed out of ${testResults.length} tests`);
  console.log("=" .repeat(60));
  
  if (failCount === 0) {
    console.log("\n🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some tests failed. Please review.");
    process.exit(1);
  }
})();
