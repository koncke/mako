// =============================================================================
// «Misma persona» y los pasos de UNA automatización: no se traban, se retrasan, y la tarjeta lo dice (23/10/2026)
// =============================================================================
// Martín, por el Cerebro: «Medilo: si "Misma persona" dice 20 h y el flujo tiene un seguimiento o un delay de 2 h, ¿se rompe
// la automatización? Si se rompe, que no pase. Los pasos de una misma automatización hacia el mismo lead no pueden quedar
// trabados por ese tope, o hay que avisarlo claro en la tarjeta del paso».
//
// LO MEDIDO (el motor, lib/nutricion.ts): NO SE ROMPE. A las 2 h el segundo WhatsApp encuentra el primero dentro de la
// ventana de 20 h (`leadsConEnvioReciente`: lo enviado a ese lead con `created_at >= ahora − 20 h`), queda «saltado: msg
// <20h», la inscripción SIGUE en ese paso (`continue`, sin cerrarla) y sale en la primera corrida después de las 20 h. O sea:
// la espera de 2 h se cumple a las 20 h. La DECISIÓN: no se toca el motor (frenar a la misma persona ES el anti-ban, y
// sacarlo para los pasos propios dejaría salir dos WhatsApp en 5 minutos en flujos que hoy esperan 20 h, en producción),
// pero la tarjeta dice cuándo sale de verdad, con el «Misma persona» de ESA automatización, que se apaga en Configuraciones.
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/automations-misma-persona-pasos.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grafoDeSecuencia, minutosDesdeElWhatsappAnterior, avisoMismaPersona } from '../lib/flujo-conversacion';
import { frenadoPorAntiBan } from '../lib/nutricion-grafo-motor';
import { personaHorasDeLaAutomatizacion, PERSONA_SIN_ESPERA } from '../lib/config-automatizacion';
import { LIMITES_CONSTANTES } from '../lib/limites-envio';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const H = 3_600_000;

/** La ventana del motor, como la pregunta `leadsConEnvioReciente`: lo enviado con `created_at >= ahora − horas`. */
const enVentana = (envioMs: number, ahoraMs: number, horas: number) => envioMs >= ahoraMs - horas * H;

test('MEDIDO: un seguimiento a las 2 h con «Misma persona» de 20 h no se traba: sale a las 20 h', () => {
  const T0 = Date.UTC(2026, 9, 23, 12);
  // 20 h guardadas como SUYAS: desde el 23/10/2026 sin las suyas está apagada (las que heredaban las 20 h de fábrica las
  // guardaron con scripts/misma-persona-propia.mts).
  const horas = personaHorasDeLaAutomatizacion({ personaHoras: { whatsapp: LIMITES_CONSTANTES.wa.personaHoras } }).whatsapp;
  assert.equal(horas, 20);
  // A las 2 h (lo que dice la espera): el primero está en la ventana → frenado.
  const recientes = (ahora: number) => ({ whatsapp: new Set(enVentana(T0, ahora, horas) ? [7] : []), email: new Set<number>() });
  assert.equal(frenadoPorAntiBan(7, 'whatsapp', recientes(T0 + 2 * H), new Map()), true);
  // Cada corrida hasta las 20 h, igual; la primera después, sale.
  for (const h of [3, 8, 19.9]) assert.equal(frenadoPorAntiBan(7, 'whatsapp', recientes(T0 + h * H), new Map()), true, `${h} h`);
  assert.equal(frenadoPorAntiBan(7, 'whatsapp', recientes(T0 + 20.05 * H), new Map()), false, 'después de las 20 h seguía frenado');
  // Con «Misma persona» apagada en esa automatización, a las 2 h sale (0 h de ventana).
  const apagada = personaHorasDeLaAutomatizacion({ personaHoras: { whatsapp: PERSONA_SIN_ESPERA } }, LIMITES_CONSTANTES).whatsapp;
  assert.equal(frenadoPorAntiBan(7, 'whatsapp', { whatsapp: new Set(enVentana(T0, T0 + 2 * H, apagada) ? [7] : []), email: new Set() }, new Map()), false);
  // Y el motor hace eso: la ventana es `created_at >= haceHorasISO(horas)`, y el frenado NO cierra la inscripción.
  const motor = leer('lib/nutricion.ts');
  assert.match(motor, /const desde = haceHorasISO\(personaHoras\.whatsapp\);/);
  assert.match(motor, /\.eq\('canal', canal\)\.gte\('created_at', d\);/);
  const freno = motor.slice(motor.indexOf("estado: 'saltado', nota: 'msg <20h' });"), motor.indexOf("estado: 'saltado', nota: 'msg <20h' });") + 260);
  assert.match(freno, /^estado: 'saltado', nota: 'msg <20h' \}\);\n\s+await aplazarSiTapa\(insc, sec\);\n\s+continue; \/\/ no avanzar; se reintenta en otra corrida/, 'el freno ya no deja la fila en su paso');
});

