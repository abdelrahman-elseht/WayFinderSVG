import type { Language } from '@wayfinding/map-engine';

/** UI-facing, replaceable speech boundary. Replay calls speak with the current text. */
export interface TTSService {
  speak(text: string, language: Language): void;
  stop(): void;
  setMuted(muted: boolean): void;
  isSupported(): boolean;
}

/** Creating this adapter is safe during server rendering; browser access is lazy. */
export function createBrowserTTS(): TTSService {
  let muted = false;

  function isSupported(): boolean {
    return typeof window !== 'undefined'
      && typeof window.speechSynthesis?.speak === 'function'
      && typeof window.speechSynthesis?.cancel === 'function'
      && typeof window.SpeechSynthesisUtterance === 'function';
  }

  function stop(): void {
    if (!isSupported()) return;
    try { window.speechSynthesis.cancel(); } catch { /* Restricted browser speech is unavailable. */ }
  }

  return {
    isSupported,
    stop,
    setMuted(value) {
      muted = value;
      if (muted) stop();
    },
    speak(text, language) {
      if (!isSupported()) return;
      stop();
      if (muted || !text.trim()) return;
      try {
        const utterance = new window.SpeechSynthesisUtterance(text.trim());
        utterance.lang = language;
        // An empty voice list can be temporary. Do not pretend a locale voice exists.
        const voices = window.speechSynthesis.getVoices?.() ?? [];
        const matchingVoices = voices.filter(voice => voice.lang.toLowerCase().split(/[-_]/)[0] === language);
        const voice = matchingVoices.find(item => item.lang.toLowerCase() === language)
          ?? matchingVoices.find(item => item.default)
          ?? matchingVoices[0];
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }
        window.speechSynthesis.speak(utterance);
      } catch {
        // Speech is optional: denied or broken browser engines must not break the kiosk.
      }
    },
  };
}
