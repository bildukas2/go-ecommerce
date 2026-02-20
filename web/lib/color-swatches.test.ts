import {
  getAutoSwatchColor,
  isValidHexColor,
  getSwatchColor,
} from './color-swatches';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Test getAutoSwatchColor

test('getAutoSwatchColor: returns black hex for "black"', () => {
  const result = getAutoSwatchColor('black');
  assert(result === '#111827', `Expected #111827, got ${result}`);
});

test('getAutoSwatchColor: returns black hex for "Black"', () => {
  const result = getAutoSwatchColor('Black');
  assert(result === '#111827', `Expected #111827, got ${result}`);
});

test('getAutoSwatchColor: returns black hex for "  black  " (trimmed)', () => {
  const result = getAutoSwatchColor('  black  ');
  assert(result === '#111827', `Expected #111827, got ${result}`);
});

test('getAutoSwatchColor: returns white hex for "white"', () => {
  const result = getAutoSwatchColor('white');
  assert(result === '#F9FAFB', `Expected #F9FAFB, got ${result}`);
});

test('getAutoSwatchColor: returns red hex for "red"', () => {
  const result = getAutoSwatchColor('red');
  assert(result === '#EF4444', `Expected #EF4444, got ${result}`);
});

test('getAutoSwatchColor: returns blue hex for "blue"', () => {
  const result = getAutoSwatchColor('blue');
  assert(result === '#3B82F6', `Expected #3B82F6, got ${result}`);
});

test('getAutoSwatchColor: returns green hex for "green"', () => {
  const result = getAutoSwatchColor('green');
  assert(result === '#22C55E', `Expected #22C55E, got ${result}`);
});

test('getAutoSwatchColor: returns yellow hex for "yellow"', () => {
  const result = getAutoSwatchColor('yellow');
  assert(result === '#EAB308', `Expected #EAB308, got ${result}`);
});

test('getAutoSwatchColor: returns purple hex for "purple"', () => {
  const result = getAutoSwatchColor('purple');
  assert(result === '#A855F7', `Expected #A855F7, got ${result}`);
});

test('getAutoSwatchColor: returns pink hex for "pink"', () => {
  const result = getAutoSwatchColor('pink');
  assert(result === '#EC4899', `Expected #EC4899, got ${result}`);
});

test('getAutoSwatchColor: returns gray hex for "gray"', () => {
  const result = getAutoSwatchColor('gray');
  assert(result === '#9CA3AF', `Expected #9CA3AF, got ${result}`);
});

test('getAutoSwatchColor: returns gray hex for "grey"', () => {
  const result = getAutoSwatchColor('grey');
  assert(result === '#9CA3AF', `Expected #9CA3AF, got ${result}`);
});

test('getAutoSwatchColor: returns default cyan for unknown color "unknown"', () => {
  const result = getAutoSwatchColor('unknown');
  assert(result === '#0072F5', `Expected #0072F5, got ${result}`);
});

test('getAutoSwatchColor: returns default cyan for "Ocean Blue"', () => {
  const result = getAutoSwatchColor('Ocean Blue');
  assert(result === '#0072F5', `Expected #0072F5, got ${result}`);
});

test('getAutoSwatchColor: returns default cyan for null', () => {
  const result = getAutoSwatchColor(null);
  assert(result === '#0072F5', `Expected #0072F5, got ${result}`);
});

test('getAutoSwatchColor: returns default cyan for undefined', () => {
  const result = getAutoSwatchColor(undefined);
  assert(result === '#0072F5', `Expected #0072F5, got ${result}`);
});

test('getAutoSwatchColor: returns default cyan for empty string', () => {
  const result = getAutoSwatchColor('');
  assert(result === '#0072F5', `Expected #0072F5, got ${result}`);
});

// Test isValidHexColor

test('isValidHexColor: returns true for valid hex "#111827"', () => {
  const result = isValidHexColor('#111827');
  assert(result === true, `Expected true, got ${result}`);
});

test('isValidHexColor: returns true for valid hex "#FFFFFF"', () => {
  const result = isValidHexColor('#FFFFFF');
  assert(result === true, `Expected true, got ${result}`);
});

test('isValidHexColor: returns true for valid hex "#0072F5"', () => {
  const result = isValidHexColor('#0072F5');
  assert(result === true, `Expected true, got ${result}`);
});

test('isValidHexColor: returns true for lowercase valid hex "#ffffff"', () => {
  const result = isValidHexColor('#ffffff');
  assert(result === true, `Expected true, got ${result}`);
});

test('isValidHexColor: returns false for invalid hex "111827" (missing #)', () => {
  const result = isValidHexColor('111827');
  assert(result === false, `Expected false, got ${result}`);
});

test('isValidHexColor: returns false for invalid hex "#11182" (too short)', () => {
  const result = isValidHexColor('#11182');
  assert(result === false, `Expected false, got ${result}`);
});

test('isValidHexColor: returns false for invalid hex "#1118277" (too long)', () => {
  const result = isValidHexColor('#1118277');
  assert(result === false, `Expected false, got ${result}`);
});

test('isValidHexColor: returns false for invalid hex "#GGGGGG" (invalid chars)', () => {
  const result = isValidHexColor('#GGGGGG');
  assert(result === false, `Expected false, got ${result}`);
});

test('isValidHexColor: returns false for null', () => {
  const result = isValidHexColor(null);
  assert(result === false, `Expected false, got ${result}`);
});

test('isValidHexColor: returns false for undefined', () => {
  const result = isValidHexColor(undefined);
  assert(result === false, `Expected false, got ${result}`);
});

test('isValidHexColor: returns false for empty string', () => {
  const result = isValidHexColor('');
  assert(result === false, `Expected false, got ${result}`);
});

// Test getSwatchColor

test('getSwatchColor: returns swatch_hex when valid', () => {
  const result = getSwatchColor('#FF0000', 'black');
  assert(result === '#FF0000', `Expected #FF0000, got ${result}`);
});

test('getSwatchColor: falls back to auto-mapped color when swatch_hex is null', () => {
  const result = getSwatchColor(null, 'black');
  assert(result === '#111827', `Expected #111827, got ${result}`);
});

test('getSwatchColor: falls back to auto-mapped color when swatch_hex is undefined', () => {
  const result = getSwatchColor(undefined, 'white');
  assert(result === '#F9FAFB', `Expected #F9FAFB, got ${result}`);
});

test('getSwatchColor: falls back to auto-mapped color when swatch_hex is invalid', () => {
  const result = getSwatchColor('invalid', 'blue');
  assert(result === '#3B82F6', `Expected #3B82F6, got ${result}`);
});

test('getSwatchColor: falls back to default cyan when swatch_hex and label are both invalid', () => {
  const result = getSwatchColor('invalid', 'unknown');
  assert(result === '#0072F5', `Expected #0072F5, got ${result}`);
});

// Print results
console.log('\n=== Color Swatches Test Results ===\n');

let passed = 0;
let failed = 0;

results.forEach((result) => {
  if (result.passed) {
    console.log(`✓ ${result.name}`);
    passed++;
  } else {
    console.log(`✗ ${result.name}`);
    console.log(`  Error: ${result.error}`);
    failed++;
  }
});

console.log(`\n=== Summary ===`);
console.log(`Total: ${results.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
