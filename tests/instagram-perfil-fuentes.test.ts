// =============================================================================
// Instagram · LA función que lee un perfil por su @, con sus fuentes en orden (22/10/2026)
// =============================================================================
// Martín: «no estaba buscando bien a los @», y era el buscador del alta de un lead. Medido el 22/10/2026: ni Google ni
// Apify tenían claves en ningún negocio y sólo 1 de 11 conexiones de Meta tenía permisos de Instagram. Ahora hay UNA
// función (`leerPerfilInstagram`, lib/instagram-perfil-server.ts): la Meta del negocio, la de la plataforma y Apify (que
// lee cuentas personales; lo paga la plataforma y, si no tiene key, el negocio). La usan el alta y Offer/onboarding.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (22/10/2026, arnés romper-ig2.mjs en el scratchpad de la sesión). Los números,
// al lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APIFY_TOPE_POR_DIA, leerPerfilDeApify } from '../lib/instagram-perfil';

const RAIZ = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// rotura (sin la bio de Apify): 1 fallo. rotura (otra cuenta en la lista se toma como ésta): 1 fallo.
test('Apify: la bio, la web, la foto y las publicaciones; una lista vacía u otra cuenta es que no está', () => {
  const r = leerPerfilDeApify('flor.tesis', [{ username: 'Flor.Tesis', fullName: 'Flor', biography: 'Tesis 1 a 1', externalUrl: 'https://flor.com', profilePicUrl: 'https://cdn/x.jpg', followersCount: 10, postsCount: 3, latestPosts: [{ caption: 'post', timestamp: '2026-10-20T00:00:00Z', type: 'Image' }, { caption: '', type: 'Video' }] }]);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.perfil, { usuario: 'flor.tesis', nombre: 'Flor', foto: 'https://cdn/x.jpg', bio: 'Tesis 1 a 1', web: 'https://flor.com', seguidores: 10, publicaciones: 3, posts: [{ fecha: '2026-10-20', tipo: 'Image', texto: 'post' }] });
  assert.equal((leerPerfilDeApify('flor', []) as { motivo: string }).motivo, 'no-esta');
  assert.equal((leerPerfilDeApify('flor', [{ username: 'otra' }]) as { motivo: string }).motivo, 'no-esta', 'otra cuenta no es ésta');
  assert.equal((leerPerfilDeApify('flor', { error: 'x' }) as { motivo: string }).motivo, 'error');
});

// La función REAL, con las fuentes de mentira (tests/_instagram-perfil-hijo.ts).
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_instagram-perfil-hijo.ts')], { cwd: RAIZ, encoding: 'utf8', timeout: 90_000 });
type Caso = { ok: boolean; fuente: string | null; motivo: string | null; pedidos: string[] };
const r = JSON.parse(salida.trim().split('\n').pop() ?? '{}') as Record<string, Caso> & { topeCorridas: number; topeMotivo: string };
const aApify = (c: Caso) => c.pedidos.filter((p) => p.startsWith('api.apify.com'));

// rotura (Apify antes que la Meta del negocio): 1 fallo. rotura (la key del negocio antes que la de la plataforma): 1 fallo.
// rotura (sin la key del negocio cuando la plataforma no tiene): 1 fallo.
test('el orden: la Meta del negocio; si no, Apify con la key de la PLATAFORMA; si no tiene, la del negocio', () => {
  assert.equal(r.metaDelNegocio.fuente, 'meta-negocio');
  assert.deepEqual(aApify(r.metaDelNegocio), [], 'si Meta lo trae, Apify ni se llama (se paga)');
  assert.equal(r.apifyDeLaPlataforma.fuente, 'apify');
  assert.deepEqual(aApify(r.apifyDeLaPlataforma), ['api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items Bearer apify-plataforma'], 'paga la plataforma');
  assert.ok(r.apifyDeLaPlataforma.pedidos.indexOf('graph.facebook.com/v24.0/pagina-9') >= 0, 'antes, la Meta de la plataforma');
  assert.deepEqual(aApify(r.apifyDelNegocio), ['api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items Bearer apify-negocio']);
});

