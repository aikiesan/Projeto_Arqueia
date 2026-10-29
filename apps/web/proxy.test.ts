import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { proxy } from './proxy';

function visit(path: string, withSession = false): NextRequest {
  const request = new NextRequest(new URL(`http://localhost:4002${path}`));
  if (withSession) request.cookies.set('arqueia_session', 'token');
  return request;
}

function redirectedTo(path: string, withSession = false): string | null {
  const response = proxy(visit(path, withSession));
  return response.headers.get('location');
}

describe('proxy — quem passa sem sessão', () => {
  it('deixa passar o fluxo de "esqueci minha senha", que não tem como autenticar', () => {
    expect(redirectedTo('/esqueci-senha')).toBeNull();
    expect(redirectedTo('/redefinir-senha')).toBeNull();
  });

  it('continua exigindo sessão nas páginas de dados', () => {
    expect(redirectedTo('/estoque')).toContain('/login?next=%2Festoque');
    expect(redirectedTo('/informes')).toContain('/login?next=%2Finformes');
    expect(redirectedTo('/usuarios')).toContain('/login?next=%2Fusuarios');
  });

  it('mantém abertas as rotas públicas que já existiam', () => {
    expect(redirectedTo('/agenda-publica')).toBeNull();
    expect(redirectedTo('/informar')).toBeNull();
    expect(redirectedTo('/boas-praticas')).toBeNull();
  });

  it('tira de /login quem já tem sessão', () => {
    expect(redirectedTo('/login', true)).toContain('/');
  });
});
