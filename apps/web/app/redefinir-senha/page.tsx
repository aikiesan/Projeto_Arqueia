import type { Metadata } from 'next';

import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Redefinir senha',
  // O token vive na URL; mantê-la fora de índices é o mínimo.
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const single = Array.isArray(token) ? token[0] : token;
  return <ResetPasswordForm token={typeof single === 'string' ? single.trim() : ''} />;
}
