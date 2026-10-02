/**
 * Boas práticas de laboratório — resumo para consulta rápida no Arqueia.
 *
 * Texto próprio, em forma de checklist, BASEADO no guia da Gerência Técnica
 * dos LIMs do HC-FMUSP (2015). O PDF original não é hospedado aqui: o botão
 * de download aponta para o endereço oficial, e a fonte aparece em toda tela
 * que mostra este conteúdo.
 *
 * Duas escolhas deliberadas:
 *   - Os telefones do guia original (CEATOX, SESMT e bombeiros da FMUSP) são
 *     de São Paulo e NÃO aparecem: numa emergência no CP2b, levariam a pessoa
 *     a ligar para o lugar errado. No lugar deles entram os contatos da
 *     Unicamp informados pela coordenação do CP2b (`UNICAMP_EMERGENCY_CONTACTS`)
 *     e os números nacionais.
 *   - Concentrações que dependem do produto e do procedimento (ex.:
 *     hipoclorito) remetem ao POP do laboratório em vez de fixar um número.
 */

export const GOOD_PRACTICES_SOURCE = {
  title: 'Guia de Boas Práticas Laboratoriais',
  publisher: 'Gerência Técnica dos Laboratórios de Investigação Médica (LIM) — HC-FMUSP',
  year: 2015,
  url: 'https://limhc.fm.usp.br/portal/wp-content/uploads/2015/11/Manual_Guia_de_Boas_Praticas.pdf',
} as const;

export interface ChecklistGroup {
  readonly title?: string;
  readonly items: readonly string[];
}

export interface ChecklistSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly groups: readonly ChecklistGroup[];
}

/** O essencial do dia a dia: fica sempre aberto no topo da página. */
export const ESSENTIAL_SECTIONS: readonly ChecklistSection[] = [
  {
    id: 'antes-de-entrar',
    title: 'Antes de entrar',
    summary: 'O que vestir e o que deixar do lado de fora.',
    groups: [
      {
        items: [
          'Use sapato fechado.',
          'Prenda o cabelo e mantenha as unhas curtas e limpas.',
          'Tire colares, anéis, pulseiras, brincos e piercings.',
          'Vista jaleco de manga longa — e use o jaleco só dentro do laboratório.',
          'Guarde bolsa, mochila e objetos pessoais no armário, nunca na bancada.',
          'Prefira óculos às lentes de contato. Se usar lentes, não as manipule no laboratório e use óculos de proteção.',
          'Saiba onde ficam o chuveiro de emergência, o lava-olhos, os extintores e o kit de derramamento.',
        ],
      },
    ],
  },
  {
    id: 'durante-o-trabalho',
    title: 'Durante o trabalho',
    summary: 'Hábitos que evitam a maior parte dos acidentes.',
    groups: [
      {
        items: [
          'Lave as mãos antes e depois de cada experimento. Luva não substitui a lavagem.',
          'Não coma, não beba, não prepare alimentos e não use cosméticos no laboratório.',
          'Evite levar as mãos à boca, ao nariz, aos olhos, aos ouvidos e ao cabelo.',
          'Nunca pipete com a boca: use pipetador automático, manual ou pera.',
          'Use luvas ao manipular material potencialmente infectante ou produto químico — e tire-as antes de tocar maçanetas, telefone e teclados de uso comum.',
          'Não use o celular dentro do laboratório.',
          'Mantenha a bancada organizada e evite carregar material químico ou biológico de um lado para o outro.',
          'Use a cabine de segurança biológica (ou a capela, para químicos) sempre que o procedimento pedir.',
          'Conheça os perigos de cada produto que usa: consulte a FISPQ, que deve estar em local visível.',
          'Equipamentos de risco — autoclave, nitrogênio líquido, cilindros de gás — só com treinamento.',
          'Evite trabalhar sozinho no laboratório.',
        ],
      },
    ],
  },
];

