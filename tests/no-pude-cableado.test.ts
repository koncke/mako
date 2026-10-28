// =============================================================================
// Si MaKo le dice a la persona que algo no se pudo, queda un ticket (27/10/2026) — dónde está enganchado
// =============================================================================
// Sobre el código fuente: cada enganche existe y va donde tiene que ir. Lo puro: tests/no-pude.test.ts; lo que escribe en la
// base: tests/no-pude-server.test.ts.
//   1. la acción CONFIRMADA que falla al ejecutarse (lib/api-mako/acciones.ts): en `confirmarPendiente` y en
//      `aplicarPropuestaGenerica`, DESPUÉS de ejecutar, sólo en la app y WhatsApp y nunca en un flujo; la línea va en el resumen
//      (la tarjeta, también por detrás, y `confirmar_accion` de WhatsApp la leen de ahí);
//   2. el turno de la app (lib/mako-turno-app.ts): las dos marcas con `conTicketsDeMaKo`, el ruteo (`porId` + `visible`), el
//      registro sin `!ticketPropuesto`, el proveedor y la configuración con su ticket y su cierre solo, y el modelo sabe que sus
//      herramientas son una selección;
//   3. los chats que ya procesaban lo que no existe pasan por el ticket automático (lib/no-existe-server.ts).
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función, hasta la próxima de primer nivel. */
const cuerpo = (src: string, nombre: string): string => {
  const i = src.indexOf(`async function ${nombre}(`);
  assert.ok(i >= 0, `no está ${nombre}`);
  const fin = src.slice(i + 10).search(/\n(?:export )?(?:async )?function /);
  return fin < 0 ? src.slice(i) : src.slice(i, i + 10 + fin);
};

test('1. la acción confirmada que falla al ejecutarse abre su ticket: después de ejecutar, en la app y WhatsApp, nunca en un flujo', () => {
  const src = fuente('lib/api-mako/acciones.ts');
  const ayuda = cuerpo(src, 'ticketSiFallo');
  assert.match(ayuda, /if \(\(ctx\.canal !== 'app' && ctx\.canal !== 'whatsapp'\) \|\| ctx\.canalKey\.startsWith\(PREFIJO_FLUJO\) \|\| esReglaUOpinion\(error\)\) return null;/);
  assert.match(ayuda, /ticketDeNoPude\('ejecucion', \{/);
  const confirmar = cuerpo(src, 'confirmarPendiente');
  const ejecuta = confirmar.indexOf('.ejecutar(p.payload, ctx)');
  const engancha = confirmar.indexOf('await ticketSiFallo(ctx, def?.titulo ?? p.tipo, p.tipo, r.resumen)');
  assert.ok(ejecuta > 0 && engancha > ejecuta, 'confirmarPendiente no abre el ticket después de ejecutar');
  assert.match(confirmar, /const resumen = ticket \? `\$\{r\.resumen\} \$\{lineaDelTicket\(ticket\)\}` : r\.resumen;/);
  const aplicar = cuerpo(src, 'aplicarPropuestaGenerica');
  assert.ok(aplicar.indexOf('await ticketSiFallo(ctx, def.titulo, def.id, r.resumen)') > aplicar.indexOf('run.ejecutar(prep.payload, ctx)'), 'aplicarPropuestaGenerica no abre el ticket después de ejecutar');
  // Las guardas de antes de ejecutar son reglas: ninguna llama al ticket.
  assert.equal((confirmar.slice(0, ejecuta).match(/ticketSiFallo/g) ?? []).length, 0);
});

test('2. el turno de la app: las dos marcas, el ruteo, sin !ticketPropuesto, el proveedor y la configuración, y la selección', () => {
  const t = fuente('lib/mako-turno-app.ts');
  assert.doesNotMatch(t, /ticketPropuesto/, 'volvió `!ticketPropuesto`: la falla depende otra vez del botón');
  assert.doesNotMatch(t, /conPedidoDeNoExiste\(/, 'el turno procesa sólo lo que no existe');
  assert.match(t, /const np = await conTicketsDeMaKo\(respuesta, \{ ruteo: noViajo\.length > 0 \}, dondeDelTurno,/);
  assert.match(t, /if \(def && name !== 'confirmar_accion' && visible\(def, vista\) && !noViajo\.includes\(def\.titulo\)\) noViajo\.push\(def\.titulo\);/);
  assert.match(t, /if \(r\.ok && r\.ticketId\) paraLaPersona\.push\(r\.nuevo \? lineaDelTicket\(r\.ticketId\) : LINEA_YA_AVISADO\);/);
  assert.match(t, /const causaSin = sinIA \|\| deSuCuenta \? 'configuracion' : delProveedor \? 'proveedor' : null;/);
  assert.match(t, /if \(respuesta && !fallo\) await Promise\.all\(\[cerrarSiVolvio\(ws, 'proveedor'\), cerrarSiVolvio\(ws, 'configuracion'\)\]\);/);
  assert.doesNotMatch(t, /y NINGUNA otra/, 'el modelo cree que tiene todas las herramientas de MaKo');
  assert.match(t, /son una selección para este pedido/);
});

test('3. los chats que procesaban lo que no existe pasan por el ticket automático, con su superficie y el título del código', () => {
  const s = fuente('lib/no-existe-server.ts');
  assert.match(s, /const r = await conTicketsDeMaKo\(respuesta, \{\}, donde\(d\)\);/);
  assert.match(s, /const t = await ticketDeNoPude\('no-existe', donde\(d\), \{ queNoPudo: falta \}\);/);
  const np = fuente('lib/no-pude-server.ts');
  assert.match(np, /titulo: tituloDelNoPude\(causa, d\.superficie, det\.operacion\),/, 'el título no lo arma el código');
  assert.match(np, /automatico: \{ clave: prefijoAutomatico\(d\.ws\)\.slice\(0, -1\) \},/);
  assert.doesNotMatch(np, /registrarError/, 'un ticket que no se pudo levantar no puede abrir otro (bucle)');
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado (sha1 igual):
//   1. `confirmarPendiente` sin el enganche                              → rojo el 1.
//   2. `ticketSiFallo` también en un flujo (sin `PREFIJO_FLUJO`)          → rojo el 1.
