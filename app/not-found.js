import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="notFound cardPanel">
      <h1>Solution not found</h1>
      <p>The requested problem slug does not exist in this repository.</p>
      <Link className="solidButton" href="/">Go back</Link>
    </div>
  );
}
