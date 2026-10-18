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
const floor=floorJson as unknown as FloorData, graph=graphJson as unknown as NavigationGraph;
const contents=contentJson as RoomContent[];
function mount(data=floor, navigation=graph, dataContents=contents) {
 const audio={speak:vi.fn(), stop:vi.fn(), setMuted:vi.fn(), isSupported:()=>true};
 render(<WayfindingApp floorData={data} graph={navigation} contents={dataContents} audioService={audio}/>);
 return audio;
}
describe('independent React UI state with real data and isolated map rendering',()=>{
 it('automatically speaks room details and supports replay, stop, mute and Arabic changes',()=>{
  const audio=mount();
  fireEvent.click(screen.getByText('Browse'));
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
 it('keeps destination options name-first while retaining the code identifier in both languages',()=>{
  mount();
  fireEvent.click(screen.getByText('Navigate'));
  const destination=screen.getByTestId('destination-select') as HTMLSelectElement;
  const english=Array.from(destination.options).find(option=>option.value==='B03-GF-G-43');
  expect(english?.textContent).toBe('Mechanical Lab — G-43');
  fireEvent.click(screen.getByTestId('language-toggle'));
  const arabic=Array.from((screen.getByTestId('destination-select') as HTMLSelectElement).options).find(option=>option.value==='B03-GF-G-43');
  expect(arabic?.textContent).toContain('G-43');
  expect(arabic?.textContent).not.toBe('G-43');
 });
 it('selects real route endpoints then restores the named planning default without inventing a kiosk',()=>{
  mount();
  fireEvent.click(screen.getByText('Browse'));
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
 it('shows sign language media only when configured and restores focus after closing',()=>{
  const videoContents=structuredClone(contents);
  const clinic=videoContents.find(item=>item.id==='B03-GF-G-28')!;
  clinic.signLanguageVideo={url:'/media/clinic-sign-language.mp4',language:'ase',transcript:{en:'A signed explanation of the clinic.',ar:'شرح بلغة الإشارة عن العيادة.'}};
  mount(floor,graph,videoContents);
  fireEvent.click(screen.getByText('Browse'));
  const roomButton=screen.getByTestId('room-directory').querySelector('[data-room-id="B03-GF-G-28"]')!;
  fireEvent.click(roomButton);
  expect(screen.getByTestId('sign-language-action').textContent).toContain('Sign language description');
  const actionButton=screen.getByTestId('sign-language-action');
  fireEvent.click(actionButton);
  expect(screen.getByRole('dialog').textContent).toContain('Clinic');
  expect(screen.getByRole('dialog').textContent).toContain('A signed explanation of the clinic.');
  expect(document.activeElement).toBe(screen.getByRole('dialog').querySelector('button'));
  fireEvent.keyDown(document, {key:'Escape'});
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(actionButton);
 });
 it('localizes and reports failed sign language playback without autoplay',()=>{
  const videoContents=structuredClone(contents);
  videoContents.find(item=>item.id==='B03-GF-G-28')!.signLanguageVideo={url:'/media/clinic-sign-language.mp4'};
  mount(floor,graph,videoContents);
  fireEvent.click(screen.getByText('Browse'));
  fireEvent.click(screen.getByTestId('room-directory').querySelector('[data-room-id="B03-GF-G-28"]')!);
  fireEvent.click(screen.getByTestId('sign-language-action'));
  const video=screen.getByRole('dialog').querySelector('video')!;
  expect(video.autoplay).toBe(false);
  fireEvent.error(video);
  expect(screen.getByRole('alert').textContent).toContain('This sign language video could not be loaded');
  fireEvent.click(screen.getByTestId('language-toggle'));
  expect(screen.getByTestId('sign-language-action').textContent).toContain('شرح بلغة الإشارة');
  expect(screen.getByRole('dialog').textContent).toContain('تعذر تحميل فيديو بلغة الإشارة');
 });
 it('keeps the action hidden when a destination has no recording',()=>{
  mount();
  fireEvent.click(screen.getByText('Browse'));
  fireEvent.click(screen.getByTestId('room-directory').querySelector('[data-room-id="B03-GF-G-28"]')!);
  expect(screen.queryByTestId('sign-language-action')).toBeNull();
 });
});


