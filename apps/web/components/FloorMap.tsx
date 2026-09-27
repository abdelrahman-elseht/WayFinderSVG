'use client';
import { Component, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import type { Floor, Language, MapFeature, Point, Room, RoomCategory } from '@wayfinding/map-engine';
import { t } from '@wayfinding/i18n';
import type { PlaybackPhase } from './routePlayback';

export const categoryColors: Record<RoomCategory, string> = { classroom: '#a8cfb9', office: '#bfb0d8', laboratory: '#aad1e2', service: '#e4c895', restroom: '#d9bcae', circulation: '#e7ebe2', other: '#bdd0c6' };
type Props = { floor: Floor; rooms: Room[]; mapFeatures?: MapFeature[]; language: Language; selectedId: string | null; selectedFeatureId?: string | null; onSelect: (id: string) => void; onSelectFeature?: (id: string) => void; route: Point[]; visibleRoute?: Point[]; playbackPhase?: PlaybackPhase; playbackProgress?: number; followCamera?: boolean; zoom: number; reset: number };
const SCALE = 100;
function useFloorTexture(asset: string) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [inkTexture, setInkTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    let disposed = false; let created: THREE.CanvasTexture | null = null; let ink: THREE.CanvasTexture | null = null; let blobUrl: string | null = null;
    fetch(asset).then(response => { if (!response.ok) throw Error('Map unavailable'); return response.text(); }).then(svg => {
      if (disposed) return;
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      doc.documentElement.setAttribute('width', '4096'); doc.documentElement.setAttribute('height', '2048');
      blobUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' }));
      const image = new Image();
      image.onload = () => {
        if (disposed) return;
        const canvas = document.createElement('canvas'); canvas.width = 4096; canvas.height = 2048;
        const context = canvas.getContext('2d'); if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const inkCanvas = document.createElement('canvas'); inkCanvas.width = 4096; inkCanvas.height = 2048; inkCanvas.getContext('2d')?.drawImage(canvas, 0, 0);
        ink = new THREE.CanvasTexture(inkCanvas); ink.colorSpace = THREE.SRGBColorSpace; ink.anisotropy = 8; setInkTexture(ink);
        context.fillStyle = '#fafbf7'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
        created = new THREE.CanvasTexture(canvas); created.colorSpace = THREE.SRGBColorSpace; created.anisotropy = 8; setTexture(created);
        if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = null;
      };
      image.src = blobUrl;
    }).catch(() => { /* Source image remains available in the accessible fallback. */ });
    return () => { disposed = true; created?.dispose(); ink?.dispose(); if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [asset]);
  return { texture, inkTexture };
}
// Heights communicate spatial hierarchy; they are illustrative, not surveyed dimensions.
const ROOM_HEIGHT = .65;
const ROOM_LIFT = .16;
const CAMERA_OFFSET = new THREE.Vector3(5, 30, 22);
const roomHeight = (room: Room) => room.category === 'circulation' ? .045 : ROOM_HEIGHT;
const roomLift = (room: Room) => room.category === 'circulation' ? 0 : ROOM_LIFT;
const roomY = (room: Room, selected: boolean) => room.polygon?.length ? roomHeight(room) + (selected ? roomLift(room) : 0) + .13 : .18;
const RoomShape = memo(function RoomShape({ room, center, selected, onSelect, texture, width, depth }: { room: Room; center: Point; selected: boolean; onSelect: () => void; texture: THREE.Texture | null; width: number; depth: number }) {
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const targetColor = useMemo(() => new THREE.Color(selected ? '#72baa9' : hovered ? '#a7d7c3' : categoryColors[room.category]), [selected, hovered, room.category]);
  useFrame((_, delta) => {
    const blend = reducedMotion ? 1 : 1 - Math.exp(-delta * 12);
    if (group.current) group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, selected ? roomLift(room) : hovered && room.category !== 'circulation' ? .055 : 0, blend);
    material.current?.color.lerp(targetColor, blend);
  });
  const geometry = useMemo(() => {
    if (!room.polygon?.length) return null;
    const shape = new THREE.Shape();
    room.polygon.forEach(([x, y], index) => index ? shape.lineTo((x - center[0]) / SCALE, -(y - center[1]) / SCALE) : shape.moveTo((x - center[0]) / SCALE, -(y - center[1]) / SCALE));
    shape.closePath();
    const result = new THREE.ExtrudeGeometry(shape, { depth: roomHeight(room), bevelEnabled: false });
    // Cap UVs sample the exact source drawing in plan coordinates, preserving internal linework.
    const position = result.getAttribute('position'); const uv = result.getAttribute('uv');
    for (let i = 0; i < position.count; i++) uv.setXY(i, position.getX(i) / width + .5, position.getY(i) / depth + .5);
    uv.needsUpdate = true;
    return result;
  }, [room.polygon, room.category, center, width, depth]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const border = useMemo(() => room.polygon?.concat([room.polygon[0]]).map(([x, y]) => [(x - center[0]) / SCALE, roomHeight(room) + .027, (y - center[1]) / SCALE] as [number, number, number]), [room.polygon, room.category, center]);
  if (!geometry || !border) return null;
  return <group ref={group}>
    <mesh castShadow receiveShadow geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, .02, 0]} onClick={event => { event.stopPropagation(); onSelect(); }} onPointerOver={event => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)}>
      <meshStandardMaterial key={texture?.uuid ?? 'loading'} attach="material-0" ref={material} map={texture} color={categoryColors[room.category]} roughness={.95} />
      <meshStandardMaterial attach="material-1" color={selected ? '#377f70' : categoryColors[room.category]} roughness={1} />
    </mesh>
    <Line points={border} color={selected ? '#0e6959' : '#edf4ef'} lineWidth={selected ? 2.4 : 1.5} />
    {room.geometryStatus !== 'confirmed' && <Line points={border} color={selected ? '#075749' : '#65887a'} lineWidth={.8} dashed dashSize={.11} gapSize={.07} />}
  </group>;
});
const featureColors: Record<MapFeature['kind'], string> = { cafeteria: '#d5a86d', escalator: '#90b9c7', elevator: '#9d9cc6' };
const featureHeight = (feature: MapFeature) => feature.polygon?.length ? .42 : .16;
const FeatureShape = memo(function FeatureShape({ feature, center, selected, onSelect }: { feature: MapFeature; center: Point; selected: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const color = featureColors[feature.kind];
  const geometry = useMemo(() => {
    if (!feature.polygon?.length) return null;
    const shape = new THREE.Shape(); feature.polygon.forEach(([x, y], index) => index ? shape.lineTo((x - center[0]) / SCALE, -(y - center[1]) / SCALE) : shape.moveTo((x - center[0]) / SCALE, -(y - center[1]) / SCALE)); shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: featureHeight(feature), bevelEnabled: false });
  }, [feature, center]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const lift = selected ? .14 : hovered ? .055 : 0;
  useFrame((_, delta) => { const blend = reducedMotion ? 1 : 1 - Math.exp(-delta * 12); if (group.current) group.current.position.y = THREE.MathUtils.lerp(group.current.position.y, lift, blend); });
  const border = feature.polygon?.length ? feature.polygon.concat([feature.polygon[0]]).map(([x, y]) => [(x - center[0]) / SCALE, featureHeight(feature) + .04, (y - center[1]) / SCALE] as [number, number, number]) : null;
  const markerPosition: [number, number, number] = [(feature.anchor[0] - center[0]) / SCALE, featureHeight(feature) + .02, (feature.anchor[1] - center[1]) / SCALE];
  return <group ref={group} onClick={event => { event.stopPropagation(); onSelect(); }} onPointerOver={event => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)}>
    {geometry ? <mesh castShadow receiveShadow geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, .03, 0]}><meshStandardMaterial color={color} roughness={.9} /><meshStandardMaterial attach="material-1" color={selected ? '#6d6650' : '#81765b'} roughness={1} /></mesh> : <mesh castShadow receiveShadow position={markerPosition} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.22, 24]} /><meshStandardMaterial color={selected ? '#6d6650' : color} roughness={.8} /></mesh>}
    {border && <Line points={border} color={selected ? '#594c38' : color} lineWidth={selected ? 2.6 : 1.8} dashed={feature.geometryStatus !== 'confirmed'} dashSize={.12} gapSize={.08} />}
    {!border && <Line points={[[markerPosition[0] - .25, markerPosition[1], markerPosition[2]], [markerPosition[0] + .25, markerPosition[1], markerPosition[2]]] as [number, number, number][]} color={selected ? '#594c38' : color} lineWidth={selected ? 2.4 : 1.4} />}
  </group>;
});
type LabelBox = { x: number; y: number; width: number; height: number };
const overlaps = (left: LabelBox, right: LabelBox) => Math.abs(left.x - right.x) < (left.width + right.width) / 2 + 5 && Math.abs(left.y - right.y) < (left.height + right.height) / 2 + 5;
const featureLabelStatus = (feature: MapFeature, language: Language) => feature.kind === 'elevator' ? t(language, 'verticalTransition') : t(language, feature.geometryStatus === 'unknown' ? 'mapFeatureUnknown' : 'mapFeatureCandidate');
const featureLabelWidth = (feature: MapFeature, language: Language) => Math.max(150, feature.name[language].length * 8 + featureLabelStatus(feature, language).length * 4.8 + 42);
const roomLabelWidth = (room: Room, language: Language, selectedId: string | null) => room.id === selectedId ? 210 : Math.max(52, room.name[language].length * 7 + room.code.length * 7 + 38);
function FeatureLabels({ features, rooms, language, selectedId, selectedFeatureId, onSelectFeature, center }: { features: MapFeature[]; rooms: Room[]; language: Language; selectedId: string | null; selectedFeatureId?: string | null; onSelectFeature: (id: string) => void; center: Point }) {
  const { camera, size } = useThree();
  const [offsets, setOffsets] = useState<Record<string, [number, number]>>({});
  const signature = useRef('');
  const vector = useMemo(() => new THREE.Vector3(), []);
  const roomVector = useMemo(() => new THREE.Vector3(), []);
  const candidates = useMemo(() => [-480, -360, -240, -120, 0, 120, 240, 360, 480].flatMap(x => [-336, -252, -168, -84, 0, 84, 168, 252, 336].map(y => [x, y] as [number, number])).sort((a, b) => Math.hypot(...a) - Math.hypot(...b)), []);
  useFrame(() => {
    const occupied: LabelBox[] = rooms.map(room => {
      roomVector.set((room.centroid[0] - center[0]) / SCALE, roomY(room, room.id === selectedId), (room.centroid[1] - center[1]) / SCALE).project(camera);
      return { x: (roomVector.x + 1) * size.width / 2, y: (1 - roomVector.y) * size.height / 2, width: roomLabelWidth(room, language, selectedId), height: room.id === selectedId ? 34 : 25 };
    });
    const controls = document.querySelector('.map-control-stack')?.getBoundingClientRect();
    if (controls) occupied.push({ x: (controls.left + controls.right) / 2, y: (controls.top + controls.bottom) / 2, width: controls.width + 10, height: controls.height + 10 });
    const featureBoxes: LabelBox[] = controls ? [{ x: (controls.left + controls.right) / 2, y: (controls.top + controls.bottom) / 2, width: controls.width + 10, height: controls.height + 10 }] : [];
    const next: Record<string, [number, number]> = {};
    const orderedFeatures = [...features].sort((a, b) => a.id.localeCompare(b.id));
    for (const feature of orderedFeatures) {
      vector.set((feature.anchor[0] - center[0]) / SCALE, featureHeight(feature) + .24, (feature.anchor[1] - center[1]) / SCALE).project(camera);
      const anchorX = (vector.x + 1) * size.width / 2;
      const anchorY = (1 - vector.y) * size.height / 2;
      const width = featureLabelWidth(feature, language);
      const height = 35;
      const box = (offset: [number, number]) => ({ x: anchorX + offset[0], y: anchorY + offset[1], width, height });
      const offset = candidates.find(([x, y]) => anchorX + x - width / 2 >= 0 && anchorX + x + width / 2 <= size.width && anchorY + y - height / 2 >= 0 && anchorY + y + height / 2 <= size.height && !occupied.some(existing => overlaps(existing, box([x, y])))) ?? candidates.find(candidate => !featureBoxes.some(existing => overlaps(existing, box(candidate)))) ?? [0, 0];
      const placed = box(offset);
      featureBoxes.push(placed);
      occupied.push(placed);
      next[feature.id] = offset;
    }
    const nextSignature = JSON.stringify(next);
    if (nextSignature !== signature.current) { signature.current = nextSignature; setOffsets(next); }
  });
  return <>{features.map(feature => <Html key={feature.id} position={[(feature.anchor[0] - center[0]) / SCALE, featureHeight(feature) + .24, (feature.anchor[1] - center[1]) / SCALE]} center zIndexRange={selectedFeatureId === feature.id ? [45, 35] : [35, 25]} style={{ pointerEvents: 'none' }}><div style={{ transform: `translate(${offsets[feature.id]?.[0] ?? 0}px, ${offsets[feature.id]?.[1] ?? 0}px)`, pointerEvents: 'none' }}><button type="button" data-feature-id={feature.id} className={`map-feature-label ${selectedFeatureId === feature.id ? 'selected' : ''} ${feature.geometryStatus === 'unknown' ? 'unknown' : 'candidate'}`} aria-label={`${feature.name[language]}, ${featureLabelStatus(feature, language)}`} aria-pressed={selectedFeatureId === feature.id} onClick={() => onSelectFeature(feature.id)} style={{ pointerEvents: 'auto' }}><span className={`map-feature-icon ${feature.kind}`} aria-hidden="true" /><span>{feature.name[language]}</span><small>{featureLabelStatus(feature, language)}</small></button></div></Html>)}</>;
}
function MapLabels({ rooms, language, selectedId, onSelect, center }: Pick<Props, 'rooms' | 'language' | 'selectedId' | 'onSelect'> & { center: Point }) {
  const { camera, size } = useThree();
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const signature = useRef('');
  const vector = useMemo(() => new THREE.Vector3(), []);
  const orderedRooms = useMemo(() => [...rooms].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId)), [rooms, selectedId]);
  useFrame(() => {
    const occupied: { x: number; y: number; width: number }[] = []; const next: string[] = [];
    for (const room of orderedRooms) {
      vector.set((room.centroid[0] - center[0]) / SCALE, roomY(room, room.id === selectedId), (room.centroid[1] - center[1]) / SCALE).project(camera);
      const x = (vector.x + 1) * size.width / 2; const y = (1 - vector.y) * size.height / 2;
      const labelWidth = room.name[language].length * 7 + room.code.length * 7 + 38;
      const width = room.id === selectedId ? 210 : Math.max(52, labelWidth);
      if (x < -width || x > size.width + width || y < -30 || y > size.height + 30) continue;
      if (!occupied.some(item => Math.abs(item.x - x) < (item.width + width) / 2 + 5 && Math.abs(item.y - y) < 32)) {
        occupied.push({ x, y, width }); next.push(room.id);
      }
    }
    const key = next.join('|'); if (key !== signature.current) { signature.current = key; setVisible(new Set(next)); }
  });
  return <>{rooms.map(room => <Html key={room.id} position={[(room.centroid[0] - center[0]) / SCALE, roomY(room, room.id === selectedId), (room.centroid[1] - center[1]) / SCALE]} center zIndexRange={room.id === selectedId ? [30, 20] : [10, 0]}>
    <button type="button" className={`map-label ${selectedId === room.id ? 'selected' : ''} ${visible.has(room.id) ? '' : 'compact-marker'} ${room.polygon ? 'has-outline' : 'marker-only'}`} tabIndex={-1} aria-label={`${room.name[language]}, ${room.code}`} title={`${room.name[language]} · ${room.code}`} aria-pressed={selectedId === room.id} onClick={() => onSelect(room.id)}><span className="map-pin" /><span className="map-label-name">{room.name[language]}</span><span className="map-label-code">{room.code}</span></button>
  </Html>)}</>;
}
function RouteOverlay({ route, fullRoute = route, center }: { route: Point[]; fullRoute?: Point[]; center: Point }) {
  const points = useMemo(() => route.map(([x, y]) => [(x - center[0]) / SCALE, .095, (y - center[1]) / SCALE] as [number, number, number]), [route, center]);
  const endpointPoints = useMemo(() => fullRoute.map(([x, y]) => [(x - center[0]) / SCALE, .095, (y - center[1]) / SCALE] as [number, number, number]), [fullRoute, center]);
  if (points.length < 2) return null;
  return <group renderOrder={20}>
    <Line points={points} color="#ffffff" lineWidth={10} depthTest={false} renderOrder={20} />
    <Line points={points} color="#087864" lineWidth={5} depthTest={false} renderOrder={21} />
    {[endpointPoints[0], endpointPoints[endpointPoints.length - 1]].map((point, index) => <group key={index} position={point}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={22}><circleGeometry args={[.19, 32]} /><meshBasicMaterial color="#ffffff" depthTest={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .005, 0]} renderOrder={23}>{index ? <planeGeometry args={[.22, .22]} /> : <ringGeometry args={[.07, .13, 32]} />}<meshBasicMaterial color={index ? '#174a71' : '#087864'} depthTest={false} /></mesh>
    </group>)}
  </group>;
}
function Scene(props: Props) {
  const { floor, rooms, mapFeatures = [], language, selectedId, selectedFeatureId, onSelect, onSelectFeature = () => undefined, route, visibleRoute = route, playbackPhase = 'idle', followCamera = false, zoom, reset } = props;
  const { size, camera } = useThree();
  const controls = useRef<OrbitControlsType>(null);
  const center = useMemo<Point>(() => [floor.viewBox[0] + floor.viewBox[2] / 2, floor.viewBox[1] + floor.viewBox[3] / 2], [floor.viewBox]);
  const width = floor.viewBox[2] / SCALE; const depth = floor.viewBox[3] / SCALE;
  const { texture, inkTexture } = useFloorTexture(floor.mapAsset);
  const selected = rooms.find(room => room.id === selectedId);
  const selectedFeature = mapFeatures.find(feature => feature.id === selectedFeatureId);
  const routeFrame = useMemo(() => {
    if (route.length < 2) return null;
    const xs = route.map(point => (point[0] - center[0]) / SCALE); const zs = route.map(point => (point[1] - center[1]) / SCALE);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2; const z = (Math.min(...zs) + Math.max(...zs)) / 2;
    const right = new THREE.Vector3(CAMERA_OFFSET.z, 0, -CAMERA_OFFSET.x).normalize();
    const up = new THREE.Vector3().crossVectors(CAMERA_OFFSET.clone().normalize(), right).normalize();
    const projected = route.map(([px, py]) => new THREE.Vector3((px - center[0]) / SCALE - x, 0, (py - center[1]) / SCALE - z));
    const horizontal = projected.map(point => point.dot(right)); const vertical = projected.map(point => point.dot(up));
    return { x, z, width: Math.max(...horizontal.map(Math.abs)) * 2 + 4, height: Math.max(...vertical.map(Math.abs)) * 2 + 4 };
  }, [route, center]);
  // During playback, pause, stop, and reset the overlay is the clipped render-time
  // segment. Only completion (including reduced-motion completion) uses the full route.
  const renderRoute = playbackPhase === 'complete' ? route : visibleRoute;
  useEffect(() => {
    const orthographic = camera as THREE.OrthographicCamera;
    orthographic.zoom = Math.min(size.width / (routeFrame?.width ?? width * 1.13), size.height / (routeFrame?.height ?? depth * 1.26)) * zoom;
    orthographic.updateProjectionMatrix();
  }, [camera, size.width, size.height, width, depth, zoom, routeFrame]);
  useEffect(() => {
    const focus = selectedFeature?.anchor ?? selected?.centroid;
    const x = routeFrame ? routeFrame.x : focus ? (focus[0] - center[0]) / SCALE : 0;
    const z = routeFrame ? routeFrame.z : focus ? (focus[1] - center[1]) / SCALE : 0;
    controls.current?.target.set(x, 0, z); camera.position.copy(CAMERA_OFFSET).add(new THREE.Vector3(x, 0, z)); camera.lookAt(x, 0, z); controls.current?.update();
  }, [selectedId, selectedFeatureId, selected, selectedFeature, camera, center, routeFrame]);
  useEffect(() => {
    if (!followCamera || !visibleRoute?.length) return;
    const point = visibleRoute[visibleRoute.length - 1];
    const x = (point[0] - center[0]) / SCALE; const z = (point[1] - center[1]) / SCALE;
    controls.current?.target.lerp(new THREE.Vector3(x, 0, z), .18);
    camera.position.lerp(CAMERA_OFFSET.clone().add(new THREE.Vector3(x, 0, z)), .18);
    camera.lookAt(controls.current?.target ?? new THREE.Vector3(x, 0, z));
  }, [followCamera, visibleRoute, center, camera]);
  useEffect(() => { controls.current?.target.set(0, 0, 0); camera.position.copy(CAMERA_OFFSET); camera.lookAt(0, 0, 0); controls.current?.update(); }, [reset, camera]);
  return <>
    <ambientLight intensity={1.4} /><directionalLight castShadow position={[-12, 24, -8]} intensity={1.7} shadow-mapSize={[2048, 2048]} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-bias={-.0005} shadow-normalBias={.02} />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -.035, 0]}><planeGeometry args={[width, depth]} /><shadowMaterial transparent opacity={.13} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.02, 0]}><planeGeometry args={[width, depth]} /><meshBasicMaterial key={inkTexture?.uuid ?? 'loading'} map={inkTexture} transparent opacity={inkTexture ? 1 : 0} depthWrite={false} toneMapped={false} /></mesh>
    {rooms.map(room => <RoomShape key={room.id} room={room} center={center} selected={room.id === selectedId} onSelect={() => onSelect(room.id)} texture={texture} width={width} depth={depth} />)}
    {mapFeatures.map(feature => <FeatureShape key={feature.id} feature={feature} center={center} selected={feature.id === selectedFeatureId} onSelect={() => onSelectFeature(feature.id)} />)}
    <RouteOverlay route={renderRoute} fullRoute={route} center={center} />
    <MapLabels rooms={rooms} language={language} selectedId={selectedId} onSelect={onSelect} center={center} />
    <FeatureLabels features={mapFeatures} rooms={rooms} language={language} selectedId={selectedId} selectedFeatureId={selectedFeatureId} onSelectFeature={onSelectFeature} center={center} />
    <OrbitControls ref={controls} enableRotate={false} enableDamping={false} minZoom={8} maxZoom={160} mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }} />
  </>;
}
class MapBoundary extends Component<{ children: React.ReactNode; fallback: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? this.props.fallback : this.props.children; }
}
export default function FloorMap(props: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => { try { const canvas = document.createElement('canvas'); const gl = canvas.getContext('webgl2'); setSupported(Boolean(gl)); gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { setSupported(false); } }, []);
  const fallback = <div className="map-fallback"><img src={props.floor.mapAsset} alt={t(props.language, 'sourceDrawing')} /><p>{t(props.language, 'mapKeyboardHelp')}</p></div>;
  if (supported === false) return fallback;
  if (supported === null) return <div className="map-loading">{t(props.language, 'loading')}</div>;
  return <MapBoundary fallback={fallback}><Canvas shadows orthographic camera={{ position: [5, 30, 22], zoom: 25, near: .1, far: 150 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]} aria-label={t(props.language, 'map')}><Suspense fallback={null}><Scene {...props} /></Suspense></Canvas></MapBoundary>;
}
