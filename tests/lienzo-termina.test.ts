// =============================================================================
// Una fila de una condición SIN flecha dice «Termina» (el «Stop», 14/10/2026)
// =============================================================================
// Martín (14/10/2026): «creo que falta una tarjeta de "stop". Aunque no se si con las tarjetas que ya tenemos se pueda
// configurar ese "stop"... Tampoco quiero agregar tarjetas por agregar». No hace falta: una rama (o el «Si no») sin
// flecha ya termina ese camino (`resolverControl` → `fin`, lib/nutricion-grafo-motor.ts). Lo que faltaba es que se viera:
// el círculo vacío era sólo un «＋». Ahora las filas con rótulo (condición, «Si responde») dicen «Termina».
//
// PROBADO ROMPIÉNDOLO (14/10/2026), cada rotura de a una y restaurada. Pasan / fallan:
//   R1 sin el rótulo «Termina»                                                           → 1 / 1
//   R2 «Termina» también en la salida al pie de un mensaje (sin `p.rotulo != null`)        → 1 / 1
//
// Correr: node --import tsx --test tests/lienzo-termina.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolverControl } from '../lib/nutricion-grafo-motor';
import { normalizar, type PasoGrafo } from '../lib/flujo-grafo';

test('el dato: una rama sin flecha TERMINA ese camino (no hace falta una tarjeta «Stop»)', () => {
  const pasos = normalizar([
    { id: 'c', nodo: 'condicion', ramas: [{ id: 'r', siguiente: null, filas: [{ campo: 'ya_contactado' }], modo: 'todas' }], si_no: 'm' },
    { id: 'm', canal: 'whatsapp', cuerpo: 'hola', siguiente: null, delay_horas: 0 },
  ] as PasoGrafo[]);
  const hechos = { etiquetas: new Set<number>(), etapa: null, agendo: false, pago: false, yaContactado: true, respondio: false, creadoMs: null, tieneTelefono: true, tieneEmail: false, ahoraMs: Date.now() };
  const r = resolverControl(pasos, 0, { hechos, ahoraMs: Date.now(), reunionMs: null });
  assert.equal(r.tipo, 'fin');
});

const L = readFileSync(new URL('../app/_components/Lienzo.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
test('el lienzo: la fila con rótulo y sin flecha dice «Termina»', () => {
  assert.match(L, /\{p\.vacio && p\.rotulo != null && \(\n\s*<span data-termina aria-hidden[^>]*>Termina<\/span>/);
});
