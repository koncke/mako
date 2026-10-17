// =============================================================================
// La comunidad por la API de MaKo: QUIÉN FIRMA lo que se publica, y que el área esté enchufada (17/10/2026)
// =============================================================================
// El área `comunidad` (41 operaciones: posts, comentarios, categorías, miembros, eventos) quedó a medias en
// `wip/api-acciones-1410` por un bloqueante: 11 escrituras «firmadas» (publicar, comentar, likes, votar, seguir, perfil…) no
// tenían persona con un token detallado y fallaban al proponer. Decisión de Martín (17/10/2026): firma **la persona que
// confirma en la bandeja, o la que creó el token; sin persona no se publica** y las escrituras firmadas sin persona fallan con
// un error claro. Este test fija esa decisión de punta a punta:
//   1. el CTX de un token detallado trae `persona` = quien lo creó (sólo si es un email), y el clásico no trae ninguna;
//   2. el runner REAL, contra una base de mentira con dos negocios (tests/_api-comunidad-hijo.ts): sin persona, con una
//      cuenta de OTRO negocio, suspendida o inexistente no se firma ni se escribe; con una persona del equipo sí; un
//      `actor` que parece un email pero no viene de la bandeja no firma; un producto de otro negocio no existe;
//   3. el área está enchufada en el registro, sale SÓLO por HTTP, sus datos cuentan como de clientes y nombrarla en un mensaje
//      no le suma herramientas al doer.
//
// PROBADO ROMPIÉNDOLO: los números por rotura están en docs/hallazgos-api-mako.md («La comunidad por la API»).
// Correr: MAKO_TESTS_SIN_ESPERA=1 node --test --import tsx tests/api-mako-comunidad-firma.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGISTRO, porArea } from '../lib/api-mako/registro';
import { AREAS, AREA_INFO, DATOS_DE_CLIENTES_POR_AREA } from '../lib/api-mako/tipos';
import { areasDelMensaje } from '../lib/mako-intencion';
import { personaDe } from '../lib/api-mako/areas/comunidad.helpers';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el CTX de un token detallado trae a quien lo creó; el clásico no trae a nadie; y sólo si es un email', () => {
  const http = sinComentarios(leer('lib/api-mako/http.ts'));
  assert.match(http, /\.\.\.\(r\.creadoPor\.includes\('@'\) \? \{ persona: r\.creadoPor \} : \{\}\)/, 'el ctx del detallado no trae a su creador');
  assert.equal((http.match(/\{ persona: r\.creadoPor \}/g) ?? []).length, 1, 'la persona se arma en UN lugar (el ctx del detallado)');
  assert.ok(http.indexOf('persona: r.creadoPor') < http.indexOf('alcance: alcanceDeToken(auth.token)'), 'el clásico no puede traer persona: va antes de su rama');
  const tokens = sinComentarios(leer('lib/api-mako/tokens.ts'));
  assert.match(tokens, /vencido: venc, sinCreador, creadoPor: r\.g\.creadoPor/, 'el resolvedor del token no devuelve su creador');
  assert.match(sinComentarios(leer('lib/api-mako/tipos.ts')), /persona\?: string;/);
  // La persona es la del token, y el actor del canal NO firma (por HTTP es «API · token «x»»).
  assert.equal(personaDe({ persona: ' Ana@A.com ', actor: 'API · token «ci»' }), 'ana@a.com');
  assert.equal(personaDe({ actor: 'API · token «ci»' }), null);
  assert.equal(personaDe({ actor: 'ana@a.com' }), null, 'un actor con forma de email, fuera de la bandeja, no firma');
  assert.equal(personaDe({ bandeja: true, actor: 'ana@a.com' }), 'ana@a.com', 'la persona que confirma en la bandeja sí');
});

