import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Regressões de layout mobile da agenda.
 *
 * A página era montada com estilos embutidos dimensionados para desktop: o
 * `<select>` de equipamentos crescia até o nome mais longo e empurrava a linha
 * para fora da viewport do celular, a caixa de seleção herdava `width: 100%` +
 * `min-height: 48px` das regras de campo e virava um retângulo gigante, e
 * vários modifiers usados pelos componentes nunca tiveram regra CSS. Como o
 * defeito é de folha de estilo, é nela que o teste olha.
 */
const readSource = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

const globalCss = readSource('../globals.css');
const shellCss = readSource('../../../../packages/ui/src/styles.css');
const agendaClient = readSource('./agenda-page-client.tsx');
const dayView = readSource('../components/scheduling/schedule-day-view.tsx');

/** Coleta os nomes de classe escritos literalmente no JSX. */
function classNamesUsedIn(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const literal = (match[1] ?? match[2] ?? '')
      // Trechos interpolados (`${...}`) não têm nome fixo para conferir.
      .replace(/\$\{[^}]*\}/g, ' ');
    for (const token of literal.split(/\s+/)) {
      if (/^[a-z][a-z0-9-]*$/.test(token)) names.add(token);
    }
  }
  return names;
}

describe('Agenda — layout mobile', () => {
  it('não devolve dimensões de campo de texto às caixas de seleção', () => {
    const fieldRule = globalCss.slice(
      globalCss.indexOf('.equipment-form input'),
      globalCss.indexOf('.equipment-form input') + 900,
    );

    expect(fieldRule).toContain(".equipment-form input:not([type='checkbox']):not([type='radio'])");
    expect(globalCss).toMatch(
      /\.equipment-form input\[type='checkbox'\][\s\S]{0,400}?appearance: auto/,
    );
  });

  it('mantém a caixa de seleção pequena e visível no iOS', () => {
    const checkboxRule = globalCss.slice(
      globalCss.indexOf(".login-form input[type='checkbox']"),
      globalCss.indexOf(".login-form input[type='radio'],\n.equipment-form input[type='radio']"),
    );

    expect(checkboxRule).toContain('width: 22px');
    expect(checkboxRule).toContain('height: 22px');
    expect(checkboxRule).toContain('min-height: 0');
    // `-webkit-appearance: none` apagaria o desenho nativo do marcador no iOS.
    expect(checkboxRule).not.toContain('appearance: none');
  });

  it('impede que o seletor de equipamentos estique a linha além da tela', () => {
    const selectRule = globalCss.slice(
      globalCss.indexOf('.agenda-filter-select select'),
      globalCss.indexOf('.agenda-filter-select select:focus-visible'),
    );

    expect(selectRule).toContain('max-width: 100%');
    expect(selectRule).toContain('min-width: 0');
    // 16px é o limiar abaixo do qual o Safari iOS dá zoom ao focar o campo.
    expect(selectRule).toContain('font-size: 16px');
  });

  it('empilha a barra de controle no celular e só volta a ser linha em tela larga', () => {
    const barRule = globalCss.slice(
      globalCss.indexOf('.agenda-control-bar {'),
      globalCss.indexOf('.agenda-filter-group {'),
    );

    expect(barRule).toContain('flex-direction: column');
    expect(globalCss).toMatch(
      /@media \(min-width: 720px\) \{[\s\S]*?\.agenda-control-bar \{[\s\S]*?flex-direction: row/,
    );
  });

  it('não reintroduz estilos embutidos na página de agenda', () => {
    expect(agendaClient).not.toContain('style={{');
  });

  it('deixa a largura das raias do dia a cargo do CSS', () => {
    expect(dayView).not.toContain('minmax(220px');
    expect(globalCss).toContain('--schedule-lane-width: 150px');
    expect(globalCss).toMatch(
      /@media \(min-width: 600px\) \{[\s\S]*?--schedule-lane-width: 220px/,
    );
  });

  it('reserva espaço para o entalhe e o indicador de home do iOS', () => {
    expect(shellCss).toContain('padding-top: max(0.6rem, env(safe-area-inset-top))');
    expect(shellCss).toContain('calc(7rem + env(safe-area-inset-bottom))');
  });

  it('define todas as classes que a agenda e seus componentes usam', () => {
    const used = new Set([
      ...classNamesUsedIn(agendaClient),
      ...classNamesUsedIn(dayView),
      ...classNamesUsedIn(readSource('../components/scheduling/schedule-event-card.tsx')),
      ...classNamesUsedIn(readSource('../components/scheduling/schedule-details-drawer.tsx')),
      ...classNamesUsedIn(readSource('../components/scheduling/schedule-header.tsx')),
      ...classNamesUsedIn(readSource('../components/scheduling/schedule-week-view.tsx')),
      ...classNamesUsedIn(readSource('../components/scheduling/schedule-legend.tsx')),
      ...classNamesUsedIn(readSource('../components/scheduling/schedule-equipment-tabs.tsx')),
      ...classNamesUsedIn(readSource('../components/scheduling/schedule-state-feedback.tsx')),
    ]);

    const stylesheets = `${globalCss}\n${shellCss}`;
    const missing = [...used].filter((name) => !stylesheets.includes(`.${name}`));

    expect(missing).toEqual([]);
  });
});
