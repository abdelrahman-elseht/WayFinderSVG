// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceEvidencePicker } from '../../apps/web/components/admin/NavigationEditor';

afterEach(cleanup);

describe.each([['GF', 42_097], ['01', 51_796]] as const)('bounded source evidence on %s', (floorId, count) => {
  const references = Array.from({ length: count }, (_, index) => `maps/B03/${floorId}/source/vectors.json#/paths/${index}`);

  it('bounds every page, retains a selected tail identifier and searches without selecting', () => {
    const onChange = vi.fn();
    const selected = references.at(-1)!;
    const { rerender } = render(<SourceEvidencePicker references={references} value={selected} onChange={onChange} disabled={false} language="en" />);
    const select = screen.getByLabelText<HTMLSelectElement>('Authoring source reference');
    expect(select.options.length).toBeLessThanOrEqual(100);
    expect(select.value).toBe(selected);
    expect(select.selectedOptions[0].textContent).toContain(selected);
    fireEvent.click(screen.getByRole('button', { name: 'Next evidence page' }));
    expect(select.options.length).toBeLessThanOrEqual(100);
    expect(select.options[2].value).toBe(references[98]);
    fireEvent.change(screen.getByLabelText('Search source evidence'), { target: { value: references[30_000] } });
    expect(select.options.length).toBeLessThanOrEqual(100);
    expect(select.value).toBe(selected);
    expect(Array.from(select.options).some(option => option.value === references[30_000])).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Search source evidence'), { target: { value: 'not-a-supplied-reference' } });
    expect(select.value).toBe(selected);
    expect(select.options.length).toBe(2);
    expect(onChange).not.toHaveBeenCalled();
    rerender(<SourceEvidencePicker references={references} value={references[25_000]} onChange={onChange} disabled={false} language="en" />);
    expect(select.value).toBe(references[25_000]);
    expect(select.selectedOptions[0].textContent).toContain(references[25_000]);
  });

  it('selects exact identifiers with Enter, supports native select and keyboard clear', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const props = { references, onChange, disabled: false, language: 'en' as const };
    const { rerender } = render(<SourceEvidencePicker {...props} value="" />);
    const input = screen.getByLabelText('Search source evidence');
    const last = references.at(-1)!;
    fireEvent.change(input, { target: { value: last } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(last);
    rerender(<SourceEvidencePicker {...props} value={last} />);
    input.focus();
    await user.keyboard('{Escape}');
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.getByLabelText<HTMLSelectElement>('Authoring source reference').value).toBe(last);
    await user.selectOptions(screen.getByLabelText('Authoring source reference'), references[0]);
    expect(onChange).toHaveBeenLastCalledWith(references[0]);
    screen.getByRole('button', { name: 'Clear selected evidence' }).focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});

it('keeps all identifiers reachable by paging without making implicit selections', () => {
  const references = Array.from({ length: 299 }, (_, index) => `source-${index}`);
  const onChange = vi.fn();
  render(<SourceEvidencePicker references={references} value="" onChange={onChange} disabled={false} language="en" />);
  const seen = new Set<string>();
  const next = screen.getByRole('button', { name: 'Next evidence page' }) as HTMLButtonElement;
  do {
    const select = screen.getByLabelText<HTMLSelectElement>('Authoring source reference');
    expect(select.options.length).toBeLessThanOrEqual(100);
    Array.from(select.options).forEach(option => { if (option.value) seen.add(option.value); });
    if (next.disabled) break;
    fireEvent.click(next);
  } while (true);
  expect([...seen]).toEqual(references);
  expect(onChange).not.toHaveBeenCalled();
});

it('localizes the picker, keeps stable LTR identifiers within RTL, and disables changes while busy', () => {
  const onChange = vi.fn();
  render(<SourceEvidencePicker references={['maps/B03/01/master.svg']} value="maps/B03/01/master.svg" onChange={onChange} disabled language="ar" />);
  expect(screen.getByLabelText('اختيار دليل المصدر').getAttribute('dir')).toBe('rtl');
  const select = screen.getByLabelText<HTMLSelectElement>('مرجع مصدر التحرير');
  expect(select.getAttribute('dir')).toBe('ltr');
  expect(select.disabled).toBe(true);
  expect(screen.getByLabelText<HTMLInputElement>('البحث في أدلة المصدر').disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'مسح الدليل المحدد' }) as HTMLButtonElement).disabled).toBe(true);
  expect(select.value).toBe('maps/B03/01/master.svg');
});
