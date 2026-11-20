// =============================================================================
// LA TARJETA DEL CÓDIGO DEL ONBOARDING V2 CON LO QUE LE PASA AL WHATSAPP (20/11/2026)
// =============================================================================
// El servidor es del chat de WhatsApp (1a7f519ad, tests/whatsapp-v2-auditoria.test.ts); la tarjeta, de este. Dos de la auditoría:
//   · wa-04: le escribió a MaKo desde otro WhatsApp que el que dio. La vista pasa a 'otro-numero'; la tarjeta lo dice claro y ofrece
//     usar ése o cambiar el número. Sin el sondeo, la pantalla del V2 nunca se enteraba (sólo el V1 preguntaba).
//   · wa-f3: «Reenviar» fuera de las 24 h devuelve E_REESCRIBIR_V2. La tarjeta abre WhatsApp con el mensaje escrito (la maqueta:
//     «reenviar» → `abrirWhatsapp()`), en vez de un error que promete que MaKo escribe.
// Además de esto, probado en el navegador con el componente de verdad (fetch y window.open de mentira, a 1440 y 375): el sondeo trae
// el otro número, «Usar el …» pide `usar-otro-numero`, «Reenviar» abre el link y después ES el link, y frenada la ventana se marca
// «Abrir WhatsApp».
// Probado rompiéndolo (20/11/2026, una rotura por vez y restaurada): con el texto sin el número que dio cae el 1; con «Reenviar»
// abriendo WhatsApp por cualquier error, el 1; con el otro número tomado de lo que manda la pantalla, el 2; sin el freno, el 2; sin el
// sondeo, el 3; con «Cambiar número» dos veces, el 3; con `noopener` en window.open (devuelve null siempre: «frenada» aunque abra),
// el 4; sin pasar «Reenviar» a link, el 4.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AVISO_WHATSAPP_ABIERTO, avisoOtroNumero, reenviarAbreWhatsapp } from '../lib/onboarding-arranque';
import { E_REESCRIBIR_V2 } from '../lib/verificacion-entrante';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const bloque = (s: string, desde: string, hasta: string) => { const i = s.indexOf(desde); assert.ok(i >= 0, desde); return s.slice(i, s.indexOf(hasta, i)); };

test('1. lo que dice: desde cuál escribió y cuál dio; «Reenviar» abre WhatsApp SÓLO con E_REESCRIBIR_V2', () => {
  assert.deepEqual(avisoOtroNumero('5491166667777', '5491155550101'), {
    titulo: 'Me escribiste desde otro WhatsApp',
    texto: 'Llegó desde el +54 911 6666 7777, pero me diste el +54 911 5555 0101.',
    usar: 'Usar el +54 911 6666 7777',
  });
  assert.equal(reenviarAbreWhatsapp(E_REESCRIBIR_V2), true);
  assert.equal(reenviarAbreWhatsapp('El código no coincide.'), false);
  assert.equal(reenviarAbreWhatsapp('MaKo no puede recibir mensajes en este momento, es de nuestro lado. Prueba de nuevo en unos minutos.'), false, 'la línea caída no se arregla abriendo WhatsApp');
  assert.equal(reenviarAbreWhatsapp(null), false);
  // Ella escribe y MaKo contesta: nunca que MaKo le escribe primero.
  assert.match(AVISO_WHATSAPP_ABIERTO, /mándamelo y te contesto/);
});

test('2. «Usar ese número»: el número sale del servidor (la vista en otro-numero), con el freno, y es «Cambiar número» + escribirlo', () => {
  const r = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  const b = bloque(r, "case 'usar-otro-numero': {", "case 'reenviar':");
  assert.match(b, /const freno = await frenoDeArranque\(\{ req, ws: g\.ws, usuario: usuarioGuardia \}\);/, 'cada pedido arma un código: la ráfaga vale');
  assert.match(b, /if \(!h\.v2 \|\| etapaDeArranque\(e, h\) !== 'codigo'\) return no\(409,/);
  assert.match(b, /const v = await estadoVerificacionEntrante\(g\.ws\);\s*const otro = v\?\.estado === 'otro-numero' \? \(v\.otroNumero \?\? ''\)\.replace\(\/\\D\/g, ''\) : '';/);
  assert.doesNotMatch(b, /body\./, 'nunca un número que manda la pantalla');
  assert.match(b, /const malo = errorDelTelefono\(otro\);/);
  assert.match(b, /await guardarEstadoArranque\(\{ telefono: undefined, telefonoNumero: undefined, telefonoEntrante: undefined \}\);/);
  assert.match(b, /return await pedirCodigo\(e2, h2, await hechosConfirmados\(h2\), otro\);/);
});

test('3. la tarjeta se entera (el sondeo) y lo dice arriba, con «Usar el …» y «Cambiar número» una sola vez', () => {
  const v = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  assert.match(v, /const esperandoWhatsapp = etapa === 'codigo' && \(vista\.whatsapp\?\.estado === 'esperando' \|\| vista\.whatsapp\?\.estado === 'otro-numero'\);/);
  assert.match(v, /if \(document\.hidden\) return;\s*void llamar\(\{ action: 'whatsapp' \}\)/);
  assert.match(v, /\}, 4000\);/);
  assert.match(v, /const otro = w\?\.estado === 'otro-numero' && w\.otroNumero \? avisoOtroNumero\(w\.otroNumero, w\.telefono\) : null;/);
  assert.match(v, /<Button variant="primary" size="sm" disabled=\{ocupado\} loading=\{ocupado\} onClick=\{onUsarOtro\}>\{otro\.usar\}<\/Button>\s*<Button variant="secondary" size="sm" disabled=\{ocupado\} onClick=\{onCambiar\}>Cambiar número<\/Button>/);
  assert.match(v, /\{!otro && <button type="button" className="arr-v2__link" onClick=\{onCambiar\} disabled=\{ocupado\}>Cambiar número<\/button>\}/);
  assert.match(v, /onUsarOtro=\{\(\) => void accion\(\{ action: 'usar-otro-numero' \}\)\}/);
});

test('4. «Reenviar» fuera de las 24 h abre WhatsApp con el mensaje, y desde ahí es el link mismo', () => {
  const v = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  const r = bloque(v, 'const reenviar = async () => {', 'const esperandoWhatsapp');
  assert.match(r, /if \(r\.ok === false && reenviarAbreWhatsapp\(r\.error\) && link\) \{/);
  assert.match(r, /setReescribir\(true\);/);
  // Sin `noopener` en las opciones: con él, window.open devuelve null SIEMPRE y no se sabría si el navegador la frenó.
  assert.match(r, /const ventana = window\.open\(link, '_blank'\);/);
  assert.match(r, /if \(ventana\) \{ try \{ ventana\.opener = null; \} catch \{[^}]*\} setAviso\(AVISO_WHATSAPP_ABIERTO\); \}\s*else \{ setResaltarWa\(true\); setError\(r\.error \?\? null\); \}/);
  assert.match(v, /\{reescribir && w\?\.link\s*\? <a className="arr-v2__link" href=\{w\.link\} target="_blank" rel="noopener noreferrer" onClick=\{onAbrioWhatsapp\}>Reenviar el código<\/a>/);
  assert.match(v, /className=\{`arr-v2__wa\$\{resaltarWa \? ' arr-v2__wa--resalta' : ''\}`\}/);
});
