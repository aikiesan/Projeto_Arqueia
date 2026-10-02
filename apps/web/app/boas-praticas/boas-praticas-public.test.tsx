import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BoasPraticasPublic } from './boas-praticas-public';

describe('BoasPraticasPublic', () => {
  it('apresenta o guia sem login, com atalhos para Informar e para a agenda', () => {
    render(<BoasPraticasPublic />);

    expect(screen.getByRole('heading', { level: 1, name: 'Boas práticas de laboratório' })).toBeInTheDocument();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Informar' })).toHaveAttribute('href', '/informar');
    expect(within(header).getByRole('link', { name: 'Ver agenda' })).toHaveAttribute('href', '/agenda-publica');
    expect(screen.getByRole('heading', { level: 2, name: 'Em caso de acidente' })).toBeInTheDocument();
  });
});
