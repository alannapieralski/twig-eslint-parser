export const RAW_TEXT_ELEMENT_NAMES: Readonly<Record<string, string>> = { ScriptTag: 'script', StyleTag: 'style' };

export const ELEMENT_NODE_TYPES: readonly string[] = ['Tag', ...Object.keys(RAW_TEXT_ELEMENT_NAMES)];

export const SINGLE_TOKEN_NODE_TYPES: readonly string[] = ['Comment', 'Doctype'];

export const ESCAPABLE_RAW_TEXT_ELEMENT_NAMES: readonly string[] = ['textarea', 'title'];

export const VOID_ELEMENT_NAMES: readonly string[] = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

export const END_TAG_OPTIONAL_ELEMENT_NAMES: ReadonlySet<string> = new Set([
  'body', 'caption', 'colgroup', 'dd', 'dt', 'head', 'html', 'li', 'optgroup', 'option', 'p', 'rp', 'rt', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
]);
