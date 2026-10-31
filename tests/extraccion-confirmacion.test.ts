// =============================================================================
// «Extraer»: el modal mientras corre, la confirmación con cuántos, y el estado fuera del modal (30/10/2026)
// =============================================================================
// Martín: «cuando termina de scrapear debe regresar a la app de mako... en el CRM debe aparecer un modal que diga "scrapeando"...
// Y al finalizar un mensaje de confirmación... hoy en día sigue abierto el modal del scraper previo a darle "extraer"».
// Se prueba EJECUTANDO lib/extraccion-estado.ts con un sessionStorage de mentira, como una recarga de verdad.
//
// Correr: node --import tsx --test tests/extraccion-confirmacion.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (ver docs/hallazgos-crm.md, «Extraer: el resultado era una línea en el pie»).

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  avanzarExtraccion, cerrarExtraccion, empezarExtraccion, extraccionGuardada, olvidarParaProbar, pararExtraccion,
  resultadoDeExtraccion, resultadoInterrumpido, terminarExtraccion,
} from '../lib/extraccion-estado';

const leer = (r: string) => readFileSync(r, 'utf8').replace(/\r\n/g, '\n');
const base = { grupo: 'G', etapa: 'Lead entrante', etiqueta: 'G', nuevos: 0, nombres: 0, empresas: 0, perfiles: 0, fallidos: 0, motivos: [] as string[], parado: false };

test('1. dice cuántos; cero es cero, nunca un éxito vacío', () => {
  const ok = resultadoDeExtraccion({ ...base, nuevos: 105, nombres: 90 });
  assert.equal(ok.tono, 'ok');
  assert.match(ok.titulo, /^105 leads nuevos de «G»$/);
  assert.equal(ok.detalle, 'En «Lead entrante», con la etiqueta «G».');
  assert.deepEqual(ok.chips, ['90 nombres']);
  assert.equal(resultadoDeExtraccion({ ...base, nuevos: 1 }).titulo, '1 lead nuevo de «G»');
  const cero = resultadoDeExtraccion(base);
  assert.equal(cero.tono, 'vacio');
  assert.equal(cero.titulo, 'No entró nadie nuevo');
});

test('2. un corte nunca sale como éxito, aunque algo haya entrado; parar se dice como parar', () => {
  const corte = resultadoDeExtraccion({ ...base, nuevos: 40, motivos: ['', 'WhatsApp está tardando.'] });
  assert.equal(corte.tono, 'mal');
  assert.equal(corte.titulo, '40 leads nuevos, pero no terminó');
  assert.equal(corte.detalle, 'WhatsApp está tardando.');
  assert.equal(resultadoDeExtraccion({ ...base, motivos: ['La extensión no contestó.'] }).titulo, 'No se pudo extraer');
  assert.equal(resultadoDeExtraccion({ ...base, parado: true }).titulo, 'La paraste: no entró nadie');
  assert.equal(resultadoDeExtraccion({ ...base, nuevos: 3, parado: true }).titulo, 'La paraste: entraron 3 leads');
  assert.equal(resultadoDeExtraccion({ ...base, soloDatos: true, perfiles: 4 }).titulo, 'Datos actualizados');
  assert.equal(resultadoDeExtraccion({ ...base, soloDatos: true }).titulo, 'No encontré datos nuevos');
});

function storageDeMentira() {
  const m = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    sessionStorage: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } },
  };
  return m;
}

beforeEach(() => { olvidarParaProbar(); });

test('3. lo guardado sobrevive a la recarga: lo que corría se lee CORTADO, con los que alcanzaron a entrar', () => {
  const m = storageDeMentira();
  empezarExtraccion({ id: 'e1', grupo: 'G', funnel: 7, total: 100, parar: () => {} });
  avanzarExtraccion('e1', { nuevos: 40, texto: 'Buscando…' });
  const guardado = m.get('mako.extraccion') ?? null;
  assert.ok(guardado, 'no se guardó nada');
  const g = extraccionGuardada(guardado);
  assert.equal(g?.estado, 'interrumpida', 'una recarga no puede decir que sigue corriendo');
  assert.equal(g?.funnel, 7);
  assert.equal(g?.resultado?.titulo, 'Se cortó: entraron 40 leads');
  assert.equal(resultadoInterrumpido(0).titulo, 'Se cortó antes de traer a nadie');
  assert.equal(extraccionGuardada('{roto'), null);
  assert.equal(extraccionGuardada(null), null);
});

test('4. la terminada se conserva hasta leerla; una que corre no se cierra; otra corrida no pisa', () => {
  const m = storageDeMentira();
  let paro = 0;
  empezarExtraccion({ id: 'e2', grupo: 'G', funnel: null, total: 2, parar: () => { paro++; } });
  cerrarExtraccion();
  assert.ok(m.has('mako.extraccion'), 'cerró una que corre');
  pararExtraccion();
  assert.equal(paro, 1, '«Parar» del modal no llegó a quien corre');
  terminarExtraccion('otra', resultadoDeExtraccion(base), 0);
  assert.equal(JSON.parse(m.get('mako.extraccion')!).estado, 'corriendo', 'el final de otra corrida pisó a ésta');
  terminarExtraccion('e2', resultadoDeExtraccion({ ...base, nuevos: 2 }), 2);
  const g = extraccionGuardada(m.get('mako.extraccion')!);
  assert.equal(g?.estado, 'terminada');
  assert.equal(g?.resultado?.titulo, '2 leads nuevos de «G»');
  cerrarExtraccion();
  assert.equal(m.has('mako.extraccion'), false, 'leída, no se borró');
});

test('5. el Scraper escribe el estado y deja la lista distinta; el tablero monta el modal; mientras corre no se cierra', () => {
  const t = leer('app/crm/TraerDeGrupoWA.tsx');
  assert.match(t, /empezarExtraccion\(\{ id, grupo: grupo\.nombre, funnel, total: tels\.length/);
  assert.match(t, /avanzarExtraccion\(id, \{ nuevos: creados \}\)/);
  assert.match(t, /terminarExtraccion\(id, resultadoDeExtraccion\(/);
  assert.match(t, /if \(!corte && !fallaWa && !cortePerfiles && !paro\) \{ setJid\(''\); setGente\(null\);/, 'al terminar bien, la lista queda como antes de «Extraer»');
  const b = leer('app/crm/CrmBoard.tsx');
  assert.match(b, /<ExtraccionModal funnel=\{funnelActivo\} onVerCrm=\{cerrarAltaYTraer\} onOtroGrupo=\{abrirScraper\} \/>/);
  const e = leer('app/crm/ExtraccionModal.tsx');
  assert.match(e, /onCerrar=\{ignorar\} sinCerrar/, 'mientras corre se puede cerrar');
  assert.match(e, /if \(!e \|\| e\.funnel !== funnel\) return null;/, 'aparece en otro CRM');
  assert.match(e, /avisarExtraccion\(e\.id, \{ estado: 'error'/, 'la cortada no le avisa a la extensión');
  assert.match(leer('app/_ui/Modal.tsx'), /\{!sinCerrar && <button type="button" className="mk-modal__x"/);
});

test('6. la extensión vuelve aunque Chrome haya matado su worker: la pestaña es la que manda el aviso', () => {
  const w = leer('extension/background.js');
  assert.match(w, /volverAMako\(viva \?\? \{ origen: _s\?\.tab\?\.id, waTab: null \}, id\)/);
  assert.match(w, /const waTab = viva\.waTab \?\? \(await chrome\.tabs\.query\(\{\}\)\)\.find\(esPestanaDeWhatsapp\)\?\.id;/);
});
