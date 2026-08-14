import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InteractionFeedbackProvider, useInteractionFeedback } from './interaction-feedback';

function Trigger() {
  const { notify } = useInteractionFeedback();
  return <button onClick={() => notify('Alteração registrada.', 'success')} type="button">Salvar</button>;
}

describe('InteractionFeedbackProvider', () => {
  it('anuncia a confirmação e permite dispensá-la', () => {
    render(<InteractionFeedbackProvider><Trigger /></InteractionFeedbackProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('status')).toHaveTextContent('Alteração registrada.');

    fireEvent.click(screen.getByRole('button', { name: 'Dispensar aviso' }));
    expect(screen.queryByText('Alteração registrada.')).not.toBeInTheDocument();
  });
});