export interface RiskType {
  readonly id: string;
  readonly name: string;
  /** Cor do mapa de risco (NR-5), usada como marcador visual. */
  readonly mapColor: string;
  readonly mapColorName: string;
  readonly description: string;
  readonly examples: string;
}

export const RISK_TYPES: readonly RiskType[] = [
  {
    id: 'fisico',
    name: 'Físicos',
    mapColor: '#2e7d32',
    mapColorName: 'verde',
    description: 'Formas de energia às quais você pode ficar exposto.',
    examples: 'Ruído, vibração, pressão, radiação ionizante e não ionizante (UV, laser, micro-ondas), temperaturas extremas.',
  },
  {
    id: 'quimico',
    name: 'Químicos',
    mapColor: '#c62828',
    mapColorName: 'vermelho',
    description: 'Substâncias que entram no corpo pela pele, pela respiração ou pela boca.',
    examples: 'Irritantes, oxidantes, corrosivos, inflamáveis, poeiras, gases, fumos e névoas.',
  },
  {
    id: 'biologico',
    name: 'Biológicos',
    mapColor: '#6d4c41',
    mapColorName: 'marrom',
    description: 'Microrganismos e material de origem biológica.',
    examples: 'Bactérias, fungos, vírus, parasitas e amostras que possam contê-los.',
  },
  {
    id: 'ergonomico',
    name: 'Ergonômicos',
    mapColor: '#f9a825',
    mapColorName: 'amarelo',
    description: 'O que causa desconforto ou afeta a saúde no jeito de trabalhar.',
    examples: 'Movimentos repetitivos, postura inadequada, peso excessivo, mobiliário ruim, ambiente muito quente, frio, seco, escuro ou barulhento.',
  },
  {
    id: 'acidente',
    name: 'De acidentes',
    mapColor: '#1565c0',
    mapColorName: 'azul',
    description: 'Situações imprevistas que põem a integridade física em perigo.',
    examples: 'Máquinas sem proteção, vidraria, perfurocortantes, armazenamento inadequado, cilindros de gás.',
  },
];

export const BIOSAFETY_LEVELS: readonly { readonly level: string; readonly description: string }[] = [
  { level: 'Classe I · NB-1', description: 'Baixo risco individual e para a comunidade. Laboratório de ensino básico, com EPI.' },
  { level: 'Classe II · NB-2', description: 'Pode causar infecção, mas há tratamento eficaz. Exige EPI e cabine de segurança biológica.' },
  { level: 'Classe III · NB-3', description: 'Doença grave e transmissível, com profilaxia. Instalações inspecionadas e treinamento específico.' },
  { level: 'Classe IV · NB-4', description: 'Grande ameaça, sem profilaxia nem tratamento. Unidade isolada com procedimentos especiais.' },
];

export interface ProtectionItem {
  readonly name: string;
  readonly detail: string;
}

export const PERSONAL_PROTECTION: readonly ProtectionItem[] = [
  { name: 'Jaleco', detail: 'Manga longa, de algodão ou fibra não inflamável. Barreira para a roupa e a pele; descontamine antes de lavar.' },
  { name: 'Óculos e protetor facial', detail: 'Protegem olhos e rosto de respingos, impacto e radiação UV.' },
  { name: 'Máscara', detail: 'PFF1: poeiras e névoas. PFF2: também fumos e agentes biológicos. PFF3: também radionuclídeos e quimioterápicos.' },
  { name: 'Touca', detail: 'Protege o cabelo de material infectante e de produtos químicos.' },
];

export const GLOVE_TYPES: readonly { readonly type: string; readonly use: string }[] = [
  { type: 'Látex', use: 'Uso geral, agentes biológicos, ácidos e bases diluídos. Não serve para solventes orgânicos.' },
  { type: 'Nitrílica ou PVC', use: 'Produtos químicos: ácidos, cáusticos e solventes.' },
  { type: 'Anticorte (fibra de vidro e polietileno)', use: 'Materiais cortantes.' },
  { type: 'Kevlar tricotado', use: 'Materiais quentes, até cerca de 250 °C.' },
  { type: 'Térmica de nylon', use: 'Temperaturas ultrabaixas, como nitrogênio líquido.' },
  { type: 'Borracha', use: 'Limpeza e descontaminação.' },
];

