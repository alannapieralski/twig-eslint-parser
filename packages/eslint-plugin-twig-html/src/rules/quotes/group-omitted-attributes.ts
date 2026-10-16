import type { AttributeNode, OmittedAttribute } from 'twig-eslint-parser';
import { tagNodeTypes } from '../../shared/tag-node.js';

type OwnerNode = { readonly type: string };

export type GroupedAttributes = {
  readonly unowned: readonly AttributeNode[];
  readonly ownedByTag: ReadonlyMap<object, readonly AttributeNode[]>;
};

export function groupOmittedAttributes(omittedAttributes: readonly OmittedAttribute[], findNodeAt: (index: number) => OwnerNode | null): GroupedAttributes {
  const unowned: AttributeNode[] = [];
  const ownedByTag = new Map<object, AttributeNode[]>();

  for (const omitted of omittedAttributes) {
    const owner = findNodeAt(omitted.range[0]);
    const isOwnedByTag = owner !== null && tagNodeTypes.includes(owner.type);

    if (!isOwnedByTag) {
      unowned.push(omitted.attribute);
      continue;
    }

    ownedByTag.set(owner, [...(ownedByTag.get(owner) ?? []), omitted.attribute]);
  }

  return { unowned, ownedByTag };
}
