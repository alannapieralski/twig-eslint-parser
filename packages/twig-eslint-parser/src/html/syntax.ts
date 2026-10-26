export const RAW_TEXT_ELEMENT_NAMES: Readonly<Record<string, string>> = { ScriptTag: 'script', StyleTag: 'style' };

export const ELEMENT_NODE_TYPES: readonly string[] = ['Tag', ...Object.keys(RAW_TEXT_ELEMENT_NAMES)];

export const SINGLE_TOKEN_NODE_TYPES: readonly string[] = ['Comment', 'Doctype'];
