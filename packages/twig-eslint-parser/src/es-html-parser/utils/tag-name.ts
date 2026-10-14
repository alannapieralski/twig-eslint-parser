import { TokenTypes } from "../constants/index.js";
import { CharsBuffer } from "../tokenizer/chars-buffer.js";
import { parseCloseTagName } from "./parse-close-tag-name.js";
import { parseOpenTagName } from "./parse-open-tag-name.js";

type NamedToken = {
  value: string;
  parts?: { type: TokenTypes; value: string }[];
};

export function openTagNameOf(buffer: CharsBuffer): string {
  if (!buffer.hasTemplate()) {
    return parseOpenTagName(buffer.value());
  }
  return buffer
    .getParts()
    .map((chars) => (chars.isTemplate ? chars.value : chars.value.toLowerCase()))
    .join("")
    .replace(/^</, "");
}

export function tagNameOf(token: NamedToken): string {
  if (!token.parts || token.parts.length === 0) {
    return parseOpenTagName(token.value);
  }
  return token.parts
    .map((part) =>
      part.type === TokenTypes.Template ? part.value : part.value.toLowerCase()
    )
    .join("")
    .replace(/^</, "");
}

export function closeTagNameOf(token: NamedToken): string {
  if (!token.parts || token.parts.length === 0) {
    return parseCloseTagName(token.value);
  }
  return token.parts
    .map((part) =>
      part.type === TokenTypes.Template ? part.value : part.value.toLowerCase()
    )
    .join("")
    .replace(/^<\//, "")
    .trim();
}

export function tagNameKey(name: string): string {
  return name.replace(/\s+/g, "").replace(/\/$/, "").toLowerCase();
}
