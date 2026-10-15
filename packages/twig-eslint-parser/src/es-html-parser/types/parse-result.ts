import { DocumentNode } from "./node.js";
import { AnyToken } from "./token.js";

export type ParseResult = {
  ast: DocumentNode;
  tokens: AnyToken[];
};
