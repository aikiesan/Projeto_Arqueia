import { createHash } from 'node:crypto';

import type { CatalogOptionDetails, CatalogOptionKind } from '@arqueia/contracts';

import { cp2bReferenceWorkbook, type ReferenceCell } from './cp2b-workbook.js';

export interface CatalogSourceRowSeed {
  readonly sheetName: string;
  readonly rowNumber: number;
  readonly values: readonly ReferenceCell[];
  readonly contentSha256: string;
}

export interface CatalogOptionSeed {
  readonly optionKey: string;
  readonly parentOptionKey: string | null;
  readonly kind: CatalogOptionKind;
  readonly code: string | null;
  readonly label: string;
  readonly category: string | null;
  readonly description: string | null;
  readonly details: CatalogOptionDetails;
  readonly sourceSheet: string;
  readonly sourceRow: number;
  readonly sourceColumn: string | null;
  readonly isSelectable: boolean;
}

export interface CP2bCatalogSeed {
  readonly source: typeof cp2bReferenceWorkbook.source;
  readonly rows: readonly CatalogSourceRowSeed[];
  readonly options: readonly CatalogOptionSeed[];
}

const columnNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

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

function sanitizeReferenceUrl(value: ReferenceCell | undefined): string | null {
  const candidate = text(value);
  if (candidate === null) return null;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function sourceRows(): readonly CatalogSourceRowSeed[] {
  return cp2bReferenceWorkbook.sheets.flatMap((sheet) =>
    sheet.rows.map((row) => ({
      sheetName: sheet.name,
      rowNumber: row.rowNumber,
      values: row.values,
      contentSha256: createHash('sha256').update(JSON.stringify(row.values)).digest('hex'),
    })),
  );
}

function buildReagentOptions(): CatalogOptionSeed[] {
  const sheet = cp2bReferenceWorkbook.sheets.find(({ name }) => name === 'Reagentes');
  if (sheet === undefined) return [];

  return sheet.rows.flatMap((row) => {
    const label = text(row.values[0]);
    if (row.rowNumber < 3 || label === null) return [];
    return [
      {
        optionKey: optionKey(sheet.name, row.rowNumber, 'A'),
        parentOptionKey: null,
        kind: 'REAGENT' as const,
        code: null,
        label,
        category: 'Reagente de laboratório',
        description: null,
        details: compactDetails({ sourceText: label }),
        sourceSheet: sheet.name,
        sourceRow: row.rowNumber,
        sourceColumn: 'A',
        isSelectable: true,
      },
    ];
  });
}

function buildEquipmentOptions(): CatalogOptionSeed[] {
  const equipmentSheet = cp2bReferenceWorkbook.sheets.find(({ name }) => name === 'Equipamentos');
  const demandSheet = cp2bReferenceWorkbook.sheets.find(
    ({ name }) => name === 'Demanda Elétrica e de CalorEqui',
  );
  if (equipmentSheet === undefined || demandSheet === undefined) return [];

  const options: CatalogOptionSeed[] = [];
  const equipmentTypeByLabel = new Map<string, string>();
  const headers = equipmentSheet.rows.find(({ rowNumber }) => rowNumber === 2)?.values ?? [];

  for (const row of equipmentSheet.rows.filter(({ rowNumber }) => rowNumber >= 3)) {
    row.values.forEach((value, columnIndex) => {
      const label = text(value);
      if (label === null) return;
      const column = columnNames[columnIndex] ?? String(columnIndex + 1);
      const category = text(headers[columnIndex]);
      const kind: CatalogOptionKind = columnIndex === 0 ? 'MATERIAL' : 'EQUIPMENT_TYPE';
      const key = optionKey(equipmentSheet.name, row.rowNumber, column);
      options.push({
        optionKey: key,
        parentOptionKey: null,
        kind,
        code: null,
        label,
        category,
        description: null,
        details: compactDetails({ sourceCategory: category }),
        sourceSheet: equipmentSheet.name,
        sourceRow: row.rowNumber,
        sourceColumn: column,
        isSelectable: true,
      });
      if (kind === 'EQUIPMENT_TYPE' && !equipmentTypeByLabel.has(normalizeKey(label))) {
        equipmentTypeByLabel.set(normalizeKey(label), key);
      }
    });
  }

  let currentEquipmentLabel: string | null = null;
  let currentParentKey: string | null = null;

  for (const row of demandSheet.rows) {
    if (row.rowNumber >= 2 && row.rowNumber <= 43) {
      const explicitEquipment = text(row.values[0]);
      if (explicitEquipment !== null) {
        currentEquipmentLabel = explicitEquipment;
        currentParentKey = equipmentTypeByLabel.get(normalizeKey(explicitEquipment)) ?? null;
        if (currentParentKey === null) {
          currentParentKey = optionKey(demandSheet.name, row.rowNumber, 'A', 'type');
          equipmentTypeByLabel.set(normalizeKey(explicitEquipment), currentParentKey);
          options.push({
            optionKey: currentParentKey,
            parentOptionKey: null,
            kind: 'EQUIPMENT_TYPE',
            code: null,
            label: explicitEquipment,
            category: 'Equipamento pesquisado',
            description: null,
            details: {},
            sourceSheet: demandSheet.name,
            sourceRow: row.rowNumber,
            sourceColumn: 'A',
            isSelectable: true,
          });
        }
      }

      const model = text(row.values[1]);
      if (model !== null && currentEquipmentLabel !== null && currentParentKey !== null) {
        const powerValue = row.values[3];
        options.push({
          optionKey: optionKey(demandSheet.name, row.rowNumber, 'B', 'model'),
          parentOptionKey: currentParentKey,
          kind: 'EQUIPMENT_MODEL',
          code: null,
          label: model,
          category: currentEquipmentLabel,
          description: null,
          details: compactDetails({
            equipmentType: currentEquipmentLabel,
            voltage: text(row.values[2]),
            powerWatts: typeof powerValue === 'number' ? powerValue : null,
            powerRange: typeof powerValue === 'string' ? text(powerValue) : null,
            temperatureRangeCelsius: text(row.values[4]),
            referenceUrl: sanitizeReferenceUrl(row.values[5]),
          }),
          sourceSheet: demandSheet.name,
          sourceRow: row.rowNumber,
          sourceColumn: 'B',
          isSelectable: true,
        });
      }
      continue;
    }

    const label = text(row.values[0]);
    if (label === null) continue;
    options.push({
      optionKey: optionKey(demandSheet.name, row.rowNumber, 'A', 'planning'),
      parentOptionKey: null,
      kind: 'PLANNING_ASSUMPTION',
      code: null,
      label,
      category: 'Demanda elétrica e térmica',
      description: null,
      details: compactDetails({
        value: text(row.values[1]),
        rangeOrVoltage: text(row.values[2]),
        notes: text(row.values[3]),
      }),
      sourceSheet: demandSheet.name,
      sourceRow: row.rowNumber,
      sourceColumn: 'A',
      isSelectable: false,
    });
  }

  return options;
}

function buildSpaceOptions(): CatalogOptionSeed[] {
  const sheet = cp2bReferenceWorkbook.sheets.find(({ name }) => name === 'Quadro de Áreas');
  if (sheet === undefined) return [];
  const options: CatalogOptionSeed[] = [];
  let floorKey: string | null = null;
  let floorLabel: string | null = null;

  for (const row of sheet.rows) {
    const label = text(row.values[0]);
    if (label === null) continue;
    if (text(row.values[1]) === null && text(row.values[2]) === null) {
      floorLabel = label;
      floorKey = optionKey(sheet.name, row.rowNumber, 'A', 'floor');
      options.push({
        optionKey: floorKey,
        parentOptionKey: null,
        kind: 'SPACE',
        code: null,
        label,
        category: 'Pavimento',
        description: null,
        details: compactDetails({ level: label }),
        sourceSheet: sheet.name,
        sourceRow: row.rowNumber,
        sourceColumn: 'A',
        isSelectable: true,
      });
      continue;
    }
    if (label === 'Ambiente') continue;

    options.push({
      optionKey: optionKey(sheet.name, row.rowNumber, 'A', 'space'),
      parentOptionKey: floorKey,
      kind: 'SPACE',
      code: null,
      label,
      category: floorLabel,
      description: null,
      details: compactDetails({
        floor: floorLabel,
        areaSquareMeters: number(row.values[1]),
        dimensionsMeters: text(row.values[2]),
      }),
      sourceSheet: sheet.name,
      sourceRow: row.rowNumber,
      sourceColumn: 'A',
      isSelectable: true,
    });
  }
  return options;
}

function buildBenchOptions(): CatalogOptionSeed[] {
  const sheet = cp2bReferenceWorkbook.sheets.find(({ name }) => name === 'Estimativa Bancadas');
  if (sheet === undefined) return [];
  const options: CatalogOptionSeed[] = [];
  let currentSection: string | null = null;

  for (const row of sheet.rows) {
    const first = text(row.values[0]);
    if (first === null) continue;

    if (row.rowNumber >= 3 && row.rowNumber <= 15) {
      const bench = text(row.values[2]);
      if (bench === null) continue;
      options.push({
        optionKey: optionKey(sheet.name, row.rowNumber, 'C', 'bench'),
        parentOptionKey: null,
        kind: 'BENCH',
        code: null,
        label: `${first} — ${bench}`,
        category: first,
        description: text(row.values[13]),
        details: compactDetails({
          laboratory: first,
          areaSquareMeters: number(row.values[1]),
          bench,
          type: text(row.values[3]),
          lengthMeters: number(row.values[4]),
          lengthText: typeof row.values[4] === 'string' ? text(row.values[4]) : null,
          widthMeters: number(row.values[5]),
          format: text(row.values[6]),
          water: text(row.values[7]),
          outlets: text(row.values[8]),
          drawers: text(row.values[9]),
          cabinets: text(row.values[10]),
          gas: text(row.values[11]),
          chairs: text(row.values[12]),
        }),
        sourceSheet: sheet.name,
        sourceRow: row.rowNumber,
        sourceColumn: 'C',
        isSelectable: true,
      });
      continue;
    }

    if (row.rowNumber === 40 || row.rowNumber === 45 || row.rowNumber === 50) {
      currentSection = first;
      continue;
    }

    if (currentSection !== null && (/^Bancada \d/.test(first) || first === 'Capela')) {
      options.push({
        optionKey: optionKey(sheet.name, row.rowNumber, 'A', 'bench'),
        parentOptionKey: null,
        kind: 'BENCH',
        code: null,
        label: `${currentSection} — ${first}`,
        category: currentSection,
        description: null,
        details: compactDetails({
          laboratory: currentSection,
          bench: first,
          dimensionsMeters: text(row.values[1]),
          areaSquareMeters: number(row.values[2]),
          cabinetModules: text(row.values[3]),
          drawerModules: text(row.values[4]),
          water: text(row.values[5]),
        }),
        sourceSheet: sheet.name,
        sourceRow: row.rowNumber,
        sourceColumn: 'A',
        isSelectable: true,
      });
      continue;
    }

    const isHeader = first === 'LABORATÓRIO' || first === 'BANCADA' || first.startsWith('TABELA ');
    if (!isHeader) {
      options.push({
        optionKey: optionKey(sheet.name, row.rowNumber, 'A', 'planning'),
        parentOptionKey: null,
        kind: 'PLANNING_ASSUMPTION',
        code: null,
        label: first,
        category: 'Bancadas e infraestrutura',
        description: null,
        details: compactDetails({
          value: text(row.values[1]),
          secondaryValue: text(row.values[2]),
          notes: text(row.values[3]),
        }),
        sourceSheet: sheet.name,
        sourceRow: row.rowNumber,
        sourceColumn: 'A',
        isSelectable: false,
      });
    }
  }
  return options;
}

function buildFurnitureOptions(): CatalogOptionSeed[] {
  const sheet = cp2bReferenceWorkbook.sheets.find(({ name }) => name === 'Levantamento Mobiliário');
  if (sheet === undefined) return [];
  const options: CatalogOptionSeed[] = [];
  let areaGroup = 'Mobiliário CP2b';
  let itemGroup: string | null = null;

  for (const row of sheet.rows) {
    const label = text(row.values[0]);
    if (label === null) continue;
    const remaining = row.values.slice(1).filter((value) => text(value) !== null);

    if ([1, 15, 29, 49, 70].includes(row.rowNumber)) {
      areaGroup = label;
      itemGroup = null;
      continue;
    }
    if (label === 'Item') continue;
    if (remaining.length === 0) {
      itemGroup = label;
      continue;
    }

    options.push({
      optionKey: optionKey(sheet.name, row.rowNumber, 'A', 'furniture'),
      parentOptionKey: null,
      kind: 'FURNITURE',
      code: null,
      label,
      category: itemGroup ?? areaGroup,
      description: text(row.values[4]),
      details: compactDetails({
        areaGroup,
        itemGroup,
        layoutReference: text(row.values[1]),
        quantityPrimary: text(row.values[2]),
        quantitySecondary: text(row.values[3]),
        dimensions: text(row.values[5]),
        observations: text(row.values[6]),
      }),
      sourceSheet: sheet.name,
      sourceRow: row.rowNumber,
      sourceColumn: 'A',
      isSelectable: true,
    });
  }
  return options;
}

export function buildCP2bReferenceCatalog(): CP2bCatalogSeed {
  const options = [
    ...buildReagentOptions(),
    ...buildEquipmentOptions(),
    ...buildSpaceOptions(),
    ...buildBenchOptions(),
    ...buildFurnitureOptions(),
  ];

  const duplicateKeys = options
    .map(({ optionKey: key }) => key)
    .filter((key, index, keys) => keys.indexOf(key) !== index);
  if (duplicateKeys.length > 0) {
    throw new Error(`Chaves duplicadas no catálogo CP2b: ${duplicateKeys.join(', ')}`);
  }

  return { source: cp2bReferenceWorkbook.source, rows: sourceRows(), options };
}
