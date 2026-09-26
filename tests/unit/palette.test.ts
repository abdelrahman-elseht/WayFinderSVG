import { describe, expect, it } from 'vitest';
import { categoryColors, categorySwatchColors, highContrastMapPalette, interactionColors, mapPalette } from '../../apps/web/components/palette';

function luminance(hex: string) {
  const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

describe('brand-aligned palette', () => {
  it('keeps every room category mapped to a distinct muted block and readable swatch', () => {
    const categories = Object.keys(categoryColors);
    expect(categories).toHaveLength(7);
    expect(new Set(Object.values(categoryColors)).size).toBe(categories.length);
    for (const category of categories as (keyof typeof categorySwatchColors)[]) {
      const swatch = categorySwatchColors[category];
      expect(contrast(swatch.background, swatch.foreground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reserves strong brand derivatives for interaction and route roles', () => {
    expect(contrast('#FFFFFF', interactionColors.focus)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', interactionColors.action)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', interactionColors.qualification)).toBeGreaterThanOrEqual(4.5);
    expect(mapPalette.selection).toBe(interactionColors.focus);
    expect(mapPalette.route).toBe(interactionColors.action);
    expect(highContrastMapPalette.routeDestination).toBe(interactionColors.focus);
  });
});
