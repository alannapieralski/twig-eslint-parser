export const rawTextElementNames: Readonly<Record<string, string>> = { ScriptTag: 'script', StyleTag: 'style' };

export const elementNodeTypes: readonly string[] = ['Tag', ...Object.keys(rawTextElementNames)];

export const singleTokenNodeTypes: readonly string[] = ['Comment', 'Doctype'];
