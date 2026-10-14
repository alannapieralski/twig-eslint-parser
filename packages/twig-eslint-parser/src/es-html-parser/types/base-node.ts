import { NodeTypes } from "../constants/index.js";
import { SourceLocation } from "./source-location.js";
import { Range } from "./range.js";

export interface BaseNode {
  type: NodeTypes;
  range: Range;
  loc: SourceLocation;
}
