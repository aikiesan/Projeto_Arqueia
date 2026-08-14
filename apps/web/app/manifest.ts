import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: '#f4f6f3',
    description: 'Gestão, rastreabilidade e compartilhamento de infraestrutura laboratorial.',
    display: 'standalone',
    icons: [
      {
        purpose: 'any',
        sizes: 'any',
        src: '/icons/arqueia.svg',
        type: 'image/svg+xml',
      },
      {
        purpose: 'maskable',
        sizes: 'any',
        src: '/icons/arqueia-maskable.svg',
        type: 'image/svg+xml',
      },
    ],
    id: '/',
    lang: 'pt-BR',
    name: 'Arqueia — Gestão laboratorial',
    orientation: 'portrait-primary',
    scope: '/',
    short_name: 'Arqueia',
    start_url: '/',
    theme_color: '#123f34',
  };
}
