import './globals.css';

export const metadata = {
  title: 'LeetCode Solutions Atlas',
  description: 'Discover, filter, and inspect local LeetCode solutions with rich metadata',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
