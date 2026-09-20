import { describe, expect, it } from 'vitest';
import { dictionary, dictionaries, getDirection, resolveLanguage, t } from '@wayfinding/i18n';

describe('language resolution', () => {
  it.each(['ar', 'AR', 'ar-EG', ' ar_SA ', 'ar-Arab-EG'])('resolves Arabic locale %s', value => {
    expect(resolveLanguage(value)).toBe('ar');
  });

  it.each(['en', 'EN-us', 'fr', 'arabic', '', 'arbitrary', 'ar-!', null, undefined, {}, 4, ['ar']])('defaults unsupported values safely to English: %s', value => {
    expect(resolveLanguage(value)).toBe('en');
  });

  it('uses the language direction consistently', () => {
    expect(getDirection('ar')).toBe('rtl');
    expect(getDirection('en')).toBe('ltr');
  });
});

describe('visitor messages', () => {
  it('has complete nonempty Arabic and English dictionaries', () => {
    expect(Object.keys(dictionary.ar).sort()).toEqual(Object.keys(dictionary.en).sort());
    expect(Object.values(dictionary.ar).every(value => value.trim().length > 0)).toBe(true);
    expect(Object.values(dictionary.en).every(value => value.trim().length > 0)).toBe(true);
    expect(dictionaries).toBe(dictionary);
  });

  it('localizes interactive and unavailable states', () => {
    expect(t('en', 'playDescription')).toBe('Listen to description');
    expect(t('ar', 'playDescription')).toBe('استمع إلى الوصف');
    expect(t('ar', 'kioskUnconfigured')).toContain('لم يتم تأكيد');
    expect(t('en', 'distanceUncalibrated')).toContain('drawing units');
  });

  it('returns unknown keys visibly and does not expose prototype properties', () => {
    expect(t('en', 'missing.key')).toBe('missing.key');
    expect(t('ar', 'toString')).toBe('toString');
    expect(t('ar', '__proto__')).toBe('__proto__');
  });
});
