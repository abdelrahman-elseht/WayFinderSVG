// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminFloorView from '../../apps/web/components/admin/AdminFloorView';
import groundFloor from '../../data/buildings/B03/GF.json';
import groundGraph from '../../data/buildings/B03/GF.graph.json';
import firstFloor from '../../data/buildings/B03/01.json';
import firstGraph from '../../data/buildings/B03/01.graph.json';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('authenticated admin floor view', () => {
  it('passes the selected floor to the editable navigation editor and exposes Floor 01 draft semantics', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return Response.json({ candidate: 'draft-' + 'a'.repeat(32) });
      const floorId = new URL(String(input), 'http://localhost').searchParams.get('floorId');
      const data = floorId === '01' ? firstFloor : groundFloor;
      const graph = floorId === '01' ? firstGraph : groundGraph;
      return Response.json({
        ...(floorId === '01' ? {
          floorIdentity: { buildingId: 'B03', floorId: '01' },
          sourceSpines: [{ id: 'spine:0', index: 0, kind: 'spine', coordinates: [[700, 600], [710, 610]], sourceReferences: ['scripts/semantic-map/floors/01.json#/corridorSpines/0'] }],
          evidence: {
            graphReview: { status: 'candidate', source: 'data/buildings/B03/01.review.json' },
            sourceStatusExceptions: [{ roomId: 'B03-01-01', status: 'source-status-exception' }],
            shortestPathReference: { status: 'reviewed', source: 'data/buildings/B03/01.shortest-paths.review.json' },
          },
          diagnostics: [],
          graphSimplification: { nodeCount: graph.nodes.length, edgeCount: graph.edges.length },
        } : {}),
        revision: 'revision',
        spines: floorId === '01'
          ? [{ id: 'spine:0', index: 0, kind: 'spine', coordinates: [[700, 600], [710, 610]], sourceReferences: ['scripts/semantic-map/floors/01.json#/corridorSpines/0'] }]
          : [],
        floor: data,
        graph,
        ...(floorId === 'GF' ? { runtimeGraph: graph, config: {}, evidence: [] } : {}),
        candidates: [],
      });
    });
    vi.stubGlobal('fetch', fetcher);
    render(<AdminFloorView />);

    await screen.findByText('B03 / GF');
    expect(screen.getByRole('button', { name: 'Build source candidate' })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Floor' }), { target: { value: '01' } });

    await screen.findByText('B03 / 01');
    expect(screen.getByRole('button', { name: 'Save isolated draft only' })).toBeTruthy();
    expect(screen.getByText('Draft only; does not publish canonical configuration.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Build source candidate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'G-37 / G-42 regression' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Draw corridor' })).toBeTruthy();
    for (const label of ['Starting room', 'Destination room']) {
      const selector = screen.getByRole('combobox', { name: label });
      expect([...selector.querySelectorAll('option')].every(option => !option.value.includes('-GF-'))).toBe(true);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save isolated draft only' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/admin/navigation', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"floorId":"01","action":"draft"'),
    })));

    fireEvent.change(screen.getByRole('combobox', { name: 'Floor' }), { target: { value: 'GF' } });
    await screen.findByText('B03 / GF');
    expect(screen.getByRole('button', { name: 'Build source candidate' })).toBeTruthy();
  });
});
