'use client';

import { useEffect } from 'react';

import { BASE_PATH } from './lib/base-path';

export function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // O escopo precisa estar dentro do caminho do próprio script, senão o
      // registro falha com SecurityError sob implantação em subcaminho.
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
        .catch((error: unknown) => {
          console.warn('Falha ao registrar o service worker.', error);
        });
    }
  }, []);

  return null;
}
