// =============================================================================
// La DIFUSIÓN desde el CRM (28/10/2026, pedido de Martín por Leila): un mensaje a muchos, como una automatización de una vez
// =============================================================================
// Fija:
//   · a quién le llega por cada canal y quién queda afuera y por qué (`alcanceDe`), con la MISMA decisión que el envío;
//   · el flujo: un hilo POR CANAL desde la tarjeta de inicio, cada uno con su condición (en un flujo lineal, el canal que
//     falta cerraba la inscripción entera y el resto no salía), y que pasa la validación del lienzo;
//   · lo que le falta para mandarse, el goteo en rango y el nombre;
//   · el server (leyendo el fuente): crea A MANO, guarda el goteo de ESTA automatización, la prende por la puerta de siempre,
//     borra la fila si algo falla antes de inscribir, y a la hoja no le viajan teléfonos ni emails.
// Correr: node --import tsx --test tests/difusion.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  alcanceDe, alcanceDeMotivos, motivosDe, pasosDeDifusion, problemaDeDifusion, nombreDeDifusion, textoDeDuracion, goteoValido,
  type LeadDifusion,
} from '../lib/difusion-reglas';
import { validarGrafo, normalizar, type PasoGrafo } from '../lib/flujo-grafo';

const leer = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const AHORA = Date.parse('2026-10-28T15:00:00Z');
const hace = (min: number) => new Date(AHORA - min * 60_000).toISOString();
const IG = (o: Partial<NonNullable<LeadDifusion['instagram']>> = {}): NonNullable<LeadDifusion['instagram']> => ({
  conversacionId: 'conv1', cuentaId: 'acc', ventanaExpiraAt: new Date(AHORA + 3600_000).toISOString(),
  comentarioId: null, comentarioPostId: null, comentarioAt: null, comentarioRespondidoAt: null, ...o,
});
const L = (id: number, o: Partial<LeadDifusion> = {}): LeadDifusion => ({ id, nombre: `L${id}`, telefono: '+5491122334455', email: `l${id}@x.com`, emailBaja: false, instagram: null, ...o });

test('a quién le llega por cada canal, y quién queda afuera y por qué', () => {
  const leads = [
    L(1),
    L(2, { telefono: null }),
    L(3, { telefono: 'abc', email: null }),
    L(4, { emailBaja: true, instagram: IG() }),
    L(5, { instagram: IG({ ventanaExpiraAt: hace(60) }) }),
    L(6, { telefono: null, email: null }),
  ];
  const a = alcanceDe(leads, ['whatsapp', 'email', 'instagram'], AHORA);
  const fila = (c: string) => a.porCanal.find((p) => p.canal === c)!;
  assert.equal(fila('whatsapp').llegan, 3);
  assert.deepEqual(fila('whatsapp').afuera.sort((x, y) => x.motivo.localeCompare(y.motivo)), [{ motivo: 'sin_telefono', cuantos: 2 }, { motivo: 'telefono_invalido', cuantos: 1 }]);
  assert.equal(fila('email').llegan, 3);
  assert.ok(fila('email').afuera.some((x) => x.motivo === 'email_baja' && x.cuantos === 1));
  assert.equal(fila('instagram').llegan, 1, 'sólo el de la ventana abierta');
  assert.ok(fila('instagram').afuera.some((x) => x.motivo === 'instagram_ventana' && x.cuantos === 1));
  // El 3 (teléfono inválido y sin email) y el 6 (nada) no tienen ningún canal: no se inscriben.
  assert.deepEqual(a.ids, [1, 2, 4, 5]);
  assert.equal(a.ninguno, 2);
  // Sólo email: el 3 (sin email) y el 4 (de baja) quedan afuera.
  assert.deepEqual(alcanceDe(leads, ['email'], AHORA).ids, [1, 2, 5]);
  // Lo que viaja a la hoja no lleva teléfono ni email, y da lo mismo.
  const motivos = leads.map((l) => motivosDe(l, AHORA));
  assert.ok(!JSON.stringify(motivos).includes('@x.com') && !JSON.stringify(motivos).includes('5491122334455'));
  assert.deepEqual(alcanceDeMotivos(motivos, ['whatsapp', 'email', 'instagram']), a);
  assert.equal(alcanceDe(leads, [], AHORA).llegan, 0);
});

