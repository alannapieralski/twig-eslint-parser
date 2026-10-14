const groupDelimiters: ReadonlySet<string> = new Set(['[', ']', '|', '][']);

export function isGroupDelimiter(text: string): boolean {
  return groupDelimiters.has(text.trim());
}

export function containsGroupDelimiter(classList: string): boolean {
  return classList.replace(/^["'`]|["'`]$/g, '').split(/\s+/).some((token) => groupDelimiters.has(token));
}
