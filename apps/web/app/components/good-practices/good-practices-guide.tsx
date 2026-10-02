'use client';

import { ArqueiaIcon } from '@arqueia/ui';
import { useState, type ReactNode } from 'react';

import { withBasePath } from '../../lib/base-path';
import { externalUrl } from '../../lib/external-url';
import {
  BIOSAFETY_LEVELS,
  CHEMICAL_INCOMPATIBILITIES,
  COLLECTIVE_PROTECTION,
  DETAIL_SECTIONS,
  EMERGENCY_CONTACTS_REVIEWED_AT,
  EMERGENCY_NUMBERS,
  EMERGENCY_STEPS,
  ESSENTIAL_SECTIONS,
  filterIncompatibilities,
  GLOVE_TYPES,
  GOOD_PRACTICES_SOURCE,
  PERSONAL_PROTECTION,
  RISK_TYPES,
  SAFETY_REMINDERS,
  UNICAMP_EMERGENCY_CONTACTS,
  type ChecklistSection,
} from './good-practices-content';

type HeadingLevel = 2 | 3;

interface GoodPracticesGuideProps {
  /** Nível dos títulos de seção: 2 na página pública, 3 dentro do Guia de Uso. */
  readonly headingLevel?: HeadingLevel;
  /** Destino do "Informar" no bloco de acidentes (com laboratório, quando houver). */
  readonly reportHref?: string;
}

const COLLAPSIBLE = [
  { id: 'riscos', title: 'Conheça os riscos' },
  { id: 'protecao', title: 'EPI e EPC' },
  ...DETAIL_SECTIONS.map(({ id, title }) => ({ id, title })),
  { id: 'incompatibilidades', title: 'Incompatibilidades químicas' },
] as const;

function Heading({ level, children }: { readonly level: HeadingLevel; readonly children: ReactNode }) {
  return level === 2 ? <h2>{children}</h2> : <h3>{children}</h3>;
}

