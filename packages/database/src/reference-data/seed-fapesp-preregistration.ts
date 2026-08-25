import type { DatabaseClient } from '../client.js';

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

  const equipmentsToSeed = [
    // 1. FAPESP Equipments
    {
      code: 'EQ-ADAMO-F2DM',
      name: 'Forno Mufla Microprocessado Adamo F2-DM',
      searchKey: 'F2-DM',
      assetTag: 'FAPESP-2018-001',
      serialNumber: 'ADAMO-F2DM-01',
      notes: 'Aquisição FAPESP proc. 2016/16438-3 (AQ-001). Temperatura de trabalho até 1200°C.',
      maxMinutes: 720,
      requiresTraining: true,
    },
    {
      code: 'EQ-HACH-DR6000',
      name: 'Espectrofotômetro UV-Vis Hach DR6000',
      searchKey: 'DR6000',
      assetTag: 'FAPESP-2018-002',
      serialNumber: 'HACH-DR6000-01',
      notes: 'Aquisição FAPESP (AQ-002). Leitura UV-Vis 190 a 1100 nm.',
      maxMinutes: 480,
      requiresTraining: true,
    },
    {
      code: 'EQ-HACH-DRB200',
      name: 'Reator / Termo-Digestor Hach DRB200',
      searchKey: 'DRB200',
      assetTag: 'FAPESP-2018-003',
      serialNumber: 'HACH-DRB200-01',
      notes: 'Aquisição FAPESP (AQ-002). Bloco digestor para DQO, TOC e digestões térmicas.',
      maxMinutes: 360,
      requiresTraining: false,
    },
    {
      code: 'EQ-SHIMADZU-GC2030',
      name: 'Cromatógrafo Gasoso para Biogás Shimadzu GC-2030NS',
      searchKey: 'GC-2030NS',
      assetTag: 'FAPESP-2019-006',
      serialNumber: 'SHIMADZU-GC2030-01',
      notes: 'Aquisição FAPESP (AQ-005). Análise cromatográfica de biogás (CH4, CO2, H2S, N2, O2).',
      maxMinutes: 1440,
      requiresTraining: true,
    },
    {
      code: 'EQ-CITUA-BIO1',
      name: 'Biodigestor de 5 Litros Citua — Unidade 1',
      searchKey: 'Biodigestor de 5 litros',
      assetTag: 'FAPESP-2019-022',
      serialNumber: 'CITUA-BIO-01',
      notes: 'Aquisição FAPESP (AQ-032). Reator anaeróbio de bancada 5L.',
      maxMinutes: 4320,
      requiresTraining: false,
    },
    {
      code: 'EQ-CITUA-BIO2',
      name: 'Biodigestor de 5 Litros Citua — Unidade 2',
      searchKey: 'Biodigestor de 5 litros',
      assetTag: 'FAPESP-2019-023',
      serialNumber: 'CITUA-BIO-02',
      notes: 'Aquisição FAPESP (AQ-033). Reator anaeróbio de bancada 5L.',
      maxMinutes: 4320,
      requiresTraining: false,
    },
    {
      code: 'EQ-CITUA-ACR1',
      name: 'Reator em Acrílico com Camisa Externa Citua',
      searchKey: 'acrílico',
      assetTag: 'FAPESP-2019-024',
      serialNumber: 'CITUA-ACR-01',
      notes: 'Aquisição FAPESP (AQ-034). Reator encamisado com controle de temperatura.',
      maxMinutes: 4320,
      requiresTraining: false,
    },
    {
      code: 'EQ-CITUA-LOT-BIO5L',
      name: 'Conjunto de Reatores 5 Litros para Biomassa Citua',
      searchKey: 'Reatores para biomassa',
      assetTag: 'FAPESP-2019-035',
      serialNumber: 'CITUA-LOT-01',
      notes: 'Aquisição FAPESP (AQ-035/IT-026). Lote de reatores para digestão de biomassa.',
      maxMinutes: 4320,
      requiresTraining: false,
    },
    {
      code: 'EQ-LIMA-ANAER1',
      name: 'Reator Anaeróbio Encamisado M. Lima Engenharia',
      searchKey: 'anaeróbio confeccionado',
      assetTag: 'FAPESP-2022-025',
      serialNumber: 'LIMA-ANAER-01',
      notes: 'Aquisição FAPESP (AQ-039). Confeccionado sob projeto para digestão anaeróbia.',
      maxMinutes: 4320,
      requiresTraining: true,
    },
    {
      code: 'EQ-GERHARDT-VAP450',
      name: 'Destilador Automático Kjeldahl Gerhardt VAPODEST 450 Plus',
      searchKey: 'VAPODEST',
      assetTag: 'FAPESP-2021-007',
      serialNumber: 'GERHARDT-VAP450-01',
      notes: 'Aquisição FAPESP (AQ-006). Destilador Kjeldahl/NTK microprocessado.',
      maxMinutes: 480,
      requiresTraining: true,
    },
    {
      code: 'EQ-GERHARDT-KT8S',
      name: 'Bloco Digestor Kjeldahl Gerhardt KT 8S 230V',
      searchKey: 'KT 8S',
      assetTag: 'FAPESP-2021-008',
      serialNumber: 'GERHARDT-KT8S-01',
      notes: 'Aquisição FAPESP (AQ-006). Bloco digestor térmico de 8 provas.',
      maxMinutes: 360,
      requiresTraining: true,
    },
    {
      code: 'EQ-FRIGOBAR-01',
      name: 'Frigobar para Amostras e Reagentes Friovix',
      searchKey: 'Frigobar',
      assetTag: 'FAPESP-2019-004',
      serialNumber: 'FRIOVIX-01',
      notes: 'Aquisição FAPESP (AQ-003). Refrigeração de apoio laboratorial.',
      maxMinutes: 10080,
      requiresTraining: false,
    },
    {
      code: 'EQ-BOMBA-CENTRIFUGA-01',
      name: 'Bomba Centrífuga de Transferência',
      searchKey: 'Bomba',
      assetTag: 'FAPESP-2019-005',
      serialNumber: 'BOMBA-01',
      notes: 'Aquisição FAPESP (AQ-004).',
      maxMinutes: 240,
      requiresTraining: false,
    },
    // 2. CP2b Spatial Catalog Equipments
    {
      code: 'EQ-SHAKER-SL220',
      name: 'Incubadora Shaker com Agitação Orbital e Aquecimento Solab SL-220/E',
      searchKey: 'Incubadora Shaker',
      assetTag: 'CP2B-SHAKER-01',
      serialNumber: 'SOLAB-SL220-01',
      notes: 'Equipamento de bancada CP2b para cultivo e agitação termo-controlada.',
      maxMinutes: 1440,
      requiresTraining: true,
    },
    {
      code: 'EQ-ESTUFA-BIOEASY',
      name: 'Estufa de Secagem e Esterilização Bio Easy Digital 150 L',
      searchKey: 'Estufas 103',
      assetTag: 'CP2B-ESTUFA-01',
      serialNumber: 'BIOEASY-150L-01',
      notes: 'Estufa de secagem com circulação de ar para determinação de sólidos e umidade.',
      maxMinutes: 1440,
      requiresTraining: false,
    },
    {
      code: 'EQ-PHMETRO-KASVI',
      name: 'Medidor de pH de Bancada com ATC Kasvi',
      searchKey: 'Medidor de pH',
      assetTag: 'CP2B-PH-01',
      serialNumber: 'KASVI-PH-01',
      notes: 'pHmetro de bancada com eletrodo e compensação automática de temperatura.',
      maxMinutes: 240,
      requiresTraining: false,
    },
    {
      code: 'EQ-MOINHO-MA680',
      name: 'Moinho de Facas para Biomassa Marconi MA680/CF',
      searchKey: 'Moinho',
      assetTag: 'CP2B-MOINHO-01',
      serialNumber: 'MARCONI-MA680-01',
      notes: 'Moinho de facas com inversor de frequência para moagem e cominuição de biomassa vegetal.',
      maxMinutes: 360,
      requiresTraining: true,
    },
    {
      code: 'EQ-BALANCA-ANALITICA',
      name: 'Balança Analítica de Precisão ± 0,0001 g',
      searchKey: 'Balança analítica',
      assetTag: 'CP2B-BAL-01',
      serialNumber: 'BAL-ANALITICA-01',
      notes: 'Balança analítica com capela de proteção para pesagem de alta precisão.',
      maxMinutes: 120,
      requiresTraining: false,
    },
    {
      code: 'EQ-CENTRIFUGA-50ML',
      name: 'Centrífuga de Bancada para Tubos Falcon 50 mL',
      searchKey: 'Centrífuga de bancada',
      assetTag: 'CP2B-CENT-01',
      serialNumber: 'CENT-50ML-01',
      notes: 'Centrífuga de bancada para separação de fases e clarificação de digestato.',
      maxMinutes: 180,
      requiresTraining: false,
    },
    {
      code: 'EQ-BANHO-CIRCULACAO',
      name: 'Banho Termostático com Circulação Externa',
      searchKey: 'Banho termostático',
      assetTag: 'CP2B-BANHO-01',
      serialNumber: 'BANHO-CIRC-01',
      notes: 'Banho para termostatização de reatores encamisados.',
      maxMinutes: 1440,
      requiresTraining: false,
    },
    {
      code: 'EQ-AGITADOR-MAGNETICO',
      name: 'Agitador Magnético com Aquecimento e Chapa Aquecedora',
      searchKey: 'Agitador magnético',
      assetTag: 'CP2B-AGIT-01',
      serialNumber: 'AGIT-MAG-01',
      notes: 'Agitador magnético com controle térmico até 350°C.',
      maxMinutes: 480,
      requiresTraining: false,
    },
    {
      code: 'EQ-MEDIDOR-RITTER-TG05',
      name: 'Medidor de Vazão de Gás Ritter TG 05 Termoplástico',
      searchKey: 'Ritter',
      assetTag: 'CP2B-RITTER-01',
      serialNumber: 'RITTER-TG05-01',
      notes: 'Medidor volumétrico contínuo de fluxo de biogás.',
      maxMinutes: 4320,
      requiresTraining: false,
    },
  ];

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
