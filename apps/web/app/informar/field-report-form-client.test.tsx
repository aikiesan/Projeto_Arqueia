import type { PublicFieldReportForm } from '@arqueia/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FieldReportFormClient } from './field-report-form-client';

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

const laboratoryId = '11111111-1111-4111-a111-111111111111';
const equipmentId = '22222222-2222-4222-a222-222222222222';

const form: PublicFieldReportForm = {
  laboratory: { id: laboratoryId, code: 'CP2b', name: 'Laboratório CP2b' },
  equipment: [{ id: equipmentId, code: 'HPLC-01', name: 'HPLC Shimadzu' }],
};

function json(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function mockFetch(submitResponse: Response = json({ reference: 'INF-1A2B3C4D', receivedAt: '2026-09-30T12:00:00.000Z' }, 201)) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url === `/api/public/field-reports/form?laboratoryId=${laboratoryId}`) return json(form);
    if (url === '/api/public/field-reports') return submitResponse;
    if (url === '/api/public/laboratories') return json([form.laboratory]);
    throw new Error(`URL inesperada: ${url}`);
  });
}

describe('FieldReportFormClient', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams({ laboratory: laboratoryId });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('oferece os quatro tipos de informe', async () => {
    mockFetch();
    render(<FieldReportFormClient />);

    expect(await screen.findByRole('radio', { name: /Problema em equipamento/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Necessidade de manutenção/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Uso de insumos ou reagentes/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Informe geral ou pedido de apoio/ })).toBeInTheDocument();
  });

  it('envia sem login e mostra só o protocolo', async () => {
    const fetchMock = mockFetch();
    render(<FieldReportFormClient />);

    fireEvent.click(await screen.findByRole('radio', { name: /Uso de insumos ou reagentes/ }));
    expect(screen.queryByRole('checkbox', { name: /impede o uso/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem' }), {
      target: { value: 'Usei 50 mL de metanol grau HPLC.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe' }));

    expect(await screen.findByRole('status')).toHaveTextContent('INF-1A2B3C4D');
    const submitCall = fetchMock.mock.calls.find(([url]) => String(url) === '/api/public/field-reports');
    expect(JSON.parse(String((submitCall?.[1] as RequestInit).body))).toEqual({
      laboratoryId,
      kind: 'SUPPLY_USAGE',
      equipmentId: null,
      message: 'Usei 50 mL de metanol grau HPLC.',
      blocksUse: false,
      reporterName: '',
      reporterContact: '',
      website: '',
    });
  });

  it('abre com o equipamento da etiqueta e permite dizer que ele parou', async () => {
    mockSearchParams = new URLSearchParams({ laboratory: laboratoryId, equipment: equipmentId });
    const fetchMock = mockFetch();
    render(<FieldReportFormClient />);

    expect(await screen.findByRole('radio', { name: /Problema em equipamento/ })).toBeChecked();
    expect(screen.getByRole('combobox', { name: /Equipamento/ })).toHaveValue(equipmentId);
    fireEvent.click(screen.getByRole('checkbox', { name: /impede o uso/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem' }), {
      target: { value: 'Erro de pressão ao iniciar a corrida.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe' }));

    await screen.findByRole('status');
    const submitCall = fetchMock.mock.calls.find(([url]) => String(url) === '/api/public/field-reports');
    expect(JSON.parse(String((submitCall?.[1] as RequestInit).body))).toMatchObject({
      kind: 'EQUIPMENT_PROBLEM',
      equipmentId,
      blocksUse: true,
    });
  });

  it('mantém o botão desabilitado até a mensagem ter conteúdo', async () => {
    mockFetch();
    render(<FieldReportFormClient />);

    fireEvent.click(await screen.findByRole('radio', { name: /Informe geral/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem' }), { target: { value: 'curto' } });

    expect(screen.getByRole('button', { name: 'Enviar informe' })).toBeDisabled();
  });

  it('explica o limite de envios em vez de falhar em silêncio', async () => {
    mockFetch(
      json(
        {
          code: 'FIELD_REPORT_RATE_LIMIT_EXCEEDED',
          message: 'Muitos informes em pouco tempo. Aguarde alguns minutos e tente de novo.',
        },
        429,
      ),
    );
    render(<FieldReportFormClient />);

    fireEvent.click(await screen.findByRole('radio', { name: /Informe geral/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem' }), {
      target: { value: 'Preciso de ajuda com a centrífuga.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar informe' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitos informes em pouco tempo');
  });

  it('avisa quando o QR aponta para laboratório que não recebe informes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ code: 'LABORATORY_NOT_FOUND' }, 404));
    render(<FieldReportFormClient />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('não recebe mais informes'),
    );
  });
});
