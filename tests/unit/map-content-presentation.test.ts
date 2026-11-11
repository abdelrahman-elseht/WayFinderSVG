import { describe, expect, it } from 'vitest';
import floor from '../../data/buildings/B03/GF.json';
import { presentationColor, type RoomContent } from '@wayfinding/map-engine';
import { roomBlock } from '../../apps/web/components/mapBlocks';

describe('CMS map presentation overrides', () => {
  it('applies an override color only to the matching source room block', () => {
    const room = floor.rooms.find(item => item.polygon || item.displayFootprint) as Parameters<typeof roomBlock>[0];
    const override: RoomContent = { id: room.contentRef, description: { en: 'Description', ar: 'وصف' }, placeholder: false, image: null, imageAlt: { en: 'Photo', ar: 'صورة' }, presentation: { blockColor: '#116677' } };
    expect(roomBlock(room, override)?.color).toBe('#116677');
    expect(roomBlock(room)?.color).toBeUndefined();
  });
  it('uses the same source polygon and group color before a legacy room override', () => {
    const room = floor.rooms.find(item => item.polygon || item.displayFootprint) as Parameters<typeof roomBlock>[0];
    const content = { presentation: { colorGroupId: 'welcome', blockColor: '#112233' } } as RoomContent;
    const groups = [{ id: 'welcome', name: 'Welcome', color: '#abcdef' }];
    expect(roomBlock(room, content, groups)?.polygon).toBe(room.polygon ?? room.displayFootprint?.polygon);
    expect(roomBlock(room, content, groups)?.color).toBe('#abcdef');
    expect(roomBlock(room, content, [{ ...groups[0], color: '#445566' }])?.color).toBe('#445566');
    expect(presentationColor(content, [])).toBe('#112233');
    expect(presentationColor(undefined, groups)).toBeUndefined();
  });
  it('does not invent a block when the source has no footprint', () => {
    const room = { ...floor.rooms[0], polygon: null, displayFootprint: undefined } as Parameters<typeof roomBlock>[0];
    expect(roomBlock(room, { presentation: { blockColor: '#112233' } } as RoomContent)).toBeNull();
  });
});
