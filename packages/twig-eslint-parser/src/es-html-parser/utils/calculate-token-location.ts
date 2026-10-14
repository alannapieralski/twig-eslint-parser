import { Range } from "../types/index.js";
import { getLineInfo } from "./get-line-info.js";

export function calculateTokenLocation(source: string, range: Range) {
  return {
    start: getLineInfo(source, range[0]),
    end: getLineInfo(source, range[1]),
  };
}
