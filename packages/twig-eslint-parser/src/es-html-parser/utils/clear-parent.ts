import { ContextualDocumentNode, DocumentNode } from "../types/index.js";

export function clearParent(ast: ContextualDocumentNode): DocumentNode {
  const pending: any[] = [ast];

  for (let node = pending.pop(); node; node = pending.pop()) {
    delete node.parentRef;

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        pending.push(child);
      }
    }
  }

  return ast as DocumentNode;
}
