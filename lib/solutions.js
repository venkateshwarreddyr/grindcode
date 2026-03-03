import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const SOLUTIONS_DIR = path.join(ROOT_DIR, 'solutions');
const INDEX_CONCURRENCY = 20;

let cachedIndex = null;
let indexLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

const SUPPORTED_EXTENSIONS = new Set([
  'js',
  'rs',
  'sql',
  'cpp',
  'go',
  'py',
  'java',
  'md',
  'json',
]);

function cleanCommentLine(line) {
  return line
    .replace(/^\s*\/\//, '')
    .replace(/^\s*#/, '')
    .replace(/^\s*\/\*/, '')
    .replace(/^\s*\*/, '')
    .replace(/\*\/\s*$/, '')
    .trim();
}

function extractFrontmatter(content) {
  if (!content.startsWith('---\n')) return null;
  const parts = content.split(/\r?\n---\r?\n/);
  if (parts.length < 2) return null;

  const lines = parts[0].split(/\r?\n/).slice(1);
  const data = {};

  for (const line of lines) {
    const index = line.indexOf(':');
    if (index < 0) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (key && value) data[key] = value;
  }

  return data;
}

function extractMetadata(content, extension) {
  const metadata = {
    title: '',
    leetcodeUrl: '',
    language: '',
    runtime: '',
    memory: '',
    submitted: '',
  };

  if (extension === 'json') {
    try {
      const parsed = JSON.parse(content);
      metadata.title = parsed.title || parsed.problem || '';
      metadata.leetcodeUrl = parsed.leetcodeUrl || parsed.link || '';
      metadata.language = parsed.language || '';
      metadata.runtime = parsed.runtime || '';
      metadata.memory = parsed.memory || '';
      metadata.submitted = parsed.submitted || parsed.date || '';
      return metadata;
    } catch {
      return metadata;
    }
  }

  if (extension === 'md') {
    const frontmatter = extractFrontmatter(content);
    if (frontmatter) {
      metadata.title = frontmatter.problem || frontmatter.title || '';
      metadata.leetcodeUrl = frontmatter.leetcode || frontmatter.link || '';
      metadata.language = frontmatter.language || 'markdown';
      metadata.runtime = frontmatter.runtime || '';
      metadata.memory = frontmatter.memory || '';
      metadata.submitted = frontmatter.submitted || frontmatter.date || '';
      return metadata;
    }
  }

  const lines = content.split(/\r?\n/).slice(0, 40).map(cleanCommentLine);

  for (const line of lines) {
    if (line.startsWith('Problem:')) metadata.title = line.slice(8).trim();
    else if (line.startsWith('LeetCode:')) metadata.leetcodeUrl = line.slice(9).trim();
    else if (line.startsWith('Language:')) metadata.language = line.slice(9).trim();
    else if (line.startsWith('Runtime:')) metadata.runtime = line.slice(8).trim();
    else if (line.startsWith('Memory:')) metadata.memory = line.slice(7).trim();
    else if (line.startsWith('Submitted:')) metadata.submitted = line.slice(10).trim();
  }

  return metadata;
}

function slugToTitle(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

async function readSolutionDirectories() {
  const entries = await fs.readdir(SOLUTIONS_DIR, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function readSolutionFile(slug) {
  const directory = path.join(SOLUTIONS_DIR, slug);
  const files = await fs.readdir(directory);
  const solutionFilename = files.find((file) => {
    if (!file.startsWith('solution.')) return false;
    const extension = path.extname(file).slice(1).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(extension);
  });
  if (!solutionFilename) return null;

  const absolutePath = path.join(directory, solutionFilename);
  const code = await fs.readFile(absolutePath, 'utf8');

  return {
    slug,
    solutionFilename,
    extension: path.extname(solutionFilename).slice(1),
    code,
  };
}

function compareSubmittedDateDesc(a, b) {
  const aTime = Date.parse(a.submitted || '') || 0;
  const bTime = Date.parse(b.submitted || '') || 0;
  return bTime - aTime;
}

export async function getSolutionsIndex() {
  const isFresh = cachedIndex && Date.now() - indexLoadedAt < CACHE_TTL_MS;
  if (isFresh) {
    return cachedIndex;
  }

  const slugs = await readSolutionDirectories();
  const loaded = [];

  for (let i = 0; i < slugs.length; i += INDEX_CONCURRENCY) {
    const batch = slugs.slice(i, i + INDEX_CONCURRENCY);
    const batchLoaded = await Promise.all(
      batch.map(async (slug) => {
        const record = await readSolutionFile(slug);
        if (!record) return null;

        const metadata = extractMetadata(record.code, record.extension);
        return {
          slug,
          title: metadata.title || slugToTitle(slug),
          leetcodeUrl: metadata.leetcodeUrl,
          language: metadata.language || record.extension,
          runtime: metadata.runtime,
          memory: metadata.memory,
          submitted: metadata.submitted,
          extension: record.extension,
        };
      })
    );
    loaded.push(...batchLoaded);
  }

  cachedIndex = loaded.filter(Boolean).sort(compareSubmittedDateDesc);
  indexLoadedAt = Date.now();
  return cachedIndex;
}

export async function getLanguages() {
  const solutions = await getSolutionsIndex();
  return [...new Set(solutions.map((item) => item.language))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export async function getSolutionBySlug(slug) {
  try {
    const record = await readSolutionFile(slug);
    if (!record) return null;

    const metadata = extractMetadata(record.code, record.extension);

    return {
      slug,
      title: metadata.title || slugToTitle(slug),
      leetcodeUrl: metadata.leetcodeUrl,
      language: metadata.language || record.extension,
      runtime: metadata.runtime,
      memory: metadata.memory,
      submitted: metadata.submitted,
      extension: record.extension,
      code: record.code,
    };
  } catch {
    return null;
  }
}
