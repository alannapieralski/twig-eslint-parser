import { existsSync, globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CorpusOptions, Template } from './types.js';

export type CorpusRoot = { readonly path: string; readonly quick: boolean };
export type CorpusConfig = { readonly roots: readonly CorpusRoot[]; readonly exclude: readonly string[] };

const defaultExcludedDirectories = ['node_modules', 'vendor', '.git'];

function parseRoot(entry: unknown): CorpusRoot {
  if (typeof entry === 'string') return { path: resolve(entry), quick: false };
  if (typeof entry === 'object' && entry !== null && typeof (entry as { path?: unknown }).path === 'string') {
    const { path, quick } = entry as { path: string; quick?: unknown };
    return { path: resolve(path), quick: quick === true };
  }
  throw new Error(`Each corpus root must be a path string or { "path": "...", "quick": true }, got ${JSON.stringify(entry)}.`);
}

function parseConfigFile(configPath: string): CorpusConfig {
  const raw: unknown = JSON.parse(readFileSync(configPath, 'utf8'));
  const { roots, exclude = defaultExcludedDirectories } = raw as { roots?: unknown; exclude?: string[] };
  if (!Array.isArray(roots) || roots.length === 0) throw new Error(`${configPath} must have a non-empty "roots" array.`);
  return { roots: roots.map(parseRoot), exclude };
}

export function loadConfig(repositoryRoot: string, environment: NodeJS.ProcessEnv): CorpusConfig {
  const fromEnvironment = (environment['TWIG_CORPUS'] ?? '').split(':').filter((directory) => directory !== '');
  const config = fromEnvironment.length > 0
    ? { roots: fromEnvironment.map(parseRoot), exclude: defaultExcludedDirectories }
    : readLocalConfig(repositoryRoot);

  const missing = config.roots.filter((root) => !existsSync(root.path));
  if (missing.length > 0) throw new Error(`Corpus roots do not exist: ${missing.map((root) => root.path).join(', ')}`);
  return config;
}

function readLocalConfig(repositoryRoot: string): CorpusConfig {
  const configPath = resolve(repositoryRoot, 'corpus.config.json');
  if (!existsSync(configPath)) {
    throw new Error('No corpus config. Copy corpus.config.example.json to corpus.config.json and list your project folders, or set TWIG_CORPUS=dir:dir.');
  }
  return parseConfigFile(configPath);
}

function selectRoots(config: CorpusConfig, options: Pick<CorpusOptions, 'quick' | 'roots'>): readonly CorpusRoot[] {
  let roots = config.roots;
  if (options.quick) {
    roots = roots.filter((root) => root.quick);
    if (roots.length === 0) throw new Error('--quick needs at least one root with "quick": true in corpus.config.json.');
  }
  if (options.roots !== undefined) {
    const filters = options.roots;
    roots = roots.filter((root) => filters.some((filter) => root.path.includes(filter)));
    if (roots.length === 0) throw new Error(`No corpus root matches --roots ${filters.join(',')}.`);
  }
  return roots;
}

export function discoverTemplates(config: CorpusConfig, options: Pick<CorpusOptions, 'quick' | 'roots'>): Template[] {
  const excluded = new Set(config.exclude);
  const templatesByPath = new Map<string, Template>();
  for (const root of selectRoots(config, options)) {
    const files = globSync('**/*.twig', { cwd: root.path, exclude: (name) => excluded.has(name) });
    for (const file of files) {
      const path = resolve(root.path, file);
      if (templatesByPath.has(path)) continue;
      templatesByPath.set(path, { root: root.path, path, relativePath: file, source: readFileSync(path, 'utf8') });
    }
  }
  return [...templatesByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}
