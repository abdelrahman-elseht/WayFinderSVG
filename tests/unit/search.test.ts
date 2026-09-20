import { describe, expect, it } from 'vitest';
import type { Room } from '@wayfinding/map-engine';
import { normalizeSearch, searchRooms } from '@wayfinding/search';

const room = (id: string, code: string, en: string, ar: string, aliases: string[] = []): Room => ({
  id, code, name: { en, ar }, aliases,
  buildingId: 'B03', floorId: 'GF', category: 'other', polygon: null,
  geometryRef: null, centroid: [0, 0], doorNodeId: null, contentRef: id,
  public: true, geometryStatus: 'unknown', provenance: [],
});

const rooms = [
  room('lab', 'B03-GF-101', 'Computer Laboratory', 'مُخْتَبَر الحَاسُوب', ['IT Lab', 'معمل الكمبيوتر']),
  room('office', 'B03-GF-102', 'Administration Office', 'إدارة الأكاديمية', ['Reception', 'الاستقبال']),
  room('library', 'B03-GF-103', 'Library', 'المكتبة', ['Reading room']),
  room('class', 'B03-GF-104', 'Classroom', 'قاعة دراسية'),
];

describe('search normalization', () => {
  it('normalizes diacritics, tatweel, alef/ya variants, digits and spacing', () => {
    expect(normalizeSearch('  إِدَارَةُ الـأَكاديميَّة ١٠٢ ')).toBe('اداره الاكاديميه 102');
    expect(normalizeSearch('آ إ أ ٱ ى ئ ی ک ؤ ۱۲۳')).toBe('ا ا ا ا ي ي ي ك و 123');
    expect(normalizeSearch(' B03_GF-101 / LAB ')).toBe('b03 gf 101 lab');
  });

  it('is idempotent and removes search punctuation without changing source values', () => {
    const normalized = normalizeSearch('المَكتبة / CAFÉ ١٠٣');
    expect(normalizeSearch(normalized)).toBe(normalized);
    expect(rooms[0].name.ar).toBe('مُخْتَبَر الحَاسُوب');
  });
});

describe('room search', () => {
  it('returns stable inventory for an empty or punctuation-only query', () => {
    expect(searchRooms(rooms, '')).toEqual(rooms);
    expect(searchRooms(rooms, ' - ')).toEqual(rooms);
    expect(searchRooms(rooms, '')).not.toBe(rooms);
  });

  it('finds codes despite separators, case and Arabic digits', () => {
    expect(searchRooms(rooms, 'b03gf101')).toEqual([rooms[0]]);
    expect(searchRooms(rooms, 'B03 GF ١٠٢')).toEqual([rooms[1]]);
    expect(searchRooms(rooms, '١٠٣')).toEqual([rooms[2]]);
    expect(searchRooms(rooms, 'b03-gf-105')).toEqual([]);
  });

  it('searches English, Arabic and aliases regardless of interface language', () => {
    expect(searchRooms(rooms, 'الحاسوب', 'en')).toEqual([rooms[0]]);
    expect(searchRooms(rooms, 'COMPUTER', 'ar')).toEqual([rooms[0]]);
    expect(searchRooms(rooms, 'اداره الاكاديميه', 'en')).toEqual([rooms[1]]);
    expect(searchRooms(rooms, 'reception', 'ar')).toEqual([rooms[1]]);
    expect(searchRooms(rooms, 'معمل الكمبيوتر')).toEqual([rooms[0]]);
    expect(searchRooms(rooms, 'computer الحاسوب')).toEqual([rooms[0]]);
  });

  it('handles typos and adjacent transpositions in both languages', () => {
    expect(searchRooms(rooms, 'libary')).toEqual([rooms[2]]);
    expect(searchRooms(rooms, 'comptuer lab')).toEqual([rooms[0]]);
    expect(searchRooms(rooms, 'المكتبه')).toEqual([rooms[2]]);
    expect(searchRooms(rooms, 'الحسوب')).toEqual([rooms[0]]);
  });

  it('requires every term and does not fuzzy-match short or numeric terms', () => {
    expect(searchRooms(rooms, 'computer cafeteria')).toEqual([]);
    expect(searchRooms(rooms, 'zz')).toEqual([]);
    expect(searchRooms(rooms, '105')).toEqual([]);
    expect(searchRooms(rooms, '999')).toEqual([]);
  });

  it('ranks exact codes and exact names before prefixes and fuzzy matches', () => {
    const inventory = [room('prefix', '2', 'Library Annex', 'ملحق'), room('exact', '3', 'Library', 'المكتبة'), room('code', 'Library', 'Archive', 'أرشيف')];
    expect(searchRooms(inventory, 'library').map(item => item.id)).toEqual(['code', 'exact', 'prefix']);
    expect(inventory.map(item => item.id)).toEqual(['prefix', 'exact', 'code']);
  });

  it('retains source ordering and object identity for equal relevance', () => {
    const first = room('a', '1', 'Office', 'مكتب');
    const second = room('b', '2', 'Office', 'مكتب');
    const result = searchRooms([second, first], 'office');
    expect(result).toEqual([second, first]);
    expect(result[0]).toBe(second);
  });
});
