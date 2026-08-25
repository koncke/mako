// =============================================================================
// «Son todos iguales y confunde»: la tarjeta de WhatsApp por tipo de link
// =============================================================================
// 25/08/2026. Medido contra producción con el user-agent de WhatsApp, cuatro
// links distintos —un borrador del plan, el resumen de un lead, una integración y
// el plan— devolvían EXACTAMENTE los mismos tres tags: «MaKo», «Marketing, CRM y
// ventas en una sola app.» y /og-mako.jpg.
//
// La causa: el crawler no tiene sesión, así que proxy.ts lo corta con un 307 a
// /login?next=<destino>. La tarjeta que se veía nunca fue la de la pantalla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { previewDeDestino, previewDeTipo, PREVIEW_DEFAULT } from '../lib/preview-links';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('Cada tipo de link tiene su propia tarjeta', () => {
  const casos: Array<[string, string]> = [
    ['/plan/revisar/propmt8zed2t621vr', 'borrador'],
    ['/crm/revisar/abc', 'lead-propuesto'],
    ['/crm/2311/resumen', 'resumen-lead'],
    ['/crm/2311', 'crm'],
    ['/plan', 'plan'],
    ['/integraciones?abrir=gemini', 'integraciones'],
  ];
  for (const [ruta, tipo] of casos) {
    assert.equal(previewDeDestino(ruta).tipo, tipo, ruta);
  }
  // Y que de verdad sean DISTINTAS entre sí, que es todo el punto.
  const titulos = casos.map(([r]) => previewDeDestino(r).titulo);
  assert.equal(new Set(titulos).size, titulos.length, `hay títulos repetidos: ${titulos.join(' · ')}`);
});

test('Lo específico gana sobre lo genérico', () => {
  // `/crm/2311/resumen` y `/crm/2311` son pantallas distintas; si la genérica de
  // /crm estuviera primera en la lista se comería a todas.
  assert.notEqual(previewDeDestino('/crm/2311/resumen').tipo, previewDeDestino('/crm/2311').tipo);
  assert.notEqual(previewDeDestino('/plan/revisar/x').tipo, previewDeDestino('/plan').tipo);
});

test('Acepta el next= venga como venga', () => {
  assert.equal(previewDeDestino('https://hola-mako.com/plan/revisar/x').tipo, 'borrador');
  assert.equal(previewDeDestino('plan/revisar/x').tipo, 'borrador');
  assert.equal(previewDeDestino('/plan/revisar/x#foo').tipo, 'borrador');
  // Y lo que no se entiende cae al default en vez de romper.
  assert.equal(previewDeDestino(null).tipo, PREVIEW_DEFAULT.tipo);
  assert.equal(previewDeDestino('').tipo, PREVIEW_DEFAULT.tipo);
  assert.equal(previewDeDestino('/ruta-que-no-existe').tipo, PREVIEW_DEFAULT.tipo);
});

test('⚠️ La tarjeta sale de la RUTA, nunca del dato', () => {
  // Quien resuelve el OpenGraph es un servidor de WhatsApp, sin sesión y sin
  // permiso. Una preview que leyera la base convertiría un link en una
  // filtración: «Resumen del lead», nunca el nombre del lead.
  const src = leer('../lib/preview-links.ts');
  assert.ok(!/supabase|getTenantDb|credWs|await /.test(src),
    'preview-links empezó a leer datos: la tarjeta la resuelve un tercero sin sesión');
  // El id del borrador viaja en la ruta y NO tiene que aparecer en la tarjeta.
  const p = previewDeDestino('/plan/revisar/propmt8zed2t621vr');
  assert.ok(!p.titulo.includes('propmt8') && !p.descripcion.includes('propmt8'),
    'el id del borrador se filtró a la tarjeta');
});

test('La imagen es pública, o no hay imagen', () => {
  // Con el 401 del middleware el crawler se queda sin imagen y volvemos al
  // problema original. Es la regla de AGENTS.md: una ruta que sirve a alguien sin
  // sesión va en rutas-publicas o no existe en producción.
  assert.match(leer('../lib/rutas-publicas.ts'), /'\/api\/og'/,
    '/api/og no está en PUBLICOS: el crawler recibe 401 y la tarjeta se queda sin imagen');
  // Y solo acepta `tipo`, de un conjunto cerrado.
  const og = leer('../app/api/og/route.tsx');
  assert.match(og, /searchParams\.get\('tipo'\)/, 'la imagen dejó de recibir solo el tipo');
  assert.ok(!/searchParams\.get\('(titulo|nombre|texto|id)'\)/.test(og),
    'la imagen empezó a aceptar texto libre: eso lo dibuja cualquiera en una tarjeta con la marca');
  assert.equal(previewDeTipo('inventado'), null, 'un tipo desconocido tiene que caer al default');
});

test('El login arma la tarjeta desde el destino', () => {
  const src = leer('../app/login/page.tsx');
  assert.match(src, /generateMetadata/, 'el login no genera metadata: todo vuelve a la tarjeta genérica');
  assert.match(src, /previewDeDestino\(next\)/, 'no deriva la tarjeta del next=');
  assert.match(src, /api\/og\?tipo=/, 'no apunta a la imagen por tipo');
});

test('El middleware deja pasar /api/og y nada más de lo que no debe', async () => {
  // El 401 en local venía del dev server con el middleware viejo; la lógica es la
  // que manda y se verifica acá, que es determinista.
  const { esPublica } = await import('../lib/rutas-publicas');
  assert.equal(esPublica('/api/og'), true, 'la imagen de la tarjeta volvió a quedar detrás del login');
  assert.equal(esPublica('/plan'), false);
  assert.equal(esPublica('/api/leads'), false);
});
