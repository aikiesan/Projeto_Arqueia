'use client';

import type { CatalogOption, CreateEquipmentInput, Equipment } from '@arqueia/contracts';
import type { FormEvent } from 'react';

interface CatalogData {
  readonly models: readonly CatalogOption[];
  readonly spaces: readonly CatalogOption[];
  readonly benches: readonly CatalogOption[];
}

export type EquipmentFormValue = CreateEquipmentInput & { readonly status?: Equipment['status'] };

interface EquipmentFormDialogProps {
  readonly catalog: CatalogData;
  readonly equipment: Equipment | null;
  readonly laboratoryId: string;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onSave: (input: EquipmentFormValue) => Promise<void>;
}

function nullable(form: FormData, name: string): string | null {
  const value = String(form.get(name) ?? '').trim();
  return value.length === 0 ? null : value;
}

export function EquipmentFormDialog({ catalog, equipment, laboratoryId, pending, onClose, onSave }: EquipmentFormDialogProps) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSave({
      laboratoryId,
      catalogOptionId: String(form.get('catalogOptionId') ?? ''),
      spaceOptionId: nullable(form, 'spaceOptionId'),
      benchOptionId: nullable(form, 'benchOptionId'),
      responsibleUserId: equipment?.responsibleUserId ?? null,
      code: String(form.get('code') ?? ''),
      name: String(form.get('name') ?? ''),
      assetTag: nullable(form, 'assetTag'),
      serialNumber: nullable(form, 'serialNumber'),
      reservationPolicy: {
        maxReservationMinutes: Number(form.get('maxReservationMinutes')),
        requiresTraining: form.get('requiresTraining') === 'on',
        requiresApproval: form.get('requiresApproval') === 'on',
        absenceReleaseMinutes: Number(form.get('absenceReleaseMinutes')),
      },
      notes: nullable(form, 'notes'),
      ...(equipment ? { status: String(form.get('status')) as Equipment['status'] } : {}),
    });
  }

  return (
    <div className="equipment-dialog-backdrop" role="presentation">
      <section aria-labelledby="equipment-form-title" aria-modal="true" className="equipment-dialog" role="dialog">
        <div className="equipment-dialog-heading">
          <div><span className="section-kicker">{equipment ? 'Atualizar cadastro' : 'Novo ativo físico'}</span><h2 id="equipment-form-title">{equipment ? `Editar ${equipment.name}` : 'Cadastrar equipamento'}</h2></div>
          <button aria-label="Fechar cadastro" onClick={onClose} type="button">×</button>
        </div>
        <form className="equipment-form" onSubmit={submit}>
          <label className="field-wide"><span>Modelo confirmado</span><select defaultValue={equipment?.catalogOptionId ?? ''} name="catalogOptionId" required><option value="">Selecione no catálogo CP2b</option>{catalog.models.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label><span>Código interno</span><input defaultValue={equipment?.code ?? ''} maxLength={64} name="code" placeholder="CP2b-HPLC-01" required /></label>
          <label><span>Nome de exibição</span><input defaultValue={equipment?.name ?? ''} maxLength={180} name="name" placeholder="HPLC principal" required /></label>
          <label><span>Patrimônio</span><input defaultValue={equipment?.assetTag ?? ''} maxLength={96} name="assetTag" /></label>
          <label><span>Número de série</span><input defaultValue={equipment?.serialNumber ?? ''} maxLength={160} name="serialNumber" /></label>
          <label><span>Espaço</span><select defaultValue={equipment?.spaceOptionId ?? ''} name="spaceOptionId"><option value="">Ainda não definido</option>{catalog.spaces.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label><span>Bancada</span><select defaultValue={equipment?.benchOptionId ?? ''} name="benchOptionId"><option value="">Ainda não definida</option>{catalog.benches.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          {equipment ? <label><span>Status</span><select defaultValue={equipment.status} name="status"><option value="AVAILABLE">Disponível</option><option value="UNDER_EVALUATION">Em avaliação</option><option value="MAINTENANCE">Em manutenção</option><option value="UNAVAILABLE">Indisponível</option></select></label> : null}
          <fieldset className="field-wide reservation-policy"><legend>Política de reserva</legend><label><span>Duração máxima (min)</span><input defaultValue={equipment?.reservationPolicy.maxReservationMinutes ?? 720} max="10080" min="30" name="maxReservationMinutes" required type="number" /></label><label><span>Liberação por ausência (min)</span><input defaultValue={equipment?.reservationPolicy.absenceReleaseMinutes ?? 30} max="240" min="0" name="absenceReleaseMinutes" required type="number" /></label><label className="check-field"><input defaultChecked={equipment?.reservationPolicy.requiresTraining ?? true} name="requiresTraining" type="checkbox" /><span>Exigir treinamento</span></label><label className="check-field"><input defaultChecked={equipment?.reservationPolicy.requiresApproval ?? false} name="requiresApproval" type="checkbox" /><span>Exigir aprovação técnica</span></label></fieldset>
          <label className="field-wide"><span>Observações</span><textarea defaultValue={equipment?.notes ?? ''} maxLength={2000} name="notes" rows={4} /></label>
          <div className="equipment-form-actions"><button className="secondary-button" onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={pending} type="submit">{pending ? 'Salvando…' : equipment ? 'Salvar alterações' : 'Cadastrar equipamento'}</button></div>
        </form>
      </section>
    </div>
  );
}
