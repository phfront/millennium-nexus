export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function toSlug(text: string): string {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

export function onlyAlpha(text: string): string {
  return text.replace(/[^a-zA-ZÀ-ÿ]/g, '');
}

export function maskString(text: string, mask: string): string {
  const cleaned = text.replace(/\D/g, '');
  let result = '';
  let textIndex = 0;
  for (let i = 0; i < mask.length && textIndex < cleaned.length; i++) {
    if (mask[i] === '#') {
      result += cleaned[textIndex++];
    } else {
      result += mask[i];
    }
  }
  return result;
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function capitalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
}
