/**
 * Color swatch fallback mapping utility.
 * Provides auto-color mapping for missing swatch_hex values based on label names.
 */

interface ColorMap {
  [key: string]: string;
}

const COLOR_MAPPING: ColorMap = {
  black: '#111827',
  white: '#F9FAFB',
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
  purple: '#A855F7',
  pink: '#EC4899',
  gray: '#9CA3AF',
  grey: '#9CA3AF',
};

const DEFAULT_COLOR = '#0072F5';

/**
 * Returns a hex color for a given label.
 * If the label matches a known color name, returns its mapped hex value.
 * Otherwise, returns the default cyan color.
 *
 * @param label - The color label (e.g., "Black", "Ocean Blue")
 * @returns A hex color string in #RRGGBB format
 */
export function getAutoSwatchColor(
  label: string | null | undefined
): string {
  if (!label || typeof label !== 'string') {
    return DEFAULT_COLOR;
  }

  const normalized = label.toLowerCase().trim();

  if (normalized in COLOR_MAPPING) {
    return COLOR_MAPPING[normalized];
  }

  return DEFAULT_COLOR;
}

/**
 * Validates if a string is a valid hex color.
 * @param hex - The color string to validate
 * @returns true if valid hex color (#RRGGBB format)
 */
export function isValidHexColor(hex: string | null | undefined): boolean {
  if (!hex || typeof hex !== 'string') {
    return false;
  }

  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  return hexPattern.test(hex);
}

/**
 * Returns a hex color, preferring the swatch_hex if valid, otherwise falls back to auto-mapping.
 * @param swatchHex - The explicitly set swatch hex color
 * @param label - The label to use for fallback mapping
 * @returns A hex color string in #RRGGBB format
 */
export function getSwatchColor(
  swatchHex: string | null | undefined,
  label: string | null | undefined
): string {
  if (isValidHexColor(swatchHex)) {
    return swatchHex!;
  }

  return getAutoSwatchColor(label);
}