export const COLLECTIVE_PROTECTION: readonly ProtectionItem[] = [
  { name: 'Chuveiro de emergência', detail: 'Para acidentes com produtos químicos ou fogo no corpo.' },
  { name: 'Lava-olhos', detail: 'Remove a substância dos olhos e reduz o dano.' },
  { name: 'Cabine de segurança biológica', detail: 'Protege você e o ambiente dos aerossóis; algumas protegem também a amostra.' },
  { name: 'Autoclave', detail: 'Esteriliza materiais e resíduos antes do descarte.' },
  { name: 'Extintores', detail: 'Cada classe serve a um tipo de material em chamas. Confira validade e pressão.' },
  { name: 'Kit de derramamento', detail: 'Luvas, material absorvente (ex.: vermiculita) e máscara com filtro, em local visível.' },
];

export const DETAIL_SECTIONS: readonly ChecklistSection[] = [
  {
    id: 'descontaminacao',
    title: 'Limpeza, desinfecção e esterilização',
    summary: 'Como deixar material e superfícies seguros.',
    groups: [
      {
        title: 'As três etapas',
        items: [
          'Limpeza: remove sujeira e matéria orgânica.',
          'Desinfecção: elimina os microrganismos, exceto esporos.',
          'Esterilização: elimina qualquer forma de vida.',
        ],
      },
      {
        title: 'No dia a dia',
        items: [
          'Bancada, equipamentos e pele: álcool 70% depois de água e sabão, deixando agir por pelo menos 15 minutos.',
          'Pisos, vidrarias e inativação de material biológico: hipoclorito de sódio, na concentração definida no POP do laboratório.',
          'Chão: rodo ou esfregão com pano úmido em desinfetante. Vassoura comum levanta partículas.',
        ],
      },
      {
        title: 'Esterilização',
        items: [
          'Autoclave a 121 °C: no mínimo 45 minutos para descontaminar; de 20 a 30 minutos para materiais limpos.',
          'Estufa (calor seco), para o que não suporta umidade: 170 °C por 90 minutos ou 160 °C por 120 minutos. Evite passar de 180 °C.',
        ],
      },
    ],
  },
  {
    id: 'descarte',
    title: 'Descarte de resíduos',
    summary: 'Cada tipo de resíduo tem o seu caminho.',
    groups: [
      {
        title: 'Biológico',
        items: [
          'Descontamine antes do descarte final (autoclave).',
          'Saco branco próprio para resíduo infectante, bem fechado — não pode vazar nem de cabeça para baixo — e nunca reaberto.',
          'Identifique o saco: laboratório, sala, responsável e data.',
          'Lixeira com tampa, lavada pelo menos uma vez por semana ou sempre que houver vazamento.',
          'Derramou? Cubra com desinfetante, recolha com EPI e lave o local.',
        ],
      },
      {
        title: 'Perfurocortante',
        items: [
          'Recipiente rígido, com tampa e resistente à autoclave, perto de onde o material é usado.',
          'Identifique: laboratório, responsável e data.',
          'Não reencape, não entorte e não quebre agulhas. Não separe a agulha da seringa.',
        ],
      },
      {
        title: 'Químico',
        items: [
          'Não misture resíduos de natureza ou composição diferentes.',
          'Siga a orientação de descarte da FISPQ de cada produto.',
          'No armazenamento, respeite as incompatibilidades químicas (tabela abaixo).',
        ],
      },
    ],
  },
];

export interface ChemicalIncompatibility {
  readonly substance: string;
  readonly keepAwayFrom: string;
}

/**
 * Seleção das incompatibilidades mais comuns num laboratório de biogás e
 * bioprodutos. A tabela completa está no guia de referência (PDF).
 */
