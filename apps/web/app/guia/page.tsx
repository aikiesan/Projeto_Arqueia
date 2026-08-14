import type { Metadata } from 'next';
import { Suspense } from 'react';

import { GuidePageClient } from './guide-page-client';

export const metadata: Metadata = {
  title: 'Guia de Uso & Documentação — Arqueia',
  description: 'Manual operacional oficial passo a passo do Projeto Arqueia para o laboratório CP2b.',
};

export default function GuidePage() {
  return (
    <Suspense fallback={<main className="standalone-loading"><span className="loading-pulse" />Carregando guia operacional...</main>}>
      <GuidePageClient />
    </Suspense>
  );
}
