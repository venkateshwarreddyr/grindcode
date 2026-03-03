# My LeetCode Solutions

This repository is my personal archive of LeetCode solutions, organized by problem slug and language.

## How Solutions Are Organized

- Each problem is stored in: `solutions/<problem-slug>/`
- Each solution file follows: `solution.<ext>`
- Examples:
  - `solutions/basic-calculator-ii/solution.js`
  - `solutions/valid-parentheses/solution.rs`

## Metadata Format (Optional but Recommended)

Many files include header metadata used by the local viewer:

```js
// Problem: Basic Calculator II
// LeetCode: https://leetcode.com/problems/basic-calculator-ii/
// Language: JavaScript
// Runtime: 50 ms
// Memory: 45 MB
// Submitted: 2026-02-20
```

## Local Solution Viewer

This repo also includes a Next.js app to browse/search solutions.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Project Structure

- `solutions/`: all problem solutions (source of truth)
- `app/`: Next.js UI
- `lib/solutions.js`: file indexer and metadata parser
