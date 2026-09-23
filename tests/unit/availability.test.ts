import { describe, expect, it } from 'vitest';
import type { Language, Room } from '@wayfinding/map-engine';

const reasonFor = (room: Room, language: Language) => room.availability?.reason[language] ?? '';
const isAvailable = (room: Room) => (room.availability?.status ?? 'available') === 'available';

describe('destination availability', () => {
  it('defaults omitted availability to available', () => {
    const room = { id: 'r', availability: undefined } as Room;
    expect(isAvailable(room)).toBe(true);
  });
  it('resolves the localized operational reason', () => {
    const room = { availability: { status: 'unavailable', reason: { en: 'Closed', ar: 'مغلقة' } } } as Room;
    expect(reasonFor(room, 'en')).toBe('Closed');
    expect(reasonFor(room, 'ar')).toBe('مغلقة');
  });
  it('allows route actions only for available destinations', () => {
    expect(isAvailable({ availability: { status: 'available', reason: { en: 'Open', ar: 'مفتوحة' } } } as Room)).toBe(true);
    expect(isAvailable({ availability: { status: 'unavailable', reason: { en: 'Closed', ar: 'مغلقة' } } } as Room)).toBe(false);
  });
});
