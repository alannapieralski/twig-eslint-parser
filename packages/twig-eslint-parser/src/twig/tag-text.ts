export function tagText(tagName: string | undefined): string {
  return `{% ${tagName ?? ''} %}`;
}
