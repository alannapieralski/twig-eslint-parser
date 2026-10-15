import { TokenizerContextTypes, TokenTypes } from "../../constants/index.js";
import { calculateTokenPosition, createParts } from "../../utils/index.js";
import type { TokenizerState } from "../../types/index.js";
import { CharsBuffer } from "../chars-buffer.js";

export function parse(chars: CharsBuffer, state: TokenizerState) {
  const value = chars.value();
  if (value === ">") {
    return parseClosingCornerBrace(state);
  }

  state.accumulatedContent.concatBuffer(state.decisionBuffer);
  state.decisionBuffer.clear();
  state.sourceCode.next();
}

function parseClosingCornerBrace(state: TokenizerState) {
  const position = calculateTokenPosition(state, { keepBuffer: true });
  const parts = createParts(state, TokenTypes.CloseTag);

  state.tokens.push({
    type: TokenTypes.CloseTag,
    value: state.accumulatedContent.value() + state.decisionBuffer.value(),
    range: position.range,
    loc: position.loc,
    ...(parts.length > 0 && { parts }),
  });

  state.accumulatedContent.clear();
  state.decisionBuffer.clear();
  state.currentContext = TokenizerContextTypes.Data;
  state.sourceCode.next();
}
