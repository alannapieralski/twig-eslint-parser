import {
  ConstructTreeContextTypes,
  NodeTypes,
  TokenTypes,
} from "../../constants/index.js";
import {
  ConstructTreeState,
  AnyToken,
  ContextualTagNode,
  ContextualCommentNode,
  Token,
  ContextualDocumentNode,
  ContextualScriptTagNode,
  ContextualStyleTagNode,
  ContextualDoctypeNode,
  TextNode,
  CompositeToken,
  RawContentNode,
} from "../../types/index.js";
import {
  cloneRange,
  closeTagNameOf,
  createNodeFrom,
  cloneLocation,
  initChildrenIfNone,
  tagNameKey,
} from "../../utils/index.js";

function handleOpenTagStart(
  state: ConstructTreeState<ContextualTagNode>,
  token: AnyToken
) {
  initChildrenIfNone(state.currentNode);

  const tagNode: ContextualTagNode = {
    type: NodeTypes.Tag,
    parentRef: state.currentNode,
    range: cloneRange(token.range),
    loc: cloneLocation(token.loc),
    attributes: [],
    children: [],
  };

  state.currentNode.children.push(tagNode);

  state.currentNode = tagNode;
  state.currentContext = {
    parentRef: state.currentContext,
    type: ConstructTreeContextTypes.Tag,
  };

  return state;
}

function isClosedBy(node: { type: NodeTypes; name?: string }, closeTagName: string): boolean {
  return node.type === NodeTypes.Tag && tagNameKey(node.name ?? "") === closeTagName;
}

function hasOpenAncestorNamed(node: unknown, nameKey: string): boolean {
  for (
    let ancestor = node as ContextualTagNode | undefined;
    ancestor?.type === NodeTypes.Tag;
    ancestor = ancestor.parentRef as ContextualTagNode | undefined
  ) {
    if (tagNameKey(ancestor.name ?? "") === nameKey) {
      return true;
    }
  }
  return false;
}

function handleCloseTag(
  state: ConstructTreeState<ContextualTagNode>,
  token: AnyToken
) {
  const closeTagName = tagNameKey(closeTagNameOf(token));

  if (!isClosedBy(state.currentNode, closeTagName)) {
    if (!hasOpenAncestorNamed(state.currentNode.parentRef, closeTagName)) {
      state.caretPosition++;
      return state;
    }

    state.currentNode = state.currentNode.parentRef as ContextualTagNode;
    state.currentContext = state.currentContext.parentRef.parentRef;
    return state;
  }

  state.currentContext = state.currentContext.parentRef;

  return state;
}

function handleCommentOpen(
  state: ConstructTreeState<ContextualTagNode>,
  token: AnyToken
) {
  initChildrenIfNone(state.currentNode);

  const commentNode: ContextualCommentNode = {
    type: NodeTypes.Comment,
    parentRef: state.currentNode,
    range: cloneRange(token.range),
    loc: cloneLocation(token.loc),
  };

  state.currentNode.children.push(commentNode);

  // @ts-ignore
  state.currentNode = commentNode;
  state.currentContext = {
    parentRef: state.currentContext,
    type: ConstructTreeContextTypes.Comment,
  };

  return state;
}

function handleDoctypeOpen(
  state: ConstructTreeState<ContextualTagNode | ContextualDocumentNode>,
  token: AnyToken
) {
  initChildrenIfNone(state.currentNode);

  const doctypeNode: ContextualDoctypeNode = {
    type: NodeTypes.Doctype,
    parentRef: state.currentNode,
    range: cloneRange(token.range),
    loc: cloneLocation(token.loc),
    attributes: [],
  };

  state.currentNode.children.push(doctypeNode);

  // @ts-ignore
  state.currentNode = doctypeNode;
  state.currentContext = {
    parentRef: state.currentContext,
    type: ConstructTreeContextTypes.Doctype,
  };

  return state;
}

function handleText(
  state: ConstructTreeState<ContextualTagNode | ContextualDocumentNode>,
  token: CompositeToken<TokenTypes.Text>
) {
  initChildrenIfNone(state.currentNode);
  const textNode = createNodeFrom(token) as TextNode;

  state.currentNode.children.push(textNode);
  state.caretPosition++;

  return state;
}

function handleRawContent(
  state: ConstructTreeState<ContextualTagNode | ContextualDocumentNode>,
  token: CompositeToken<TokenTypes.RawContent>
) {
  initChildrenIfNone(state.currentNode);
  const rawContentNode = createNodeFrom(token) as RawContentNode;

  state.currentNode.children.push(rawContentNode);
  state.caretPosition++;

  return state;
}

function handleOpenScriptTagStart(
  state: ConstructTreeState<ContextualTagNode | ContextualDocumentNode>,
  token: Token<TokenTypes.OpenScriptTagStart>
) {
  initChildrenIfNone(state.currentNode);
  const scriptNode: ContextualScriptTagNode = {
    type: NodeTypes.ScriptTag,
    parentRef: state.currentNode,
    range: cloneRange(token.range),
    loc: cloneLocation(token.loc),
    attributes: [],
  };
  state.currentNode.children.push(scriptNode);

  // @ts-ignore
  state.currentNode = scriptNode;
  state.currentContext = {
    type: ConstructTreeContextTypes.ScriptTag,
    parentRef: state.currentContext,
  };

  return state;
}

function handleOpenStyleTagStart(
  state: ConstructTreeState<ContextualTagNode | ContextualDocumentNode>,
  token: Token<TokenTypes.OpenStyleTagStart>
) {
  initChildrenIfNone(state.currentNode);

  const styleNode: ContextualStyleTagNode = {
    type: NodeTypes.StyleTag,
    parentRef: state.currentNode,
    range: cloneRange(token.range),
    loc: cloneLocation(token.loc),
    attributes: [],
  };

  state.currentNode.children.push(styleNode);

  // @ts-ignore
  state.currentNode = styleNode;

  state.currentContext = {
    type: ConstructTreeContextTypes.StyleTag,
    parentRef: state.currentContext,
  };

  return state;
}

export function construct(
  token: AnyToken,
  state: ConstructTreeState<ContextualTagNode>
) {
  if (token.type === TokenTypes.OpenScriptTagStart) {
    return handleOpenScriptTagStart(state, token);
  }

  if (token.type === TokenTypes.OpenStyleTagStart) {
    return handleOpenStyleTagStart(state, token);
  }

  if (token.type === TokenTypes.OpenTagStart) {
    return handleOpenTagStart(state, token);
  }

  if (token.type === TokenTypes.Text) {
    return handleText(state, token);
  }

  if (token.type === TokenTypes.RawContent) {
    return handleRawContent(state, token);
  }

  if (token.type === TokenTypes.CloseTag) {
    return handleCloseTag(state, token);
  }

  if (token.type === TokenTypes.CommentOpen) {
    return handleCommentOpen(state, token);
  }

  if (token.type === TokenTypes.DoctypeOpen) {
    return handleDoctypeOpen(state, token);
  }

  state.caretPosition++;

  return state;
}
