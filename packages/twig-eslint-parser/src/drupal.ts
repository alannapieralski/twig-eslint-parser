export const drupalClassMethods: readonly string[] = ['addClass', 'removeClass'];

export const drupalAttributeMethods: readonly string[] = [...drupalClassMethods, 'setAttribute', 'removeAttribute'];

export const drupalAttributeObjectFunction = 'create_attribute';

const attributeListPrint = new RegExp(
  `^\\{\\{[-~]?\\s*(?:[\\w.]*attributes\\b|${drupalAttributeObjectFunction}\\s*\\(|[\\w.]+\\.(?:${drupalAttributeMethods.join('|')})\\s*\\()`,
);

export function isDrupalAttributeListPrint(printSource: string): boolean {
  return attributeListPrint.test(printSource);
}
