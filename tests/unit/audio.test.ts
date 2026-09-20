import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserTTS, type TTSService } from '@wayfinding/audio';

class FakeUtterance {
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  constructor(public text: string) {}
}

function browser(voices: Partial<SpeechSynthesisVoice>[] = []) {
  const synthesis = { speak: vi.fn(), cancel: vi.fn(), getVoices: vi.fn(() => voices) };
  vi.stubGlobal('window', { speechSynthesis: synthesis, SpeechSynthesisUtterance: FakeUtterance });
  return synthesis;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('browser TTS adapter', () => {
  it('is safe during SSR and on unsupported browsers', () => {
    vi.stubGlobal('window', undefined);
    const service: TTSService = createBrowserTTS();
    expect(service.isSupported()).toBe(false);
    expect(() => { service.speak('Hello', 'en'); service.stop(); service.setMuted(true); }).not.toThrow();
    vi.stubGlobal('window', {});
    expect(service.isSupported()).toBe(false);
  });

  it('detects browser support lazily after server-side creation', () => {
    vi.stubGlobal('window', undefined);
    const service = createBrowserTTS();
    const synthesis = browser();
    expect(service.isSupported()).toBe(true);
    service.speak('Description', 'en');
    expect(synthesis.speak).toHaveBeenCalledOnce();
  });

  it('cancels the previous utterance for replay or a language change', () => {
    const synthesis = browser();
    const service = createBrowserTTS();
    service.speak('Description', 'en');
    service.speak('وصف الغرفة', 'ar');
    service.speak('وصف الغرفة', 'ar');
    expect(synthesis.cancel).toHaveBeenCalledTimes(3);
    expect(synthesis.speak.mock.calls.map(([utterance]) => utterance.lang)).toEqual(['en', 'ar', 'ar']);
    expect(synthesis.cancel.mock.invocationCallOrder[1]).toBeLessThan(synthesis.speak.mock.invocationCallOrder[1]);
    service.stop();
    expect(synthesis.cancel).toHaveBeenCalledTimes(4);
  });

  it('cancels on mute, suppresses muted speech, and does not replay automatically on unmute', () => {
    const synthesis = browser();
    const service = createBrowserTTS();
    service.speak('Description', 'en');
    service.setMuted(true);
    service.speak('Muted description', 'en');
    service.setMuted(false);
    expect(synthesis.speak).toHaveBeenCalledTimes(1);
    expect(synthesis.cancel).toHaveBeenCalledTimes(3);
    service.speak('New description', 'en');
    expect(synthesis.speak).toHaveBeenCalledTimes(2);
  });

  it('uses an actually available matching language voice and never invents one', () => {
    const english = { name: 'Available English', lang: 'en-US', default: true };
    const arabic = { name: 'Available Arabic', lang: 'ar-EG', default: false };
    const synthesis = browser([english, arabic]);
    const service = createBrowserTTS();
    service.speak('وصف', 'ar');
    expect(synthesis.speak.mock.calls[0][0].voice).toBe(arabic);
    expect(synthesis.speak.mock.calls[0][0].lang).toBe('ar-EG');
    synthesis.getVoices.mockReturnValue([english]);
    service.speak('وصف', 'ar');
    expect(synthesis.speak.mock.calls[1][0].voice).toBeNull();
    expect(synthesis.speak.mock.calls[1][0].lang).toBe('ar');
  });

  it('handles blank text and browser engine failures without breaking the UI', () => {
    const synthesis = browser();
    const service = createBrowserTTS();
    service.speak('  ', 'en');
    expect(synthesis.speak).not.toHaveBeenCalled();
    synthesis.speak.mockImplementation(() => { throw new Error('Speech denied'); });
    expect(() => service.speak('Description', 'en')).not.toThrow();
    synthesis.cancel.mockImplementation(() => { throw new Error('Speech denied'); });
    expect(() => service.stop()).not.toThrow();
  });
});
