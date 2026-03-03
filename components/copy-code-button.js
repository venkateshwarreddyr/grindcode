'use client';

import { useState } from 'react';

export default function CopyCodeButton({ code }) {
  const [status, setStatus] = useState('idle');

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 1800);
    } catch {
      setStatus('failed');
      setTimeout(() => setStatus('idle'), 1800);
    }
  }

  return (
    <button type="button" className="ghostButton" onClick={onCopy}>
      {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Copy code'}
    </button>
  );
}
