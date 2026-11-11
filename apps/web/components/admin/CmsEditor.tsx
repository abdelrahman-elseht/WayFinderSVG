'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { validateColorGroups, type ColorGroup, type Floor, type Language, type Localized, type Room, type RoomContent } from '@wayfinding/map-engine';
import { DestinationDetails } from '../DestinationDetails';
import './cms.css';
import './cms-media.css';

const RoomBlockPreview = dynamic(() => import('../RoomBlockPreview'), { ssr: false });
type Props = { floorId: 'GF' | '01'; rooms: Room[]; floor: Floor; contents: RoomContent[]; published: RoomContent[]; revision: string; colorGroups?: ColorGroup[] };
const emptyLocalized = (): Localized => ({ en: '', ar: '' });
const text = (value: string | null | undefined) => value || '';

function validate(contents: RoomContent[]) {
  const errors: string[] = [];
  contents.forEach((item, index) => {
    if (!item.description.en.trim() || !item.description.ar.trim()) errors.push(`${item.id}: both descriptions are required`);
    if (item.image && (!item.imageAlt.en.trim() || !item.imageAlt.ar.trim())) errors.push(`${item.id}: image alt text is required`);
    if (item.signLanguageVideo?.url && !/^https?:\/\//i.test(item.signLanguageVideo.url) && !item.signLanguageVideo.url.startsWith('/')) errors.push(`${item.id}: video URL must be local or HTTP(S)`);
  });
  return errors;
}

export default function CmsEditor({ floorId, rooms, floor, contents: initial, revision: initialRevision, colorGroups: initialGroups = [] }: Props) {
  const [contents, setContents] = useState(initial);
  const [colorGroups, setColorGroups] = useState(initialGroups);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState('#2d7f74');
  const [previewLanguage, setPreviewLanguage] = useState<Language>('en');
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(initialRevision);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [activeId, setActiveId] = useState(rooms[0]?.id || '');
  const [bulk, setBulk] = useState(false);
  const [error, setError] = useState('');
  const [captionError, setCaptionError] = useState('');
  const [status, setStatus] = useState('Draft loaded. Nothing has been published.');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const activeRoom = rooms.find(room => room.id === activeId);
  const active = contents.find(item => item.id === activeRoom?.contentRef);
  const roomMap = useMemo(() => new Map(rooms.map(room => [room.contentRef, room])), [rooms]);
  const visible = rooms.filter(room => {
    const haystack = `${room.code} ${room.name.en} ${room.name.ar}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (category === 'all' || room.category === category);
  });
  const selectedContentIds = rooms.filter(room => selected.has(room.id)).map(room => room.contentRef);
  const selectedContents = contents.filter(item => selectedContentIds.includes(item.id));

  function update(ids: string[], patch: Partial<RoomContent>) {
    setContents(items => items.map(item => ids.includes(item.id) ? { ...item, ...patch } : item));
  }
  function updatePresentation(ids: string[], editField: (item: RoomContent) => RoomContent['presentation']) {
    setContents(items => items.map(item => ids.includes(item.id) ? { ...item, presentation: editField(item) } : item));
  }
  function updateVideo(ids: string[], editField: (item: RoomContent) => RoomContent['signLanguageVideo']) {
    setContents(items => items.map(item => ids.includes(item.id) ? { ...item, signLanguageVideo: editField(item) } : item));
  }
  function updateLocalized(ids: string[], field: 'description' | 'imageAlt', language: 'en' | 'ar', value: string) {
    setContents(items => items.map(item => ids.includes(item.id) ? { ...item, [field]: { ...item[field], [language]: value } } : item));
  }
  function toggle(id: string, checked: boolean) {
    setSelected(current => { const next = new Set(current); checked ? next.add(id) : next.delete(id); return next; });
    setActiveId(id);
  }
  async function persist(action: 'save' | 'publish') {
    if (saving) return;
    const errors = validate(contents);
    try { validateColorGroups(colorGroups, contents); } catch (reason) { errors.push(reason instanceof Error ? reason.message : String(reason)); }
    if (captionError) errors.push(captionError);
    if (errors.length) { setError(errors.slice(0, 3).join(' | ')); setStatus('Fix validation errors before saving.'); return; }
    setError('');
    setSaving(true);
    setStatus(action === 'publish' ? 'Publishing…' : 'Saving draft…');
    try {
      const response = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CMS-Editor': '1' },
        body: JSON.stringify({ floorId, action, contents, colorGroups, revision }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || `Request failed (${response.status})`);
      setRevision(result.revision);
      setStatus(action === 'publish' ? 'Published content is live for the public app.' : 'Draft saved safely; public content is unchanged.');
    } catch (reason) {
      setStatus('Save failed. No partial content was applied.');
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setSaving(false); }
  }

  function createGroup() {
    const group = { id: `color-${crypto.randomUUID()}`, name: groupName.trim(), color: groupColor };
    try { validateColorGroups([...colorGroups, group], contents); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); return; }
    setColorGroups(groups => [...groups, group]); setGroupName(''); setError('');
  }

  function deleteGroup(id: string) {
    if (contents.some(item => item.presentation?.colorGroupId === id)) {
      setError('Unassign all rooms from this color category before deleting it. Choose "No color category" for those rooms.'); return;
    }
    setColorGroups(groups => groups.filter(group => group.id !== id)); setError('');
  }

  async function upload(file: File, kind: 'image' | 'video' | 'poster') {
    setUploading(true); setUploadStatus('Uploading / جارٍ الرفع...'); setError('');
    try {
      const form = new FormData(); form.set('file', file);
      const response = await fetch('/api/admin/content/upload', { method: 'POST', headers: { 'X-CMS-Editor': '1' }, body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Upload failed (${response.status})`);
      if (kind === 'image') update(ids, { image: result.url });
      if (kind === 'video') updateVideo(ids, item => ({ ...item.signLanguageVideo, url: result.url }));
      if (kind === 'poster') updateVideo(ids, item => item.signLanguageVideo ? { ...item.signLanguageVideo, poster: result.url } : item.signLanguageVideo);
      setUploadStatus(`Uploaded / تم الرفع: ${result.url}`);
    } catch (reason) { setUploadStatus('Upload failed / فشل الرفع'); setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setUploading(false); }
  }

  const ids = bulk ? selectedContentIds : active ? [active.id] : [];
  const edit = bulk ? selectedContents[0] || active : active;
  const mixedCategories = bulk && new Set(selectedContents.map(item => item.presentation?.colorGroupId || '')).size > 1;
  if (!edit) return <main className="cms-shell">No room content found.</main>;

  return <main className="cms-shell" dir="ltr">
    <header className="cms-header"><div><span className="cms-kicker">B03 / {floorId}</span><h1>Content studio</h1><p>Descriptions, media references and accessibility copy. Geometry stays read-only.</p></div><nav><label>Floor<select aria-label="CMS floor" value={floorId} disabled={saving} onChange={event => { window.location.assign(`/cms?floorId=${event.target.value}`); }}><option value="GF">Ground Floor</option><option value="01">First Floor</option></select></label><a href="/admin">Navigation editor</a><button disabled={saving} onClick={() => persist('save')}>Save draft</button><button disabled={saving} className="cms-publish" onClick={() => persist('publish')}>Publish</button></nav></header>
    <div className="cms-status" role="status" aria-live="polite">{status}</div>
    {error && <div className="cms-error" role="alert">{error}</div>}
    <section className="cms-grid">
      <aside className="cms-list" aria-label="Room content list">
        <label className="cms-search">Search rooms<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Code or name" /></label>
        <label className="cms-search">Filter by category<select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{[...new Set(rooms.map(room => room.category))].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <div className="cms-selection"><span>{selected.size} selected</span><button onClick={() => setSelected(new Set())}>Clear</button><button onClick={() => setSelected(new Set(visible.map(room => room.id)))}>Select visible</button></div>
        <div className="cms-room-items">{visible.map(room => <label className={`cms-room ${activeId === room.id ? 'active' : ''}`} key={room.id}><input type="checkbox" checked={selected.has(room.id)} onChange={event => toggle(room.id, event.target.checked)} /><span><strong>{room.code}</strong><span>{room.name.en}</span><small dir="rtl">{room.name.ar}</small></span><button type="button" aria-label={`Edit ${room.code}`} onClick={() => { setActiveId(room.id); setBulk(false); }}>Edit</button></label>)}</div>
      </aside>
      <article className="cms-editor">
        <div className="cms-editor-heading"><div><span className="cms-kicker">{ids.length > 1 ? `${ids.length} rooms` : edit.id}</span><h2>{ids.length > 1 ? 'Bulk content edit' : `${roomMap.get(edit.id)?.name.en || edit.id}`}</h2></div><button onClick={() => setBulk(!bulk)} aria-pressed={bulk}>{bulk ? 'Single room' : 'Bulk edit selected'}</button></div>
        {ids.length > 1 && <p className="cms-callout">Only fields you change below are applied to all selected rooms. Existing media and translations remain intact.</p>}
        {bulk && ids.length === 0 && <p className="cms-callout">Select rooms before applying bulk changes.</p>}
        <fieldset className="cms-color-groups"><legend>Color categories</legend>
          <p>Named presentation colors. Changing a category recolors every assigned room; source room categories stay unchanged.</p>
          <label>Assign color category<select value={mixedCategories ? '__mixed__' : edit.presentation?.colorGroupId || ''} disabled={ids.length === 0} onChange={event => updatePresentation(ids, item => ({ ...item.presentation, colorGroupId: event.target.value || undefined }))}>{mixedCategories && <option value="__mixed__" disabled>Mixed color categories</option>}<option value="">No color category</option>{colorGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
          {mixedCategories && <p>Mixed categories selected. Choosing a category applies it to every selected room.</p>}
          <div className="cms-color-group-list">{colorGroups.map(group => <div className="cms-color-group" key={group.id}>
            <label>Category name<input aria-label={`Category name: ${group.name || 'Unnamed'}`} maxLength={80} value={group.name} onChange={event => setColorGroups(groups => groups.map(item => item.id === group.id ? { ...item, name: event.target.value } : item))} /></label>
            <label>Color<input type="color" aria-label={`Category color: ${group.name || 'Unnamed'}`} value={/^#[0-9a-f]{6}$/i.test(group.color) ? group.color : '#000000'} onChange={event => setColorGroups(groups => groups.map(item => item.id === group.id ? { ...item, color: event.target.value } : item))} /></label>
            <label className="cms-group-hex">Hex color<input aria-label={`Category hex: ${group.name || 'Unnamed'}`} maxLength={7} value={group.color} onChange={event => setColorGroups(groups => groups.map(item => item.id === group.id ? { ...item, color: event.target.value } : item))} /></label>
            <span>{contents.filter(item => item.presentation?.colorGroupId === group.id).length} assigned</span>
            <button type="button" aria-label={`Delete category: ${group.name}`} onClick={() => deleteGroup(group.id)}>Delete</button>
          </div>)}</div>
          <div className="cms-new-group"><label>New category name<input maxLength={80} value={groupName} onChange={event => setGroupName(event.target.value)} /></label><label>New category color<input type="color" value={groupColor} onChange={event => setGroupColor(event.target.value)} /></label><button type="button" onClick={createGroup}>Create category</button></div>
        </fieldset>
        <LocalizedFields label="Description" value={edit.description} onChange={(language, value) => updateLocalized(ids, 'description', language, value)} />
        <label className="cms-check"><input type="checkbox" checked={edit.placeholder} onChange={event => update(ids, { placeholder: event.target.checked })} /> Mark as placeholder copy</label>
        <UploadField label="Upload image / رفع صورة" accept="image/jpeg,image/png,image/webp" disabled={uploading} onFile={file => upload(file, 'image')} />
        <UploadField label="Upload sign-language video / رفع فيديو لغة الإشارة" accept="video/mp4,video/webm" disabled={uploading} onFile={file => upload(file, 'video')} />
        <UploadField label="Upload video poster / رفع صورة الغلاف" accept="image/jpeg,image/png,image/webp" disabled={uploading} onFile={file => upload(file, 'poster')} />
        <p role="status" aria-live="polite">{uploadStatus}</p>
        <label>Map block color / لون مساحة الغرفة<input type="color" value={edit.presentation?.blockColor || '#d8e6dc'} onChange={event => updatePresentation(ids, item => ({ ...item.presentation, blockColor: event.target.value }))} /></label>
        {edit.presentation?.colorGroupId && <p className="cms-note">The assigned color category takes precedence over this room color. Choose "No color category" to use the room color.</p>}
        <LocalizedFields label="Visible map sticker label / ملصق الخريطة الظاهر" value={edit.presentation?.stickerLabel || emptyLocalized()} onChange={(language, value) => updatePresentation(ids, item => ({ ...item.presentation, stickerLabel: { ...(item.presentation?.stickerLabel || emptyLocalized()), [language]: value } }))} />
        <button type="button" onClick={() => updatePresentation(ids, item => ({ ...item.presentation, stickerLabel: undefined }))}>Use source name / استخدام الاسم الأصلي</button>
        <div className="cms-two"><label>Image URL/reference<input value={text(edit.image)} onChange={event => update(ids, { image: event.target.value || null })} placeholder="/media/rooms/g-01.webp or https://…" /></label><LocalizedFields label="Image alt text" value={edit.imageAlt} onChange={(language, value) => updateLocalized(ids, 'imageAlt', language, value)} /></div>
        <fieldset><legend>Sign-language video URL/reference</legend><label>Video URL<input value={text(edit.signLanguageVideo?.url)} onChange={event => updateVideo(ids, item => event.target.value ? { ...item.signLanguageVideo, url: event.target.value } : undefined)} placeholder="/api/media/video.mp4 or https://example.com/video.webm" /></label><label>Poster URL/reference<input value={text(edit.signLanguageVideo?.poster)} onChange={event => updateVideo(ids, item => item.signLanguageVideo ? { ...item.signLanguageVideo, poster: event.target.value || undefined } : undefined)} /></label><label>Caption tracks JSON<textarea className="cms-code" value={JSON.stringify(edit.signLanguageVideo?.captions || [], null, 2)} onChange={event => { try { const captions = JSON.parse(event.target.value); if (!Array.isArray(captions)) throw new Error('Caption tracks must be an array'); setCaptionError(''); updateVideo(ids, item => item.signLanguageVideo ? { ...item.signLanguageVideo, captions } : undefined); } catch (reason) { setCaptionError(reason instanceof Error ? reason.message : 'Invalid caption JSON'); } }} aria-describedby={captionError ? 'cms-caption-error' : undefined} />{captionError && <span id="cms-caption-error" className="cms-field-error" role="alert">{captionError}</span>}</label><LocalizedFields label="Transcript" value={edit.signLanguageVideo?.transcript || emptyLocalized()} onChange={(language, value) => edit.signLanguageVideo && updateVideo(ids, item => item.signLanguageVideo ? { ...item.signLanguageVideo, transcript: { ...(item.signLanguageVideo.transcript || emptyLocalized()), [language]: value } } : undefined)} /></fieldset>
        <p className="cms-note">Upload JPEG, PNG, WebP images or posters and MP4, WebM videos, up to 20 MB per file. Uploads fill the matching reference field, or paste an existing local file reference or HTTP(S) URL. Published changes are read by the public app on the next request.</p>
      </article>
      <aside className="cms-preview-column" aria-label="Live preview">
        <div className="cms-preview-heading"><div><span className="cms-kicker">Unsaved live preview</span><h2>{activeRoom?.code}</h2></div><label>Preview language<select value={previewLanguage} onChange={event => setPreviewLanguage(event.target.value as Language)}><option value="en">English</option><option value="ar">العربية</option></select></label></div>
        {activeRoom && active && <><RoomBlockPreview room={activeRoom} content={active} floor={floor} language={previewLanguage} colorGroups={colorGroups} /><DestinationDetails room={activeRoom} content={active} floor={floor} language={previewLanguage} preview /></>}
      </aside>
    </section>
  </main>;
}

function LocalizedFields({ label, value, onChange }: { label: string; value: Localized; onChange: (language: 'en' | 'ar', value: string) => void }) {
  return <div className="cms-localized"><span>{label}</span><label>English<textarea value={value.en} onChange={event => onChange('en', event.target.value)} /></label><label dir="rtl">العربية<textarea value={value.ar} onChange={event => onChange('ar', event.target.value)} /></label></div>;
}

function UploadField({ label, accept, disabled, onFile }: { label: string; accept: string; disabled: boolean; onFile: (file: File) => void }) {
  return <label className="cms-upload" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file && !disabled) onFile(file); }}>
    {label}<span>Drop a file here or choose one / اسحب ملفًا هنا أو اختره</span>
    <input type="file" accept={accept} disabled={disabled} onChange={event => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = ''; }} />
  </label>;
}
