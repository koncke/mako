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
  demoraDelTurno, claveDeDifusion, leerMarcaDifusion, decidirRepetida, ESPERA_DIFUSION_EN_CURSO_MIN, VENTANA_DIFUSION_REPETIDA_MIN,
  PREFIJO_CLAVE_DIFUSION, ESTADOS_DIFUSION_EN_CURSO,
  type LeadDifusion,
} from '../lib/difusion-reglas';
import { decidirSalida, salidaHastaMs } from '../lib/canal-social';
import { RANGOS_GOTEO } from '../lib/config-automatizacion';
import { porId } from '../lib/api-mako/registro';
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
  assert.match(s, /const fila = await crearSecuenciaVacia\(nombre, \{ prefijoClave: PREFIJO_CLAVE_DIFUSION \}\);/, 'A mano: sin cohorte, sólo entran los de acá; y marcada en la clave');
  assert.match(s, /await guardarConfigAutomatizacion\(fila\.id, \{ goteo \}\);/, 'el goteo es de ESTA automatización');
  assert.match(s, /await setSecuenciaReentrada\(fila\.id, 'una_vez'\);/);
  assert.match(s, /await setSecuenciaActiva\(fila\.id, true, \{ aunqueDuplique: true, ws \}\);/, 'la prende por la puerta de siempre (el tope del plan)');
  assert.match(s, /\} catch \(e\) \{\s*await db\.from\('nutricion_secuencias'\)\.delete\(\)\.eq\('id', fila\.id\)/, 'lo que falla antes de inscribir no deja una fila a medias');
  const crear = s.slice(s.indexOf('export async function crearDifusion('));
  assert.ok(crear.indexOf('await inscribirEnDifusion(fila.id, vista.alcance.ids)') > crear.indexOf('setSecuenciaActiva(fila.id'), 'inscribe DESPUÉS de prenderla');
  assert.match(s, /const vista = await prepararDifusion\(ws, p\.seleccion, canales, goteo\);/, 'vuelve a leer a quién le llega (con SU goteo): no confía en la hoja');
  assert.match(s, /return \{ etapa, cortado, whatsappQr, lineaWaDia: limites === 'ilegible' \? null : limites\.wa\.dia, alcance: alcanceDeMotivos\(porLead, usables, \{ goteo, ahoraMs: ahora \}\), porLead \};/, 'a la hoja no le viajan teléfonos ni emails');
  const a = sinComentarios(leer('app/automations/difusion/actions.ts'));
  assert.equal((a.match(/if \(rol !== 'admin'\) return \{ ok: false/g) ?? []).length, 2, 'las dos puertas, sólo el admin');
  const h = sinComentarios(leer('app/automations/difusion/HojaDifusion.tsx'));
  assert.match(h, /export function HojaDifusion\(\{ abierta, seleccion, onCerrar, onCreada \}: PropsHojaDifusion\)/);
  assert.match(h, /<EditorMensajeWhatsApp /, 'la MISMA tarjeta de WhatsApp');
  assert.match(h, /<EditorEmailGmail /);
  assert.match(h, /<EditorMensajeSocial paso=\{ig\} canal="instagram"/);
  assert.match(h, /\{AVISO_QR\}/, 'el aviso del QR');
});

// Martín, 2/11/2026: «que se vea lindo, con el formato de cada red social, como lo tenemos en Automations».
test('el modal de la difusión: un canal a la vista, sin perder lo escrito en los otros', () => {
  const h = sinComentarios(leer('app/automations/difusion/HojaDifusion.tsx'));
  assert.match(h, /<Modal ancho=\{1040\}/, 'el modal de la casa: Escape, el foco y la pila son suyos');
  assert.match(h, /display: visible \? 'flex' : 'none'/, 'el canal que no se ve sigue montado: lo que quedó en su barra no se pierde');
  assert.match(h, /const activo = viendo && canales\.includes\(viendo\) \? viendo : CANALES_DIFUSION\.find\(\(c\) => canales\.includes\(c\)\) \?\? null;/, 'apagar el que se ve no deja el panel vacío');
  assert.match(h, /onClick=\{\(\) => \{ if \(on\) setViendo\(c\); else alternar\(c\); \}\}/, 'tocar una fila apagada la prende');
  assert.match(h, /problemaDeDifusion\(\{ canales: \[c\], mensajes, alcance: \{ llegan: 1 \} \}\)/, 'el ✓ mide el mensaje de ESE canal, no el alcance');
  assert.doesNotMatch(h, /CabeceraWhatsApp|CabeceraSocialPanel|SalidaWhatsApp/, 'elegir número o cuenta mentiría: la difusión no los guarda');
  assert.doesNotMatch(h, /SvcIcon/, 'pinta con un símbolo que el CRM no monta: un cuadrado liso');
});

