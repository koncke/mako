// =============================================================================
// Lo que se dice al ACTIVAR: cuántos y a qué ritmo (Martín, 25/10/2026; lib/ritmo-al-activar.ts)
// =============================================================================
// «como está muy escondido el "goteo" se manden muchos mensajes de una». Fija el texto con los números del motor y que las cuatro
// puertas de activar (el interruptor, el «⋯», el teléfono y MaKo) lo digan antes de prender.
//
// Correr: node --import tsx --test tests/ritmo-al-activar.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisoDeRitmo, canalDelPrimerMensaje } from '../lib/ritmo-al-activar';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (p: string): string => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const TOPES = { wa: { dia: 40, hora: 6 }, email: { dia: 100 } };
const base = { canal: 'whatsapp' as const, topes: TOPES };

test('sin goteo, WhatsApp: no son «200 de una», es el tope de la línea, y se dice con todas las letras', () => {
  const a = avisoDeRitmo({ ...base, personas: 200, goteo: null })!;
  assert.equal(a.sinGoteo, true);
  assert.equal(a.texto, 'Entran 200 personas y no tiene goteo: los mensajes de WhatsApp salen juntos, hasta 6 por hora y 40 por día (el tope de tu línea). Tarda al menos 4 días.');
});

test('sin goteo, pocos: entran en una tanda y salen todos juntos', () => {
  assert.equal(avisoDeRitmo({ ...base, personas: 5, goteo: null })!.texto, 'Entran 5 personas y no tiene goteo: los 5 mensajes de WhatsApp salen todos juntos.');
});

test('sin goteo, Instagram no tiene tope de línea: todos juntos, aunque sean 500', () => {
  const a = avisoDeRitmo({ ...base, canal: 'instagram', personas: 500, goteo: null })!;
  assert.equal(a.texto, 'Entran 500 personas y no tiene goteo: los 500 mensajes de Instagram salen todos juntos.');
});

test('sin goteo, email: sólo su tope por día', () => {
  const a = avisoDeRitmo({ ...base, canal: 'email', personas: 250, goteo: null })!;
  assert.match(a.texto, /salen juntos, hasta 100 por día \(el tope de tu línea\)\. Tarda al menos 2 días\.$/);
});

test('con goteo: uno cada N min, y los topes que frenan a estos', () => {
  const a = avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 } })!;
  assert.equal(a.sinGoteo, false);
  assert.equal(a.texto, 'Entran 200 personas. El primer mensaje sale por WhatsApp: uno cada 5 min, hasta 6 por hora y 40 por día. Tarda al menos 4 días.');
  // 11 min es menos que 6 por hora: la línea no frena, y 10 personas no llegan al tope del día.
  assert.equal(avisoDeRitmo({ ...base, personas: 10, goteo: { minutos: 11 } })!.texto, 'Entran 10 personas. El primer mensaje sale por WhatsApp: uno cada 11 min. Tarda al menos 1 hora.');
  // Su tope por día manda sobre el de la línea.
  assert.match(avisoDeRitmo({ ...base, personas: 100, goteo: { minutos: 11, dia: 20 } })!.texto, /hasta 20 por día\. Tarda al menos 4 días\.$/);
  // El piso: dos personas con goteo son los minutos que hay entre las dos.
  assert.match(avisoDeRitmo({ ...base, personas: 2, goteo: { minutos: 5 } })!.texto, /Tarda al menos 5 min\.$/);
});

test('sólo tope por día, sin minutos: no espacia, así que sigue siendo «no tiene goteo»', () => {
  const a = avisoDeRitmo({ ...base, personas: 100, goteo: { dia: 20 } })!;
  assert.equal(a.sinGoteo, true);
  assert.match(a.texto, /salen juntos, hasta 6 por hora y 20 por día\. Tarda al menos 4 días\.$/);
});

