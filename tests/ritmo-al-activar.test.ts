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
import { avisoDeRitmo, avisoDeUnaPrendida, canalDelPrimerMensaje, naceConHorario } from '../lib/ritmo-al-activar';
import type { PasoGrafo } from '../lib/flujo-grafo';
import type { HorarioEnvio } from '../lib/horario-envio';
import { crearDesdePlantilla, type DbPlantilla } from '../lib/plantilla-crear';
import { configParaGuardar } from '../lib/config-automatizacion';

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

test('dispara por su evento: sin número, y sin goteo lo dice con el canal; con goteo, o sin evento, nada', () => {
  const ev = { ...base, personas: 0, porEvento: true };
  const ig = avisoDeRitmo({ ...ev, canal: 'instagram', goteo: null })!;
  assert.equal(ig.sinGoteo, true);
  assert.equal(ig.texto, 'No tiene goteo: cuando muchos la disparen, los mensajes de Instagram salen todos juntos.');
  assert.equal(avisoDeRitmo({ ...ev, goteo: null })!.texto, 'No tiene goteo: cuando muchos la disparen, los mensajes de WhatsApp salen juntos, hasta 6 por hora y 40 por día (el tope de tu línea).');
  assert.equal(avisoDeRitmo({ ...ev, canal: 'instagram', goteo: { dia: 20 } })!.texto, 'No tiene goteo: cuando muchos la disparen, los mensajes de Instagram salen juntos, hasta 20 por día.');
  assert.equal(avisoDeRitmo({ ...ev, canal: 'instagram', goteo: { minutos: 5 } }), null);
  assert.equal(avisoDeRitmo({ ...base, canal: 'instagram', personas: 0, goteo: null }), null, 'sin evento y sin nadie, no sale nada');
  // Con gente en el barrido además del evento, manda el número.
  assert.match(avisoDeRitmo({ ...ev, personas: 30, canal: 'instagram', goteo: null })!.texto, /^Entran 30 personas/);
});

test('el primer mensaje queda para aprobar: nunca dice «sale», ni «salen juntos»', () => {
  const a = avisoDeRitmo({ ...base, personas: 200, goteo: null, quedaParaAprobar: true })!;
  assert.equal(a.texto, 'Entran 200 personas. El primer mensaje de WhatsApp no sale solo: queda en Borradores para que lo apruebes (a quien ya pagó le sale directo). No tiene goteo.');
  assert.equal(a.sinGoteo, true);
  assert.match(avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 }, quedaParaAprobar: true })!.texto, /Queda uno cada 5 min\.$/);
  // Sin a quién contar, tampoco advierte de un envío en masa que no va a pasar.
  assert.equal(avisoDeRitmo({ ...base, canal: 'instagram', personas: 0, goteo: null, porEvento: true, quedaParaAprobar: true }), null);
  assert.equal(avisoDeRitmo({ ...base, personas: null, goteo: null, quedaParaAprobar: true }), null);
});

test('el horario: entre qué horas sale; sin horario, con todas las letras y con el botón para ponerlo', () => {
  const H = { activo: true, desde: 9, hasta: 21, dias: [0, 1, 2, 3, 4, 5, 6] } as HorarioEnvio;
  // Tiene: dice entre qué horas, y no pide nada si también tiene goteo.
  const con = avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 }, horario: H })!;
  assert.match(con.texto, /Tarda al menos 4 días\. Sale de 09:00 a 21:00, todos los días\.$/);
  assert.deepEqual([con.poner, con.rotulo], [null, null]);
  // Sin los dos.
  const nada = avisoDeRitmo({ ...base, personas: 200, goteo: null, horario: null })!;
  assert.match(nada.texto, /Tarda al menos 4 días\. Tampoco tiene horario: sale también de noche\.$/);
  assert.deepEqual([nada.poner, nada.rotulo], ['Poner goteo y horario', 'Sin goteo ni horario']);
  // Sin goteo, con horario.
  const sg = avisoDeRitmo({ ...base, personas: 200, goteo: null, horario: H })!;
  assert.match(sg.texto, /Sale de 09:00 a 21:00, todos los días\.$/);
  assert.deepEqual([sg.poner, sg.rotulo], ['Poner goteo', 'Sin goteo']);
  // Con goteo, sin horario: es lo que le pasó a Leila.
  const sh = avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 5 }, horario: null })!;
  assert.match(sh.texto, /Tarda al menos 4 días\. No tiene horario: sale también de noche\.$/);
  assert.deepEqual([sh.poner, sh.rotulo], ['Poner horario', 'Sin horario']);
  // Por evento: con goteo y sin horario también se dice; sin goteo, las dos cosas.
  assert.equal(avisoDeRitmo({ ...base, canal: 'instagram', personas: 0, goteo: { minutos: 5 }, porEvento: true, horario: null })!.texto, 'No tiene horario: sale también de noche.');
  assert.match(avisoDeRitmo({ ...base, canal: 'instagram', personas: 0, goteo: null, porEvento: true, horario: null })!.texto, /salen todos juntos\. Tampoco tiene horario: sale también de noche\.$/);
  // No se pudo leer: no afirma nada. Queda para aprobar: no sale de noche. Sin nada que avisar, no inventa.
  assert.doesNotMatch(avisoDeRitmo({ ...base, personas: 200, goteo: null })!.texto, /horario|Sale de/);
  assert.equal(avisoDeRitmo({ ...base, personas: 200, goteo: null }) !.sinHorario, false);
  assert.doesNotMatch(avisoDeRitmo({ ...base, personas: 200, goteo: null, quedaParaAprobar: true, horario: null })!.texto, /horario/);
  assert.equal(avisoDeRitmo({ ...base, personas: 1, goteo: { minutos: 5 }, horario: null }), null);
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 5 }, porEvento: true, horario: H }), null);
  assert.equal(avisoDeRitmo({ ...base, canal: null, personas: 0, goteo: null, porEvento: true, horario: null }), null);
});

