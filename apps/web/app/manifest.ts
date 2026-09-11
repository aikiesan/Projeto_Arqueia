import type { MetadataRoute } from 'next';

import { normalizeBasePath } from '@arqueia/ui';

export default function manifest(): MetadataRoute.Manifest {
  // Lido dentro da função: o Next não aplica `basePath` a nenhum campo do
  // manifest, e a leitura aqui mantém o valor sobrescrevível nos testes.
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  // A barra final importa: `/arqueia` como escopo também casaria `/arqueiaXYZ`.
  const scope = `${basePath}/`;

  return {
    background_color: '#f4f6f3',
    description: 'Gestão, rastreabilidade e compartilhamento de infraestrutura laboratorial.',
    display: 'standalone',
    icons: [
      {
        purpose: 'any',
        sizes: 'any',
        src: `${basePath}/icons/arqueia.svg`,
        type: 'image/svg+xml',
      },
      {
        purpose: 'maskable',
        sizes: 'any',
        src: `${basePath}/icons/arqueia-maskable.svg`,
        type: 'image/svg+xml',
      },
    ],
    id: scope,
    lang: 'pt-BR',
    name: 'Arqueia — Gestão laboratorial',
    orientation: 'portrait-primary',
    scope,
    short_name: 'Arqueia',
    start_url: scope,
    theme_color: '#123f34',
  };
}
