// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NavigationEditor from '../../apps/web/components/admin/NavigationEditor';
import type { Session } from '../../apps/web/components/admin/editor-model';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe.each(['GF', '01'] as const)('walkable layer on %s', floorId => {
  it('hides polygon partition strokes in both canvases without hiding or changing graph edges', async () => {
    const graph = {
      nodes: [
        { id: 'west', buildingId: 'B03', floorId, point: [10, 50], type: 'junction', status: 'candidate' },
        { id: 'east', buildingId: 'B03', floorId, point: [90, 50], type: 'junction', status: 'candidate' },
      ],
      edges: [{ id: 'edge', from: 'west', to: 'east', floorId, geometry: [[10, 50], [90, 50]], distance: 80 }],
      walls: [],
      navigableAreas: [[[0, 0], [100, 0], [100, 100]], [[0, 0], [100, 100], [0, 100]]],
    };
    const loaded = {
      revision: 'walkable-layer', graph, runtimeGraph: graph, evidence: [], candidates: [], config: {}, spines: [],
      floor: { floor: { id: floorId, viewBox: [0, 0, 100, 100], mapAsset: '/map.svg' }, rooms: [] },
    } as unknown as Session;
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => loaded });
    vi.stubGlobal('fetch', fetch);
    render(<NavigationEditor floorId={floorId} />);
    await screen.findByRole('button', { name: 'Graph node west' });

    fireEvent.click(screen.getByLabelText('Walkable areas visibility'));
    const preview = screen.getByLabelText('Walkable area preview');
    expect(preview.getAttribute('pointer-events')).toBe('none');
    expect(preview.querySelectorAll('polygon')).toHaveLength(2);
    for (const polygon of preview.querySelectorAll('polygon')) {
      expect(polygon.getAttribute('stroke')).toBe('none');
      expect(polygon.getAttribute('fill')).toBe('#50a88d');
      expect(polygon.getAttribute('fill-opacity')).toBe('.13');
    }
    expect(preview.querySelector('polygon')?.getAttribute('points')).toBe('0,0 100,0 100,100');

    fireEvent.click(screen.getByLabelText('Side-by-side comparison'));
    const original = screen.getByLabelText('Original route comparison').querySelectorAll('polygon');
    expect(original).toHaveLength(2);
    for (const polygon of original) expect(polygon.getAttribute('stroke')).toBe('none');

    const edge = screen.getByRole('button', { name: 'Navigation edge edge' });
    expect(edge.getAttribute('data-edge')).toBe('edge');
    expect(edge.getAttribute('pointer-events')).toBe('stroke');
    fireEvent.keyDown(edge, { key: 'Enter' });
    expect(screen.getByLabelText('Navigation edge inspector')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Edit edge bends' }) as HTMLButtonElement).disabled).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
