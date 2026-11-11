// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Floor, Room, RoomContent } from '@wayfinding/map-engine';
import CmsEditor from '../../apps/web/components/admin/CmsEditor';
import floor from '../../data/buildings/B03/GF.json';

vi.mock('next/dynamic', async () => {
  const { default: Preview } = await import('../../apps/web/components/RoomBlockPreview');
  return { default: () => Preview };
});
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const rooms = floor.rooms.slice(0, 2) as Room[];
const contents: RoomContent[] = rooms.map((room, index) => ({
  id: room.id,
  description: { en: `Room ${index + 1} description`, ar: `Room ${index + 1} Arabic description` },
  placeholder: false,
  image: `/media/room-${index + 1}.webp`,
  imageAlt: { en: `Room ${index + 1} photo`, ar: `Room ${index + 1} Arabic photo` },
  signLanguageVideo: { url: `/media/room-${index + 1}.mp4` },
}));

function mount() {
  render(<CmsEditor floorId="GF" rooms={rooms} floor={floor.floor as Floor} contents={contents} published={contents} revision={'a'.repeat(64)} />);
}

function selectBoth() {
  rooms.forEach(room => {
    const row = screen.getByRole('button', { name: `Edit ${room.code}` }).closest('label')!;
    fireEvent.click(within(row).getByRole('checkbox'));
  });
}

function descriptionFields() {
  const group = screen.getByRole('article').querySelector('.cms-localized')!;
  return within(group as HTMLElement).getAllByRole('textbox') as HTMLTextAreaElement[];
}

