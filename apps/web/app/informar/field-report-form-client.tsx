'use client';

import {
  FIELD_REPORT_MESSAGE_MAX_LENGTH,
  FIELD_REPORT_MESSAGE_MIN_LENGTH,
  fieldReportKinds,
  type FieldReportKind,
  type PublicFieldReportForm,
  type PublicLaboratory,
  type SubmitFieldReportResult,
} from '@arqueia/contracts';
import { ArqueiaIcon } from '@arqueia/ui';
import { useSearchParams } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { FIELD_REPORT_KIND_PRESENTATION } from '../components/field-reports/field-report-labels';
import { basePathFetch, withBasePath } from '../lib/base-path';
import { FIELD_REPORT_HONEYPOT_FIELD } from '../lib/field-report-honeypot';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidParam(value: string | null | undefined): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

/**
 * Formulário público de informes, aberto pela etiqueta QR — sem login.
 *
 * Quem envia não vê informes de ninguém, nem o próprio depois de enviado:
 * recebe só o protocolo. A leitura é da coordenação, em `/informes`.
 */
export function FieldReportFormClient(): React.JSX.Element {
  const searchParams = useSearchParams();
  const messageId = useId();
  const requestedLaboratoryId = uuidParam(searchParams?.get('laboratory'));
  const requestedEquipmentId = uuidParam(searchParams?.get('equipment'));

  const [laboratories, setLaboratories] = useState<readonly PublicLaboratory[]>([]);
  const [laboratoryId, setLaboratoryId] = useState<string | null>(requestedLaboratoryId);
  const [form, setForm] = useState<PublicFieldReportForm | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [kind, setKind] = useState<FieldReportKind | null>(null);
  const [equipmentId, setEquipmentId] = useState<string>(requestedEquipmentId ?? '');
  const [message, setMessage] = useState('');
  const [blocksUse, setBlocksUse] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmitFieldReportResult | null>(null);

  // Sem laboratório na URL, oferecemos a lista pública (ou escolhemos o único).
  useEffect(() => {
    if (requestedLaboratoryId !== null) return;
    let active = true;
    basePathFetch('/api/public/laboratories', { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<PublicLaboratory[]>) : []))
      .then((list) => {
        if (!active) return;
        setLaboratories(list);
        setLaboratoryId((current) => current ?? list[0]?.id ?? null);
        if (list.length === 0) setLoadError('Nenhum laboratório está recebendo informes agora.');
      })
      .catch(() => {
        if (active) setLoadError('Não foi possível carregar os laboratórios.');
      });
    return () => {
      active = false;
    };
  }, [requestedLaboratoryId]);

  useEffect(() => {
    if (laboratoryId === null) return;
    let active = true;
    setForm(null);
    setLoadError(null);
    const query = new URLSearchParams({ laboratoryId });
    basePathFetch(`/api/public/field-reports/form?${query.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 404) {
          setLoadError('Este QR aponta para um laboratório que não recebe mais informes.');
          return;
        }
        if (!response.ok) {
          setLoadError('Não foi possível abrir o formulário agora. Tente novamente em instantes.');
          return;
        }
        const loaded = (await response.json()) as PublicFieldReportForm;
        setForm(loaded);
        // Equipamento da URL só vale se for deste laboratório.
        setEquipmentId((current) =>
          loaded.equipment.some((item) => item.id === current) ? current : '',
        );
        if (requestedEquipmentId !== null) {
          setKind((current) => current ?? 'EQUIPMENT_PROBLEM');
        }
      })
      .catch(() => {
        if (active) setLoadError('Falha de conexão ao abrir o formulário.');
      });
    return () => {
      active = false;
    };
  }, [laboratoryId, requestedEquipmentId]);

  const presentation = kind === null ? null : FIELD_REPORT_KIND_PRESENTATION[kind];
  const trimmedLength = message.trim().length;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (form === null || kind === null) return;
    setSubmitError(null);
    const data = new FormData(event.currentTarget);
    setPending(true);
    try {
      const response = await basePathFetch('/api/public/field-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laboratoryId: form.laboratory.id,
          kind,
          equipmentId: equipmentId === '' ? null : equipmentId,
          message,
          blocksUse: presentation?.aboutEquipment === true && blocksUse,
          reporterName: String(data.get('reporterName') ?? ''),
          reporterContact: String(data.get('reporterContact') ?? ''),
          [FIELD_REPORT_HONEYPOT_FIELD]: String(data.get(FIELD_REPORT_HONEYPOT_FIELD) ?? ''),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (SubmitFieldReportResult & { message?: string })
        | null;
      if (!response.ok || payload === null) {
        setSubmitError(payload?.message ?? 'Não foi possível enviar agora. Tente novamente.');
        return;
      }
      setReceipt({ reference: payload.reference, receivedAt: payload.receivedAt });
    } catch {
      setSubmitError('Falha de conexão. Verifique a internet e tente de novo.');
    } finally {
      setPending(false);
    }
  }

  function reset(): void {
    setReceipt(null);
    setKind(null);
    setMessage('');
    setBlocksUse(false);
    setEquipmentId(requestedEquipmentId ?? '');
  }

  return (
    <main className="public-agenda field-report-public">
      <header className="public-agenda-header">
        <a className="public-agenda-brand" href={withBasePath('/login')}>
          <span className="public-agenda-brand-mark" aria-hidden="true" />
          <span>
            <strong>Arqueia</strong>
            <small>Informes do laboratório</small>
          </span>
        </a>
        <a className="public-agenda-login" href={withBasePath('/agenda-publica')}>
          <ArqueiaIcon name="agenda" size={18} />
          Ver agenda
        </a>
      </header>

      <section className="field-report-intro">
        <span className="section-kicker">{form?.laboratory.name ?? 'CP2b'}</span>
        <h1>Avise a coordenação</h1>
        <p>
          Viu um problema, precisa de manutenção, usou um insumo ou quer pedir apoio? Conte aqui.
          Leva menos de um minuto e não precisa de login.
        </p>
      </section>

      {receipt ? (
        <section aria-live="polite" className="field-report-receipt" role="status">
          <h2>Informe enviado. Obrigado por avisar!</h2>
          <p>
            Guarde o protocolo <strong className="field-report-reference">{receipt.reference}</strong>{' '}
            se quiser falar sobre ele com a coordenação.
          </p>
          <button className="primary-button" onClick={reset} type="button">
            Enviar outro informe
          </button>
        </section>
      ) : loadError ? (
        <p className="public-agenda-error" role="alert">
          {loadError}
        </p>
      ) : form === null ? (
        <p className="public-agenda-loading">Abrindo o formulário...</p>
      ) : (
        <form className="field-report-form" onSubmit={(event) => void submit(event)}>
          {requestedLaboratoryId === null && laboratories.length > 1 ? (
            <label className="field-report-field">
              <span>Laboratório</span>
              <select
                onChange={(event) => setLaboratoryId(event.target.value)}
                value={laboratoryId ?? ''}
              >
                {laboratories.map((laboratory) => (
                  <option key={laboratory.id} value={laboratory.id}>
                    {laboratory.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <fieldset className="field-report-kinds">
            <legend>Sobre o que é o informe?</legend>
            {fieldReportKinds.map((option) => {
              const item = FIELD_REPORT_KIND_PRESENTATION[option];
              return (
                <label className="field-report-kind" key={option}>
                  <input
                    checked={kind === option}
                    name="kind"
                    onChange={() => setKind(option)}
                    required
                    type="radio"
                    value={option}
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {kind !== null ? (
            <>
              <label className="field-report-field">
                <span>
                  Equipamento {presentation?.aboutEquipment ? '' : '(opcional)'}
                </span>
                <select onChange={(event) => setEquipmentId(event.target.value)} value={equipmentId}>
                  <option value="">
                    {presentation?.aboutEquipment ? 'Escolha o equipamento, se souber' : 'Nenhum equipamento específico'}
                  </option>
                  {form.equipment.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.code}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field-report-field">
                <label htmlFor={messageId}>Mensagem</label>
                <textarea
                  aria-describedby={`${messageId}-counter`}
                  id={messageId}
                  maxLength={FIELD_REPORT_MESSAGE_MAX_LENGTH}
                  minLength={FIELD_REPORT_MESSAGE_MIN_LENGTH}
                  name="message"
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={presentation?.placeholder}
                  required
                  rows={5}
                  value={message}
                />
                <small className="field-report-counter" id={`${messageId}-counter`}>
                  {trimmedLength < FIELD_REPORT_MESSAGE_MIN_LENGTH
                    ? `Escreva pelo menos ${FIELD_REPORT_MESSAGE_MIN_LENGTH} caracteres.`
                    : `${message.length}/${FIELD_REPORT_MESSAGE_MAX_LENGTH}`}
                </small>
              </div>

              {presentation?.aboutEquipment ? (
                <label className="field-report-check">
                  <input
                    checked={blocksUse}
                    onChange={(event) => setBlocksUse(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Isso impede o uso do equipamento agora</span>
                </label>
              ) : null}

              <fieldset className="field-report-identity">
                <legend>Identificação (opcional)</legend>
                <p>Preencha só se quiser retorno. Você pode enviar sem se identificar.</p>
                <label className="field-report-field">
                  <span>Seu nome</span>
                  <input autoComplete="name" maxLength={120} name="reporterName" type="text" />
                </label>
                <label className="field-report-field">
                  <span>E-mail ou telefone</span>
                  <input autoComplete="email" maxLength={160} name="reporterContact" type="text" />
                </label>
              </fieldset>

              {/* Campo-armadilha: invisível para pessoas e leitores de tela. */}
              <div aria-hidden="true" className="field-report-trap">
                <label>
                  Não preencha este campo
                  <input autoComplete="off" name={FIELD_REPORT_HONEYPOT_FIELD} tabIndex={-1} type="text" />
                </label>
              </div>

              <p className="field-report-privacy">
                Os informes são lidos apenas pela coordenação do laboratório. Não inclua dados
                sensíveis, como informações de saúde ou números de documentos.
              </p>

              {submitError ? (
                <p className="form-error" role="alert">
                  {submitError}
                </p>
              ) : null}

              <button
                className="primary-button field-report-submit"
                disabled={pending || trimmedLength < FIELD_REPORT_MESSAGE_MIN_LENGTH}
                type="submit"
              >
                {pending ? 'Enviando...' : 'Enviar informe'}
              </button>
            </>
          ) : null}
        </form>
      )}

      <footer className="public-agenda-footer">
        <p>
          Esta página é pública e só recebe informes: ninguém vê o que outras pessoas enviaram.
          Para reservar um equipamento, entre no sistema.
        </p>
        <p>
          Antes de usar o laboratório, leia as{' '}
          <a href={withBasePath('/boas-praticas')}>boas práticas de laboratório</a>.
        </p>
      </footer>
    </main>
  );
}
