export const WHITESPACE_SENSITIVE_ELEMENTS: readonly string[] = ['pre', 'textarea'];

export const INLINE_NON_VOID_ELEMENTS: readonly string[] = [
  'a', 'abbr', 'audio', 'b', 'bdi', 'bdo', 'canvas', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'iframe', 'ins', 'kbd', 'label', 'map',
  'mark', 'noscript', 'object', 'output', 'picture', 'q', 'ruby', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'svg', 'time', 'u',
  'var', 'video',
];

export const ELEMENTS_WITH_UNRENDERED_EDGE_WHITESPACE: ReadonlySet<string> = new Set([
  'title',
  'address', 'article', 'aside', 'blockquote', 'body', 'button', 'center', 'details', 'dialog', 'div', 'dl', 'dd', 'dt', 'fieldset', 'figcaption', 'figure',
  'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'html', 'legend', 'li', 'main', 'menu', 'nav', 'ol', 'p',
  'search', 'section', 'summary', 'select', 'option', 'optgroup', 'datalist', 'ul', 'table', 'caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'svg', 'g', 'defs', 'symbol', 'clippath', 'mask', 'pattern', 'marker', 'filter', 'lineargradient', 'radialgradient',
]);
