import Link from 'next/link';
import { getLanguages, getSolutionsIndex, getSolutionsStats } from '../lib/solutions';

const SORT_OPTIONS = new Set([
  'submitted_desc',
  'submitted_asc',
  'title_asc',
  'title_desc',
  'runtime_asc',
  'runtime_desc',
]);
const PAGE_SIZE_OPTIONS = new Set([24, 48, 96]);

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(time));
}

function sortSolutions(items, sort) {
  const sorted = [...items];
  if (sort === 'submitted_asc') return sorted.sort((a, b) => (a.submittedTime || 0) - (b.submittedTime || 0));
  if (sort === 'title_asc') return sorted.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'title_desc') return sorted.sort((a, b) => b.title.localeCompare(a.title));
  if (sort === 'runtime_asc') {
    return sorted.sort((a, b) => (a.runtimeMs ?? Number.MAX_SAFE_INTEGER) - (b.runtimeMs ?? Number.MAX_SAFE_INTEGER));
  }
  if (sort === 'runtime_desc') return sorted.sort((a, b) => (b.runtimeMs || 0) - (a.runtimeMs || 0));
  return sorted.sort((a, b) => (b.submittedTime || 0) - (a.submittedTime || 0));
}

function seededIndex(size, seedSource) {
  if (!size) return -1;
  let hash = 0;
  for (let i = 0; i < seedSource.length; i += 1) {
    hash = (hash * 31 + seedSource.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % size;
}

export default async function Home({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const query = asString(resolvedSearchParams?.q);
  const queryLower = query.toLowerCase();
  const languageFilter = asString(resolvedSearchParams?.language).toLowerCase();
  const extensionFilter = asString(resolvedSearchParams?.ext).toLowerCase();
  const metadataOnly = resolvedSearchParams?.metadata === '1';
  const sort = SORT_OPTIONS.has(asString(resolvedSearchParams?.sort)) ? asString(resolvedSearchParams?.sort) : 'submitted_desc';
  const view = asString(resolvedSearchParams?.view) === 'list' ? 'list' : 'grid';
  const pageSizeCandidate = asPositiveNumber(resolvedSearchParams?.pageSize, 24);
  const pageSize = PAGE_SIZE_OPTIONS.has(pageSizeCandidate) ? pageSizeCandidate : 24;
  const page = asPositiveNumber(resolvedSearchParams?.page, 1);

  const [allSolutions, languages, stats] = await Promise.all([
    getSolutionsIndex(),
    getLanguages(),
    getSolutionsStats(),
  ]);

  const filtered = allSolutions.filter((item) => {
    const haystack = `${item.title} ${item.slug} ${item.language} ${item.extension}`.toLowerCase();
    const queryMatch = !queryLower || haystack.includes(queryLower);
    const languageMatch = !languageFilter || item.language.toLowerCase() === languageFilter;
    const extensionMatch = !extensionFilter || item.extension.toLowerCase() === extensionFilter;
    const metadataMatch = !metadataOnly || item.hasMetadata;
    return queryMatch && languageMatch && extensionMatch && metadataMatch;
  });

  const sorted = sortSolutions(filtered, sort);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const current = sorted.slice(start, start + pageSize);

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (languageFilter) params.set('language', languageFilter);
  if (extensionFilter) params.set('ext', extensionFilter);
  if (metadataOnly) params.set('metadata', '1');
  if (sort !== 'submitted_desc') params.set('sort', sort);
  if (view !== 'grid') params.set('view', view);
  if (pageSize !== 24) params.set('pageSize', String(pageSize));

  const makeHref = (changes = {}) => {
    const next = new URLSearchParams(params);

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    }

    if (next.get('page') === '1') next.delete('page');
    const suffix = next.toString();
    return suffix ? `/?${suffix}` : '/';
  };

  const randomIndex = seededIndex(
    sorted.length,
    `${queryLower}-${languageFilter}-${extensionFilter}-${sort}-${pageSize}`
  );
  const randomSolution = randomIndex >= 0 ? sorted[randomIndex] : null;
  const maxMonthCount = Math.max(...stats.submissionsByMonth.map((m) => m.count), 1);
  const totalMetadataCoverage = allSolutions.length
    ? Math.round(
        allSolutions.reduce((sum, item) => sum + item.metadataCoverage, 0) / allSolutions.length
      )
    : 0;

  return (
    <div className="pageShell">
      <div className="decorCircle decorOne" aria-hidden />
      <div className="decorCircle decorTwo" aria-hidden />
      <header className="heroPanel">
        <p className="eyebrow">Personal Knowledge Base</p>
        <h1>LeetCode Solutions Atlas</h1>
        <p className="heroText">
          Search, filter, and inspect <strong>{allSolutions.length}</strong> problems with metadata-aware views,
          speed-centric sorting, and timeline insights.
        </p>
        <div className="heroActions">
          {randomSolution ? (
            <Link className="solidButton" href={`/solution/${randomSolution.slug}`}>
              Open random match
            </Link>
          ) : (
            <span className="ghostButton" aria-hidden>
              No matching solution
            </span>
          )}
          <Link className="ghostButton" href="/">
            Reset filters
          </Link>
        </div>
      </header>

      <section className="statsGrid" aria-label="Repository statistics">
        <article className="statCard">
          <p>Total solutions</p>
          <h3>{stats.totalSolutions}</h3>
        </article>
        <article className="statCard">
          <p>Languages</p>
          <h3>{stats.totalLanguages}</h3>
        </article>
        <article className="statCard">
          <p>Submissions in {new Date().getFullYear()}</p>
          <h3>{stats.currentYearCount}</h3>
        </article>
        <article className="statCard">
          <p>Active last 30 days</p>
          <h3>{stats.last30DaysCount}</h3>
        </article>
        <article className="statCard">
          <p>LeetCode links</p>
          <h3>{stats.withLeetCodeUrl}</h3>
        </article>
        <article className="statCard">
          <p>Metadata coverage</p>
          <h3>{totalMetadataCoverage}%</h3>
        </article>
      </section>

      <section className="activityPanel">
        <div className="panelTitleRow">
          <h2>Submission timeline</h2>
          <p>Last {stats.submissionsByMonth.length} months</p>
        </div>
        <div className="timelineBars">
          {stats.submissionsByMonth.map((entry) => (
            <div key={entry.month} className="barWrap">
              <div
                className="bar"
                style={{ height: `${Math.max(10, Math.round((entry.count / maxMonthCount) * 100))}%` }}
                title={`${entry.month}: ${entry.count}`}
              />
              <span>{entry.month.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="filterPanel">
        <div className="panelTitleRow">
          <h2>Find solutions</h2>
          <p>Showing {current.length} of {sorted.length} matches</p>
        </div>
        <form className="toolbar" action="/" method="get">
          <input
            aria-label="Search by title, slug, language, extension"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search title, slug, language, extension"
          />
          <select name="language" defaultValue={languageFilter}>
            <option value="">All languages</option>
            {languages.map((language) => (
              <option key={language} value={language.toLowerCase()}>
                {language}
              </option>
            ))}
          </select>
          <select name="ext" defaultValue={extensionFilter}>
            <option value="">All file types</option>
            {stats.extensionBreakdown.map((entry) => (
              <option key={entry.extension} value={entry.extension}>
                .{entry.extension} ({entry.count})
              </option>
            ))}
          </select>
          <select name="sort" defaultValue={sort}>
            <option value="submitted_desc">Newest first</option>
            <option value="submitted_asc">Oldest first</option>
            <option value="title_asc">Title A-Z</option>
            <option value="title_desc">Title Z-A</option>
            <option value="runtime_asc">Fastest runtime</option>
            <option value="runtime_desc">Slowest runtime</option>
          </select>
          <select name="pageSize" defaultValue={String(pageSize)}>
            <option value="24">24 per page</option>
            <option value="48">48 per page</option>
            <option value="96">96 per page</option>
          </select>
          <select name="view" defaultValue={view}>
            <option value="grid">Grid view</option>
            <option value="list">List view</option>
          </select>
          <label className="checkboxField">
            <input type="checkbox" name="metadata" value="1" defaultChecked={metadataOnly} />
            Only entries with metadata
          </label>
          <button type="submit" className="solidButton">Apply filters</button>
        </form>
      </section>

      <section className="languageCloud">
        {stats.topLanguages.map((entry) => (
          <Link
            key={entry.language}
            className={`tag ${entry.language.toLowerCase() === languageFilter ? 'tagActive' : ''}`}
            href={makeHref({ language: entry.language.toLowerCase(), page: null })}
          >
            {entry.language} ({entry.count})
          </Link>
        ))}
      </section>

      <section className={view === 'list' ? 'solutionsList' : 'solutionsGrid'}>
        {current.map((item) => (
          <article className={`solutionCard ${view === 'list' ? 'solutionCardList' : ''}`} key={item.slug}>
            <div className="cardHead">
              <h3>
                <Link href={`/solution/${item.slug}`}>{item.title}</Link>
              </h3>
              <span className="extensionChip">.{item.extension}</span>
            </div>
            <p className="slug">/{item.slug}</p>
            <div className="metaRow">
              <span className="tag">{item.language}</span>
              <span>{formatDate(item.submittedDate || item.submitted)}</span>
            </div>
            <div className="metaRow">
              <span>Runtime: {item.runtime || 'N/A'}</span>
              <span>Memory: {item.memory || 'N/A'}</span>
            </div>
            <div className="coverageRow">
              <span>Metadata {item.metadataCoverage}%</span>
              <div className="coverageTrack" aria-hidden>
                <div className="coverageFill" style={{ width: `${item.metadataCoverage}%` }} />
              </div>
            </div>
          </article>
        ))}
      </section>

      <nav className="pagination" aria-label="Pagination">
        {safePage > 1 ? (
          <Link href={makeHref({ page: safePage - 1 })}>Previous</Link>
        ) : (
          <span className="paginationDisabled">Previous</span>
        )}
        <span>
          Page {safePage} of {totalPages}
        </span>
        {safePage < totalPages ? (
          <Link href={makeHref({ page: safePage + 1 })}>Next</Link>
        ) : (
          <span className="paginationDisabled">Next</span>
        )}
      </nav>
    </div>
  );
}