test('el flujo: un hilo por canal desde el inicio, cada uno con su condición, y pasa la validación del lienzo', () => {
  const pasos = pasosDeDifusion(['email', 'whatsapp', 'instagram'], {
    whatsapp: { cuerpo: 'Hola {{nombre}}' }, email: { asunto: 'Novedades', cuerpo: 'Hola' }, instagram: { cuerpo: 'Hola por acá' },
  });
  const inicio = pasos.find((p) => p.nodo === 'inicio')!;
  // El orden es el del catálogo (WhatsApp, email, Instagram), no el del clic.
  assert.equal(inicio.siguiente, 'd_c_whatsapp');
  assert.deepEqual((inicio as { paralelos?: string[] }).paralelos, ['d_c_email', 'd_c_instagram']);
  const cond = (id: string) => pasos.find((p) => p.id === id) as PasoGrafo & { ramas: Array<{ filas: Array<{ campo: string; no?: boolean }>; siguiente: string }>; si_no: string | null };
  assert.deepEqual(cond('d_c_whatsapp').ramas[0].filas.map((f) => f.campo), ['tiene_telefono']);
  assert.deepEqual(cond('d_c_email').ramas[0].filas.map((f) => [f.campo, !!f.no]), [['tiene_email', false], ['email_baja', true]]);
  assert.deepEqual(cond('d_c_instagram').ramas[0].filas.map((f) => f.campo), ['tiene_instagram']);
  for (const c of ['whatsapp', 'email', 'instagram']) {
    assert.equal(cond(`d_c_${c}`).ramas[0].siguiente, `d_${c}`);
    assert.equal(cond(`d_c_${c}`).si_no, null, 'sin el canal, ESE hilo termina: los otros siguen');
    const m = pasos.find((p) => p.id === `d_${c}`) as PasoGrafo & { revisar?: boolean; proveedor?: string };
    assert.equal(m.canal, c);
    assert.equal(m.revisar, false, 'una difusión sale sola: la persona ya la escribió y la confirmó');
    assert.equal(m.siguiente, null);
  }
  assert.equal((pasos.find((p) => p.id === 'd_whatsapp') as { proveedor?: string }).proveedor, 'no_oficial', 'el oficial hoy no manda');
  assert.equal(pasos.find((p) => p.id === 'd_email')!.asunto, 'Novedades');
  assert.deepEqual(validarGrafo(normalizar(pasos)), [], 'el lienzo la acepta');
  // Un solo canal: el inicio sin paralelos.
  const solo = pasosDeDifusion(['email'], { email: { asunto: 'a', cuerpo: 'b' } });
  assert.deepEqual((solo.find((p) => p.nodo === 'inicio') as { paralelos?: string[] }).paralelos, []);
  assert.deepEqual(validarGrafo(normalizar(solo)), []);
  // Los varios mensajes de una tarjeta pasan tal cual.
  const partes = [{ tipo: 'texto', cuerpo: 'uno' }, { tipo: 'texto', cuerpo: 'dos' }];
  assert.deepEqual((pasosDeDifusion(['whatsapp'], { whatsapp: { cuerpo: 'uno', partes } }).find((p) => p.id === 'd_whatsapp') as { partes?: unknown }).partes, partes);
});

