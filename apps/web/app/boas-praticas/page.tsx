import type { Metadata } from 'next';

import { BoasPraticasPublic } from './boas-praticas-public';

export const metadata: Metadata = {
  title: 'Boas práticas de laboratório · Arqueia',
  description: 'Checklist de segurança e boas práticas para quem usa os laboratórios do CP2b.',
};

export default function BoasPraticasPage(): React.JSX.Element {
  return <BoasPraticasPublic />;
}
