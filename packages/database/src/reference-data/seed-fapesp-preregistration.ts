import type { DatabaseClient } from '../client.js';

import { CP2B_EQUIPMENT_CATALOG } from './cp2b-equipment-catalog.js';

interface OptionIdRow {
  readonly id: string;
}

export interface FapespPreRegistrationResult {
  readonly equipmentsCreated: number;
  readonly productsCreated: number;
  readonly batchesCreated: number;
}

export async function seedFapespPreRegistration(
  client: DatabaseClient,
  laboratoryId: string,
  projectId: string,
  actorId: string,
): Promise<FapespPreRegistrationResult> {
  // Helper to find catalog option id by label substring or code
  async function findOptionId(search: string): Promise<string | null> {
    const res = await client.query<OptionIdRow>(
      `
        SELECT id FROM catalog_options
        WHERE laboratory_id = $1
          AND archived_at IS NULL
          AND (label ILIKE $2 OR code ILIKE $2)
        ORDER BY created_at ASC
        LIMIT 1
      `,
      [laboratoryId, `%${search}%`],
    );
    return res.rows[0]?.id ?? null;
  }

  // Fallback: any option id in laboratory if specific option not found
  const fallbackOptionRes = await client.query<OptionIdRow>(
    `SELECT id FROM catalog_options WHERE laboratory_id = $1 AND archived_at IS NULL LIMIT 1`,
    [laboratoryId],
  );
  const defaultOptionId = fallbackOptionRes.rows[0]?.id;

  const equipmentsToSeed = CP2B_EQUIPMENT_CATALOG;

  let equipmentsCreated = 0;
  for (const eq of equipmentsToSeed) {
    const optionId = (await findOptionId(eq.searchKey)) ?? defaultOptionId;
    if (!optionId) continue;

    await client.query(
      `
        INSERT INTO equipment (
          laboratory_id, catalog_option_id, code, name, asset_tag, serial_number,
          status, max_reservation_minutes, requires_training, requires_approval,
          absence_release_minutes, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'AVAILABLE', $7, $8, false, 30, $9)
        ON CONFLICT (laboratory_id, code) WHERE archived_at IS NULL
        DO UPDATE SET
          name = EXCLUDED.name,
          asset_tag = EXCLUDED.asset_tag,
          serial_number = EXCLUDED.serial_number,
          notes = EXCLUDED.notes
      `,
      [
        laboratoryId,
        optionId,
        eq.code,
        eq.name,
        eq.assetTag,
        eq.serialNumber,
        eq.maxMinutes,
        eq.requiresTraining,
        eq.notes,
      ],
    );
    equipmentsCreated++;
  }

  const productsToSeed = [
    {
      code: 'PRD-CITRATO-FE',
      name: 'Citrato Férrico Amoniacal P.A.',
      casNumber: '1185-57-5',
      category: 'REAGENT',
      unitOfMeasure: 'FRASCO',
      minStock: 1,
      desc: 'Sigma-Aldrich frasco 100g (AQ-010). Reagente para cultura microbiológica e suplementação.',
      batchNumber: 'SIGMA-CF-2019',
      manufacturer: 'Sigma-Aldrich Brasil',
      quantity: 1,
      qrCode: 'ARQ-CP2B-PRD-CITRATO-FE-01',
    },
    {
      code: 'PRD-EDTA-SAL',
      name: 'Ácido Etilenodiaminotetracético (EDTA) Sal Dissódico',
      casNumber: '6381-92-6',
      category: 'REAGENT',
      unitOfMeasure: 'FRASCO',
      minStock: 1,
      desc: 'Sigma-Aldrich frasco 500g (AQ-010). Agente quelante para análises laboratoriais.',
      batchNumber: 'SIGMA-EDTA-2019',
      manufacturer: 'Sigma-Aldrich Brasil',
      quantity: 1,
      qrCode: 'ARQ-CP2B-PRD-EDTA-SAL-01',
    },
    {
      code: 'PRD-COBALTO-NO3',
      name: 'Nitrato de Cobalto(II) Hexahidratado 98%',
      casNumber: '10026-22-9',
      category: 'REAGENT',
      unitOfMeasure: 'FRASCO',
      minStock: 1,
      desc: 'Sigma-Aldrich frasco 5g (AQ-010). Micronutriente e catalisador.',
      batchNumber: 'SIGMA-CO-2019',
      manufacturer: 'Sigma-Aldrich Brasil',
      quantity: 1,
      qrCode: 'ARQ-CP2B-PRD-COBALTO-NO3-01',
    },
    {
      code: 'PRD-FE3O4-NANO',
      name: 'Óxido de Ferro(II,III) Nanoparticulado 50-100 nm',
      casNumber: '1317-61-9',
      category: 'REAGENT',
      unitOfMeasure: 'FRASCO',
      minStock: 1,
      desc: 'Sigma-Aldrich 637106-25G (AQ-011). Nanopartículas magnéticas para intensificação da metanogênese.',
      batchNumber: 'SIGMA-FE3O4-2020',
      manufacturer: 'Sigma-Aldrich Brasil',
      quantity: 1,
      qrCode: 'ARQ-CP2B-PRD-FE3O4-NANO-01',
    },
    {
      code: 'PRD-HAMILTON-S1000',
      name: 'Seringa Hamilton 1 L Modelo S1000 Tracheal',
      casNumber: null,
      category: 'CONSUMABLE',
      unitOfMeasure: 'UNIDADE',
      minStock: 1,
      desc: 'Hamilton S1000 Tracheal sem agulha (AQ-029). Amostragem e medição de biogás.',
      batchNumber: 'HAM-S1000-2017',
      manufacturer: 'Hamilton / Scielab',
      quantity: 1,
      qrCode: 'ARQ-CP2B-PRD-HAMILTON-S1000-01',
    },
    {
      code: 'PRD-HAMILTON-S0500',
      name: 'Seringa Hamilton 500 mL Modelo S0500 Tracheal',
      casNumber: null,
      category: 'CONSUMABLE',
      unitOfMeasure: 'UNIDADE',
      minStock: 1,
      desc: 'Hamilton S0500 Tracheal sem agulha (AQ-029). Amostragem volumétrica de gases.',
      batchNumber: 'HAM-S0500-2017',
      manufacturer: 'Hamilton / Scielab',
      quantity: 1,
      qrCode: 'ARQ-CP2B-PRD-HAMILTON-S0500-01',
    },
    {
      code: 'PRD-TUBO-VAC-BRANCO',
      name: 'Tubo de Coleta a Vácuo Branco 5 mL (Rack)',
      casNumber: null,
      category: 'CONSUMABLE',
      unitOfMeasure: 'CAIXA',
      minStock: 1,
      desc: 'Sabre Safety 207463 (AQ-007). Tubos de coleta sem aditivo para amostragem gasosa.',
      batchNumber: 'SABRE-TB-2019',
      manufacturer: 'Sabre Safety',
      quantity: 2,
      qrCode: 'ARQ-CP2B-PRD-TUBO-VAC-BRANCO-01',
    },
    {
      code: 'PRD-TUBO-VAC-VERM',
      name: 'Tubo de Coleta a Vácuo Seco Vermelho 5 mL (Rack)',
      casNumber: null,
      category: 'CONSUMABLE',
      unitOfMeasure: 'CAIXA',
      minStock: 1,
      desc: 'Sabre Safety 207463 (AQ-012). Tubos secos para amostragem.',
      batchNumber: 'SABRE-TV-2020',
      manufacturer: 'Sabre Safety',
      quantity: 3,
      qrCode: 'ARQ-CP2B-PRD-TUBO-VAC-VERM-01',
    },
    {
      code: 'PRD-PLUG-MACHO-CINZA',
      name: 'Plug Macho 2P+T 10 A Reto Cinza',
      casNumber: null,
      category: 'CONSUMABLE',
      unitOfMeasure: 'UNIDADE',
      minStock: 1,
      desc: 'Fame 1729 (AQ-008). Material elétrico de bancada e instalações.',
      batchNumber: 'FAME-1729-2019',
      manufacturer: 'Fame',
      quantity: 4,
      qrCode: 'ARQ-CP2B-PRD-PLUG-MACHO-CINZA-01',
    },
    {
      code: 'PRD-FILTRO-LINHA-6T',
      name: 'Filtro de Linha PVC com 6 Tomadas',
      casNumber: null,
      category: 'CONSUMABLE',
      unitOfMeasure: 'UNIDADE',
      minStock: 1,
      desc: 'PER6T (AQ-008). Régua de tomadas para equipamentos laboratoriais.',
      batchNumber: 'PER6T-2019',
      manufacturer: 'Universal',
      quantity: 2,
      qrCode: 'ARQ-CP2B-PRD-FILTRO-LINHA-6T-01',
    },
    {
      code: 'PRD-ABRACADEIRA-NYLON',
      name: 'Abraçadeira de Nylon 340 x 4,80 mm Preta',
      casNumber: null,
      category: 'CONSUMABLE',
      unitOfMeasure: 'PACOTE',
      minStock: 1,
      desc: 'F7034 (AQ-008). Material de fixação e montagem de tubulações de biogás.',
      batchNumber: 'F7034-2019',
      manufacturer: 'Universal',
      quantity: 1,
      qrCode: 'ARQ-CP2B-PRD-ABRACADEIRA-NYLON-01',
    },
    {
      code: 'PRD-PLUG-FEMEA-PRETO',
      name: 'Plug Fêmea 2P+T 10 A Preto',
      casNumber: null,
      category: 'CONSUMABLE',
      unitOfMeasure: 'UNIDADE',
      minStock: 1,
      desc: 'Fame 2146 (AQ-009). Conector elétrico.',
      batchNumber: 'FAME-2146-2019',
      manufacturer: 'Fame',
      quantity: 2,
      qrCode: 'ARQ-CP2B-PRD-PLUG-FEMEA-PRETO-01',
    },
    {
      code: 'PRD-PLUG-MACHO-PRETO',
      name: 'Plug Macho 2P+T 10 A Reto Preto',
      casNumber: null,
      category: 'CONSUMABLE',
      unitOfMeasure: 'UNIDADE',
      minStock: 1,
      desc: 'MG 12686 (AQ-009). Conector elétrico.',
      batchNumber: 'MG-12686-2019',
      manufacturer: 'MG',
      quantity: 2,
      qrCode: 'ARQ-CP2B-PRD-PLUG-MACHO-PRETO-01',
    },
  ];

  let productsCreated = 0;
  let batchesCreated = 0;

  for (const p of productsToSeed) {
    const prodRes = await client.query<{ readonly id: string }>(
      `
        WITH seeded AS (
          INSERT INTO products (
            laboratory_id, code, name, cas_number, category, unit_of_measure,
            minimum_stock_threshold, description
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (laboratory_id, code) WHERE archived_at IS NULL
          DO UPDATE SET
            name = EXCLUDED.name,
            cas_number = EXCLUDED.cas_number,
            description = EXCLUDED.description
          RETURNING id
        )
        SELECT id FROM seeded
        UNION ALL
        SELECT id FROM products WHERE laboratory_id = $1 AND code = $2 AND archived_at IS NULL
        LIMIT 1
      `,
      [
        laboratoryId,
        p.code,
        p.name,
        p.casNumber,
        p.category,
        p.unitOfMeasure,
        p.minStock,
        p.desc,
      ],
    );
    const productId = prodRes.rows[0]?.id;
    if (!productId) continue;
    productsCreated++;

    const batchRes = await client.query<{ readonly id: string; readonly inserted: boolean }>(
      `
        WITH seeded AS (
          INSERT INTO batches (
            laboratory_id, product_id, batch_number, manufacturer,
            initial_quantity, qr_code, status, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'AVAILABLE', $7)
          ON CONFLICT (qr_code) WHERE archived_at IS NULL
          DO NOTHING
          RETURNING id, true AS inserted
        )
        SELECT id, inserted FROM seeded
        UNION ALL
        SELECT id, false AS inserted
        FROM batches
        WHERE qr_code = $6 AND archived_at IS NULL
        LIMIT 1
      `,
      [
        laboratoryId,
        productId,
        p.batchNumber,
        p.manufacturer,
        p.quantity,
        p.qrCode,
        `Lote inicial pré-cadastrado do inventário FAPESP Bruna Moraes.`,
      ],
    );
    const batch = batchRes.rows[0];
    if (!batch) continue;

    if (batch.inserted) {
      batchesCreated++;
      await client.query(
        `
          INSERT INTO stock_movements (
            laboratory_id, batch_id, product_id, user_id, project_id,
            movement_type, quantity, balance_after, purpose, reason
          )
          VALUES ($1, $2, $3, $4, $5, 'ENTRY', $6, $6, 'Carga inicial de inventário FAPESP', 'Pré-cadastro de inventário')
        `,
        [
          laboratoryId,
          batch.id,
          productId,
          actorId,
          projectId,
          p.quantity,
        ],
      );
    }
  }

  return {
    equipmentsCreated,
    productsCreated,
    batchesCreated,
  };
}
