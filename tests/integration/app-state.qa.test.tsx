// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FloorData, NavigationGraph, RoomContent } from '@wayfinding/map-engine';
import { WayfindingApp } from '../../apps/web/components/WayfindingApp';
import floorJson from '../../data/buildings/B03/GF.json';
import graphJson from '../../data/buildings/B03/GF.graph.json';
import contentJson from '../../content/B03/GF.json';
import { syntheticCorner } from '../fixtures/routing';
vi.mock('next/dynamic', () => ({default:()=>()=> <div data-testid="isolated-map-stub"/>}));
afterEach(cleanup);
const floor=floorJson as FloorData, graph=graphJson as unknown as NavigationGraph;
const contents=contentJson as RoomContent[];
function mount(data=floor, navigation=graph) {
 const audio={speak:vi.fn(), stop:vi.fn(), setMuted:vi.fn(), isSupported:()=>true};
 render(<WayfindingApp floorData={data} graph={navigation} contents={contents} audioService={audio}/>);
 return audio;
}
describe('independent React UI state with real data and isolated map rendering',()=>{
 it('automatically speaks room details and supports replay, stop, mute and Arabic changes',()=>{
  const audio=mount();
  fireEvent.click(screen.getByTestId('room-directory').querySelector('[data-room-id="B03-GF-G-28"]')!);
  expect(audio.speak).toHaveBeenLastCalledWith(expect.stringContaining('Clinic'), 'en');
  fireEvent.click(screen.getByLabelText('Replay description'));
  expect(audio.speak).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByLabelText('Stop audio'));
  expect(audio.stop).toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('Mute audio'));
  expect(audio.setMuted).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByTestId('language-toggle'));
  expect(document.documentElement.dir).toBe('rtl');
  expect(audio.speak).toHaveBeenLastCalledWith(expect.stringContaining('العيادة'),'ar');
 });
 it('selects real route endpoints then restores the named planning default without inventing a kiosk',()=>{
  mount();
  fireEvent.click(screen.getByTestId('room-directory').querySelector('[data-room-id="B03-GF-G-45"]')!);
  fireEvent.click(screen.getByText('Start here'));
  expect((screen.getByTestId('start-select') as HTMLSelectElement).value).toBe('B03-GF-G-45');
  fireEvent.change(screen.getByTestId('destination-select'),{target:{value:'B03-GF-G-46'}});
  expect(screen.getByTestId('route-status').className).toContain('ok');
  fireEvent.click(screen.getByText('Use default starting point'));
  expect((screen.getByTestId('start-select') as HTMLSelectElement).value).toBe('');
  expect(screen.getByTestId('kiosk-status').textContent).toContain('not your current location');
  fireEvent.click(screen.getByTestId('reset-kiosk'));
  expect(screen.queryByTestId('room-details')).toBeNull();
  expect((screen.getByTestId('destination-select') as HTMLSelectElement).value).toBe('');
 });
 it('qualifies clinic arrival at the mapped reception approach in both languages',()=>{
  mount();
  fireEvent.click(screen.getByText('Navigate'));
  fireEvent.change(screen.getByTestId('destination-select'),{target:{value:'B03-GF-G-28'}});
  expect(screen.getByTestId('route-status').className).toContain('ok');
  expect(screen.getByTestId('arrival-note').textContent).toContain('Reception');
  expect(screen.getByTestId('route-status').textContent).not.toContain('You have arrived at your destination.');
  fireEvent.click(screen.getByTestId('language-toggle'));
  expect(screen.getByTestId('route-status').textContent).not.toContain('لقد وصلت إلى وجهتك.');
 });
 it('retains configured kiosk precedence in an explicitly synthetic fixture',()=>{
  const data=structuredClone(floor);
  data.rooms[0].doorNodeId='c';
  delete data.rooms[0].navigationNote;
  data.kiosks[0].nodeId='a';data.kiosks[0].status='confirmed';
  mount(data,syntheticCorner());
  fireEvent.click(screen.getByText('Navigate'));
  fireEvent.change(screen.getByTestId('destination-select'),{target:{value:data.rooms[0].id}});
  expect(screen.getByTestId('route-status').textContent).toContain('Route on floor plan');
  expect(screen.getByTestId('route-status').textContent).toContain('Your destination is on the right');
  fireEvent.click(screen.getByTestId('language-toggle'));
  expect(screen.getByTestId('route-status').textContent).toContain('وجهتك على اليمين');
 });
});


