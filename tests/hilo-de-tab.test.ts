// =============================================================================
// La charla de los chats de edición de las tabs (Editar con MaKo, Web Generator) queda en la base (22/10/2026)
// =============================================================================
// Martín, 22/10/2026: «¿Todos esos chats regresan y se quedan registrados en Ops Center?». «Editar con MaKo» guardaba en
// el navegador y el Web Generator en la memoria de la pestaña. Ahora van a `chart_sessions` (lib/hilo-de-tab-reglas.ts,
// /api/hilo-de-tab) y el Ops Center las lista como «de antes».
//
// ⚠️ PROBADO ROMPIÉNDOLO (22/10/2026): `claveDeTab` sin la lista de prefijos (acepta cualquier «x:y») → 1 fallo; la ruta
// sin `claveGuardada` (escribe la clave del closer sin su persona) → 1 fallo; el agente sin guardar en `terminar` → 1
// fallo; `mensajesDeFilas` sin separar el renglón «Adjuntos: » → 1 fallo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TOPE_CONTENIDO, TOPE_FILAS_POR_PEDIDO, claveDeLanding, claveDeTab, filaDeError, filasValidas, textoDeError, tituloValido,
} from '../lib/hilo-de-tab-reglas';
import { filasDeAgente, mensajesDeFilas, tituloDeLanding } from '../app/web-generator/editor/hilo-agente';

const leer = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

test('sólo las claves de estas tabs: nunca el chat del Ops Center o del teléfono de otra persona', () => {
  assert.equal(claveDeTab('dashboard:g1abc'), 'dashboard:g1abc');
  assert.equal(claveDeTab('landing:42'), 'landing:42');
  for (const mala of ['mako-movil:u7', 'persona:u7:dashboard:g1', 'wa-advisor:123', 'mako-doer', 'dashboard:', 'dashboard:a b', 'landing:1:2', 'offer:3', '', null, 7]) {
    assert.equal(claveDeTab(mala), null, String(mala));
  }
});

test('los mensajes llegan saneados: roles conocidos, sin vacíos, con tope', () => {
  assert.equal(filasValidas('x'), null);
  assert.equal(filasValidas([{ role: 'system', content: 'hola' }, { role: 'user', content: '  ' }]), null);
  assert.deepEqual(filasValidas([{ role: 'user', content: ' hola ' }, { role: 'assistant', content: 'listo' }]), [
    { role: 'user', content: 'hola' }, { role: 'assistant', content: 'listo' },
  ]);
  const largos = filasValidas(Array.from({ length: 50 }, () => ({ role: 'user', content: 'x'.repeat(TOPE_CONTENIDO + 10) })))!;
  assert.equal(largos.length, TOPE_FILAS_POR_PEDIDO);
  assert.equal(largos[0].content.length, TOPE_CONTENIDO);
  assert.equal(tituloValido('  Web   Generator · X ', 'def'), 'Web Generator · X');
  assert.equal(tituloValido(null, 'def'), 'def');
  assert.equal(textoDeError(filaDeError('falló').content), 'falló');
  assert.equal(textoDeError('todo bien'), null);
});

test('el agente del Web Generator: lo que se dijo va y vuelve (sin la propuesta ni las burbujas de pedido)', () => {
  const filas = filasDeAgente([
    { de: 'yo', texto: 'Cambia el título', adjuntos: ['marca.pdf', 'logo.png'] },
    { de: 'mako', texto: 'Te propongo un título nuevo.' },
    { de: 'pedido' },
    { de: 'yo', texto: '' },
    { de: 'mako', texto: 'No pude leer la página.', error: true },
  ]);
  assert.deepEqual(filas, [
    { role: 'user', content: 'Cambia el título\nAdjuntos: marca.pdf, logo.png' },
    { role: 'assistant', content: 'Te propongo un título nuevo.' },
    filaDeError('No pude leer la página.'),
  ]);
  assert.deepEqual(mensajesDeFilas(filas), [
    { de: 'yo', texto: 'Cambia el título', seccion: null, adjuntos: ['marca.pdf', 'logo.png'] },
    { de: 'mako', texto: 'Te propongo un título nuevo.' },
    { de: 'mako', texto: 'No pude leer la página.', error: true },
  ]);
  assert.equal(claveDeLanding(42), 'landing:42');
  assert.equal(tituloDeLanding('Mi curso'), 'Web Generator · Mi curso');
});

test('la ruta: sesión, sólo estas claves y la regla de quién es cada chat ANTES de escribir; el GET no escribe', () => {
  const src = leer('app', 'api', 'hilo-de-tab', 'route.ts');
  const get = src.slice(src.indexOf('export async function GET'), src.indexOf('export async function POST'));
  const post = src.slice(src.indexOf('export async function POST'));
  assert.doesNotMatch(get, /appendMessage|createSession|update|insert/, 'un GET no escribe');
  assert.doesNotMatch(src, /chatClaude|chatCheap|turnoApp/, 'esta ruta guarda: no llama a ninguna IA');
  for (const h of [get, post]) {
    const sesion = h.indexOf('quienPide()');
    const clave = h.indexOf('claveDeTab(');
    const deQuien = h.indexOf('claveGuardada(clave, q)');
    assert.ok(sesion > 0 && clave > sesion && deQuien > clave, 'el orden: sesión, clave, de quién');
  }
  const escribe = post.indexOf('appendMessage(');
  assert.ok(escribe > post.indexOf('claveGuardada(clave, q)'), 'escribe recién después de saber de quién es');
  assert.match(post, /createSession\(guardada,/, 'crea con la clave GUARDADA (la del closer lleva su persona)');
});

test('el agente guarda cada turno al terminar y trae la charla de la landing al abrirla', () => {
  const src = leer('app', 'web-generator', 'editor', 'paneles', 'PanelAgente.tsx');
  assert.match(src, /guardarEnHiloDeTab\(claveDeLanding\(docId\), tituloDeLanding\(titulo\), filasDeAgente\(\[yo, \.\.\.msgs\]\)\)/);
  assert.match(src, /leerHiloDeTab\(claveDeLanding\(docId\)\)/);
  assert.match(src, /useEffect\(\(\) => \{ traerHilo\(docId\); \}, \[docId\]\)/);
});
