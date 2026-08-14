import { test, expect } from '@playwright/test';

test.describe('Agenda & Reservas Operacionais E2E', () => {
  test('Navega para a página de agenda e verifica controles principais', async ({ page }) => {
    // Acessar rota /agenda
    await page.goto('/agenda');

    // Verificar o cabeçalho
    await expect(page.locator('h2')).toContainText('Agenda de Equipamentos');

    // Verificar botões de alternância de visão (Dia, Semana, Mês)
    await expect(page.getByRole('button', { name: 'Dia' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Semana' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mês' })).toBeVisible();

    // Verificar o botão de Nova Reserva
    await expect(page.getByRole('button', { name: /Nova Reserva/i })).toBeVisible();
  });

  test('Abre modal de reserva e valida campos obrigatórios (Equipamento e Projeto)', async ({ page }) => {
    await page.goto('/agenda');

    // Clicar no botão Nova Reserva
    await page.getByRole('button', { name: /Nova Reserva/i }).click();

    // Verificar título do modal
    await expect(page.locator('#res-title')).toHaveText('Nova Reserva de Equipamento');

    // Verificar presenças do select de Projeto obrigatório
    await expect(page.locator('select[name="projectId"]')).toBeVisible();

    // Tentar enviar formulário sem selecionar equipamento e projeto
    await page.getByRole('button', { name: /Confirmar Reserva/i }).click();

    // O navegador deve aplicar validação de campo obrigatório HTML5
    const projectSelect = page.locator('select[name="projectId"]');
    expect(await projectSelect.evaluate((el: HTMLSelectElement) => el.checkValidity())).toBe(false);
  });
});
