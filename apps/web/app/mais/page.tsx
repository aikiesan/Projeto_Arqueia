import type { Metadata } from 'next';
import { Suspense } from 'react';

import { MorePageClient } from './more-page-client';

export const metadata: Metadata = {
  title: 'Mais opções — Arqueia',
  description: 'Atalhos, laboratórios e opções da conta no Arqueia.',
};

export default function MorePage() {
  return (
    <Suspense
      fallback={
        <main className="standalone-loading">
          <span className="loading-pulse" />
          Carregando opções...
        </main>
      }
    >
      <MorePageClient />
    </Suspense>
  );
}
