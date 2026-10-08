// =============================================================================
// comunidad-notificaciones — la campana: nunca a uno mismo, una por persona, seguir un post, los likes
// agrupados, y que la capa de datos pase por acá
// =============================================================================
// Dos capas, como el resto de la comunidad:
//   · la regla (lib/comunidad-notificaciones.ts), que se EJECUTA acá;
//   · que quien escribe (lib/comunidad-datos.ts, lib/comunidad-calendario.ts) y quien lee
//     (lib/comunidad-campana.ts) la usen: eso no se ejecuta sin base, así que se lee el fuente SIN
//     comentarios y por FUNCIÓN.
//
// Verificado ROMPIÉNDOLO: ver el bloque «ROTURAS» al final (números medidos).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  destinatarios, avisosDeComentario, agruparNotificaciones, sinLeerDe, claveDeAvisoDeEvento,
  type FilaNotificacion,
} from '../lib/comunidad-notificaciones';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...p: string[]) => sinComentarios(readFileSync(join(RAIZ, ...p), 'utf8'));
const DATOS = leer('lib', 'comunidad-datos.ts');
const CALENDARIO = leer('lib', 'comunidad-calendario.ts');
const CAMPANA = leer('lib', 'comunidad-campana.ts');

function cuerpo(src: string, nombre: string): string {
  const ini = src.search(new RegExp(`\\n(export )?(async )?function ${nombre}\\b`));
  assert.ok(ini >= 0, `no encontré la función ${nombre}`);
  const resto = src.slice(ini + 1);
  const fin = resto.search(/\n(export )?(async )?function \w+|\nconst [A-Za-z_]+ = |\n\/\/ ──/);
  const c = fin > 0 ? resto.slice(0, fin) : resto;
  assert.ok(c.length < 9000, `el recorte de ${nombre} mide ${c.length}: está mirando otra cosa`);
  return c;
}
const antesQue = (c: string, antes: string | RegExp, despues: string | RegExp) => {
  const i = typeof antes === 'string' ? c.indexOf(antes) : c.search(antes);
  const j = typeof despues === 'string' ? c.indexOf(despues) : c.search(despues);
  return i >= 0 && j >= 0 && i < j;
};

// ── A quién ──────────────────────────────────────────────────────────────────────

test('nunca a uno mismo, nunca a una clave rota, y UNA por persona (la de más prioridad)', () => {
  const r = destinatarios('l:7', [
    { para: 'l:7', tipo: 'comentario', postId: 1 },
    { para: 'email@x.com', tipo: 'mencion', postId: 1 },
    { para: 'u:3', tipo: 'comentario', postId: 1 },
    { para: 'u:3', tipo: 'mencion', postId: 1 },
    { para: 'l:8', tipo: 'post_seguido', postId: 1 },
  ]);
  assert.deepEqual(r.map((x) => [x.para, x.tipo]), [['u:3', 'mencion'], ['l:8', 'post_seguido']]);
});

test('un comentario: respuesta > mención > comentario (si el autor sigue su post) > post seguido; quien comenta no se avisa', () => {
  const avisos = avisosDeComentario({
    autorPost: 'u:1', seguidores: ['u:1', 'l:5', 'l:7', 'l:9'], contestados: ['l:9'], menciones: ['l:5'], postId: 10, comentarioId: 20,
  });
  const r = destinatarios('l:7', avisos);
  assert.deepEqual(r.map((x) => [x.para, x.tipo]), [['l:9', 'respuesta'], ['l:5', 'mencion'], ['u:1', 'comentario']]);
  assert.ok(r.every((x) => x.postId === 10 && x.comentarioId === 20));
});

test('el autor que DEJÓ de seguir su post no recibe «comentario»; los que lo siguen, sí', () => {
  const r = destinatarios('l:7', avisosDeComentario({ autorPost: 'u:1', seguidores: ['l:5'], contestados: [], menciones: [], postId: 10, comentarioId: 20 }));
  assert.deepEqual(r.map((x) => [x.para, x.tipo]), [['l:5', 'post_seguido']]);
});

test('comentar lo propio no avisa a nadie si nadie más sigue el post', () => {
  const r = destinatarios('u:1', avisosDeComentario({ autorPost: 'u:1', seguidores: ['u:1'], contestados: ['u:1'], menciones: [], postId: 10, comentarioId: 20 }));
  assert.deepEqual(r, []);
});

// ── Cómo se lee ──────────────────────────────────────────────────────────────────

const fila = (o: Partial<FilaNotificacion> & { id: number }): FilaNotificacion => ({
  tipo: 'like', de_miembro: null, post_id: null, comentario_id: null, evento_id: null, ocurrencia: null, leida_at: null,
  created_at: '2026-10-08T10:00:00Z', ...o,
});

