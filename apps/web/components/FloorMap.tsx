'use client';
import { Component, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import type { Floor, Language, Point, Room, RoomCategory } from '@wayfinding/map-engine';
import { t } from '@wayfinding/i18n';

export const categoryColors: Record<RoomCategory, string> = { classroom: '#a8cfb9', office: '#bfb0d8', laboratory: '#aad1e2', service: '#e4c895', restroom: '#d9bcae', circulation: '#e7ebe2', other: '#bdd0c6' };
type Props = { floor: Floor; rooms: Room[]; language: Language; selectedId: string | null; onSelect: (id: string) => void; route: Point[]; zoom: number; reset: number };
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
      const width = room.id === selectedId ? 210 : Math.max(52, room.code.length * 7 + 18);
      if (x < -width || x > size.width + width || y < -30 || y > size.height + 30) continue;
      if (!occupied.some(item => Math.abs(item.x - x) < (item.width + width) / 2 + 5 && Math.abs(item.y - y) < 32)) {
        occupied.push({ x, y, width }); next.push(room.id);
      }
    }
    const key = next.join('|'); if (key !== signature.current) { signature.current = key; setVisible(new Set(next)); }
  });
  return <>{rooms.map(room => <Html key={room.id} position={[(room.centroid[0] - center[0]) / SCALE, roomY(room, room.id === selectedId), (room.centroid[1] - center[1]) / SCALE]} center zIndexRange={room.id === selectedId ? [30, 20] : [10, 0]}>
    <button type="button" className={`map-label ${selectedId === room.id ? 'selected' : ''} ${visible.has(room.id) ? '' : 'compact-marker'} ${room.polygon ? 'has-outline' : 'marker-only'}`} tabIndex={-1} aria-label={`${room.name[language]}, ${room.code}`} title={`${room.name[language]} · ${room.code}`} aria-pressed={selectedId === room.id} onClick={() => onSelect(room.id)}><span className="map-pin" /><span className="map-label-code">{room.code}</span><span className="map-label-name">{room.name[language]}</span></button>
  </Html>)}</>;
}
function RouteOverlay({ route, center }: { route: Point[]; center: Point }) {
  const points = useMemo(() => route.map(([x, y]) => [(x - center[0]) / SCALE, .095, (y - center[1]) / SCALE] as [number, number, number]), [route, center]);
  if (points.length < 2) return null;
  return <group renderOrder={20}>
    <Line points={points} color="#ffffff" lineWidth={10} depthTest={false} renderOrder={20} />
    <Line points={points} color="#087864" lineWidth={5} depthTest={false} renderOrder={21} />
    {[points[0], points[points.length - 1]].map((point, index) => <group key={index} position={point}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={22}><circleGeometry args={[.19, 32]} /><meshBasicMaterial color="#ffffff" depthTest={false} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .005, 0]} renderOrder={23}>{index ? <planeGeometry args={[.22, .22]} /> : <ringGeometry args={[.07, .13, 32]} />}<meshBasicMaterial color={index ? '#174a71' : '#087864'} depthTest={false} /></mesh>
    </group>)}
  </group>;
}
function Scene(props: Props) {
  const { floor, rooms, language, selectedId, onSelect, route, zoom, reset } = props;
  const { size, camera } = useThree();
  const controls = useRef<OrbitControlsType>(null);
  const center = useMemo<Point>(() => [floor.viewBox[0] + floor.viewBox[2] / 2, floor.viewBox[1] + floor.viewBox[3] / 2], [floor.viewBox]);
  const width = floor.viewBox[2] / SCALE; const depth = floor.viewBox[3] / SCALE;
  const { texture, inkTexture } = useFloorTexture(floor.mapAsset);
  const selected = rooms.find(room => room.id === selectedId);
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
  useEffect(() => {
    const orthographic = camera as THREE.OrthographicCamera;
    orthographic.zoom = Math.min(size.width / (routeFrame?.width ?? width * 1.13), size.height / (routeFrame?.height ?? depth * 1.26)) * zoom;
    orthographic.updateProjectionMatrix();
  }, [camera, size.width, size.height, width, depth, zoom, routeFrame]);
  useEffect(() => {
    const x = routeFrame ? routeFrame.x : selected ? (selected.centroid[0] - center[0]) / SCALE : 0;
    const z = routeFrame ? routeFrame.z : selected ? (selected.centroid[1] - center[1]) / SCALE : 0;
    controls.current?.target.set(x, 0, z); camera.position.copy(CAMERA_OFFSET).add(new THREE.Vector3(x, 0, z)); camera.lookAt(x, 0, z); controls.current?.update();
  }, [selectedId, camera, center, routeFrame]);
  useEffect(() => { controls.current?.target.set(0, 0, 0); camera.position.copy(CAMERA_OFFSET); camera.lookAt(0, 0, 0); controls.current?.update(); }, [reset, camera]);
  return <>
    <ambientLight intensity={1.4} /><directionalLight castShadow position={[-12, 24, -8]} intensity={1.7} shadow-mapSize={[2048, 2048]} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-bias={-.0005} shadow-normalBias={.02} />
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -.035, 0]}><planeGeometry args={[width, depth]} /><shadowMaterial transparent opacity={.13} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.02, 0]}><planeGeometry args={[width, depth]} /><meshBasicMaterial key={inkTexture?.uuid ?? 'loading'} map={inkTexture} transparent opacity={inkTexture ? 1 : 0} depthWrite={false} toneMapped={false} /></mesh>
    {rooms.map(room => <RoomShape key={room.id} room={room} center={center} selected={room.id === selectedId} onSelect={() => onSelect(room.id)} texture={texture} width={width} depth={depth} />)}
    <RouteOverlay route={route} center={center} />
    <MapLabels rooms={rooms} language={language} selectedId={selectedId} onSelect={onSelect} center={center} />
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