type R = { error?: string; payload?: Record<string, unknown>; resumen?: string; ok?: boolean };
type Hijo = {
  tokenSinPersona: R; personaDeOtroNegocio: R; personaSuspendida: R; personaInexistente: R; personaDelEquipo: R; adminDePlataforma: R;
  actorSinBandeja: R; productoAjeno: R; clasicoPropone: R; ejecutarSinPersona: R; ejecutarConTokenSinPersona: R; postsEscritos: number; ia: string[];
  faltaSinPersona: string | null; faltaConBandeja: string | null; faltaConPersonaDeOtroNegocio: string | null;
};
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_api-comunidad-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 280_000,
});
const H = JSON.parse(salida.slice(salida.indexOf('@@JSON@@') + 8, salida.indexOf('@@FIN@@'))) as Hijo;

test('⚠️ sin persona, o con una cuenta que no es del equipo de ESTE negocio, no se firma y no se escribe', () => {
  assert.match(String(H.tokenSinPersona.error), /no trae a ninguna/, 'un token sin creador firmó');
  for (const k of ['personaDeOtroNegocio', 'personaSuspendida', 'personaInexistente'] as const) {
    assert.match(String(H[k].error), /no firma en la comunidad de este negocio/, k);
  }
  assert.match(String(H.actorSinBandeja.error), /no trae a ninguna/, 'el actor del canal firmó');
  assert.match(String(H.productoAjeno.error), /no es de este negocio/);
  assert.equal(H.postsEscritos, 0, 'se escribió un post sin quien firme');
  assert.deepEqual(H.ia, []);
});

test('con una persona del equipo (o un admin de la plataforma) se firma con su nombre; el clásico propone y firma quien confirma', () => {
  assert.match(String(H.personaDelEquipo.resumen), /firmado por Ana/);
  assert.match(String(H.adminDePlataforma.resumen), /firmado por Root/);
  assert.match(String(H.clasicoPropone.resumen), /firmado por la persona que lo confirme/);
  // Y si nadie confirmó en la bandeja, escribir no es posible: la firma se vuelve a pedir AL ESCRIBIR.
  assert.equal(H.ejecutarSinPersona.ok, false);
  assert.equal(H.ejecutarConTokenSinPersona.ok, false);
  assert.match(String(H.ejecutarSinPersona.resumen), /no trae a ninguna/);
});

test('⚠️ un «sí» que no se puede cumplir no quema la pendiente: la firma se pregunta ANTES de reclamar', () => {
  assert.match(String(H.faltaSinPersona), /no trae a ninguna/, 'un pedido sin persona pasó el control previo');
  assert.equal(H.faltaConBandeja, null, 'quien confirma en la bandeja firma');
  assert.match(String(H.faltaConPersonaDeOtroNegocio), /no firma en la comunidad de este negocio/);
  // El cableado: el control corre antes de reclamar la pendiente y antes de marcar aplicada la propuesta.
  const acc = sinComentarios(leer('lib/api-mako/acciones.ts'));
  const confirmar = acc.slice(acc.indexOf('export async function confirmarPendiente'));
  assert.ok(confirmar.indexOf('faltaParaConfirmar') > 0 && confirmar.indexOf('faltaParaConfirmar') < confirmar.indexOf('reclamarPendiente(ctx.ws, p.id)'), 'el control va DESPUÉS de reclamar: la pendiente queda quemada');
  const generica = acc.slice(acc.indexOf('export async function aplicarPropuestaGenerica'));
  assert.ok(generica.indexOf('faltaParaConfirmar') > 0 && generica.indexOf('faltaParaConfirmar') < generica.indexOf('marcarAplicada('), 'la pantalla genérica marca aplicada antes de preguntar');
  // Las once que firman lo declaran.
  const run = sinComentarios(leer('lib/api-mako/areas/comunidad.run.ts'));
  const firman = ['publicar_post', 'editar_post', 'seguir_post', 'votar_encuesta', 'cambiar_like_post', 'comentar_post', 'editar_comentario', 'cambiar_like_comentario', 'comentar_clase', 'marcar_avisos_leidos', 'editar_perfil'];
  for (const op of firman) assert.match(run, new RegExp(`\\n  ${op}_comunidad: \\{\\n    faltaParaConfirmar: faltaFirma,`), `${op}: firma y no pregunta antes de reclamar`);
  assert.equal((run.match(/faltaParaConfirmar: faltaFirma,/g) ?? []).length, firman.length, 'una que NO firma declara el control');
});

