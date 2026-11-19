// Source-derived semantic IDs, not geometry or the broader circulation category.
const corridorMapLabelIds = new Set<string>([
  'B03-GF-G-02',
  'B03-GF-G-03',
  'B03-GF-G-04',
  'B03-01-F-01',
  'B03-01-F-02',
  'B03-01-F-03',
  'B03-01-F-04',
  'B03-01-F-05',
  'B03-01-F-06',
  'B03-01-F-49',
]);

/** Floating map labels only; not directory, selection, or navigation eligibility. */
export function shouldDisplayMapLabel(roomId: string): boolean {
  return !corridorMapLabelIds.has(roomId);
}
