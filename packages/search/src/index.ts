import type { Language, Room } from '@wayfinding/map-engine';

/** Search-only normalization: the original source names and codes remain untouched. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىئۍی]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ک/g, 'ك')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Optimal string alignment includes adjacent transpositions, a common typing error.
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

function tokenScore(query: string, candidate: string): number {
  if (query === candidate) return 0;
  if (candidate.startsWith(query)) return 3;
  // Never repair digits: a mistyped room number must not become another destination.
  if (query.length < 3 || /\d/.test(query) || /\d/.test(candidate)) return Infinity;
  const allowed = query.length >= 6 ? 2 : 1;
  if (Math.abs(query.length - candidate.length) > allowed) return Infinity;
  const distance = editDistance(query, candidate);
  return distance <= allowed ? 10 + distance : Infinity;
}

/** Returns original Room objects, best first; ties preserve source inventory order. */
export function searchRooms(rooms: Room[], query: string, language: Language = 'en'): Room[] {
  const normalized = normalizeSearch(query);
  if (!normalized) return [...rooms];
  const terms = normalized.split(' ');
  const compact = normalized.replace(/ /g, '');
  return rooms
    .map((room, index) => {
      const code = normalizeSearch(room.code);
      const codeCompact = code.replace(/ /g, '');
      const fields = [
        { value: code, weight: 0 },
        { value: normalizeSearch(room.name[language]), weight: 1 },
        { value: normalizeSearch(room.name[language === 'ar' ? 'en' : 'ar']), weight: 2 },
        ...room.aliases.map(alias => ({ value: normalizeSearch(alias), weight: 3 })),
      ].filter(field => field.value);
      let score = Infinity;
      if (codeCompact && codeCompact === compact) score = 0;
      else if (codeCompact && codeCompact.startsWith(compact)) score = 15;
      for (const field of fields) {
        if (field.value === normalized) score = Math.min(score, 5 + field.weight);
        else if (field.value.startsWith(normalized)) score = Math.min(score, 20 + field.weight);
        else if (!/\d/.test(normalized) && field.value.includes(normalized)) score = Math.min(score, 30 + field.weight);
      }
      const candidates = fields.flatMap(field => field.value.split(' ').map(value => ({ value, weight: field.weight })));
      // All query terms must match, including mixed Arabic/English queries.
      const termScores = terms.map(term => Math.min(...candidates.map(candidate => tokenScore(term, candidate.value) + candidate.weight)));
      if (termScores.every(Number.isFinite)) {
        score = Math.min(score, 40 + termScores.reduce((total, value) => total + value, 0) / terms.length);
      }
      return { room, index, score };
    })
    .filter(result => Number.isFinite(result.score))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(result => result.room);
}
