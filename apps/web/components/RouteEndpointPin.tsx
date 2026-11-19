'use client';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BLOCK_HEIGHT } from './mapBlocks';
import { highContrastMapPalette, mapPalette } from './palette';

type Props = { role: 'origin' | 'destination'; position: [number, number, number]; forcedColors: boolean };

const drop = new THREE.Shape();
drop.moveTo(0, 0);
drop.bezierCurveTo(-.08, .16, -.27, .33, -.27, .49);
drop.bezierCurveTo(-.27, .85, .27, .85, .27, .49);
drop.bezierCurveTo(.27, .33, .08, .16, 0, 0);
const bevel = { depth: .12, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .025, bevelThickness: .025, curveSegments: 16 };
// Clear the illustrative roofs/label anchors; this is not surveyed elevation.
const REST_Y = BLOCK_HEIGHT * 1.35;
const BOB_AMPLITUDE = .035;
const PIN_RENDER_ORDER = 30;

/** Decorative scene units only: the fixed scene anchor is the route endpoint. */
export function RouteEndpointPin({ role, position, forcedColors }: Props) {
  const face = useRef<THREE.Group>(null);
  const floating = useRef<THREE.Group>(null);
  const motion = useRef(false);
  const visible = useRef(true);
  const elapsed = useRef(0);
  const { camera, invalidate, frameloop } = useThree();
  const palette = forcedColors ? highContrastMapPalette : mapPalette;
  const color = role === 'origin' ? palette.route : palette.routeDestination;

  const setHeight = (height: number) => {
    if (floating.current) floating.current.position.y = height;
  };

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      visible.current = document.visibilityState !== 'hidden';
      motion.current = visible.current && !media.matches && !forcedColors;
      if (!motion.current) setHeight(REST_Y);
      if (visible.current) invalidate();
    };
    update();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [forcedColors, invalidate]);

  useFrame((_, delta) => {
    if (!visible.current) return;
    // Face the camera even near overhead; thickness and bevels remain real 3D.
    face.current?.quaternion.copy(camera.quaternion);
    if (!motion.current || !floating.current) return;
    elapsed.current += Math.min(delta, .05);
    setHeight(REST_Y + Math.sin(elapsed.current * 1.9 + (role === 'destination' ? Math.PI : 0)) * BOB_AMPLITUDE);
    if (frameloop === 'demand') invalidate();
  });

  // R3F owns/disposes these declarative geometries and materials on unmount.
  // Pins are noninteractive annotations, not a current-location/access claim.
  // Join the transparent ink pass at full opacity, with real depth testing/writes.
  // Repeat the order on nested groups: Three resets groupOrder at each group.
  return <group name={`route-${role}-anchor`} position={position} userData={{ endpointRole: role }} renderOrder={PIN_RENDER_ORDER}>
    <group name="endpoint-float" ref={floating} position={[0, REST_Y, 0]} renderOrder={PIN_RENDER_ORDER}>
      <group name="endpoint-face" ref={face} renderOrder={PIN_RENDER_ORDER}>
        <mesh name="endpoint-white-trim" renderOrder={26}>
          <extrudeGeometry args={[drop, bevel]} />
          <meshStandardMaterial color={palette.endpointUnderlay} roughness={.35} transparent opacity={1} depthTest depthWrite />
        </mesh>
        <mesh name="endpoint-drop" position={[0, .055, .07]} scale={[.86, .88, .7]} renderOrder={27}>
          <extrudeGeometry args={[drop, bevel]} />
          <meshStandardMaterial color={color} roughness={.3} metalness={.08} transparent opacity={1} depthTest depthWrite />
        </mesh>
        <mesh name="endpoint-badge" position={[0, .49, .2]} renderOrder={28}>
          <circleGeometry args={[.13, 32]} />
          <meshBasicMaterial color={palette.endpointUnderlay} transparent opacity={1} depthTest depthWrite />
        </mesh>
        <mesh name={role === 'origin' ? 'origin-circle-glyph' : 'destination-diamond-glyph'} position={[0, .49, .21]} rotation={[0, 0, role === 'destination' ? Math.PI / 4 : 0]} renderOrder={29}>
          {role === 'origin' ? <torusGeometry args={[.059, .018, 8, 24]} /> : <boxGeometry args={[.095, .095, .025]} />}
          <meshBasicMaterial color={color} transparent opacity={1} depthTest depthWrite />
        </mesh>
      </group>
    </group>
  </group>;
}
