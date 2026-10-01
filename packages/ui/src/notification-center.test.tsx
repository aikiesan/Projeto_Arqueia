import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NotificationCenter, type NotificationCenterProps } from './notification-center';

const props: NotificationCenterProps = {
  basePath: '/arqueia',
  count: 2,
  emptyLabel: 'Nenhum informe novo.',
  items: [
    {
      id: 'a',
      title: 'Problema em equipamento',
      description: 'HPLC Shimadzu · erro de pressão',
      timeLabel: 'há 2 min',
      href: '/informes?laboratory=lab-1',
      urgent: true,
    },
    {
      id: 'b',
      title: 'Uso de insumos',
      description: 'Usei 50 mL de metanol',
      timeLabel: 'há 1 h',
      href: '/informes?laboratory=lab-1',
    },
  ],
  title: 'Informes novos',
  viewAll: { href: '/informes?laboratory=lab-1', label: 'Ver todos os informes' },
};

describe('NotificationCenter', () => {
  it('mostra o contador só quando há novidades e o anuncia no nome do botão', () => {
    const { rerender } = render(<NotificationCenter {...props} />);

    expect(screen.getByRole('button', { name: 'Notificações: 2 novas' })).toHaveTextContent('2');

    rerender(<NotificationCenter {...props} count={0} items={[]} />);
    const bell = screen.getByRole('button', { name: 'Notificações' });
    expect(bell).not.toHaveTextContent(/\d/);
  });

  it('limita o contador visível a 99+', () => {
    render(<NotificationCenter {...props} count={140} />);

    expect(screen.getByRole('button', { name: 'Notificações: 140 novas' })).toHaveTextContent('99+');
  });

  it('abre a lista com links prefixados, destaca o urgente e avisa quem é dono dos dados', () => {
    const onOpen = vi.fn();
    render(<NotificationCenter {...props} onOpen={onOpen} />);

    const bell = screen.getByRole('button', { name: /Notificações/ });
    fireEvent.click(bell);

    expect(onOpen).toHaveBeenCalledOnce();
    expect(bell).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: 'Informes novos' });
    const links = within(panel).getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/arqueia/informes?laboratory=lab-1');
    expect(links[0]).toHaveClass('is-urgent');
    expect(links[1]).not.toHaveClass('is-urgent');
    expect(within(panel).getByRole('link', { name: /Ver todos os informes/ })).toBeInTheDocument();
  });

  it('fecha com Esc devolvendo o foco ao sino, e com clique fora', () => {
    render(
      <div>
        <NotificationCenter {...props} />
        <p>fora</p>
      </div>,
    );
    const bell = screen.getByRole('button', { name: /Notificações/ });

    fireEvent.click(bell);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(bell).toHaveFocus();

    fireEvent.click(bell);
    fireEvent.pointerDown(screen.getByText('fora'));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('mostra o estado vazio e o de erro', () => {
    const { rerender } = render(<NotificationCenter {...props} count={0} items={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));
    expect(screen.getByText('Nenhum informe novo.')).toBeInTheDocument();

    rerender(<NotificationCenter {...props} count={0} items={[]} status="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar');
  });
});
