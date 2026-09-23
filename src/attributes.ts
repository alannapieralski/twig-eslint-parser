type AttributeNode = {
  readonly type: 'Attribute';
  readonly range: [number, number];
  readonly key: { readonly value: string };
  readonly value?: { readonly parts?: readonly { readonly type: string }[] };
};

export type OmittedAttribute = { readonly name: string; readonly range: readonly [number, number] };

function isAttributeNode(value: unknown): value is AttributeNode {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'Attribute';
}

function containsTwig(attribute: AttributeNode): boolean {
  return attribute.value?.parts?.some((part) => part.type === 'Template') ?? false;
}

export function omitInterpolatedAttributes(root: unknown, attributeNames: ReadonlySet<string>): OmittedAttribute[] {
  if (attributeNames.size === 0) return [];

  const omitted: OmittedAttribute[] = [];
  const visited = new WeakSet<object>();
  const shouldOmit = (attribute: AttributeNode) => attributeNames.has(attribute.key.value.toLowerCase()) && containsTwig(attribute);

  const visit = (value: unknown): void => {
    if (typeof value !== 'object' || value === null || visited.has(value)) return;
    visited.add(value);

    const node = value as Record<string, unknown>;
    const attributes = node['attributes'];
    if (Array.isArray(attributes) && attributes.every(isAttributeNode)) {
      for (const attribute of attributes.filter(shouldOmit)) omitted.push({ name: attribute.key.value, range: attribute.range });
      node['attributes'] = attributes.filter((attribute) => !shouldOmit(attribute));
    }
    for (const [key, child] of Object.entries(node)) {
      if (key !== 'parent') visit(child);
    }
  };

  visit(root);
  return omitted;
}
