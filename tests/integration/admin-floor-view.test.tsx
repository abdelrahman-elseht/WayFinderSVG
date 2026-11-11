// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AdminFloorView from '../../apps/web/components/admin/AdminFloorView';
import floor from '../../data/buildings/B03/01.json';
import graph from '../../data/buildings/B03/01.graph.json';

vi.mock('../../apps/web/components/admin/NavigationEditor', () => ({
  default: () => <main><h1>Ground Floor editor</h1><button>Save preview draft</button></main>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('authenticated admin floor view', () => {
  it('switches to the source-backed read-only 01 view and returns to the GF editor', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<AdminFloorView />);

    expect(screen.getByRole('heading', { name: 'Ground Floor editor' })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Floor' }), { target: { value: '01' } });

    expect(screen.getByRole('heading', { name: 'First Floor source map' })).toBeTruthy();
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(floor.rooms.length);
    expect(document.querySelectorAll('[data-edge]')).toHaveLength(graph.edges.length);
    expect(document.querySelectorAll('[data-node]')).toHaveLength(graph.nodes.length);
    expect(screen.getByText('F-01')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /save|delete|move|add/i })).toBeNull();
    expect(document.querySelector('[role="application"]')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('combobox', { name: 'Floor' }), { target: { value: 'GF' } });
    expect(screen.getByRole('heading', { name: 'Ground Floor editor' })).toBeTruthy();
  });
});
