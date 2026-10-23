import { describe, expect, it } from 'vitest';
import { formatNumber } from '../i18n';
import { formatTotal } from './loadProfile';

describe('formatTotal', () => {
  const de = (value: number, digits?: Parameters<typeof formatNumber>[2]) => formatNumber('de', value, digits);

  it('rewrites toFixed text at the same decimals', () => {
    expect(formatTotal('21356', de)).toBe('21.356');
    expect(formatTotal('12.5', de)).toBe('12,5');
    expect(formatTotal('0.40', de)).toBe('0,40');
  });

  it('leaves text that is not a number', () => {
    expect(formatTotal('—', de)).toBe('—');
    expect(formatTotal('', de)).toBe('');
  });
});