test('los likes sobre la MISMA cosa van en un renglón; un like a un comentario es otra cosa; el resto, uno por fila', () => {
  const g = agruparNotificaciones([
    fila({ id: 1, de_miembro: 'l:1', post_id: 5, created_at: '2026-10-08T10:00:00Z', leida_at: '2026-10-08T11:00:00Z' }),
    fila({ id: 2, de_miembro: 'l:2', post_id: 5, created_at: '2026-10-08T12:00:00Z' }),
    fila({ id: 3, de_miembro: 'l:1', post_id: 5, created_at: '2026-10-08T12:30:00Z' }),
    fila({ id: 4, de_miembro: 'l:3', post_id: 5, comentario_id: 9, created_at: '2026-10-08T09:00:00Z' }),
    fila({ id: 5, tipo: 'comentario', de_miembro: 'l:4', post_id: 5, created_at: '2026-10-08T13:00:00Z' }),
    fila({ id: 6, tipo: 'comentario', de_miembro: 'l:4', post_id: 5, created_at: '2026-10-08T13:01:00Z', leida_at: '2026-10-08T14:00:00Z' }),
  ]);
  assert.equal(g.length, 4);
  assert.deepEqual(g.map((x) => x.ids), [[6], [5], [3, 2, 1], [4]], 'del más nuevo al más viejo');
  const likes = g[2];
  assert.deepEqual(likes.de, ['l:1', 'l:2'], 'quiénes, sin repetir, el más reciente primero');
  assert.equal(likes.leida, false, 'un like nuevo sobre un renglón leído lo vuelve a encender');
  assert.equal(likes.creado, '2026-10-08T12:30:00Z');
  assert.equal(sinLeerDe(g), 3);
});

test('un renglón está leído sólo si lo están TODAS sus filas (aunque la más nueva esté leída)', () => {
  const [g] = agruparNotificaciones([
    fila({ id: 7, de_miembro: 'l:1', post_id: 6, created_at: '2026-10-08T12:00:00Z', leida_at: '2026-10-08T12:05:00Z' }),
    fila({ id: 8, de_miembro: 'l:2', post_id: 6, created_at: '2026-10-08T11:00:00Z' }),
  ]);
  assert.deepEqual(g.ids, [7, 8]);
  assert.equal(g.leida, false);
});

test('el aviso de un evento se deduplica por persona, evento y FECHA de la ocurrencia', () => {
  assert.equal(claveDeAvisoDeEvento(12, '2026-10-15'), 'e:12:2026-10-15');
});

// ── La capa de datos pasa por acá ────────────────────────────────────────────────

test('`notificar` decide los destinatarios con la regla (no a mano)', () => {
  const c = cuerpo(DATOS, 'notificar');
  assert.ok(antesQue(c, 'destinatarios(a.clave, avisos)', '.insert('), 'notificar sin pasar por `destinatarios`');
  assert.doesNotMatch(c, /para\.clave === a\.clave|vistos/, 'quedó un filtro propio al lado de la regla');
});

test('comentar avisa con `avisosDeComentario` (seguidores incluidos); un like avisa sólo si es NUEVO', () => {
  const c = cuerpo(DATOS, 'comentar');
  assert.ok(antesQue(c, 'seguidoresDe(a, ', 'avisosDeComentario({'), 'comentar no lee quién sigue el post');
  assert.match(c, /await notificar\(a, avisosDeComentario\(\{/);
  assert.match(cuerpo(DATOS, 'cambiarLike'), /if \(\(data \?\? \[\]\)\.length\) await notificar\(/, 'un doble clic avisaría dos veces');
});

test('el autor sigue su post al publicarlo', () => {
  const c = cuerpo(DATOS, 'publicarPost');
  assert.ok(antesQue(c, "de(a.ws, 'comunidad_posts').insert(", "de(a.ws, 'comunidad_seguimientos').upsert("), 'publicar sin seguir lo propio');
});

test('el aviso de un evento: sólo a quien ENTRA, una fila por clave (upsert que ignora duplicados)', () => {
  const c = cuerpo(CALENDARIO, 'avisarEventosProximos');
  assert.ok(antesQue(c, 'accesoPermite(accesoGuardado(f.acceso), quien)', 'avisos.push('), 'avisaría de un evento cerrado para esa persona');
  assert.match(c, /onConflict: 'workspace_id,para_miembro,clave', ignoreDuplicates: true/);
});

test('la campana lee SÓLO lo de quien mira y marca leído sólo lo suyo', () => {
  assert.match(cuerpo(CAMPANA, 'campanaComunidad'), /\.eq\('producto_id', a\.productoId\)\.eq\('para_miembro', a\.clave\)/);
  assert.match(cuerpo(CAMPANA, 'marcarLeidas'), /\.eq\('producto_id', a\.productoId\)\.eq\('para_miembro', a\.clave\)/);
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido el 08/10/2026 (scratchpad/comunidad-2/romper.mjs, restaura de memoria), contra este archivo de
// 12 tests. Cada rotura, sola:
//   En la regla (lib/comunidad-notificaciones.ts): se avisa a uno mismo: 3 fallos, 9 pases · sin
//     prioridad (gana el primer aviso, no el más importante): 1 / 11 · el autor que dejó de seguir su
//     post recibe igual: 1 / 11 · los likes sin agrupar: 2 / 10 · un renglón queda leído con una fila
//     sin leer: 1 / 11.
//   En quien escribe y quien lee: `notificar` sin la regla: 1 / 11 · comentar sin leer quién sigue el
//     post: 1 / 11 · publicar sin que el autor siga lo suyo: 1 / 11 · el aviso de un evento CERRADO
//     para esa persona: 1 / 11 · la campana leyendo los avisos de todos: 1 / 11.
// (La primera versión del test del «leído» pasaba sobre su rotura: la fila más nueva del grupo era la
// sin leer, y así el grupo nacía encendido aunque nadie mirara las demás. Ahora hay un caso al revés.)
