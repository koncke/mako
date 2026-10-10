// =============================================================================
// Restos de versiones anteriores, grupo «otros» (10/10/2026): lo que todavía hablaba como antes
// =============================================================================
// Martín, con la captura de su ws9: «siguen habiendo cosas de versiones anteriores que están mal».
// Fuera del lienzo quedaban textos y pasos de antes, y ninguno daba error:
//   · «Probar» anunciaba la respuesta del lead con «Si responde · Otra cosa», los nombres de la tarjeta
//     de antes; la tarjeta es la CONDITION que escucha («Su respuesta trata de «…»» / «Si no»);
//   · los avisos que arma el código decían «Secuencia: X», «súmalo como caso en «Si responde»» y
//     «respondió a la secuencia de mensajes», y los motivos de la charla, «la secuencia está pausada»;
//   · la API decía que rearmar las automatizaciones de los audios «pierde los cambios de texto», que
//     desde el 08/10 sólo es cierto para una lista de antes (sobre tarjetas cambia sólo el audio);
//   · el wizard compartido del onboarding (el de /whatsapp) seguía con los pasos de la línea OFICIAL
//     y «aprobar» —código que no abría nadie— y su ayuda prometía «solo entre las 9 y las 21».
//
// Se fija el FUENTE sin comentarios (los comentarios citan lo de antes a propósito).
//
// PROBADO ROMPIÉNDOLO (10/10/2026, restaurando de memoria; base 6 pases / 0 fallos):
//   · «Probar» de vuelta a «Si responde · …»                         → 1 fallo, 5 pases;
//   · el aviso del hand-off de vuelta a «Secuencia: X»                → 1 fallo, 5 pases;
//   · el aviso de la respuesta de vuelta a «la secuencia de mensajes» → 1 fallo, 5 pases;
//   · un motivo de la charla de vuelta a «la secuencia está pausada»  → 1 fallo, 5 pases;
//   · la ayuda del WhatsApp de vuelta a «solo entre las 9 y las 21»   → 1 fallo, 5 pases;
//   · la API de vuelta a «Las reescritas pierden sus cambios…»        → 1 fallo, 5 pases.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const codigo = (r: string) => sinComentarios(leer(r));

test('«Probar» anuncia la rama con las palabras de la tarjeta, no «Si responde · Otra cosa»', () => {
  const p = codigo('app/automations/PanelProbar.tsx');
  assert.match(p, /sistema\(e\.caso\?\.id \? textoCasoRespuesta\(e\.caso\) : 'Si no'\);/);
  assert.doesNotMatch(p, /Si responde · /, 'volvió el rótulo de la tarjeta de antes');
});

test('el aviso de una charla que pasó a una persona dice «Automatización» y la fila de la condición', () => {
  const h = codigo('lib/chat-agent-handoff.ts');
  assert.match(h, /`Automatización: \$\{input\.secuenciaNombre\}`/);
  assert.doesNotMatch(h, /`Secuencia: |en «Si responde»/, 'el aviso le habla al dueño con los nombres de antes');
});

test('el aviso de una respuesta dice «respondió a la automatización»', () => {
  const n = codigo('lib/nutricion.ts');
  assert.match(n, /respondió\* a la automatización «\$\{secuencia\.nombre\}»/);
  assert.doesNotMatch(n, /a la secuencia de mensajes «/);
});

test('los motivos de la charla (le llegan al dueño) dicen «automatización»', () => {
  const s = codigo('lib/setter-conversacion.ts');
  assert.doesNotMatch(s, /motivo: 'la secuencia/, 'un motivo volvió a decir «la secuencia»');
  assert.match(s, /motivo: 'la automatización está pausada'/);
});

test('el wizard del onboarding: sin la línea oficial ni «aprobar», y sin la ventana fija de 9 a 21', () => {
  const w = codigo('app/automations/OnboardingChatAgent.tsx');
  assert.doesNotMatch(w, /wa_oficial|'aprobar'/, 'volvió un paso que no abre nadie');
  assert.doesNotMatch(w, /[Mm]étodo (NO )?[Oo]ficial|método oficial/, 'la ayuda vuelve a comparar con el método oficial, que salió');
  assert.doesNotMatch(w, /entre las 9 y las 21/, 'el horario de envío es opcional y lo pone el negocio');
  assert.match(w, /wa_no_oficial: \{ q: 'Tu WhatsApp' \},/);
});

test('la API no promete que rearmar desde los audios pierde el texto de una de tarjetas', () => {
  const r = codigo('lib/api-mako/areas/chatbot.run.ts');
  assert.doesNotMatch(r, /Las reescritas pierden sus cambios de texto y variantes/);
  assert.match(r, /Una de tarjetas sólo cambia sus audios; una lista de antes se reescribe/);
});
