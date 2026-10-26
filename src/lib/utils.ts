/**
 * Joins class names, skipping false, null and undefined. Conflicting Tailwind
 * classes are not resolved, so pass one or the other, never both.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
