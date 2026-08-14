import type { Metadata } from 'next';
import { Suspense } from 'react';

import { UsersPageClient } from './users-page-client';

export const metadata: Metadata = {
  title: 'Gestão de Usuários & Acessos — Arqueia',
  description: 'Controle de pesquisadores, membros da equipe e atribuição de permissões operacionais e globais no CP2b.',
};

export default function UsersPage() {
  return (
    <Suspense fallback={<main className="standalone-loading"><span className="loading-pulse" />Carregando equipe e acessos...</main>}>
      <UsersPageClient />
    </Suspense>
  );
}
