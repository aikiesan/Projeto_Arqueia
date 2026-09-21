import { listEquipmentQuerySchema, type EquipmentPage } from '@arqueia/contracts';
import { describe, expect, it, vi } from 'vitest';

import { EQUIPMENT_PAGE_SIZE, loadAllEquipment } from './agenda-page-client';

const laboratoryId = '7d444840-9dc0-11d1-b245-5ffdce74fad2';

function page(ids: readonly string[], nextCursor: string | null): EquipmentPage {
  return {
    items: ids.map((id) => ({ id, laboratoryId })),
    pageInfo: { hasNextPage: nextCursor !== null, nextCursor },
  } as unknown as EquipmentPage;
}

describe('loadAllEquipment', () => {
  /**
   * Regressão de CI: a primeira versão pedia `limit=100`, acima do `.max(50)` de
   * `listEquipmentQuerySchema`. A API respondia 400, o init da agenda caía no
   * catch e a página inteira virava estado de erro — os testes e2e da agenda
   * quebraram em bloco. O teste anterior não pegava porque injetava um
   * `fetchPage` falso, que nunca validava a query. Agora o contrato valida.
   */
  it('monta uma query que o contrato da API aceita', async () => {
    const urls: string[] = [];
    await loadAllEquipment(laboratoryId, async (url) => {
      urls.push(url);
      return page([], null);
    });

    const query = Object.fromEntries(new URL(urls[0]!, 'http://x').searchParams);
    expect(() => listEquipmentQuerySchema.parse(query)).not.toThrow();
    expect(listEquipmentQuerySchema.parse(query).limit).toBe(EQUIPMENT_PAGE_SIZE);
  });

  /**
   * Regressão do QR: a agenda pedia uma página de 50 e parava. Um equipamento
   * na terceira página resolvia no servidor mas não existia na lista da tela —
   * aba sem destaque, `<select>` em branco, cabeçalho sem nome.
   */
  it('segue o cursor até o fim do catálogo', async () => {
    const urls: string[] = [];
    const fetchPage = vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes('cursor=c2')) return page(['e5'], null);
      if (url.includes('cursor=c1')) return page(['e3', 'e4'], 'c2');
      return page(['e1', 'e2'], 'c1');
    });

    const items = await loadAllEquipment(laboratoryId, fetchPage);

    expect(items.map((item) => item.id)).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain(`limit=${EQUIPMENT_PAGE_SIZE}`);
    expect(urls[0]).toContain(`laboratoryId=${laboratoryId}`);
    expect(urls[0]).not.toContain('cursor=');
    expect(urls[1]).toContain('cursor=c1');
  });

  it('para na primeira página quando não há próxima', async () => {
    const fetchPage = vi.fn(async () => page(['e1'], null));

    await expect(loadAllEquipment(laboratoryId, fetchPage)).resolves.toHaveLength(1);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('não varre indefinidamente se o servidor sempre anunciar próxima página', async () => {
    const fetchPage = vi.fn(async () => page(['e'], 'sempre'));

    const items = await loadAllEquipment(laboratoryId, fetchPage, 3);

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(items).toHaveLength(3);
  });
});
