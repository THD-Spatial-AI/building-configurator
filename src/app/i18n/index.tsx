// The configurator's own translations: one JSON file per language under
// locales/, keyed by dotted paths. The host picks the language; a key missing
// from it falls back to English, and one missing from English shows as the key.

import { createContext, useCallback, useContext, type ReactNode } from 'react';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import cs from './locales/cs.json';

/** The languages EnerPlanET offers. */
export type Language = 'en' | 'de' | 'es' | 'fr' | 'it' | 'nl' | 'pl' | 'cs';

type Messages = { [key: string]: string | Messages };

export const MESSAGES: Record<Language, Messages> = { en, de, es, fr, it, nl, pl, cs };

/**
 * The language for a host's code: a region tag counts as its language
 * (de-DE and de_DE are de), and an unknown or missing code is English.
 */
export function resolveLanguage(code: string | undefined): Language {
  const base = (code ?? '').toLowerCase().split(/[-_]/)[0];
  return base in MESSAGES ? (base as Language) : 'en';
}

/** Values for a message's {placeholders}; a numeric `count` also picks its plural form. */
export type MessageValues = Record<string, string | number>;

export type Translate = (key: string, values?: MessageValues) => string;

/** A message held in state and translated where it is shown. */
export interface Message {
  key: string;
  values?: MessageValues;
}

function lookup(messages: Messages, key: string): string | Messages | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

/**
 * A message's text. A message with plural forms is an object keyed by the
 * Intl.PluralRules category (one, few, many, other) and needs `count`.
 */
export function translate(language: Language, key: string, values: MessageValues = {}): string {
  let message = lookup(MESSAGES[language], key) ?? lookup(MESSAGES.en, key);
  if (message && typeof message === 'object' && typeof values.count === 'number') {
    const category = new Intl.PluralRules(language).select(values.count);
    message = message[category] ?? message.other;
  }
  if (typeof message !== 'string') return key;
  return message.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}

const LanguageContext = createContext<Language>('en');

/** Sets the language for everything rendered inside it. */
export function LanguageProvider({ language, children }: { language: Language; children: ReactNode }) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

/** The translate function for the current language. */
export function useT(): Translate {
  const language = useContext(LanguageContext);
  return useCallback((key, values) => translate(language, key, values), [language]);
}

/** Decimals for a shown number: a fixed count, as toFixed(n) gives, or a range. */
export type Digits = number | { min: number; max: number };

/** Decimals that leave a number unrounded, as String() shows it. */
const UNROUNDED: Digits = { min: 0, max: 20 };

/**
 * A number as the language writes it, e.g. 21356.4 with 1 digit is "21.356,4"
 * in de. Without `digits` it is unrounded. Not for years, which take no grouping.
 */
export function formatNumber(language: Language, value: number, digits: Digits = UNROUNDED): string {
  const [min, max] = typeof digits === 'number' ? [digits, digits] : [digits.min, digits.max];
  return new Intl.NumberFormat(language, { minimumFractionDigits: min, maximumFractionDigits: max }).format(value);
}

/** Decimals a typed value keeps on screen; past this float noise from stepping shows. */
const FIELD_DIGITS = 6;

/** A number for an editable field: the language's decimal separator, no grouping. */
export function formatDecimal(language: Language, value: number): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: FIELD_DIGITS, useGrouping: false }).format(value);
}

/**
 * A typed value: a comma or a point is the decimal separator, and with both
 * the last one is (1.234,5 is 1234.5). null for an empty field, undefined for
 * text that is not a number yet, such as "-".
 */
export function parseDecimal(text: string): number | null | undefined {
  const trimmed = text.trim().replace(/\s/g, '');
  if (trimmed === '') return null;
  const lastSeparator = Math.max(trimmed.lastIndexOf(','), trimmed.lastIndexOf('.'));
  const normalised = lastSeparator < 0
    ? trimmed
    : `${trimmed.slice(0, lastSeparator).replace(/[.,]/g, '')}.${trimmed.slice(lastSeparator + 1)}`;
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(normalised)) return undefined;
  return Number(normalised);
}

export type FormatNumber = (value: number, digits?: Digits) => string;

/** formatNumber for the current language. */
export function useFormatNumber(): FormatNumber {
  const language = useContext(LanguageContext);
  return useCallback((value, digits) => formatNumber(language, value, digits), [language]);
}

/** The current language, e.g. for Intl number formatting. */
export function useLanguage(): Language {
  return useContext(LanguageContext);
}