test('⚠️ lo que se firma con texto largo se confirma en una pantalla que lo muestra ENTERO, y el id de lo irreversible no se edita al revisar', () => {
  // La bandeja muestra el resumen a 120 letras y cada valor a 240; un comentario admite 4.000. De chat, un link de phishing
  // pasadas las 240 letras se confirmaba sin verse.
  for (const id of ['publicar_post_comunidad', 'editar_post_comunidad', 'comentar_post_comunidad', 'editar_comentario_comunidad', 'comentar_clase_comunidad', 'editar_perfil_comunidad']) {
    const d = porId(id);
    assert.ok(d && esAccion(d), id);
    assert.equal(d.confirmacion, 'pantalla', `${id}: firma un texto con el nombre de una persona y se confirma sobre un resumen recortado`);
  }
  const fijos: Record<string, string[]> = {
    borrar_post_comunidad: ['postId'], borrar_comentario_comunidad: ['comentarioId'], borrar_categoria_comunidad: ['categoriaId'],
    sacar_alumno_comunidad: ['leadId'], editar_evento_comunidad: ['eventoId'], borrar_evento_comunidad: ['eventoId'],
    editar_post_comunidad: ['postId'], comentar_post_comunidad: ['postId'], editar_comentario_comunidad: ['comentarioId'],
    comentar_clase_comunidad: ['claseId'], editar_perfil_comunidad: ['productoId'],
  };
  for (const [id, campos] of Object.entries(fijos)) {
    const d = porId(id);
    assert.ok(d, id);
    for (const c of campos) assert.equal(d.parametros.find((p) => p.nombre === c)?.fijoAlRevisar, true, `${id}: «${c}» se puede cambiar al revisar`);
  }
});

test('leer la campana por la API no escribe en ella (un token «Solo lectura» no anota filas)', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/comunidad.run.ts'));
  assert.match(run, /campanaComunidad\(firmado\(ctx, p\.id, q\.firma\), \{ sinEscribir: true \}\)/);
  const campana = sinComentarios(leer('lib/comunidad-campana.ts'));
  assert.match(campana, /if \(!opts\.sinEscribir\) await avisarEventosProximos\(a\);/);
});

test('el área está enchufada: en el registro, SÓLO por HTTP, con sus datos como de clientes y sin sumarle herramientas al doer', () => {
  assert.ok((AREAS as readonly string[]).includes('comunidad'));
  assert.deepEqual(AREA_INFO.comunidad, { titulo: 'Comunidad', tab: 'Clients › Community', ruta: '/clients/community' });
  assert.equal(DATOS_DE_CLIENTES_POR_AREA.comunidad, true, 'posts, comentarios y miembros son de los alumnos del negocio');
  const ops = porArea('comunidad');
  assert.equal(ops.length, 41);
  for (const d of ops) assert.deepEqual([...d.canales], ['http'], `${d.id}: la comunidad sale sólo por HTTP`);
  assert.equal(REGISTRO.filter((d) => d.area === 'comunidad').length, 41);
  // Nombrarla no trae ninguna herramienta, y «automatizaciones de la comunidad» sigue siendo de `creaciones`.
  assert.ok(!areasDelMensaje('publicá en las automatizaciones de la comunidad').includes('comunidad'));
  assert.ok(areasDelMensaje('mostrame el ranking de la comunidad').includes('comunidad'));
  const run = sinComentarios(leer('lib/api-mako/runners.ts'));
  assert.match(run, /RUNNERS as comunidad } from '\.\/areas\/comunidad\.run'/);
});