// =============================================================================
// La verificación del Cerebro sobre 69b49a31c (29/10/2026): tres medias y una baja de la difusión.
// =============================================================================

test('salidaHastaMs es decidirSalida en el tiempo: hay vía si y sólo si es antes de ese instante', () => {
  const casos = [
    IG(), IG({ ventanaExpiraAt: hace(5) }), IG({ conversacionId: null }), IG({ cuentaId: null }),
    IG({ ventanaExpiraAt: hace(60), comentarioId: 'k1', comentarioPostId: 'p1', comentarioAt: hace(60) }),
    IG({ ventanaExpiraAt: new Date(AHORA + 9 * 86_400_000).toISOString(), comentarioId: 'k1', comentarioPostId: 'p1', comentarioAt: hace(60) }),
    IG({ comentarioId: 'k1', comentarioPostId: 'p1', comentarioAt: hace(60), comentarioRespondidoAt: hace(30) }),
    IG({ comentarioId: 'k1', comentarioPostId: null, comentarioAt: hace(60) }),
    null,
  ];
  for (const [i, c] of casos.entries()) {
    const hasta = salidaHastaMs(c);
    for (const dt of [-86_400_000, 0, 1, 3600_000, 86_400_000, 6.9 * 86_400_000, 7 * 86_400_000, 10 * 86_400_000]) {
      const t = AHORA + dt;
      assert.equal(decidirSalida(c, t).via !== null, hasta != null && t < hasta, `caso ${i}, +${dt / 3600_000} h`);
    }
  }
});

