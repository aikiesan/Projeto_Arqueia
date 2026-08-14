import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AgendaPageClient } from './agenda-page-client';

export const metadata: Metadata = {
  title: 'Agenda & Reservas — Arqueia',
  description: 'Gestão de horários, reservas de equipamentos e bloqueios técnicos de manutenção no CP2b.',
};

export default function AgendaPage() {
  return (
    <Suspense fallback={<main className="standalone-loading"><span className="loading-pulse" />Carregando agenda...</main>}>
      <AgendaPageClient />
    </Suspense>
  );
}
