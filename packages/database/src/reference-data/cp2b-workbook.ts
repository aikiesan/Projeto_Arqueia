// Generated from the CP2b reference workbook. Do not edit rows manually.

export type ReferenceCell = boolean | number | string | null;

export interface ReferenceWorkbookSnapshot {
  readonly source: {
    readonly key: string;
    readonly displayName: string;
    readonly sha256: string;
    readonly schemaVersion: number;
  };
  readonly sheets: ReadonlyArray<{
    readonly name: string;
    readonly rows: ReadonlyArray<{
      readonly rowNumber: number;
      readonly values: readonly ReferenceCell[];
    }>;
  }>;
}

export const cp2bReferenceWorkbook: ReferenceWorkbookSnapshot = {
  "source": {
    "key": "CP2b-reference-2026-08-14-2c9257a24896",
    "displayName": "Levantamento de equipamentos, reagentes e espaços — CP2b",
    "sha256": "2c9257a248966bc769640f1b22a4cbaf9d66384793f15d3380a8f0c043a329fd",
    "schemaVersion": 1
  },
  "sheets": [
    {
      "name": "Reagentes",
      "rows": [
        {
          "rowNumber": 2,
          "values": [
            "Reagentes"
          ]
        },
        {
          "rowNumber": 3,
          "values": [
            "Sulfato de Prata – Ag₂SO₄ P.A. ou grau técnico"
          ]
        },
        {
          "rowNumber": 4,
          "values": [
            "Ácido Sulfúrico – H₂SO₄ concentrado 96–97% P.A."
          ]
        },
        {
          "rowNumber": 5,
          "values": [
            "Sulfato de Mercúrio – HgSO₄ P.A."
          ]
        },
        {
          "rowNumber": 6,
          "values": [
            "Dicromato de Potássio – K₂Cr₂O₇ P.A."
          ]
        },
        {
          "rowNumber": 7,
          "values": [
            "Ftalato Ácido de Potássio (KHP) – C₆H₄(COOH)COOK (202,22 g/mol) P.A."
          ]
        },
        {
          "rowNumber": 8,
          "values": [
            "Sulfato de Zinco (ZnSO₄) P.A."
          ]
        },
        {
          "rowNumber": 9,
          "values": [
            "Nitrato de Prata (AgNO₃) P.A."
          ]
        },
        {
          "rowNumber": 10,
          "values": [
            "Bicarbonato de Sódio P. A."
          ]
        },
        {
          "rowNumber": 11,
          "values": [
            "Hidróxido de Sódio – NaOH P.A. (em lentilhas)"
          ]
        },
        {
          "rowNumber": 12,
          "values": [
            "Tetraborato de sódio – Na₂B₄O₇·10H₂O (bórax) P.A."
          ]
        },
        {
          "rowNumber": 13,
          "values": [
            "Fenolftaleína [C₆H₄COO.C(C₆H₄OH)₂] P.A."
          ]
        },
        {
          "rowNumber": 14,
          "values": [
            "Azul de Bromotimol (C₂₇H₂₈Br₂O₅S) P.A."
          ]
        },
        {
          "rowNumber": 15,
          "values": [
            "Celulose Microcristalina"
          ]
        },
        {
          "rowNumber": 16,
          "values": [
            "Clorofórmio"
          ]
        },
        {
          "rowNumber": 17,
          "values": [
            "Hexano"
          ]
        },
        {
          "rowNumber": 18,
          "values": [
            "Ácido clorídrico"
          ]
        },
        {
          "rowNumber": 19,
          "values": [
            "Ácido nítrico"
          ]
        },
        {
          "rowNumber": 20,
          "values": [
            "Glicose"
          ]
        },
        {
          "rowNumber": 21,
          "values": [
            "Hidróxido de potássio"
          ]
        },
        {
          "rowNumber": 22,
          "values": [
            "Vaselina sólida"
          ]
        }
      ]
    },
    {
      "name": "Equipamentos",
      "rows": [
        {
          "rowNumber": 2,
          "values": [
            "Vidrarias/Utensílios comuns de laboratório",
            "Equipamentos de bancada",
            "Equipamentos que necessitam de instalação",
            "Equipamentos/Utensílios que a Bruna já possui"
          ]
        },
        {
          "rowNumber": 3,
          "values": [
            "Agitadores barra magnética",
            "Agitador magnético com aquecimento (chapa aquecedora)",
            "Capela",
            "Digestor de DQO"
          ]
        },
        {
          "rowNumber": 4,
          "values": [
            "Balões Volumétricos de 10, 500 e 2.000 mL",
            "Agitador Mini Vórtex",
            "Moinho de facas",
            "Espectrofotômetro"
          ]
        },
        {
          "rowNumber": 5,
          "values": [
            "Béquer de 10, 25, 50, 100, 250, 500 e 1000 mL",
            "Balança analítica (precisão ± 0,0001 g)",
            "Moinho forrageiro",
            "Forno tipo Mufla 600 °C"
          ]
        },
        {
          "rowNumber": 6,
          "values": [
            "Béquer de plástico de 250, 500, 1000 e 2000 mL",
            "Bomba de vácuo",
            null,
            "Seringa para medir volume de gás (1 L)"
          ]
        },
        {
          "rowNumber": 7,
          "values": [
            "Bastão de vidro",
            "Centrífuga de bancada (Tubo Falcon 50 mL)",
            null,
            "CG Shimadzu"
          ]
        },
        {
          "rowNumber": 8,
          "values": [
            "Dispensadores automáticos de 5,0 mL",
            "Estufas 103–105 °C",
            null,
            "Ritter (medidor de vazão)"
          ]
        },
        {
          "rowNumber": 9,
          "values": [
            "Erlenmeyer de 50, 100, 250, 500, 1000 e 2000 mL",
            "Medidor de pH (precisão ± 0,01 unidade de pH)",
            null,
            null
          ]
        },
        {
          "rowNumber": 10,
          "values": [
            "Proveta de vidro graduada de 10, 25, 50, 100, 250, 500, 1000 e 2000 mL",
            "Incubadora Shaker (aquecimento e agitação)",
            null,
            null
          ]
        },
        {
          "rowNumber": 11,
          "values": [
            "Pipetas automáticas de 0,5 - 5.000 µL",
            "Banho termostático",
            null,
            null
          ]
        },
        {
          "rowNumber": 12,
          "values": [
            "Pipetadores automáticos",
            "Manta aquecedora",
            null,
            null
          ]
        },
        {
          "rowNumber": 13,
          "values": [
            "Tubos de DQO (padrão HACH®)",
            "Balança capacidade >10kg (precisão ± 0,01 g)",
            null,
            null
          ]
        },
        {
          "rowNumber": 14,
          "values": [
            "Tubos de centrifugação tipo falcon de 25 e 50 mL",
            "Agitador de peneiras vibratório",
            null,
            null
          ]
        },
        {
          "rowNumber": 15,
          "values": [
            "Buretas de vidro de 10, 25, 50 mL (kit com suporte e garra)",
            "Agitadores mecânicos",
            null,
            null
          ]
        },
        {
          "rowNumber": 16,
          "values": [
            "Pérolas de vidro",
            "Bombas dosadoras (peristáuticas)",
            null,
            null
          ]
        },
        {
          "rowNumber": 17,
          "values": [
            "Vidros de relógio",
            "Impelidores de inox para agitação",
            null,
            null
          ]
        },
        {
          "rowNumber": 18,
          "values": [
            "Cápsulas de porcelana (modelos 05-50 ou nº. 2 e 05-85 ou nº. 4)",
            "Nobreaks",
            null,
            null
          ]
        },
        {
          "rowNumber": 19,
          "values": [
            "Pinças para cápsula de porcelana (comprimentos de 20 cm para uso na estufa, de 50 cm para uso na mufla e de 15 cm para transferir a membrana filtrante)",
            "Estabilizadores",
            null,
            null
          ]
        },
        {
          "rowNumber": 20,
          "values": [
            "Luvas para forno",
            "Sistema de destilação de água",
            null,
            null
          ]
        },
        {
          "rowNumber": 21,
          "values": [
            "Frascos Duran (250 mL, 500mL, 1000 mL, 5000 mL)",
            "Liquidificador alta rotação 4L",
            null,
            null
          ]
        },
        {
          "rowNumber": 22,
          "values": [
            "Tampa de butila",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 23,
          "values": [
            "Agulha",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 24,
          "values": [
            "Seringas (5 mL)",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 25,
          "values": [
            "Galões/Bombonas para armazenar (10 litros, 30 litros, 50 litros)",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 26,
          "values": [
            "Bastão de vidro",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 27,
          "values": [
            "Mangueiras para conexões de reatores",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 28,
          "values": [
            "Dessecador contendo sílica anidra",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 29,
          "values": [
            "Funil tipo Büchner para membrana com diâmetro de 47 mm, kitassato de 250 mL e alonga de borracha para filtração, ou conjunto de filtração a vácuo da Millipore® (Nalgene®) para membrana com diâmetro de 47 mm",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 30,
          "values": [
            "Membranas de microfibra de vidro, com poros de 0,45 e 1,2 µm e diâmetro de 47 mm",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 31,
          "values": [
            "Membrana filtrante tipo microfibra de vidro, com tamanho nominal de abertura de entre 0,45 – 1,5 µm e diâmetro de 47 mm. Quando calcinada a 550 °C, a microfibra de vidro mantém sua integridade estrutural.",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 32,
          "values": [
            "Baldes 10L",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 33,
          "values": [
            "Kitassato 250 mL, 500 mL",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 34,
          "values": [
            "Termômetros graduados",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 35,
          "values": [
            "Termômetros digitais",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 36,
          "values": [
            "Espátulas de inox",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 37,
          "values": [
            "Papel de filtro",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 38,
          "values": [
            "Funil de Buchner 1 L e 2 L",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 39,
          "values": [
            "Extrator soxhlet completo",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 40,
          "values": [
            "Condensador Liebig",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 41,
          "values": [
            "Balões de fundo redondo (250 mL, 500 mL, 1000 mL)",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 42,
          "values": [
            "Jogo de peneiras para granulometria",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 43,
          "values": [
            "Bolsas Tedlar (1L, 3L)",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 44,
          "values": [
            "Suportes universais e garras para vidrarias",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 45,
          "values": [
            "Funis de decantação (250 mL, 500 mL, 1000 mL)",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 46,
          "values": [
            "Pipetas descartáveis",
            null,
            null,
            null
          ]
        }
      ]
    },
    {
      "name": "Demanda Elétrica e de CalorEqui",
      "rows": [
        {
          "rowNumber": 1,
          "values": [
            "Equipamento",
            "Modelo",
            "Voltagem (V)",
            "Potência (W)",
            "Temperatura (°C)",
            "Links"
          ]
        },
        {
          "rowNumber": 2,
          "values": [
            "Agitador magnético com aquecimento (chapa aquecedora)",
            "Agitador magnético com aquecimento Fisatom 752A - 4 Litros - 360°C\n",
            220,
            650,
            "50 - 360",
            "https://www.7lab.com.br/equipamentos/agitador-magnetico-com-aquecimento/agitador-magnetico-com-aquecimento-fisatom-752a-4-litros?parceiro=5060&variant_id=9&campaignid=20683835759&adgroupid=&keyword=&network=x&utm_medium=cpc&gad_source=1&gad_campaignid=20687309404&gbraid=0AAAAADuzuWBSD_HsMC-EUQerl93baGBkL&gclid=Cj0KCQjwndHEBhDVARIsAGh0g3CQ2nfHH2tck3RTejxHNteSozTIms_Memsjx6iIUmdh7lCGpYtTO34aArO9EALw_wcB"
          ]
        },
        {
          "rowNumber": 3,
          "values": [
            "Agitador magnético com aquecimento (chapa aquecedora)",
            "IKA® C-MAG HS hotplate stirrers\n",
            220,
            250,
            "50 - 500",
            "https://www.sigmaaldrich.com/BR/pt/product/aldrich/z672351#product-documentation"
          ]
        },
        {
          "rowNumber": 4,
          "values": [
            "Agitador Mini Vórtex",
            "Agitador Mini Vórtex ( 0-3000 RPM )\n",
            "Bifásico",
            12,
            "4 - 40",
            "https://www.elabcommerce.com.br/agitador-vortex-0-3000-rpm-com-capacidade-maxima-de-50-ml/p"
          ]
        },
        {
          "rowNumber": 5,
          "values": [
            "Balança analítica (precisão ± 0,0001 g)",
            "Balança Analítica 220gr 0,1mg (0,0001g) Unibloc ATY224 Shimadzu",
            "Bifásico",
            "-",
            "10 - 30",
            "https://www.lojaprolab.com.br/balanca-analitica-220gr-0-1mg-0-0001g-unibloc-aty224-shimadzu-79900"
          ]
        },
        {
          "rowNumber": 6,
          "values": [
            "Balança analítica (Capacidade 5 kg)",
            "Balança de Precisão 5010gr com Divisão de 0,01gr ? Marte Ad5002",
            "Bifásico",
            "-",
            "-",
            "https://www.lojaprolab.com.br/balanca-de-precisao-5010gr-com-divisao-de-0-01gr-marte-ad5002-79907"
          ]
        },
        {
          "rowNumber": 7,
          "values": [
            "Bomba de vácuo",
            "Bomba de vácuo e pressão Q355B\n",
            "Bifásico",
            250,
            "-",
            "https://www.quimis.com.br/produto/bomba-de-vacuo/"
          ]
        },
        {
          "rowNumber": 8,
          "values": [
            "Banho termostático com circulação ",
            "Banho ultratermostático digital com circulação -20 a 120°C Q214M\n",
            220,
            2200,
            "-20 - 120",
            "https://www.quimis.com.br/produto/banho-ultratermostatico/"
          ]
        },
        {
          "rowNumber": 9,
          "values": [
            "Centrífuga de bancada (Tubo Falcon 50 mL)",
            "Centrífuga - 6.000 Rpm\n",
            "Bifásico",
            800,
            "-",
            "https://novatecnica.com.br/nt-812-centrifuga---6000-rpm-286"
          ]
        },
        {
          "rowNumber": 10,
          "values": [
            "Estufas 103–105 °C",
            "Estufa de secagem Q317M\n",
            "110 ou 220",
            750,
            "20 - 300",
            "https://www.quimis.com.br/produto/estufa-de-secagem/"
          ]
        },
        {
          "rowNumber": 11,
          "values": [
            null,
            "Estufa de secagem e esterilização Bio Easy Digital 7Lab - 150 L - 200ºC",
            220,
            1100,
            "20 - 200",
            "https://www.7lab.com.br/equipamentos-para-laboratorio/estufa-de-secagem-e-esterilizacao/estufa-de-secagem-e-esterilizacao-bio-easy-digital-7lab-150-l-200oc"
          ]
        },
        {
          "rowNumber": 12,
          "values": [
            null,
            "Modelos EL403/413 | Estufa Digital com Circulação de Ar\n",
            110,
            1000,
            "20 - 300",
            "https://www.eletrolab.com.br/produtos/el403-413-estufa-digital-com-circulacao-de-ar.html"
          ]
        },
        {
          "rowNumber": 13,
          "values": [
            "Medidor de pH (precisão ± 0,01 unidade de pH)",
            "Phmetro de Bancada Ph 0 a 14 Precisão 0,01 Com ATC Kasvi",
            "110 ou 220",
            "15-25",
            "0 - 100",
            "https://www.lojaprolab.com.br/phmetro-de-bancada-ph-0-a-14-precisao-0-01-com-atc-kasvi-81091"
          ]
        },
        {
          "rowNumber": 14,
          "values": [
            null,
            "PHMETRO MEDIDOR DE PH DE BANCADA FAIXA PH 0-14 ALTA PRECISÃO PHS3BW BEL",
            "Bifásico",
            "20-30",
            "0 - 100",
            "https://www.lojanetlab.com.br/produto/phmetro-medidor-de-ph-de-bancada-faixa-ph-0-14-alta-precisao-phs3bw-bel-164483"
          ]
        },
        {
          "rowNumber": 15,
          "values": [
            null,
            "Medidor de Bancada Avançado para pH/ORP com Tela Touch e Conexão Wi-F",
            "Bifásico",
            60,
            "20 - 120",
            "https://hannainst.com.br/produto/hi6221-02-medidor-de-bancada-avancado-para-ph-orp-com-tela-touch-e-conexao-wi-fi/"
          ]
        },
        {
          "rowNumber": 16,
          "values": [
            "Incubadora Shaker (aquecimento e agitação)",
            "Modelo NT 735 | Incubadora Shaker Refrigerada\n",
            "Bifásico",
            1600,
            "-10 - 80",
            "https://novatecnica.com.br/download-pdf?codigo=aDVQSWZOaGFGaEt0NUY1STlpdFdaUT09#:~:text=Modelo%20NT%20735%20%7C%20Incubadora%20Shaker%20Refrigerada&text=Utilizada%20para%20incuba%C3%A7%C3%A3o%20de%20amostras,de%20microorganismos%20e%20an%C3%A1lises%20bioqu%C3%ADmicas."
          ]
        },
        {
          "rowNumber": 17,
          "values": [
            null,
            "Incubadora Shaker com Agitação Orbital e Aquecimento Especial (SL-220/E)",
            220,
            1200,
            "Ambiente+5 - 60",
            "https://www.solabcientifica.com.br/equipamentos/incubadoras-shakers/incubadora-shaker-com-agitacao-orbital-e-aquecimento-especial-sl-220-e"
          ]
        },
        {
          "rowNumber": 18,
          "values": [
            null,
            "MA420/100 | Shaker Orbital para até 100°C",
            220,
            1000,
            "Ambiente+7 - 100",
            "https://www.marconi.com.br/produto/902/shaker-orbital-para-ate-100%C2%B0c"
          ]
        },
        {
          "rowNumber": 19,
          "values": [
            "Capela",
            "Famolab Capela Customizada 1800mm",
            "Bifásico",
            "500 - 750",
            "15-40",
            "https://famolab.com.br/equipamentos-para-laboratorio/capela-de-exaustao-de-gases/?gad_campaignid=20870106676"
          ]
        },
        {
          "rowNumber": 20,
          "values": [
            null,
            "Union Equipamentos Capela 1500mm",
            220,
            373,
            "15-40",
            "https://union.ind.br/capela-de-exaustao/"
          ]
        },
        {
          "rowNumber": 21,
          "values": [
            null,
            "Permution CE0730 (1500mm) ",
            220,
            475,
            "15-40",
            "https://www.dsyslab.com.br/equipamentos/capela-de-exaustao-evolution-rtm-ce0730-60m-bivolt-paex-0232-permution"
          ]
        },
        {
          "rowNumber": 22,
          "values": [
            null,
            "Capela de Exaustão de Gases em Fibra de Vidro Profissional | LCE-60 Profissional",
            "110 ou 220",
            735,
            "15-40",
            "https://lutech.com.br/produto/capela-de-exaustao-de-gases-em-fibra-de-vidro-profissional-lce-60-profissional/"
          ]
        },
        {
          "rowNumber": 23,
          "values": [
            "Moinho",
            "MA680/CF | Moinho de facas para folhas, caules, osso com inversor de frequencia /moto freio",
            220,
            1500,
            "15 - 65",
            "https://www.marconi.com.br/produto/1237/moinho-de-facas-para-folhas44-caules44-osso-com-inversor-de-frequencia-moto-freio"
          ]
        },
        {
          "rowNumber": 24,
          "values": [
            null,
            "MA500/JC1 | Moinho para Jarros (Jarro/Esferas em Cerâmica de Alumina) - 1 Litro",
            220,
            1200,
            "15 - 60",
            "https://www.marconi.com.br/produto/1083/moinho-para-jarros-jarroesferas-em-ceramica-de-alumina-1-litro"
          ]
        },
        {
          "rowNumber": 25,
          "values": [
            null,
            "BM40 Planetário",
            "110 ou 220",
            1500,
            "18 - 70",
            "https://torontech.com/pt/planetary-ball-mill/"
          ]
        },
        {
          "rowNumber": 26,
          "values": [
            "Digestor de DQO",
            "MA488/F | Digestor para DQO",
            220,
            3900,
            "15 - 450",
            "https://www.marconi.com.br/produto/140/digestor-para-dqo"
          ]
        },
        {
          "rowNumber": 27,
          "values": [
            null,
            "Bloco Digestor de DQO Digital Tampa em Inox com Timer Até 200°C 25 tubos x 16mm Mod. BDQ-TC-2516F-220Vac",
            220,
            400,
            "Ambiente+5 - 200",
            "https://montlab.com.br/produto/bloco-digestor-de-dqo/"
          ]
        },
        {
          "rowNumber": 28,
          "values": [
            null,
            "Banho Seco Digital para Tubos, 220V mod.: Q325S-220V (Quimis)",
            220,
            "400-600",
            "Ambiente+10 - 200",
            "https://www.dsyslab.com.br/equipamentos/banho-seco/banho-seco-digital-para-tubos-220v-mod-q325s-220v-quimis"
          ]
        },
        {
          "rowNumber": 29,
          "values": [
            "Espectrofotômetro",
            "Sinergia Científica - Modelo Base",
            "110 ou 220",
            120,
            "15-40",
            "https://www.sinergiacientifica.com.br/produto/espectrofotometro/"
          ]
        },
        {
          "rowNumber": 30,
          "values": [
            null,
            "Biospectro SP-220",
            "Bifásico",
            100,
            "15-40",
            "https://www.lab-bran.com.br/htmls/catalogos/novo%20catalogo/E1910108%20BIOSPECTRO.pdf"
          ]
        },
        {
          "rowNumber": 31,
          "values": [
            null,
            "Femto 700S",
            "Bifásico",
            80,
            "10-40",
            "http://www.femto.com.br/espectrofotometro-700S.html"
          ]
        },
        {
          "rowNumber": 32,
          "values": [
            "Forno tipo Mufla 600 °C",
            "Forno Mufla Modelo NT 380",
            220,
            4200,
            "100 - 1100",
            "https://novatecnica.com.br/nt-380-forno-mufla-208"
          ]
        },
        {
          "rowNumber": 33,
          "values": [
            null,
            "Forno Mufla Microprocessado 1200ºC Rampas e Patamares QUIMIS Q318S21",
            220,
            1720,
            "100 - 1200",
            "https://www.spmedica.com/laboratorial/aquecedores/fornos/forno-mufla-microprocessado-1200oc-rampas-e-patamares-quimis-cod-q318s21"
          ]
        },
        {
          "rowNumber": 34,
          "values": [
            null,
            "Forno Mufla AMT-3800 - Alfa Mare",
            "-",
            4000,
            "100 - 1100",
            "https://alfamare.com.br/produtos/forno-mufla-para-laboratorio/"
          ]
        },
        {
          "rowNumber": 35,
          "values": [
            "Seringa para medir volume de gás (1 L)",
            "Hamilton® Microlab® 600 instrument syringe\n",
            "-",
            "-",
            "-",
            "https://www.sigmaaldrich.com/BR/pt/product/aldrich/ham5900060?gad_campaignid=21575616941"
          ]
        },
        {
          "rowNumber": 36,
          "values": [
            null,
            "Seringa Hamilton®, série 1000 GASTIGHT®, trava do tipo lúer de PTFE",
            "-",
            "-",
            "-",
            "https://www.sigmaaldrich.com/BR/pt/product/sial/20999?gad_campaignid=19323908147"
          ]
        },
        {
          "rowNumber": 37,
          "values": [
            null,
            "Hamilton® SaltLine reagent syringe",
            "-",
            "-",
            "-",
            "https://www.sigmaaldrich.com/BR/pt/product/aldrich/ham203270"
          ]
        },
        {
          "rowNumber": 38,
          "values": [
            "CG Shimadzu",
            "Nexis GC-2030",
            220,
            3000,
            "Ambiente+2 - 450",
            "https://www.shimadzu.com.br/analitica/produtos/cromatografo-gasoso/sistemas-gc/nexis-gc-2030/index.html"
          ]
        },
        {
          "rowNumber": 39,
          "values": [
            null,
            "GC-2010 Pro",
            220,
            2500,
            "Ambiente+4 - 450",
            "https://www.shimadzu.com.br/analitica/produtos/cromatografo-gasoso/sistemas-gc/gc-2010-pro/index.html"
          ]
        },
        {
          "rowNumber": 40,
          "values": [
            null,
            "GCMS-QP2020 NX",
            220,
            4000,
            "Ambiente+2 - 350",
            "https://www.shimadzu.com.br/analitica/products/gas-chromatograph-mass-spectrometry/single-quadrupole-gc-ms/gcms-qp2020-nx/index.html"
          ]
        },
        {
          "rowNumber": 41,
          "values": [
            "Ritter (medidor de vazão)",
            "TG 5 Termoplástico",
            "-",
            "-",
            "15-40",
            "https://www.ritter.de/pt-br/folhas-de-dados/tg-5-termoplastico/"
          ]
        },
        {
          "rowNumber": 42,
          "values": [
            null,
            "TG 3 Aço inoxidável",
            "-",
            "-",
            "15-40",
            "https://www.ritter.de/pt-br/folhas-de-dados/tg-3-aco-inoxidavel/"
          ]
        },
        {
          "rowNumber": 43,
          "values": [
            null,
            "TG 10 Aço inoxidável 6 bar\n",
            "-",
            "-",
            "15-40",
            "https://www.ritter.de/pt-br/folhas-de-dados/tg-10-aco-inoxidavel-6-bar/"
          ]
        },
        {
          "rowNumber": 46,
          "values": [
            "Categoria",
            "Consumo Médio (W)",
            "Faixa de Consumo (W)",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 47,
          "values": [
            "Estufas 103-105°C",
            950,
            "750-1.100",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 48,
          "values": [
            "Medidor de pH",
            39,
            "15-60",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 49,
          "values": [
            "Incubadora Shaker",
            1267,
            "1.000-1.600",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 50,
          "values": [
            "Capela",
            546,
            "373-735",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 51,
          "values": [
            "Moinho",
            1400,
            "1.200-1.500",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 52,
          "values": [
            "Digestor DQO",
            1567,
            "400-3.900",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 53,
          "values": [
            "Espectrofotômetro",
            100,
            "80-120",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 54,
          "values": [
            "Forno Mufla 600°C",
            3307,
            "1.720-4.200",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 55,
          "values": [
            "CG Shimadzu",
            3167,
            "2.500-4.000",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 56,
          "values": [
            "Agitador Magnético c/ Aquecimento",
            450,
            "250-650",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 57,
          "values": [
            "Mini Vórtex",
            12,
            12,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 58,
          "values": [
            "Balança Analítica",
            13,
            "10-15",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 59,
          "values": [
            "Bomba de Vácuo",
            250,
            250,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 60,
          "values": [
            "Banho Termostático",
            2200,
            2200,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 61,
          "values": [
            "Centrífuga de Bancada",
            800,
            800,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 63,
          "values": [
            "Equipamento",
            "Consumo Estimado (W)",
            "Voltagem",
            "Observações",
            null,
            null
          ]
        },
        {
          "rowNumber": 64,
          "values": [
            "Balança capacidade >10kg",
            "15-25",
            "110/220V",
            "Equipamento de bancada",
            null,
            null
          ]
        },
        {
          "rowNumber": 65,
          "values": [
            "Agitador de peneiras vibratório",
            "500-800",
            "220V",
            "Motor vibratório",
            null,
            null
          ]
        },
        {
          "rowNumber": 66,
          "values": [
            "Agitadores mecânicos",
            "200-500",
            "110/220V",
            "Motor de agitação",
            null,
            null
          ]
        },
        {
          "rowNumber": 67,
          "values": [
            "Bombas dosadoras (peristálticas)",
            "50-150",
            "110/220V",
            "Sistema de bombeamento",
            null,
            null
          ]
        },
        {
          "rowNumber": 68,
          "values": [
            "Nobreaks",
            "0*",
            "110/220V",
            "Equipamento de proteção",
            null,
            null
          ]
        },
        {
          "rowNumber": 69,
          "values": [
            "Estabilizadores",
            "0*",
            "110/220V",
            "Equipamento de proteção",
            null,
            null
          ]
        },
        {
          "rowNumber": 70,
          "values": [
            "Sistema de destilação de água",
            "2000-4000",
            "220V",
            "Resistência aquecimento",
            null,
            null
          ]
        },
        {
          "rowNumber": 71,
          "values": [
            "Liquidificador alta rotação 4L",
            "1000-1500",
            "110/220V",
            "Motor alta potência",
            null,
            null
          ]
        },
        {
          "rowNumber": 72,
          "values": [
            "Manta aquecedora",
            "200-500",
            "110/220V",
            "Resistência elétrica",
            null,
            null
          ]
        },
        {
          "rowNumber": 73,
          "values": [
            "Termômetros digitais",
            45935,
            "Bateria/110V",
            "Baixo consumo",
            null,
            null
          ]
        },
        {
          "rowNumber": 75,
          "values": [
            "Categoria",
            "Consumo Total (W)",
            "Faixa de Consumo (W)",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 76,
          "values": [
            "Equipamentos Principais",
            13391,
            "9.795-17.830",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 77,
          "values": [
            "Equipamentos Adicionais",
            3940,
            "2.730-6.060",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 78,
          "values": [
            "TOTAL LABORATÓRIO",
            17331,
            "12.525-23.890",
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 79,
          "values": [
            "Análise por Faixa de Consumo",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 81,
          "values": [
            "Alto Consumo (>2.000W):",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 82,
          "values": [
            "Forno Mufla 600°C: 3.307W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 83,
          "values": [
            "CG Shimadzu: 3.167W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 84,
          "values": [
            "Sistema destilação água: 3.000W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 85,
          "values": [
            "Banho termostático: 2.200W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 86,
          "values": [
            "Subtotal: 11.674W (67% do consumo total)",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 87,
          "values": [
            "Médio Consumo (500-2.000W):",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 88,
          "values": [
            "Digestor DQO: 1.567W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 89,
          "values": [
            "Moinho: 1.400W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 90,
          "values": [
            "Liquidificador 4L: 1.250W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 91,
          "values": [
            "Incubadora Shaker: 1.267W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 92,
          "values": [
            "Estufa 103-105°C: 950W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 93,
          "values": [
            "Centrífuga: 800W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 94,
          "values": [
            "Agitador peneiras: 650W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 95,
          "values": [
            "Capela: 546W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 96,
          "values": [
            "Subtotal: 8.430W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 97,
          "values": [
            "Baixo Consumo (<500W):",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 98,
          "values": [
            "Agitador magnético: 450W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 99,
          "values": [
            "Agitadores mecânicos: 350W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 100,
          "values": [
            "Manta aquecedora: 350W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 101,
          "values": [
            "Bomba vácuo: 250W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 102,
          "values": [
            "Bombas peristálticas: 100W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 103,
          "values": [
            "Outros: 187W",
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 104,
          "values": [
            "Subtotal: 1.687W",
            null,
            null,
            null,
            null,
            null
          ]
        }
      ]
    },
    {
      "name": "Quadro de Áreas",
      "rows": [
        {
          "rowNumber": 1,
          "values": [
            "Térreo",
            null,
            null
          ]
        },
        {
          "rowNumber": 2,
          "values": [
            "Ambiente",
            "Área (m²)",
            "Dimensões (m)"
          ]
        },
        {
          "rowNumber": 3,
          "values": [
            "Laboratório 1",
            "53,25",
            "8,90 x 5,85"
          ]
        },
        {
          "rowNumber": 4,
          "values": [
            "Laboratório 2",
            "38,40",
            "8,90 x 4,35"
          ]
        },
        {
          "rowNumber": 5,
          "values": [
            "Laboratório 3",
            "47,05",
            "10,78 x 4,35"
          ]
        },
        {
          "rowNumber": 6,
          "values": [
            "Laboratório 4",
            "46,58",
            "10,57 x 4,35"
          ]
        },
        {
          "rowNumber": 7,
          "values": [
            "Recepção",
            "62,97",
            "5,85 x 7,00"
          ]
        },
        {
          "rowNumber": 8,
          "values": [
            "Circulação",
            "13,04",
            "1,50 x 8,90"
          ]
        },
        {
          "rowNumber": 9,
          "values": [
            "WC PNE M",
            "2,70",
            "1,80 x 1,50"
          ]
        },
        {
          "rowNumber": 10,
          "values": [
            "WC PNE F",
            "2,70",
            "1,80 x 1,50"
          ]
        },
        {
          "rowNumber": 11,
          "values": [
            "WC M",
            "14,05",
            "3,37 x 3,80"
          ]
        },
        {
          "rowNumber": 12,
          "values": [
            "WC F",
            "14,05",
            "3,37 x 3,80"
          ]
        },
        {
          "rowNumber": 13,
          "values": [
            "Hall Elevador",
            null,
            null
          ]
        },
        {
          "rowNumber": 14,
          "values": [
            "Caixa de Escada",
            "17,50",
            "5,00 x 3,50"
          ]
        },
        {
          "rowNumber": 15,
          "values": [
            "1º Pavimento",
            null,
            null
          ]
        },
        {
          "rowNumber": 16,
          "values": [
            "Ambiente",
            "Área (m²)",
            "Dimensões (m)"
          ]
        },
        {
          "rowNumber": 17,
          "values": [
            "Auditório",
            "73,44",
            "7,10 x 11,20"
          ]
        },
        {
          "rowNumber": 18,
          "values": [
            "Laboratório 5",
            "30,89",
            "7,15 x 4,45"
          ]
        },
        {
          "rowNumber": 19,
          "values": [
            "Laboratório 6",
            "31,82",
            "7,20 x 4,45"
          ]
        },
        {
          "rowNumber": 20,
          "values": [
            "Laboratório 7",
            "30,89",
            "7,15 x 4,45"
          ]
        },
        {
          "rowNumber": 21,
          "values": [
            "Laboratório 8",
            "30,45",
            "7,00 x 4,25"
          ]
        },
        {
          "rowNumber": 22,
          "values": [
            "Circulação",
            "21,32",
            "1,50 x 14,15"
          ]
        },
        {
          "rowNumber": 23,
          "values": [
            "Espera",
            "42,58",
            null
          ]
        },
        {
          "rowNumber": 24,
          "values": [
            "Café",
            "4,95",
            "Não especificado"
          ]
        },
        {
          "rowNumber": 25,
          "values": [
            "WC PNE M",
            "2,70",
            "1,80 x 1,50"
          ]
        },
        {
          "rowNumber": 26,
          "values": [
            "WC PNE F",
            "2,70",
            "1,80 x 1,50"
          ]
        },
        {
          "rowNumber": 27,
          "values": [
            "WC M",
            "14,05",
            "3,37 x 3,80"
          ]
        },
        {
          "rowNumber": 28,
          "values": [
            "WC F",
            "14,05",
            "3,37 x 3,80"
          ]
        },
        {
          "rowNumber": 29,
          "values": [
            "Hall Elevador",
            null,
            null
          ]
        },
        {
          "rowNumber": 30,
          "values": [
            "Caixa de Escada",
            "17,50",
            "5,00 x 3,50"
          ]
        },
        {
          "rowNumber": 31,
          "values": [
            "2º Pavimento",
            null,
            null
          ]
        },
        {
          "rowNumber": 32,
          "values": [
            "Ambiente",
            "Área (m²)",
            "Dimensões (m)"
          ]
        },
        {
          "rowNumber": 33,
          "values": [
            "Espera",
            "42,37",
            null
          ]
        },
        {
          "rowNumber": 34,
          "values": [
            "Circulação",
            "32,01",
            "1,50 x 21,60"
          ]
        },
        {
          "rowNumber": 35,
          "values": [
            "Reunião 1",
            "15,42",
            "3,40 x 4,35"
          ]
        },
        {
          "rowNumber": 36,
          "values": [
            "Reunião 2",
            "16,22",
            "3,80 x 4,35"
          ]
        },
        {
          "rowNumber": 37,
          "values": [
            "Gabinete 1",
            "15,73",
            "3,40 x 4,35"
          ]
        },
        {
          "rowNumber": 38,
          "values": [
            "Gabinete 2",
            "15,42",
            "3,60 x 4,35"
          ]
        },
        {
          "rowNumber": 39,
          "values": [
            "Gabinete 3",
            "15,42",
            "3,60 x 4,35"
          ]
        },
        {
          "rowNumber": 40,
          "values": [
            "Gabinete 4",
            "15,42",
            "3,60 x 4,35"
          ]
        },
        {
          "rowNumber": 41,
          "values": [
            "Gabinete 5",
            "15,73",
            "3,40 x 4,35"
          ]
        },
        {
          "rowNumber": 42,
          "values": [
            "Gabinete 6",
            "15,42",
            "3,60 x 4,35"
          ]
        },
        {
          "rowNumber": 43,
          "values": [
            "Gabinete 7",
            "15,42",
            "3,60 x 4,35"
          ]
        },
        {
          "rowNumber": 44,
          "values": [
            "Gabinete 8",
            "15,42",
            "3,60 x 4,35"
          ]
        },
        {
          "rowNumber": 45,
          "values": [
            "Gabinete 9",
            "15,42",
            "3,60 x 4,35"
          ]
        },
        {
          "rowNumber": 46,
          "values": [
            "Gabinete 10",
            "14,85",
            "3,40 x 4,35"
          ]
        },
        {
          "rowNumber": 47,
          "values": [
            "Depósito de Material de Limpeza (DML)",
            "4,34",
            "2,05 x 2,15"
          ]
        },
        {
          "rowNumber": 48,
          "values": [
            "WC PNE M",
            "2,70",
            "1,80 x 1,50"
          ]
        },
        {
          "rowNumber": 49,
          "values": [
            "WC PNE F",
            "2,70",
            "1,80 x 1,50"
          ]
        },
        {
          "rowNumber": 50,
          "values": [
            "WC M",
            "14,05",
            "3,37 x 3,80"
          ]
        },
        {
          "rowNumber": 51,
          "values": [
            "WC F",
            "14,05",
            "3,37 x 3,80"
          ]
        },
        {
          "rowNumber": 52,
          "values": [
            "Hall Elevador",
            null,
            null
          ]
        },
        {
          "rowNumber": 53,
          "values": [
            "Caixa de Escada",
            "17,50",
            "5,00 x 3,50"
          ]
        }
      ]
    },
    {
      "name": "Estimativa Bancadas",
      "rows": [
        {
          "rowNumber": 1,
          "values": [
            "TABELA PRINCIPAL - DETALHAMENTO POR BANCADA",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 2,
          "values": [
            "LABORATÓRIO",
            "ÁREA (m²)",
            "BANCADA",
            "TIPO",
            "COMPRIMENTO (m)",
            "LARGURA (m)",
            "FORMATO",
            "ÁGUA",
            "TOMADAS",
            "GAVETEIROS",
            "ARMÁRIOS",
            "GÁS",
            "CADEIRAS",
            "OBSERVAÇÕES"
          ]
        },
        {
          "rowNumber": 3,
          "values": [
            "Lab 01 - Petróleo",
            53.25,
            "Bancada 01",
            "Fixa",
            10.9,
            0.7,
            "Linear",
            "2 pontos",
            "Sim",
            "Sim",
            "Sim",
            "Não",
            "Não",
            "-"
          ]
        },
        {
          "rowNumber": 4,
          "values": [
            "Lab 01 - Petróleo",
            53.25,
            "Bancada 02",
            "Fixa",
            7.8,
            0.7,
            "Linear",
            "Não",
            "Sim",
            "Sim",
            "Sim",
            "Sim",
            "Sim",
            "Passagem de gás"
          ]
        },
        {
          "rowNumber": 5,
          "values": [
            "Lab 01 - Petróleo",
            53.25,
            "Bancada 03",
            "Móvel",
            "4,00-8,00",
            0.7,
            "Ilha",
            "Não",
            "Sim",
            "Não",
            "Não",
            "Não",
            "Sim",
            "Opcional - Fiação pelo chão"
          ]
        },
        {
          "rowNumber": 6,
          "values": [
            "Lab 02 - Físico-Química",
            38.4,
            "Bancada 01",
            "Fixa",
            8.8,
            0.7,
            "Linear",
            "2 pontos",
            "Sim",
            "Sim",
            "Sim",
            "Não",
            "Não",
            "-"
          ]
        },
        {
          "rowNumber": 7,
          "values": [
            "Lab 02 - Físico-Química",
            38.4,
            "Bancada 02",
            "Fixa",
            6.2,
            0.7,
            "Linear",
            "Não",
            "Sim",
            "Sim",
            "Sim",
            "Não",
            "Sim",
            "-"
          ]
        },
        {
          "rowNumber": 8,
          "values": [
            "Lab 02 - Físico-Química",
            38.4,
            "Bancada 03",
            "Móvel",
            "4,00-8,00",
            0.7,
            "Ilha",
            "Não",
            "Sim",
            "Não",
            "Não",
            "Não",
            "Sim",
            "Opcional - Fiação pelo chão"
          ]
        },
        {
          "rowNumber": 9,
          "values": [
            "Lab 03 - Bioenergia",
            47.05,
            "Bancada 01",
            "Fixa",
            8.8,
            0.7,
            "Linear",
            "2 pontos",
            "Sim",
            "Sim",
            "Sim",
            "Não",
            "Não",
            "-"
          ]
        },
        {
          "rowNumber": 10,
          "values": [
            "Lab 03 - Bioenergia",
            47.05,
            "Bancada 02",
            "Fixa",
            7.2,
            0.7,
            "Linear",
            "Não",
            "Sim",
            "Sim",
            "Sim",
            "Não",
            "Não",
            "-"
          ]
        },
        {
          "rowNumber": 11,
          "values": [
            "Lab 03 - Bioenergia",
            47.05,
            "Bancada 03",
            "Móvel",
            2.4,
            0.7,
            "Ilha Dupla",
            "Não",
            "Sim",
            "Não",
            "Não",
            "Não",
            "Sim",
            "Prateleira alta central"
          ]
        },
        {
          "rowNumber": 12,
          "values": [
            "Lab 03 - Bioenergia",
            47.05,
            "Bancada 04",
            "Móvel",
            2.4,
            0.7,
            "Ilha Dupla",
            "Não",
            "Sim",
            "Não",
            "Não",
            "Não",
            "Sim",
            "Prateleira alta central"
          ]
        },
        {
          "rowNumber": 13,
          "values": [
            "Lab 03 - Bioenergia",
            47.05,
            "Bancada 05",
            "Móvel",
            2.4,
            0.7,
            "Ilha Dupla",
            "Não",
            "Sim",
            "Não",
            "Não",
            "Não",
            "Sim",
            "Prateleira alta central"
          ]
        },
        {
          "rowNumber": 14,
          "values": [
            "Lab 04 - Câmara Fria",
            46.58,
            "Bancada 01",
            "Fixa",
            "-",
            "-",
            "U (2,50x3,60x2,50)",
            "1 ponto",
            "Sim",
            "Sim",
            "Sim",
            "Não",
            "Não",
            "Apoio equipamentos"
          ]
        },
        {
          "rowNumber": 15,
          "values": [
            "Lab 04 - Câmara Fria",
            46.58,
            "Bancada 02",
            "Móvel",
            2,
            1,
            "Ilha",
            "Não",
            "Sim",
            "Não",
            "Não",
            "Não",
            "Não",
            "Apoio equipamentos"
          ]
        },
        {
          "rowNumber": 16,
          "values": [
            "RESUMO QUANTITATIVO",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 17,
          "values": [
            "ITEM",
            "QUANTIDADE",
            null,
            "OBSERVAÇÃO",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 18,
          "values": [
            "BANCADAS FIXAS",
            "7 unidades",
            null,
            "56,40m lineares totais",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 19,
          "values": [
            "Bancadas com água",
            "4 unidades",
            null,
            "7 pontos de água",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 20,
          "values": [
            "BANCADAS MÓVEIS",
            "6 unidades",
            null,
            "3 opcionais",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 21,
          "values": [
            "Bancadas formato U",
            "1 unidade",
            null,
            "Lab 04",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 22,
          "values": [
            "Bancadas ilha dupla",
            "3 unidades",
            null,
            "Lab 03",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 23,
          "values": [
            "Passagem de gás",
            "1 unidade",
            null,
            "Lab 01",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 24,
          "values": [
            "CHECKLIST DE INFRAESTRUTURA",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 25,
          "values": [
            "LABORATÓRIO",
            "ELÉTRICA",
            "HIDRÁULICA",
            null,
            "GÁS",
            "FIAÇÃO PISO",
            "STATUS",
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 26,
          "values": [
            "Lab 01 - Petróleo",
            "✓ Todas bancadas",
            "✓ 2 pontos",
            null,
            "✓ 1 bancada",
            "✓ Bancada móvel",
            "Pendente",
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 27,
          "values": [
            "Lab 02 - Físico-Química",
            "✓ Todas bancadas",
            "✓ 2 pontos",
            null,
            "-",
            "✓ Bancada móvel",
            "Pendente",
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 28,
          "values": [
            "Lab 03 - Bioenergia",
            "✓ Todas bancadas",
            "✓ 2 pontos",
            null,
            "-",
            "✓ 3 bancadas móveis",
            "Pendente",
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 29,
          "values": [
            "Lab 04 - Câmara Fria",
            "✓ Todas bancadas",
            "✓ 1 ponto",
            null,
            "-",
            "-",
            "Pendente",
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 31,
          "values": [
            "RESUMO QUANTITATIVO - 1º PAVIMENTO:",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 32,
          "values": [
            "ITEM",
            "QUANTIDADE",
            null,
            "OBSERVAÇÃO",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 33,
          "values": [
            "Bancadas lineares",
            "6 unidades",
            null,
            "37,50m lineares totais",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 34,
          "values": [
            "Bancada ilha",
            "1 unidade",
            null,
            "3,80 x 1,20m",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 35,
          "values": [
            "Módulos armário",
            "26 unidades",
            null,
            "2 portas cada",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 36,
          "values": [
            "Módulos gavetas",
            "13 unidades",
            null,
            "3 gavetas cada",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 37,
          "values": [
            "Capela",
            "1 unidade",
            null,
            "Com água e exaustão",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 38,
          "values": [
            "Pontos de água",
            "6 pontos",
            null,
            "Todas as bancadas",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 40,
          "values": [
            "LABORATÓRIO 5 - LEANDRO",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 41,
          "values": [
            "BANCADA",
            "DIMENSÕES (m)",
            "ÁREA (m²)",
            "MÓDULOS ARMÁRIO",
            "MÓDULOS GAVETAS",
            "ÁGUA",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 42,
          "values": [
            "Bancada 01",
            "7,00 x 0,70",
            4.9,
            "5 unidades",
            "2 unidades",
            "Sim",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 43,
          "values": [
            "Bancada 02",
            "5,50 x 0,70",
            3.85,
            "4 unidades",
            "2 unidades",
            "Sim",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 44,
          "values": [
            "SUBTOTAL LAB 5",
            "12,50m lineares",
            "8,75m²",
            "9 unidades",
            "4 unidades",
            "2 pontos",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 45,
          "values": [
            "LABORATÓRIO 6 - LEANDRO",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 46,
          "values": [
            "BANCADA",
            "DIMENSÕES (m)",
            "ÁREA (m²)",
            "MÓDULOS ARMÁRIO",
            "MÓDULOS GAVETAS",
            "ÁGUA",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 47,
          "values": [
            "Bancada 01",
            "7,00 x 0,70",
            4.9,
            "5 unidades",
            "2 unidades",
            "Sim",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 48,
          "values": [
            "Bancada 02",
            "5,50 x 0,70",
            3.85,
            "4 unidades",
            "2 unidades",
            "Sim",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 49,
          "values": [
            "SUBTOTAL LAB 6",
            "12,50m lineares",
            "8,75m²",
            "9 unidades",
            "4 unidades",
            "2 pontos",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 50,
          "values": [
            "LABORATÓRIO 7 - FÍSICO-QUÍMICA BRUNA",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 51,
          "values": [
            "BANCADA",
            "DIMENSÕES (m)",
            "ÁREA (m²)",
            "MÓDULOS ARMÁRIO",
            "MÓDULOS GAVETAS",
            "ÁGUA",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 52,
          "values": [
            "Bancada 01",
            "5,50 x 0,70",
            3.85,
            "4 unidades",
            "2 unidades",
            "Sim",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 53,
          "values": [
            "Bancada 02",
            "5,50 x 0,70",
            3.85,
            "4 unidades",
            "2 unidades",
            "Sim",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 54,
          "values": [
            "Bancada 03 - Ilha",
            "3,80 x 1,20",
            4.56,
            "3 unidades",
            "1 unidade",
            "Sim",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 55,
          "values": [
            "Capela",
            "1,00m largura",
            "-",
            "-",
            "-",
            "Sim",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 56,
          "values": [
            "SUBTOTAL LAB 7",
            "11,00m + ilha",
            "12,26m²",
            "8 unidades",
            "5 unidades",
            "4 pontos",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 58,
          "values": [
            "CHECKLIST DE INFRAESTRUTURA",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 59,
          "values": [
            "LABORATÓRIO",
            "ELÉTRICA",
            "HIDRÁULICA",
            "GÁS",
            "FIAÇÃO PISO",
            "STATUS",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 60,
          "values": [
            "Lab 5 - Leandro",
            "✓ Todas bancadas",
            "✓ 2 pontos",
            "-",
            "✓ Não necessário",
            "Pendente",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 61,
          "values": [
            "Lab 6 - Leandro",
            "✓ Todas bancadas",
            "✓ 2 pontos",
            "-",
            "✓ Não necessário",
            "Pendente",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 62,
          "values": [
            "Lab 7 - Bruna",
            "✓ Todas bancadas",
            "✓ 4 pontos",
            "✓ Capela",
            "✓ Não necessário",
            "Pendente",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          ]
        }
      ]
    },
    {
      "name": "Levantamento Mobiliário",
      "rows": [
        {
          "rowNumber": 1,
          "values": [
            "Mobiliário para Gabinetes 1;2;5 e 6 - Sala compartilhada - Pesquisadores (Mestrado/Doutorado/Pós-doc)",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 2,
          "values": [
            "Item",
            "Layout de Referência",
            "Quantidade por Gabinete",
            "Quantidade Total (4 Gabinetes)",
            "Especificação / Descrição Sugerida",
            "Dimensões Aproximadas (L x P x A)",
            "Observações"
          ]
        },
        {
          "rowNumber": 3,
          "values": [
            "ESTAÇÕES DE TRABALHO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 4,
          "values": [
            "Sistema de Bancada (Benching)",
            "Ilha Central",
            1,
            4,
            "Sistema modular para 6 posições (3+3, costas com costas), com calhas integradas para passagem de fiação elétrica e de dados. Acabamento em melamínico de cor neutra.",
            "3,60m x 1,25m x 0,75m",
            "O item mais importante. Medir cada sala antes de encomendar para garantir o ajuste exato."
          ]
        },
        {
          "rowNumber": 5,
          "values": [
            "Cadeira Ergonômica",
            "Ilha Central",
            6,
            24,
            "Cadeira giratória com rodízios, ajuste de altura, regulagem de inclinação do encosto e apoio lombar. Revestimento em tecido respirável.",
            "0,60m x 0,60m x 0,95m",
            "Priorizar a ergonomia devido ao longo tempo de uso pelos pesquisadores."
          ]
        },
        {
          "rowNumber": 6,
          "values": [
            "Divisória Central (para Bancada)",
            "Ilha Central",
            1,
            4,
            "Divisória alta para a espinha dorsal da bancada, com tecido acústico para absorção de ruído. Permite a separação visual e a passagem de cabos.",
            "3,60m x 0,05m x 1,20m",
            "A altura deve ser suficiente para dar privacidade (aprox. 45cm acima da mesa)."
          ]
        },
        {
          "rowNumber": 7,
          "values": [
            "Divisória Lateral (para Bancada)",
            "Ilha Central",
            4,
            16,
            "Divisórias baixas para separar as estações lado a lado. Podem ser de acrílico translúcido ou tecido acústico.",
            "0,60m x 0,05m x 1,10m",
            "Altura de aprox. 35cm acima da mesa para permitir a colaboração."
          ]
        },
        {
          "rowNumber": 8,
          "values": [
            "ARMAZENAMENTO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 9,
          "values": [
            "Armário Alto Compartilhado",
            "Apoio Lateral",
            1,
            4,
            "Armário com 2 portas e prateleiras internas reguláveis para armazenamento de materiais de pesquisa, livros e arquivos compartilhados.",
            "0,80m x 0,45m x 1,80m",
            "Essencial, pois o layout de bancada não permite gaveteiros individuais."
          ]
        },
        {
          "rowNumber": 10,
          "values": [
            "ACESSÓRIOS E APOIO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 11,
          "values": [
            "Quadro Branco Magnético",
            "Parede Livre",
            1,
            4,
            "Quadro para escrita e fixação de avisos e diagramas. Para ser montado na parede principal de entrada.",
            "1,80m x 1,20m",
            "Ferramenta chave para a colaboração da equipe."
          ]
        },
        {
          "rowNumber": 12,
          "values": [
            "Lixeira Coletiva",
            "Canto da Sala",
            2,
            8,
            "Lixeira de tamanho médio (20L), uma para lixo orgânico/comum e outra para recicláveis.",
            "0,30m x 0,30m x 0,50m",
            "O uso de lixeiras coletivas economiza espaço e incentiva a reciclagem."
          ]
        },
        {
          "rowNumber": 13,
          "values": [
            "Filtro de Linha / Régua de Tomadas",
            "Sob a Bancada",
            6,
            24,
            "Régua com no mínimo 4 tomadas por posição de trabalho para ligar computador, monitor, etc.",
            "N/A",
            "Deve ser instalado nas calhas do sistema de bancada."
          ]
        },
        {
          "rowNumber": 15,
          "values": [
            "Mobiliário para Gabinetes 9 e 10 / 3 e 7 - Sala compartilhada - Gabinete administrativo",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 16,
          "values": [
            "Item",
            "Layout de Referência",
            "Gabinetes 7 e 3 (Qtd/Gabinete)",
            "Gabinetes 9 e 10 (Qtd/Gabinete)",
            "Especificação / Descrição Sugerida",
            "Dimensões Aproximadas",
            "Observações"
          ]
        },
        {
          "rowNumber": 17,
          "values": [
            "ESTAÇÕES DE TRABALHO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 18,
          "values": [
            "Mesa em \"L\"",
            "Canto da Sala",
            1,
            1,
            "Mesa executiva formato \"L\" com tampo principal 1,35 x 0,80m e extensão curva 0,80 x 0,54m. Acabamento em melamínico de cor neutra com bordas em PVC.",
            "1,35x0,80m + 0,80x0,54m",
            "Ideal para trabalhos que demandam mais espaço e organização de documentos."
          ]
        },
        {
          "rowNumber": 19,
          "values": [
            "Cadeira Executiva",
            "Mesa em \"L\"",
            1,
            1,
            "Cadeira presidente com encosto alto, apoio lombar, braços reguláveis, base giratória e rodízios. Revestimento em courino ou tecido de alta qualidade.",
            "0,65m x 0,65m x 1,15m",
            "Conforto superior para uso prolongado em atividades administrativas."
          ]
        },
        {
          "rowNumber": 20,
          "values": [
            "ARMAZENAMENTO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 21,
          "values": [
            "Armário Simples",
            "Parede Lateral",
            1,
            1,
            "Armário com 2 portas, 3 prateleiras internas reguláveis para armazenamento de documentos, livros e materiais de trabalho.",
            "0,80m x 0,40m x 1,60m",
            "Essencial para organização de documentos administrativos e materiais de pesquisa."
          ]
        },
        {
          "rowNumber": 22,
          "values": [
            "Gaveteiro",
            "Sob Mesa L",
            1,
            1,
            "Gaveteiro móvel com 3 gavetas, corrediças telescópicas e fechadura. Compatível com vão da mesa em L.",
            "0,40m x 0,50m x 0,60m",
            "Armazenamento pessoal próximo à área de trabalho."
          ]
        },
        {
          "rowNumber": 23,
          "values": [
            "ACESSÓRIOS E APOIO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 24,
          "values": [
            "Suporte para CPU",
            "Sob Mesa",
            1,
            1,
            "Suporte móvel em aço com rodízios para posicionamento do gabinete do computador.",
            "0,20m x 0,45m x 0,30m",
            "Proteção do equipamento e facilitação da limpeza."
          ]
        },
        {
          "rowNumber": 25,
          "values": [
            "Organizador de Mesa",
            "Sobre Mesa L",
            1,
            1,
            "Organizador com compartimentos para canetas, papel, clipes e outros materiais de escritório.",
            "0,30m x 0,20m x 0,15m",
            "Manutenção da organização da área de trabalho."
          ]
        },
        {
          "rowNumber": 26,
          "values": [
            "Lixeira Individual",
            "Canto da Sala",
            1,
            1,
            "Lixeira de 15L com pedal, adequada para uso individual em escritórios.",
            "0,25m x 0,25m x 0,40m",
            "Praticidade para descarte de resíduos do dia a dia."
          ]
        },
        {
          "rowNumber": 27,
          "values": [
            "Régua de Tomadas",
            "Sob Mesa L",
            1,
            1,
            "Régua com 6 tomadas e entrada USB para conexão de equipamentos eletrônicos.",
            "N/A",
            "Conectividade adequada para equipamentos de escritório."
          ]
        },
        {
          "rowNumber": 29,
          "values": [
            "Mobiliário para Gabinetes 4 e 8 - Sala dos Coordenadores - Leandro e Bruna (Salas Executivas)",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 30,
          "values": [
            "Item",
            "Layout de Referência",
            "Gabinetes 4 e 8 (Qtd/Gabinete)",
            "Quantidade Total",
            "Especificação / Descrição Sugerida",
            "Dimensões Aproximadas",
            "Observações"
          ]
        },
        {
          "rowNumber": 31,
          "values": [
            "ESTAÇÃO DE TRABALHO PRINCIPAL",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 32,
          "values": [
            "Mesa Executiva em \"L\" Premium",
            "Canto Principal",
            1,
            2,
            "Mesa executiva formato \"L\" de alta qualidade com tampo principal 1,50 x 0,90m e extensão 0,90 x 0,60m. Acabamento em madeira nobre ou laminado premium. Passagem de cabos integrada.",
            "1,50x0,90m + 0,90x0,60m",
            "Dimensões ampliadas para coordenação e reuniões. Qualidade superior."
          ]
        },
        {
          "rowNumber": 33,
          "values": [
            "Cadeira Presidente",
            "Mesa Executiva",
            1,
            2,
            "Cadeira presidente de couro ou tecido premium, encosto alto com apoio cervical, braços reguláveis, mecanismo relax e base cromada.",
            "0,70m x 0,70m x 1,20m",
            "Conforto máximo para longas jornadas de coordenação."
          ]
        },
        {
          "rowNumber": 34,
          "values": [
            "MESA DE APOIO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 35,
          "values": [
            "Mesa em \"L\"",
            "Canto da Sala",
            1,
            2,
            "Mesa executiva formato \"L\" com tampo principal 1,35 x 0,80m e extensão curva 0,80 x 0,54m. Acabamento em melamínico de cor neutra com bordas em PVC.",
            "1,35x0,80m + 0,80x0,54m",
            "Ideal para trabalhos que demandam mais espaço e organização de documentos."
          ]
        },
        {
          "rowNumber": 36,
          "values": [
            "Cadeira Executiva",
            "Mesa em \"L\"",
            1,
            2,
            "Cadeira presidente com encosto alto, apoio lombar, braços reguláveis, base giratória e rodízios. Revestimento em courino ou tecido de alta qualidade.",
            "0,65m x 0,65m x 1,15m",
            "Conforto superior para uso prolongado em atividades administrativas."
          ]
        },
        {
          "rowNumber": 37,
          "values": [
            "ARMAZENAMENTO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 38,
          "values": [
            "Estante Modular",
            "Parede Principal",
            1,
            2,
            "Estante alta de 5 prateleiras com portas de vidro na parte superior e portas cegas na inferior. Para livros, documentos e objetos pessoais.",
            "0,90m x 0,35m x 1,80m",
            "Organização e exposição de bibliografia técnica."
          ]
        },
        {
          "rowNumber": 39,
          "values": [
            "Arquivo de Aço",
            "Canto Lateral",
            1,
            2,
            "Arquivo de aço com 4 gavetas para pastas suspensas, fechadura e identificação. Para documentos confidenciais.",
            "0,47m x 0,62m x 1,35m",
            "Segurança para documentos administrativos importantes."
          ]
        },
        {
          "rowNumber": 40,
          "values": [
            "Credenza",
            "Sob Janela",
            1,
            2,
            "Móvel baixo com 2 portas e 1 gaveta central para apoio de equipamentos e armazenamento. Tampo para apoio de objetos.",
            "1,20m x 0,45m x 0,75m",
            "Apoio adicional e organização de materiais."
          ]
        },
        {
          "rowNumber": 41,
          "values": [
            "ACESSÓRIOS E TECNOLOGIA",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 42,
          "values": [
            "Suporte para Monitor Duplo",
            "Mesa Executiva",
            1,
            2,
            "Suporte articulado para dois monitores com ajuste de altura, rotação e inclinação.",
            "N/A",
            "Produtividade para trabalho com múltiplas telas."
          ]
        },
        {
          "rowNumber": 43,
          "values": [
            "Organizador Executivo",
            "Mesa Executiva",
            1,
            2,
            "Organizador em madeira ou couro com compartimentos para canetas, cartões, papéis e acessórios.",
            "0,40m x 0,25m x 0,15m",
            "Sofisticação e organização da mesa de trabalho."
          ]
        },
        {
          "rowNumber": 44,
          "values": [
            "Luminária de Mesa",
            "Mesa Executiva",
            1,
            2,
            "Luminária LED articulada com controle de intensidade e temperatura de cor. Design executivo.",
            "N/A",
            "Iluminação focada para leitura e trabalho detalhado."
          ]
        },
        {
          "rowNumber": 45,
          "values": [
            "Quadro Branco Executivo",
            "Parede Lateral",
            1,
            2,
            "Quadro branco com moldura em alumínio e apoio para marcadores. Adequado para planejamento estratégico.",
            "1,50m x 1,00m",
            "Ferramenta para planejamento e apresentações"
          ]
        },
        {
          "rowNumber": 46,
          "values": [
            "Lixeira Individual",
            "Canto da Sala",
            2,
            4,
            "Lixeira de 15L com pedal, adequada para uso individual em escritórios.",
            "0,25m x 0,25m x 0,40m",
            "Praticidade para descarte de resíduos do dia a dia."
          ]
        },
        {
          "rowNumber": 47,
          "values": [
            "Régua de Tomadas",
            "Sob Mesa L",
            2,
            4,
            "Régua com 6 tomadas e entrada USB para conexão de equipamentos eletrônicos.",
            "N/A",
            "Conectividade adequada para equipamentos de escritório."
          ]
        },
        {
          "rowNumber": 49,
          "values": [
            "Mobiliário para Salas de Reunião 1 e 2 - Salas de reunião e trabalho colaborativo",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 50,
          "values": [
            "Item",
            "Layout de Referência",
            "Reunião 1 (Qtd)",
            "Reunião 2 (Qtd)",
            "Especificação / Descrição Sugerida",
            "Dimensões Aproximadas",
            "Observações"
          ]
        },
        {
          "rowNumber": 51,
          "values": [
            "MOBILIÁRIO PRINCIPAL",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 52,
          "values": [
            "Mesa de Reunião Modular",
            "Centro da Sala",
            1,
            1,
            "Mesa retangular modular com tampo de 2,40 x 1,00m, estrutura em aço e tampo em melamínico premium. Passagem de cabos integrada.",
            "2,40m x 1,00m x 0,75m",
            "Modulares para permitir configurações diferentes quando integradas."
          ]
        },
        {
          "rowNumber": 53,
          "values": [
            "Cadeiras de Reunião",
            "Perímetro Mesa",
            8,
            8,
            "Cadeiras fixas com assento e encosto estofados, braços opcionais, empilháveis. Design executivo compatível com laboratório.",
            "0,55m x 0,55m x 0,85m",
            "Conforto para reuniões de 2-3 horas. Empilháveis para flexibilidade."
          ]
        },
        {
          "rowNumber": 54,
          "values": [
            "TECNOLOGIA E APRESENTAÇÃO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 55,
          "values": [
            "Suporte TV/Projetor",
            "Parede Principal",
            1,
            1,
            "Suporte de parede articulado para TV 55-65\" ou projetor, com ajuste de altura e inclinação.",
            "N/A",
            "Cada sala independente com sistema audiovisual."
          ]
        },
        {
          "rowNumber": 56,
          "values": [
            "Mesa de Apoio Audiovisual",
            "Lateral",
            1,
            1,
            "Mesa pequena para equipamentos audiovisuais, notebook e materiais de apresentação.",
            "0,80m x 0,50m x 0,75m",
            "Próxima ao sistema de projeção para facilitar operação."
          ]
        },
        {
          "rowNumber": 57,
          "values": [
            "ARMAZENAMENTO E APOIO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 58,
          "values": [
            "Armário Baixo Modular",
            "Parede Lateral",
            1,
            1,
            "Armário baixo de 2 portas para armazenamento de materiais de reunião, projetores portáteis e documentos.",
            "1,20m x 0,45m x 0,75m",
            "Pode servir como apoio adicional quando necessário."
          ]
        },
        {
          "rowNumber": 59,
          "values": [
            "Flipchart Móvel",
            "Canto da Sala",
            1,
            1,
            "Flipchart com tripé regulável, quadro branco magnético dupla face e apoio para marcadores.",
            "0,70m x 1,00m",
            "Mobilidade para posicionamento otimizado conforme layout."
          ]
        },
        {
          "rowNumber": 60,
          "values": [
            "ACESSÓRIOS",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 61,
          "values": [
            "Quadro Branco",
            "Parede Frontal",
            1,
            1,
            "Quadro branco magnético de alta qualidade com moldura em alumínio e apoio para marcadores.",
            "1,80m x 1,00m",
            "Ferramenta fundamental para apresentações e brainstorming."
          ]
        },
        {
          "rowNumber": 62,
          "values": [
            "Lixeira Seletiva",
            "Canto Discreto",
            1,
            1,
            "Conjunto com 2 lixeiras (comum e reciclável) de design discreto.",
            "0,25m x 0,25m x 0,35m",
            "Manutenção da organização durante reuniões longas."
          ]
        },
        {
          "rowNumber": 63,
          "values": [
            "Régua de Tomadas Mesa",
            "Embutida Mesa",
            2,
            2,
            "Régua retrátil com 6 tomadas + USB embutida na mesa de reunião.",
            "N/A",
            "Conectividade para notebooks e equipamentos dos participantes."
          ]
        },
        {
          "rowNumber": 64,
          "values": [
            "Monitor Interativo Central",
            "Centro da Mesa",
            1,
            1,
            "Monitor touchscreen 24\" retrátil embutido na mesa para apresentações colaborativas, espelhamento de tela e anotações digitais.",
            "24\" (54x30cm)",
            "Sistema retrátil para não interferir no uso normal da mesa."
          ]
        },
        {
          "rowNumber": 65,
          "values": [
            "Câmera de Reunião 360°",
            "Centro do Teto",
            1,
            1,
            "Câmera PTZ com visão 360°, zoom óptico 12x, resolução 4K, rastreamento automático de voz e integração com Teams/Zoom.",
            "Ø 15cm x 12cm altura",
            "Posicionamento central para capturar todos os participantes."
          ]
        },
        {
          "rowNumber": 66,
          "values": [
            "Microfone Omnidirecional",
            "Centro da Mesa",
            1,
            1,
            "Sistema de microfone com captação omnidirecional 360°, cancelamento de ruído, alcance de 6m e conectividade USB/Bluetooth.",
            "Ø 12cm x 4cm altura",
            "Design discreto que não obstrui a visão entre participantes."
          ]
        },
        {
          "rowNumber": 67,
          "values": [
            "Alto-falantes Direcionais",
            "Teto/Parede",
            2,
            2,
            "Sistema de som estéreo com alto-falantes direcionais, potência 40W, frequência 50Hz-20kHz.",
            "20x15x10cm cada",
            "Posicionamento estratégico para áudio uniforme."
          ]
        },
        {
          "rowNumber": 68,
          "values": [
            "Hub de Conectividade",
            "Embutido Mesa",
            1,
            1,
            "Central de conexões com HDMI, USB-C, USB 3.0, rede cabeada e carregamento wireless para dispositivos móveis.",
            "15x10x3cm",
            "Integrado discretamente na mesa de reunião."
          ]
        },
        {
          "rowNumber": 70,
          "values": [
            "Mobiliário para Auditório - 1o Pavimento",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 71,
          "values": [
            "Item",
            "Zona",
            "Quantidade",
            "Dimensões Aproximadas",
            "Especificação / Descrição Sugerida",
            null,
            "Observações"
          ]
        },
        {
          "rowNumber": 72,
          "values": [
            "ÁREA DE ENSINO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 73,
          "values": [
            "Mesa de Professor",
            "Frontal Central",
            1,
            "1,50m x 0,80m x 0,75m",
            "Mesa executiva com altura regulável, tampo amplo para materiais didáticos e notebook. Rodízios com freio.",
            null,
            "Móvel para reposicionamento conforme necessidade da aula."
          ]
        },
        {
          "rowNumber": 74,
          "values": [
            "Cadeira Professor",
            "Mesa Professor",
            1,
            "0,65m x 0,65m x 1,10m",
            "Cadeira ergonômica presidente com apoio lombar, braços reguláveis e rodízios silenciosos.",
            null,
            "Conforto para longas sessões de ensino."
          ]
        },
        {
          "rowNumber": 75,
          "values": [
            "SISTEMA DE PROJEÇÃO EDUCACIONAL",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 76,
          "values": [
            "Tela de Projeção Fixa Ou Televisor Grande",
            "Parede Frontal",
            1,
            "3,50m x 2,00m",
            "Tela branca mate de 3,50 x 2,00m, moldura preta, fixação em parede com isolamento acústico.",
            null,
            "Tamanho otimizado para visualização em toda sala."
          ]
        },
        {
          "rowNumber": 77,
          "values": [
            "Projetor Interativo",
            "Teto Frontal",
            1,
            "N/A",
            "Projetor ultra-curta distância 4000 lúmens, interativo, resolução Full HD com software educacional.",
            null,
            "Evita sombras do professor na projeção."
          ]
        },
        {
          "rowNumber": 78,
          "values": [
            "ASSENTOS CONFORTÁVEIS PARA VISITANTES",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 79,
          "values": [
            "Poltronas Executivas (Fileiras A-B)",
            "2 Primeiras Fileiras",
            20,
            "0,70m x 0,65m x 0,85m",
            "Poltronas estofadas premium com braços fixos, apoio lombar, assento densidade 50, revestimento em couro ecológico ou tecido nobre.",
            null,
            "Máximo conforto para visitantes VIP e palestrantes."
          ]
        },
        {
          "rowNumber": 80,
          "values": [
            "Poltronas Confortáveis (Fileiras C-H)",
            "3ª a 8ª Fileiras",
            30,
            "0,65m x 0,60m x 0,80m",
            "Poltronas semi-executivas estofadas com braços, encosto reclinável, porta-objetos lateral e suporte para tablet.",
            null,
            "Conforto superior para aulas e cursos longos."
          ]
        },
        {
          "rowNumber": 81,
          "values": [
            "Poltronas Extras",
            "Lateral Móvel",
            8,
            "0,60m x 0,55m x 0,80m",
            "Poltronas empilháveis confortáveis para acomodação adicional em eventos especiais.",
            null,
            "Flexibilidade para diferentes configurações."
          ]
        },
        {
          "rowNumber": 82,
          "values": [
            "ARMAZENAMENTO EDUCACIONAL",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 83,
          "values": [
            "Armário para Materiais",
            "Lateral Direita",
            2,
            "0,90m x 0,45m x 1,80m",
            "Armário alto com portas de vidro temperado para materiais didáticos, livros e equipamentos de aula.",
            null,
            "Organização de recursos educacionais."
          ]
        },
        {
          "rowNumber": 84,
          "values": [
            "Estante Mobile",
            "Fundo da Sala",
            1,
            "1,20m x 0,35m x 1,60m",
            "Estante móvel com rodízios para livros de consulta e materiais complementares.",
            null,
            "Acesso fácil durante as aulas."
          ]
        },
        {
          "rowNumber": 85,
          "values": [
            "TECNOLOGIA EDUCACIONAL",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 86,
          "values": [
            "Quadro Branco Magnético",
            "Parede Frontal",
            1,
            "4,00m x 1,20m",
            "Quadro branco de alta qualidade 4,00 x 1,20m com superfície magnética e apoio para marcadores.",
            null,
            "Ferramenta fundamental para explicações."
          ]
        },
        {
          "rowNumber": 87,
          "values": [
            "Mesa de Controle",
            "Fundo Lateral",
            1,
            "1,00m x 0,60m x 0,75m",
            "Mesa técnica com gavetas para controle de equipamentos audiovisuais e materiais do curso.",
            null,
            "Operação discreta durante aulas."
          ]
        },
        {
          "rowNumber": 88,
          "values": [
            "Sistema de Som Educacional",
            "Distribuído",
            1,
            "N/A",
            "Sistema com 6 alto-falantes de parede, amplificador, microfone sem fio e microfone de lapela para professor.",
            null,
            "Áudio claro para toda audiência de 76 pessoas."
          ]
        },
        {
          "rowNumber": 89,
          "values": [
            "CONFORTO E APOIO",
            null,
            null,
            null,
            null,
            null,
            null
          ]
        },
        {
          "rowNumber": 90,
          "values": [
            "Mesa de Apoio Lateral",
            "Fundo da Sala",
            2,
            "1,20m x 0,60m x 0,75m",
            "Mesas para apoio de materiais, coffee break ou documentos dos participantes.",
            null,
            "Suporte para atividades complementares."
          ]
        }
      ]
    }
  ]
};
