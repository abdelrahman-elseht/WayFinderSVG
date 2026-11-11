'use client';

import { ArrowRight, Building2, Headphones, Info, MapPin, Navigation, Square, X } from 'lucide-react';
import type { Floor, Language, Room, RoomContent } from '@wayfinding/map-engine';
import { t } from '@wayfinding/i18n';
import { categorySwatchColors } from './palette';
import { roomFootprint } from './mapBlocks';
import { RoomContentPresentation, isPlaceholderVideo } from './RoomContentPresentation';
import { SignLanguageAction } from './SignLanguageDialog';
import './destination-details.css';

export function SourceThumbnail({ room, floor, language }: { room: Room; floor: Floor; language: Language }) {
  const footprint = roomFootprint(room);
  const coordinates = footprint ?? [room.centroid];
  const minX = Math.min(...coordinates.map(p => p[0])); const maxX = Math.max(...coordinates.map(p => p[0]));
  const minY = Math.min(...coordinates.map(p => p[1])); const maxY = Math.max(...coordinates.map(p => p[1]));
  const width = Math.max(maxX - minX + 70, 220); const height = Math.max(maxY - minY + 70, 150);
  const accent = categorySwatchColors[room.category];
  return <div className="room-preview"><svg viewBox={`${(minX + maxX) / 2 - width / 2} ${(minY + maxY) / 2 - height / 2} ${width} ${height}`} role="img" aria-label={`${t(language, 'sourceDrawing')}: ${room.name[language]} · ${room.code}`}><image href={floor.mapAsset} x={floor.viewBox[0]} y={floor.viewBox[1]} width={floor.viewBox[2]} height={floor.viewBox[3]} />{footprint ? <polygon points={footprint.map(point => point.join(',')).join(' ')} fill={accent.background} fillOpacity=".48" stroke={accent.foreground} strokeWidth="2" strokeDasharray={room.geometryStatus === 'confirmed' ? undefined : '5 3'} /> : <circle cx={room.centroid[0]} cy={room.centroid[1]} r="7" fill={accent.background} stroke={accent.foreground} strokeWidth="3" />}</svg><span>{language === 'ar' ? 'تفصيل من الرسم' : 'Drawing detail'}</span></div>;
}

type Props = {
  room: Room; content?: RoomContent | null; floor: Floor; language: Language;
  collapsed?: boolean; preview?: boolean; audioSupported?: boolean;
  onClose?: () => void; onDestination?: () => void; onStart?: () => void;
  onSpeak?: () => void; onStop?: () => void; onSignLanguage?: () => void;
};

const categoryKeys = { classroom: 'categoryClassroom', office: 'categoryOffice', laboratory: 'categoryLaboratory', service: 'categoryService', restroom: 'categoryRestroom', circulation: 'categoryCirculation', other: 'categoryOther' };

/** The public destination card also renders unsaved CMS content, with inert actions. */
export function DestinationDetails({ room, content: raw, floor, language, collapsed = false, preview = false, audioSupported = true, onClose, onDestination, onStart, onSpeak, onStop, onSignLanguage }: Props) {
  const content = raw && !preview && isPlaceholderVideo(raw) ? { ...raw, signLanguageVideo: undefined } : raw;
  return <aside id={preview ? undefined : 'room-details'} dir={language === 'ar' ? 'rtl' : 'ltr'} className={`detail-card ${collapsed ? 'is-collapsed' : ''}`} aria-hidden={collapsed} aria-label={t(language, 'roomDetails')} data-testid={preview ? 'cms-detail-preview' : 'room-details'}>
    <div className="detail-top"><p className="eyebrow">{language === 'ar' ? 'تفاصيل الوجهة' : 'DESTINATION DETAILS'}</p><button className="icon-button" disabled={preview} aria-label={t(language, 'close')} onClick={onClose}><X size={18} /></button></div>
    {content?.image ? <img className="detail-media-image" src={content.image} alt={content.imageAlt[language]} /> : <SourceThumbnail room={room} floor={floor} language={language} />}
    <div className="detail-body">
      <div className="detail-category"><span className={`category-dot ${room.category}`} />{t(language, categoryKeys[room.category])}<bdi>{room.code}</bdi></div>
      {content ? <RoomContentPresentation room={room} content={content} language={language} preview={preview} showImage={false} /> : <p>{t(language, 'descriptionUnavailable')}</p>}
      {content?.signLanguageVideo?.url && <SignLanguageAction language={language} disabled={preview} onClick={() => onSignLanguage?.()} />}
      <p className="detail-location"><Building2 size={14} />{t(language, 'building')} <bdi>{floor.buildingId}</bdi><span>·</span>{floor.name[language]}</p>
      <div className="geometry-note"><Info size={13} />{t(language, room.geometryStatus === 'confirmed' ? 'confirmed' : room.polygon ? 'geometryCandidate' : 'geometryUnknown')}</div>
      <div className="room-navigation-note">{room.navigationPartial && <strong>{t(language, 'partialRoute')}</strong>}{room.navigationNote && <p>{room.navigationNote[language]}</p>}{room.navigationPartial && <p>{t(language, 'partialRouteNote')}</p>}</div>
      {preview && <p className="cms-inert-note">{language === 'ar' ? 'معاينة فقط: إجراءات التنقل والصوت غير مفعلة.' : 'Preview only: navigation and audio actions are inactive.'}</p>}
      <div className="detail-actions"><button className="primary-button" disabled={preview} onClick={onDestination}><Navigation size={16} />{t(language, 'setDestination')}<ArrowRight size={16} /></button><button className="secondary-button" disabled={preview} onClick={onStart}><MapPin size={16} />{t(language, 'setStart')}</button></div>
      <div className="audio-controls"><button onClick={onSpeak} disabled={preview || !audioSupported} aria-label={t(language, 'replayDescription')}><Headphones size={17} /><span>{t(language, 'playDescription')}</span></button><button className="icon-button" disabled={preview} onClick={onStop} aria-label={t(language, 'stopAudio')}><Square size={13} /></button></div>
      {!audioSupported && <p className="audio-unavailable">{t(language, 'audioUnavailable')}</p>}
    </div>
  </aside>;
}
