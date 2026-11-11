'use client';

import type { Language, Room, RoomContent } from '@wayfinding/map-engine';

export function isPlaceholderVideo(content: RoomContent) {
  const video = content.signLanguageVideo;
  return Boolean(video && (video.language?.toLowerCase() === 'preview'
    || Object.values(video.transcript ?? {}).some(value => /temporary preview video only|replace this sample/i.test(value))));
}

export function RoomContentPresentation({ room, content, language, preview = false, fallback, showImage = true }: { room: Room; content: RoomContent; language: Language; preview?: boolean; fallback?: React.ReactNode; showImage?: boolean }) {
  const alternate = language === 'en' ? 'ar' : 'en';
  return <section className="room-content-presentation" aria-label={language === 'ar' ? 'محتوى الغرفة' : 'Room content'}>
    <h2>{room.name[language]}</h2>
    <p className="alternate-name" lang={alternate} dir={alternate === 'ar' ? 'rtl' : 'ltr'}>{room.name[alternate]}</p>
    <p className="room-description">{content.description[language]}</p>
    {!content.image && fallback}
    {showImage && content.image && <img className="room-content-image" src={content.image} alt={content.imageAlt[language]} />}
    {content.signLanguageVideo?.url && (preview || !isPlaceholderVideo(content)) && <video className="room-content-video" controls preload="metadata" poster={content.signLanguageVideo.poster} aria-label={language === 'ar' ? `فيديو لغة الإشارة: ${room.name.ar}` : `Sign-language video: ${room.name.en}`}>
      <source src={content.signLanguageVideo.url} />
      {content.signLanguageVideo.captions?.map(track => <track key={`${track.language}-${track.src}`} kind="captions" src={track.src} srcLang={track.language} label={track.label[language]} default={track.default} />)}
    </video>}
  </section>;
}
