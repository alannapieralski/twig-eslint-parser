import type { SourceLocation } from "./source-location.js";
import type { Range } from "./range.js";
import type { BaseToken } from "./token.js";

export interface TokenAdapter {
  finalizeRange(token: Omit<BaseToken, "loc">): Range;
  finalizeLocation(token: Omit<BaseToken, "range">): SourceLocation;
}
