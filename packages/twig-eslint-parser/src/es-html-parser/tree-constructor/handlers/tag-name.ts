import { TokenTypes } from "../../constants/index.js";
import {
  AnyToken,
  ConstructTreeState,
  Token,
  ContextualTagNode,
} from "../../types/index.js";
import { tagNameOf } from "../../utils/index.js";

function handleTagOpenStart(
  state: ConstructTreeState<ContextualTagNode>,
  token: Token<TokenTypes.OpenTagStart>
) {
  state.currentNode.name = tagNameOf(token);

  state.currentContext = state.currentContext.parentRef;

  return state;
}

export function construct(
  token: AnyToken,
  state: ConstructTreeState<ContextualTagNode>
) {
  if (token.type === TokenTypes.OpenTagStart) {
    handleTagOpenStart(state, token);
  }

  state.caretPosition++;

  return state;
}
