import { describe, expect, it } from 'vitest';
import { isNumberText, steppedValue } from './ui';

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

describe('steppedValue', () => {
  it('steps by the field\'s step, rounded to its decimals', () => {
    expect(steppedValue(2.5, 0.1, 1)).toBe(2.6);
    expect(steppedValue(0.3, 0.1, -1)).toBe(0.2);
  });

  it('stays within min and max', () => {
    expect(steppedValue(1, 1, -1, 1)).toBe(1);
    expect(steppedValue(2.5, 0.1, 1, 0, 2.55)).toBe(2.55);
  });

  it('leaves a value already past the limit it steps towards, as loaded data can be', () => {
    expect(steppedValue(2, 1, 1, 1, 1)).toBe(2);
    expect(steppedValue(2, 1, -1, 1, 1)).toBe(1);
  });
});