function Checklist({ items }: { readonly items: readonly string[] }) {
  return (
    <ul className="gp-checklist">
      {items.map((item) => (
        <li key={item}>
          <span aria-hidden="true" className="gp-check">
            <ArqueiaIcon name="check" size={14} />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ChecklistBody({ section }: { readonly section: ChecklistSection }) {
  return (
    <>
      {section.groups.map((group, index) => (
        <div className="gp-group" key={group.title ?? index}>
          {group.title ? <p className="gp-group-title">{group.title}</p> : null}
          <Checklist items={group.items} />
        </div>
      ))}
    </>
  );
}

/**
 * Boas práticas de laboratório: o mesmo conteúdo na página pública
 * (`/boas-praticas`, sem login) e na aba do Guia de Uso.
 */
export function GoodPracticesGuide({ headingLevel = 2, reportHref = '/informar' }: GoodPracticesGuideProps) {
  const [openSections, setOpenSections] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const incompatibilities = filterIncompatibilities(query, CHEMICAL_INCOMPATIBILITIES);

  function setOpen(id: string, open: boolean): void {
    setOpenSections((current) => {
      if (current.has(id) === open) return current;
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function jumpTo(id: string): void {
    setOpen(id, true);
    // Abre primeiro, rola depois: o conteúdo da seção precisa existir.
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function collapsible(id: string, title: string, summary: string, body: ReactNode) {
    return (
      <details
        className="gp-card gp-collapsible"
        id={id}
        key={id}
        onToggle={(event) => setOpen(id, event.currentTarget.open)}
        open={openSections.has(id)}
      >
        <summary>
          <span className="gp-summary-copy">
            <Heading level={headingLevel}>{title}</Heading>
            <small>{summary}</small>
          </span>
          <span aria-hidden="true" className="gp-summary-chevron">⌄</span>
        </summary>
        <div className="gp-collapsible-body">{body}</div>
      </details>
    );
  }

  return (
    <div className="gp-guide">
      <aside aria-label="Fonte" className="gp-source">
        <p>
          Resumo baseado no <cite>{GOOD_PRACTICES_SOURCE.title}</cite> ({GOOD_PRACTICES_SOURCE.publisher},{' '}
          {GOOD_PRACTICES_SOURCE.year}). Não substitui o treinamento, os POPs do laboratório nem as FISPQs.
        </p>
        <a
          className="gp-download"
          href={externalUrl(GOOD_PRACTICES_SOURCE.url)}
          rel="noopener noreferrer"
          target="_blank"
        >
          Baixar o guia completo (PDF, site da USP)
        </a>
      </aside>

      <nav aria-label="Seções das boas práticas" className="gp-toc">
        <a href="#antes-de-entrar">Antes de entrar</a>
        <a href="#durante-o-trabalho">Durante o trabalho</a>
        <a className="is-emergency" href="#em-caso-de-acidente">Em caso de acidente</a>
        {COLLAPSIBLE.map((item) => (
          <a
            href={`#${item.id}`}
            key={item.id}
            onClick={(event) => {
              event.preventDefault();
              jumpTo(item.id);
            }}
          >
            {item.title}
          </a>
        ))}
      </nav>

      <div className="gp-essentials">
        {ESSENTIAL_SECTIONS.map((section) => (
          <section aria-labelledby={`${section.id}-title`} className="gp-card" id={section.id} key={section.id}>
            <div className="gp-card-heading" id={`${section.id}-title`}>
              <Heading level={headingLevel}>{section.title}</Heading>
              <small>{section.summary}</small>
            </div>
            <ChecklistBody section={section} />
          </section>
        ))}
      </div>

      <section aria-labelledby="em-caso-de-acidente-title" className="gp-card gp-emergency" id="em-caso-de-acidente">
        <div className="gp-card-heading" id="em-caso-de-acidente-title">
          <Heading level={headingLevel}>Em caso de acidente</Heading>
          <small>Orientações gerais. Siga também o POP e o treinamento do seu laboratório.</small>
        </div>
        <div className="gp-emergency-grid">
          {EMERGENCY_STEPS.map((step) => (
            <div className="gp-emergency-step" key={step.title}>
              <strong>{step.title}</strong>
              <p>{step.items.join(' ')}</p>
            </div>
          ))}
        </div>
        <p className="gp-group-title">Na Unicamp (campus Barão Geraldo)</p>
        <ul className="gp-contacts">
          {UNICAMP_EMERGENCY_CONTACTS.map((contact) => (
            <li className={`gp-contact is-${contact.id}`} key={contact.id}>
              <div>
                <strong>{contact.name}</strong>
                <p>{contact.detail}</p>
                {contact.note ? <p className="gp-muted">{contact.note}</p> : null}
              </div>
              {contact.phones.length > 0 ? (
                <div className="gp-contact-phones">
                  {contact.phones.map((phone) => (
                    <a className="gp-call" href={`tel:${phone.dial}`} key={phone.dial}>
                      {phone.display}
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="gp-emergency-actions">
          {EMERGENCY_NUMBERS.map((entry) => (
            <a className="gp-call" href={`tel:${entry.number}`} key={entry.number}>
              {entry.label} <strong>{entry.number}</strong>
            </a>
          ))}
          <a className="gp-report" href={withBasePath(reportHref)}>
            <ArqueiaIcon name="informar" size={18} />
            Avisar a coordenação
          </a>
        </div>
        <p className="gp-emergency-note">
          Depois de se proteger, avise o responsável pelo laboratório e registre o ocorrido pelo Informar.
          Contatos revisados pela coordenação do CP2b em {EMERGENCY_CONTACTS_REVIEWED_AT}.
        </p>
      </section>

      {collapsible(
        'riscos',
        'Conheça os riscos',
        'Os cinco tipos e as cores do mapa de risco.',
        <>
          <ul className="gp-risks">
            {RISK_TYPES.map((risk) => (
              <li className="gp-risk" key={risk.id} style={{ borderLeftColor: risk.mapColor }}>
                <strong>
                  <span aria-hidden="true" className="gp-risk-dot" style={{ background: risk.mapColor }} />
                  Riscos {risk.name.toLowerCase()} <small>({risk.mapColorName} no mapa de risco)</small>
                </strong>
                <p>{risk.description}</p>
                <p className="gp-muted">Exemplos: {risk.examples}</p>
              </li>
            ))}
          </ul>
          <p className="gp-group-title">Risco biológico: classes e níveis de contenção</p>
          <ul className="gp-levels">
            {BIOSAFETY_LEVELS.map((level) => (
              <li key={level.level}>
                <strong>{level.level}</strong>
                <span>{level.description}</span>
              </li>
            ))}
          </ul>
        </>,
      )}

      {collapsible(
        'protecao',
        'EPI e EPC',
        'Proteção individual e coletiva: o que é e quando usar.',
        <>
          <p className="gp-group-title">Equipamentos de proteção individual (EPI)</p>
          <dl className="gp-defs">
            {PERSONAL_PROTECTION.map((item) => (
              <div key={item.name}>
                <dt>{item.name}</dt>
                <dd>{item.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="gp-group-title">Qual luva usar</p>
          <dl className="gp-defs">
            {GLOVE_TYPES.map((glove) => (
              <div key={glove.type}>
                <dt>{glove.type}</dt>
                <dd>{glove.use}</dd>
              </div>
            ))}
          </dl>
          <p className="gp-group-title">Equipamentos de proteção coletiva (EPC)</p>
          <dl className="gp-defs">
            {COLLECTIVE_PROTECTION.map((item) => (
              <div key={item.name}>
                <dt>{item.name}</dt>
                <dd>{item.detail}</dd>
              </div>
            ))}
          </dl>
        </>,
      )}

      {DETAIL_SECTIONS.map((section) =>
        collapsible(section.id, section.title, section.summary, <ChecklistBody section={section} />),
      )}

      {collapsible(
        'incompatibilidades',
        'Incompatibilidades químicas',
        'O que não pode ficar junto no armazenamento nem no descarte.',
        <>
          <label className="gp-search">
            <span>Buscar substância</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: acetona, amônia, H₂S"
              type="search"
              value={query}
            />
          </label>
          {incompatibilities.length === 0 ? (
            <p className="gp-muted">
              Nada encontrado nesta seleção. Consulte a FISPQ do produto e a tabela completa do guia.
            </p>
          ) : (
            <dl className="gp-defs gp-incompatibilities">
              {incompatibilities.map((row) => (
                <div key={row.substance}>
                  <dt>{row.substance}</dt>
                  <dd>Manter longe de: {row.keepAwayFrom}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="gp-muted">
            Seleção das combinações mais comuns. A tabela completa está no guia de referência.
          </p>
        </>,
      )}

      <ul aria-label="Lembretes" className="gp-reminders">
        {SAFETY_REMINDERS.map((reminder) => (
          <li key={reminder}>{reminder}</li>
        ))}
      </ul>
    </div>
  );
}
