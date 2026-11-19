// LA LÍNEA DE MaKo SE RECONECTA EN CHATS, Y RECONECTAR NO ABRE UNA INSTANCIA NUEVA SI LA SESIÓN SE SOLTÓ (19/11/2026).
//
// A las ~20:44 UTC se cambió la foto de perfil de la voz por Evolution. En Evolution 2.3.7, `updateProfilePicture` llama a
// `reloadConnection()`, que abre un socket nuevo SIN cerrar el viejo: el viejo siguió recibiendo (un mensaje guardado a las 20:51:19) y las
// consultas iban por el nuevo, que no contestaba (la sonda la dio por muerta a las 20:48). Martín tocó «volver a conectar» desde el aviso,
// que lo llevó a /agencia?canal=1 («esta página viejísima que ya no debería ni existir»). Ahí el logout contestó con error pero WhatsApp
// la cerró igual (401 a las 21:00:27), y el código rotó a una instancia NUEVA: quedaron dos vivas con el mismo número.
// docs/hallazgos-comunicacion.md.
//
// PROBADO ROMPIÉNDOLO (19/11/2026), cada rotura por separado y vuelta atrás:
//   L1 `seSoltoLaSesion` da «sí» sin la lectura de antes               → falla «se soltó sólo con las dos lecturas»
//   L2 `conectarCanalMaKo` rota sin mirar si la sesión se soltó        → falla «antes de rotar se mira»
//   L3 el aviso de la voz vuelve a /agencia?canal=1                     → falla «los avisos llevan a Chats»
//   L4 /agencia vuelve a dibujar la página vieja                        → falla «/agencia redirige»
//   L5 Chats sin abrir el panel con `?canal=mako`                       → falla «Chats abre el panel»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seSoltoLaSesion } from '../lib/linea-sorda';
import { RUTA_LINEA_MAKO } from '../lib/chats-links';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre: ${hasta}`);
  return src.slice(i, j);
}

test('se soltó sólo con las dos lecturas, y la de después posterior (la noche del 19/11)', () => {
  const antes = Date.parse('2026-11-12T12:13:07Z');
  const despues = Date.parse('2026-11-19T21:00:27Z');
  assert.equal(seSoltoLaSesion(antes, despues), true, 'el logout dio error y WhatsApp la cerró: se reusa la misma instancia');
  assert.equal(seSoltoLaSesion(antes, antes), false, 'nada cambió: está trabada de verdad, se rota');
  assert.equal(seSoltoLaSesion(null, despues), false, 'sin la lectura de antes no se sabe: se rota como siempre');
  assert.equal(seSoltoLaSesion(antes, null), false);
});

test('antes de rotar se mira si la sesión se soltó, y entonces se espera el QR de la MISMA instancia', () => {
  const src = fuenteSinComentarios('lib/mako-canal.ts');
  const c = bloque(src, 'export async function conectarCanalMaKo(', 'async function rotarCanal(');
  const antes = c.indexOf('const vinculadaAntes = await vinculadaDesdeDeLinea(inst)');
  const logout = c.indexOf('/instance/logout/');
  const mira = c.indexOf('if (seSoltoLaSesion(vinculadaAntes, vinculadaDespues))');
  const rota = c.indexOf('return rotarCanal(inst, crudo);');
  assert.ok(antes >= 0 && antes < logout, 'la vinculación se lee ANTES del logout');
  assert.ok(mira > logout && mira < rota, 'se mira si se soltó ANTES de rotar');
  assert.match(c.slice(mira, rota), /qrConEspera\(inst, 4\)/, 'se espera el QR de la misma instancia, no de una nueva');
});

test('los avisos llevan a Chats, no a la página vieja', () => {
  assert.equal(RUTA_LINEA_MAKO, '/chats?canal=mako');
  for (const f of ['lib/canal-vigilante.ts', 'lib/lineas-de-mako-vigilante.ts', 'app/_components/AlertaVozMaKo.tsx', 'lib/linea-sorda.ts']) {
    assert.doesNotMatch(fuenteSinComentarios(f), /agencia\?canal=1|hola-mako\.com\/agencia\b/, `${f} todavía manda a /agencia`);
  }
  assert.match(fuenteSinComentarios('lib/canal-vigilante.ts'), /link: RUTA_LINEA_MAKO/);
  assert.match(fuenteSinComentarios('app/_components/AlertaVozMaKo.tsx'), /href=\{RUTA_LINEA_MAKO\}/);
});

test('/agencia redirige a Chats, con `canal` al panel de la línea', () => {
  const p = fuenteSinComentarios('app/agencia/page.tsx');
  assert.doesNotMatch(p, /AgenciaTabs/, 'volvió la página vieja');
  assert.match(p, /redirect\(canal \? RUTA_LINEA_MAKO : RUTA_CHATS\);/);
});

test('Chats abre el panel con `?canal=mako`, sólo a quien ve la línea de MaKo, y limpia la URL', () => {
  const c = fuenteSinComentarios('app/chats/ChatsApp.tsx');
  const e = bloque(c, 'const canalLink = sp.get(PARAM_CANAL_MAKO);', '}, [canalLink');
  assert.match(e, /if \(canalLink !== VALOR_CANAL_MAKO \|\| !datos\) return;/, 'espera a que la lista cargue');
  assert.match(e, /if \(esAdmin && lineas\.some\(\(l\) => l\.linea === LINEA_CANAL_MAKO\)\) setCanalMaKo\(true\);/);
  assert.match(e, /router\.replace\(RUTA_CHATS/);
});
