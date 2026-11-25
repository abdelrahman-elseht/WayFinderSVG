'use client';

import { useEffect, useRef } from 'react';
import { ArrowUpDown, ArrowUpRight, X } from 'lucide-react';
import type { Language } from '@wayfinding/map-engine';

export type TransitionChoice = {
  transitionId: string;
  type: 'elevator' | 'escalator';
  name: string;
  available: boolean;
};

const copy = {
  en: {
    title: 'Choose a floor transition',
    description: 'Start at {start} and choose how to reach {destination}.',
    escalator: 'Escalator route',
    elevator: 'Lift route',
    access: 'Public access and step-free suitability are unverified.',
    unavailable: 'No mapped route to this destination',
    cancel: 'Cancel',
    close: 'Close route choice',
  },
  ar: {
    title: 'اختر وسيلة الانتقال بين الطوابق',
    description: 'ابدأ من {start} واختر طريقة الوصول إلى {destination}.',
    escalator: 'المسار عبر السلم المتحرك',
    elevator: 'المسار عبر المصعد',
    access: 'إمكانية الدخول والاستخدام دون درج غير مؤكدة.',
    unavailable: 'لا يوجد مسار مرسوم إلى هذه الوجهة',
    cancel: 'إلغاء',
    close: 'إغلاق خيارات المسار',
  },
} satisfies Record<Language, Record<string, string>>;

type Props = {
  language: Language;
  options: TransitionChoice[];
  startLabel: string;
  destinationFloor: string;
  onChoose: (transitionId: string) => void;
  onClose: () => void;
};

export function TransitionChoiceDialog({ language, options, startLabel, destinationFloor, onChoose, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);
  const labels = copy[language];

  useEffect(() => {
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const dialog = closeRef.current?.closest('[role="dialog"]');
      const focusable = dialog
        ? Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).filter(button => !button.disabled)
        : [];
      if (focusable.length < 2) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [onClose]);

  return <div className="transition-choice-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="transition-choice-dialog" role="dialog" aria-modal="true"
      aria-labelledby="transition-choice-title" aria-describedby="transition-choice-description"
      data-testid="transition-choice-dialog" onMouseDown={event => event.stopPropagation()}>
      <header className="transition-choice-header">
        <div>
          <h2 id="transition-choice-title">{labels.title}</h2>
          <p id="transition-choice-description">{labels.description.replace('{start}', startLabel).replace('{destination}', destinationFloor)}</p>
        </div>
        <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label={labels.close}>
          <X size={20} />
        </button>
      </header>
      <div className="transition-choice-options">
        {options.map(option => {
          const escalator = option.type === 'escalator';
          const Icon = escalator ? ArrowUpRight : ArrowUpDown;
          return <button key={option.transitionId} type="button" className="transition-choice-option"
            disabled={!option.available}
            data-testid={`transition-choice-${option.type}`} onClick={() => onChoose(option.transitionId)}>
            <span className="transition-choice-icon"><Icon size={20} aria-hidden="true" /></span>
            <span className="transition-choice-copy">
              <strong>{escalator ? labels.escalator : labels.elevator}</strong>
              <small>{option.name}</small>
              {!option.available && <small className="transition-choice-unavailable">{labels.unavailable}</small>}
            </span>
          </button>;
        })}
      </div>
      <p className="transition-choice-access-note">{labels.access}</p>
      <button type="button" className="text-button transition-choice-cancel" onClick={onClose}>{labels.cancel}</button>
    </section>
  </div>;
}
