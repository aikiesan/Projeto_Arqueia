import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FieldReportsPageClient } from './field-reports-page-client';

export const metadata: Metadata = {
  title: 'Informes — Arqueia',
  description: 'Informes enviados pelo QR do laboratório, compilados para a coordenação.',
};

export default function FieldReportsPage() {
  return (
    <Suspense fallback={<main className="standalone-loading"><span className="loading-pulse" />Carregando informes...</main>}>
      <FieldReportsPageClient />
    </Suspense>
  );
}
