'use client';

import type {
  AuthenticatedPrincipal,
  Batch,
  BatchPage,
  CatalogOption,
  CatalogOptionPage,
  Laboratory,
  Product,
  ProductCategory,
  ProductPage,
  Project,
  StockMovement,
  StockMovementPage,
  UnitOfMeasure,
} from '@arqueia/contracts';
import { ArqueiaIcon, WorkspaceShell } from '@arqueia/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { createWorkspacePresentation } from '../presentation';

interface PageData {
  principal: AuthenticatedPrincipal;
  laboratories: readonly Laboratory[];
}

const categoryLabels: Record<ProductCategory, string> = {
  REAGENT: 'Reagente Químico',
  SOLVENT: 'Solvente Organico/Inorganico',
  CONSUMABLE: 'Consumível de Laboratório',
  GLASSWARE: 'Vidraria / Plásticos',
  STANDARD: 'Padrão Analítico / CRM',
  OTHER: 'Outro Insumo',
};

const unitLabels: Record<UnitOfMeasure, string> = {
  ML: 'mL (Mililitro)',
  L: 'L (Litro)',
  G: 'g (Grama)',
  KG: 'kg (Quilograma)',
  UNIDADE: 'Unidade(s)',
  CAIXA: 'Caixa(s)',
  FRASCO: 'Frasco(s)',
  PACOTE: 'Pacote(s)',
};

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (response.status === 401) throw new Error('UNAUTHENTICATED');
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
    throw new Error(body?.message ?? 'Não foi possível concluir a operação.');
  }
  return response.json() as Promise<T>;
}

