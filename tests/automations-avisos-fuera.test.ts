// =============================================================================
// «MaKo en WhatsApp» fuera del horario: lo decide la TARJETA, y de fábrica espera a que abra (15/10/2026)
// =============================================================================
// Martín, mirando el lienzo con un cliente: «Quiero que se pueda configurar que te mande el mensaje luego, cuando se
// "abra" la oficina. Y por defecto si esta configurado horario de oficina que esté eso. Piensa bien en donde poner eso».
//
// Hasta el 14/10 el aviso al equipo salía a cualquier hora (una regla escondida del motor); el 14/10 pasó a una casilla
// de Configuraciones › Horario («Los avisos al equipo salen igual», prendida de fábrica). Ahora vive EN la tarjeta,
// donde se piensa ese envío: «Fuera del horario: Espera a que abra / Lo manda igual», de fábrica ESPERA, y vale en los
// DOS runners (el de los leads y el de los eventos, que hasta hoy ni miraba el horario). El carril del recordatorio de la
// reunión sale siempre. Medido el 15/10 en prod: sólo el ws1 tiene horario, y nadie había guardado la casilla.
//
// Se fija lo puro con números y el motor sobre el FUENTE sin comentarios. PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esperaQueAbra, paramsDeMako, paramsConPartes, chipDeEspera } from '../lib/mako-tarjeta';
import { pasosDelEvento, esperaApertura } from '../lib/aviso-evento';
import type { Paso } from '../lib/flujos-tipos';
import type { PasoGrafo } from '../lib/flujo-grafo';
import type { DiaSemana } from '../lib/horario-envio';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('la tarjeta: de fábrica espera; «Lo manda igual» se guarda, y editar el texto no lo borra', () => {
  assert.equal(esperaQueAbra({}), true);
  assert.equal(esperaQueAbra(undefined), true);
  assert.equal(esperaQueAbra({ fueraDeHorario: 'espera' }), true);
  assert.equal(esperaQueAbra({ fueraDeHorario: 'igual' }), false);
  const igual = paramsDeMako({ mensaje: 'Hola' }, { fueraDeHorario: 'igual' });
  assert.equal(igual.fueraDeHorario, 'igual');
  // Cambiar el texto pasa por `paramsConPartes`, que antes conservaba sólo leadId y título.
  assert.equal(paramsDeMako(igual, { cuerpo: 'Otro texto' }).fueraDeHorario, 'igual', 'editar el texto borró «Lo manda igual»');
  assert.equal(paramsConPartes({ fueraDeHorario: 'cualquiera' }, []).fueraDeHorario, undefined, 'un valor que no existe se guardó');
});

test('el chip dice cuándo sale, y sólo si AHORA esperaría', () => {
  const tz = 'America/Tijuana';
  const h = { activo: true, desde: 9, hasta: 21, dias: [0, 1, 2, 3, 4, 5, 6] as DiaSemana[] };
  const noche = Date.parse('2026-10-15T06:30:00Z'); // 23:30, Tijuana
  assert.equal(chipDeEspera({}, h, tz, noche), 'Espera a que abra (mañana 9:00)');
  assert.equal(chipDeEspera({ fueraDeHorario: 'igual' }, h, tz, noche), null, 'la que sale igual no espera');
  assert.equal(chipDeEspera({}, h, tz, Date.parse('2026-10-15T18:00:00Z')), null, 'abierto: sale ahora');
  assert.equal(chipDeEspera({}, null, tz, noche), null, 'sin horario no hay nada que esperar');
});

