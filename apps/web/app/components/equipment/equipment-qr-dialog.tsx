'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { BASE_PATH } from '../../lib/base-path';
import { buildEquipmentQrPayload } from './equipment-qr-label';

interface EquipmentQrDialogProps {
  readonly equipmentId: string;
  readonly equipmentCode: string;
  readonly equipmentName: string;
  readonly onClose: () => void;
}

/**
 * Etiqueta QR imprimível do equipamento.
 *
 * O PNG é gerado no cliente (nenhuma chamada de rede), em resolução alta o
 * bastante para impressão, com correção de erro 'M' — suficiente para sobreviver
 * a uma etiqueta arranhada na bancada sem inflar o tamanho do módulo.
 */
export function EquipmentQrDialog({
  equipmentId,
  equipmentCode,
  equipmentName,
  onClose,
}: EquipmentQrDialogProps): React.JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [payload, setPayload] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const target = buildEquipmentQrPayload(equipmentId, window.location.origin, BASE_PATH);
    setPayload(target);

    QRCode.toDataURL(target, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 10,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setError('Não foi possível gerar a etiqueta QR.');
      });

    return () => {
      active = false;
    };
  }, [equipmentId]);

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
        aria-labelledby="qr-label-title"
        aria-modal="true"
        className="qr-label-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="qr-label-header">
          <h2 id="qr-label-title">Etiqueta QR</h2>
          <button aria-label="Fechar" className="qr-label-close" onClick={onClose} type="button">
            ×
          </button>
        </header>

        <div className="qr-label-printable">
          {error ? <p className="form-error">{error}</p> : null}
          {dataUrl ? (
            <img
              alt={`QR Code do equipamento ${equipmentName}`}
              className="qr-label-image"
              src={dataUrl}
            />
          ) : (
            !error && <span className="loading-pulse" />
          )}
          <p className="qr-label-name">{equipmentName}</p>
          <p className="qr-label-code">{equipmentCode}</p>
        </div>

        <p className="qr-label-hint">
          Aponte a câmera do celular para abrir a agenda deste equipamento e fazer o check-in da sua
          reserva.
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
            Imprimir etiqueta
          </button>
        </div>
      </div>
    </div>
  );
}
