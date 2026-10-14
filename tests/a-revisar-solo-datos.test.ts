import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * «A revisar» (la esquina del CRM) muestra SÓLO los datos sin marcar.
 *
 * Martín, 13/10/2026: «primero elimina la foto de perfil que dice "Mk". Segundo, solo
 * deberían aparecer los datos sin marcar del CRM, no las notificaciones de "MaKo movió 6
 * leads", eso lo vamos a eliminar completamente... quiero que ahora todo eso pase a
 * AUTOMATIONS». El motor de lib/crm-auto.ts sigue hasta que Automations lo reemplace; lo
 * que se va es pedirle a la persona que confirme sus movimientos desde acá.
 *
 * Verificado rompiéndolo (base 3/0): volver a importar `listConfirmacionesAction`, 1 fallo;
 * volver a poner la «Mk», 1 fallo; volver a contar algo además de los sin marcar en el
 * total, 1 fallo.
 */

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const GATE = sinComentarios(leer('../app/_components/MakoConfirmGate.tsx'));

test('no pide ni resuelve las confirmaciones del CRM automático', () => {
  assert.doesNotMatch(GATE, /listConfirmacionesAction|resolverConfirmacionAction/, 'el panel volvió a listar lo que movió MaKo');
  assert.doesNotMatch(GATE, /MaKo movió/);
});

test('sin la «Mk»', () => {
  assert.doesNotMatch(GATE, />Mk</, 'la foto de perfil «Mk» volvió al panel');
});

test('el número del panel son los datos sin marcar, y nada más', () => {
  assert.match(GATE, /const total = sinMarcar;/);
  assert.match(GATE, /if \(!enCrm \|\| !cargado \|\| sinMarcar === 0\) return null;/, 'sin datos sin marcar el panel no se dibuja');
});
