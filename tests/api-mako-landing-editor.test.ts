// =============================================================================
// El editor del Landing Generator en la API de MaKo (tanda 4, 14/10/2026)
// =============================================================================
// Regla de Martín (13/10): «toda feature nueva va a la API de MaKo; siempre lo debes hacer al
// agregar automatizaciones o funcionalidades». Listar, ver y publicar landings existían para la
// pantalla y no para ningún agente (MaKo por WhatsApp, el chat de la app, la skill, /api/v1).
// Seis operaciones del área `landing`: listar_landings_creadas, ver_landing_creada,
// listar_disenos_landing, crear_landing_desde_diseno, publicar_landing y despublicar_landing.
//
// Lo que fija, y por qué cada cosa:
//   1. la FORMA: la puerta de la página (admin + la tab), publicar en PANTALLA (es público y la
//      dirección es un dato exacto), crear/despublicar por chat, y los ids de crear salen de la
//      MISMA lista que la pantalla;
//   2. que corran por el MISMO server que la pantalla (ningún `.from(` en los runners) y que la
//      dirección pública salga de UNA función (`urlDeLanding`, la que se cambia al integrar);
//   3. lo puro que arma lo que ve el modelo: la lista, las secciones con topes, el diagnóstico
//      (null ≠ «nunca se diagnosticó»), «ya está publicada así» y el alta igual a la de la pantalla;
//   4. las frases reales por el turno que CORRE (clasificarIntencion + herramientasDelTurno).
//
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez, con todo en verde antes (12 pass + 1 todo)
// y restaurado después (12 pass + 1 todo). Pasan / fallan:
//   · publicar_landing con confirmacion 'chat'                                         -> 11 / 1
//   · G_WRITER con tab 'landing-an' en vez de 'landing-writer'                         -> 11 / 1
//   · un `.from('landing_docs')` dentro del runner de despublicar_landing              -> 11 / 1
//   · `urlPublica(APP_BASE_URL, …)` en vez de urlDeLanding en el runner de publicar    -> 11 / 1
//   · pedidoDeCrear con `plantillasDe('presentacion')` (otra lista que la pantalla)    -> 11 / 1
//   · estaPublicada = `!!d.slug` (una despublicada conserva el slug)                    -> 11 / 1
//   · paginasEnTexto sin el corte del tope total                                       -> 11 / 1
//   · diagnosticoParaApi(null) tratado como [] («nunca se diagnosticó»)                 -> 11 / 1
//   · yaPublicadaAsi sin mirar `sitio_activo`                                           -> 11 / 1
//   · crear_landing_desde_diseno sin el `if (enFlujo(ctx))`                             -> 11 / 1
// Tras la revisión adversarial (14/10/2026), con todo en verde antes (14 pass + 1 todo) y
// restaurado después (14 pass + 1 todo), una rotura por vez:
//   · direccionParaPublicar devuelve la SUGERIDA sin que nadie la pida                  -> 13 / 1
//   · el runner de publicar usa `disp?.sugerencia ?? dir.slug`                         -> 13 / 1
//   · publicar dice «ya está así» también a una persona (sin `sinPersona(ctx) &&`)    -> 13 / 1
//   · sinPersona = sólo enFlujo (un token por HTTP republicaría en bucle)             -> 13 / 1
//   · siFallaNuestra con `> 500` (un 500 de la base salía como 400 crudo)             -> 13 / 1
//   · listar_landings_creadas sin siFallaNuestra                                       -> 13 / 1
//   · resumenPublicar sin la nota «sin cambios guardados nuevos»                      -> 13 / 1
// Integración con hola-mako.site (14/10/2026), base 16 pass + 1 todo, restaurado de memoria (sha256
// igual) después de cada una:
//   · urlDeLanding con `${APP_BASE_URL}/l/<slug>` (lo de antes de integrar)           -> 15 / 1
//   · el runner de publicar con `urlPublicaLanding(r.slug)` sin urlDeLanding          -> 15 / 1
//   · publicar() (publicar.ts) devolviendo otra dirección que la de la API            -> 15 / 1
// El aviso del video sin enlace en el resumen de publicar (base 17 pass + 1 todo):
//   · el runner de publicar sin `avisoDeVideo(publicables)`                          -> 16 / 1
//   · resumenPublicar ignorando `faltaVideo`                                          -> 16 / 1
// El `todo` (punto 4, «publicá la landing…») NO es una rotura: falla hoy porque el clasificador
// no reconoce el pedido. Es el BLOQUEANTE de lib/mako-intencion.ts (docs/hallazgos-editor-landing.md,
// «Tanda 4»); con el parche aplicado pasa y se le saca el `todo`. Medido el 14/10 con el parche en
// una COPIA del clasificador (sin tocar el archivo): las cinco frases llegan con su herramienta, y
// «Publicar la landing nueva» (dictado) y «armame un anuncio para la landing» (Ads) siguen afuera.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { porArea, porId, type Vista } from '../lib/api-mako/registro';
import { esAccion, esLectura, type AccionDef } from '../lib/api-mako/tipos';
import { rutaRestDe } from '../lib/api-mako/rest';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { DISENOS_LANDING, OBJETIVOS_LANDING } from '../lib/editor-landing/disenos-landing';
import { pedidoDeDiseno, plantillasDe } from '../app/landing-generator/crear/tipo';
import { APP_BASE_URL, urlPublicaLanding } from '../lib/app-url';
import { TEXTO_FALTA_VIDEO, avisoDeVideo } from '../lib/editor-landing/especificacion';
import type { LandingResumen } from '../lib/editor-landing/api-tipos';
import type { Sugerencia } from '../lib/editor-landing/diagnostico';
import {
  disenosParaApi, listaParaApi, paginasEnTexto, diagnosticoParaApi, pedidoDeCrear, yaPublicadaAsi, resumenPublicar,
  urlDeLanding, estaPublicada, direccionParaPublicar, siFallaNuestra, TOPES_VER, type FilaPublicable, type DisponibilidadSlug,
  urlPublicaParaApi, botonesDeLanding, elegirBotonDePago, conProductoEnBoton, resumenCobrar, TEXTO_BOTON_PAGO,
  pedidoDePresentacion, analiticaParaApi, resumenDespublicar, rechazosParaApi, versionesParaApi, TOPE_VERSIONES_API,
} from '../lib/api-mako/areas/landing-editor.helpers';
import { pedidoDePlantilla } from '../app/landing-generator/crear/tipo';
import { PLANTILLAS_PRESENTACION } from '../lib/editor-landing/plantillas-presentaciones';
import { NODO as NODO_DOC, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const LECTURAS = ['listar_landings_creadas', 'ver_landing_creada', 'listar_disenos_landing'];
const ACCIONES = ['crear_landing_desde_diseno', 'despublicar_landing', 'publicar_landing'];
const IDS = [...LECTURAS, ...ACCIONES];

const accion = (id: string): AccionDef => {
  const d = porId(id);
  assert.ok(d && esAccion(d), `«${id}» no es una acción del registro`);
  return d;
};

/** El bloque de un runner en landing.run.ts: desde `  <id>: {` hasta el próximo runner o el cierre. */
function runnerDe(id: string): string {
  const src = sinComentarios(leer('lib/api-mako/areas/landing.run.ts'));
  const i = src.search(new RegExp(`^  ${id}: \\{`, 'm'));
  assert.ok(i >= 0, `no encuentro el runner de ${id}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/^ {2}[a-z_]+: \{|^\};/m);
  return src.slice(i, i + 1 + (fin < 0 ? resto.length : fin));
}

// ── 1. La forma ───────────────────────────────────────────────────────────────

test('las seis operaciones están en el área landing, con la puerta de /landing-generator', () => {
  const ids = new Set(porArea('landing').map((d) => d.id));
  for (const id of IDS) assert.ok(ids.has(id), `falta ${id} en el área landing`);
  // La página hace requireRolWs([], { nav: 'landing-writer' }) = sólo el admin, con la tab en su capa.
  // `gating.tab` mira la CAPA, no a la persona: sin rolMinimo un closer haría por MaKo lo que la
  // pantalla le esconde (docs/hallazgos-api-mako.md).
  assert.match(sinComentarios(leer('app/landing-generator/page.tsx')), /requireRolWs\(\[\], \{ nav: 'landing-writer' \}\)/);
  for (const id of IDS) {
    const d = porId(id)!;
    assert.deepEqual(d.gating, { tab: 'landing-writer', rolMinimo: 'admin' }, `${id}: la puerta no es la de la página`);
    assert.equal(d.costo, 'gratis', `${id}: nada de esto llama a un modelo ni a un tercero`);
    assert.deepEqual([...d.canales].sort(), ['app', 'http', 'whatsapp'], `${id}: los canales (http decidido)`);
    assert.ok(rutaRestDe(id), `${id} sale por HTTP y no tiene ruta REST`);
  }
  for (const id of LECTURAS) assert.ok(esLectura(porId(id)!), `${id} es una lectura`);
});

test('publicar va en PANTALLA; crear y despublicar por chat; todas reversibles', () => {
  const pub = accion('publicar_landing');
  assert.equal(pub.confirmacion, 'pantalla', 'publicar deja algo PÚBLICO y la dirección es un dato exacto: se revisa en pantalla');
  assert.equal(pub.pantalla, '/mako/revisar');
  assert.deepEqual(pub.parametros.map((p) => p.nombre), ['id', 'slug'], 'sin `version`: se publica lo GUARDADO al confirmar');
  for (const id of ['crear_landing_desde_diseno', 'despublicar_landing']) assert.equal(accion(id).confirmacion, 'chat', id);
  for (const id of ACCIONES) assert.equal(accion(id).reversible, true, id);
});

test('crear acepta EXACTAMENTE los diseños y objetivos de la pantalla', () => {
  const p = (n: string) => accion('crear_landing_desde_diseno').parametros.find((x) => x.nombre === n)!;
  assert.deepEqual([...p('diseno').enum!], DISENOS_LANDING.map((d) => d.id));
  assert.deepEqual([...p('objetivo').enum!], OBJETIVOS_LANDING.map((o) => o.id));
  assert.deepEqual(plantillasDe('landing').map((x) => x.id), DISENOS_LANDING.map((d) => d.id), 'la caja ofrece los mismos diseños');
});

// ── 2. El mismo server que la pantalla, y UNA función para la dirección ───────

test('los runners corren por el server de la pantalla: ningún acceso a la base propio', () => {
  const llamadas: Record<string, RegExp> = {
    listar_landings_creadas: /docsEditor\.listar\(\)/,
    ver_landing_creada: /docsEditor\.abrir\(id\)[\s\S]*comentariosDelDiagnostico\(\{ docId: id \}\)/,
    crear_landing_desde_diseno: /docsEditor\.crear\(pedido\)/,
    despublicar_landing: /despublicarEnEditor\(id\)/,
    publicar_landing: /docsEditor\.slugDisponible\([\s\S]*publicarEnEditor\(id, f\.version, slug\)/,
  };
  for (const id of IDS) {
    const b = runnerDe(id);
    assert.ok(!/\.from\(|getTenantDb|getSupabaseServer/.test(b), `${id}: escribe o lee la base por su cuenta (segunda implementación)`);
    if (llamadas[id]) assert.match(b, llamadas[id], `${id}: no pasa por el server de la pantalla`);
  }
  const helpers = sinComentarios(leer('lib/api-mako/areas/landing-editor.helpers.ts'));
  assert.ok(!/\.from\(|getTenantDb|getSupabaseServer|'server-only'/.test(helpers), 'los helpers son puros');
});

test('la dirección pública sale de UNA función (urlDeLanding): el día que se muda, se cambia en un lugar', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/landing.run.ts'));
  assert.ok(!/\b(?:urlPublica|urlPublicaLanding|rutaInternaL|urlLandingEn)\(/.test(run), 'landing.run.ts arma una URL pública sin urlDeLanding');
  for (const id of ['ver_landing_creada', 'publicar_landing']) assert.match(runnerDe(id), /urlDeLanding\(/, id);
  // Verificación de la tanda 6: el resumen de despublicar se arma en `resumenDespublicar` (helpers, puro),
  // que usa urlDeLanding: lo ejecuta el test de abajo («despublicar dice el dominio y el borrador»).
  assert.match(runnerDe('despublicar_landing'), /resumenDespublicar\(\{ que, titulo: f\.titulo, slug: f\.slug, dominio: antes\?\.dominio \?\? null, cambiosSinPublicar: antes\?\.cambiosSinPublicar \?\? false, incierto \}\)/);
});

test('despublicar dice el dominio y el borrador: lo que callaba antes de confirmar (verificación de la tanda 6)', () => {
  const base = { que: 'la landing' as const, titulo: 'Webinar', slug: 'webinar', dominio: null, cambiosSinPublicar: false };
  const solo = resumenDespublicar(base);
  assert.ok(solo.includes(`${urlDeLanding('webinar')} deja de mostrarla`), solo);
  assert.doesNotMatch(solo, /dominio|cambios sin publicar|comprobar/);
  const conTodo = resumenDespublicar({ ...base, dominio: 'promo.tunegocio.com', cambiosSinPublicar: true });
  assert.ok(conTodo.includes(`${urlDeLanding('webinar')} y su dominio propio https://promo.tunegocio.com dejan de mostrarla`), conTodo);
  assert.match(conTodo, /volver a publicarla sube ESOS cambios/);
  // Si la lectura del dominio falló, no se afirma que no tiene: se dice que no se pudo comprobar.
  assert.match(resumenDespublicar({ ...base, incierto: true }), /No pude comprobar si tiene un dominio propio/);
  // El runner pregunta ANTES (motor: antesDeDespublicar) y no se calla si falla.
  const r = runnerDe('despublicar_landing');
  assert.match(r, /try \{ antes = await docsEditor\.antesDeDespublicar\(ctx\.ws, id\); \} catch \{ incierto = true; \}/);
});

test('lo que el motor de la tanda 6 ya sabía y la API no decía: el puntaje, los rechazos del pago y las versiones', () => {
  // El puntaje guardado (mig 0281): sale con los comentarios, y un diagnóstico sin comentarios SÍ se diagnosticó.
  const resumen = { score: 6.8, veredicto: 'Promesa clara', resumen: null, analizado: '2026-10-14T15:00:00.000Z' };
  const conPuntaje = diagnosticoParaApi([sug(1, 'alta', 'pendiente', '2026-10-10')], resumen) as { puntaje: number; veredicto: string; diagnosticada_el: string; nota: string };
  assert.deepEqual([conPuntaje.puntaje, conPuntaje.veredicto, conPuntaje.diagnosticada_el], [6.8, 'Promesa clara', '2026-10-14T15:00:00.000Z']);
  assert.doesNotMatch(conPuntaje.nota, /no se guarda/, 'la nota vieja decía que el puntaje no se guarda');
  const sinComentarios = diagnosticoParaApi([], resumen) as { diagnosticada: boolean; puntaje: number };
  assert.deepEqual([sinComentarios.diagnosticada, sinComentarios.puntaje], [true, 6.8]);
  assert.equal((diagnosticoParaApi([sug(1, 'alta', 'pendiente', '2026-10-10')]) as { puntaje: null }).puntaje, null);
  assert.match(runnerDe('ver_landing_creada'), /resumen = s\.ok \? s\.resumen : null;[\s\S]*diagnostico: diagnosticoParaApi\(sugerencias, resumen\),/);
  // Los rechazos: por motivo con nombre de la API, y sin la tabla los ceros no se afirman.
  const rech = rechazosParaApi(9, 30, { total: 4, porMotivo: { 'tope-email': 3, techo: 0, 'dominio-ajeno': 1, producto: 0 }, otros: 0, ultimoDia: '2026-10-13', desde: '2026-09-15', sinTabla: false });
  assert.deepEqual(rech.por_motivo, { tope_email: 3, techo: 0, dominio_ajeno: 1, producto: 0 });
  assert.equal(rech.ultimo_dia, '2026-10-13');
  assert.match(rechazosParaApi(9, 30, { total: 0, porMotivo: {}, otros: 0, ultimoDia: null, desde: '2026-09-15', sinTabla: true }).nota, /no quieren decir que no hubo/);
  assert.match(runnerDe('ver_rechazos_pago_landing'), /await rechazosDePago\(ctx\.ws, id, dias\)/);
  assert.match(runnerDe('ver_rechazos_pago_landing'), /if \(!r\) return errorLectura\(noExisteCreada\(id\)\);/);
  // Las versiones (el «Deshacer» de aplicar): con número, tope y lo que no entra contado.
  const vs = Array.from({ length: 32 }, (_, i) => ({ id: 100 - i, creado: '2026-10-14T10:00:00Z', motivo: i === 0 ? 'Antes de aplicar el diagnóstico' : 'Guardada', autor: null, titulo: 'Webinar' }));
  const lista = versionesParaApi(5, vs) as { versiones: { version: number; motivo: string }[]; versiones_afuera: number };
  assert.equal(lista.versiones.length, TOPE_VERSIONES_API);
  assert.deepEqual(lista.versiones[0], { version: 100, creada: '2026-10-14T10:00:00Z', motivo: 'Antes de aplicar el diagnóstico', autor: null, titulo: 'Webinar' });
  assert.equal(lista.versiones_afuera, 2);
  // Restaurar: el MISMO restaurarVersion que la pantalla, el comentario de ESA landing, y por chat (reversible:
  // deja «Antes de restaurar»). Y aplicar ya no manda a un historial que la API no tenía.
  const restaurar = runnerDe('restaurar_version_landing');
  assert.match(restaurar, /await docsEditor\.restaurarVersion\(id, version\)/);
  assert.match(restaurar, /if \(!c \|\| c\.docId !== id\) return \{ error:/);
  assert.match(restaurar, /await estadoDeComentario\(\{ id: comentario, estado: 'pendiente' \}\)/);
  assert.doesNotMatch(restaurar, /\.from\(/);
  const r = accion('restaurar_version_landing');
  assert.equal(r.confirmacion, 'chat');
  assert.ok(r.reversible);
  assert.deepEqual(r.gating, { tab: 'landing-writer', rolMinimo: 'admin' });
  assert.match(accion('aplicar_comentario_landing').descripcion, /restaurar_version_landing/);
  for (const id of ['ver_rechazos_pago_landing', 'listar_versiones_landing', 'restaurar_version_landing']) assert.ok(rutaRestDe(id), `${id} sin ruta REST`);
});

// Integración de la tanda 4 (14/10/2026): las publicadas viven en https://hola-mako.site/<slug>. Antes
// de integrar, urlDeLanding armaba `hola-mako.com/l/<slug>`, que en producción es un 308: la URL que el
// dueño pega en un anuncio redirigía, y la que contestaba la API no era la del diálogo Publicar.
test('urlDeLanding es la dirección PÚBLICA real, y la MISMA que muestra el diálogo Publicar', () => {
  const conEntorno = <T>(valor: string | undefined, f: () => T): T => {
    const antes = process.env.VERCEL_ENV;
    if (valor === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = valor;
    try { return f(); } finally { if (antes === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = antes; }
  };
  conEntorno('production', () => {
    assert.equal(urlDeLanding('mi-oferta'), 'https://hola-mako.site/mi-oferta');
    assert.equal(urlDeLanding('mi-oferta', 'gracias'), 'https://hola-mako.site/mi-oferta/gracias');
    assert.equal(urlDeLanding('mi-oferta'), urlPublicaLanding('mi-oferta'));
  });
  for (const env of [undefined, 'preview']) {
    conEntorno(env, () => assert.equal(urlDeLanding('mi-oferta'), `${APP_BASE_URL}/l/mi-oferta`, String(env)));
  }
  // La cadena hasta la pantalla: publicar() devuelve `urlPublicaLanding(slug)` y el diálogo la muestra
  // (`setUrl(r.url)`); al abrir, la de `aCompleta` (server.ts), que sale de la MISMA función.
  const publicar = sinComentarios(leer('lib/editor-landing/publicar.ts'));
  assert.match(publicar, /const url = urlPublicaLanding\(slug\);[\s\S]{0,200}return \{ ok: true, url, slug,/);
  assert.match(sinComentarios(leer('lib/editor-landing/server.ts')), /urlPublica: f\.slug && f\.publicado_at \? urlPublicaLanding\(f\.slug\) : null/);
  const dialogo = sinComentarios(leer('app/landing-generator/editor/dialogos/DialogoPublicar.tsx'));
  assert.match(dialogo, /setUrl\(r\.url\)/);
  assert.match(dialogo, /if \(r\.doc\.urlPublica\) setUrl\(r\.doc\.urlPublica\)/);
  // Los helpers siguen sin `server-only` (lo importa este test) y la sacan de app-url.ts, no armada a mano.
  assert.match(sinComentarios(leer('lib/api-mako/areas/landing-editor.helpers.ts')), /import \{ urlPublicaLanding \} from '@\/lib\/app-url';/);
});

test('crear no corre en una automatización, y publicar/despublicar dicen «ya está así»', () => {
  assert.match(runnerDe('crear_landing_desde_diseno'), /preparar: async \(input, ctx\)[^{]*\{\s*if \(enFlujo\(ctx\)\) return \{ error:/);
  // Publicar dice «ya está así» SÓLO sin una persona (un flujo o un token): a una persona se le deja
  // republicar como el botón de la pantalla, porque la foto hornea lo que cambia sin subir la
  // versión (los temas propios del negocio). Revisión adversarial del 14/10/2026.
  assert.match(runnerDe('publicar_landing'), /sinPersona\(ctx\) && yaPublicadaAsi\(fila, slug\)\) return \{ error: .*yaEstaba: true \};/);
  assert.match(sinComentarios(leer('lib/api-mako/areas/landing.run.ts')), /const sinPersona = \(ctx: Ctx\): boolean => enFlujo\(ctx\) \|\| ctx\.canal === 'http';/);
  assert.match(runnerDe('despublicar_landing'), /yaEstaba: true \}/);
});

test('publicar: la dirección es la PEDIDA o la que ya tenía; la sugerida vuelve para ir en `slug`, nunca se publica sola', () => {
  // La pantalla genérica guarda el INPUT y vuelve a correr preparar() al confirmar: una sugerida se
  // recalcularía (otro título, otro negocio que la tomó) y se publicaría en una URL que la persona no vio.
  const sinPedir = (sugerencia: string | null): DisponibilidadSlug => ({ slug: '', disponible: false, sugerencia, motivo: 'Falta la dirección' });
  const nunca = direccionParaPublicar(null, null, sinPedir('webinar-marzo'));
  assert.ok('error' in nunca, 'una landing que nunca se publicó NO sale en la sugerida sin pedirla');
  assert.deepEqual(nunca.faltan, ['slug']);
  assert.deepEqual(nunca.disponibles, ['webinar-marzo']);
  assert.match(nunca.error, /«webinar-marzo»/, 'la sugerida va en el texto: por HTTP directo sólo viaja el texto');
  const sinLibre = direccionParaPublicar(null, null, sinPedir(null));
  assert.ok('error' in sinLibre && sinLibre.faltan?.includes('slug'));
  assert.deepEqual(direccionParaPublicar(null, 'webinar', null), { slug: 'webinar' }, 'la que ya tenía');
  assert.deepEqual(direccionParaPublicar('Mi Webinar', 'webinar', { slug: 'mi-webinar', disponible: true, sugerencia: null, motivo: null }), { slug: 'mi-webinar' }, 'la pedida, como la normalizó slugDisponible');
  const tomada = direccionParaPublicar('webinar', null, { slug: 'webinar', disponible: false, sugerencia: 'webinar-2', motivo: 'Ya está tomada' });
  assert.ok('error' in tomada && /ya está tomada/.test(tomada.error));
  assert.deepEqual((tomada as { disponibles?: string[] }).disponibles, ['webinar-2']);
  // Y el runner no tiene otra fuente: ni una `sugerencia` suelta, ni un slug armado por su cuenta.
  const b = runnerDe('publicar_landing');
  assert.match(b, /direccionParaPublicar\(pedida, f\.slug, disp\)/);
  assert.doesNotMatch(b, /sugerencia/, 'el runner publica una sugerida por su cuenta');
});

test('un error de la BASE no viaja crudo: se tira con «api-mako:» y el choke point lo hace 500 genérico', () => {
  assert.throws(() => siFallaNuestra({ ok: false, error: 'Error leyendo landing_docs (página 1): canceling statement', status: 500 }), /^Error: api-mako: Error leyendo landing_docs/);
  assert.throws(() => siFallaNuestra({ ok: false, error: 'Vercel', status: 502 }), /^Error: api-mako:/);
  for (const status of [400, 403, 404, 409, 413, 422]) assert.doesNotThrow(() => siFallaNuestra({ ok: false, error: 'del que llama', status }), `status ${status}`);
  // El prefijo es el que `esNuestro` reconoce (lib/api-mako/ejecutar.ts): si cambia allá, esto miente.
  assert.match(leer('lib/api-mako/ejecutar.ts'), /const esNuestro = \(msg: string\): boolean =>\s*\/api-mako:\|/);
  assert.match(runnerDe('listar_landings_creadas'), /if \(!r\.ok\) \{ siFallaNuestra\(r\); return errorLectura\(/);
  assert.match(runnerDe('ver_landing_creada'), /if \(!r\.ok\) \{ siFallaNuestra\(r\); return errorLectura\(/);
  assert.match(runnerDe('publicar_landing'), /if \(!d\.ok\) \{ siFallaNuestra\(d\); return \{ error:/);
});

// ── 3. Lo puro ────────────────────────────────────────────────────────────────

const resumen = (o: Partial<LandingResumen> & { id: number }): LandingResumen => ({
  titulo: `L${o.id}`, tema: 'pewter', creado: '2026-10-01T00:00:00Z', actualizado: '2026-10-02T00:00:00Z', creadoPor: 'Ana',
  favorito: false, carpeta: null, papelera: false, slug: null, publicadoAt: null, primera: null, formato: 'pagina', ...o,
});

test('la lista: sin la papelera, con tope, y publicada = dirección Y foto', () => {
  const docs = [
    resumen({ id: 1, slug: 'webinar', publicadoAt: '2026-10-03T00:00:00Z' }),
    resumen({ id: 2, slug: 'vieja', publicadoAt: null }), // despublicada: conserva el slug
    resumen({ id: 3, formato: 'presentacion' }),
    resumen({ id: 4, papelera: true, slug: 'borrada', publicadoAt: '2026-10-03T00:00:00Z' }),
  ];
  const r = listaParaApi(docs, 2);
  assert.equal(r.total, 3);
  assert.equal(r.en_papelera, 1);
  assert.equal(r.mostradas, 2);
  assert.ok(r.nota_recorte, 'lo que queda afuera se dice');
  assert.deepEqual(r.landings.map((l) => [l.id, l.publicada, l.url_publica]), [[1, true, urlDeLanding('webinar')], [2, false, null]]);
  assert.equal(listaParaApi(docs, 50).landings.find((l) => l.id === 3)!.formato, 'presentacion');
  assert.ok(!JSON.stringify(listaParaApi(docs, 50)).includes('Ana'), 'el nombre de quien la creó no viaja (datos del equipo)');
  assert.equal(estaPublicada({ slug: 'x', publicadoAt: null }), false);
});

const tarjeta = (id: string, texto: string, oculta = false) => ({
  type: 'tarjeta', attrs: { id, ...(oculta ? { oculta: true } : {}) },
  content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: `Título ${id}` }] }, { type: 'paragraph', content: [{ type: 'text', text: texto }] }],
});

test('las secciones en texto: las ocultas se cuentan, lo largo se corta y el tope total se nombra', () => {
  const largo = 'x'.repeat(TOPES_VER.textoSeccion + 200);
  const muchas = Array.from({ length: 20 }, (_, i) => tarjeta(`s${i}`, 'y'.repeat(1400)));
  const c = {
    v: 1 as const,
    paginas: [
      { id: 'p1', titulo: 'Inicio', ruta: '', doc: { type: 'doc' as const, content: [tarjeta('a', 'Hola'), tarjeta('b', 'Escondida', true), tarjeta('c', largo)] } },
      { id: 'p2', titulo: 'Gracias', ruta: 'gracias', doc: { type: 'doc' as const, content: muchas } },
    ],
  };
  const r = paginasEnTexto(c as never);
  const [inicio, gracias] = r.paginas;
  assert.equal(inicio.secciones_ocultas, 1);
  assert.deepEqual(inicio.secciones.map((s) => s.id), ['a', 'c'], 'la oculta no sale');
  assert.equal(inicio.secciones[1].texto_cortado, true);
  assert.ok(inicio.secciones[1].texto!.length <= TOPES_VER.textoSeccion + 1);
  assert.ok(gracias.secciones.some((s) => s.texto === null), 'pasado el tope total, la sección sale con su título y texto null');
  assert.equal(r.secciones_sin_texto_por_tope, gracias.secciones.filter((s) => s.texto === null).length);
  const total = r.paginas.flatMap((p) => p.secciones).reduce((n, s) => n + (s.texto?.length ?? 0), 0);
  assert.ok(total <= TOPES_VER.textoTotal, `viajaron ${total} caracteres`);
});

const sug = (id: number, severidad: 'alta' | 'media' | 'baja', estado: Sugerencia['estado'], creado: string): Sugerencia => ({
  id, estado, creado, actualizado: creado, cita: `cita ${id}`, seccionId: null,
  hallazgo: { titulo: `h${id}`, severidad, seccion: 'hero', cita: `cita ${id}`, por_que: 'porque', arreglo: 'arreglo' },
});

test('el diagnóstico: «no pude leer» no es «nunca se diagnosticó», y los pendientes van por severidad', () => {
  assert.equal(diagnosticoParaApi(null).leido, false);
  assert.equal((diagnosticoParaApi(null) as { diagnosticada?: boolean }).diagnosticada, undefined, 'null no afirma nada');
  assert.equal((diagnosticoParaApi([]) as { diagnosticada: boolean }).diagnosticada, false);
  const r = diagnosticoParaApi([
    sug(1, 'baja', 'pendiente', '2026-10-10'), sug(2, 'alta', 'pendiente', '2026-10-09'), sug(3, 'media', 'resuelta', '2026-10-11'),
    sug(4, 'alta', 'descartada', '2026-10-08'), sug(5, 'alta', 'pendiente', '2026-10-12'),
  ]) as { pendientes: number; resueltos: number; descartados: number; ultimo_comentario_el: string; comentarios: { titulo: string }[] };
  assert.deepEqual([r.pendientes, r.resueltos, r.descartados], [3, 1, 1]);
  assert.deepEqual(r.comentarios.map((c) => c.titulo), ['h5', 'h2', 'h1'], 'alta primero, y entre iguales la más nueva');
  assert.equal(r.ultimo_comentario_el, '2026-10-12');
});

const fila = (o: Partial<FilaPublicable> = {}): FilaPublicable => ({
  titulo: 'Webinar', version: 7, slug: 'webinar', publicado_at: '2026-10-10T12:00:00Z', publicado_version: 7, sitio_activo: true, papelera_at: null, ...o,
});

test('«ya está publicada así»: misma dirección, lo último guardado y el sitio prendido', () => {
  assert.equal(yaPublicadaAsi(fila(), 'webinar'), true);
  assert.equal(yaPublicadaAsi(fila({ publicado_version: 6 }), 'webinar'), false, 'hay cambios guardados sin publicar');
  assert.equal(yaPublicadaAsi(fila({ sitio_activo: false }), 'webinar'), false, 'pausada: publicar la prende');
  assert.equal(yaPublicadaAsi(fila(), 'otra'), false, 'cambia la dirección');
  assert.equal(yaPublicadaAsi(fila({ publicado_at: null }), 'webinar'), false, 'despublicada');
  const r = resumenPublicar(fila({ publicado_version: 6 }), 'nueva', 'landing');
  assert.ok(r.includes(urlDeLanding('nueva')) && r.includes(urlDeLanding('webinar')), 'nombra la dirección nueva y la que deja de andar');
  assert.ok(resumenPublicar(fila({ sitio_activo: false, publicado_version: 6 }), 'webinar', 'landing').includes('pausado'));
  assert.ok(resumenPublicar(fila(), 'webinar', 'presentacion').startsWith('Publicar la presentación'));
  // A una persona se le deja republicar sin cambios (como la pantalla), y el resumen se lo dice.
  assert.match(resumenPublicar(fila(), 'webinar', 'landing'), /sin cambios guardados nuevos/);
  assert.doesNotMatch(resumenPublicar(fila({ publicado_version: 6 }), 'webinar', 'landing'), /sin cambios guardados nuevos/);
});

// Integración de la tanda 4 (14/10/2026): una landing creada por la API desde un diseño trae el VSL
// VACÍO (crear_landing_desde_diseno); publicada así, el inicio sale sin video. El diálogo Publicar lo
// avisa sin frenar (`avisoDeVideo`); la API, en el resumen que la persona confirma, igual.
test('publicar por la API avisa, como la pantalla, si un video quedó sin su enlace (y no frena)', () => {
  const nueva = pedidoDeCrear(DISENOS_LANDING.find((d) => d.video)!.id, 'webinar', null);
  assert.ok(nueva?.contenido, 'el alta de un diseño con video');
  const paginas = nueva.contenido.paginas;
  assert.equal(avisoDeVideo(paginas), TEXTO_FALTA_VIDEO, 'lo creado por la API trae el VSL vacío');
  assert.ok(resumenPublicar(fila(), 'webinar', 'landing', avisoDeVideo(paginas)).includes(TEXTO_FALTA_VIDEO));
  assert.ok(!resumenPublicar(fila(), 'webinar', 'landing', null).includes(TEXTO_FALTA_VIDEO));
  // El runner lo calcula sobre lo MISMO que se publica (`publicables`) y no corta: devuelve el payload.
  assert.match(runnerDe('publicar_landing'), /return \{ payload: \{ id, slug \}, resumen: resumenPublicar\(fila, slug, formatoParaApi\([^)]*\), avisoDeVideo\(publicables\)\) \};/);
});

test('el alta de crear es EXACTAMENTE la de la pantalla (pedidoDeDiseno), con el título encima', () => {
  // Los ids de sección son al azar (nuevoId): se comparan con los ids tapados.
  const sinIds = (v: unknown) => JSON.stringify(v).replace(/"id":"[^"]+"/g, '"id":"X"').replace(/#t-[A-Za-z0-9_-]+/g, '#t-X');
  for (const d of DISENOS_LANDING) {
    for (const o of OBJETIVOS_LANDING) {
      const nuestro = pedidoDeCrear(d.id, o.id, null);
      const pantalla = pedidoDeDiseno(plantillasDe('landing').find((p) => p.id === d.id)!, o.id);
      assert.ok(nuestro && pantalla, `${d.id} × ${o.id}`);
      assert.equal(sinIds(nuestro), sinIds(pantalla), `${d.id} × ${o.id}: el alta difiere de la de la pantalla`);
    }
  }
  assert.equal(pedidoDeCrear('claro-clasico', 'webinar', 'Mi webinar')!.titulo, 'Mi webinar');
  assert.equal(pedidoDeCrear('no-existe', 'webinar', null), null);
  assert.equal(pedidoDeCrear('claro-clasico', 'no-existe', null), null);
});

// ── 4. Las frases reales llegan con su herramienta ────────────────────────────

/** Los NOMBRES de las herramientas de siempre (server-only), pedidos a un node aparte como
 *  tests/api-mako-cobros.test.ts. Una lista escrita a mano mediría otra cosa. */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };
const turno = (mensaje: string): string[] => {
  const veredicto = clasificarIntencion(mensaje, {});
  return herramientasDelTurno({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false }).tools.map((t) => t.name);
};

test('por WhatsApp: las preguntas leen (y no proponen) y los pedidos que el clasificador ya conoce llegan', () => {
  // Medido el 14/10/2026 con el turno que corre. En una pregunta MaKo OFRECE: no viajan las que escriben.
  for (const f of ['qué landings tengo creadas?', 'qué dice mi landing de webinar?']) {
    const n = turno(f);
    assert.ok(n.includes('listar_landings_creadas') && n.includes('ver_landing_creada'), `${f}: ${n.join(', ')}`);
    assert.ok(!n.includes('publicar_landing') && !n.includes('crear_landing_desde_diseno'), `${f}: en una pregunta viajó una escritura`);
  }
  assert.ok(turno('subí los cambios de mi landing').includes('publicar_landing'));
  const crear = turno('armame una landing para agendar llamadas con el diseño oscuro');
  assert.ok(crear.includes('crear_landing_desde_diseno') && crear.includes('listar_disenos_landing'), crear.join(', '));
});

test('por WhatsApp: «publicá / despublicá / creame una landing» llegan con su herramienta', {
  todo: 'BLOQUEANTE de lib/mako-intencion.ts (esPedidoDeLanding): hoy caen en `capturar` dudosa, sin herramientas',
}, () => {
  const casos: Array<[string, string]> = [
    ['publicá la landing de lista de espera', 'publicar_landing'],
    ['me puedes publicar la landing de webinar?', 'publicar_landing'],
    ['despublicá la landing del webinar', 'despublicar_landing'],
    ['sacá de internet la landing del webinar', 'despublicar_landing'],
    ['creame una landing de webinar', 'crear_landing_desde_diseno'],
  ];
  for (const [f, tool] of casos) assert.ok(turno(f).includes(tool), `${f} → sin ${tool}`);
});

// Los diseños con video (14/10/2026, «deberían ser tipo VSL Funnel»): un agente que elige el diseño con
// la persona tiene que saber cuál trae el VSL al inicio, como lo ve ella en la miniatura.
// Rotura (14/10/2026, a mano y restaurada): sacar `video: d.video` de disenosParaApi → 14 pasan / 1 falla (base: 15 / 0).
test('listar_disenos_landing dice qué diseño trae video, y la mayoría lo trae', () => {
  const { disenos } = disenosParaApi();
  assert.equal(disenos.length, DISENOS_LANDING.length);
  for (const d of disenos) assert.ok('video' in d && ['centro', 'costado', null].includes(d.video), JSON.stringify(d));
  assert.ok(disenos.filter((d) => d.video).length * 2 > disenos.length, 'la mayoría con video');
});

// ── 5. Tanda 6 (14/10/2026): el dominio propio, el botón de pago y lo que quedó fuera ──
// Los pendientes de la tanda 4 de la API («url_publica no usa el dominio propio verificado») y de la de
// pago («el botón de pago cobra el producto X» por la API).
// Roturas (14/10/2026, arnés que restaura de memoria y verifica el sha256; base 23 / 0 + 1 todo), una por vez:
//   · urlPublicaParaApi devuelve siempre la de MaKo                                   -> 22 / 1 (dominio)
//   · elegirBotonDePago, sin `texto`, toma el primer «Pagar ahora» aunque haya dos      -> 22 / 1 (botón)
//   · conProductoEnBoton cambia TODOS los botones                                      -> 22 / 1 (botón)
//   · cobrar_producto_landing por chat y no en pantalla                                -> 22 / 1 (forma)
// Lo que la tanda 4 dejó «fuera por ahora», misma base, una por vez:
//   · duplicar_landing sin el freno de las automatizaciones                            -> 22 / 1 (las seis)
//   · pausar_landing llama a sitioActivo con el valor al revés                          -> 22 / 1 (las seis)
//   · pedidoDePresentacion sin el formato de la plantilla (nacería como página)         -> 22 / 1 (presentación)

test('url_publica es la del dominio propio VERIFICADO si lo tiene (la que la persona pega en sus anuncios)', () => {
  const r = listaParaApi([
    resumen({ id: 1, slug: 'webinar', publicadoAt: '2026-10-03T00:00:00Z', dominio: 'pagina-de-ejemplo.com' }),
    resumen({ id: 2, slug: 'otra', publicadoAt: '2026-10-03T00:00:00Z', dominio: null }),
  ], 50);
  assert.deepEqual(
    r.landings.map((l) => [l.url_publica, (l as { url_mako?: string }).url_mako ?? null]),
    [['https://pagina-de-ejemplo.com', urlDeLanding('webinar')], [urlDeLanding('otra'), null]],
  );
  assert.equal(urlPublicaParaApi('x', null), urlDeLanding('x'));
  const ver = runnerDe('ver_landing_creada');
  assert.match(ver, /url_publica: publicada \? urlPublicaParaApi\(d\.slug as string, dominio\) : null/);
  assert.match(ver, /fd\?\.dominio_estado === 'verificado'/, 'sólo el dominio verificado');
});

const botonJson = (texto: string, href = ''): JsonNodo => ({ type: NODO_DOC.boton, attrs: { href, variante: 'primario', nuevaPestana: false }, content: [{ type: 'text', text: texto }] });
const conBotones = (...paginas: JsonNodo[][]): LandingContenido => ({
  v: 1,
  paginas: paginas.map((bs, k) => ({
    id: `p${k}`, titulo: k ? `Página ${k}` : 'Inicio', ruta: k ? `p${k}` : '',
    doc: { type: 'doc', content: [{ type: NODO_DOC.tarjeta, attrs: { id: `t${k}` }, content: [{ type: NODO_DOC.botones, attrs: {}, content: bs }] }] },
  })) as LandingContenido['paginas'],
});

test('el botón de pago: el que ya cobra o el único «Pagar ahora»; con dos o ninguno, pregunta; nada más cambia', () => {
  const c = conBotones([botonJson('Agenda tu llamada', '#t-formulario'), botonJson(TEXTO_BOTON_PAGO)], [botonJson('Volver')]);
  const bs = botonesDeLanding(c);
  assert.deepEqual(bs.map((b) => [b.n, b.texto, b.producto]), [[0, 'Agenda tu llamada', null], [1, 'Pagar ahora', null], [2, 'Volver', null]]);
  const elegido = elegirBotonDePago(bs, null);
  assert.ok('boton' in elegido && elegido.boton.n === 1, 'sin texto: el «Pagar ahora»');
  // Lo nuevo cobra el producto 7, y el resto del documento queda IGUAL (ni el otro botón ni la otra página).
  const nuevo = conProductoEnBoton(c, 1, 7);
  assert.deepEqual(botonesDeLanding(nuevo).map((b) => [b.texto, b.href]), [['Agenda tu llamada', '#t-formulario'], ['Pagar ahora', 'pago:7'], ['Volver', '']]);
  assert.equal(botonesDeLanding(c)[1].href, '', 'no muta la entrada');
  // Uno que ya cobra gana sin texto; con dos «Pagar ahora» y ninguno que cobre, no adivina.
  const yaCobra = conBotones([botonJson('Comprar', 'pago:3'), botonJson(TEXTO_BOTON_PAGO)]);
  const e2 = elegirBotonDePago(botonesDeLanding(yaCobra), null);
  assert.ok('boton' in e2 && e2.boton.texto === 'Comprar' && e2.boton.producto === 3);
  const dos = elegirBotonDePago(botonesDeLanding(conBotones([botonJson(TEXTO_BOTON_PAGO)], [botonJson(TEXTO_BOTON_PAGO)])), null);
  assert.ok('error' in dos && /pásalo en «boton»/.test(dos.error), 'con dos, pregunta');
  const porTexto = elegirBotonDePago(bs, 'volver');
  assert.ok('boton' in porTexto && porTexto.boton.n === 2, 'con texto: sin importar mayúsculas');
  const noEsta = elegirBotonDePago(bs, 'Inscríbete');
  assert.ok('error' in noEsta && noEsta.botones?.includes('Agenda tu llamada'), 'nombra los botones que hay');
  assert.match(resumenCobrar({ titulo: 'Mi landing', boton: bs[1], producto: { id: 7, nombre: 'Mentoría', tipo: 'unico', montoUsd: 97 }, publicada: true, motivo: 'sin-pasarela' }),
    /^El botón «Pagar ahora» de «Mi landing» va a cobrar «Mentoría» \(.*97.*\) por la pasarela de MaKo.*se vuelve a publicar.*Conecta Stripe/);
});

test('cobrar_producto_landing va en PANTALLA (es plata), sólo para el admin, por el server de la pantalla', () => {
  const d = accion('cobrar_producto_landing');
  assert.equal(d.confirmacion, 'pantalla');
  assert.equal(d.pantalla, '/mako/revisar');
  assert.deepEqual(d.gating, { tab: 'landing-writer', rolMinimo: 'admin' });
  assert.deepEqual(d.parametros.map((p) => p.nombre), ['id', 'producto', 'boton']);
  assert.ok(rutaRestDe('cobrar_producto_landing'), 'sale por HTTP con su ruta');
  const b = runnerDe('cobrar_producto_landing');
  assert.ok(!/\.from\(|getTenantDb|getSupabaseServer/.test(b), 'ninguna segunda implementación');
  assert.match(b, /docsEditor\.guardar\(\{ accion: 'guardar', id: plan\.id, version: plan\.f\.version, contenido: plan\.contenido \}\)/, 'compare-and-set con la versión leída');
  const run = sinComentarios(leer('lib/api-mako/areas/landing.run.ts'));
  const plan = run.slice(run.indexOf('async function planCobro'), run.indexOf('function noSeAplica'));
  assert.match(plan, /const c = await docsEditor\.cobro\(\);/, 'el catálogo ACTIVO, el mismo de «Cobrar con MaKo»');
  assert.match(plan, /c\.cobro\.productos\.find\(\(x\) => x\.id === productoId\)/);
});

const SEIS = ['ver_analitica_landing', 'renombrar_landing', 'duplicar_landing', 'pausar_landing', 'mandar_landing_a_papelera', 'crear_presentacion_desde_plantilla'];

test('lo que quedó «fuera por ahora»: chat y reversibles, la puerta de la página y el server de la pantalla', () => {
  for (const id of SEIS) {
    const d = porId(id);
    assert.ok(d, `falta ${id}`);
    assert.deepEqual(d.gating, { tab: 'landing-writer', rolMinimo: 'admin' }, id);
    assert.deepEqual([...d.canales].sort(), ['app', 'http', 'whatsapp'], id);
    assert.ok(rutaRestDe(id), `${id} sin ruta REST`);
    if (id !== 'ver_analitica_landing') {
      const a = accion(id);
      assert.equal(a.confirmacion, 'chat', id);
      assert.equal(a.reversible, true, id);
    }
    assert.ok(!/\.from\(|getTenantDb|getSupabaseServer/.test(runnerDe(id)), `${id}: segunda implementación`);
  }
  assert.match(runnerDe('ver_analitica_landing'), /docsEditor\.analitica\(id\)/);
  assert.match(runnerDe('renombrar_landing'), /docsEditor\.renombrar\(id, payload\.titulo\)/);
  assert.match(runnerDe('duplicar_landing'), /docsEditor\.duplicar\(id\)/);
  assert.match(runnerDe('pausar_landing'), /sitioActivoEnEditor\(id, !pausar\)/);
  assert.match(runnerDe('mandar_landing_a_papelera'), /papelera \? await docsEditor\.mandarAPapelera\(id\) : await docsEditor\.restaurarDePapelera\(id\)/);
  assert.match(runnerDe('crear_presentacion_desde_plantilla'), /docsEditor\.crear\(pedido\)/);
  // Lo que crea una fila nueva no corre en una automatización (una por lead).
  for (const id of ['duplicar_landing', 'crear_presentacion_desde_plantilla']) assert.match(runnerDe(id), /if \(enFlujo\(ctx\)\) return \{ error:/, id);
});

test('crear una presentación es EXACTAMENTE el alta de «Plantillas» de la pantalla, con su formato', () => {
  const d = accion('crear_presentacion_desde_plantilla');
  assert.deepEqual([...d.parametros.find((p) => p.nombre === 'plantilla')!.enum!], PLANTILLAS_PRESENTACION.map((p) => p.id));
  for (const p of PLANTILLAS_PRESENTACION) {
    const pedido = pedidoDePresentacion(p.id, null)!;
    const pantalla = pedidoDePlantilla(p);
    assert.deepEqual({ ...pedido, contenido: null }, { ...pantalla, contenido: null }, p.id);
    assert.equal(pedido.config?.formato, 'presentacion', `${p.id}: nacería como página`);
  }
  assert.equal(pedidoDePresentacion(PLANTILLAS_PRESENTACION[0].id, 'Mi charla')!.titulo, 'Mi charla');
  assert.equal(pedidoDePresentacion('no-existe', null), null);
  assert.deepEqual(disenosParaApi().presentaciones.map((p) => p.id), PLANTILLAS_PRESENTACION.map((p) => p.id));
});

test('la analítica: los números de la tarjeta del editor, y sin publicar los ceros se dicen ciertos', () => {
  const a = analiticaParaApi(4, { publicada: true, urls: ['hola-mako.site/x'], visitas30: 12, visitantes30: 9, leads30: 2, porDia: [{ dia: '2026-10-13', visitas: 5 }], alcancePorSeccion: null, enAnalyst: false });
  assert.deepEqual([a.id, a.visitas, a.visitantes, a.leads, a.dias], [4, 12, 9, 2, 30]);
  assert.deepEqual(a.por_dia, [{ dia: '2026-10-13', visitas: 5 }]);
  const sin = analiticaParaApi(5, { publicada: false, urls: [], visitas30: 0, visitantes30: 0, leads30: 0, porDia: [], alcancePorSeccion: null, enAnalyst: false });
  assert.match(sin.nota, /No está publicada/);
});

// ── VERIFICACIÓN DE LA TANDA 6 (14/10/2026): PROBADO ROMPIÉNDOLO ──────────────────────────────
// Base: 25 / 0 (y el `todo` de WhatsApp que ya estaba).
//   M1 diagnosticoParaApi sin el puntaje                         → 24 / 1 «lo que el motor de la tanda 6…»
//   M5 ver_landing_creada sin pasarle el puntaje                 → 24 / 1 «lo que el motor de la tanda 6…»
//   M2 resumenDespublicar sin el dominio propio                  → 24 / 1 «despublicar dice el dominio…»
//   M3 ver_rechazos_pago_landing sin mirar que la landing exista → 24 / 1 «lo que el motor de la tanda 6…»
//   M4 restaurar_version_landing con un comentario de otra landing → 24 / 1 «lo que el motor de la tanda 6…»
// Las dos roturas del motor de despublicar (B1, B2) NO las ve este archivo: las ve editor-landing-despublicar.
// Restaurado: 25 / 0.
