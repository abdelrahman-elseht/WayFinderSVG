// @vitest-environment jsdom
import { useEffect, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Room, RoomContent } from '@wayfinding/map-engine';
import { MapLabels } from '../../apps/web/components/FloorMap';
import ground from '../../data/buildings/B03/GF.json';
import first from '../../data/buildings/B03/01.json';

const frames = vi.hoisted(() => new Set<() => void>());
const camera = new THREE.PerspectiveCamera();
camera.position.set(0, 20, 20);
camera.lookAt(0, 0, 0);
camera.updateProjectionMatrix();
camera.updateMatrixWorld();
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ camera, size: { width: 800, height: 600 } }),
  useFrame: (callback: () => void) => useEffect(() => { frames.add(callback); return () => { frames.delete(callback); }; }, [callback]),
}));
vi.mock('@react-three/drei', () => ({ Html: ({ children }: { children: ReactNode }) => <div data-testid="floating-label">{children}</div> }));
afterEach(() => { cleanup(); frames.clear(); });

describe('actual floating map label render', () => {
  it.each(['en', 'ar'] as const)('omits all ten corridor labels, even when selected, but retains other labels in %s', language => {
    const rooms = [...ground.rooms, ...first.rooms] as Room[];
    const corridors = ['B03-GF-G-02', 'B03-GF-G-03', 'B03-GF-G-04', 'B03-01-F-01', 'B03-01-F-02', 'B03-01-F-03', 'B03-01-F-04', 'B03-01-F-05', 'B03-01-F-06', 'B03-01-F-49'];
    const original = rooms.map(room => room.id);
    const { rerender } = render(<MapLabels rooms={rooms} language={language} selectedId={null} onSelect={vi.fn()} center={[0, 0]} />);
    for (const id of corridors) {
      expect(rooms.some(room => room.id === id)).toBe(true);
      rerender(<MapLabels rooms={rooms} language={language} selectedId={id} onSelect={vi.fn()} center={[0, 0]} />);
      expect(screen.queryByRole('button', { name: `${rooms.find(room => room.id === id)!.name[language]}, ${rooms.find(room => room.id === id)!.code}` })).toBeNull();
    }
    expect(screen.getAllByTestId('floating-label')).toHaveLength(rooms.length - 10);
    for (const room of rooms.filter(room => !corridors.includes(room.id))) expect(screen.getByRole('button', { name: `${room.name[language]}, ${room.code}` })).toBeTruthy();
    expect(rooms.map(room => room.id)).toEqual(original);
  });

  it('excludes selected corridors before collision priority while preserving CMS labels and selection', () => {
    const source = ground.rooms.find(room => room.id === 'B03-GF-G-02') as Room;
    const corridor = { ...source, centroid: [0, 0] as [number, number] };
    const other = { ...corridor, id: 'custom-non-corridor', contentRef: 'cms-label', code: 'ROOM' };
    const content = { id: 'cms-label', presentation: { stickerLabel: { en: 'CMS display name', ar: 'CMS Arabic' } } } as RoomContent;
    const onSelect = vi.fn();
    render(<MapLabels rooms={[corridor, other]} contents={[content]} language="en" selectedId={corridor.id} onSelect={onSelect} center={[0, 0]} />);
    act(() => [...frames].forEach(callback => callback()));
    const button = screen.getByRole('button', { name: 'CMS display name, ROOM' });
    expect(button.className).not.toContain('compact-marker');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(button.getAttribute('tabindex')).toBe('-1');
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith(other.id);
  });
});
