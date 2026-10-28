export const RAW_TEXT_ELEMENT_NAMES: Readonly<Record<string, string>> = { ScriptTag: 'script', StyleTag: 'style' };

export const ELEMENT_NODE_TYPES: readonly string[] = ['Tag', ...Object.keys(RAW_TEXT_ELEMENT_NAMES)];

export const SINGLE_TOKEN_NODE_TYPES: readonly string[] = ['Comment', 'Doctype'];

export const ESCAPABLE_RAW_TEXT_ELEMENT_NAMES: readonly string[] = ['textarea', 'title'];

export const VOID_ELEMENT_NAMES: readonly string[] = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

export const FOREIGN_ELEMENT_NAMES: readonly string[] = ['math', 'svg'];

export const END_TAG_OPTIONAL_ELEMENT_NAMES: ReadonlySet<string> = new Set([
  'body', 'caption', 'colgroup', 'dd', 'dt', 'head', 'html', 'li', 'optgroup', 'option', 'p', 'rp', 'rt', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
]);

export const NON_VOID_HTML_ELEMENT_NAMES: ReadonlySet<string> = new Set([
  'a', 'abbr', 'address', 'article', 'aside', 'audio', 'b', 'bdi', 'bdo', 'blockquote', 'body', 'button', 'canvas', 'caption', 'cite',
  'code', 'colgroup', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'html', 'i', 'iframe', 'ins', 'kbd', 'label',
  'legend', 'li', 'main', 'map', 'mark', 'menu', 'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p',
  'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'search', 'section', 'select', 'slot', 'small', 'span',
  'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title',
  'tr', 'u', 'ul', 'var', 'video',
]);