test('sin nada que decir: una persona, nadie, o una sin mensajes; no se pudo contar: sin goteo se dice igual', () => {
  assert.equal(avisoDeRitmo({ ...base, personas: 1, goteo: null }), null);
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: null }), null);
  assert.equal(avisoDeRitmo({ ...base, canal: null, personas: 200, goteo: null }), null);
  assert.equal(avisoDeRitmo({ ...base, personas: null, goteo: { minutos: 5 } }), null);
  assert.match(avisoDeRitmo({ ...base, personas: null, goteo: null })!.texto, /^No pude contar a cuántas personas les llega, y no tiene goteo/);
});

test('el canal es el del primer mensaje que le sale, no el del primero del array', () => {
  const pasos = [
    { id: 'tarde', canal: 'email', tipo: 'texto', cuerpo: 'después' },
    { id: 'ini', nodo: 'condicion', si_no: 'dm' },
    { id: 'dm', canal: 'instagram', tipo: 'texto', cuerpo: 'hola', siguiente: 'tarde' },
  ] as unknown as PasoGrafo[];
  // El email está ANTES en el array: con «el primero que haya» saldría email.
  const orden = [pasos[1], pasos[0], pasos[2]];
  assert.equal(canalDelPrimerMensaje(orden), 'instagram');
  assert.equal(canalDelPrimerMensaje([{ id: 'a', nodo: 'condicion' }] as unknown as PasoGrafo[]), null);
});

test('el cableado: el motor cuenta con la misma puerta del barrido, y las cuatro puertas de activar lo dicen', () => {
  const n = leer('lib/nutricion.ts');
  const f = n.slice(n.indexOf('export async function ritmoAlActivar'), n.indexOf('export async function incluirExistentes'));
  assert.match(f, /if \(!barridoInscribe\(vista\) \|\| !barreElDisparador\(vista\)\) continue;/);
  assert.match(f, /await aInscribir\(supabase, vista, candidatos\)/);
  assert.match(leer('app/api/whatsapp/secuencias/route.ts'), /ritmo: await ritmoAlActivar\(id, \{ incluirExistentes: req\.nextUrl\.searchParams\.get\('incluir'\) === '1' \}\)/);
  assert.match(leer('app/automations/SecuenciaPerfil.tsx'), /conExistentes\(\(\) => void conRitmo\(\(\) => void toggle\(\)\)\)/);
  assert.match(leer('app/automations/SimuladorWhatsApp.tsx'), /if \(accion === 'activa' && !j\.activa && rolAdmin && !o\?\.sinRitmo\) \{/);
  assert.match(leer('app/m/automations/AutomationsM.tsx'), /if \(activa && !deshaciendo && !yaAvisado\) \{/);
  assert.match(leer('lib/mako-doer-acciones.ts'), /const ritmo = activa \? await runWithWorkspace\(ws, \(\) => ritmoAlActivar\(secuenciaId\)\)\.catch\(\(\) => null\) : null;/);
});

// ROTURAS (30/10/2026, una por vez, restaurando byte a byte; base 9 / 0): no dice que no tiene goteo → 8 / 1 · sólo tope por día
// cuenta como goteo → 8 / 1 · Instagram con el tope de WhatsApp → 7 / 2 · el tiempo redondea para arriba → 6 / 3 · el tope de la
// línea separa como un goteo → 7 / 2 · avisa con una persona → 8 / 1 · no poder contar calla sin goteo → 8 / 1 · cuenta lo que
// dispara sólo por evento → 8 / 1 · el interruptor, el «⋯», el teléfono o MaKo no lo dicen → 8 / 1 cada uno. «El canal es el del
// primero del array» quedó en verde: el mensaje del flujo era también el primero. Con el orden cambiado se vio un defecto real: un
// flujo que arranca con una condición se cortaba ahí y tomaba el canal del primero del array. Ahora, rota → 8 / 1.
// CON EL DATO REAL (30/10, sólo lectura, 37 pausadas de producción): 9 dirían algo, de 2 a 34 personas.