/** m1 (WhatsApp) → espera → [condición] → m2 (WhatsApp), y un email aparte. */
const flujo = (minutos: number, conCondicion = false): PasoGrafo[] => [
  { id: 'entrada', nodo: 'inicio', siguiente: 'm1' },
  { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola {{nombre}}', siguiente: 'e1' },
  { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos }, siguiente: conCondicion ? 'c1' : 'm2' },
  ...(conCondicion ? [{ id: 'c1', nodo: 'condicion', ramas: [{ id: 'r1', modo: 'todas', filas: [{ no: true, campo: 'contesto' }], siguiente: 'm2' }], si_no: null }] : []),
  { id: 'm2', canal: 'whatsapp', cuerpo: '¿Pudiste verlo?', siguiente: 'm3' },
  { id: 'm3', canal: 'email', asunto: 'Hola', cuerpo: 'Te escribo por mail', siguiente: null },
] as unknown as PasoGrafo[];
const aviso = (pasos: PasoGrafo[], id: string, mismaPersonaMin?: number | null) =>
  grafoDeSecuencia(pasos as never, { disparador: 'Entra', mismaPersonaMin }).nodos.find((n) => n.id === id)?.advertencia;

test('la tarjeta dice cuándo sale de verdad: el WhatsApp que sigue a otro antes de «Misma persona»', () => {
  assert.equal(aviso(flujo(120), 'm2', 1200), 'Sale 20 h después del anterior («Misma persona»)');
  assert.equal(aviso(flujo(120, true), 'm2', 1200), avisoMismaPersona(1200), 'la condición del seguimiento escondía la espera');
  assert.equal(aviso(flujo(1440), 'm2', 1200), undefined, 'con 24 h de espera no hay nada que avisar');
  assert.equal(aviso(flujo(120), 'm2', 0), undefined, 'con «Misma persona» apagada no la retiene');
  assert.equal(aviso(flujo(120), 'm2', null), undefined, 'sin saberlo no se avisa');
  assert.equal(aviso(flujo(120), 'm1', 1200), undefined, 'el primero no sigue a nadie');
  assert.equal(aviso(flujo(120), 'm3', 1200), undefined, 'un email no cuenta la de WhatsApp');
  // Un email en el medio no es «el WhatsApp anterior»: WhatsApp → 24 h → email → WhatsApp no se avisa.
  const conEmail = [
    { id: 'entrada', nodo: 'inicio', siguiente: 'm1' },
    { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola', siguiente: 'e1' },
    { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'm3' },
    { id: 'm3', canal: 'email', asunto: 'Hola', cuerpo: 'Por mail', siguiente: 'm2' },
    { id: 'm2', canal: 'whatsapp', cuerpo: '¿Lo viste?', siguiente: null },
  ] as unknown as PasoGrafo[];
  assert.equal(aviso(conEmail, 'm2', 1200), undefined, 'el email contó como el WhatsApp anterior');
  // Dos WhatsApp seguidos, sin espera: también (es el caso más común de «salen 20 h después»).
  assert.equal(minutosDesdeElWhatsappAnterior([{ id: 'a', canal: 'whatsapp', siguiente: 'b' }, { id: 'b', canal: 'whatsapp', siguiente: null }] as never, 'b'), 0);
  // El lienzo lo pide con la automatización, y la ruta da la suya (sin la suya, apagada).
  assert.match(leer('app/automations/FlujoLienzo.tsx'), /fetch\(`\/api\/flujos\/misma-persona\?secuencia=\$\{secuenciaId\}`/);
  assert.match(leer('app/api/flujos/misma-persona/route.ts'), /const horas = personaHorasDeLaAutomatizacion\(await leerConfigAutomatizacion\(id\)\)\.whatsapp;/);
});

// ── ROTURAS (23/10/2026) ───────────────────────────────────────────────────────────────────────────
// Con romper.mjs del scratchpad, una por vez. Base 2 / 0:
//   P1. la tarjeta no avisa (`retrasada` siempre false)                                        → rojo
//   P2. una condición corta la cuenta de la espera                                             → rojo
//   P3. el email cuenta como el WhatsApp anterior                                             → rojo
