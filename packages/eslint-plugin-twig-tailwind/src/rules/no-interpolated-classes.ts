import type { Rule } from 'eslint';
import type { Node } from 'estree';
import { drupalSelectors, type ClassSelector } from '../selectors.js';

type ParentedNode = Node & { readonly parent?: ParentedNode };

type ClassContext = {
  readonly target: ParentedNode;
  readonly insideObjectValue: boolean;
  readonly objectPath: string;
};

const uncrossableTypes = new Set(['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration']);
const nonJoiningBinaryOperators = new Set(['==', '!=', '===', '!==', '<', '>', '<=', '>=']);

function isOnlyInspected(node: ParentedNode): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (parent.type === 'ConditionalExpression') return parent.test === node;
  if (parent.type === 'LogicalExpression') return parent.left === node;
  if (parent.type === 'MemberExpression') return parent.object === node;
  if (parent.type === 'BinaryExpression') return nonJoiningBinaryOperators.has(parent.operator);
  return false;
}

function joinObjectPath(segment: string, rest: string): string {
  if (rest === '') return segment;
  return rest.startsWith('[') ? `${segment}${rest}` : `${segment}.${rest}`;
}

function propertyKeyName(property: Extract<Node, { type: 'Property' }>): string | undefined {
  if (property.key.type === 'Identifier') return property.key.name;
  if (property.key.type === 'Literal') return String(property.key.value);
  return undefined;
}

function findClassContext(string: ParentedNode): ClassContext | undefined {
  let current = string;
  let insideObjectValue = false;
  let objectPath = '';

  for (let parent = current.parent; parent; current = parent, parent = parent.parent) {
    if (isOnlyInspected(current)) return undefined;
    if (uncrossableTypes.has(parent.type)) return undefined;
    if (parent.type === 'CallExpression') return parent.callee === current ? undefined : { target: parent, insideObjectValue, objectPath };
    if (parent.type === 'VariableDeclarator') return parent.init === current ? { target: parent, insideObjectValue, objectPath } : undefined;
    if (parent.type === 'ArrayExpression') objectPath = `[${parent.elements.indexOf(current as never)}]${objectPath}`;
    if (parent.type === 'Property' && parent.value === current) {
      const keyName = propertyKeyName(parent);
      if (keyName === undefined) return undefined;
      objectPath = joinObjectPath(keyName, objectPath);
      insideObjectValue = true;
    }
  }
  return undefined;
}

function calleePath(callee: ParentedNode): string | undefined {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'CallExpression') return calleePath(callee.callee as ParentedNode);
  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
    const objectPath = calleePath(callee.object as ParentedNode);
    return objectPath === undefined ? undefined : `${objectPath}.${callee.property.name}`;
  }
  return undefined;
}

function calleeName(callee: ParentedNode): string | undefined {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') return callee.property.name;
  return undefined;
}

type TargetNames = { readonly kind: ClassSelector['kind']; readonly name: string | undefined; readonly path: string | undefined };

function targetNames(target: ParentedNode): TargetNames | undefined {
  if (target.type === 'VariableDeclarator') return target.id.type === 'Identifier' ? { kind: 'variable', name: target.id.name, path: undefined } : undefined;
  if (target.type === 'CallExpression') {
    const callee = target.callee as ParentedNode;
    return { kind: 'callee', name: calleeName(callee), path: calleePath(callee) };
  }
  return undefined;
}

function matchesPattern(pattern: string | undefined, value: string | undefined): boolean {
  if (pattern === undefined) return true;
  return value !== undefined && new RegExp(pattern).test(value);
}

function selectorMatches(selector: ClassSelector, context: ClassContext): boolean {
  const names = targetNames(context.target);
  if (!names || names.kind !== selector.kind) return false;
  if (!matchesPattern(selector.name, names.name) || !matchesPattern(selector.path, names.path)) return false;
  return selector.match.some((matcher) => {
    if (matcher.type === 'strings') return !context.insideObjectValue;
    if (matcher.type === 'objectValues') return context.insideObjectValue && matchesPattern(matcher.path, context.objectPath);
    return false;
  });
}

function isClassSelector(value: unknown): value is ClassSelector {
  const selector = value as Partial<ClassSelector> | null;
  return (selector?.kind === 'variable' || selector?.kind === 'callee') && Array.isArray(selector.match);
}

function readSelectors(context: Rule.RuleContext): readonly ClassSelector[] {
  const settings = context.settings['better-tailwindcss'] as { selectors?: readonly unknown[] } | undefined;
  return (settings?.selectors ?? drupalSelectors).filter(isClassSelector);
}

export const noInterpolatedClasses: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow Twig interpolation ("#{ }") inside class strings, so every class stays visible to linting',
      url: 'https://github.com/alannapieralski/twig-eslint-parser/blob/main/packages/eslint-plugin-twig-tailwind/docs/rules/no-interpolated-classes.md',
    },
    schema: [],
    messages: {
      interpolatedClasses: 'Avoid "#{ }" inside a class string: linters cannot see what it produces. Use an array such as [\'flex\', modifier] instead.',
    },
  },

  create(context) {
    const selectors = readSelectors(context);

    return {
      TemplateLiteral(node: ParentedNode & { expressions: readonly unknown[] }) {
        if (node.expressions.length === 0) return;
        const classContext = findClassContext(node);
        if (classContext && selectors.some((selector) => selectorMatches(selector, classContext))) {
          context.report({ node, messageId: 'interpolatedClasses' });
        }
      },
    } as Rule.RuleListener;
  },
};
