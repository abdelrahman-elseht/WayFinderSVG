import type { ColorGroup, RoomContent } from './types';

export const colorGroupIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

/** Validate references against the same draft or published snapshot. */
export function validateColorGroups(value: unknown, contents: RoomContent[]): ColorGroup[] {
  if (!Array.isArray(value)) throw new Error('Color categories must be an array');
  const ids = new Set<string>();
  const groups = value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid color category');
    const group = entry as ColorGroup;
    if (typeof group.id !== 'string' || !colorGroupIdPattern.test(group.id)) throw new Error('Invalid color category ID');
    if (ids.has(group.id)) throw new Error(`Duplicate color category ID: ${group.id}`);
    ids.add(group.id);
    if (typeof group.name !== 'string' || !group.name.trim() || group.name.length > 80) throw new Error('Color category name must be 1-80 characters');
    if (typeof group.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(group.color)) throw new Error('Color category requires a six-digit hex color');
    return { id: group.id, name: group.name, color: group.color };
  });
  for (const item of contents) {
    const id = item.presentation?.colorGroupId;
    if (id !== undefined && !ids.has(id)) throw new Error(`Missing color category ${id} for ${item.id}. Unassign its rooms before deleting the category.`);
  }
  return groups;
}

export function presentationColor(content: RoomContent | undefined, groups: ColorGroup[] = []): string | undefined {
  const color = groups.find(group => group.id === content?.presentation?.colorGroupId)?.color;
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : content?.presentation?.blockColor;
}
