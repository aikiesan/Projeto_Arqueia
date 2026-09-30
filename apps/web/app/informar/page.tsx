import type { Metadata } from 'next';
import { Suspense } from 'react';

import { FieldReportFormClient } from './field-report-form-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Informes · Arqueia',
  description: 'Avise a coordenação do laboratório sobre problemas, manutenção, insumos ou peça apoio.',
  // Aberta a quem escaneia a etiqueta, mas sem motivo para aparecer em buscadores.
  robots: { index: false, follow: false },
};

export default function FieldReportPage(): React.JSX.Element {
  return (
    <Suspense fallback={<main className="standalone-loading"><span className="loading-pulse" />Abrindo o formulário...</main>}>
      <FieldReportFormClient />
    </Suspense>
  );
}
