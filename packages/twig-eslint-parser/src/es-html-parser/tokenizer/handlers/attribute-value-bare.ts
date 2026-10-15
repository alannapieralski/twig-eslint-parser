import { TokenizerContextTypes, TokenTypes } from "../../constants/index.js";
import { calculateTokenPosition, isWhitespace, createParts } from "../../utils/index.js";
import type { TokenizerState } from "../../types/index.js";
import { CharsBuffer } from "../chars-buffer.js";

export function parseValueEnd(state: TokenizerState) {
  const position = calculateTokenPosition(state, { keepBuffer: false });

  state.tokens.push({
    type: TokenTypes.AttributeValue,
    value: state.accumulatedContent.value(),
    range: position.range,
    loc: position.loc,
    parts: createParts(state, TokenTypes.AttributeValue),
  });

  state.accumulatedContent.clear();
  state.decisionBuffer.clear();
  state.currentContext = TokenizerContextTypes.Attributes;
}

export function isSelfClosingSlash(chars: CharsBuffer, state: TokenizerState) {
  if (chars.value() !== "/") return false;
  state.sourceCode.next();
  const following = state.sourceCode.isEof() ? undefined : state.sourceCode.current();
  state.sourceCode.prev();
  return following?.isTemplate === false && following.value === ">";
}

export function parse(chars: CharsBuffer, state: TokenizerState) {
  if (isWhitespace(chars.value()) || chars.value() === ">" || isSelfClosingSlash(chars, state)) {
    return parseValueEnd(state);
  }

  state.accumulatedContent.concatBuffer(state.decisionBuffer);
  state.decisionBuffer.clear();
  state.sourceCode.next();
}

export function handleContentEnd(state: TokenizerState) {
  if (state.accumulatedContent.length() > 0) parseValueEnd(state);
}