// rotura (un @ corto va a Apify): 1 fallo. rotura (sin caché): 1 fallo. rotura (sin tope por día): 1 fallo.
test('lo que se paga, con freno: un @ corto no va, la misma pregunta una vez, y un tope por día', () => {
  assert.deepEqual(r.arrobaCorto.pedidos, [], '«@flor» no se le pregunta a Apify');
  assert.equal(aApify(r.primera).length, 1);
  assert.equal(aApify(r.segunda).length, 0, 'la segunda vez, de la caché');
  assert.equal(r.noEsta.motivo, 'no-esta');
  assert.equal(r.topeCorridas, APIFY_TOPE_POR_DIA, 'desde cero: 40 corridas y la 41 no sale');
  assert.equal(r.topeMotivo, 'limite');
});

// La revisión adversarial del 22/10/2026 (docs/hallazgos-offer.md, «Un @ de Instagram»).
// rotura (sin el negocio en la clave): 1 fallo. rotura (un «no está» de Meta queda 24 h): 1 fallo.
// rotura (si la key de la plataforma no se lee, paga el negocio): 1 fallo. rotura (sin validar el @): 1 fallo.
// rotura (la caché sin tope): 1 fallo.
test('la caché es por negocio, un «no está» de Meta dura poco, y la plataforma ilegible no hace pagar al negocio', () => {
  assert.equal(r.fugaDeWs5.fuente, 'meta-negocio');
  assert.equal(r.fugaEnWs6.ok, false, 'ws6, sin fuentes, NO recibe lo que ws5 leyó con su token');
  assert.deepEqual(r.fugaEnWs6.pedidos, []);
  assert.equal(r.venenoWs6.motivo, 'sin-conexion');
  assert.equal(r.venenoWs5.fuente, 'meta-negocio', 'el fallo de ws6 no le tapa el @ a ws5');
  assert.equal(r.personalConApifyCaido.motivo, 'no-esta');
  assert.ok((r as unknown as { minutosEnCache: number }).minutosEnCache <= 10, 'Business Discovery no ve cuentas personales: su «no está» no tapa 24 h un Apify caído');
  assert.equal(r.plataformaIlegible.motivo, 'error');
  assert.deepEqual(aApify(r.plataformaIlegible), [], 'sin saber si la plataforma tiene key, no se usa la del negocio');
  assert.deepEqual(r.arrobaInvalido.pedidos, [], 'un @ inválido no llega a la expansión de campos de Graph');
  const s = sinComentarios(leer('lib/instagram-perfil-server.ts'));
  assert.match(s, /const TOPE_CACHE = 500;/);
  assert.match(s, /while \(cache\.size > TOPE_CACHE\) cache\.delete/);
});

// rotura (el alta no pregunta a Apify): 1 fallo. rotura (Offer sin el negocio): 1 fallo.
// El buscador de Competitors Spy (3/11/2026). Roturas en docs/hallazgos-competitors-spy.md.
test('la misma persona se paga una vez aunque cambie la lista de fuentes, y sólo dentro del negocio', () => {
  assert.equal(aApify(r.leeElBuscador).length, 1);
  assert.equal(r.leeElBuscador.fuente, 'apify-spy');
  assert.deepEqual(aApify(r.leeLaVista), [], 'la vista previa no vuelve a pagar lo que el buscador ya leyó');
  assert.equal(r.leeLaVista.ok, true);
  assert.equal(aApify(r.otroNegocio).length, 1, 'otro negocio no lee de la caché de éste');
  assert.equal(aApify(r.quienPidePiezas).length, 1, 'una lectura sin piezas no le contesta a quien las pide');
});

test('la reserva frena antes del cupo de la clave de Spy, y no le tapa nada a quien no la tiene', () => {
  const x = r as unknown as { topeLecturasSpy: number };
  assert.ok(x.topeLecturasSpy > APIFY_TOPE_POR_DIA, 'la clave de Spy tiene su propio cupo, más ancho');
  assert.deepEqual(aApify(r.conReservaFrena), [], 'con el cupo menos la reserva ya gastado, no sale');
  assert.equal(r.conReservaFrena.motivo, 'limite');
  assert.equal(aApify(r.sinReservaLee).length, 1, 'el «limite» de arriba no se cachea para quien la pidió con un clic');
  assert.equal(r.sinReservaLee.ok, true);
  assert.equal(aApify(r.conReservaAunLee).length, 1, 'con una menos todavía hay margen: el freno es exacto');
});

