import type { ClassSelector } from '../selectors/class-selector.js';

const selectorKinds: ReadonlySet<unknown> = new Set(['attribute', 'callee', 'tag', 'variable']);
const kindsThatMatchByPath: ReadonlySet<unknown> = new Set(['callee', 'tag']);
const matcherTypes: ReadonlySet<unknown> = new Set(['strings', 'objectKeys', 'objectValues']);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function isOptionalPattern(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'string') return false;

  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}

function isMatcher(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (value['type'] === 'anonymousFunctionReturn') return Array.isArray(value['match']) && value['match'].every(isMatcher);

  return matcherTypes.has(value['type']) && isOptionalPattern(value['path']);
}

export function isSelector(value: unknown): boolean {
  if (!isObject(value)) return false;

  const { kind, name, path, match } = value as Partial<Record<keyof ClassSelector, unknown>>;

  if (!selectorKinds.has(kind)) return false;
  if (!isOptionalPattern(name) || !isOptionalPattern(path)) return false;
  if (match !== undefined && !(Array.isArray(match) && match.every(isMatcher))) return false;

  const hasName = name !== undefined;
  const hasUsablePath = path !== undefined && kindsThatMatchByPath.has(kind);

  return hasName || hasUsablePath;
}
