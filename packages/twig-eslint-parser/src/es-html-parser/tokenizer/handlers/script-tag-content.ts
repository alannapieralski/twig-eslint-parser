import {
  TokenizerContextTypes,
  INCOMPLETE_CLOSING_TAG_PATTERN,
  CLOSING_SCRIPT_TAG_PATTERN,
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

  if (CLOSING_SCRIPT_TAG_PATTERN.test(chars.value())) {
    return parseClosingScriptTag(state);
  }

  state.accumulatedContent.concatBuffer(state.decisionBuffer);
  state.decisionBuffer.clear();
  state.sourceCode.next();
}

function parseClosingScriptTag(state: TokenizerState) {
  if (state.accumulatedContent.value() !== "") {
    const position = calculateTokenPosition(state, { keepBuffer: false });
    state.tokens.push({
      type: TokenTypes.ScriptTagContent,
      value: state.accumulatedContent.value(),
      range: position.range,
      loc: position.loc,
      parts: createParts(state, TokenTypes.ScriptTagContent),
    });
  }

  const range: Range = [
    state.sourceCode.index() - (state.decisionBuffer.length() - 1),
    state.sourceCode.index() + 1,
  ];

  state.tokens.push({
    type: TokenTypes.CloseScriptTag,
    value: state.decisionBuffer.value(),
    range,
    loc: state.sourceCode.getLocationOf(range),
  });

  state.accumulatedContent.clear();
  state.decisionBuffer.clear();
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
    type: TokenTypes.ScriptTagContent,
    value: state.accumulatedContent.value(),
    range: position.range,
    loc: position.loc,
    parts: createParts(state, TokenTypes.ScriptTagContent),
  });
  state.accumulatedContent.clear();
}
