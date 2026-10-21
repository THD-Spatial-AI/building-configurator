import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES, resolveLanguage, translate, type Language } from './index';

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

describe('resolveLanguage', () => {
  it.each([
    ['de', 'de'], ['de-DE', 'de'], ['de_DE', 'de'], ['NL', 'nl'], ['pt-BR', 'en'], ['', 'en'], [undefined, 'en'],
  ])('reads %s as %s', (code, expected) => {
    expect(resolveLanguage(code)).toBe(expected);
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
