'use client';

import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { WorkspaceShell } from '@arqueia/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { createWorkspacePresentation } from '../presentation';

interface PageData {
  principal: AuthenticatedPrincipal;
  laboratories: readonly Laboratory[];
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (response.status === 401) throw new Error('UNAUTHENTICATED');
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Não foi possível carregar os dados.');
  }
  return response.json() as Promise<T>;
}

export function GuidePageClient() {
  const router = useRouter();

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('visao-geral');

  useEffect(() => {
    void (async () => {
      try {
        const [session, laboratories] = await Promise.all([
          readJson<{ principal: AuthenticatedPrincipal }>('/api/session'),
          readJson<readonly Laboratory[]>('/api/laboratories'),
        ]);
        setPageData({ principal: session.principal, laboratories });
      } catch (err) {
        if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Falha ao carregar o guia.');
      }
    })();
  }, [router]);

  const activeLaboratory = useMemo(
    () => pageData?.laboratories.find((lab) => lab.code === 'CP2b') ?? pageData?.laboratories[0] ?? null,
    [pageData],
  );

  const presentation = useMemo(
    () => (pageData === null ? null : createWorkspacePresentation(pageData.principal, pageData.laboratories)),
    [pageData],
  );

  if (!pageData || !activeLaboratory || !presentation) {
    return (
      <main className="standalone-loading">
        <span className="loading-pulse" />
        {error ?? 'Carregando manual operacional...'}
      </main>
    );
  }

  const userInitials = pageData.principal.user.name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  const laboratoryRail = pageData.laboratories.map((lab) => ({
    href: `/guia?laboratory=${lab.id}`,
    id: lab.id,
    ...(lab.code === 'CP2b' ? { logoSrc: '/brand/cp2b-avatar.svg' } : {}),
    name: lab.name,
    shortName: lab.code.slice(0, 2),
  }));

  const sections = [
    { id: 'visao-geral', title: '1. Visão Geral & Filosofia' },
    { id: 'equipamentos', title: '2. Equipamentos & Políticas' },
    { id: 'agenda', title: '3. Agenda & Reservas Recorrentes' },
    { id: 'estoque', title: '4. Estoque & Livro-Razão' },
    { id: 'usuarios', title: '5. Usuários & Permissões RBAC' },
    { id: 'gestao', title: '6. Gestão, Analytics & Auditoria' },
    { id: 'qr', title: '7. Leituras de QR Code' },
    { id: 'tecnico', title: '8. Referência Técnica' },
  ];

  return (
    <WorkspaceShell
      activeLaboratoryId={activeLaboratory.id}
      activeModuleHref="/guia"
      appName="Arqueia"
      currentContext={activeLaboratory.name}
      laboratories={laboratoryRail}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      qrAction={{ href: '/qr', label: 'Ler QR Code' }}
      sectionLabel="Guia de Uso"
      userInitials={userInitials}
      userLabel={pageData.principal.user.name}
    >
      {/* Editorial Header */}
      <section className="equipment-toolbar" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>

        <div>
          <span className="section-kicker">Documentação Oficial — {activeLaboratory.name}</span>
          <h2>Guia de Uso do Projeto Arqueia</h2>
          <p>Manual operacional detalhado e instruções passo a passo para a gestão do laboratório.</p>

          <div
            style={{
              display: 'flex',
              gap: '1.2rem',
              marginTop: '0.75rem',
              fontSize: '0.78rem',
              color: '#4a5568',
              flexWrap: 'wrap',
              background: '#f7fafc',
              padding: '0.5rem 0.8rem',
              borderRadius: '6px',
              border: '1px solid #edf2f7',
            }}
          >
            <span><strong>Versão do Guia:</strong> v1.0</span>
            <span><strong>Última Revisão:</strong> 14 de Agosto de 2026</span>
            <span><strong>Responsável Editorial:</strong> Equipe de Operações CP2b</span>
            <span><strong>Compatibilidade:</strong> Arqueia v1.0</span>
          </div>
        </div>
      </section>

      {/* Anchor Navigation Tabs */}
      <nav aria-label="Seções do manual" style={{ display: 'flex', gap: '0.4rem', margin: '1.2rem 0', flexWrap: 'wrap' }}>
        {sections.map((sec) => (
          <button
            key={sec.id}
            className={activeTab === sec.id ? 'primary-button' : 'secondary-button'}
            onClick={() => setActiveTab(sec.id)}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
            type="button"
          >
            {sec.title}
          </button>
        ))}
      </nav>

      {/* Section Content */}
      <article className="equipment-card" style={{ padding: '1.5rem', background: '#ffffff', minHeight: '400px' }}>
        {activeTab === 'visao-geral' && (
          <section id="visao-geral">
            <span className="section-kicker">Conceitos Fundamentais</span>
            <h3 style={{ fontSize: '1.25rem', margin: '0.2rem 0 0.75rem' }}>1. Visão Geral & Arquitetura da Plataforma</h3>
            <p style={{ lineHeight: 1.6, color: '#2d3748' }}>
              O <strong>Projeto Arqueia</strong> é a plataforma integrada de gestão operacional desenvolvida para o <strong>Laboratório CP2b</strong>. Ela unifica o agendamento de equipamentos de grande porte (HPLC, GC, TOC, ICP-OES), o controle de insumos e reagentes químicos por livro-razão imutável e a gestão de pesquisadores com auditoria em tempo real.
            </p>
            <h4 style={{ fontSize: '1rem', marginTop: '1.2rem', color: '#1a202c' }}>Princípios Não Negociáveis:</h4>
            <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.6, color: '#4a5568' }}>
              <li><strong>Livro-Razão Imutável de Movimentações:</strong> O saldo de qualquer insumo ou produto é estritamente derivado das movimentações registradas em append-only (nunca por edição direta da quantidade).</li>
              <li><strong>Modelagem Distinta de Produto e Lote:</strong> As especificações do produto (código, CAS, limite mínimo) vivem separadas das unidades físicas de lote (fabricante, validade e QR Code).</li>
              <li><strong>Autorização Papel × Laboratório (RBAC):</strong> Avaliada rigorosamente no servidor antes de cada ação.</li>
              <li><strong>Auditoria Imutável Sanitizada:</strong> Toda ação sensível grava registro em `audit_events` preservando campos autorizados e omitindo dados sensíveis.</li>
            </ul>
          </section>
        )}

        {activeTab === 'equipamentos' && (
          <section id="equipamentos">
            <span className="section-kicker">Módulo de Ativos</span>
            <h3 style={{ fontSize: '1.25rem', margin: '0.2rem 0 0.75rem' }}>2. Módulo de Equipamentos (`/equipamentos`)</h3>
            <p style={{ lineHeight: 1.6, color: '#2d3748' }}>
              Permite a consulta e gestão dos equipamentos científicos alocados nas bancadas e salas do CP2b.
            </p>
            <h4 style={{ fontSize: '1rem', marginTop: '1.2rem' }}>Passo a Passo Operacional:</h4>
            <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.6, color: '#4a5568' }}>
              <li>Navegue até a página <strong>Equipamentos</strong> no menu lateral.</li>
              <li>Consulte os cartões com status em tempo real: <code>Disponível</code>, <code>Em Avaliação</code>, <code>Em Manutenção</code> ou <code>Indisponível</code>.</li>
              <li>Verifique as políticas de uso daquele ativo: tempo máximo de agendamento, exigência de treinamento técnico prévio e liberação automática por ausência.</li>
              <li>Clique no botão <strong>"Reservar"</strong> no cartão do equipamento para abrir diretamente o calendário correspondente.</li>
            </ol>
          </section>
        )}

        {activeTab === 'agenda' && (
          <section id="agenda">
            <span className="section-kicker">Módulo de Reservas</span>
            <h3 style={{ fontSize: '1.25rem', margin: '0.2rem 0 0.75rem' }}>3. Agenda & Reservas Recorrentes (`/agenda`)</h3>
            <p style={{ lineHeight: 1.6, color: '#2d3748' }}>
              Grade visual interativa que permite agendar horários de uso de equipamentos por pesquisadores e técnicos.
            </p>
            <h4 style={{ fontSize: '1rem', marginTop: '1.2rem' }}>Como Agendar um Equipamento:</h4>
            <ol style={{ paddingLeft: '1.2rem', lineHeight: 1.6, color: '#4a5568' }}>
              <li>Acesse <strong>Agenda</strong> e selecione a visualização (Dia, Semana ou Mês).</li>
              <li>Clique na célula de horário desejada no equipamento selecionado.</li>
              <li>No formulário, vincule obrigatoriamente um <strong>Projeto Ativo</strong> (ex: <code>PROJ-BIO-2026</code>), informe o número de amostras e a descrição da atividade.</li>
              <li><strong>Reservas Recorrentes:</strong> Para experimentos longos, selecione a repetição (Diária, Semanal, Quinzenal ou Mensal). O sistema executa a resolução parcial de conflitos: efetua o agendamento nas datas livres e apresenta um relatório explícito de eventuais datas que possuíam colisão.</li>
              <li><strong>Cancelamento:</strong> Usuários comuns podem cancelar suas próprias reservas em até 30 minutos antes do horário de início.</li>
            </ol>
          </section>
        )}

        {activeTab === 'estoque' && (
          <section id="estoque">
            <span className="section-kicker">Módulo de Insumos</span>
            <h3 style={{ fontSize: '1.25rem', margin: '0.2rem 0 0.75rem' }}>4. Estoque & Livro-Razão de Insumos (`/estoque`)</h3>
            <p style={{ lineHeight: 1.6, color: '#2d3748' }}>
              Controle absoluto de reagentes, solventes e consumíveis por lotes físicos com QR Code.
            </p>
            <h4 style={{ fontSize: '1rem', marginTop: '1.2rem' }}>Operações do Estoque:</h4>
            <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.6, color: '#4a5568' }}>
              <li><strong>Registrar Entrada (`Entrada`):</strong> Adicione novos lotes com número do lote, fabricante (`manufacturer`), data de recebimento, validade e quantidade inicial. Um código único QR (ex: <code>ARQ-LOT-uuid</code>) será gerado.</li>
              <li><strong>Registrar Retirada (`Retirada`):</strong> Ao retirar um insumo para uso, selecione o lote e informe a quantidade e o <strong>Projeto de Pesquisa</strong> correspondente.</li>
              <li><strong>Ajustes & Descartes (`Ajuste` / `Descarte`):</strong> Registre correções de inventário ou descarte de reagentes vencidos com a devida justificativa.</li>
              <li><strong>Extrato do Ledger:</strong> Acompanhe as movimentações no extrato histórico paginado (até 50 registros por página), onde o saldo é calculado atômica e derivadamente.</li>
            </ul>
          </section>
        )}

        {activeTab === 'usuarios' && (
          <section id="usuarios">
            <span className="section-kicker">Módulo de Acessos</span>
            <h3 style={{ fontSize: '1.25rem', margin: '0.2rem 0 0.75rem' }}>5. Usuários & Controle de Acesso RBAC (`/usuarios`)</h3>
            <p style={{ lineHeight: 1.6, color: '#2d3748' }}>
              Gestão de membros da equipe e concessão de permissões de segurança.
            </p>
            <h4 style={{ fontSize: '1rem', marginTop: '1.2rem' }}>Papéis no Laboratório CP2b:</h4>
            <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.6, color: '#4a5568' }}>
              <li><strong>TÉCNICO:</strong> Acesso total às operações do laboratório, cadastro de insumos, manutenção de equipamentos e relatórios.</li>
              <li><strong>USUÁRIO:</strong> Permissão para agendar equipamentos e registrar retiradas de insumos vinculadas a seus projetos.</li>
              <li><strong>RESPONSÁVEL POR CONTROLADOS:</strong> Gestão e custódia de reagentes sujeitos a controle especial.</li>
              <li><strong>ADMINISTRADOR:</strong> Gestão global de acessos e configurações do sistema. Exige confirmação de senha do admin ao alterar papéis.</li>
            </ul>
          </section>
        )}

        {activeTab === 'gestao' && (
          <section id="gestao">
            <span className="section-kicker">Analytics & Histórico</span>
            <h3 style={{ fontSize: '1.25rem', margin: '0.2rem 0 0.75rem' }}>6. Gestão, Analytics & Auditoria (`/gestao`)</h3>
            <p style={{ lineHeight: 1.6, color: '#2d3748' }}>
              Painel consolidado para acompanhamento de indicadores e fiscalização do livro de auditoria.
            </p>
            <h4 style={{ fontSize: '1rem', marginTop: '1.2rem' }}>Funcionalidades Principais:</h4>
            <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.6, color: '#4a5568' }}>
              <li><strong>Seletor de Período Semiaberto:</strong> Selecione a janela temporal (máximo 90 dias) para geração dos dados. Os alertas de validade consideram o fuso horário <code>America/Sao_Paulo</code>.</li>
              <li><strong>Consumo por Projeto:</strong> Relatório discriminando horas de equipamentos e consumo de produtos em suas unidades físicas nativas (sem somar grandezas distintas).</li>
              <li><strong>Timeline de Auditoria Sanitizada:</strong> Histórico paginado por cursor de eventos auditáveis. Clique em <em>"Ver Detalhes"</em> para inspecionar os estados anterior/resultante sanitizados por allowlist (campos sensíveis como senhas ou segredos são ocultados).</li>
            </ul>
          </section>
        )}

        {activeTab === 'qr' && (
          <section id="qr">
            <span className="section-kicker">Identificação Física</span>
            <h3 style={{ fontSize: '1.25rem', margin: '0.2rem 0 0.75rem' }}>7. Leituras de QR Code & Dispositivos Móveis</h3>
            <p style={{ lineHeight: 1.6, color: '#2d3748' }}>
              O Arqueia foi projetado com suporte nativo a etiquetas QR Code (formato <code>ARQ-LOT-uuid</code> ou <code>ARQ-EQP-uuid</code>) fixadas nos recipientes e equipamentos.
            </p>
            <div style={{ background: '#fffaf0', border: '1px solid #fbd38d', padding: '0.75rem 1rem', borderRadius: '6px', marginTop: '1rem', fontSize: '0.85rem', color: '#744210' }}>
              ℹ️ <strong>Funcionalidade Planejada / Em Desenvolvimento:</strong> A leitura direta de QR Code via câmera de smartphone encontra-se em fase de testes finais. Atualmente, é possível utilizar leitores físicos de código de barras/QR de bancada ou acessar os registros diretamente pelos atalhos do sistema.
            </div>
          </section>
        )}

        {activeTab === 'tecnico' && (
          <section id="tecnico">
            <span className="section-kicker">Glossário & Mapeamento</span>
            <h3 style={{ fontSize: '1.25rem', margin: '0.2rem 0 0.75rem' }}>8. Referência Técnica & Terminologia do Código</h3>
            <p style={{ lineHeight: 1.6, color: '#2d3748' }}>
              Tabela de correspondência entre os termos da interface em Português e as constantes internas do sistema:
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.85rem' }}>
              <thead style={{ background: '#f7fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <tr>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Termo na Interface</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Constante / Tabela no Código</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Descrição</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #edf2f7' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Entrada de Estoque</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}><code>movement_type = 'ENTRY'</code></td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>Registro de novo lote ou reabastecimento.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #edf2f7' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Retirada de Insumo</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}><code>movement_type = 'WITHDRAWAL'</code></td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>Baixa de uso associada a um Projeto Ativo.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #edf2f7' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Ajuste de Inventário</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}><code>movement_type = 'ADJUSTMENT'</code></td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>Correção justificada do saldo derivado.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #edf2f7' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Descarte de Lote</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}><code>movement_type = 'DISCARD'</code></td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>Baixa por vencimento ou contaminação.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #edf2f7' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Livro de Auditoria</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}><code>tabela audit_events</code></td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>Registro append-only de ações da plataforma.</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}
      </article>
    </WorkspaceShell>
  );
}
