import { LoginForm } from './login-form';

function safeNext(next: string | undefined): string {
  if (typeof next !== 'string') return '/';
  // Only allow internal, absolute paths — never open redirects.
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly next?: string }>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={safeNext(next)} />;
}
