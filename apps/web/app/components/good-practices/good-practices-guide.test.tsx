import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GoodPracticesGuide } from './good-practices-guide';

describe('GoodPracticesGuide', () => {
  it('mostra de cara o essencial e o que fazer em caso de acidente', () => {
    render(<GoodPracticesGuide />);

    expect(screen.getByRole('heading', { level: 2, name: 'Antes de entrar' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Durante o trabalho' })).toBeVisible();
    const emergency = screen.getByRole('region', { name: /Em caso de acidente/ });
    expect(within(emergency).getByRole('link', { name: '(19) 3521-6000' })).toHaveAttribute(
      'href',
      'tel:+551935216000',
    );
    expect(within(emergency).getByRole('link', { name: 'SAMU 192' })).toHaveAttribute('href', 'tel:192');
    expect(within(emergency).getByRole('link', { name: /Avisar a coordenação/ })).toHaveAttribute(
      'href',
      '/informar',
    );
  });

  it('cita a fonte e baixa o PDF do site oficial, em nova aba', () => {
    render(<GoodPracticesGuide />);

    const download = screen.getByRole('link', { name: /Baixar o guia completo/ });
    expect(download).toHaveAttribute('href', expect.stringMatching(/^https:\/\/limhc\.fm\.usp\.br\//));
    expect(download).toHaveAttribute('target', '_blank');
    expect(download).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText('Guia de Boas Práticas Laboratoriais')).toBeInTheDocument();
  });

  it('o sumário abre a seção recolhida para onde aponta', () => {
    render(<GoodPracticesGuide />);
    const details = document.getElementById('descarte') as HTMLDetailsElement;
    expect(details.open).toBe(false);

    fireEvent.click(screen.getByRole('link', { name: 'Descarte de resíduos' }));

    expect(details.open).toBe(true);
  });

  it('filtra as incompatibilidades químicas pela busca', () => {
    render(<GoodPracticesGuide />);
    fireEvent.click(screen.getByRole('link', { name: 'Incompatibilidades químicas' }));

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar substância' }), {
      target: { value: 'acetona' },
    });

    expect(screen.getByText('Acetona')).toBeInTheDocument();
    expect(screen.queryByText('Mercúrio')).not.toBeInTheDocument();
  });

  it('usa títulos de nível 3 dentro do Guia de Uso e leva o Informar ao laboratório', () => {
    render(<GoodPracticesGuide headingLevel={3} reportHref="/informar?laboratory=lab-1" />);

    expect(screen.getByRole('heading', { level: 3, name: 'Antes de entrar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Avisar a coordenação/ })).toHaveAttribute(
      'href',
      '/informar?laboratory=lab-1',
    );
  });
});
