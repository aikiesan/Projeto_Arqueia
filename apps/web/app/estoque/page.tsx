import type { Metadata } from 'next';
import { Suspense } from 'react';

import { InventoryPageClient } from './inventory-page-client';

export const metadata: Metadata = {
  title: 'Estoque & Insumos — Arqueia',
  description: 'Gestão de produtos, controle físico por lote e movimentações imutáveis com livro-razão no CP2b.',
};

export default function InventoryPage() {
  return (
    <Suspense fallback={<main className="standalone-loading"><span className="loading-pulse" />Carregando estoque...</main>}>
      <InventoryPageClient />
    </Suspense>
  );
}
