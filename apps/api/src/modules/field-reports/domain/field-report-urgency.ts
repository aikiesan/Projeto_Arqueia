/**
 * Triagem de urgência de um informe.
 *
 * Dois sinais, deliberadamente nesta ordem de confiança:
 *
 *   1. `blocksUse` — quem enviou marcou que o equipamento não pode ser usado.
 *      É um campo estruturado do formulário: não depende de a pessoa escolher
 *      a palavra certa, e não tem como errar a grafia.
 *   2. Palavra de emergência no texto. Útil, mas frágil: quem está diante de um
 *      acidente escreve com pressa, erra letra e repete tecla. Por isso a
 *      comparação normaliza antes (ver `normalizeForMatching`), e por isso
 *      sozinha ela não bastaria — uma capela parada descrita sem nenhuma destas
 *      palavras continua sendo emergência, e é o `blocksUse` que a pega.
 *
 * O que NÃO entra aqui: o tipo do informe. Um `EQUIPMENT_PROBLEM` comum é a
 * maioria dos envios; alertar por tipo transformaria o e-mail em rotina, e
 * alerta que chega sempre é alerta que ninguém lê.
 */

/**
 * Palavras que indicam risco a pessoas ou dano em curso. Lista curta de
 * propósito: cada termo aqui é um e-mail fora de hora para a coordenação.
 * Guardadas já normalizadas (sem acento, sem letra repetida).
 */
const EMERGENCY_KEYWORDS = [
  'urgente',
  'urgencia',
  'socorro',
  'emergencia',
  'acidente',
  'incendio',
  'fogo',
  'explosao',
  'explodiu',
  'vazamento',
  'vazando',
  'queimadura',
  'intoxicacao',
  'ferido',
  'ferimento',
  'feriu',
  'machucado',
  'machucou',
  'ambulancia',
  'bombeiros',
  'evacuar',
  'evacuacao',
] as const;

/**
 * Deixa o texto comparável: minúsculas, sem acento e com letras repetidas
 * reduzidas a uma só.
 *
 * O colapso de repetição é o que faz "SOCORRRO" e "URGENTEEE" baterem com
 * "socorro" e "urgente" — ambos viram "socoro" e "urgente". Sem isso, o erro
 * de digitação de quem está com pressa derruba justamente o alerta que mais
 * importa.
 */
export function normalizeForMatching(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(.)\1+/g, '$1');
}

export type UrgencyReason = 'blocks_use' | `keyword:${string}`;

export interface UrgencyAssessment {
  readonly urgent: boolean;
  /** Por que disparou. Vai para a auditoria e para o corpo do e-mail. */
  readonly reasons: readonly UrgencyReason[];
}

export function assessFieldReportUrgency(input: {
  readonly message: string;
  readonly blocksUse: boolean;
}): UrgencyAssessment {
  const reasons: UrgencyReason[] = [];
  if (input.blocksUse) reasons.push('blocks_use');

  const normalized = normalizeForMatching(input.message);
  for (const keyword of EMERGENCY_KEYWORDS) {
    // Palavra inteira: sem isto, "fogo" dispararia dentro de outras palavras.
    // O padrão é normalizado junto com o texto, mas o motivo guarda a grafia
    // correta: quem lê o alerta não deve ver "socoro" e achar que o erro de
    // digitação é nosso.
    if (new RegExp(`\\b${normalizeForMatching(keyword)}\\b`).test(normalized)) {
      reasons.push(`keyword:${keyword}`);
    }
  }

  return { urgent: reasons.length > 0, reasons };
}