export const CHEMICAL_INCOMPATIBILITIES: readonly ChemicalIncompatibility[] = [
  { substance: 'Acetileno', keepAwayFrom: 'Cloro, bromo, flúor, cobre, prata, mercúrio.' },
  { substance: 'Acetona', keepAwayFrom: 'Bromo, cloro, ácido nítrico e ácido sulfúrico concentrados.' },
  { substance: 'Ácido acético', keepAwayFrom: 'Ácido crômico, ácido nítrico, ácido perclórico, peróxidos, permanganatos, etilenoglicol.' },
  { substance: 'Ácido fluorídrico', keepAwayFrom: 'Amônia (anidra ou em solução).' },
  { substance: 'Ácido nítrico (concentrado)', keepAwayFrom: 'Ácido acético, anilina, ácido crômico, líquidos e gases inflamáveis, substâncias facilmente nitráveis.' },
  { substance: 'Ácido perclórico', keepAwayFrom: 'Anidrido acético, álcoois, bismuto, papel, madeira, graxas, óleos e matéria orgânica em geral.' },
  { substance: 'Água', keepAwayFrom: 'Metais alcalinos e seus hidretos, carbetos, pentóxido de fósforo, ácido sulfúrico concentrado.' },
  { substance: 'Amônia', keepAwayFrom: 'Cloro, bromo, iodo, hipoclorito de cálcio, ácido fluorídrico, mercúrio, prata.' },
  { substance: 'Carvão ativado', keepAwayFrom: 'Hipoclorito de cálcio e oxidantes.' },
  { substance: 'Cianetos', keepAwayFrom: 'Ácidos, álcalis e oxidantes.' },
  { substance: 'Cloro', keepAwayFrom: 'Acetona, acetileno, amônia, benzeno, hidrogênio, metano, butano e outros gases combustíveis, metais em pó.' },
  { substance: 'Hidrocarbonetos (benzeno, butano, propano, gasolina)', keepAwayFrom: 'Flúor, cloro, bromo, ácido crômico, peróxidos.' },
  { substance: 'Hipoclorito de cálcio', keepAwayFrom: 'Amônia e carvão ativado.' },
  { substance: 'Iodo', keepAwayFrom: 'Acetileno, amônia e hidrogênio.' },
  { substance: 'Líquidos inflamáveis', keepAwayFrom: 'Nitrato de amônio, peróxido de hidrogênio, ácido nítrico, peróxido de sódio, halogênios.' },
  { substance: 'Mercúrio', keepAwayFrom: 'Acetileno, amônia, metais alcalinos, ácido oxálico.' },
  { substance: 'Metais alcalinos (sódio, potássio, lítio)', keepAwayFrom: 'Água, dióxido de carbono, tetracloreto de carbono, halogênios, hidrocarbonetos clorados.' },
  { substance: 'Nitrato de amônio', keepAwayFrom: 'Ácidos, metais em pó, enxofre, materiais orgânicos ou combustíveis finamente divididos.' },
  { substance: 'Oxigênio (líquido ou ar enriquecido)', keepAwayFrom: 'Gases e líquidos inflamáveis, óleos, graxas, hidrogênio.' },
  { substance: 'Permanganato de potássio', keepAwayFrom: 'Glicerina, etilenoglicol, ácido sulfúrico, benzaldeído, substâncias oxidáveis.' },
  { substance: 'Peróxido de hidrogênio', keepAwayFrom: 'Cobre, cromo, ferro, álcoois, acetona, substâncias combustíveis.' },
  { substance: 'Peróxidos orgânicos', keepAwayFrom: 'Ácidos minerais ou orgânicos.' },
  { substance: 'Sulfeto de hidrogênio (H₂S)', keepAwayFrom: 'Ácido nítrico fumegante e oxidantes fortes (cloratos, percloratos, permanganatos).' },
];

