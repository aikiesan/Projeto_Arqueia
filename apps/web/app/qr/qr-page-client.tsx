'use client';

import type { AuthenticatedPrincipal, Laboratory } from '@arqueia/contracts';
import { ArqueiaIcon, WorkspaceShell } from '@arqueia/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { LogoutButton } from '../logout-button';
import { createWorkspacePresentation } from '../presentation';
import { lookupAndResolveQr, type QrResolutionResult } from './qr-resolver';

interface DetectedBarcode {
  readonly rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<readonly DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options?: {
  formats: readonly string[];
}) => BarcodeDetectorInstance;

interface MediaTrackTorchConstraints {
  readonly advanced?: readonly { readonly torch?: boolean }[];
}

interface PageData {
  readonly principal: AuthenticatedPrincipal;
  readonly laboratories: readonly Laboratory[];
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${url}`, { ...init, cache: 'no-store' });
  if (response.status === 401) throw new Error('UNAUTHENTICATED');
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Não foi possível carregar os dados.');
  }
  return response.json() as Promise<T>;
}

const SAMPLE_CODES = [
  { label: 'Lote Citrato', value: 'ARQ-CP2B-PRD-CITRATO-FE-01' },
  { label: 'Lote EDTA', value: 'ARQ-CP2B-PRD-EDTA-SAL-01' },
  { label: 'Lote Padrão', value: 'ARQ-LOT-LOTE-2026-A' },
  { label: 'Equipamento Cromatógrafo', value: 'CP2B-EQP-01' },
  { label: 'Espaço Sala Limpa', value: 'ARQ-SPC-01' },
] as const;

export function QrPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedLabId = searchParams?.get('laboratory') ?? '';
  const initialCodeParam = searchParams?.get('code') ?? '';

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [laboratoryId, setLaboratoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Scanner State
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [manualCode, setManualCode] = useState(initialCodeParam);
  const [resolving, setResolving] = useState(false);
  const [resolvedResult, setResolvedResult] = useState<QrResolutionResult | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopActiveRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef(0);

  // Load Session and Laboratories
  useEffect(() => {
    void (async () => {
      try {
        const [session, laboratories] = await Promise.all([
          readJson<{ principal: AuthenticatedPrincipal }>('/api/session'),
          readJson<readonly Laboratory[]>('/api/laboratories'),
        ]);

        const preferred =
          laboratories.find((lab) => lab.id === requestedLabId) ??
          laboratories.find((lab) => lab.code === 'CP2b') ??
          laboratories[0];

        if (!preferred) throw new Error('Nenhum laboratório disponível.');

        setPageData({ principal: session.principal, laboratories });
        setLaboratoryId(preferred.id);
      } catch (err) {
        if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
          router.replace('/login');
          return;
        }
        setScannerError(err instanceof Error ? err.message : 'Falha ao carregar sessão.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router, requestedLabId]);

  const activeLaboratory = useMemo(
    () => pageData?.laboratories.find((lab) => lab.id === laboratoryId) ?? null,
    [laboratoryId, pageData],
  );

  const presentation = useMemo(
    () =>
      pageData === null
        ? null
        : createWorkspacePresentation(pageData.principal, pageData.laboratories, activeLaboratory?.id),
    [pageData, activeLaboratory?.id],
  );

  const stopCameraStream = useCallback(() => {
    scanLoopActiveRef.current = false;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleResolveCode = useCallback(
    async (codeToResolve: string) => {
      const trimmed = codeToResolve.trim();
      if (!trimmed) return;

      setResolving(true);
      setScannerError(null);

      try {
        const result = await lookupAndResolveQr(trimmed, laboratoryId ?? undefined);
        setResolvedResult(result);
      } catch (err) {
        setScannerError(err instanceof Error ? err.message : 'Não foi possível consultar o código.');
      } finally {
        setResolving(false);
      }
    },
    [laboratoryId],
  );

  // Auto-resolve if ?code= parameter was passed in URL
  useEffect(() => {
    if (initialCodeParam && laboratoryId) {
      void handleResolveCode(initialCodeParam);
    }
  }, [initialCodeParam, laboratoryId, handleResolveCode]);

  // Camera Management & Continuous Scanning Loop
  useEffect(() => {
    if (!cameraActive) {
      stopCameraStream();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermission('unsupported');
      setCameraActive(false);
      return;
    }

    let isCancelled = false;

    const startCamera = async () => {
      try {
        stopCameraStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: cameraFacing },
            height: { ideal: 720 },
            width: { ideal: 1280 },
          },
        });

        if (isCancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        streamRef.current = stream;
        setCameraPermission('granted');

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as {
            torch?: boolean;
          };
          setTorchSupported(Boolean(capabilities.torch));
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Start scanning frames if BarcodeDetector is supported
        scanLoopActiveRef.current = true;
        const BarcodeDetectorClass = (
          window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
        ).BarcodeDetector;

        if (BarcodeDetectorClass) {
          const detector = new BarcodeDetectorClass({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'],
          });

          const scanFrame = async () => {
            if (!scanLoopActiveRef.current || isCancelled || !videoRef.current) return;

            if (videoRef.current.readyState >= 2) {
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const rawValue = barcodes[0]?.rawValue;
                  const now = Date.now();

                  // Avoid spamming resolution for the exact same code within 3 seconds
                  if (
                    rawValue &&
                    (rawValue !== lastScannedCodeRef.current || now - lastScannedTimeRef.current > 3000)
                  ) {
                    lastScannedCodeRef.current = rawValue;
                    lastScannedTimeRef.current = now;
                    setManualCode(rawValue);
                    void handleResolveCode(rawValue);
                  }
                }
              } catch {
                // frame detection errors can be ignored
              }
            }

            if (scanLoopActiveRef.current && !isCancelled) {
              requestAnimationFrame(scanFrame);
            }
          };

          requestAnimationFrame(scanFrame);
        }
      } catch {
        if (!isCancelled) {
          setCameraPermission('denied');
          setCameraActive(false);
          setScannerError('Acesso à câmera indisponível ou negado pelo usuário. Utilize a entrada manual abaixo.');
        }
      }
    };

    void startCamera();

    return () => {
      isCancelled = true;
      stopCameraStream();
    };
  }, [cameraActive, cameraFacing, stopCameraStream, handleResolveCode]);

  // Torch Toggle Handler
  const handleToggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchOn;
      await (
        track as MediaStreamTrack & {
          applyConstraints(c: MediaTrackTorchConstraints): Promise<void>;
        }
      ).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      // ignore torch errors
    }
  }, [torchOn]);

  // Camera Flip Handler
  const handleFlipCamera = useCallback(() => {
    setCameraFacing((current) => (current === 'environment' ? 'user' : 'environment'));
    setTorchOn(false);
  }, []);

  const handleManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleResolveCode(manualCode);
  };

  const handleSampleClick = (code: string) => {
    setManualCode(code);
    void handleResolveCode(code);
  };

  if (loading || !pageData || !activeLaboratory || !presentation) {
    return (
      <main className="standalone-loading">
        <span className="loading-pulse" />
        Carregando leitor de QR Code...
      </main>
    );
  }

  const laboratoryRail = pageData.laboratories.map((lab) => ({
    href: `/qr?laboratory=${lab.id}`,
    id: lab.id,
    ...(lab.code === 'CP2b' ? { logoSrc: '/brand/cp2b-avatar.svg' } : {}),
    name: lab.name,
    shortName: lab.code.slice(0, 2),
  }));

  return (
    <WorkspaceShell
      activeLaboratoryId={activeLaboratory.id}
      activeModuleHref=""
      appName="Arqueia"
      currentContext={activeLaboratory.name}
      laboratories={laboratoryRail}
      mobileNavigation={presentation.mobileNavigation}
      moduleNavigation={presentation.moduleNavigation}
      qrAction={{ href: `/qr?laboratory=${activeLaboratory.id}`, label: 'Ler QR Code' }}
      sectionLabel="Leitor QR Code"
      userInitials={presentation.userInitials}
      userLabel={pageData.principal.user.name}
      userMenu={<LogoutButton />}
    >
      <div className="qr-page-container">
        <section className="qr-header-card">
          <span className="section-kicker">Identificação Física Instantânea</span>
          <h1>Leitor de QR Code & Código de Barras</h1>
          <p>
            Aponte a câmera para a etiqueta do recipiente ou insira o código manual para abrir a retirada de estoque ou
            agenda de equipamento.
          </p>
        </section>

        {scannerError && (
          <div
            role="alert"
            style={{
              background: '#fff5f5',
              border: '1px solid #feb2b2',
              borderRadius: '8px',
              color: '#c53030',
              fontSize: '0.88rem',
              padding: '0.85rem 1rem',
            }}
          >
            ⚠️ {scannerError}
          </div>
        )}

        {/* Viewfinder Card */}
        <section aria-label="Visor da Câmera" className="qr-scanner-viewport-card">
          <div className="qr-video-container">
            {cameraActive ? (
              <>
                <video
                  autoPlay
                  className="qr-video-stream"
                  muted
                  playsInline
                  ref={videoRef}
                />
                <div aria-hidden="true" className="qr-viewfinder-overlay">
                  <div className="qr-viewfinder-box">
                    <div className="qr-viewfinder-corner qr-viewfinder-corner--tl" />
                    <div className="qr-viewfinder-corner qr-viewfinder-corner--tr" />
                    <div className="qr-viewfinder-corner qr-viewfinder-corner--bl" />
                    <div className="qr-viewfinder-corner qr-viewfinder-corner--br" />
                    <div className="qr-scan-beam" />
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  alignItems: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '2.5rem' }}>📷</span>
                <p style={{ color: '#a0aec0', fontSize: '0.9rem', margin: 0 }}>
                  {cameraPermission === 'denied'
                    ? 'Permissão da câmera bloqueada. Use a entrada manual abaixo.'
                    : cameraPermission === 'unsupported'
                      ? 'Câmera não suportada neste navegador.'
                      : 'Câmera em pausa.'}
                </p>
                <button
                  className="qr-tool-button"
                  onClick={() => setCameraActive(true)}
                  type="button"
                >
                  <ArqueiaIcon name="inicio" size={16} /> Ativar Câmera
                </button>
              </div>
            )}
          </div>

          <div className="qr-scanner-toolbar">
            <div className="qr-scanner-status-indicator">
              <span
                className="qr-status-pulse"
                style={{ background: cameraActive ? '#2bc083' : '#a0aec0' }}
              />
              <span>{cameraActive ? 'Câmera ativa — escaneando' : 'Câmera pausada'}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {cameraActive && torchSupported && (
                <button
                  aria-label={torchOn ? 'Desligar Lanterna' : 'Ligar Lanterna'}
                  className={`qr-tool-button ${torchOn ? 'qr-tool-button--active' : ''}`}
                  onClick={handleToggleTorch}
                  title="Lanterna"
                  type="button"
                >
                  🔦 {torchOn ? 'Ligada' : 'Lanterna'}
                </button>
              )}

              {cameraActive && (
                <button
                  aria-label="Alternar Câmera"
                  className="qr-tool-button"
                  onClick={handleFlipCamera}
                  title="Alternar Câmera Frontal/Traseira"
                  type="button"
                >
                  🔄 Trocar Câmera
                </button>
              )}

              <button
                aria-label={cameraActive ? 'Pausar Câmera' : 'Iniciar Câmera'}
                className="qr-tool-button"
                onClick={() => setCameraActive(!cameraActive)}
                type="button"
              >
                {cameraActive ? '⏸️ Pausar' : '▶️ Câmera'}
              </button>
            </div>
          </div>
        </section>

        {/* Resolved Entity Result Card */}
        {resolvedResult && (
          <section aria-labelledby="result-heading" className="qr-result-card">
            <div className="qr-result-header">
              <div>
                <span
                  className={`qr-result-badge qr-result-badge--${resolvedResult.parsed.type.toLowerCase()}`}
                >
                  {resolvedResult.parsed.type === 'BATCH'
                    ? 'Lote Identificado'
                    : resolvedResult.parsed.type === 'EQUIPMENT'
                      ? 'Equipamento Identificado'
                      : resolvedResult.parsed.type === 'SPACE'
                        ? 'Espaço / Localização'
                        : 'Busca Geral'}
                </span>
                <h2 className="qr-result-title" id="result-heading">
                  {resolvedResult.entity?.title ?? `Código: ${resolvedResult.parsed.identifier || resolvedResult.parsed.raw}`}
                </h2>
                {resolvedResult.entity?.subtitle && (
                  <p style={{ color: '#4a5568', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
                    {resolvedResult.entity.subtitle}
                  </p>
                )}
              </div>

              {resolvedResult.entity?.status && (
                <span
                  style={{
                    background:
                      resolvedResult.entity.status === 'AVAILABLE' || resolvedResult.entity.status === 'Disponível'
                        ? '#c6f6d5'
                        : '#feebc8',
                    borderRadius: '6px',
                    color:
                      resolvedResult.entity.status === 'AVAILABLE' || resolvedResult.entity.status === 'Disponível'
                        ? '#22543d'
                        : '#744210',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '0.3rem 0.6rem',
                  }}
                >
                  {resolvedResult.entity.status}
                </span>
              )}
            </div>

            {resolvedResult.entity?.balance && (
              <div
                style={{
                  alignItems: 'center',
                  background: '#f7fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.9rem',
                }}
              >
                <strong style={{ fontSize: '0.85rem', color: '#4a5568' }}>Saldo em Estoque:</strong>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1a365d' }}>
                  {resolvedResult.entity.balance}
                </span>
              </div>
            )}

            {resolvedResult.entity?.details && resolvedResult.entity.details.length > 0 && (
              <dl className="qr-result-meta-grid">
                {resolvedResult.entity.details.map((detail) => (
                  <div className="qr-result-meta-item" key={detail.label}>
                    <dt>{detail.label}</dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="qr-result-actions">
              <a
                className="qr-action-btn-primary"
                href={resolvedResult.entity?.directActionHref ?? resolvedResult.destinationUrl}
              >
                <ArqueiaIcon name="inicio" size={16} />
                {resolvedResult.entity?.directActionLabel ??
                  (resolvedResult.parsed.type === 'BATCH'
                    ? 'Retirar do Estoque'
                    : resolvedResult.parsed.type === 'EQUIPMENT'
                      ? 'Ver Agenda & Reservar'
                      : 'Abrir no Sistema')}
              </a>

              {resolvedResult.entity?.secondaryActionHref && (
                <a
                  className="qr-action-btn-secondary"
                  href={resolvedResult.entity.secondaryActionHref}
                >
                  {resolvedResult.entity.secondaryActionLabel ?? 'Ver Detalhes'}
                </a>
              )}

              <button
                className="qr-action-btn-secondary"
                onClick={() => {
                  setResolvedResult(null);
                  setManualCode('');
                  lastScannedCodeRef.current = null;
                }}
                type="button"
              >
                Limpar
              </button>
            </div>
          </section>
        )}

        {/* Manual Input / Barcode Fallback Card */}
        <section className="qr-manual-card">
          <h2>Entrada Manual ou Leitor de Código de Barras</h2>
          <p style={{ color: '#718096', fontSize: '0.85rem', margin: 0 }}>
            Se preferir, digite o código da etiqueta (ex: <code>ARQ-LOT-uuid</code> ou <code>ARQ-EQP-uuid</code>) ou use um leitor USB/Bluetooth.
          </p>

          <form className="qr-manual-form" onSubmit={handleManualSubmit}>
            <div className="qr-manual-input-wrapper">
              <input
                aria-label="Código QR ou de barras"
                className="qr-manual-input"
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ex: ARQ-LOT-01, ARQ-EQP-01 ou código..."
                type="text"
                value={manualCode}
              />
            </div>
            <button
              className="qr-submit-btn"
              disabled={resolving || !manualCode.trim()}
              onClick={() => void handleResolveCode(manualCode)}
              type="submit"
            >
              {resolving ? 'Consultando...' : 'Consultar Código'}
            </button>
          </form>

          <div className="qr-quick-samples">
            <span>Exemplos rápidos:</span>
            {SAMPLE_CODES.map((sample) => (
              <button
                className="qr-sample-chip"
                key={sample.value}
                onClick={() => handleSampleClick(sample.value)}
                type="button"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
