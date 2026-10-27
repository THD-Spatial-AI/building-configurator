import { describe, expect, it } from 'vitest';
import { isNumberText } from './ui';

describe('isNumberText', () => {
  it('takes digits, a sign and either decimal separator', () => {
    expect(isNumberText('0,4', false)).toBe(true);
    expect(isNumberText('-12.5', false)).toBe(true);
    expect(isNumberText('', false)).toBe(true);
  });

  it('refuses letters and other characters', () => {
    expect(isNumberText('19a8', false)).toBe(false);
    expect(isNumberText('1e3', false)).toBe(false);
    expect(isNumberText('2 m', false)).toBe(false);
  });

  it('takes no separator in a whole-number field, such as a year', () => {
    expect(isNumberText('1998', true)).toBe(true);
    expect(isNumberText('1998.5', true)).toBe(false);
    expect(isNumberText('19,9', true)).toBe(false);
  });
});
