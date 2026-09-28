import type { RoomCategory } from '@wayfinding/map-engine';

export const categoryColors: Record<RoomCategory, string> = {
  classroom: '#D9ECE9',
  office: '#DDE8F4',
  laboratory: '#F0E4C9',
  service: '#E9DDBF',
  restroom: '#E8E0DC',
  circulation: '#E5EBEF',
  other: '#DCEAF6',
};

export const categorySwatchColors: Record<RoomCategory, { background: string; foreground: string }> = {
  classroom: { background: '#D9ECE9', foreground: '#006E70' },
  office: { background: '#DDE8F4', foreground: '#0B356F' },
  laboratory: { background: '#F0E4C9', foreground: '#765300' },
  service: { background: '#E9DDBF', foreground: '#765300' },
  restroom: { background: '#E8E0DC', foreground: '#65493D' },
  circulation: { background: '#E5EBEF', foreground: '#435766' },
  other: { background: '#DCEAF6', foreground: '#0B356F' },
};

export const mapPalette = {
  backing: '#F5F9FA',
  ink: '#0B356F',
  hover: '#AFCFCB',
  selection: '#0B356F',
  selectionSide: '#082954',
  candidate: '#765300',
  candidateSelected: '#0B356F',
  route: '#006E70',
  routeDestination: '#0B356F',
  routeUnderlay: '#FFFFFF',
  endpointUnderlay: '#FFFFFF',
} as const;

export const highContrastMapPalette = {
  room: '#F2F2F2',
  roomSide: '#D6D6D6',
  hover: '#E6EEF8',
  selection: '#FFFFFF',
  selectionSide: '#0B356F',
  outline: '#1F2933',
  selectionOutline: '#0B356F',
  candidate: '#1F2933',
  route: '#006E70',
  routeDestination: '#0B356F',
  routeUnderlay: '#FFFFFF',
  endpointUnderlay: '#FFFFFF',
} as const;

export const interactionColors = {
  focus: '#0B356F',
  action: '#006E70',
  actionHover: '#00575A',
  qualification: '#765300',
} as const;
