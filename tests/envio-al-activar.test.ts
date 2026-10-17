// =============================================================================
// #851: ACTIVAR una automatización que le escribe al lead por WhatsApp prende el envío de WhatsApp del negocio
// =============================================================================
// Decisión de Martín en la Ticketera (`envio-whatsapp-al-activar`, 17/10/2026): «B · Sí, y prenderlo ya». El envío era un
// interruptor aparte de la línea, apagado de fábrica para los clientes: medido el 17/10, prendido sólo en ws1, ws11 y
// ws13. Lo que fija este test:
//   1. cuándo una automatización «le escribe al lead por WhatsApp» (un mensaje por WhatsApp o un AI Step por WhatsApp);
//      la tarjeta MaKo al grupo no cuenta (es una ⚡ Acción por la línea de MaKo);
//   2. el cableado: sólo al ACTIVAR, después de escribir la activación, sólo PRENDE (nunca apaga), y un error no deshace
//      la activación.
//
// Probado rompiéndolo (17/10/2026, arnés `romper.py` + `roturas-851.json`; base 2 / 2): contando la tarjeta del grupo como
// mensaje al lead → 1 / 1 (cae el 1); prendiendo también al PAUSAR → 1 / 1 (el 2); apagándolo cuando no le escribe al
// lead → 1 / 1 (el 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leEscribeAlLeadPorWhatsapp } from '../lib/envio-al-activar';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial', siguiente: null } as const;
const p = (x: Record<string, unknown>): PasoGrafo => ({ ...RELLENO, id: 'x', ...x }) as PasoGrafo;

test('1. le escribe al lead por WhatsApp: un mensaje o un AI Step por WhatsApp; la tarjeta del grupo no', () => {
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ cuerpo: 'Hola {{nombre}}' })]), true);
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ nodo: 'respuesta', paso_ia: true })]), true, 'el AI Step contesta por WhatsApp');
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ nodo: 'respuesta', paso_ia: true, medio: 'instagram' })]), false, 'por Instagram no usa este interruptor');
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ canal: 'email', asunto: 'Hola', cuerpo: 'x' })]), false, 'un email tiene su propio interruptor');
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ accion: { operacion: 'avisar_al_equipo', params: { mensaje: 'x' } } })]), false,
    'la tarjeta MaKo al grupo es una ⚡ Acción: no depende del envío del negocio');
  assert.equal(leEscribeAlLeadPorWhatsapp([p({ nodo: 'esperar', espera: { modo: 'tiempo', minutos: 5 } }), p({ nodo: 'condicion', ramas: [] })]), false);
});

test('2. el cableado: sólo al activar, después de escribirla, sólo prende, y un error no deshace la activación', () => {
  const src = leer('lib/nutricion.ts');
  const f = src.slice(src.indexOf('export async function setSecuenciaActiva('), src.indexOf('async function prenderEnvioAlActivar('));
  const iUpdate = f.indexOf(".update({ activa, updated_at: ahoraISO() })");
  const iPrende = f.indexOf('await prenderEnvioAlActivar(supabase, id).catch(');
  assert.ok(iUpdate > 0 && iPrende > iUpdate, 'se prende DESPUÉS de activar');
  const iSi = f.lastIndexOf('if (activa) {', iPrende);
  assert.ok(iSi > iUpdate && !/\n {2}\}\n/.test(f.slice(iSi, iPrende)), 'sólo al activar (adentro del `if (activa)`), nunca al pausar');
  const g = src.slice(src.indexOf('async function prenderEnvioAlActivar('), src.indexOf('\n}\n', src.indexOf('async function prenderEnvioAlActivar(')));
  assert.match(g, /if \(!leEscribeAlLeadPorWhatsapp\(pasos\) \|\| \(await envioWhatsappHabilitado\(\)\)\) return false;\n\s*await setEnvioWhatsapp\(true\);/);
  assert.doesNotMatch(g, /setEnvioWhatsapp\(false\)/, 'activar nunca APAGA el envío');
});
