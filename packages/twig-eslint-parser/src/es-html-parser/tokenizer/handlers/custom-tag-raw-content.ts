import {
  TokenizerContextTypes,
  INCOMPLETE_CLOSING_TAG_PATTERN,
  TokenTypes,
} from "../../constants/index.js";
import { calculateTokenPosition, createParts } from "../../utils/index.js";
import { Range, TokenizerState } from "../../types/index.js";
import { CharsBuffer } from "../chars-buffer.js";

export function parse(chars: CharsBuffer, state: TokenizerState) {
  if (chars.hasTemplate()) {
    state.accumulatedContent.concatBuffer(state.decisionBuffer);
    state.decisionBuffer.clear();
    state.sourceCode.next();
    return;
  }
  if (
    chars.value() === "<" ||
    chars.value() === "</" ||
    INCOMPLETE_CLOSING_TAG_PATTERN.test(chars.value())
  ) {
    state.sourceCode.next();
    return;
  }
  const tagName =
    state.contextParams[TokenizerContextTypes.CustomTagRawContent]?.tagName ??
    "";
  const regex = new RegExp(
    "</" + tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*>",
    "i"
  );

  if (regex.test(chars.value())) {
    return parseClosingCustomTag(state);
  }

  state.accumulatedContent.concatBuffer(state.decisionBuffer);
  state.decisionBuffer.clear();
  state.sourceCode.next();
}

function parseClosingCustomTag(state: TokenizerState) {
  if (state.accumulatedContent.value() !== "") {
    const position = calculateTokenPosition(state, { keepBuffer: false });
    state.tokens.push({
      type: TokenTypes.RawContent,
      value: state.accumulatedContent.value(),
      range: position.range,
      loc: position.loc,
      parts: createParts(state, TokenTypes.RawContent),
    });
  }

  const range: Range = [
    state.sourceCode.index() - (state.decisionBuffer.length() - 1),
    state.sourceCode.index() + 1,
  ];

  state.tokens.push({
    type: TokenTypes.CloseTag,
    value: state.decisionBuffer.value(),
    range,
    loc: state.sourceCode.getLocationOf(range),
  });

  state.accumulatedContent.clear();
  state.decisionBuffer.clear();
  state.contextParams[TokenizerContextTypes.CustomTagRawContent] = undefined;
  state.currentContext = TokenizerContextTypes.Data;
  state.sourceCode.next();
}

export function handleContentEnd(state: TokenizerState) {
  state.accumulatedContent.concatBuffer(state.decisionBuffer);
  state.decisionBuffer.clear();
  if (state.accumulatedContent.value() === "") {
    return;
  }

  const position = calculateTokenPosition(state, { keepBuffer: false });
  state.tokens.push({
    type: TokenTypes.RawContent,
    value: state.accumulatedContent.value(),
    range: position.range,
    loc: position.loc,
    parts: createParts(state, TokenTypes.RawContent),
  });
  state.accumulatedContent.clear();
}
