import { DocumentNode } from "./node.js";
import { TokenAdapter } from "./token-adapter.js";
import { AnyToken } from "./token.js";
import { TemplateInfo } from "./template.js";

export type ParseResult = {
  ast: DocumentNode;
  tokens: AnyToken[];
};

export type Options = {
  tokenAdapter?: TokenAdapter;
  rawContentTags?: string[];
  templateInfos?: TemplateInfo[];
};
