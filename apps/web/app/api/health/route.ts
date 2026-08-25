export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const apiUrl =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:4001';
  const timestamp = new Date().toISOString();

  try {
    const upstreamRes = await fetch(`${apiUrl}/health`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    let upstreamJson: unknown = null;
    try {
      upstreamJson = await upstreamRes.json();
    } catch {
      upstreamJson = { status: 'error' };
    }

    const isHealthy = upstreamRes.status === 200;
    const body = {
      status: isHealthy ? 'ok' : 'error',
      service: 'arqueia-web',
      timestamp,
      api: upstreamJson,
    };

    return new Response(JSON.stringify(body), {
      status: isHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'API indisponível';

    const body = {
      status: 'error',
      service: 'arqueia-web',
      timestamp,
      api: {
        status: 'disconnected',
        message,
      },
    };

    return new Response(JSON.stringify(body), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }
}
