// =============================================================================
// Hijo de tests/subir-plan.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `subirPlanStripe` (lib/pasarela-plan-api.ts, con `server-only`) contra un Stripe de mentira: qué se le pide al subir de
// plan, el anual, el «ya estaba», y el cobro de la diferencia que falla.

type Sub = { interval: string; amount: number; currency: string };
let sub: Sub = { interval: 'month', amount: 4700, currency: 'usd' };
let fallaElCobro = false;
let posts: Array<Record<string, string>> = [];

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.pathname.startsWith('/v1/subscriptions/') && (init.method ?? 'GET') === 'GET') {
    return json(200, { id: 'sub_PRUEBA123', items: { data: [{ id: 'si_1', price: { product: 'prod_mako', unit_amount: sub.amount, currency: sub.currency, recurring: { interval: sub.interval, interval_count: 1 } } }] } });
  }
  if (u.pathname.startsWith('/v1/subscriptions/') && init.method === 'POST') {
    const b = Object.fromEntries(new URLSearchParams(String(init.body ?? '')));
    posts.push({ ...b, idem: new Headers(init.headers).get('Idempotency-Key') ?? '' });
    if (fallaElCobro) return json(402, { error: { message: 'Your card was declined.' } });
    return json(200, { id: 'sub_PRUEBA123' });
  }
  return json(404, { error: { message: 'sin mock' } });
}) as typeof fetch;

async function main() {
  const { subirPlanStripe } = await import('../lib/pasarela-plan-api');
  const out: Record<string, unknown> = {};
  const subir = () => subirPlanStripe('sk_test_plataformaAAAAAAAA', 'sub_PRUEBA123', { mensual: 97, anual: 970, moneda: 'USD', idem: 'mako-subir-1-pro-1' });

  posts = []; sub = { interval: 'month', amount: 4700, currency: 'usd' };
  out.mensual = { r: await subir(), posts };
  posts = []; sub = { interval: 'year', amount: 47000, currency: 'usd' };
  out.anual = { r: await subir(), posts };
  posts = []; sub = { interval: 'month', amount: 9700, currency: 'usd' };
  out.yaEstaba = { r: await subir(), posts };
  posts = []; sub = { interval: 'month', amount: 4700, currency: 'usd' }; fallaElCobro = true;
  out.falla = { r: await subir(), posts };
  fallaElCobro = false;
  posts = []; sub = { interval: 'month', amount: 470000, currency: 'mxn' };
  out.otraMoneda = { r: await subir(), posts };
  posts = []; sub = { interval: 'week', amount: 1000, currency: 'usd' };
  out.semanal = { r: await subir(), posts };
  process.stdout.write(`\n@@RESULTADO@@${JSON.stringify(out)}`);
}

void main();

export {};
