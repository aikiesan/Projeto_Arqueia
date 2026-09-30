import type { FieldReportKind, FieldReportStatus } from '@arqueia/contracts';

export interface FieldReportKindPresentation {
  readonly label: string;
  readonly description: string;
  readonly placeholder: string;
  /** Tipos em que faz sentido apontar o equipamento e dizer se ele parou. */
  readonly aboutEquipment: boolean;
}

export const FIELD_REPORT_KIND_PRESENTATION: Readonly<
  Record<FieldReportKind, FieldReportKindPresentation>
> = {
  EQUIPMENT_PROBLEM: {
    label: 'Problema em equipamento',
    description: 'Não liga, deu erro, resultado estranho, vazamento.',
    placeholder: 'O que aconteceu? Ex.: o HPLC mostra erro de pressão ao iniciar a corrida.',
    aboutEquipment: true,
  },
  MAINTENANCE_REQUEST: {
    label: 'Necessidade de manutenção',
    description: 'Peça gasta, limpeza, calibração, filtro, conserto.',
    placeholder: 'O que precisa de manutenção? Ex.: o filtro da capela está saturado.',
    aboutEquipment: true,
  },
  SUPPLY_USAGE: {
    label: 'Uso de insumos ou reagentes',
    description: 'O que você usou, quanto, e se está acabando.',
    placeholder: 'Qual insumo, quanto e para quê? Ex.: usei 50 mL de metanol grau HPLC; resta pouco.',
    aboutEquipment: false,
  },
  GENERAL_SUPPORT: {
    label: 'Informe geral ou pedido de apoio',
    description: 'Dúvidas, sugestões ou qualquer ajuda de que precise.',
    placeholder: 'Como podemos ajudar?',
    aboutEquipment: false,
  },
};

export const FIELD_REPORT_STATUS_LABEL: Readonly<Record<FieldReportStatus, string>> = {
  NEW: 'Novo',
  IN_REVIEW: 'Em análise',
  RESOLVED: 'Resolvido',
};
