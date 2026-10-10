// =============================================================================
// La copia de una secuencia a un workspace de prueba: lo del DUEÑO no viaja (lib/clonar-pasos.ts)
// =============================================================================
// Sexta tanda (09/10/2026), segunda pasada, parte «motor». La copia (lib/clonar-config.ts) ya vaciaba
// el audio y el archivo del paso; le faltaban dos cosas, y las dos dejaban un mensaje que en el destino
// no sale NUNCA, sin un error:
//   · el NÚMERO por mensaje (`linea`, WhatsApp 2 de la sexta tanda): una línea del dueño, que en el
//     destino `elegirLinea` no encuentra — y una línea pedida que no es del negocio no cae a la de por
//     default (AGENTS.md);
//   · el audio o el archivo ADENTRO de un mensaje de varias partes (cuarta tanda, punto 15).
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasosParaElDestino } from '../lib/clonar-pasos';

test('el número por mensaje del dueño NO viaja: el mensaje vuelve a la línea de la automatización', () => {
  const r = pasosParaElDestino([
    { id: 'a', canal: 'whatsapp', cuerpo: 'Hola', linea: 'mako_ws1_linea2' },
    { id: 'b', canal: 'whatsapp', cuerpo: 'Chau' },
  ]);
  const [a, b] = r.pasos as Array<Record<string, unknown>>;
  assert.equal('linea' in a, false, 'la línea del dueño quedó en el paso: en el destino ese mensaje no sale');
  assert.deepEqual(b, { id: 'b', canal: 'whatsapp', cuerpo: 'Chau' }, 'un paso sin línea queda igual');
  assert.equal(r.lineas, 1);
});

test('los adjuntos del dueño no viajan: ni el del paso ni los de sus partes', () => {
  const r = pasosParaElDestino([
    { id: 'a', tipo: 'audio', audio_id: 12 },
    { id: 'b', partes: [{ tipo: 'texto', cuerpo: 'Te dejo esto' }, { tipo: 'media', media_id: 4, cuerpo: 'El PDF' }, { tipo: 'audio', audio_id: 9 }] },
  ]);
  const [a, b] = r.pasos as Array<Record<string, unknown>>;
  assert.equal(a.audio_id, null);
  assert.deepEqual(b.partes, [{ tipo: 'texto', cuerpo: 'Te dejo esto' }], 'un archivo del dueño adentro de las partes viajó');
  assert.equal(r.adjuntos, 3);
});

test('no toca lo de entrada, y lo que no es una lista vuelve tal cual', () => {
  const entrada = [{ id: 'a', linea: 'x', partes: [{ tipo: 'audio', audio_id: 1 }] }];
  const copia = JSON.parse(JSON.stringify(entrada));
  pasosParaElDestino(entrada);
  assert.deepEqual(entrada, copia);
  assert.deepEqual(pasosParaElDestino(null), { pasos: null, adjuntos: 0, lineas: 0 });
});

// ── ROTURAS (09/10/2026) ───────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo, restaura DE MEMORIA con md5; nunca git).
// Base: 3 / 0. Sin el `delete o.linea` → 2 / 1; sin el filtro de las partes con archivo → 2 / 1.
// Restaurado: 3 / 0.
