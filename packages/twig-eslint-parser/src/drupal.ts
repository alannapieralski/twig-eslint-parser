export const drupalClassMethods: readonly string[] = ['addClass', 'removeClass'];

const drupalAttributeMethods: readonly string[] = [...drupalClassMethods, 'setAttribute', 'removeAttribute'];

const drupalAttributeObjectFunction = 'create_attribute';

const attributeListPrint = new RegExp(
  `^\\{\\{[-~]?\\s*(?:[\\w.]*attributes\\b|${drupalAttributeObjectFunction}\\s*\\(|[\\w.]+\\.(?:${drupalAttributeMethods.join('|')})\\s*\\()`,
);

export function isDrupalAttributeListPrint(printSource: string): boolean {
  return attributeListPrint.test(printSource);
}

export const drupalVoidElements: readonly string[] = ['head-placeholder', 'css-placeholder', 'js-placeholder', 'js-bottom-placeholder'];
