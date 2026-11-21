// =============================================================================
// EL PASO DEL WHATSAPP EN LA REVISIÓN, IGUAL QUE PARA UN CLIENTE NUEVO (21/11/2026, Martín probando en el ws 3, por el Cerebro)
// =============================================================================
// «Yo quiero ver exactamente igual lo que recibe el usuario». En el ws 3 el número ya está verificado, y el paso cambiaba («ya está
// confirmado»). En la revisión corre el camino de un número NUEVO, con los mismos textos y el mismo orden: el video, el mensaje con
// «Abrir WhatsApp» y la caja del código, la tarjeta, «Guárdame…» y «¿Guardaste…?». En vez de mandar algo a WhatsApp, un modal simula
// ese lado: el mensaje que mandaría la persona (el pedido de verdad) y la respuesta de MaKo con el código, que se pega en la caja.
// La verificación de verdad del negocio NO se toca, y nada de esto corre sin la puerta de la revisión (alguien de MaKo, ws 3 o 9).
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { codigoSimulado, decidirCodigoSimulado, vistaDelWhatsappSimulado } from '../lib/onboarding-v2/whatsapp-simulado';
import { AGENDAR_V2, E_CODIGO_LARGO_V2, E_CODIGO_V2, E_ESCRIBE_CODIGO_V2, TEXTO_CONFIRMAR_V2, mensajeDelCodigoV2 } from '../lib/verificacion-entrante';
import { mensajesDeArranqueV2, type HechosArranque } from '../lib/onboarding-arranque';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const HECHOS = { modo: 'oferta', v2: true, conTelefono: true, terminado: false, nombreCuenta: 'Martín', nombreWorkspace: 'Laland' } as unknown as HechosArranque;

test('1. el modal dice lo de VERDAD: el pedido que manda la persona y la respuesta de MaKo con el código', () => {
  const c = codigoSimulado();
  assert.match(c, /^\d{6}$/);
  const v = vistaDelWhatsappSimulado({ nombre: 'Valentina Pérez', telefonoNumero: '+5491155550101', simulacion: { codigo: '482913' } });
  assert.equal(v.simulado?.pedido, TEXTO_CONFIRMAR_V2);
  assert.equal(v.simulado?.respuesta, mensajeDelCodigoV2('Valentina', '482913'));
  assert.equal(v.simulado?.codigo, '482913');
  assert.equal(v.simulado?.agendar, AGENDAR_V2, 'después del código y la tarjeta, «Guárdame…», como manda MaKo (mandarCodigoV2)');
  assert.equal(v.estado, 'esperando');
  assert.ok(v.link, 'con «Abrir WhatsApp» (abre el modal)');
});

test('2. el código simulado se decide como el de verdad (mismos avisos)', () => {
  const s = { codigo: '482913' };
  assert.deepEqual(decidirCodigoSimulado('482913', s), { ok: true });
  assert.deepEqual(decidirCodigoSimulado('', s), { ok: false, error: E_ESCRIBE_CODIGO_V2 });
  assert.deepEqual(decidirCodigoSimulado('4829', s), { ok: false, error: E_CODIGO_LARGO_V2 });
  assert.deepEqual(decidirCodigoSimulado('111111', s), { ok: false, error: E_CODIGO_V2 });
});

test('3. la conversación es la de un número NUEVO: el mensaje del código, y después la tarjeta, «Guárdame…» y «¿Guardaste…?»', () => {
  const base = { introVista: true, nombre: 'Valentina', telefonoNumero: '+5491155550101', telefonoVisto: '+54 9 11 5555 0101' };
  const enCodigo = mensajesDeArranqueV2({ ...base, telefono: 'codigo', telefonoEntrante: true, simulacion: { codigo: '482913' } }, HECHOS).map((m) => m.id);
  assert.ok(enCodigo.includes('arr-codigo'), 'el mensaje con «Abrir WhatsApp» y la caja');
  assert.ok(!enCodigo.includes('arr-ya-confirmado'));
  const despues = mensajesDeArranqueV2({ ...base, telefono: 'verificado' }, HECHOS).map((m) => m.id);
  const nuevo = ['arr-codigo', 'arr-agendado'].map((id) => despues.indexOf(id));
  assert.ok(nuevo.every((i) => i >= 0) && nuevo[0] < nuevo[1], 'el código cargado y después «¿Guardaste…?», como un cliente nuevo');
  assert.ok(!despues.includes('arr-ya-confirmado'), 'nunca el «ya está confirmado» del número de antes');
});

test('4. la ruta: con la puerta, no sale nada por WhatsApp ni se toca la verificación de verdad; sin la puerta, el camino de siempre', () => {
  const r = sinComentarios(fuente('app/api/onboarding/arranque/route.ts'));
  assert.match(r, /const enRevision = async \(\) => puedeVerLaRevision\(\{ ws: g\.ws, admin: !!\(await getSesionAdmin\(\)\.catch\(\(\) => null\)\) \}\);/);
  const i = r.indexOf('const pedirCodigo = async');
  const pedir = r.slice(i, r.indexOf('pedirConfirmacionV2(g.ws', i));
  assert.match(pedir, /if \(h\.v2 && \(await enRevision\(\)\)\) \{[\s\S]*simulacion: \{ codigo: codigoSimulado\(\) \}[\s\S]*return listo\(\);/, 'antes de pedirle nada a WhatsApp');
  assert.match(r, /if \(e\.simulacion && \(await enRevision\(\)\)\) \{\n\s*const d = decidirCodigoSimulado\(codigoEscrito, e\.simulacion\);/, 'el código, contra el simulado y con la puerta');
  assert.match(r, /telefono: 'verificado', simulacion: undefined/);
  const vista = sinComentarios(fuente('lib/onboarding-arranque-server.ts'));
  assert.match(vista, /e\.simulacion \? vistaDelWhatsappSimulado\(e\) :/);
});

test('5. en la pantalla: «Abrir WhatsApp» abre el modal, y «Pegar el código» lo deja en la caja', () => {
  const c = sinComentarios(fuente('app/onboarding/ChatArranqueV2.tsx'));
  assert.match(c, /w\?\.simulado\n?\s*\? <button type="button" className=\{`arr-v2__wa/, 'el mismo botón verde, que abre el modal');
  assert.match(c, /<WhatsappSimulado simulado=\{w\.simulado\} onPegar=\{\(x\) => \{ setCodigo\(x\); setSimulando\(false\); \}\}/);
  const m = sinComentarios(fuente('app/onboarding/WhatsappSimulado.tsx'));
  assert.match(m, /\{simulado\.pedido\}/);
  assert.match(m, /\{simulado\.respuesta\}/);
  assert.match(m, /\{simulado\.agendar\}/);
  assert.ok(m.indexOf('{simulado.pedido}') < m.indexOf('{simulado.respuesta}') && m.indexOf('{simulado.respuesta}') < m.indexOf('Guardar contacto') && m.indexOf('Guardar contacto') < m.indexOf('{simulado.agendar}'), 'en el orden de MaKo: el pedido, el código, la tarjeta y «Guárdame…»');
  assert.match(m, /Pegar el código/);
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (21/11/2026), de a una rotura, y cada una cae:
//   · el pedido del modal con otro texto                        → 1
//   · el código simulado aceptado con cualquier número          → 2
//   · la simulación sin la puerta                                → 4
//   · «Abrir WhatsApp» con el link de verdad en la simulación    → 5
// ─────────────────────────────────────────────────────────────────────────────
