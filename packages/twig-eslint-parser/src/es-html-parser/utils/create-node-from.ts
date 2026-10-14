import { AnyToken } from "../types/index.js";
import { cloneLocation } from "./clone-location.js";
import { cloneRange } from "./clone-range.js";

export function createNodeFrom<T extends AnyToken>(token: T): unknown {
  const loc = cloneLocation(token.loc);
  const range = cloneRange(token.range);
  const ret: any = {
    type: token.type,
    value: token.value,
    loc,
    range,
  };
  // @ts-ignore
  if (token.parts) {
    // @ts-ignore
    ret.parts = token.parts;
  }

  return ret;
}
