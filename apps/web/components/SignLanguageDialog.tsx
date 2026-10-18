'use client';

import { useEffect, useRef, useState } from 'react';
import { Accessibility, AlertTriangle, FileText, Play, X } from 'lucide-react';
import type { Language, Room, SignLanguageVideo } from '@wayfinding/map-engine';
import { t } from '@wayfinding/i18n';

type Props = {
  room: Room;
  video: SignLanguageVideo;
  language: Language;
  onClose: () => void;
};

export function SignLanguageDialog({ room, video, language, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const dialog = closeRef.current?.closest('[role="dialog"]');
        const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, video, summary, [tabindex]:not([tabindex="-1"])')).filter(element => !element.hasAttribute('disabled')) : [];
        if (focusable.length < 2) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (openerRef.current && 'focus' in openerRef.current && typeof openerRef.current.focus === 'function') openerRef.current.focus();
    };
  }, [onClose]);

  const transcript = video.transcript?.[language];

  return (
    <div
      className="sign-language-backdrop"
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        className="sign-language-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-language-dialog-title"
        data-testid="sign-language-dialog"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="sign-language-dialog-header">
          <div>
            <p className="eyebrow">{t(language, 'signLanguageDescription')}</p>
            <h2 id="sign-language-dialog-title">{room.name[language]}</h2>
            <p className="sign-language-dialog-code"><bdi>{room.code}</bdi></p>
          </div>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label={t(language, 'close')}>
            <X size={20} />
          </button>
        </header>
        <div className="sign-language-player-wrap">
          {loading && !failed && <p className="sign-language-status" role="status">{t(language, 'signLanguageLoading')}</p>}
          {failed && <div className="sign-language-error" role="alert"><AlertTriangle size={18} /><p>{t(language, 'signLanguageError')}</p></div>}
          <video
            className="sign-language-player"
            controls
            preload="metadata"
            poster={video.poster}
            aria-label={`${t(language, 'signLanguageDescription')}: ${room.name[language]}`}
            onLoadedData={() => setLoading(false)}
            onError={() => { setLoading(false); setFailed(true); }}
          >
            <source src={video.url} />
            {video.captions?.map(caption => <track key={`${caption.language}-${caption.src}`} kind="captions" src={caption.src} srcLang={caption.language} label={caption.label[language]} default={caption.default} />)}
          </video>
        </div>
        <div className="sign-language-dialog-footer">
          {video.language && <span className="sign-language-language"><Accessibility size={16} />{video.language}</span>}
          {transcript && <details className="sign-language-transcript"><summary><FileText size={15} />{t(language, 'signLanguageTranscript')}</summary><p>{transcript}</p></details>}
        </div>
      </section>
    </div>
  );
}

export function SignLanguageAction({ language, onClick }: { language: Language; onClick: () => void }) {
  const alternateLanguage = language === 'en' ? 'ar' : 'en';
  return (
    <button type="button" className="sign-language-action" onClick={event => { event.currentTarget.focus(); onClick(); }} aria-haspopup="dialog" data-testid="sign-language-action">
      <span className="sign-language-action-icon"><Accessibility size={18} /></span>
      <span className="sign-language-action-copy">
        <strong>{t(language, 'signLanguageDescription')}</strong>
        <small lang={alternateLanguage} dir={alternateLanguage === 'ar' ? 'rtl' : 'ltr'}>{t(alternateLanguage, 'signLanguageDescription')}</small>
      </span>
      <Play size={15} fill="currentColor" aria-hidden="true" />
    </button>
  );
}