test('el horario de fábrica: sólo las que nacen de ahora en más, y nunca lo que contesta al momento', () => {
  const nueva = { creadaAt: '2026-11-02T10:00:00Z', triggers: ['etapa_actual'], horarioPropio: undefined, delNegocio: null };
  assert.equal(naceConHorario(nueva), true);
  // ⚠️ LAS QUE YA EXISTÍAN NO SE TOCAN, y sin saber cuándo nació, tampoco.
  assert.equal(naceConHorario({ ...nueva, creadaAt: '2026-10-26T15:01:00Z' }), false);
  assert.equal(naceConHorario({ ...nueva, creadaAt: null }), false);
  // Lo que eligió la persona o el negocio manda; también un horario apagado a propósito.
  assert.equal(naceConHorario({ ...nueva, horarioPropio: { activo: false } }), false);
  assert.equal(naceConHorario({ ...nueva, horarioPropio: null }), false);
  assert.equal(naceConHorario({ ...nueva, delNegocio: { activo: true } }), false);
  // Lo que contesta a algo que acaba de hacer la persona no espera a las 9, ni si es uno entre varios CRON.
  for (const t of ['instagram', 'messenger', 'email_recibido']) assert.equal(naceConHorario({ ...nueva, triggers: [t] }), false, t);
  assert.equal(naceConHorario({ ...nueva, triggers: ['etapa_actual', 'instagram'] }), false);
  // Lo que le escribe al equipo o lo manda otro motor, tampoco. Sin CRON no hay nada que decidir.
  for (const t of ['aviso_mako', 'reunion_recordatorio', 'grupo_mako']) assert.equal(naceConHorario({ ...nueva, triggers: [t] }), false, t);
  assert.equal(naceConHorario({ ...nueva, triggers: [] }), false);
  // El cableado: antes de prender, en la única puerta; no poder ponerlo no frena; y el aviso dice el mismo horario.
  const n = leer('lib/nutricion.ts');
  const i = n.indexOf('export async function setSecuenciaActiva');
  const puerta = n.slice(i, n.indexOf("if (error) throw new Error(`setSecuenciaActiva:", i));
  assert.match(puerta, /if \(await leTocaHorarioDeFabrica\(id\)\) \{ const r = await guardarConfigAutomatizacion\(id, \{ horario: HORARIO_SUGERIDO \}\);/);
  assert.ok(puerta.indexOf('leTocaHorarioDeFabrica') < puerta.indexOf(".update({ activa,"), 'antes de prenderla: si no, puede salir algo sin horario');
  assert.match(puerta, /no pude ponerle el horario de fábrica/);
  // La difusión la manda la persona a propósito; se reconoce por su clave.
  assert.match(n, /if \(sec\.clave\.startsWith\(PREFIJO_CLAVE_DIFUSION\)\) return false;/);
  assert.match(n, /import \{ PREFIJO_CLAVE_DIFUSION \} from '@\/lib\/difusion-reglas';/);
  assert.match(n, /\(await leTocaHorarioDeFabrica\(secuenciaId\)\.catch\(\(\) => false\)\) \? HORARIO_SUGERIDO : horarioDeLaAutomatizacion\(config, delNegocio\)/);
});

test('«Prospección: apertura» nace con horario y goteo: la plantilla de escribir en frío no sale de noche ni de a 6 juntos', async () => {
  const db = {
    from: () => ({
      select: () => ({ is: async () => ({ data: [], error: null }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 900 }, error: null }) }) }),
      delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    }),
  } as unknown as DbPlantilla;
  const puestos: Array<[number, unknown]> = [];
  const deps = { db, setPasos: async () => {}, setDisparadores: async () => {} };
  const r = await crearDesdePlantilla('prospeccion-apertura', { ...deps, setConfig: async (id, c) => { puestos.push([id, c]); return { ok: true }; } });
  assert.equal(r.aviso, null);
  assert.equal(puestos.length, 1);
  assert.equal(puestos[0][0], 900);
  const c = puestos[0][1] as { horario: { activo: boolean; desde: number; hasta: number }; goteo: { minutos: number; dia: number } };
  assert.deepEqual([c.horario.activo, c.horario.desde, c.horario.hasta], [true, 9, 21]);
  assert.deepEqual(c.goteo, { minutos: 10, dia: 30 });
  assert.equal(configParaGuardar({}, c).ok, true, 'lo que trae la plantilla pasa por el mismo saneador que la pantalla');
  // No poder ponerlo se dice, no se calla; y una que no trae ritmo no escribe nada.
  assert.match((await crearDesdePlantilla('prospeccion-apertura', { ...deps, setConfig: async () => ({ ok: false }) })).aviso!, /No pude ponerle horario y goteo/);
  assert.match((await crearDesdePlantilla('prospeccion-apertura', { ...deps, setConfig: async () => { throw new Error('x'); } })).aviso!, /No pude ponerle horario y goteo/);
  assert.match((await crearDesdePlantilla('prospeccion-apertura', deps)).aviso!, /No pude ponerle horario y goteo/, 'un llamador que no lo enchufa no la deja nacer callada');
  const antes = puestos.length;
  await crearDesdePlantilla('lead-agendo', { ...deps, setConfig: async (id, x) => { puestos.push([id, x]); return { ok: true }; } });
  assert.equal(puestos.length, antes);
  assert.match(leer('app/api/chat-agent/secuencias/route.ts'), /setConfig: guardarConfigAutomatizacion,/);
  assert.match(leer('lib/api-mako/areas/chatbot.run.ts'), /setConfig: guardarConfigAutomatizacion,/);
  assert.match(leer('lib/sugerencias-crm-server.ts'), /setConfig: guardarConfigAutomatizacion,/);
});

