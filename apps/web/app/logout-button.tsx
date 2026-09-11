'use client';

import { useState } from 'react';
import { navigateTo, withBasePath } from './lib/base-path';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function handleLogout(): Promise<void> {
    setBusy(true);
    try {
      await fetch(withBasePath('/api/session/logout'), { method: 'POST' });
    } finally {
      navigateTo('/login');
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
