import type { Metadata } from 'next';
import { Suspense } from 'react';

import { QrPageClient } from './qr-page-client';

export const metadata: Metadata = {
  description: 'Leitura rápida de QR Code e código de barras para lotes e equipamentos.',
  title: 'Leitor QR Code · Arqueia',
};

export default function QrPage() {
  return (
    <Suspense
      fallback={
        <main className="standalone-loading">
          <span className="loading-pulse" />
          Carregando leitor de QR Code...
        </main>
      }
    >
      <QrPageClient />
    </Suspense>
  );
}