test('una ya prendida: la misma frase, en su pantalla y en su tarjeta; nunca le toca el goteo', () => {
  const ig = [{ id: 'dm', canal: 'instagram', tipo: 'texto', cuerpo: 'hola' }] as unknown as PasoGrafo[];
  const de = { pasos: ig, triggers: ['instagram'], envioAutomatico: false, topes: TOPES };
  assert.deepEqual(avisoDeUnaPrendida({ ...de, goteo: null }), { texto: 'No tiene goteo: cuando muchos la disparen, los mensajes de Instagram salen todos juntos.', rotulo: 'Sin goteo' });
  assert.deepEqual(avisoDeUnaPrendida({ ...de, goteo: { minutos: 5 }, horario: null }), { texto: 'No tiene horario: sale también de noche.', rotulo: 'Sin horario' });
  assert.equal(avisoDeUnaPrendida({ ...de, goteo: null, horario: null })?.rotulo, 'Sin goteo ni horario');
  assert.equal(avisoDeUnaPrendida({ ...de, goteo: { minutos: 5 } }), null, 'con goteo no hay nada que decir');
  assert.equal(avisoDeUnaPrendida({ ...de, triggers: ['aviso_mako'], goteo: null }), null, 'le escribe al equipo, no a leads');
  assert.equal(avisoDeUnaPrendida({ ...de, triggers: ['grupo_mako'], goteo: null }), null);
  assert.equal(avisoDeUnaPrendida({ ...de, pasos: [{ id: 'c', nodo: 'condicion' }] as unknown as PasoGrafo[], goteo: null }), null, 'sin mensajes');
  // Lo que escribe la IA y no sale solo queda para aprobar: no se va de golpe.
  const ia = [{ id: 'dm', canal: 'instagram', tipo: 'ia', cuerpo: 'x' }] as unknown as PasoGrafo[];
  assert.equal(avisoDeUnaPrendida({ ...de, pasos: ia, goteo: null }), null);
  assert.match(avisoDeUnaPrendida({ ...de, pasos: ia, envioAutomatico: true, goteo: null })!.texto, /^No tiene goteo/);
});