test('las búsquedas por nombre tienen SU cupo: agotarlo no deja sin leer un @ (4/11/2026)', () => {
  const x = r as unknown as { busquedasDelDia: number; topeBusquedasSpy: number; topeAgotadoAntes: boolean; topeAgotadoDespues: boolean };
  assert.equal(x.busquedasDelDia, x.topeBusquedasSpy);
  assert.equal(x.topeAgotadoAntes, false);
  assert.equal(x.topeAgotadoDespues, true);
  assert.equal(aApify(r.leerConBusquedasAgotadas).length, 1, 'gastadas las búsquedas, una lectura igual sale');
  assert.equal(r.leerConBusquedasAgotadas.ok, true);
});

test('varias filas en UNA corrida: cada perfil cuenta, y lo leído no se vuelve a pagar', () => {
  const x = r as unknown as { loteCorridas: number; loteOk: string[]; loteContadas: number; loteRepetidoCorridas: number; loteConReservaOk: number; loteConReservaLimite: number };
  assert.equal(x.loteCorridas, 1, 'tres usuarios, una corrida');
  assert.deepEqual(x.loteOk, ['lote_a', 'lote_b']);
  assert.equal(x.loteContadas, 3, 'cada perfil pedido cuenta una lectura del cupo');
  assert.deepEqual(aApify(r.despuesDelLote), [], 'la confirmación encuentra lo que leyó el lote: no se paga dos veces');
  assert.equal(r.despuesDelLote.ok, true);
  assert.equal(x.loteRepetidoCorridas, 0, 'pedir otra vez lo ya leído no sale a la red');
  assert.equal(x.loteConReservaOk, 1, 'con un solo lugar antes de la reserva entra uno');
  assert.equal(x.loteConReservaLimite, 2, 'y los otros vuelven como «limite», sin pasarse del cupo');
});

test('el alta de un lead y Offer usan LA misma función (sin copiarla)', () => {
  const alta = sinComentarios(leer('app/api/crm/instagram-buscar/route.ts'));
  assert.match(alta, /import \{ leerPerfilInstagram \} from '@\/lib\/instagram-perfil-server';/);
  // ⚠️ 2/11/2026 — ESTA LÍNEA PEDÍA LA LISTA EXACTA `['meta-plataforma', 'apify']` Y SE PUSO ROJA
  // al sumarle `'apify-spy'` (run #360). El rojo era correcto: la lista cambió. Pero fijar el array
  // entero convierte cualquier fuente NUEVA en un fallo, y lo que este test cuida es otra cosa —que
  // el alta llame a LA función compartida en vez de copiarla—. Ahora se piden las dos condiciones
  // que importan: que la llamada esté en el respaldo, y que pruebe las DOS claves de Apify, porque
  // `apify` lee `APIFY_TOKEN` (que no está en ningún negocio) y la que hoy existe la prueba
  // `apify-spy`. Ver `tests/crm-instagram-clave-de-spy.test.ts` y docs/hallazgos-crm.md.
  const respaldo = /if \(!meta\.perfiles\.length && !google\?\.perfiles\.length\) \{[\s\S]{0,200}leerPerfilInstagram\(u, \{ ws, fuentes: \[([^\]]*)\] \}\)/.exec(alta);
  assert.ok(respaldo, 'el alta tiene que leer el perfil por @ exacto cuando ni Meta ni Google trajeron nada');
  assert.match(respaldo[1], /'meta-plataforma'/);
  assert.match(respaldo[1], /'apify'/);
  assert.match(respaldo[1], /'apify-spy'/);
  const offer = sinComentarios(leer('app/api/offer/route.ts'));
  assert.match(offer, /const perfil = await leerPerfilInstagram\(ig, \{ ws: await getWorkspaceActual\(\) \}\);/);
  // Una sola función que lee UN perfil. `leerPerfilesEnLote` (4/11/2026) es otra capacidad —varios en una corrida— y
  // comparte la caché y el lector de la respuesta: no es una copia.
  assert.doesNotMatch(leer('lib/instagram-perfil-server.ts'), /export async function leerPerfil(?!Instagram|esEnLote)/, 'una sola función exportada que lee');
});
