export const JAVASCRIPT_BY_TWIG_OPERATOR: Readonly<Record<string, string>> = {
  'and': '&&',
  'or': '||',
  'xor': '^',
  'not': '!',
  'b-and': '&',
  'b-or': '|',
  'b-xor': '^',
  'in': '==',
  'not in': '!=',
  'matches': '==',
  'starts with': '==',
  'ends with': '==',
  'has some': ',',
  'has every': ',',
  '~': '+',
  '..': '+',
  '//': '/',
  '?:': '||',
  '? :': '||',
  '<=>': '==',
};

export const JAVASCRIPT_BY_TWIG_TEST_OPERATOR: Readonly<Record<string, string>> = { 'is': '==', 'is not': '!=' };

export const TWO_WORD_TESTS: Readonly<Record<string, string>> = { same: 'as', divisible: 'by' };

export const EXPRESSION_TAGS: ReadonlySet<string> = new Set(['if', 'elseif', 'do', 'macro', 'with']);

export const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'apply', 'autoescape', 'block', 'cache', 'embed', 'for', 'guard', 'if', 'macro', 'sandbox', 'set', 'trans', 'verbatim', 'with',
]);

export const MIDDLE_TAGS: ReadonlySet<string> = new Set(['else', 'elseif', 'plural']);

export const PARENTS_OF_MIDDLE_TAG: Readonly<Record<string, ReadonlySet<string>>> = {
  else: new Set(['if', 'for', 'guard']),
  elseif: new Set(['if']),
  plural: new Set(['trans']),
};

export const TAGS_THAT_CANNOT_FOLLOW_ELSE: ReadonlySet<string> = new Set(['else', 'elseif']);

export const TAGS_WITH_VARYING_MARKUP: ReadonlySet<string> = new Set(['if', 'for', 'guard', 'trans', 'verbatim']);

export const INCLUDE_TAGS: ReadonlySet<string> = new Set(['include', 'embed']);

export const INCLUDE_KEYWORDS_TO_BLANK: ReadonlySet<string> = new Set(['only', 'ignore', 'missing']);

export const TWIG_DELIMITERS = /\{\{|\}\}|\{%|%\}|\{#|#\}/g;

export const CONVERTED_TAGS: ReadonlySet<string> = new Set(['set', 'block', 'for', ...EXPRESSION_TAGS, ...INCLUDE_TAGS]);

export const TAGS_LEFT_UNCONVERTED: ReadonlySet<string> = new Set([
  'apply', 'autoescape', 'deprecated', 'extends', 'flush', 'from', 'guard', 'import', 'sandbox', 'types', 'use',
]);

export const RESERVED_JAVA_SCRIPT_WORDS: ReadonlySet<string> = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum',
  'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return', 'super',
  'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with',
]);
