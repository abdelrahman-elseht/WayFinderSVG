export type Language = 'en' | 'ar';
export type Localized = Record<Language, string>;
export type Point = [number, number];
export type EvidenceStatus = 'confirmed' | 'candidate' | 'unknown';
export type RoomCategory = 'classroom' | 'office' | 'laboratory' | 'service' | 'restroom' | 'circulation' | 'other';
export type RoomAvailabilityStatus = 'available' | 'unavailable';
export interface RoomAvailability {
  status: RoomAvailabilityStatus;
  reason: Localized;
  /** Optional operator/configuration reference; it does not imply physical access. */
  configurationId?: string;
}
export interface Provenance {
  source: string;
  page: number;
  note: string;
  status: EvidenceStatus;
}
export interface Room {
  id: string;
  code: string;
  buildingId: string;
  floorId: string;
  name: Localized;
  category: RoomCategory;
  polygon: Point[] | null;
  geometryRef: string | null;
  centroid: Point;
  doorNodeId: string | null;
  aliases: string[];
  contentRef: string;
  /** Source-derived endpoint qualification, e.g. a suite entrance or a void perimeter. */
  navigationNote?: Localized;
  /** True when the supplied plan does not cover the final connection to this destination. */
  navigationPartial?: boolean;
  /** Optional operational availability; omission preserves the legacy available default. */
  availability?: RoomAvailability;
  public: boolean;
  geometryStatus: EvidenceStatus;
  provenance: Provenance[];
}
export interface RoomContent {
  id: string;
  description: Localized;
  placeholder: boolean;
  image: string | null;
  imageAlt: Localized;
}
export interface Building { id: string; name: Localized; floorIds: string[] }
export interface Floor {
  id: string;
  buildingId: string;
  name: Localized;
  level: number;
  viewBox: [number, number, number, number];
  mapAsset: string;
  metersPerUnit: number | null;
  calibrationStatus: EvidenceStatus;
}
export interface Kiosk {
  id: string;
  buildingId: string;
  floorId: string;
  name: Localized;
  nodeId: string | null;
  status: EvidenceStatus;
}
export type NodeType = 'junction' | 'door' | 'entrance' | 'elevator' | 'stairs' | 'kiosk';
export type PathType = 'corridor' | 'door' | 'entrance' | 'stairs' | 'elevator';
export interface NavigationNode {
  id: string;
  buildingId: string;
  floorId: string;
  point: Point;
  type: NodeType;
  roomId?: string;
  status: EvidenceStatus;
}
export interface NavigationEdge {
  id: string;
  from: string;
  to: string;
  floorId: string;
  pathType: PathType;
  distance: number;
  distanceUnit: 'map-unit' | 'meter';
  accessibility: 'confirmed' | 'inaccessible' | 'unknown';
  restriction: 'open' | 'closed' | 'unknown';
  status: EvidenceStatus;
  bidirectional: boolean;
  geometry: Point[];
}
export interface NavigationGraph {
  /** Drawing routing uses computationally checked source geometry without claiming a site inspection. */
  routingPolicy?: 'verified-only' | 'drawing-based';
  nodes: NavigationNode[];
  edges: NavigationEdge[];
  metersPerUnit: number | null;
  calibrationStatus: EvidenceStatus;
  navigableAreas: Point[][];
  walls: [Point, Point][];
  status: EvidenceStatus;
}
/** Source geometry only; this entity does not create a navigable floor connection. */
export interface MapFeature {
  id: string;
  buildingId: string;
  floorId: string;
  name: Localized;
  kind: 'escalator' | 'elevator';
  polygon: Point[];
  geometryStatus: EvidenceStatus;
  accessibility: EvidenceStatus;
  connectedFloorIds: string[];
  provenance: Provenance[];
}
export interface FloorData {
  schemaVersion: 1;
  building: Building;
  floor: Floor;
  rooms: Room[];
  kiosks: Kiosk[];
  mapFeatures?: MapFeature[];
  /** Explicit planning origin; never presented as the physical kiosk or current position. */
  navigationDefaults?: { startRoomId: string };
}
export type InstructionType = 'start' | 'continue' | 'slight-left' | 'slight-right' | 'left' | 'right' | 'enter-corridor' | 'stairs' | 'elevator' | 'destination-left' | 'destination-right' | 'arrival';
export interface RouteInstruction {
  type: InstructionType;
  text: Localized;
  nodeId: string;
  distance: number | null;
  distanceUnit: 'map-unit' | 'meter';
}
export interface RouteResult {
  status: 'ok' | 'unavailable' | 'unconfirmed' | 'invalid';
  reason: Localized | null;
  nodeIds: string[];
  edgeIds: string[];
  points: Point[];
  distance: number;
  distanceUnit: 'map-unit' | 'meter';
  instructions: RouteInstruction[];
}
