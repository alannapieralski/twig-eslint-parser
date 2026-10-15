import { TokenizerContextTypes } from "../constants/index.js";
import { CharsBuffer } from "../tokenizer/chars-buffer.js";
import { SourceCode } from "../tokenizer/source-code.js";
import { TemplateInfo } from "./template.js";
import { AnyToken } from "./token.js";
import { TokenAdapter } from "./token-adapter.js";

type ContextParams = {
  [TokenizerContextTypes.AttributeValueWrapped]?: {
    wrapper: string;
  };
  [TokenizerContextTypes.Attributes]?: {
    tagName: string;
  };
  [TokenizerContextTypes.OpenTagEnd]?: {
    tagName: string;
  };
  [TokenizerContextTypes.DoctypeAttributeWrapped]?: {
    wrapper: string;
  };
  [TokenizerContextTypes.CustomTagRawContent]?: {
    tagName: string;
  };
};

export type TokenizerState = {
  mode: "template" | "default";
  currentContext: TokenizerContextTypes;
  contextParams: ContextParams;
  decisionBuffer: CharsBuffer;
  accumulatedContent: CharsBuffer;
  templateInfos: TemplateInfo[];
  rawContentTags?: string[];
  tokenAdapter: TokenAdapter;
  sourceCode: SourceCode;
  tokens: {
    push(token: AnyToken): void;
  };
};
