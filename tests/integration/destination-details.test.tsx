// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Floor, Point, Room, RoomContent } from '@wayfinding/map-engine';
import * as THREE from 'three';
import { DestinationDetails } from '../../apps/web/components/DestinationDetails';
import RoomBlockPreview, { roomPreviewFrame } from '../../apps/web/components/RoomBlockPreview';
import { CAMERA_OFFSET } from '../../apps/web/components/FloorMap';
import { roomBlock } from '../../apps/web/components/mapBlocks';
import floor from '../../data/buildings/B03/GF.json';
import { t } from '@wayfinding/i18n';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const room = floor.rooms.find(item => item.polygon || item.displayFootprint) as Room;
const content: RoomContent = {
  id: room.contentRef, description: { en: 'Live room description', ar: 'وصف الغرفة' },
  placeholder: false, image: null, imageAlt: { en: 'Room photo', ar: 'صورة الغرفة' },
  signLanguageVideo: { url: '/media/room.webm', transcript: { en: 'Supplied recording', ar: 'تسجيل مقدم' } },
};

describe('shared full destination card', () => {
  it.each(['en', 'ar'] as const)('restores semantic category text between the dot and code in %s', language => {
    const categories = { classroom: 'categoryClassroom', office: 'categoryOffice', laboratory: 'categoryLaboratory', service: 'categoryService', restroom: 'categoryRestroom', circulation: 'categoryCirculation', other: 'categoryOther' } as const;
    const { rerender } = render(<DestinationDetails room={room} content={content} floor={floor.floor as Floor} language={language} />);
    for (const [category, key] of Object.entries(categories)) {
      rerender(<DestinationDetails room={{ ...room, category: category as Room['category'] }} content={content} floor={floor.floor as Floor} language={language} />);
      const row = screen.getByTestId('room-details').querySelector('.detail-category')!;
      expect(row.firstElementChild?.className).toBe(`category-dot ${category}`);
      expect(row.childNodes[1].textContent).toBe(t(language, key));
      expect(row.lastElementChild?.tagName).toBe('BDI');
      expect(row.lastElementChild?.textContent).toBe(room.code);
    }
  });

  it('retains source detail, identity, evidence and every public action callback', () => {
    const actions = { onClose: vi.fn(), onDestination: vi.fn(), onStart: vi.fn(), onSpeak: vi.fn(), onStop: vi.fn(), onSignLanguage: vi.fn() };
    const qualified = { ...room, navigationPartial: true, navigationNote: { en: 'Mapped approach only', ar: 'المدخل الموضح فقط' } };
    render(<DestinationDetails room={qualified} content={content} floor={floor.floor as Floor} language="en" {...actions} />);
    const card = screen.getByTestId('room-details');
    expect(within(card).getByRole('heading').textContent).toBe(room.name.en);
    expect(within(card).getByText(room.code)).toBeTruthy();
    expect(within(card).getByText(room.name.ar)).toBeTruthy();
    expect(within(card).getByText('Live room description')).toBeTruthy();
    expect(within(card).getByText('Mapped approach only')).toBeTruthy();
    expect(card.querySelector('.geometry-note')?.textContent).toBeTruthy();
    expect(card.querySelector('svg image')?.getAttribute('href')).toBe(floor.floor.mapAsset);
    expect(card.querySelector('svg polygon')?.getAttribute('points')).toBe((room.polygon ?? room.displayFootprint!.polygon).map(point => point.join(',')).join(' '));
    fireEvent.click(within(card).getByRole('button', { name: 'Go here' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Start here' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Replay description' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Stop audio' }));
    fireEvent.click(within(card).getByTestId('sign-language-action'));
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }));
    Object.values(actions).forEach(action => expect(action).toHaveBeenCalledTimes(1));
  });

  it('shows live photo, media, Arabic text and explicitly inactive preview actions', () => {
    render(<DestinationDetails room={room} content={{ ...content, image: '/media/draft.webp' }} floor={floor.floor as Floor} language="ar" preview />);
    const card = screen.getByTestId('cms-detail-preview');
    expect(card.dir).toBe('rtl');
    expect(within(card).getByRole('img').getAttribute('src')).toBe('/media/draft.webp');
    expect(within(card).getByText(content.description.ar)).toBeTruthy();
    expect(card.querySelector('video source')?.getAttribute('src')).toBe('/media/room.webm');
    expect(card.querySelector('.cms-inert-note')?.textContent).toBeTruthy();
    expect([...card.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
  });

  it('uses truthful drawing fallbacks for missing footprints and unavailable WebGL', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const missing = { ...room, polygon: null, displayFootprint: undefined };
    const { rerender } = render(<RoomBlockPreview room={missing} content={content} colorGroups={[]} floor={floor.floor as Floor} language="en" />);
    expect(screen.getByText(/No source-derived footprint/)).toBeTruthy();
    expect(screen.getByRole('region').querySelector('canvas')).toBeNull();
    rerender(<RoomBlockPreview room={room} content={content} colorGroups={[]} floor={floor.floor as Floor} language="en" />);
    expect(screen.getByText(/3D preview unavailable without WebGL/)).toBeTruthy();
    expect(screen.getByRole('region').querySelector('svg image')?.getAttribute('href')).toBe(floor.floor.mapAsset);
  });

  it('fits every supplied room extrusion within the compact projected viewport', () => {
    const [x, z, width, depth] = floor.floor.viewBox;
    const center: Point = [x + width / 2, z + depth / 2];
    for (const sourceRoom of floor.rooms) {
      const block = roomBlock(sourceRoom as Room);
      if (!block) continue;
      const frame = roomPreviewFrame(block, center);
      const camera = new THREE.OrthographicCamera(-160, 160, 95, -95, .1, 150);
      camera.position.copy(CAMERA_OFFSET).add(frame.target);
      camera.lookAt(frame.target);
      camera.zoom = Math.min(320 / Math.max(frame.width * 1.25, .5), 190 / Math.max(frame.height * 1.45, .5));
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      for (const [px, pz] of block.polygon) for (const height of [0, block.height + .027]) {
        const projected = new THREE.Vector3((px - center[0]) / 100, height, (pz - center[1]) / 100).project(camera);
        expect(Math.abs(projected.x), sourceRoom.code).toBeLessThan(.9);
        expect(Math.abs(projected.y), sourceRoom.code).toBeLessThan(.9);
      }
    }
  });

  it('frames source-backed G-07 geometry with finite positive dimensions', () => {
    const vipSalon = floor.rooms.find(item => item.code === 'G-07') as Room;
    const block = roomBlock(vipSalon);
    expect(block).not.toBeNull();
    expect(block?.polygon).toHaveLength(57);
    expect(block?.height).toBeGreaterThan(0);
    const [x, z, width, depth] = floor.floor.viewBox;
    const frame = roomPreviewFrame(block!, [x + width / 2, z + depth / 2]);
    expect(Number.isFinite(frame.width) && frame.width > 0).toBe(true);
    expect(Number.isFinite(frame.height) && frame.height > 0).toBe(true);
    expect(frame.target.toArray().every(Number.isFinite)).toBe(true);
  });
});
