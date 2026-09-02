import { createHash } from 'node:crypto';

import type { CatalogOptionDetails } from '@arqueia/contracts';

import type { ReferenceCell } from './cp2b-workbook.js';
import { fapespReferenceWorkbook } from './fapesp-workbook.js';
import type { CatalogOptionSeed, CatalogSourceRowSeed, CP2bCatalogSeed } from './cp2b-catalog.js';

function text(value: ReferenceCell | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length === 0 ? null : normalized;
}

function number(value: ReferenceCell | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = text(value)?.replace(',', '.');
  if (normalized === undefined || normalized === null || !/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function compactDetails(
  entries: Readonly<Record<string, boolean | number | string | null | undefined>>,
): CatalogOptionDetails {
  const details: Record<string, boolean | number | string | null> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value !== null && value !== undefined && value !== '') details[key] = value;
  }
  return details;
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function optionKey(sheet: string, row: number, column: string, suffix = ''): string {
  return `${normalizeKey(sheet)}:${row}:${column.toLowerCase()}${suffix ? `:${suffix}` : ''}`;
}

function sourceRows(): readonly CatalogSourceRowSeed[] {
  return fapespReferenceWorkbook.sheets.flatMap((sheet) =>
    sheet.rows.map((row) => ({
      sheetName: sheet.name,
      rowNumber: row.rowNumber,
      values: row.values,
      contentSha256: createHash('sha256').update(JSON.stringify(row.values)).digest('hex'),
    })),
  );
}

export function buildFapespCatalog(): CP2bCatalogSeed {
  const options: CatalogOptionSeed[] = [];
  const equipmentTypeByLabel = new Map<string, string>();

  // 1. Process Inventario sheet
  const invSheet = fapespReferenceWorkbook.sheets.find((s) => s.name === 'Inventario');
  if (invSheet !== undefined) {
    for (const row of invSheet.rows.filter((r) => r.rowNumber >= 2)) {
      const idItem = text(row.values[0]);
      const idAquisicao = text(row.values[1]);
      const ano = number(row.values[2]);
      const itemNome = text(row.values[3]);
      const categoria = text(row.values[4]);
      const subcategoria = text(row.values[5]);
      const marca = text(row.values[6]);
      const modelo = text(row.values[7]);
      const codigoRef = text(row.values[8]);
      const quantidade = number(row.values[9]);
      const unidade = text(row.values[10]);
      const qtdContabilizavel = number(row.values[11]);
      const moeda = text(row.values[12]);
      const valorUnitarioRef = number(row.values[13]);
      const valorUnitarioBrl = number(row.values[14]);
      const valorTotalBrl = number(row.values[15]);
      const situacao = text(row.values[16]);
      const nivelEvidencia = text(row.values[17]);
      const documentos = text(row.values[18]);

      if (itemNome === null || categoria === null) continue;

      const isEquipment =
        categoria.toLowerCase().includes('equipamento') ||
        categoria.toLowerCase().includes('sistema experimental') ||
        categoria.toLowerCase().includes('componente');

      const isSoftware = categoria.toLowerCase().includes('software');
      const isReagent = subcategoria?.toLowerCase().includes('reagente') || subcategoria?.toLowerCase().includes('nanomaterial');

      if (isEquipment) {
        // Equipment Type
        const typeLabel = subcategoria ?? itemNome;
        let typeKey = equipmentTypeByLabel.get(normalizeKey(typeLabel));
        if (!typeKey) {
          typeKey = optionKey(invSheet.name, row.rowNumber, 'F', 'type');
          equipmentTypeByLabel.set(normalizeKey(typeLabel), typeKey);
          options.push({
            optionKey: typeKey,
            parentOptionKey: null,
            kind: 'EQUIPMENT_TYPE',
            code: idItem,
            label: typeLabel,
            category: categoria,
            description: itemNome,
            details: compactDetails({
              sourceItem: idItem,
              category: categoria,
              subcategory: subcategoria,
            }),
            sourceSheet: invSheet.name,
            sourceRow: row.rowNumber,
            sourceColumn: 'F',
            isSelectable: true,
          });
        }

        // Equipment Model
        const modelLabel = modelo ? `${marca ? `${marca} ` : ''}${modelo}` : itemNome;
        options.push({
          optionKey: optionKey(invSheet.name, row.rowNumber, 'D', 'model'),
          parentOptionKey: typeKey,
          kind: 'EQUIPMENT_MODEL',
          code: codigoRef ?? idItem,
          label: modelLabel,
          category: typeLabel,
          description: itemNome,
          details: compactDetails({
            idItem,
            idAquisicao,
            ano,
            brand: marca,
            model: modelo,
            referenceCode: codigoRef,
            quantity: quantidade,
            unit: unidade,
            accountableQuantity: qtdContabilizavel,
            currency: moeda,
            unitPrice: valorUnitarioBrl ?? valorUnitarioRef,
            totalPriceBrl: valorTotalBrl,
            status: situacao,
            evidenceLevel: nivelEvidencia,
            documents: documentos,
          }),
          sourceSheet: invSheet.name,
          sourceRow: row.rowNumber,
          sourceColumn: 'D',
          isSelectable: true,
        });
      } else if (isReagent) {
        options.push({
          optionKey: optionKey(invSheet.name, row.rowNumber, 'D', 'reagent'),
          parentOptionKey: null,
          kind: 'REAGENT',
          code: codigoRef ?? idItem,
          label: itemNome,
          category: subcategoria ?? categoria,
          description: marca ? `Fabricante: ${marca}` : null,
          details: compactDetails({
            idItem,
            idAquisicao,
            ano,
            brand: marca,
            referenceCode: codigoRef,
            quantity: quantidade,
            unit: unidade,
            unitPriceBrl: valorUnitarioBrl,
            totalPriceBrl: valorTotalBrl,
            status: situacao,
            evidenceLevel: nivelEvidencia,
          }),
          sourceSheet: invSheet.name,
          sourceRow: row.rowNumber,
          sourceColumn: 'D',
          isSelectable: true,
        });
      } else if (isSoftware) {
        options.push({
          optionKey: optionKey(invSheet.name, row.rowNumber, 'D', 'software'),
          parentOptionKey: null,
          kind: 'PLANNING_ASSUMPTION',
          code: idItem,
          label: itemNome,
          category: 'Software e Ativo Intangível',
          description: modelo,
          details: compactDetails({
            idItem,
            idAquisicao,
            ano,
            brand: marca,
            model: modelo,
            totalPriceBrl: valorTotalBrl,
            status: situacao,
          }),
          sourceSheet: invSheet.name,
          sourceRow: row.rowNumber,
          sourceColumn: 'D',
          isSelectable: false,
        });
      } else {
        // Material de consumo
        options.push({
          optionKey: optionKey(invSheet.name, row.rowNumber, 'D', 'material'),
          parentOptionKey: null,
          kind: 'MATERIAL',
          code: codigoRef ?? idItem,
          label: itemNome,
          category: subcategoria ?? categoria,
          description: marca ? `Marca/Fabricante: ${marca}` : null,
          details: compactDetails({
            idItem,
            idAquisicao,
            ano,
            brand: marca,
            model: modelo,
            referenceCode: codigoRef,
            quantity: quantidade,
            unit: unidade,
            unitPriceBrl: valorUnitarioBrl,
            totalPriceBrl: valorTotalBrl,
            status: situacao,
          }),
          sourceSheet: invSheet.name,
          sourceRow: row.rowNumber,
          sourceColumn: 'D',
          isSelectable: true,
        });
      }
    }
  }

  // 2. Process Propostas sheet
  const propSheet = fapespReferenceWorkbook.sheets.find((s) => s.name === 'Propostas');
  if (propSheet !== undefined) {
    for (const row of propSheet.rows.filter((r) => r.rowNumber >= 2)) {
      const idProp = text(row.values[0]);
      const ano = number(row.values[1]);
      const desc = text(row.values[2]);
      const valor = number(row.values[3]);
      const situacao = text(row.values[4]);
      const doc = text(row.values[5]);
      const obs = text(row.values[6]);

      if (idProp === null || desc === null) continue;

      options.push({
        optionKey: optionKey(propSheet.name, row.rowNumber, 'A', 'proposal'),
        parentOptionKey: null,
        kind: 'PLANNING_ASSUMPTION',
        code: idProp,
        label: desc,
        category: 'Proposta / Orçamento FAPESP',
        description: obs,
        details: compactDetails({
          idProposal: idProp,
          year: ano,
          proposedValueBrl: valor,
          status: situacao,
          document: doc,
          notes: obs,
        }),
        sourceSheet: propSheet.name,
        sourceRow: row.rowNumber,
        sourceColumn: 'A',
        isSelectable: false,
      });
    }
  }

  // 3. Process Servicos sheet
  const srvSheet = fapespReferenceWorkbook.sheets.find((s) => s.name === 'Servicos');
  if (srvSheet !== undefined) {
    for (const row of srvSheet.rows.filter((r) => r.rowNumber >= 2)) {
      const idAq = text(row.values[0]);
      const ano = number(row.values[1]);
      const dataRef = text(row.values[2]);
      const desc = text(row.values[3]);
      const fornecedor = text(row.values[4]);
      const cnpj = text(row.values[5]);
      const valor = number(row.values[6]);
      const statusValor = text(row.values[7]);
      const statusExecucao = text(row.values[8]);
      const docs = text(row.values[9]);
      const obs = text(row.values[10]);

      if (idAq === null || desc === null) continue;

      options.push({
        optionKey: optionKey(srvSheet.name, row.rowNumber, 'A', 'service'),
        parentOptionKey: null,
        kind: 'PLANNING_ASSUMPTION',
        code: idAq,
        label: desc,
        category: 'Serviço e Manutenção FAPESP',
        description: obs,
        details: compactDetails({
          idAquisicao: idAq,
          year: ano,
          referenceDate: dataRef,
          supplier: fornecedor,
          cnpj,
          valueBrl: valor,
          valueStatus: statusValor,
          executionStatus: statusExecucao,
          documents: docs,
          notes: obs,
        }),
        sourceSheet: srvSheet.name,
        sourceRow: row.rowNumber,
        sourceColumn: 'A',
        isSelectable: false,
      });
    }
  }

  // 4. Process Cambio_Historico sheet
  const fxSheet = fapespReferenceWorkbook.sheets.find((s) => s.name === 'Cambio_Historico');
  if (fxSheet !== undefined) {
    for (const row of fxSheet.rows.filter((r) => r.rowNumber >= 2)) {
      const idFx = text(row.values[0]);
      const dataFx = text(row.values[1]);
      const moeda = text(row.values[2]);
      const brlPorUsd = number(row.values[3]);
      const fonte = text(row.values[4]);
      const tipoFonte = text(row.values[5]);
      const uso = text(row.values[6]);
      const obs = text(row.values[7]);

      if (idFx === null) continue;

      options.push({
        optionKey: optionKey(fxSheet.name, row.rowNumber, 'A', 'fx'),
        parentOptionKey: null,
        kind: 'PLANNING_ASSUMPTION',
        code: idFx,
        label: `Câmbio ${moeda} ${dataFx ?? ''}: R$ ${brlPorUsd}`,
        category: 'Câmbio Histórico FAPESP',
        description: obs,
        details: compactDetails({
          idExchange: idFx,
          date: dataFx,
          currency: moeda,
          brlPerUsd: brlPorUsd,
          source: fonte,
          sourceType: tipoFonte,
          usage: uso,
          notes: obs,
        }),
        sourceSheet: fxSheet.name,
        sourceRow: row.rowNumber,
        sourceColumn: 'A',
        isSelectable: false,
      });
    }
  }

  const duplicateKeys = options
    .map(({ optionKey: key }) => key)
    .filter((key, index, keys) => keys.indexOf(key) !== index);
  if (duplicateKeys.length > 0) {
    throw new Error(`Chaves duplicadas no catálogo FAPESP: ${duplicateKeys.join(', ')}`);
  }

  return { source: fapespReferenceWorkbook.source, rows: sourceRows(), options };
}
