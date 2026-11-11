'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { presentationColor, type ColorGroup, type Floor, type Language, type Point, type Room, type RoomContent } from '@wayfinding/map-engine';
import { BlockShape, CAMERA_OFFSET, MapBoundary, useFloorTexture, useForcedColors } from './FloorMap';
import { roomBlock, type MapBlock } from './mapBlocks';
import { categoryColors } from './palette';
import { SourceThumbnail } from './DestinationDetails';

type Props = { floor: Floor; room: Room; content: RoomContent; colorGroups: ColorGroup[]; language: Language };

export function roomPreviewFrame(block: MapBlock, center: Point) {
  const vertices = block.polygon.flatMap(([x, z]) => [0, block.height].map(y => new THREE.Vector3((x - center[0]) / 100, y, (z - center[1]) / 100)));
  const target = new THREE.Box3().setFromPoints(vertices).getCenter(new THREE.Vector3());
  const right = new THREE.Vector3(CAMERA_OFFSET.z, 0, -CAMERA_OFFSET.x).normalize();
  const up = new THREE.Vector3().crossVectors(CAMERA_OFFSET.clone().normalize(), right).normalize();
  const horizontal = vertices.map(point => point.clone().sub(target).dot(right));
  const vertical = vertices.map(point => point.clone().sub(target).dot(up));
  target.addScaledVector(right, (Math.max(...horizontal) + Math.min(...horizontal)) / 2);
  target.addScaledVector(up, (Math.max(...vertical) + Math.min(...vertical)) / 2);
  return { target, width: Math.max(...horizontal) - Math.min(...horizontal), height: Math.max(...vertical) - Math.min(...vertical) };
}

function PreviewScene({ floor, room, content, language, block }: Props & { block: MapBlock }) {
  const { camera, size } = useThree();
  const { texture } = useFloorTexture(floor.mapAsset);
  const forcedColors = useForcedColors();
  // Keep the floor center for canonical texture UVs, even while framing one room.
  const center = useMemo<Point>(() => [floor.viewBox[0] + floor.viewBox[2] / 2, floor.viewBox[1] + floor.viewBox[3] / 2], [floor.viewBox]);
  const frame = useMemo(() => roomPreviewFrame(block, center), [block.polygon, block.height, center]);
  useEffect(() => {
    const orthographic = camera as THREE.OrthographicCamera;
    orthographic.position.copy(CAMERA_OFFSET).add(frame.target);
    orthographic.lookAt(frame.target);
    orthographic.zoom = Math.min(size.width / Math.max(frame.width * 1.25, .5), size.height / Math.max(frame.height * 1.45, .5));
    orthographic.updateProjectionMatrix();
  }, [camera, frame, size]);
  return <>
    <ambientLight intensity={1.4} /><directionalLight position={[-12, 24, -8]} intensity={1.7} />
    <BlockShape block={block} center={center} texture={texture} width={floor.viewBox[2] / 100} depth={floor.viewBox[3] / 100} forcedColors={forcedColors} />
    <Html center position={[frame.target.x, block.height + .13, frame.target.z]}>
      <span className="map-label selected cms-block-sticker" dir={language === 'ar' ? 'rtl' : 'ltr'}><span className="map-pin" /><span>{content.presentation?.stickerLabel?.[language]?.trim() || room.name[language]}</span><bdi>{room.code}</bdi></span>
    </Html>
  </>;
}

export default function RoomBlockPreview(props: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const block = roomBlock(props.room, props.content, props.colorGroups);
  const color = presentationColor(props.content, props.colorGroups) ?? categoryColors[props.room.category];
  const label = props.content.presentation?.stickerLabel?.[props.language]?.trim() || props.room.name[props.language];
  const fallback = <div className="cms-block-fallback"><SourceThumbnail room={props.room} floor={props.floor} language={props.language} /><div className="cms-block-swatch" dir={props.language === 'ar' ? 'rtl' : 'ltr'}><i style={{ backgroundColor: color }} /><span>{label} <bdi>{props.room.code}</bdi> <code>{color}</code></span></div><p>{!block ? (props.language === 'ar' ? 'لا توجد حدود موثقة لهذه الغرفة. عرض الرسم فقط.' : 'No source-derived footprint is available for this room. Showing drawing detail only.') : (props.language === 'ar' ? 'معاينة المجسم غير متاحة دون WebGL.' : '3D preview unavailable without WebGL. Showing drawing detail only.')}</p></div>;
  return <section className="cms-block-preview" aria-label={props.language === 'ar' ? 'معاينة مجسم الغرفة' : 'Room block preview'} data-room-id={props.room.id} data-color={color}>
    {!block || supported === false ? fallback : <MapBoundary fallback={fallback}><Canvas orthographic camera={{ position: [5, 30, 22], near: .1, far: 150 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]} onCreated={({ gl }) => {
      setSupported(true);
      gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setSupported(false); }, { once: true });
    }}><Suspense fallback={null}><PreviewScene {...props} block={block} /></Suspense></Canvas></MapBoundary>}
  </section>;
}