export function InventoryPageClient() {
  const router = useRouter();

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [laboratoryId, setLaboratoryId] = useState<string | null>(null);

  const [products, setProducts] = useState<readonly Product[]>([]);
  const [batches, setBatches] = useState<readonly Batch[]>([]);
  const [projects, setProjects] = useState<readonly Project[]>([]);
  const [spaces, setSpaces] = useState<readonly CatalogOption[]>([]);

  const [activeTab, setActiveTab] = useState<'BATCHES' | 'LEDGER'>('BATCHES');
  const [movements, setMovements] = useState<readonly StockMovement[]>([]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [ledgerModalBatch, setLedgerModalBatch] = useState<Batch | null>(null);
  const [selectedWithdrawBatch, setSelectedWithdrawBatch] = useState<Batch | null>(null);

  const loadData = useCallback(
    async (labId: string, currentSearch: string, cat: string) => {
      setLoading(true);
      setError(null);
      try {
        const batchQuery = new URLSearchParams({
          laboratoryId: labId,
          limit: '50',
        });
        if (currentSearch) batchQuery.set('search', currentSearch);

        const prodQuery = new URLSearchParams({
          laboratoryId: labId,
          limit: '50',
        });
        if (cat) prodQuery.set('category', cat);

        const [prodPage, batchPage, projList, spacesPage] = await Promise.all([
          readJson<ProductPage>(`/api/inventory/products?${prodQuery.toString()}`),
          readJson<BatchPage>(`/api/inventory/batches?${batchQuery.toString()}`),
          readJson<readonly Project[]>('/api/projects'),
          readJson<CatalogOptionPage>(`/api/catalog/options?laboratoryId=${labId}&kind=SPACE&limit=50`),
        ]);

        setProducts(prodPage.items);
        setBatches(batchPage.items);
        setProjects(projList);
        setSpaces(spacesPage.items);
      } catch (err) {
        if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Falha ao carregar estoque.');
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  const loadMovements = useCallback(async (labId: string, batchId?: string) => {
    try {
      const q = new URLSearchParams({ laboratoryId: labId, limit: '50' });
      if (batchId) q.set('batchId', batchId);
      const movPage = await readJson<StockMovementPage>(`/api/inventory/movements?${q.toString()}`);
      setMovements(movPage.items);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [session, laboratories] = await Promise.all([
          readJson<{ principal: AuthenticatedPrincipal }>('/api/session'),
          readJson<readonly Laboratory[]>('/api/laboratories'),
        ]);
        const preferred = laboratories.find((lab) => lab.code === 'CP2b') ?? laboratories[0];
        if (!preferred) throw new Error('Nenhum laboratório disponível.');

        setPageData({ principal: session.principal, laboratories });
        setLaboratoryId(preferred.id);

        await loadData(preferred.id, '', '');
      } catch (err) {
        if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Falha ao inicializar módulo de estoque.');
        setLoading(false);
      }
    })();
  }, [router]);

  const activeLaboratory = useMemo(
    () => pageData?.laboratories.find((lab) => lab.id === laboratoryId) ?? null,
    [laboratoryId, pageData],
  );

  const presentation = useMemo(
    () => (pageData === null ? null : createWorkspacePresentation(pageData.principal, pageData.laboratories)),
    [pageData],
  );

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const handleCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!laboratoryId) return;
    setPending(true);
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    try {
      await readJson('/api/inventory/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laboratoryId,
          code: form.get('code'),
          name: form.get('name'),
          casNumber: form.get('casNumber') || null,
          category: form.get('category'),
          unitOfMeasure: form.get('unitOfMeasure'),
          minimumStockThreshold: Number(form.get('minimumStockThreshold') ?? 0),
          description: form.get('description') || null,
        }),
      });

      setProductModalOpen(false);
      setNotice('✅ Produto cadastrado com sucesso!');
      await loadData(laboratoryId, search, selectedCategory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar produto.');
    } finally {
      setPending(false);
    }
  };

  const handleCreateBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!laboratoryId) return;
    setPending(true);
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    const expDate = String(form.get('expirationDate') ?? '').trim();

    try {
      await readJson('/api/inventory/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laboratoryId,
          productId: form.get('productId'),
          batchNumber: form.get('batchNumber'),
          manufacturer: form.get('manufacturer') || null,
          expirationDate: expDate ? new Date(`${expDate}T23:59:59`).toISOString() : null,
          spaceOptionId: form.get('spaceOptionId') || null,
          initialQuantity: Number(form.get('initialQuantity')),
          notes: form.get('notes') || null,
        }),
      });

      setBatchModalOpen(false);
      setNotice('✅ Entrada de lote efetuada com sucesso!');
      await loadData(laboratoryId, search, selectedCategory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar entrada de lote.');
    } finally {
      setPending(false);
    }
  };

  const handleWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!laboratoryId || !selectedWithdrawBatch) return;
    setPending(true);
    setError(null);
    setNotice(null);

    const form = new FormData(event.currentTarget);
    try {
      await readJson('/api/inventory/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laboratoryId,
          batchId: selectedWithdrawBatch.id,
          projectId: form.get('projectId'),
          quantity: Number(form.get('quantity')),
          purpose: form.get('purpose'),
          notes: form.get('notes') || null,
        }),
      });

      setWithdrawModalOpen(false);
      setSelectedWithdrawBatch(null);
      setNotice('✅ Retirada de estoque gravada no Livro-Razão!');
      await loadData(laboratoryId, search, selectedCategory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao efetuar retirada.');
    } finally {
      setPending(false);
    }
  };

  const openLedgerModal = (batch: Batch) => {
    setLedgerModalBatch(batch);
    if (laboratoryId) void loadMovements(laboratoryId, batch.id);
  };

  if (!pageData || !activeLaboratory || !presentation) {
    return (
      <main className="standalone-loading">
        <span className="loading-pulse" />
        {error ?? 'Carregando gestão de estoque...'}
      </main>
    );
  }

  const initials = pageData.principal.user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  const laboratoryRail = pageData.laboratories.map((lab) => ({
    href: `/estoque?laboratory=${lab.id}`,
    id: lab.id,
    ...(lab.code === 'CP2b' ? { logoSrc: '/brand/cp2b-avatar.svg' } : {}),
    name: lab.name,
    shortName: lab.code.slice(0, 2),
  }));

  return (
    <WorkspaceShell
      activeLaboratoryId={activeLaboratory.id}
      activeModuleHref="/estoque"
      appName="Arqueia"
      currentContext={activeLaboratory.name}
      laboratories={laboratoryRail}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      qrAction={{ href: '/qr', label: 'Ler QR Code' }}
      sectionLabel="Estoque Operacional"
      userInitials={initials}
      userLabel={pageData.principal.user.name}
    >
      <section className="equipment-toolbar">
        <div>
          <span className="section-kicker">{activeLaboratory.name}</span>
          <h2>Estoque & Livro-Razão de Insumos</h2>
          <p>Gestão de produtos, controle físico por lote e movimentações imutáveis com código QR.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="secondary-button" onClick={() => setProductModalOpen(true)} type="button">
            <ArqueiaIcon name="mais" size={18} /> Novo Produto
          </button>
          <button className="primary-button" onClick={() => setBatchModalOpen(true)} type="button">
            <ArqueiaIcon name="mais" size={18} /> Entrada de Lote
          </button>
        </div>
      </section>

      {notice && (
        <div style={{ background: '#e6fffa', border: '1px solid #38b2ac', color: '#234e52', padding: '0.75rem 1rem', borderRadius: '6px', margin: '0.5rem 0' }}>
          {notice}
        </div>
      )}

      {error && <p aria-live="polite" className="form-error equipment-error">{error}</p>}

      {/* Control Bar */}
      <section className="agenda-control-bar" style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', margin: '1rem 0', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="search"
            placeholder="Buscar por lote, produto ou QR Code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (laboratoryId) void loadData(laboratoryId, e.target.value, selectedCategory);
            }}
            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', minWidth: '260px' }}
          />

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              if (laboratoryId) void loadData(laboratoryId, search, e.target.value);
            }}
            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }}
          >
            <option value="">Todas as Categorias</option>
            {Object.keys(categoryLabels).map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabels[cat as ProductCategory]}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            onClick={() => setActiveTab('BATCHES')}
            type="button"
            style={{
              padding: '0.4rem 0.8rem',
              border: 'none',
              background: activeTab === 'BATCHES' ? 'var(--brand-primary, #0052cc)' : 'transparent',
              color: activeTab === 'BATCHES' ? '#fff' : 'inherit',
              fontWeight: activeTab === 'BATCHES' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            Lotes em Estoque ({batches.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('LEDGER');
              if (laboratoryId) void loadMovements(laboratoryId);
            }}
            type="button"
            style={{
              padding: '0.4rem 0.8rem',
              border: 'none',
              background: activeTab === 'LEDGER' ? 'var(--brand-primary, #0052cc)' : 'transparent',
              color: activeTab === 'LEDGER' ? '#fff' : 'inherit',
              fontWeight: activeTab === 'LEDGER' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            Livro-Razão (Movimentações)
          </button>
        </div>
      </section>

      {/* Main Tab Content */}
      {loading ? (
        <div className="equipment-empty">
          <span className="loading-pulse" />
          <h3>Carregando insumos do estoque...</h3>
        </div>
      ) : activeTab === 'BATCHES' ? (
        batches.length === 0 ? (
          <div className="equipment-empty">
            <span className="equipment-empty-icon"><ArqueiaIcon name="estoque" size={30} /></span>
            <h3>Nenhum lote de insumo encontrado</h3>
            <p>Cadastre produtos e faça entradas de lote para controlar saldos e retiradas.</p>
            <button className="primary-button" onClick={() => setBatchModalOpen(true)} type="button">
              Dar entrada no primeiro lote
            </button>
          </div>
        ) : (
          <div className="equipment-grid">
            {batches.map((batch) => {
              const product = productMap.get(batch.productId);
              const percentage = Math.min(100, Math.round((batch.currentBalance / batch.initialQuantity) * 100));
              const isExhausted = batch.currentBalance === 0;

              return (
                <article className="equipment-card" key={batch.id} style={{ opacity: isExhausted ? 0.7 : 1 }}>
                  <div className="equipment-card-heading">
                    <span className={`status-dot status-dot--${isExhausted ? 'unavailable' : 'available'}`} />
                    <span>{isExhausted ? 'Esgotado' : 'Disponível'}</span>
                  </div>
                  <h3>{product?.name ?? 'Produto Insumo'}</h3>
                  <code>Lote: {batch.batchNumber} | QR: {batch.qrCode}</code>

                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                      <span>Saldo:</span>
                      <span style={{ color: isExhausted ? '#e53e3e' : '#2b6cb0' }}>
                        {batch.currentBalance} / {batch.initialQuantity} {product?.unitOfMeasure}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginTop: '0.2rem' }}>
                      <div style={{ width: `${percentage}%`, height: '100%', background: isExhausted ? '#e53e3e' : '#3182ce' }} />
                    </div>
                  </div>

                  <dl style={{ marginTop: '0.5rem' }}>
                    {product?.casNumber && <div><dt>CAS</dt><dd>{product.casNumber}</dd></div>}
                    {batch.expirationDate && (
                      <div>
                        <dt>Validade</dt>
                        <dd>{new Date(batch.expirationDate).toLocaleDateString('pt-BR')}</dd>
                      </div>
                    )}
                    {batch.manufacturer && <div><dt>Fabricante</dt><dd>{batch.manufacturer}</dd></div>}
                  </dl>

                  <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #edf2f7', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      className="secondary-button"
                      onClick={() => openLedgerModal(batch)}
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      type="button"
                    >
                      Extrato Ledger
                    </button>
                    {!isExhausted && (
                      <button
                        className="primary-button"
                        onClick={() => {
                          setSelectedWithdrawBatch(batch);
                          setWithdrawModalOpen(true);
                        }}
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                        type="button"
                      >
                        Retirar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        /* LEDGER TAB */
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead style={{ background: '#f7fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem' }}>Data/Hora</th>
                <th style={{ padding: '0.75rem 1rem' }}>Tipo</th>
                <th style={{ padding: '0.75rem 1rem' }}>Qtd.</th>
                <th style={{ padding: '0.75rem 1rem' }}>Saldo Após</th>
                <th style={{ padding: '0.75rem 1rem' }}>Finalidade / Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((mov) => (
                <tr key={mov.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>{new Date(mov.performedAt).toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        background:
                          mov.type === 'ENTRY' ? '#c6f6d5' : mov.type === 'WITHDRAWAL' ? '#feebc8' : '#fed7d7',
                        color:
                          mov.type === 'ENTRY' ? '#22543d' : mov.type === 'WITHDRAWAL' ? '#744210' : '#742a2a',
                      }}
                    >
                      {mov.type === 'ENTRY' ? 'ENTRADA' : mov.type === 'WITHDRAWAL' ? 'RETIRADA' : mov.type}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{mov.quantity}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{mov.balanceAfter}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{mov.purpose ?? mov.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Retirada */}
      {withdrawModalOpen && selectedWithdrawBatch && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="withdraw-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Livro-Razão de Estoque</span>
                <h2 id="withdraw-title">Retirada Rápida de Insumo</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setWithdrawModalOpen(false)} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleWithdrawal}>
              <p>
                <strong>Lote:</strong> {selectedWithdrawBatch.batchNumber} (Saldo Disponível:{' '}
                {selectedWithdrawBatch.currentBalance})
              </p>

              <label className="field-wide">
                <span>Projeto Vinculado *</span>
                <select name="projectId" required>
                  <option value="">Selecione o projeto aprovado</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Quantidade Retirada *</span>
                <input
                  type="number"
                  name="quantity"
                  step="0.0001"
                  min="0.0001"
                  max={selectedWithdrawBatch.currentBalance}
                  required
                />
              </label>

              <label className="field-wide">
                <span>Finalidade da Retirada *</span>
                <input
                  name="purpose"
                  placeholder="Ex: Preparo da fase móvel de HPLC para análise"
                  required
                  maxLength={500}
                />
              </label>

              <label className="field-wide">
                <span>Observações</span>
                <textarea name="notes" rows={2} maxLength={1000} placeholder="Frasco aberto, aliquotado..." />
              </label>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setWithdrawModalOpen(false)} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending} type="submit">
                  {pending ? 'Registrando...' : 'Confirmar Retirada'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Novo Produto */}
      {productModalOpen && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="prod-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Catálogo de Insumos</span>
                <h2 id="prod-title">Cadastrar Novo Produto</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setProductModalOpen(false)} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleCreateProduct}>
              <label>
                <span>Código Interno *</span>
                <input name="code" placeholder="Ex: ACT-PA-2.5L" required maxLength={64} />
              </label>

              <label className="field-wide">
                <span>Nome Comercial / Reagente *</span>
                <input name="name" placeholder="Ex: Acetona PA 99.5%" required maxLength={180} />
              </label>

              <label>
                <span>Nº CAS</span>
                <input name="casNumber" placeholder="Ex: 67-64-1" maxLength={32} />
              </label>

              <label>
                <span>Categoria *</span>
                <select name="category" required>
                  {Object.keys(categoryLabels).map((cat) => (
                    <option key={cat} value={cat}>
                      {categoryLabels[cat as ProductCategory]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Unidade de Medida *</span>
                <select name="unitOfMeasure" required>
                  {Object.keys(unitLabels).map((u) => (
                    <option key={u} value={u}>
                      {unitLabels[u as UnitOfMeasure]}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Estoque Mínimo (Alerta)</span>
                <input type="number" name="minimumStockThreshold" defaultValue={0} min={0} />
              </label>

              <label className="field-wide">
                <span>Descrição</span>
                <textarea name="description" rows={2} maxLength={2000} placeholder="Especificações técnicas..." />
              </label>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setProductModalOpen(false)} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending} type="submit">
                  {pending ? 'Salvando...' : 'Cadastrar Produto'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Entrada de Lote */}
      {batchModalOpen && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="batch-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Recebimento Físico</span>
                <h2 id="batch-title">Entrada de Novo Lote</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setBatchModalOpen(false)} type="button">
                ×
              </button>
            </div>
            <form className="equipment-form" onSubmit={handleCreateBatch}>
              <label className="field-wide">
                <span>Produto *</span>
                <select name="productId" required>
                  <option value="">Selecione o produto cadastrado</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Número do Lote *</span>
                <input name="batchNumber" placeholder="Ex: LOT-2026-ACT1" required maxLength={80} />
              </label>

              <label>
                <span>Fabricante</span>
                <input name="manufacturer" placeholder="Ex: Sigma-Aldrich" maxLength={160} />
              </label>

              <label>
                <span>Data de Validade</span>
                <input type="date" name="expirationDate" />
              </label>

              <label>
                <span>Quantidade Inicial *</span>
                <input type="number" name="initialQuantity" step="0.0001" min="0.0001" required />
              </label>

              <label className="field-wide">
                <span>Localização (Espaço)</span>
                <select name="spaceOptionId">
                  <option value="">Selecione o local de armazenamento</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}

                </select>
              </label>

              <label className="field-wide">
                <span>Observações do Recebimento</span>
                <textarea name="notes" rows={2} maxLength={2000} placeholder="Estado da embalagem, lacre..." />
              </label>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setBatchModalOpen(false)} type="button">
                  Cancelar
                </button>
                <button className="primary-button" disabled={pending} type="submit">
                  {pending ? 'Registrando...' : 'Confirmar Entrada'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Extrato Ledger Lote */}
      {ledgerModalBatch && (
        <div className="equipment-dialog-backdrop" role="presentation">
          <section aria-labelledby="ledger-title" aria-modal="true" className="equipment-dialog" role="dialog">
            <div className="equipment-dialog-heading">
              <div>
                <span className="section-kicker">Extrato Imutável</span>
                <h2 id="ledger-title">Livro-Razão — Lote {ledgerModalBatch.batchNumber}</h2>
              </div>
              <button aria-label="Fechar" onClick={() => setLedgerModalBatch(null)} type="button">
                ×
              </button>
            </div>
            <div className="equipment-form">
              <p>
                <strong>QR Code:</strong> {ledgerModalBatch.qrCode} | <strong>Saldo Atual:</strong>{' '}
                {ledgerModalBatch.currentBalance}
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                <thead>
                  <tr style={{ background: '#f7fafc', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.5rem' }}>Data</th>
                    <th style={{ padding: '0.5rem' }}>Tipo</th>
                    <th style={{ padding: '0.5rem' }}>Qtd.</th>
                    <th style={{ padding: '0.5rem' }}>Saldo</th>
                    <th style={{ padding: '0.5rem' }}>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                      <td style={{ padding: '0.4rem' }}>{new Date(m.performedAt).toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '0.4rem' }}>{m.type}</td>
                      <td style={{ padding: '0.4rem' }}>{m.quantity}</td>
                      <td style={{ padding: '0.4rem' }}>{m.balanceAfter}</td>
                      <td style={{ padding: '0.4rem' }}>{m.purpose ?? m.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="equipment-form-actions">
                <button className="secondary-button" onClick={() => setLedgerModalBatch(null)} type="button">
                  Fechar
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}