test('el runner de los LEADS: fuera del horario corre el carril y la tarjeta que dice «Lo manda igual»; nada más', () => {
  const nutri = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(nutri, /const sigueIgual = \(p: PasoGrafo \| undefined\): boolean => esTarjetaMako\(p\) && !esperaQueAbra\(/);
  assert.match(nutri, /const corrensFuera = secuencias\.filter\(\(s\) => tieneCarril\(s\.pasos\) \|\| s\.pasos\.some\(sigueIgual\)\)/);
  assert.match(nutri, /fueraDeHorario != null\s*\? esHiloDelCarril\(sec\.pasos, i\) \|\| sigueIgual\(sec\.pasos\[i\]\)/);
  assert.doesNotMatch(nutri, /makoFueraDeHorario|avisosAlEquipo/, 'volvió la casilla global');
});

// Las piezas del lienzo para el runner de los EVENTOS.
const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' } as const;
const mako = (id: string, extra: Record<string, unknown>, siguiente: string | null): PasoGrafo =>
  ({ ...RELLENO, id, siguiente, accion: { operacion: 'avisar_al_equipo', params: { mensaje: 'Entró un pago', ...extra } } }) as PasoGrafo;

test('el runner de los EVENTOS: la tarjeta lleva lo suyo, y la CONDITION espera con ella (se decide al salir)', () => {
  const espera = pasosDelEvento([mako('m1', {}, null)], 'pago_recibido');
  assert.equal(espera.problema, null);
  assert.equal((espera.pasos[0] as { saleIgual?: true }).saleIgual, undefined, 'de fábrica espera');
  const igual = pasosDelEvento([mako('m1', { fueraDeHorario: 'igual' }, null)], 'pago_recibido');
  assert.equal((igual.pasos[0] as { saleIgual?: true }).saleIgual, true);
  const cond = { tipo: 'condicion', rama: { id: 'r', modo: 'todas', filas: [], siguiente: null } } as unknown as Paso;
  const aviso = { tipo: 'mensaje', canal: 'aviso_dueno', texto: 'x' } as Paso;
  const avisoIgual = { tipo: 'mensaje', canal: 'aviso_dueno', texto: 'x', saleIgual: true } as Paso;
  const delay = { tipo: 'esperar', horas: 1 } as Paso;
  assert.equal(esperaApertura([aviso], 0), true);
  assert.equal(esperaApertura([avisoIgual], 0), false);
  assert.equal(esperaApertura([cond, cond, aviso], 0), true, 'la CONDITION de arriba se decidía de noche');
  assert.equal(esperaApertura([cond, avisoIgual], 0), false);
  assert.equal(esperaApertura([cond, delay, aviso], 0), false, 'con un DELAY en el medio, el DELAY duerme solo');
  assert.equal(esperaApertura([{ tipo: 'email_persona', asunto: 'a', texto: 'b', proposito: 'restablecer' } as Paso], 0), false, 'el link de restablecer no espera');
});

test('el runner de los EVENTOS duerme en ESE paso hasta que abre, con el contexto entero', () => {
  const flujos = sinComentarios(leer('lib/flujos.ts'));
  const i = flujos.indexOf('export async function ejecutarPasos(');
  const cuerpo = flujos.slice(i, flujos.indexOf('\n}\n', i));
  const orden = [cuerpo.indexOf('if (esperaApertura(pasos, i)) {'), cuerpo.indexOf("if (pasos[i]?.tipo === 'condicion' && hechos === undefined)")];
  assert.ok(orden[0] > 0 && orden[0] < orden[1], 'la condición se decide antes de mirar el horario');
  assert.match(cuerpo, /if \(corridaId\) await avanzar\(ws, corridaId, i, i, hasta, ctx\);\n\s*else await abrirCorrida\(ws, flujoId, i, hasta, ctx, \{ reintento: true \}\);\n\s*return;/);
  assert.match(cuerpo, /apertura === 'ilegible' \? new Date\(Date\.now\(\) \+ REINTENTO_HORARIO_MS\)/, '«no sé» mandaba igual');
});

test('la pantalla: el control en la tarjeta (sólo con horario), su chip en el lienzo, y la casilla global se fue', () => {
  const panel = sinComentarios(leer('app/configuraciones/HorarioEnvioPanel.tsx'));
  assert.doesNotMatch(panel, /avisosAlEquipo|Los avisos al equipo salen igual/);
  const lienzo = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
  assert.match(lienzo, /const campoFuera = oficina\?\.horario \? \(/);
  assert.match(lienzo, /\{espera && <ChipEspera nodo=\{n\} texto=\{espera\} \/>\}/);
  assert.match(sinComentarios(leer('lib/api-mako/areas/chatbot.def.ts')), /nombre: 'fueraDeHorario', tipo: 'string', enum: \['espera', 'igual'\]/);
});

// ── ROTURAS (15/10/2026) ────────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo y tests/horario-envio.test.ts, restaura DE MEMORIA; nunca
// git). Base: 16 / 0. Rompiendo: de fábrica sale igual → 13 / 3 · editar el texto borra lo elegido → 15 / 1 · el chip con
// la oficina abierta → 15 / 1 · la próxima apertura en horas fijas → 15 / 1 · «mañana» contado como «hoy» → 14 / 2 · el
// motor de leads mandando todo MaKo de noche → 15 / 1 · el evento sin lo de la tarjeta → 15 / 1 · la CONDITION decidida de
// noche → 15 / 1 · el runner de eventos sin mirar el horario → 15 / 1 · «no sé» mandando igual → 15 / 1. Restaurado: 16 / 0.