test('lo que le falta para mandarse, el nombre y cuánto tarda', () => {
  const llegan = { llegan: 10 };
  assert.equal(problemaDeDifusion({ canales: [], mensajes: {}, alcance: llegan }), 'Elige al menos un canal');
  assert.equal(problemaDeDifusion({ canales: ['whatsapp'], mensajes: { whatsapp: { cuerpo: '  ' } }, alcance: llegan }), 'Falta el mensaje de WhatsApp');
  assert.equal(problemaDeDifusion({ canales: ['email'], mensajes: { email: { asunto: '', cuerpo: 'x' } }, alcance: llegan }), 'Falta el asunto del email');
  assert.equal(problemaDeDifusion({ canales: ['instagram'], mensajes: { instagram: { cuerpo: 'x' } }, alcance: { llegan: 0 } }), 'A ninguno le llega por los canales elegidos');
  assert.equal(problemaDeDifusion({ canales: ['instagram'], mensajes: { instagram: { cuerpo: 'x' } }, alcance: llegan }), null);
  assert.equal(nombreDeDifusion({ etapa: 'Contacto nuevo', leads: 394, fecha: '28/10' }), 'Difusión · Contacto nuevo · 28/10');
  assert.equal(nombreDeDifusion({ etapa: null, leads: 1, fecha: '28/10' }), 'Difusión · 1 lead · 28/10');
  assert.equal(textoDeDuracion(10, { minutos: 3, dia: 40 }), 'sale todo en 27 min');
  assert.equal(textoDeDuracion(394, { minutos: 3, dia: 40 }), 'tarda unos 10 días (hasta 40 por día)');
});

test('el server y la hoja (leyendo el fuente)', () => {
  assert.deepEqual(goteoValido({ minutos: 3, dia: 40 }), { minutos: 3, dia: 40 });
  assert.equal(goteoValido({ minutos: 0, dia: 40 }), null, 'fuera de rango se dice, no se guarda callado');
  assert.equal(goteoValido({ minutos: 3, dia: 100000 }), null);
  const s = sinComentarios(leer('lib/difusion.ts'));
  assert.match(s, /const fila = await crearSecuenciaVacia\(nombre\);/, 'A mano: sin cohorte, sólo entran los de acá');
  assert.match(s, /await guardarConfigAutomatizacion\(fila\.id, \{ goteo \}\);/, 'el goteo es de ESTA automatización');
  assert.match(s, /await setSecuenciaReentrada\(fila\.id, 'una_vez'\);/);
  assert.match(s, /await setSecuenciaActiva\(fila\.id, true, \{ aunqueDuplique: true, ws \}\);/, 'la prende por la puerta de siempre (el tope del plan)');
  assert.match(s, /\} catch \(e\) \{\s*await db\.from\('nutricion_secuencias'\)\.delete\(\)\.eq\('id', fila\.id\)/, 'lo que falla antes de inscribir no deja una fila a medias');
  assert.ok(s.indexOf("from('nutricion_inscripciones').insert(") > s.indexOf('setSecuenciaActiva(fila.id'), 'inscribe DESPUÉS de prenderla');
  assert.match(s, /const vista = await prepararDifusion\(ws, p\.seleccion, canales\);/, 'vuelve a leer a quién le llega: no confía en la hoja');
  assert.match(s, /return \{ etapa, cortado, whatsappQr, alcance: alcanceDeMotivos\(porLead, usables\), porLead \};/, 'a la hoja no le viajan teléfonos ni emails');
  const a = sinComentarios(leer('app/automations/difusion/actions.ts'));
  assert.equal((a.match(/if \(rol !== 'admin'\) return \{ ok: false/g) ?? []).length, 2, 'las dos puertas, sólo el admin');
  const h = sinComentarios(leer('app/automations/difusion/HojaDifusion.tsx'));
  assert.match(h, /export function HojaDifusion\(\{ abierta, seleccion, onCerrar, onCreada \}: PropsHojaDifusion\)/);
  assert.match(h, /<EditorMensajeWhatsApp /, 'la MISMA tarjeta de WhatsApp');
  assert.match(h, /<EditorEmailGmail /);
  assert.match(h, /<EditorMensajeSocial paso=\{ig\} canal="instagram"/);
  assert.match(h, /\{AVISO_QR\}/, 'el aviso del QR');
});
