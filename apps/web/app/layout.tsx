import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@arqueia/ui/styles.css';
import './globals.css';

import { withBasePath } from './lib/base-path';
import { PwaRegistration } from './pwa-registration';
import { InteractionFeedbackProvider } from './interaction-feedback';

export const metadata: Metadata = {
  applicationName: 'Arqueia',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Arqueia',
  },
  description: 'Gestão, rastreabilidade e compartilhamento de infraestrutura laboratorial.',
  icons: {
    apple: [{ url: withBasePath('/icons/arqueia-maskable.svg') }],
    icon: [{ type: 'image/svg+xml', url: withBasePath('/icons/arqueia.svg') }],
  },
  manifest: withBasePath('/manifest.webmanifest'),
  title: {
    default: 'Arqueia',
    template: '%s · Arqueia',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#123f34',
  viewportFit: 'cover',
  width: 'device-width',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>
        <InteractionFeedbackProvider>
          {children}
          <PwaRegistration />
        </InteractionFeedbackProvider>
      </body>
    </html>
  );
}
