// =============================================================================
// Hijo de tests/web-generator-carrusel-45.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre el `preparar` REAL de `crear_presentacion_desde_plantilla` (landing.run.ts, por el registro de runners) en un
// node aparte con `--conditions=react-server` (el runner lleva `server-only`). Desde el 18/11/2026 la operación no
// trae `enum` de ids (el presupuesto del turno): `preparar` es la ÚNICA validación del id, y lo que se mira es que
// acepte una presentación y un carrusel, y que un id que no existe devuelva las DOS listas en `disponibles`.
// `preparar` no lee la base: nada sale a la red, y si algo saliera se anota y el padre lo ve.
// =============================================================================

export {};

const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL) => {
  red.push(String(entrada instanceof Request ? entrada.url : entrada));
  return new Response('{}', { status: 500 });
}) as typeof fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

async function main() {
  const { runnerDe } = await import('../lib/api-mako/runners');
  const { PLANTILLAS_PRESENTACION } = await import('../lib/editor-landing/plantillas-presentaciones');
  const { PLANTILLAS_CARRUSEL } = await import('../lib/editor-landing/plantillas-carrusel');
  type R = { preparar: (i: Record<string, unknown>, c: Record<string, unknown>) => Promise<Record<string, unknown>> };
  const r = runnerDe('crear_presentacion_desde_plantilla') as unknown as R;
  const ctx = { ws: 3, canal: 'app', canalKey: 'app:prueba', alcance: 'ejecutar', rol: 'admin', actor: 'Prueba' };
  const out = {
    presentacion: await r.preparar({ plantilla: PLANTILLAS_PRESENTACION[0].id }, ctx),
    carrusel: await r.preparar({ plantilla: PLANTILLAS_CARRUSEL[0].id }, ctx),
    noExiste: await r.preparar({ plantilla: 'no-existe' }, ctx),
    idsCarrusel: PLANTILLAS_CARRUSEL.map((p) => p.id),
    idsPresentacion: PLANTILLAS_PRESENTACION.map((p) => p.id),
    red,
  };
  process.stdout.write('\n@@JSON@@' + JSON.stringify(out));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
