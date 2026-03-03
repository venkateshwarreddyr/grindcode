import Link from 'next/link';
import { notFound } from 'next/navigation';
import CopyCodeButton from '../../../components/copy-code-button';
import {
  getRelatedSolutions,
  getSolutionBySlug,
  getSolutionNeighbors,
} from '../../../lib/solutions';

function formatDate(value) {
  if (!value) return 'N/A';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(time));
}

function lineNumberedCode(code) {
  return code.split(/\r?\n/).map((line, index) => ({
    number: index + 1,
    text: line || ' ',
  }));
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const solution = await getSolutionBySlug(resolvedParams.slug);
  if (!solution) {
    return { title: 'Solution not found' };
  }
  return {
    title: `${solution.title} | LeetCode Solutions Atlas`,
    description: `View implementation details for ${solution.title} in ${solution.language}`,
  };
}

export default async function SolutionPage({ params }) {
  const resolvedParams = await params;
  const [solution, related, neighbors] = await Promise.all([
    getSolutionBySlug(resolvedParams.slug),
    getRelatedSolutions(resolvedParams.slug, 6),
    getSolutionNeighbors(resolvedParams.slug),
  ]);

  if (!solution) {
    notFound();
  }

  const numbered = lineNumberedCode(solution.code);

  return (
    <article className="detailPage">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">All solutions</Link>
        <span>/</span>
        <span>{solution.slug}</span>
      </nav>

      <header className="detailHeader">
        <div>
          <h1>{solution.title}</h1>
          <p className="slug">/{solution.slug}</p>
        </div>
        <div className="detailActions">
          <CopyCodeButton code={solution.code} />
          {solution.leetcodeUrl ? (
            <a className="solidButton" href={solution.leetcodeUrl} target="_blank" rel="noreferrer">
              Open on LeetCode
            </a>
          ) : null}
        </div>
      </header>

      <section className="detailMetaGrid">
        <article className="metaPanel">
          <h2>Profile</h2>
          <p><strong>Language:</strong> {solution.language}</p>
          <p><strong>File type:</strong> .{solution.extension}</p>
          <p><strong>Submitted:</strong> {formatDate(solution.submittedDate || solution.submitted)}</p>
          <p><strong>Runtime:</strong> {solution.runtime || 'N/A'}</p>
          <p><strong>Memory:</strong> {solution.memory || 'N/A'}</p>
        </article>
        <article className="metaPanel">
          <h2>Code stats</h2>
          <p><strong>Lines:</strong> {solution.codeLines}</p>
          <p><strong>Characters:</strong> {solution.codeChars}</p>
          <p><strong>Read time:</strong> {solution.readingMinutes} min</p>
          <p><strong>Metadata coverage:</strong> {solution.metadataCoverage}%</p>
        </article>
      </section>

      <pre className="codeBlock codeWithLines">
        <code>
          {numbered.map((line) => (
            <span key={line.number} className="codeLine">
              <span className="lineNumber">{line.number}</span>
              <span className="lineText">{line.text}</span>
            </span>
          ))}
        </code>
      </pre>

      <section className="neighborRow">
        {neighbors.previous ? (
          <Link className="ghostButton" href={`/solution/${neighbors.previous.slug}`}>
            Previous: {neighbors.previous.title}
          </Link>
        ) : (
          <span />
        )}
        {neighbors.next ? (
          <Link className="ghostButton" href={`/solution/${neighbors.next.slug}`}>
            Next: {neighbors.next.title}
          </Link>
        ) : (
          <span />
        )}
      </section>

      <section>
        <div className="panelTitleRow">
          <h2>Related solutions</h2>
          <p>Same language and overlapping slug keywords</p>
        </div>
        <div className="solutionsGrid">
          {related.map((item) => (
            <article className="solutionCard" key={item.slug}>
              <h3>
                <Link href={`/solution/${item.slug}`}>{item.title}</Link>
              </h3>
              <p className="slug">/{item.slug}</p>
              <div className="metaRow">
                <span className="tag">{item.language}</span>
                <span>{formatDate(item.submittedDate || item.submitted)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </article>
  );
}
