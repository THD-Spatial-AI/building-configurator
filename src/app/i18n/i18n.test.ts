import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES, formatDecimal, formatNumber, parseDecimal, resolveLanguage, translate, type Language } from './index';

type Messages = { [key: string]: string | Messages };

/** Every leaf key, with plural forms collapsed onto their message key. */
function keys(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([name, value]) => {
    const key = prefix ? `${prefix}.${name}` : name;
    if (typeof value === 'string') return [key];
    return 'other' in value ? [key] : keys(value, key);
  });
}

function lookupNode(messages: Messages, key: string): string | Messages | undefined {
  return key.split('.').reduce<string | Messages | undefined>(
    (node, part) => (node && typeof node === 'object' ? node[part] : undefined),
    messages,
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('translate', () => {
  it('fills placeholders', () => {
    MESSAGES.en.__test = { greeting: 'Hello {name}', plural: { one: '{count} surface', other: '{count} surfaces' } };
    expect(translate('en', '__test.greeting', { name: 'Anna' })).toBe('Hello Anna');
  });

  it('picks the plural form for count', () => {
    expect(translate('en', '__test.plural', { count: 1 })).toBe('1 surface');
    expect(translate('en', '__test.plural', { count: 3 })).toBe('3 surfaces');
  });

  it('falls back to English, then to the key', () => {
    expect(translate('de', '__test.greeting', { name: 'Anna' })).toBe('Hello Anna');
    expect(translate('de', 'no.such.key')).toBe('no.such.key');
  });
});

describe('decimal fields', () => {
  it('show a value with the language decimal separator and no grouping', () => {
    expect(formatDecimal('de', 0.395)).toBe('0,395');
    expect(formatDecimal('de', 21356.5)).toBe('21356,5');
    expect(formatDecimal('en', 0.395)).toBe('0.395');
  });

  it('read either separator as the decimal one', () => {
    expect(parseDecimal('0,7')).toBe(0.7);
    expect(parseDecimal('0.7')).toBe(0.7);
    expect(parseDecimal(' 1.234,5 ')).toBe(1234.5);
    expect(parseDecimal('-2')).toBe(-2);
  });

  it('read an empty field as null and an unfinished one as undefined', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('-')).toBeUndefined();
    expect(parseDecimal('abc')).toBeUndefined();
  });
});

describe('resolveLanguage', () => {
  it.each([
    ['de', 'de'], ['de-DE', 'de'], ['de_DE', 'de'], ['NL', 'nl'], ['pt-BR', 'en'], ['', 'en'], [undefined, 'en'],
  ])('reads %s as %s', (code, expected) => {
    expect(resolveLanguage(code)).toBe(expected);
  });
});

describe('formatNumber', () => {
  it('uses German separators', () => {
    expect(formatNumber('de', 0.4, 2)).toBe('0,40');
    expect(formatNumber('de', 21356, 0)).toBe('21.356');
  });

  it('uses English separators', () => {
    expect(formatNumber('en', 0.4, 2)).toBe('0.40');
    expect(formatNumber('en', 21356, 0)).toBe('21,356');
  });

  it('groups French thousands with the separator Intl gives', () => {
    const group = new Intl.NumberFormat('fr').formatToParts(21356).find((part) => part.type === 'group')!.value;
    expect(group).not.toMatch(/[.,]/);
    expect(formatNumber('fr', 21356, 0)).toBe(`21${group}356`);
    expect(formatNumber('fr', 0.4, 2)).toBe('0,40');
  });

  it('takes a range of decimals', () => {
    expect(formatNumber('en', 1.5, { min: 0, max: 2 })).toBe('1.5');
    expect(formatNumber('en', 2, { min: 0, max: 2 })).toBe('2');
  });

  it('leaves the number unrounded without digits', () => {
    expect(formatNumber('de', 20.1)).toBe('20,1');
    expect(formatNumber('en', 37.125)).toBe('37.125');
  });
});

describe('locale files', () => {
  const english = keys(MESSAGES.en).filter((key) => !key.startsWith('__test')).sort();

  it.each(Object.keys(MESSAGES).filter((l) => l !== 'en') as Language[])('%s has exactly the English keys', (language) => {
    expect(keys(MESSAGES[language]).sort()).toEqual(english);
  });

  it.each(Object.keys(MESSAGES).filter((l) => l !== 'en') as Language[])('%s keeps every placeholder of the English text', (language) => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const texts = (node: string | Messages): string[] => (typeof node === 'string' ? [node] : Object.values(node).flatMap(texts));
    const mismatched = english.filter((key) => {
      const own = new Set(texts(lookupNode(MESSAGES[language], key) ?? '').map((t) => placeholders(t).join()));
      const base = new Set(texts(lookupNode(MESSAGES.en, key) ?? '').map((t) => placeholders(t).join()));
      // Plural forms may drop {count} (e.g. "one surface"), but no form may add or lose another placeholder.
      const strip = (set: Set<string>) => new Set([...set].map((p) => p.split(',').filter((n) => n !== 'count').join()));
      return [...strip(own)].some((p) => !strip(base).has(p));
    });
    expect(mismatched).toEqual([]);
  });

  it('hold every key the source asks for', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(join(__dirname, '..'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(match[1]);
    }
    expect([...used].filter((key) => !english.includes(key))).toEqual([]);
  });
});

describe('PV mounting and format tips', () => {
  it('name the options through their own labels in every language', () => {
    for (const language of Object.keys(MESSAGES) as Language[]) {
      const pv = (MESSAGES[language] as Messages).pv as Messages;
      expect(`${language} ${(pv.mounting as Messages).tip}`).toMatch(/\{flush\}.*\{racked\}/);
      expect(`${language} ${(pv.orientation as Messages).tip}`).toMatch(/\{portrait\}.*\{landscape\}.*\{auto\}/);
    }
  });
});

describe('section info tips', () => {
  it('say what the section shows, without naming the models or data sources behind it', () => {
    for (const [language, messages] of Object.entries(MESSAGES)) {
      const help = (messages as Messages).help as Messages;
      for (const [key, text] of Object.entries(help)) {
        expect(`${language} help.${key}: ${String(text)}`).not.toMatch(/BuEM|TABULA/);
      }
    }
  });
});
