'use client';

import { NotificationCenter } from '@arqueia/ui';

import { BASE_PATH } from '../../lib/base-path';
import type { NotificationScope } from '../../presentation';
import { useFieldReportNotifications } from './field-report-notifications';

/**
 * Sino do topo, igual em todas as páginas do workspace (web e celular).
 *
 * Para a coordenação, lista os informes novos do laboratório ativo. Para os
 * demais, fica sem contador e aponta o caminho de quem quer avisar algo.
 */
export function WorkspaceNotifications({
  scope,
}: {
  readonly scope: NotificationScope;
}): React.JSX.Element {
  const notifications = useFieldReportNotifications(scope);
  const canReview = scope.canReviewFieldReports && scope.laboratoryId !== '';

  return (
    <NotificationCenter
      basePath={BASE_PATH}
      count={notifications.count}
      emptyLabel={
        canReview
          ? 'Nenhum informe novo. Tudo em dia!'
          : 'Nada por aqui. Viu um problema? Use o botão Informar.'
      }
      items={notifications.items}
      onOpen={notifications.refresh}
      status={notifications.status}
      title={canReview ? 'Informes novos' : 'Notificações'}
      viewAll={
        canReview
          ? { href: `/informes?laboratory=${scope.laboratoryId}`, label: 'Ver todos os informes' }
          : undefined
      }
    />
  );
}