test('el cableado de las prendidas: se muestra sólo si está prendida, y sin poder leer no afirma nada', () => {
  const n = leer('lib/nutricion.ts');
  assert.match(n, /console\.error\(`\[nutricion\] los avisos de ritmo: \$\{e instanceof Error \? e\.message : String\(e\)\}`\);\n\s+out\.clear\(\);/);
  assert.match(leer('lib/setting-secuencias.ts'), /aviso_ritmo: avisosRitmo\.get\(s\.id\) \?\? null,/);
  const p = leer('app/automations/SecuenciaPerfil.tsx');
  assert.match(p, /\{activa && secuencia\.aviso_ritmo && \(/, 'lo ve quien ve la automatización, como en el teléfono');
  assert.match(p, /disabled=\{!rolAdmin \|\| !Configuraciones\}/, 'ponerlo, sólo el admin');
  assert.match(p, /alCerrarConfig\.current = \(\) => \{ if \(secuencia\.aviso_ritmo\) onCambio\(\); \};/, 'al ponerle goteo u horario, el aviso se va');
  assert.match(leer('app/automations/SimuladorWhatsApp.tsx'), /aviso=\{j\.activa \? j\.aviso_ritmo \?\? undefined : undefined\}/);
  const m = leer('app/m/automations/AutomationsM.tsx');
  assert.match(m, /e\.activa && x\.avisoRitmo \? <PildoraM tono="warn">\{x\.avisoRitmo\.rotulo\}<\/PildoraM>/);
  assert.match(m, /\{a\?\.avisoRitmo && v\?\.activa && </);
  // Avisar no es cambiar: nada de esto escribe la configuración de una automatización.
  const f = n.slice(n.indexOf('export async function avisosDeRitmo'), n.indexOf('export async function incluirExistentes'));
  assert.doesNotMatch(f, /guardarConfigAutomatizacion|\.update\(|\.upsert\(|\.insert\(/);
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
  assert.match(f, /porEvento: vistasPorDisparador\(sec\)\.some\(\(v\) => TRIGGERS_SOLO_EVENTO\.has\(v\.trigger_tipo\) && v\.trigger_tipo !== TRIGGER_AVISO_MAKO\)/);
  assert.match(f, /quedaParaAprobar: primeroQuedaParaAprobar\(sec\.pasos, sec\.envio_automatico\)/);
  assert.match(leer('app/automations/SimuladorWhatsApp.tsx'), /if \(a\.poner\) setConfigDe\(\{ id: a\.j\.id, nombre: a\.j\.nombre \}\);/);
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
// Por evento y para aprobar (base 11 / 0): una por evento vuelve a callar, avisa con goteo, avisa lo que queda para aprobar, lo que queda
// para aprobar dice que sale, no poder contar dice «salen juntos» aunque se apruebe, el aviso de MaKo cuenta como evento, el motor no
// le pasa lo de aprobar, el «⋯» no ofrece poner goteo → 10 / 1 cada una.
// Las prendidas, el horario y la plantilla (base 15 / 0), 23 roturas, todas en rojo, una por vez: no dice que falta el horario, lo dice si
// queda para aprobar, toma «no se pudo leer» como «no tiene» (5 / 10), no dice entre qué horas, no ofrece ponerlo, el rótulo no lo dice, por
// evento con goteo calla, la plantilla nace sin ritmo, no poder ponerlo se calla o tumba la creación, la ruta, la API o las sugerencias no lo
// enchufan, la prendida no avisa o avisa las del equipo, un error afirma a medias, el motor escribe al avisar, la pantalla lo muestra
// pausada o lo esconde a quien no es admin, ponerle goteo no relee, la tarjeta o el teléfono lo esconden, «Poner…» no abre Configuraciones.
// El horario de fábrica (base 16 / 0): toca a las que ya existían, pisa un horario propio o el del negocio, un DM o el aviso del equipo espera,
// la puerta no lo pone, el aviso no lo dice, la difusión lo toma → 15 / 1 cada una.
// CON EL DATO REAL (30/10, sólo lectura): de 37 pausadas de producción, 11 dirían algo (9 con número, de 2 a 34 personas; 2 de Instagram
// sin número). Las 7 activas de Instagram tampoco tienen goteo. Ninguna de las medidas queda para aprobar: ese texto no se vio con un caso real.
