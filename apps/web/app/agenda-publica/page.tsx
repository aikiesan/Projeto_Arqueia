import type { Metadata } from 'next';

import { PublicAgendaClient } from './public-agenda-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Agenda pública · Arqueia',
  description: 'Consulta pública das reservas de equipamentos do laboratório.',
  // A página é aberta por decisão do laboratório, mas não deve ser indexada:
  // ela exibe nomes de pessoas.
  robots: { index: false, follow: false },
};

export default function PublicAgendaPage(): React.JSX.Element {
  return <PublicAgendaClient />;
}
