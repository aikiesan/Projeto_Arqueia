import { apiBaseUrl, noStoreJson } from '../../lib/api-server';

export async function GET(): Promise<Response> {
  const timestamp = new Date().toISOString();

  try {
    const upstreamUrl = `${apiBaseUrl()}/api/health`;
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      payload = { status: upstream.ok ? 'ok' : 'error' };
    }

    if (!upstream.ok) {
      return noStoreJson(
        {
          status: 'error',
          service: 'arqueia-web',
          timestamp,
          api: payload,
        },
        503,
      );
    }

    return noStoreJson({
      status: 'ok',
      service: 'arqueia-web',
      timestamp,
      api: payload,
    });
  } catch (err) {
    return noStoreJson(
      {
        status: 'error',
        service: 'arqueia-web',
        timestamp,
        api: {
          status: 'disconnected',
          message: err instanceof Error ? err.message : 'API indisponível',
        },
      },
      503,
    );
  }
}
