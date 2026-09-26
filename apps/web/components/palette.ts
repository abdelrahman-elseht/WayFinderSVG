import type { RoomCategory } from '@wayfinding/map-engine';

export const categoryColors: Record<RoomCategory, string> = {
  classroom: '#D5E8E3',
  office: '#CEDCF0',
  laboratory: '#D6E5EC',
  service: '#EEE1C9',
  restroom: '#EDD9D2',
  circulation: '#EBEDEF',
  other: '#DEDDE9',
};

export const categorySwatchColors: Record<RoomCategory, { background: string; foreground: string }> = {
  classroom: { background: '#D5E8E3', foreground: '#12645F' },
  office: { background: '#CEDCF0', foreground: '#214B8A' },
  laboratory: { background: '#D6E5EC', foreground: '#315E76' },
  service: { background: '#EEE1C9', foreground: '#775018' },
  restroom: { background: '#EDD9D2', foreground: '#75483D' },
  circulation: { background: '#EBEDEF', foreground: '#4E5B66' },
  other: { background: '#DEDDE9', foreground: '#554E78' },
};

export const mapPalette = {
  backing: '#F7F8F8',
  ink: '#5E6870',
  hover: '#AFC8E2',
  selection: '#214B8A',
  selectionSide: '#18396A',
  candidate: '#4E6877',
  candidateSelected: '#214B8A',
  route: '#12645F',
  routeDestination: '#214B8A',
  routeUnderlay: '#FFFFFF',
  endpointUnderlay: '#FFFFFF',
} as const;

export const highContrastMapPalette = {
  room: '#F2F2F2',
  roomSide: '#D6D6D6',
  hover: '#E6EEF8',
  selection: '#FFFFFF',
  selectionSide: '#214B8A',
  outline: '#1F2933',
  selectionOutline: '#214B8A',
  candidate: '#1F2933',
  route: '#12645F',
  routeDestination: '#214B8A',
  routeUnderlay: '#FFFFFF',
  endpointUnderlay: '#FFFFFF',
} as const;

export const interactionColors = {
  focus: '#214B8A',
  action: '#12645F',
  actionHover: '#0D504C',
  qualification: '#775018',
} as const;
