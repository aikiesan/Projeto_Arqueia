'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { BASE_PATH } from '../../lib/base-path';
import { buildFieldReportQrPayload } from './field-report-qr';

interface FieldReportQrDialogProps {
  readonly laboratoryId: string;
  readonly laboratoryName: string;
  readonly onClose: () => void;
}

/**
 * Cartaz QR dos informes, para imprimir e colar no laboratório.
 *
 * Mesmo gerador da etiqueta de equipamento (PNG no cliente, sem rede, correção
 * 'M'), mas o destino é o formulário público `/informar`, que não exige login.
 */
export function FieldReportQrDialog({
  laboratoryId,
  laboratoryName,
  onClose,
}: FieldReportQrDialogProps): React.JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [payload, setPayload] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const target = buildFieldReportQrPayload(window.location.origin, BASE_PATH, laboratoryId);
    setPayload(target);

    QRCode.toDataURL(target, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 10,
      color: { dark: '#1e3e4c', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setError('Não foi possível gerar o QR de informes.');
      });

    return () => {
      active = false;
    };
  }, [laboratoryId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="qr-label-backdrop" onClick={onClose} role="presentation">
      <div
        aria-labelledby="field-report-qr-title"
        aria-modal="true"
        className="qr-label-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="qr-label-header">
          <h2 id="field-report-qr-title">QR de informes</h2>
          <button aria-label="Fechar" className="qr-label-close" onClick={onClose} type="button">
            ×
          </button>
        </header>

        <div className="qr-label-printable">
          <p className="qr-label-name">Viu algum problema? Avise a coordenação.</p>
          {error ? <p className="form-error">{error}</p> : null}
          {dataUrl ? (
            <img
              alt={`QR Code do formulário de informes do ${laboratoryName}`}
              className="qr-label-image"
              src={dataUrl}
            />
          ) : (
            !error && <span className="loading-pulse" />
          )}
          <p className="qr-label-code">
            Problema em equipamento · Manutenção · Uso de insumos · Pedido de apoio
          </p>
          <p className="qr-label-code">{laboratoryName} · sem login, leva 1 minuto</p>
        </div>

        <p className="qr-label-hint">
          Imprima e cole nas bancadas e perto dos equipamentos. Quem escanear abre o formulário
          público; os informes chegam só à coordenação, nesta página.
        </p>

        <details className="qr-label-payload">
          <summary>Conteúdo do código</summary>
          <code>{payload}</code>
        </details>

        <div className="qr-label-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Fechar
          </button>
          <button className="primary-button" onClick={() => window.print()} type="button">
            Imprimir cartaz
          </button>
        </div>
      </div>
    </div>
  );
}
