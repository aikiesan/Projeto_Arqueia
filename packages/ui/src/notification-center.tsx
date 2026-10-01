'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { joinBasePath } from './base-path';
import { ArqueiaIcon } from './icons';

export interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly timeLabel: string;
  readonly href: string;
  /** Destaque vermelho: algo que impede o trabalho agora (ex.: equipamento parado). */
  readonly urgent?: boolean;
}

export interface NotificationCenterProps {
  readonly basePath?: string | undefined;
  /** Quantos itens pedem atenção. Zero esconde o contador. */
  readonly count: number;
  readonly items: readonly NotificationItem[];
  readonly title: string;
  readonly emptyLabel: string;
  readonly status?: 'ready' | 'loading' | 'error';
  readonly viewAll?: { readonly href: string; readonly label: string } | undefined;
  /** Chamado ao abrir o painel — o dono dos dados aproveita para atualizar. */
  readonly onOpen?: () => void;
}

/**
 * Sino de notificações do topo do app (web e celular).
 *
 * Só apresentação: quem busca os dados é o app. Fecha com Esc (devolvendo o
 * foco ao sino) e com clique fora. No celular o painel ocupa a largura da
 * barra; no desktop, abre ancorado ao sino.
 */
export function NotificationCenter({
  basePath,
  count,
  emptyLabel,
  items,
  onOpen,
  status = 'ready',
  title,
  viewAll,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function toggle(): void {
    if (!open) onOpen?.();
    setOpen(!open);
  }

  const badge = count > 99 ? '99+' : String(count);

  return (
    <div className="arqueia-notifications" ref={containerRef}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={count > 0 ? `Notificações: ${count} ${count === 1 ? 'nova' : 'novas'}` : 'Notificações'}
        className="arqueia-alert-button"
        onClick={toggle}
        ref={buttonRef}
        type="button"
      >
        <ArqueiaIcon name="alerta" size={20} />
        {count > 0 ? (
          <span aria-hidden="true" className="arqueia-notification-count">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div aria-label={title} className="arqueia-notification-panel" id={panelId} role="region">
          <div className="arqueia-notification-header">
            <strong>{title}</strong>
            {count > 0 ? <span>{badge}</span> : null}
          </div>

          {status === 'error' ? (
            <p className="arqueia-notification-empty" role="alert">
              Não foi possível carregar as notificações agora.
            </p>
          ) : status === 'loading' && items.length === 0 ? (
            <p className="arqueia-notification-empty">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="arqueia-notification-empty">{emptyLabel}</p>
          ) : (
            <ul className="arqueia-notification-list">
              {items.map((item) => (
                <li key={item.id}>
                  <a
                    className={`arqueia-notification-item${item.urgent ? ' is-urgent' : ''}`}
                    href={joinBasePath(basePath, item.href)}
                  >
                    <span aria-hidden="true" className="arqueia-notification-mark" />
                    <span className="arqueia-notification-copy">
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </span>
                    <small>{item.timeLabel}</small>
                  </a>
                </li>
              ))}
            </ul>
          )}

          {viewAll ? (
            <a className="arqueia-notification-all" href={joinBasePath(basePath, viewAll.href)}>
              {viewAll.label} →
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