function expectRoom(index: number, description = contents[index].description.en) {
  const editor = screen.getByRole('article');
  expect(within(editor).getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual([
    rooms[index].name.en,
  ]);
  expect(descriptionFields().map(field => field.value)).toEqual([description, contents[index].description.ar]);
  expect((screen.getByLabelText('Image URL/reference') as HTMLInputElement).value).toBe(contents[index].image);
  expect((screen.getByLabelText('Video URL') as HTMLInputElement).value).toBe(contents[index].signLanguageVideo!.url);
  const preview = screen.getByRole('region', { name: 'Room content' });
  expect(within(preview).getByRole('heading').textContent).toBe(rooms[index].name.en);
  expect(within(preview).getByText(description)).toBeTruthy();
  const fullCard = screen.getByTestId('cms-detail-preview');
  expect(within(fullCard).getByRole('img').getAttribute('src')).toBe(contents[index].image);
  expect(preview.querySelector('video source')?.getAttribute('src')).toBe(contents[index].signLanguageVideo!.url);
  expect(screen.getByRole('region', { name: 'Room block preview' }).getAttribute('data-room-id')).toBe(rooms[index].id);
}

describe('CMS room editing', () => {
  it.each(['en', 'ar'] as const)('saves a %s-only sticker and previews the other source name', async language => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revision: 'b'.repeat(64) }) });
    vi.stubGlobal('fetch', fetcher);
    mount();
    const fields = within(screen.getByText(/Visible map sticker label/).closest('.cms-localized') as HTMLElement).getAllByRole('textbox');
    const label = language === 'en' ? 'Welcome sticker' : '\u0645\u0631\u062d\u0628\u0627';
    fireEvent.change(fields[language === 'en' ? 0 : 1], { target: { value: label } });
    fireEvent.change(screen.getByLabelText('Preview language'), { target: { value: language } });
    expect(screen.getByRole('region', { name: /Room block preview|\u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u062c\u0633\u0645/ }).textContent).toContain(label);
    const alternate = language === 'en' ? 'ar' : 'en';
    fireEvent.change(fields[alternate === 'en' ? 0 : 1], { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Preview language'), { target: { value: alternate } });
    expect(screen.getByRole('region', { name: /Room block preview|\u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u062c\u0633\u0645/ }).textContent).toContain(rooms[0].name[alternate]);
    fireEvent.change(fields[alternate === 'en' ? 0 : 1], { target: { value: '' } });
    expect(screen.getByRole('region', { name: /Room block preview|\u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u062c\u0633\u0645/ }).textContent).toContain(rooms[0].name[alternate]);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved safely; public content is unchanged.');
    expect(JSON.parse(fetcher.mock.calls[0][1].body).contents[0].presentation.stickerLabel).toEqual({ en: '', ar: '', [language]: label });
  });

  it.each(['first', 'second', ''])('applies %s from an explicit mixed selection and preserves individual content', async target => {
    const user = userEvent.setup();
    const assigned = contents.map((item, index) => ({ ...item, presentation: { colorGroupId: index ? 'second' : 'first' } }));
    render(<CmsEditor floorId="GF" rooms={rooms} floor={floor.floor as Floor} contents={assigned} published={assigned} revision={'a'.repeat(64)} colorGroups={[{ id: 'first', name: 'First group', color: '#123456' }, { id: 'second', name: 'Second group', color: '#abcdef' }]} />);
    selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Bulk edit selected' }));
    const select = screen.getByLabelText('Assign color category') as HTMLSelectElement;
    expect(select.selectedOptions[0].textContent).toBe('Mixed color categories');
    expect(select.selectedOptions[0].disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Single room' }));
    for (const [index, room] of rooms.entries()) {
      fireEvent.click(screen.getByRole('button', { name: `Edit ${room.code}` }));
      expect((screen.getByLabelText('Assign color category') as HTMLSelectElement).value).toBe(index ? 'second' : 'first');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Bulk edit selected' }));
    expect(select.selectedOptions[0].textContent).toBe('Mixed color categories');
    await user.selectOptions(select, target);
    expect(screen.queryByRole('option', { name: 'Mixed color categories' })).toBeNull();
    for (const [index, room] of rooms.entries()) {
      fireEvent.click(screen.getByRole('button', { name: `Edit ${room.code}` }));
      expect((screen.getByLabelText('Assign color category') as HTMLSelectElement).value).toBe(target);
      expectRoom(index);
    }
  });

  it('aligns fields, both previews and edits with the second room while retaining multiple selection', () => {
    mount();
    selectBoth();
    fireEvent.click(screen.getByRole('button', { name: `Edit ${rooms[1].code}` }));
    expectRoom(1);
    expect(screen.getByText('2 selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bulk edit selected' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.change(descriptionFields()[0], { target: { value: 'Updated second room' } });
    expectRoom(1, 'Updated second room');
    fireEvent.click(screen.getByRole('button', { name: `Edit ${rooms[0].code}` }));
    expectRoom(0);
    fireEvent.click(screen.getByRole('button', { name: `Edit ${rooms[1].code}` }));
    expectRoom(1, 'Updated second room');
    expect(screen.getAllByRole('checkbox').filter(input => (input as HTMLInputElement).checked)).toHaveLength(2);
  });

  it('applies explicit bulk edits to both selected rooms and exits bulk mode when Edit is pressed', () => {
    mount();
    selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Bulk edit selected' }));
    expect(screen.getByRole('heading', { name: 'Bulk content edit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Single room' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(descriptionFields()[0], { target: { value: 'Shared description' } });
    fireEvent.click(screen.getByRole('button', { name: `Edit ${rooms[1].code}` }));
    expectRoom(1, 'Shared description');
    expect(screen.getByText('2 selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bulk edit selected' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: `Edit ${rooms[0].code}` }));
    expectRoom(0, 'Shared description');
  });

  it('describes supported uploads and existing file references without obsolete storage claims', () => {
    mount();
    expect(screen.getByText(/JPEG, PNG, WebP.*MP4, WebM.*20 MB/)).toBeTruthy();
    expect(screen.getByText(/paste an existing local file reference or HTTP\(S\) URL/)).toBeTruthy();
    expect(screen.queryByText(/does not claim file upload support/)).toBeNull();
    expect(screen.queryByPlaceholderText(/no upload storage is configured/)).toBeNull();
    expect((screen.getByLabelText('Video URL') as HTMLInputElement).placeholder).toBe('/api/media/video.mp4 or https://example.com/video.webm');
  });

  it('keeps the active room preview distinct from the bulk field template', () => {
    mount(); selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Bulk edit selected' }));
    expect(descriptionFields()[0].value).toBe(contents[0].description.en);
    expect(within(screen.getByTestId('cms-detail-preview')).getByText(contents[1].description.en)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Room block preview' }).getAttribute('data-room-id')).toBe(rooms[1].id);
    fireEvent.change(descriptionFields()[0], { target: { value: 'Both drafts updated instantly' } });
    expect(within(screen.getByTestId('cms-detail-preview')).getByText('Both drafts updated instantly')).toBeTruthy();
  });

  it('creates, renames, recolors and assigns a category to multiple rooms without publishing', () => {
    mount(); selectBoth();
    fireEvent.click(screen.getByRole('button', { name: 'Bulk edit selected' }));
    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'Visitor spaces' } });
    fireEvent.change(screen.getByLabelText('New category color'), { target: { value: '#123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create category' }));
    const option = screen.getByRole('option', { name: 'Visitor spaces' }) as HTMLOptionElement;
    fireEvent.change(screen.getByLabelText('Assign color category'), { target: { value: option.value } });
    expect(screen.getByText('2 assigned')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Room block preview' }).getAttribute('data-color')).toBe('#123456');
    fireEvent.change(screen.getByLabelText('Category name: Visitor spaces'), { target: { value: 'Welcome spaces' } });
    fireEvent.change(screen.getByLabelText('Category hex: Welcome spaces'), { target: { value: '#aa3377' } });
    expect(screen.getByRole('option', { name: 'Welcome spaces' })).toBeTruthy();
    for (const room of rooms) {
      fireEvent.click(screen.getByRole('button', { name: `Edit ${room.code}` }));
      expect(screen.getByRole('region', { name: 'Room block preview' }).getAttribute('data-color')).toBe('#aa3377');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Delete category: Welcome spaces' }));
    expect(screen.getByRole('alert').textContent).toContain('Unassign all rooms');
    fireEvent.click(screen.getByRole('button', { name: 'Bulk edit selected' }));
    fireEvent.change(screen.getByLabelText('Assign color category'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete category: Welcome spaces' }));
    expect(screen.queryByRole('option', { name: 'Welcome spaces' })).toBeNull();
  });

  it('shows live room color and switches the full card to Arabic with inert actions', () => {
    mount();
    fireEvent.change(screen.getByLabelText(/Map block color/), { target: { value: '#ff3366' } });
    expect(screen.getByRole('region', { name: 'Room block preview' }).getAttribute('data-color')).toBe('#ff3366');
    const stickerFields = screen.getByText(/Visible map sticker label/).closest('.cms-localized') as HTMLElement;
    fireEvent.change(within(stickerFields).getAllByRole('textbox')[0], { target: { value: 'Unsaved welcome sticker' } });
    expect(within(screen.getByRole('region', { name: 'Room block preview' })).getByText(/Unsaved welcome sticker/)).toBeTruthy();
    expect(within(screen.getByTestId('cms-detail-preview')).getByRole('heading', { level: 2 }).textContent).toBe(rooms[0].name.en);
    fireEvent.change(screen.getByLabelText('Preview language'), { target: { value: 'ar' } });
    const card = screen.getByTestId('cms-detail-preview');
    expect(card.dir).toBe('rtl');
    expect(within(card).getByText(contents[0].description.ar)).toBeTruthy();
    expect(within(card).getByRole('heading', { level: 2 }).textContent).toBe(rooms[0].name.ar);
    expect([...card.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
  });

  it('sends groups and assignments with content in one save and retains errors from stale writes', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'Content changed since it was loaded. Reload before saving.' }) });
    vi.stubGlobal('fetch', fetcher);
    mount();
    fireEvent.change(screen.getByLabelText('New category name'), { target: { value: 'Draft group' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create category' }));
    const option = screen.getByRole('option', { name: 'Draft group' }) as HTMLOptionElement;
    fireEvent.change(screen.getByLabelText('Assign color category'), { target: { value: option.value } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Reload before saving');
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload.colorGroups).toEqual([{ id: option.value, name: 'Draft group', color: '#2d7f74' }]);
    expect(payload.contents[0].presentation.colorGroupId).toBe(option.value);
    expect(payload.action).toBe('save');
    expect(payload.floorId).toBe('GF');
    expect(screen.getByRole('region', { name: 'Room block preview' }).getAttribute('data-color')).toBe('#2d7f74');
  });
});
