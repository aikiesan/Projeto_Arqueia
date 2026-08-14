'use client';

import { useState } from 'react';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function handleLogout(): Promise<void> {
    setBusy(true);
    try {
      await fetch('/api/session/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <button
      className="arqueia-user-menu-action"
      disabled={busy}
      onClick={handleLogout}
      type="button"
    >
      {busy ? 'Saindo…' : 'Sair'}
    </button>
  );
}
