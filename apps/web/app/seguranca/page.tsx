import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SafetyPageClient } from './safety-page-client';

export const metadata: Metadata = {
  title: 'Boas Práticas de Laboratório — Arqueia',
  description: 'Segurança no laboratório: boas práticas e contatos de emergência da Unicamp.',
};

export default function SafetyPage() {
  return (
    <Suspense
      fallback={
        <main className="standalone-loading">
          <span className="loading-pulse" />
          Carregando boas práticas...
        </main>
      }
    >
      <SafetyPageClient />
    </Suspense>
  );
}
