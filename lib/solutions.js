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

const MS_IN_DAY = 24 * 60 * 60 * 1000;

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
  const aTime = a.submittedTime || 0;
  const bTime = b.submittedTime || 0;
  return bTime - aTime;
}

function parseMetricNumber(metric) {
  const raw = String(metric || '');
  const value = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) ? value : null;
}

function parseSubmittedDate(submitted) {
  const time = Date.parse(submitted || '');
  if (!Number.isFinite(time)) return null;
  return new Date(time);
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildSolutionRecord(slug, record, metadata) {
  const submittedDate = parseSubmittedDate(metadata.submitted);
  const runtimeMs = parseMetricNumber(metadata.runtime);
  const memoryMb = parseMetricNumber(metadata.memory);
  const language = metadata.language || record.extension;

  const metadataFields = [
    metadata.title,
    metadata.leetcodeUrl,
    metadata.language,
    metadata.runtime,
    metadata.memory,
    metadata.submitted,
  ];
  const metadataFieldsCount = metadataFields.filter(Boolean).length;

  return {
    slug,
    title: metadata.title || slugToTitle(slug),
    leetcodeUrl: metadata.leetcodeUrl,
    language,
    runtime: metadata.runtime,
    memory: metadata.memory,
    submitted: metadata.submitted,
    extension: record.extension,
    runtimeMs,
    memoryMb,
    submittedTime: submittedDate?.getTime() || 0,
    submittedDate: submittedDate ? formatIsoDate(submittedDate) : '',
    submittedYear: submittedDate ? submittedDate.getFullYear() : null,
    metadataFieldsCount,
    hasMetadata: metadataFieldsCount > 0,
    metadataCoverage: Math.round((metadataFieldsCount / 6) * 100),
  };
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
        return buildSolutionRecord(slug, record, metadata);
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
      ...buildSolutionRecord(slug, record, metadata),
      code: record.code,
      codeLines: record.code.split(/\r?\n/).length,
      codeChars: record.code.length,
      readingMinutes: Math.max(1, Math.ceil(record.code.split(/\s+/).filter(Boolean).length / 220)),
    };
  } catch {
    return null;
  }
}

export async function getSolutionsStats() {
  const solutions = await getSolutionsIndex();
  const languagesMap = new Map();
  const extensionsMap = new Map();
  const submissionsByMonthMap = new Map();

  let withLeetCodeUrl = 0;
  let withRuntime = 0;
  let withMemory = 0;
  let withSubmitted = 0;

  for (const item of solutions) {
    languagesMap.set(item.language, (languagesMap.get(item.language) || 0) + 1);
    extensionsMap.set(item.extension, (extensionsMap.get(item.extension) || 0) + 1);

    if (item.leetcodeUrl) withLeetCodeUrl += 1;
    if (item.runtimeMs !== null) withRuntime += 1;
    if (item.memoryMb !== null) withMemory += 1;
    if (item.submittedDate) {
      withSubmitted += 1;
      const monthKey = item.submittedDate.slice(0, 7);
      submissionsByMonthMap.set(monthKey, (submissionsByMonthMap.get(monthKey) || 0) + 1);
    }
  }

  const now = new Date();
  const last30DaysCount = solutions.filter(
    (item) => item.submittedTime && now.getTime() - item.submittedTime <= 30 * MS_IN_DAY
  ).length;

  const currentYear = now.getFullYear();
  const currentYearCount = solutions.filter((item) => item.submittedYear === currentYear).length;

  const topLanguages = [...languagesMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([language, count]) => ({ language, count }));

  const submissionsByMonth = [...submissionsByMonthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-10)
    .map(([month, count]) => ({ month, count }));

  const extensionBreakdown = [...extensionsMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([extension, count]) => ({ extension, count }));

  return {
    totalSolutions: solutions.length,
    totalLanguages: languagesMap.size,
    withLeetCodeUrl,
    withRuntime,
    withMemory,
    withSubmitted,
    currentYearCount,
    last30DaysCount,
    topLanguages,
    submissionsByMonth,
    extensionBreakdown,
  };
}

export async function getRelatedSolutions(slug, limit = 6) {
  const solutions = await getSolutionsIndex();
  const current = solutions.find((item) => item.slug === slug);
  if (!current) return [];

  const slugTokens = new Set(current.slug.split('-').filter(Boolean));

  return solutions
    .filter((item) => item.slug !== slug)
    .map((item) => {
      const itemTokens = item.slug.split('-').filter(Boolean);
      const overlap = itemTokens.filter((token) => slugTokens.has(token)).length;
      const sameLanguage = item.language === current.language ? 2 : 0;
      const score = overlap * 3 + sameLanguage + (item.submittedTime ? 1 : 0);
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score || compareSubmittedDateDesc(a, b))
    .slice(0, limit);
}

export async function getSolutionNeighbors(slug) {
  const solutions = await getSolutionsIndex();
  const index = solutions.findIndex((item) => item.slug === slug);
  if (index < 0) return { previous: null, next: null };

  return {
    previous: index > 0 ? solutions[index - 1] : null,
    next: index < solutions.length - 1 ? solutions[index + 1] : null,
  };
}
