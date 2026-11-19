// EL AVISO DE UN TICKET QUE QUEDÓ SÓLO EN LA APP NO ES «SALIÓ POR WHATSAPP» (19/11/2026, #118 de Leila, ws 11).
//
// El aviso de cierre del #118 salió a las 21:00:48 UTC, con la línea de MaKo en plena reconexión. WhatsApp no lo tomó, la copia quedó en el
// hilo de la app (fila 962 de grupo_mensajes, `wa_message_id` NULL) y `enviarAlGrupoMaKo` contestó `{ ok: true, enApp: true }`, tirando el
// error. `avisarUno` lo contó como salido: no lo reintentó y el historial dijo «Aviso al cliente: whatsapp, push». Ahora:
//   · `enviarAlGrupoMaKo` devuelve el motivo en `noEntregado` y lo deja en el log;
//   · el aviso se reintenta en la vuelta siguiente, como cuando no hay copia, y el reintento REUSA la copia (no suma otra burbuja);
//   · el historial dice «app» y no «whatsapp» cuando sólo quedó en la app.
//
// PROBADO ROMPIÉNDOLO (19/11/2026), cada rotura por separado y vuelta atrás:
//   T1 `destinoDelAvisoAlGrupo` vuelve a dar «salió» con `noEntregado`   → falla «sólo en la app se reintenta»
//   T2 un negocio SIN grupo de WhatsApp se reintenta para siempre        → falla «sólo en la app se reintenta»
//   T3 `enviarAlGrupoMaKo` vuelve a tirar el motivo                      → falla «el envío dice el motivo»
//   T4 el reintento copia otra vez en vez de reusar                       → falla «el envío dice el motivo»
//   T5 el historial vuelve a decir «whatsapp» con `enApp`                 → falla «el historial»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destinoDelAvisoAlGrupo, HORAS_REINTENTO_GRUPO } from '../lib/tickets-reglas';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre: ${hasta}`);
  return src.slice(i, j);
}

test('sólo en la app se reintenta; sin grupo de WhatsApp, la app ES su grupo', () => {
  const t0 = Date.parse('2026-11-19T21:00:00Z');
  const soloApp = { ok: true, enApp: true, noEntregado: 'Evolution 400 en mako_superadmin_muylqv8r: Connection Closed' };
  assert.equal(destinoDelAvisoAlGrupo(soloApp, t0, t0 + 60_000), 'reintentar', 'el #118: no salió por WhatsApp');
  assert.equal(destinoDelAvisoAlGrupo(soloApp, t0, t0 + (HORAS_REINTENTO_GRUPO + 1) * 3_600_000), 'perdido');
  assert.equal(destinoDelAvisoAlGrupo({ ...soloApp, sinGrupo: true }, t0, t0), 'salio', 'un negocio sin grupo de WhatsApp: la app es su grupo');
  assert.equal(destinoDelAvisoAlGrupo({ ok: true }, t0, t0), 'salio');
  assert.equal(destinoDelAvisoAlGrupo({ ok: true, enApp: true } as { ok: boolean }, t0, t0), 'salio', 'sin motivo no se inventa una falla');
  assert.equal(destinoDelAvisoAlGrupo({ ok: false, sinGrupo: true }, t0, t0), 'sin_grupo');
});

test('el envío dice el motivo, lo deja en el log, y el reintento de un aviso de ticket reusa la copia', () => {
  const src = fuenteSinComentarios('lib/mako-grupo.ts');
  const e = bloque(src, 'export async function enviarAlGrupoMaKo(', 'async function enviarPorWhatsApp(');
  assert.match(e, /const reusada = app && atadoASuTicket \? await app\.copiaSinWhatsApp\(ws, texto, REUSAR_COPIA_MS\)/);
  assert.match(e, /const copia = reusada \?\? \(app \? await app\.copiarAlGrupo\(/);
  assert.match(e, /console\.error\(`\[mako-grupo\] ws\$\{ws\}: quedó sólo en el hilo de la app, WhatsApp no lo tomó: \$\{r\.error\}`\);/);
  assert.match(e, /return \{ ok: true, id, enApp: true, noEntregado: r\.error \|\| 'no se pudo enviar', \.\.\.\(r\.sinGrupo/);
  const app = fuenteSinComentarios('lib/grupo-app.ts');
  const c = bloque(app, 'export async function copiaSinWhatsApp(', '\n}\n');
  assert.match(c, /\.eq\('autor_tipo', 'equipo'\)\.eq\('texto', texto\)/);
  assert.match(c, /\.is\('wa_message_id', null\)/, 'sólo una copia que NO llegó a WhatsApp');
});

test('el historial: «app» cuando quedó sólo en la app, «whatsapp» sólo si llegó', () => {
  const src = fuenteSinComentarios('lib/tickets-cierre.ts');
  const a = bloque(src, 'async function avisarUno(', 'if (f.usuario_id) {');
  assert.match(a, /if \(destino === 'salio'\) salio\.push\(r\.enApp \? 'app' : 'whatsapp'\);/);
  assert.match(a, /const motivo = r\.error \?\? r\.noEntregado;/, 'el motivo del reintento no se pierde');
});
