// =============================================================================
// «Misma persona» ya no existe: los pasos de una automatización salen cuando lo dicen sus esperas (23/10/2026)
// =============================================================================
// Antes (misma mañana del 23/10): Martín, por el Cerebro, preguntó «si "Misma persona" dice 20 h y el flujo tiene un
// seguimiento o un delay de 2 h, ¿se rompe?». Se midió que no se rompía —el segundo WhatsApp quedaba «saltado: msg <20h» y
// salía a las 20 h— y se le puso a la tarjeta un aviso («Sale 20 h después del anterior»).
// Después, Martín (23/10/2026): «elimina "Misma persona"». El Cerebro: si la pantalla no la muestra, el motor no la puede
// seguir aplicando (sería una regla escondida). Se fue ENTERA:
//   · el motor ya no lee una ventana de la base (`leadsConEnvioReciente`, 20 h / 3 h con reunión cerca): `conEnvioRecienteDe`
//     devuelve siempre `SIN_VENTANA`;
//   · lo que SIGUE frenando es lo de la MISMA corrida (`frenadoPorAntiBan` con `enviadoEnCorrida`): dos mensajes al mismo
//     lead por el mismo canal en la misma vuelta no salen juntos;
//   · el aviso de la tarjeta (`mismaPersonaMin`, `minutosDesdeElWhatsappAnterior`, `avisoMismaPersona`) y la ruta
//     /api/flujos/misma-persona se fueron: un seguimiento a las 2 h sale a las 2 h, y la tarjeta no dice otra cosa.
//
// PROBADO ROMPIÉNDOLO: ver el pie. Correr: node --import tsx --test tests/automations-misma-persona-pasos.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as conversacion from '../lib/flujo-conversacion';
import * as configAuto from '../lib/config-automatizacion';
import { grafoDeSecuencia } from '../lib/flujo-conversacion';
import { frenadoPorAntiBan, anotarEnCorrida, type EnviadoEnCorrida } from '../lib/nutricion-grafo-motor';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

test('el motor ya no lee ventana de la base: `conEnvioRecienteDe` devuelve SIN_VENTANA, y no queda nada de las horas', () => {
  const motor = leer('lib/nutricion.ts');
  assert.match(motor, /const SIN_VENTANA: RecientesPorCanal = \{ whatsapp: new Set<number>\(\), email: new Set<number>\(\) \};/);
  assert.match(motor, /const conEnvioRecienteDe = \(_secId: number\): RecientesPorCanal => SIN_VENTANA;/);
  const codigo = sinComentarios(motor);
  for (const viejo of ['leadsConEnvioReciente', 'HS_MIN_PREPARACION', 'HS_REUNION_CERCA', 'personaHorasDeLaAutomatizacion', 'ventanaDe(', 'recientesPorVentana', 'personaHoras']) {
    assert.equal(codigo.includes(viejo), false, `volvió «${viejo}» al motor`);
  }
  // Lo que se conserva: el freno consulta a `conEnvioRecienteDe` + lo de la corrida, y el frenado NO cierra la inscripción.
  const i = motor.indexOf("estado: 'saltado', nota: 'msg <20h' });");
  assert.ok(i > 0, 'el freno de la misma corrida ya no existe');
  assert.match(motor.slice(i - 420, i), /frenadoPorAntiBan\(insc\.lead_id, paso\.canal, conEnvioRecienteDe\(insc\.secuencia_id\), enviadoEnCorrida\)/);
  assert.match(motor.slice(i, i + 260), /^estado: 'saltado', nota: 'msg <20h' \}\);\n\s+await aplazarSiTapa\(insc, sec\);\n\s+continue; \/\/ no avanzar; se reintenta en otra corrida/, 'el freno ya no deja la fila en su paso');
});

