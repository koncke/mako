// =============================================================================
// Lead Magnet ARCHIVADO (11/11/2026, pedido de Martín): con el interruptor apagado, NINGÚN usuario lo ve
// =============================================================================
// Martín: «en la parte de lead magnet sácalo… guárdalo o archívalo… pero no lo quiero en producción». El código sigue entero
// (lib/lead-magnets/archivado.ts dice qué apaga y cómo volver). Esto fija cada entrada, una por una, y que nada se borró.
//
// Probado rompiéndolo (11/11/2026), una rotura por vez y restaurada (qué caso cae):
//   · la fila de nav.ts sin el interruptor                                   → 2
//   · la entrada de lib/funciones-mako.ts sin el interruptor                  → 3
//   · `gatingOk` sin la línea de Lead Magnet                                  → 4
//   · «Crear el regalo» del CoPilot de vuelta a /lead-magnet-generator        → 5
//   · el agente del CoPilot nombrando «Lead Magnet» otra vez                  → 6
//   · la puerta de la pantalla, la de la ruta, la del teléfono, el link público o el Second Brain sin su corte → 7
//   · la fila del teléfono (lib/movil-rutas.ts) o el «Ver en la app» del panel de desarrollo sin el interruptor → 8
// Correr: node --import tsx --test tests/lead-magnet-archivado.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { LEAD_MAGNET_EN_PRODUCCION, NAV_LEAD_MAGNET } from '../lib/lead-magnets/archivado';
import { FAMILIAS, TODOS_LOS_ITEMS, USER_NAV } from '../app/_components/nav';
import { ENTRADAS, funcionDeKey, funcionDeRuta, funcionesMako } from '../lib/funciones-mako';
import { REGISTRO, gatingOk } from '../lib/api-mako/registro';
import { PANTALLA_DE_RUTA, RUTAS_COPILOTO } from '../lib/media-buyer/copiloto';
import { REGLAS_DEL_COPILOTO } from '../lib/media-buyer/copiloto-contexto';
import { DESTINOS_MOVIL, SECCIONES_MAS } from '../lib/movil-rutas';
import { AREAS } from '../app/admin/dev/areas';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. el interruptor está apagado, y nada se borró', () => {
  assert.equal(LEAD_MAGNET_EN_PRODUCCION, false, 'archivado por pedido de Martín (11/11/2026)');
  for (const f of ['app/lead-magnet-generator/page.tsx', 'app/m/lead-magnet-generator/page.tsx', 'app/api/lead-magnet-generator/route.ts',
    'lib/lead-magnets/server.ts', 'lib/api-mako/areas/leadmagnet.def.ts', 'lib/api-mako/areas/leadmagnet.run.ts']) {
    assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} sigue en el repo`);
  }
});

test('2. ni la barra ni el menú de la foto lo tienen, para nadie (tampoco el super admin)', () => {
  const todas = [...TODOS_LOS_ITEMS, ...USER_NAV, ...FAMILIAS.flatMap((f) => [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)])];
  assert.ok(!todas.some((i) => i.key === NAV_LEAD_MAGNET), 'una fila «Lead Magnet» en la barra');
  assert.ok(!todas.some((i) => i.href.startsWith('/lead-magnet-generator')), 'una fila que lleva a /lead-magnet-generator');
});

test('3. MaKo no lo ofrece: no está en el catálogo de funciones', () => {
  assert.ok(!ENTRADAS.some((e) => e.keys.includes(NAV_LEAD_MAGNET)));
  assert.ok(!funcionesMako().some((f) => f.keys.includes(NAV_LEAD_MAGNET) || /lead magnet/i.test(f.nombre)));
  assert.equal(funcionDeKey(NAV_LEAD_MAGNET), undefined);
  assert.equal(funcionDeRuta('/lead-magnet-generator'), undefined);
});

test('4. sus operaciones de la API de MaKo no las ve nadie, ni la plataforma', () => {
  const suyas = REGISTRO.filter((d) => d.gating?.tab === NAV_LEAD_MAGNET);
  assert.ok(suyas.length >= 5, `siguen en el catálogo (${suyas.length}): no se borraron`);
  const plataforma = { ws: 9, rol: 'admin' as const, tabs: [NAV_LEAD_MAGNET], plataforma: true };
  for (const d of suyas) assert.equal(gatingOk(d, plataforma), false, `${d.id} pasa para la plataforma`);
  // Y lo demás sigue igual: una operación cualquiera de otra área pasa.
  const otra = REGISTRO.find((d) => !d.gating);
  if (otra) assert.equal(gatingOk(otra, plataforma), true);
});

test('5. «Crear el regalo» del Marketing CoPilot va al Copywriter, y no se llama «Lead Magnet»', () => {
  assert.equal(RUTAS_COPILOTO.leadMagnets, '/copywriter');
  assert.equal(PANTALLA_DE_RUTA['/copywriter'], 'Copywriting', '«Lead Magnet» no le pisa el nombre');
  assert.ok(!Object.values(PANTALLA_DE_RUTA).includes('Lead Magnet'));
  assert.ok(!Object.keys(PANTALLA_DE_RUTA).some((r) => r.startsWith('/lead-magnet-generator')));
});

test('6. el agente del CoPilot no nombra la pantalla «Lead Magnet»', () => {
  assert.doesNotMatch(REGLAS_DEL_COPILOTO, /Video, Lead Magnet, Web Generator/);
  assert.match(REGLAS_DEL_COPILOTO, /\(Copywriting, Carruseles, Video, Web Generator, Email/);
});

test('7. si alguien abre la dirección: 404 en la pantalla, la del teléfono, la ruta y el link público; y sin el link del Second Brain', () => {
  const puerta = sinComentarios(leer('app/lead-magnet-generator/puerta.ts'));
  assert.match(puerta, /export async function puertaLeadMagnets\(\): Promise<void> \{\s*if \(!LEAD_MAGNET_EN_PRODUCCION\) notFound\(\);/, 'la pantalla, antes de todo');
  assert.match(puerta, /export async function puertaLeadMagnetsApi\(\): Promise<Response \| null> \{\s*if \(!LEAD_MAGNET_EN_PRODUCCION\) return Response\.json\(\{ ok: false, error: 'No existe' \}, \{ status: 404/, 'la ruta, antes de todo');
  assert.match(sinComentarios(leer('app/lead-magnet-generator/page.tsx')), /export default async function LeadMagnetGeneratorPage\([\s\S]*?\)\s*\{\s*await puertaLeadMagnets\(\);/);
  assert.match(sinComentarios(leer('app/api/lead-magnet-generator/route.ts')), /puertaLeadMagnetsApi\(\)/);
  const movil = sinComentarios(leer('app/m/lead-magnet-generator/page.tsx'));
  assert.match(movil, /export default async function LeadMagnetsMovil\([\s\S]*?\)\s*\{\s*if \(!LEAD_MAGNET_EN_PRODUCCION\) notFound\(\);/, 'el teléfono, antes de todo');
  const compartido = sinComentarios(leer('app/compartido/[token]/page.tsx'));
  assert.match(compartido, /if \(acceso\.share\.recurso === RECURSO_LEAD_MAGNET\) \{\s*if \(!LEAD_MAGNET_EN_PRODUCCION\) notFound\(\);/, 'el link público');
  const entregables = sinComentarios(leer('app/onboarding/EntregableView.tsx'));
  assert.match(entregables, /\{g\.pieza && !LEAD_MAGNET_EN_PRODUCCION \? null : g\.pieza\s*\? <Link href=\{`\/lead-magnet-generator/, 'el «En Lead Magnet» del Second Brain');
});

test('8. tampoco en el «More» del teléfono ni en el «Ver en la app» del panel de desarrollo', () => {
  for (const d of [...DESTINOS_MOVIL, ...SECCIONES_MAS]) assert.ok(d.navKey !== NAV_LEAD_MAGNET && !d.href.includes('lead-magnet'), `una fila del teléfono: ${d.id}`);
  const area = AREAS.find((a) => a.slug === 'lead-magnet-generator');
  assert.ok(area, 'su ficha de desarrollo sigue (el código no se borró)');
  assert.equal(area?.verEnApp, undefined, '«Ver en la app» llevaría a un 404');
});