// [media] La hoja prometía «le llega a 100» por Instagram con 40 por día, y a los 60 de después se les cerraba la ventana de
// 24 h antes de su turno (el envío los daba por fallo). Reproducción del verificador: ventanas que vencen parejo en 24 h.
test('Instagram con goteo: promete sólo a los que el goteo alcanza antes de su ventana; el que sólo tenía Instagram no se inscribe', () => {
  const DIA = 86_400_000;
  const leads = Array.from({ length: 100 }, (_, i) => L(i + 1, { telefono: null, email: null, instagram: IG({ ventanaExpiraAt: new Date(AHORA + (i + 1) * DIA / 100).toISOString() }) }));
  const ig = (g: { minutos: number; dia: number }) => alcanceDe(leads, ['instagram'], AHORA, g);
  const con40 = ig({ minutos: 3, dia: 40 });
  assert.equal(con40.porCanal[0].llegan, 40, 'los 40 del primer día');
  assert.deepEqual(con40.porCanal[0].afuera, [{ motivo: 'instagram_turno', cuantos: 60 }]);
  assert.deepEqual(con40.ids, leads.slice(0, 40).map((l) => l.id), 'a los otros 60 sólo les llegaba Instagram: no se inscriben para fallar');
  assert.equal(ig({ minutos: 3, dia: 500 }).porCanal[0].llegan, 100, 'con el tope arriba les llega a todos');
  assert.equal(alcanceDe(leads, ['instagram'], AHORA).porCanal[0].llegan, 100, 'sin goteo, como antes (la ventana de ahora)');
  // Con otro canal, sigue inscripto: le llega por ése.
  const conWa = leads.map((l) => ({ ...l, telefono: '+5491122334455' }));
  assert.equal(alcanceDe(conWa, ['whatsapp', 'instagram'], AHORA, { minutos: 3, dia: 40 }).ids.length, 100);
  // Por comentario (la respuesta privada, 7 días), los 200 entran con 40 por día: el último sale el 5º día.
  const comentaron = Array.from({ length: 200 }, (_, i) => L(i + 1, { telefono: null, email: null, instagram: IG({ conversacionId: null, ventanaExpiraAt: null, comentarioId: `k${i}`, comentarioPostId: 'p', comentarioAt: hace(60) }) }));
  assert.equal(alcanceDe(comentaron, ['instagram'], AHORA, { minutos: 3, dia: 40 }).porCanal[0].llegan, 200);
  // El turno: de a uno cada `minutos`, y cumplido el tope del día, 24 h después del primero (`frenoDeGoteo`).
  assert.equal(demoraDelTurno(0, { minutos: 3, dia: 40 }), 0);
  assert.equal(demoraDelTurno(39, { minutos: 3, dia: 40 }), 117 * 60_000);
  assert.equal(demoraDelTurno(40, { minutos: 3, dia: 40 }), DIA);
  // La hoja lo cuenta con SU goteo, desde que leyó; MaKo y el server, con el pedido.
  const h = sinComentarios(leer('app/automations/difusion/HojaDifusion.tsx'));
  assert.match(h, /const ritmo = useMemo\(\(\) => \(goteoOk && leidaAt \? \{ goteo, ahoraMs: leidaAt \} : undefined\), \[goteoOk, goteo, leidaAt\]\);/);
  assert.match(h, /alcanceDeMotivos\(vista\.porLead, canales, ritmo\)/);
  assert.match(h, /alcanceDeMotivos\(vista\.porLead, \[c\], ritmo\)/);
  assert.match(sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts')), /const v = await prepararDifusion\(ctx\.ws, pedido\.seleccion, pedido\.canales, goteo\);/);
});

// [media] La misma difusión salía dos veces: el server no tenía idempotencia (un reintento, dos pestañas, MaKo otra vez
// después de una tanda que falló: 450 inscripciones para 250 leads).
test('la misma difusión, una vez: la clave del pedido, la marca y retomar la que ya se creó', () => {
  const p = { seleccion: { leadIds: [3, 1, 2, 2] }, canales: ['instagram', 'whatsapp'] as Array<'instagram' | 'whatsapp'>, mensajes: { whatsapp: { cuerpo: 'Hola' }, instagram: { cuerpo: 'Hola' } }, goteo: { minutos: 3, dia: 40 } };
  const k = claveDeDifusion(p);
  assert.equal(claveDeDifusion({ ...p, seleccion: { leadIds: [1, 2, 3] }, canales: ['whatsapp', 'instagram'] }), k, 'el mismo pedido, en otro orden, es el mismo');
  assert.notEqual(claveDeDifusion({ ...p, mensajes: { ...p.mensajes, whatsapp: { cuerpo: 'Chau' } } }), k, 'otro mensaje es otra difusión');
  assert.notEqual(claveDeDifusion({ ...p, goteo: { minutos: 3, dia: 41 } }), k);
  assert.notEqual(claveDeDifusion({ ...p, seleccion: { leadIds: [1, 2] } }), k);
  assert.equal(claveDeDifusion({ ...p, seleccion: { etapa: ' contacto_nuevo ', funnelId: null } }), claveDeDifusion({ ...p, seleccion: { etapa: 'contacto_nuevo', funnelId: null } }));
  const at = (min: number) => new Date(AHORA - min * 60_000).toISOString();
  assert.deepEqual(decidirRepetida(null, AHORA), { es: 'nueva' });
  assert.deepEqual(decidirRepetida(leerMarcaDifusion('basura'), AHORA), { es: 'nueva' });
  assert.deepEqual(decidirRepetida(leerMarcaDifusion(JSON.stringify({ at: at(1), secuenciaId: null })), AHORA), { es: 'en_curso' }, 'otro la está creando');
  assert.deepEqual(decidirRepetida(leerMarcaDifusion(JSON.stringify({ at: at(ESPERA_DIFUSION_EN_CURSO_MIN + 1), secuenciaId: null })), AHORA), { es: 'nueva' }, 'quien la creaba se cayó');
  assert.deepEqual(decidirRepetida(leerMarcaDifusion(JSON.stringify({ at: at(30), secuenciaId: 1201 })), AHORA), { es: 'retomar', secuenciaId: 1201 });
  assert.deepEqual(decidirRepetida(leerMarcaDifusion(JSON.stringify({ at: at(VENTANA_DIFUSION_REPETIDA_MIN + 1), secuenciaId: 1201 })), AHORA), { es: 'nueva' }, 'pasado el día, mandarla igual es a propósito');
  // El server: la marca se lee ESTRICTO, se reclama con compare-and-set ANTES de crear nada, apunta a la automatización antes
  // de inscribir, se suelta si no se creó nada, y el mismo pedido retoma en vez de crear otra.
  const s = sinComentarios(leer('lib/difusion.ts'));
  const crear = s.slice(s.indexOf('export async function crearDifusion('));
  const i = (x: string) => { const n = crear.indexOf(x); assert.ok(n > 0, `falta: ${x}`); return n; };
  assert.ok(i('const previo = await getSettingEstricto(key);') < i("if (repetida.es === 'en_curso') return { ok: false, error: EN_CURSO };"));
  assert.ok(i("if (repetida.es === 'retomar') {") < i('if (!(await cambiarSettingSi(key, previo, reclamo))) return { ok: false, error: EN_CURSO };'));
  assert.match(crear, /if \(repetida\.es === 'retomar'\) \{\s*const r = await retomarDifusion\(ws, repetida\.secuenciaId, vista, p\.autor\);\s*if \(r\) return r;\s*\}/, 'el mismo pedido retoma la que creó');
  assert.ok(i('if (!(await cambiarSettingSi(key, previo, reclamo)))') < i('const fila = await crearSecuenciaVacia(nombre'), 'reclama ANTES de crear');
  assert.ok(i('await borrarSettingSi(key, reclamo)') < i('const marca = JSON.stringify('), 'lo que no se creó suelta el pedido');
  assert.ok(i('await cambiarSettingSi(key, reclamo, marca)') < i('await inscribirEnDifusion(fila.id, vista.alcance.ids)'), 'la marca apunta a la difusión antes de inscribir');
  assert.match(s, /\.upsert\(\s*tanda\.map\(\(leadId\) => \(\{ lead_id: leadId, secuencia_id: secuenciaId, paso_actual: 0, estado: 'activa', proximo_envio_at: ahora \}\)\),\s*\{ onConflict: 'lead_id,secuencia_id', ignoreDuplicates: true \},\s*\)\.select\('id'\);/, 'el que ya está no entra dos veces');
  const retomar = s.slice(s.indexOf('async function retomarDifusion('), s.indexOf('export async function crearDifusion('));
  assert.match(retomar, /if \(!fila \|\| fila\.archivada_at\) return null;/, 'si la borraron o la archivaron, va como nueva');
  assert.match(retomar, /const r = await inscribirEnDifusion\(fila\.id, vista\.alcance\.ids\);/);
  // ⚠️ La pausada (la terminó la corrida de la hora, o la pausó alguien) se vuelve a prender por la puerta de siempre, ANTES de
  // sumar a los que faltan: decir «préndela ahí» no los sumaba (la reverificación de Integración, 29/10/2026).
  assert.match(retomar, /if \(!fila\.activa\) \{\s*const \{ setSecuenciaActiva, DuplicadaError \} = await import\('\.\/nutricion'\);\s*try \{\s*await setSecuenciaActiva\(fila\.id, true, \{ ws \}\);/);
  // Sin `aunqueDuplique`: la pausada la pudieron editar; prenderla pregunta lo mismo que «Activar», y la duplicada se dice.
  assert.doesNotMatch(retomar, /aunqueDuplique/);
  assert.match(retomar, /if \(e instanceof DuplicadaError\) return \{ ok: false, error: `[^`]*\$\{e\.message\}/);
  assert.ok(retomar.indexOf('await setSecuenciaActiva(fila.id, true') < retomar.indexOf('await inscribirEnDifusion(fila.id'), 'la prende antes de inscribir');
  assert.doesNotMatch(retomar, /préndela ahí/);
});

// [media] Por el grupo de WhatsApp el rol es siempre 'admin' (lib/mako-doer-in.ts): un setter lanzaba una difusión. Y [baja] la
// API proponía un goteo fuera de rango y fallaba recién después del «sí».
test('MaKo: la difusión sólo en la app, y el goteo fuera de rango se dice antes del «sí»', () => {
  const op = porId('difundir_a_leads')!;
  assert.deepEqual([...op.canales], ['app'], 'por WhatsApp el rol es siempre admin (AGENTS.md, «Traer leads de a muchos…»)');
  assert.equal(op.gating?.rolMinimo, 'admin');
  const porDia = op.parametros.find((x) => x.nombre === 'porDia') as { maximo?: number } | undefined;
  assert.equal(porDia?.maximo, RANGOS_GOTEO.dia[1], 'el tope del parámetro es el del goteo');
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  const desde = run.indexOf('difundir_a_leads: {');
  const preparar = run.slice(desde, run.indexOf('ejecutar: async (payload, ctx) => {', desde));
  const g = preparar.indexOf('const goteo = goteoValido(pedido.goteo);');
  assert.ok(g > 0 && g < preparar.indexOf('await prepararDifusion('), 'se valida antes de proponer');
});

// [baja] Cada difusión quedaba prendida para siempre y ocupaba un lugar del tope del plan Esencial (3 activas): la siguiente
// fallaba con «Llegaste al tope de tu plan» por una que ya había terminado.
test('la difusión que terminó se pausa sola, en la corrida de la hora, reconocida por su clave', () => {
  assert.equal(PREFIJO_CLAVE_DIFUSION, 'difusion-');
  assert.deepEqual([...ESTADOS_DIFUSION_EN_CURSO].sort(), ['activa', 'pausada', 'respondio']);
  for (const terminado of ['completada', 'no_responde', 'cancelada']) assert.ok(!(ESTADOS_DIFUSION_EN_CURSO as readonly string[]).includes(terminado), terminado);
  // La clave lleva la marca (la clave no cambia nunca; el nombre sí).
  assert.match(sinComentarios(leer('lib/setting-secuencias.ts')), /const clave = `\$\{o\.prefijoClave \?\? 'automatizacion-'\}\$\{Date\.now\(\)\.toString\(36\)\}/);
  const s = sinComentarios(leer('lib/difusion.ts'));
  const f = s.slice(s.indexOf('export async function pausarDifusionesTerminadas('));
  assert.match(f, /\.like\('clave', `\$\{PREFIJO_CLAVE_DIFUSION\}%`\)\.eq\('activa', true\)\.is\('archivada_at', null\)\.lt\('created_at', antes\)/, 'sólo las difusiones prendidas, y no la recién creada (se prende antes de inscribir)');
  assert.match(f, /\.eq\('secuencia_id', d\.id\)\.in\('estado', \[\.\.\.ESTADOS_DIFUSION_EN_CURSO\]\)/);
  assert.match(f, /if \(e \|\| count == null \|\| count > 0\) continue;/, '«no pude contar» no es «no queda nadie»');
  assert.match(f, /\.update\(\{ activa: false, updated_at: new Date\(\)\.toISOString\(\) \}\)\s*\.eq\('id', d\.id\)\.eq\('activa', true\)/, 'apaga con compare-and-set');
  // El motor la llama en la corrida de la hora, no en el tick ni en la vía rápida.
  const n = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(n, /if \(wsCorrida != null && !opts\?\.soloLeadId && !opts\?\.vencidasDesde\) \{\s*const \{ pausarDifusionesTerminadas \} = await import\('@\/lib\/difusion'\);\s*await pausarDifusionesTerminadas\(\);/);
});