test('el freno de la MISMA corrida sigue: dos mensajes al mismo lead por el mismo canal en una vuelta no salen juntos; la base ya no frena', () => {
  const SIN_VENTANA = { whatsapp: new Set<number>(), email: new Set<number>() };
  const enCorrida: EnviadoEnCorrida = new Map();
  // Un lead al que le salió un WhatsApp hace 2 h: la base (vacía, sin ventana) ya no lo frena. Un seguimiento a las 2 h sale.
  assert.equal(frenadoPorAntiBan(7, 'whatsapp', SIN_VENTANA, enCorrida), false, 'la ventana de la base volvió a frenar');
  // Pero lo que acaba de salir en ESTA corrida, sí.
  anotarEnCorrida(enCorrida, 7, 'whatsapp');
  assert.equal(frenadoPorAntiBan(7, 'whatsapp', SIN_VENTANA, enCorrida), true, 'dos WhatsApp al mismo lead salieron en la misma vuelta');
  assert.equal(frenadoPorAntiBan(7, 'email', SIN_VENTANA, enCorrida), false, 'un WhatsApp frenó al email (es por canal)');
  assert.equal(frenadoPorAntiBan(8, 'whatsapp', SIN_VENTANA, enCorrida), false, 'frenó a otro lead');
});

test('se fueron las funciones y la ruta de «Misma persona»', () => {
  for (const f of ['minutosDesdeElWhatsappAnterior', 'avisoMismaPersona']) assert.equal(f in conversacion, false, `volvió ${f}`);
  for (const f of ['personaHorasDeLaAutomatizacion', 'PERSONA_SIN_ESPERA', 'fijarPersonaPropia', 'CONFIG_DE_NACIMIENTO']) assert.equal(f in configAuto, false, `volvió ${f}`);
  assert.doesNotMatch(leer('lib/config-automatizacion-db.ts'), /nacerConfigAutomatizacion/);
  assert.equal(existsSync(new URL('../app/api/flujos/misma-persona/route.ts', import.meta.url)), false, 'volvió la ruta de «Misma persona»');
  assert.equal(existsSync(new URL('../scripts/misma-persona-propia.mts', import.meta.url)), false, 'volvió el paso de una vez de «Misma persona»');
  const lienzo = leer('app/automations/FlujoLienzo.tsx');
  assert.doesNotMatch(lienzo, /misma-persona|mismaPersona/);
});

/** m1 (WhatsApp) → espera → m2 (WhatsApp). */
const flujo = (minutos: number): PasoGrafo[] => [
  { id: 'entrada', nodo: 'inicio', siguiente: 'm1' },
  { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola {{nombre}}', siguiente: 'e1' },
  { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos }, siguiente: 'm2' },
  { id: 'm2', canal: 'whatsapp', cuerpo: '¿Pudiste verlo?', siguiente: null },
] as unknown as PasoGrafo[];

test('la tarjeta de un seguimiento a las 2 h no dice «Sale 20 h después»: sale a las 2 h y no advierte nada', () => {
  const nodo = grafoDeSecuencia(flujo(120) as never, { disparador: 'Entra' }).nodos.find((n) => n.id === 'm2');
  assert.ok(nodo, 'no armó la tarjeta');
  assert.equal(nodo.advertencia, undefined);
  // Ni siquiera si el que arma el grafo todavía le pasa el dato viejo: no lo mira.
  const viejo = grafoDeSecuencia(flujo(120) as never, { disparador: 'Entra', mismaPersonaMin: 1200 } as never).nodos.find((n) => n.id === 'm2');
  assert.equal(viejo?.advertencia, undefined, 'la tarjeta volvió a avisar de «Misma persona»');
});

// ── ROTURAS (23/10/2026) ───────────────────────────────────────────────────────────────────────────
// Una por vez, con respaldo y restaurada (`git diff --stat -- app lib` vacío al final). Base 4 / 0:
//   P1. `conEnvioRecienteDe` devuelve algo que no es SIN_VENTANA                  → 1 rojo acá + 1 en motor-freno-ventana
//   P2. `frenadoPorAntiBan` sin mirar `enCorrida` (dos WhatsApp en la misma vuelta) → 1 rojo acá + 2 en motor-freno-ventana
//   P3. vuelve la ruta /api/flujos/misma-persona                                   → 1 rojo acá
