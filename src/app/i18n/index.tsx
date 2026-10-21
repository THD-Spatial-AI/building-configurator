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

/** The current language, e.g. for Intl number formatting. */
export function useLanguage(): Language {
  return useContext(LanguageContext);
}
