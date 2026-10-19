import { ContextualDocumentNode, DocumentNode } from "../types/index.js";

export function clearParent(ast: ContextualDocumentNode): DocumentNode {
  const toVisit: any[] = [ast];

  for (let node = toVisit.pop(); node; node = toVisit.pop()) {
    delete node.parentRef;

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        toVisit.push(child);
      }
    }
  }

  return ast as DocumentNode;
}