/** Busca sem acento e sem caixa, em qualquer das duas colunas. */
export function filterIncompatibilities(
  query: string,
  rows: readonly ChemicalIncompatibility[] = CHEMICAL_INCOMPATIBILITIES,
): readonly ChemicalIncompatibility[] {
  const normalize = (value: string): string =>
    value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const needle = normalize(query.trim());
  if (needle === '') return rows;
  return rows.filter(
    (row) => normalize(row.substance).includes(needle) || normalize(row.keepAwayFrom).includes(needle),
  );
}

export const EMERGENCY_STEPS: readonly ChecklistGroup[] = [
  {
    title: 'Respingo nos olhos',
    items: ['Vá ao lava-olhos e lave com água corrente por pelo menos 15 minutos, com as pálpebras abertas.'],
  },
  {
    title: 'Produto químico ou fogo no corpo',
    items: ['Use o chuveiro de emergência e retire a roupa atingida.'],
  },
  {
    title: 'Derramamento',
    items: ['Afaste as pessoas, vista o EPI e use o kit de derramamento. Material biológico: cubra com desinfetante antes de recolher.'],
  },
  {
    title: 'Fogo',
    items: [
      'Use o extintor adequado só se for seguro. Se não controlar, saia, feche a porta e acione a Central de Segurança da Unicamp e os Bombeiros (193).',
    ],
  },
  {
    title: 'Intoxicação ou exposição química',
    items: ['Ligue para o CIATox Campinas e tenha à mão o nome do produto e a FISPQ.'],
  },
];

export interface EmergencyPhone {
  readonly display: string;
  /** Número discável (E.164 ou curto), para links `tel:`. */
  readonly dial: string;
}

export interface EmergencyContact {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly phones: readonly EmergencyPhone[];
  readonly note?: string;
}

/**
 * Contatos de emergência da Unicamp (campus Barão Geraldo), informados pela
 * coordenação do CP2b em outubro de 2026. Revise quando mudarem: numa
 * emergência, um número errado custa caro.
 */
export const EMERGENCY_CONTACTS_REVIEWED_AT = 'outubro de 2026';

export const UNICAMP_EMERGENCY_CONTACTS: readonly EmergencyContact[] = [
  {
    id: 'svc',
    name: 'Central de Segurança da Unicamp (SVC/VIDAS)',
    detail: '24 horas: emergência médica no campus, vigilância, escolta e situações de risco.',
    phones: [{ display: '(19) 3521-6000', dial: '+551935216000' }],
    note: 'De um telefone do campus: ramal 16000.',
  },
  {
    id: 'ciatox',
    name: 'CIATox Campinas (Unicamp)',
    detail: '24 horas: intoxicação, envenenamento, animal peçonhento e exposição a produtos químicos.',
    phones: [{ display: '(19) 3521-7555', dial: '+551935217555' }],
  },
  {
    id: 'hc',
    name: 'Pronto-Socorro do HC Unicamp',
    detail: 'Rua Vital Brasil, 251 — Cidade Universitária.',
    phones: [
      { display: '(19) 3521-8770', dial: '+551935218770' },
      { display: '(19) 3521-8783', dial: '+551935218783' },
    ],
  },
  {
    id: 'panico',
    name: 'Botão de Pânico Unicamp',
    detail:
      'App "Unicamp Serviços" ou "Botão de Pânico" (Android e iOS): envia sua localização à Central de Segurança no campus Barão Geraldo.',
    phones: [],
  },
];

/** Números nacionais, que valem de qualquer telefone. */
export const EMERGENCY_NUMBERS: readonly { readonly label: string; readonly number: string }[] = [
  { label: 'SAMU', number: '192' },
  { label: 'Bombeiros', number: '193' },
  { label: 'Polícia Militar', number: '190' },
];

export const SAFETY_REMINDERS: readonly string[] = [
  'Acidentes não acontecem: são causados.',
  'Nenhum trabalho é tão urgente que não possa ser planejado e feito com segurança.',
  'Segurança é responsabilidade de todos. Viu algo errado? Avise.',
];
