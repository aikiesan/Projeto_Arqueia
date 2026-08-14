import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ManagementPageClient } from './management-page-client';

export const metadata: Metadata = {
  title: 'Gestão, Analytics & Histórico — Arqueia',
  description: 'Métricas operacionais consolidadas, alocação por projeto e timeline auditável do CP2b.',
};

export default function ManagementPage() {
  return (
    <Suspense fallback={<main className="standalone-loading"><span className="loading-pulse" />Carregando gestão e histórico...</main>}>
      <ManagementPageClient />
    </Suspense>
  );
}
