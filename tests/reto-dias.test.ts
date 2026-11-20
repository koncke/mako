// El reto de 7 días (lib/reto/dias.ts), 18/11/2026: qué día está abierto, cómo está cada uno, qué falta, y las reglas de Martín
// (sin botones de atajo, WhatsApp escribiendo ELLOS, nada invasivo el día 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIAS_RETO, RETO_SUB, diaAbierto, estadoDeLosDias, leerEstado, mensajeEscrito, proximaTarea, type EstadoReto } from '../lib/reto/dias';

const h = (iso: string) => Date.parse(iso);
const base: EstadoReto = { v: 1, inicio: '2026-11-18T15:00:00Z', adelantado: 1, hechas: {} }; // 12:00 en Argentina

test('el día 1 se abre al empezar; los que siguen, al otro día a la hora del aviso (o antes si lo adelanta)', () => {
  assert.equal(diaAbierto(base, h('2026-11-18T23:00:00Z')), 1, 'el mismo día, el 1');
  assert.equal(diaAbierto(base, h('2026-11-19T11:30:00Z')), 1, 'al otro día a las 8:30 de Argentina, todavía el 1');
  assert.equal(diaAbierto(base, h('2026-11-19T12:00:00Z')), 2, 'a las 9:00 de Argentina, el 2');
  assert.equal(diaAbierto({ ...base, horaWa: '18:00' }, h('2026-11-19T12:00:00Z')), 1, 'con el aviso a las 18:00, todavía el 1');
  assert.equal(diaAbierto({ ...base, adelantado: 3 }, h('2026-11-18T23:00:00Z')), 3, 'adelantado');
  assert.equal(diaAbierto(base, h('2026-12-30T12:00:00Z')), 7, 'nunca más de 7');
});

test('adelantar corre los días que siguen: el lunes adelanta el 2 y el 3, el martes ya tiene el 4 (20/11, d24-01 y R57-06)', () => {
  const adelanto: EstadoReto = { ...base, adelantado: 3, adelantadoEn: '2026-11-18T21:00:00Z' }; // lunes 18:00 en Argentina
  assert.equal(diaAbierto(adelanto, h('2026-11-18T23:00:00Z')), 3, 'el mismo día, el adelantado');
  assert.equal(diaAbierto(adelanto, h('2026-11-19T11:30:00Z')), 3, 'al otro día antes de las 9:00, todavía el 3');
  assert.equal(diaAbierto(adelanto, h('2026-11-19T12:00:00Z')), 4, 'al otro día a las 9:00, el 4 (antes quedaba en el 3)');
  assert.equal(diaAbierto(adelanto, h('2026-11-20T12:00:00Z')), 5, 'y el siguiente, el 5');
  assert.equal(diaAbierto({ ...adelanto, horaWa: '18:00' }, h('2026-11-19T12:00:00Z')), 3, 'con el aviso a las 18:00, el 4 espera a esa hora');
  assert.equal(diaAbierto({ ...adelanto, horaWa: '18:00' }, h('2026-11-19T21:00:00Z')), 4);
  const e = leerEstado(JSON.stringify(adelanto));
  assert.equal(e?.adelantadoEn, '2026-11-18T21:00:00Z', 'se guarda cuándo adelantó');
  const ruta = readFileSync(new URL('../app/api/reto/route.ts', import.meta.url), 'utf8');
  assert.ok(ruta.includes('adelantado: dia, adelantadoEn: new Date(ahora).toISOString(), avisado: Math.max(e.avisado ?? 1, dia)'), 'la API guarda el momento, y el día adelantado no lleva aviso');
});

test('cada día: hecho, a medias, hoy o luego; y lo pendiente va primero', () => {
  const e: EstadoReto = { ...base, adelantado: 2, hechas: { '1:offer': 'x', '1:funnel': 'x' } };
  const ahora = h('2026-11-18T23:00:00Z');
  const r = estadoDeLosDias(e, ahora);
  assert.equal(r.abierto, 2);
  assert.deepEqual(r.dias.slice(0, 3), ['hecho', 'hoy', 'luego']);
  assert.equal(r.hechos, 1);
  assert.equal(proximaTarea(e, ahora)?.tarea.id, 'app', 'el día 2 empieza por la app');
  const sinFunnel: EstadoReto = { ...base, adelantado: 2, hechas: { '1:offer': 'x' } };
  assert.deepEqual(estadoDeLosDias(sinFunnel, ahora).dias.slice(0, 2), ['medias', 'hoy']);
  assert.equal(proximaTarea(sinFunnel, ahora)?.tarea.id, 'funnel', 'lo del día anterior, primero');
  // Lo guardado antes de las dos tareas (sólo `1:funnel`): el día 1 queda a medias, con la oferta como lo que falta.
  const deAntes: EstadoReto = { ...base, adelantado: 2, hechas: { '1:funnel': 'x' } };
  assert.equal(estadoDeLosDias(deAntes, ahora).dias[0], 'medias');
  assert.equal(proximaTarea(deAntes, ahora)?.tarea.id, 'offer');
  assert.equal(estadoDeLosDias(null, ahora).abierto, 0);
});

test('lo guardado se valida: algo raro es «sin reto»', () => {
  assert.equal(leerEstado('no es json'), null);
  assert.equal(leerEstado({ inicio: 'ayer' }), null);
  const e = leerEstado(JSON.stringify({ inicio: '2026-11-18T15:00:00Z', adelantado: 99, hechas: { '1:funnel': 'x', raro: 'y' }, leidas: { '1:funnel': 'Elegiste tu funnel: Anuncios.' }, horaWa: '3:00' }));
  assert.ok(e);
  assert.equal(e.adelantado, 7);
  assert.deepEqual(e.hechas, { '1:funnel': 'x' });
  // 20/11: una «hecha» sin lo que MaKo leyó es de antes (se marcaba por tocar la pestaña): no cuenta, se vuelve a leer.
  assert.deepEqual(leerEstado({ inicio: '2026-11-18T15:00:00Z', hechas: { '1:offer': 'x' } })?.hechas, {}, 'las de antes no prueban nada');
  assert.deepEqual(leerEstado({ inicio: '2026-11-18T15:00:00Z', hechas: { '1:offer': 'x', '1:funnel': 'y' }, leidas: { '1:offer': 'Tu oferta ya está armada.' } })?.hechas, { '1:offer': 'x' });
  assert.equal(e.horaWa, undefined, 'una hora fuera de las del reto no se guarda');
});

test('las reglas de Martín (18/11): sin atajos, WhatsApp escribiendo ELLOS, nada invasivo', () => {
  assert.equal(RETO_SUB, 'Cada día un video para que avances con tu negocio. Puedes adelantar días cuando quieras.');
  assert.equal(DIAS_RETO.length, 7);
  for (const d of DIAS_RETO) {
    assert.ok(d.tareas.length > 0, `el día ${d.n} tiene tareas`);
    for (const t of d.tareas) assert.ok(t.marcas.length > 0 && t.marcas.every((m) => m.sel && m.haz), `${d.n}:${t.id} se marca (sin botón de atajo)`);
    assert.equal(d.video, `reto-dia-${d.n}`, 'su video es el SUYO (nunca el de la landing)');
  }
  // EL DÍA 1, EN DOS CHATS (Martín, 15/11: «Oferta y Funnel Coach en DOS chats separados»): primero la oferta con el Offer Coach y
  // después el sistema para conseguir clientes con el Funnel Coach, y la marca lleva de la fila de uno a la del otro.
  const d1 = DIAS_RETO[0];
  assert.equal(d1.mensaje, 'Hoy es tu día 1. Tu onboarding ya está; ahora tu oferta, con Offer Coach, y después tu sistema para conseguir clientes, con Funnel Coach.');
  assert.deepEqual(d1.tareas.map((t) => [t.id, t.titulo]), [
    ['offer', 'Tu oferta, con Offer Coach'],
    ['funnel', 'Tu sistema para conseguir clientes, con Funnel Coach'],
  ]);
  assert.deepEqual(d1.tareas.map((t) => t.marcas.map((m) => m.sel)), [['[data-recorrido="sb-offer"]'], ['[data-recorrido="sb-funnel"]']]);
  // Las dos marcas existen en la barra (las filas de los coaches, con la prop `marca` de FilaDeChat), sólo con los dos coaches.
  const barra = readFileSync(new URL('../app/second-brain/ChatSecondBrain.tsx', import.meta.url), 'utf8');
  assert.match(barra, /<FilaDeChat titulo=\{ORIGEN_OFFER_COACH\} marca="sb-offer"/);
  assert.match(barra, /<FilaDeChat titulo=\{ORIGEN_FUNNEL_COACH\} marca="sb-funnel"/);
  const d3 = DIAS_RETO[2];
  assert.doesNotMatch(JSON.stringify(d3), /planilla|mándame/i, 'el día 3 no pide la lista de clientes');
  assert.ok(d3.whatsapp?.audio, 'el día 3 prueba un audio a MaKo');
  assert.equal(DIAS_RETO[5].whatsapp, undefined, 'el día 6 no tiene WhatsApp');
  assert.equal(mensajeEscrito(DIAS_RETO[1].whatsapp!, '18:00'), 'Hola MaKo, prefiero que me escribas a las 18:00 sobre el reto.');
  const chat = readFileSync(new URL('../app/second-brain/reto/ChatDelReto.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(chat, />\s*Hacerlo\s*</, 'sin «Hacerlo»');
});

test('el correo de cada día: «Día N del reto de MaKo», una vez, y el día 1 no lleva', async () => {
  const { correoDelDia, diaParaAvisar } = await import('../lib/reto/dias');
  const m = correoDelDia(3, 'https://app/second-brain?reto=1');
  assert.equal(m.asunto, 'Día 3 del reto de MaKo', 'Martín, 18/11: el asunto');
  assert.match(m.cuerpo, /Carga tus clientes en el CRM/);
  assert.match(m.cuerpo, /https:\/\/app\/second-brain\?reto=1/);
  assert.doesNotMatch(m.cuerpo, /tu video de hoy/i);
  const ahora = h('2026-11-19T12:30:00Z'); // el día 2 ya abrió
  assert.equal(diaParaAvisar(base, h('2026-11-18T23:00:00Z')), null, 'el día 1 no lleva correo');
  assert.equal(diaParaAvisar(base, ahora), 2);
  assert.equal(diaParaAvisar({ ...base, avisado: 2 }, ahora), null, 'una vez por día');
});

// EL PASO DE OFFER COACH A FUNNEL COACH (18/11/2026). Martín, sobre la maqueta: «me manda la oferta con el PDF para descargar… pero
// apenas me la manda automáticamente ya sale el botón para hacer clic en Funnel Coach. Eso no tiene sentido… mínimo déjame verla».
// Probado rompiéndolo (18/11/2026), con el archivo en 6 / 0, una rotura por vez y restaurada (sha256), cada una 5 / 1:
//   · `marcaAlFunnelYa` sin esperar la lectura (true con la oferta entregada)          · el gesto de escribir contando el turno que
//     YA corría (`if (ocupado && entregadaEn != null)`)                                  · la tarjeta a la derecha de la fila
//   · la conversación de oferta contando versiones con Offer todavía armándola
test('el paso a Funnel Coach espera a que la persona VEA su oferta: un gesto o ~20 s, nunca en el acto ni encima de ella', async () => {
  const { LECTURA_DE_LA_OFERTA_MS, marcaAlFunnelYa, ofertaRecienEntregada } = await import('../lib/reto/dias');
  const t0 = h('2026-11-18T15:00:00Z');
  assert.equal(LECTURA_DE_LA_OFERTA_MS, 20_000);
  assert.equal(marcaAlFunnelYa({ entregadaEn: t0, ahora: t0, gesto: false, ocupado: false }), false, 'en el acto, no: primero la ve');
  assert.equal(marcaAlFunnelYa({ entregadaEn: t0, ahora: t0 + 19_999, gesto: false, ocupado: false }), false);
  assert.equal(marcaAlFunnelYa({ entregadaEn: t0, ahora: t0 + 20_000, gesto: false, ocupado: false }), true, 'después de leerla');
  assert.equal(marcaAlFunnelYa({ entregadaEn: t0, ahora: t0 + 1_000, gesto: true, ocupado: false }), true, 'descargó el PDF, bajó hasta el final o escribió');
  assert.equal(marcaAlFunnelYa({ entregadaEn: t0, ahora: t0 + 60_000, gesto: true, ocupado: true }), false, 'nunca con MaKo escribiendo');
  assert.equal(marcaAlFunnelYa({ entregadaEn: null, ahora: t0, gesto: true, ocupado: false }), false, 'sin una oferta entregada en esta visita, nada');
  // Qué es «entregada»: una oferta que aparece o cambia; la de antes, la del perfil o «no se sabe», no.
  const hay = (nombre: string, de = 'guardada') => ({ estado: 'hay' as const, nombre, de });
  assert.equal(ofertaRecienEntregada({ estado: 'no-hay' }, hay('Mentoría')), true);
  assert.equal(ofertaRecienEntregada(hay('Mentoría', 'conversacion'), hay('Mentoría')), true, 'armada y ahora guardada');
  assert.equal(ofertaRecienEntregada(hay('Mentoría'), hay('Mentoría 2')), true, 'otra');
  assert.equal(ofertaRecienEntregada(hay('Mentoría'), hay('Mentoría')), false, 'la que ya estaba al abrir');
  assert.equal(ofertaRecienEntregada({ estado: 'no-hay' }, hay('MaKo', 'perfil')), false, 'la del perfil no la armó nadie');
  assert.equal(ofertaRecienEntregada({ estado: 'no-se' }, hay('Mentoría')), false, 'sin saber qué había, no se afirma una entrega');
  assert.equal(ofertaRecienEntregada(null, hay('Mentoría')), false);
  // El motor: escribir cuenta si EMPIEZA un turno después de la entrega; la tarjeta debajo de la fila; sólo con la fila a la vista;
  // una vez por visita (la misma cuenta que el chat del reto) y la tarea queda hecha al tocarla.
  const leerSin = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
  const paso = leerSin('app/second-brain/reto/usePasoAlFunnel.ts');
  assert.match(paso, /if \(ocupado && !antesOcupado\.current && entregadaEn != null\) setGesto\(true\);/);
  // Tocar la fila de Funnel Coach sólo lleva al coach (20/11, D1-01): la tarea la cierra el funnel guardado, no el clic.
  assert.ok(paso.includes("marcarTarea([{ ...m, lado: 'abajo' }], () => { void leer(); });"), 'la marca a Funnel Coach no da la tarea por hecha');
  assert.doesNotMatch(paso, /accion: 'hecha'/, 'nada de «hecha» por tocar');
  assert.match(paso, /if \(!m \|\| yaMarcada\(CLAVE\) \|\| senalAhora\(\) \|\| !filaVisible\(m\.sel\)\) return;/);
  assert.match(paso, /if \(Date\.now\(\) - ultimoGesto > GESTO_RECIENTE_MS\) return;/, 'bajar al último mensaje lo hace la pantalla, no la persona');
  // Dónde se entrega: el Offer Coach (desde el 19/11 con el motor de Offer: una versión nueva de SU conversación) y la conversación de
  // oferta del PDF que cuelga de él (lo mismo). Contadas con Offer ya quieto; los dos, sólo con los dos coaches y a la vista.
  const chat = leerSin('app/second-brain/ChatDelCoach.tsx');
  assert.match(chat, /usePasoAlFunnel\(\{ activo: dosCoaches && cual === 'offer' && visible, entregadaEn, ocupado,/);
  const motor = leerSin('app/second-brain/useChatDelCoach.ts');
  assert.match(motor, /if \(!motorOffer \|\| idAbierta == null \|\| versionesAbierta == null\) return;/);
  assert.match(motor, /if \(k\.enCurso\) return;\n\s*if \(versionesAbierta > antes\.n\) setEntregadaEn\(Date\.now\(\)\);/);
  const sb = leerSin('app/second-brain/ChatSecondBrain.tsx');
  assert.match(sb, /if \(k\.enCurso\) return;\n\s*if \(ofertaAbierta\.versiones > antes\.n\) setEntregadaOffer\(Date\.now\(\)\);/);
  assert.match(sb, /usePasoAlFunnel\(\{ activo: dosCoaches && seVeLaConversacion, entregadaEn: entregadaOffer,/);
  assert.match(sb, /dosCoaches visible=\{verOffer\} \/>/);
});

test('el día 3 es tu primera automatización, sin atarla a WhatsApp (Martín, 18/11)', () => {
  const d3 = DIAS_RETO[2];
  assert.doesNotMatch(JSON.stringify(d3), /difusi/i, 'sin «difusión»');
  const t = d3.tareas.find((x) => x.id === 'automatizacion');
  assert.ok(t, 'la tarea de la automatización');
  assert.equal(t.donde, 'En Automations');
  assert.match(t.detalle, /WhatsApp, Instagram o email/, 'el canal que usa la persona');
  assert.ok(t.marcas.some((m) => /chb-nueva/.test(m.sel)), 'marca «Nueva automatización»');
  assert.deepEqual(d3.tareas.map((x) => x.id), ['contactos', 'automatizacion', 'calendar']);
});

test('lo tocado durante el video del día cuenta como hecho: la tarea cuya última marca es ese lugar (el Cerebro, 18/11)', async () => {
  const { tareasQueCierra } = await import('../lib/reto/dias');
  const d2 = DIAS_RETO[1];
  assert.deepEqual(tareasQueCierra(d2, '[data-recorrido="tour-settings-instalar"]'), ['app', 'extension'], 'tocar «Instalar la app» cierra la app y la extensión');
  assert.deepEqual(tareasQueCierra(d2, '[data-recorrido="tour-settings-integraciones"]'), ['integraciones']);
  assert.deepEqual(tareasQueCierra(d2, '[data-recorrido="tour-barra-foto"]'), [], 'la foto es un paso del camino, no cierra nada');
  // 19/11: el video marca Perfil (`tour-settings-info`) para «Tu perfil y tu foto». Antes la última marca de esa tarea era Settings:
  // tocar Settings la cerraba antes de llegar al perfil, y tocar Perfil no cerraba nada.
  assert.deepEqual(tareasQueCierra(d2, '[data-recorrido="tour-settings-info"]'), ['perfil'], 'tocar Perfil cierra tu perfil y tu foto');
  assert.deepEqual(tareasQueCierra(d2, '#user-menu a[href^="/perfil"]'), [], 'Settings es un paso del camino, no cierra nada');
  const chat = readFileSync(new URL('../app/second-brain/reto/ChatDelReto.tsx', import.meta.url), 'utf8');
  assert.match(chat, /alTocar: onTocado/, 'el video del día avisa lo tocado');
  // 20/11 (auditoría D1-01, d24-07, d24-12 y R57-09): tocar lo marcado NO da la tarea por hecha; sólo relee el reto.
  assert.doesNotMatch(chat, /accion: 'hecha'/, 'el chat del reto nunca marca «hecha» por un toque');
  // 20/11 (D1-03, d24-09 y R57-12): nada se marca solo a los 0,9 s; lo que falta, al terminar o cerrar el video del día.
  assert.ok(!chat.includes('}, 900)'), 'sin la marca automática a los 900 ms');
  assert.ok(chat.includes('alTerminar: () => onFin?.()') && chat.includes('onEnded={() => onFin?.()}'), 'la marca de lo que falta sale al terminar el video');
  assert.ok(chat.includes("marcarTarea(t.marcas, () => { void leer(); }, dia.n === 1 ? undefined : () => { void hacer({ accion: 'despues', dia: dia.n, id: t.id }); })"), 'el día 1 sin «Lo hago después» (F1)');
  assert.match(chat, /¡Hiciste todo lo del día \{dia\.n\}!/, 'con todo hecho, la felicita y pasa a WhatsApp');
});

test('cada tarea del reto se cierra por lo que MaKo LEE, nunca por tocar la pestaña (20/11, D1-01, d24-07, d24-12, R57-09)', () => {
  const senales = readFileSync(new URL('../lib/reto/senales.ts', import.meta.url), 'utf8');
  for (const d of DIAS_RETO) for (const t of d.tareas) assert.ok(senales.includes(`'${d.n}:${t.id}': async`), `la tarea ${d.n}:${t.id} tiene su lectura`);
  // Las trampas medidas: el funnel por defecto de todo negocio, la foto de Google, las secuencias que nacen apagadas, el plan de arranque.
  assert.ok(senales.includes("eq('es_default', false)"), 'el funnel por defecto no cuenta');
  assert.ok(senales.includes(String.raw`\/object\/public\/avatars\/`), 'sólo la foto subida a MaKo');
  assert.ok(senales.includes("eq('activa', true)"), 'sólo una automatización activa');
  assert.ok(senales.includes('tareasEnElPlan'), 'sólo las tareas que dejó el CoPilot');
  const ruta = readFileSync(new URL('../app/api/reto/route.ts', import.meta.url), 'utf8');
  assert.ok(ruta.includes('leer().then(conLoLeido)'), 'el GET lee lo hecho');
  assert.ok(!ruta.includes("accion === 'hecha'"), 'la API ya no acepta «hecha» por un toque');
});

test('los días 4 a 6 cambian según el funnel elegido (20/11, d24-14 y R57-01; la tabla de la maqueta)', async () => {
  const { diasDelReto } = await import('../lib/reto/dias');
  const t = (f: string | null, n: number, id: string) => diasDelReto(f).find((d) => d.n === n)!.tareas.find((x) => x.id === id)!;
  assert.equal(t('anuncios-a-whatsapp', 4, 'web').titulo, 'Tu página, con el botón a tu WhatsApp');
  assert.equal(t('anuncios-a-vsl', 4, 'web').titulo, 'Tu página con tu video de venta y la agenda');
  assert.equal(t('organico', 5, 'carrusel').titulo, 'Tu carrusel, con la palabra para comentar');
  assert.equal(t('organico', 5, 'guion').titulo, 'El guion de tu reel');
  assert.equal(t('youtube', 6, 'clip').detalle, 'Un short que lleva a tu canal.');
  assert.equal(t('anuncios', 4, 'spy').detalle, 'Mira sus anuncios con formulario que más duran.');
  assert.equal(diasDelReto(null), DIAS_RETO, 'sin funnel, los días de siempre');
  assert.deepEqual(diasDelReto('youtube').map((d) => d.tareas.map((x) => x.id)), DIAS_RETO.map((d) => d.tareas.map((x) => x.id)), 'los ids no cambian (las lecturas y lo guardado siguen valiendo)');
  const chat = readFileSync(new URL('../app/second-brain/reto/ChatDelReto.tsx', import.meta.url), 'utf8');
  assert.ok(chat.includes('diasDelReto(d.funnel).filter') && chat.includes('diasDelReto(d.funnel).map'), 'el chat y el desplegable usan los días del funnel');
});

test('«¿Qué hacemos ahora?»: lo elegido en el onboarding, con su «Muéstrame…», antes del día 1 (20/11, D1-02 y V3)', async () => {
  const { muestrasDe, RETO_INTERES_YA, RETO_MUESTRA, RETO_MUESTRA_FIN } = await import('../lib/reto/dias');
  const ms = muestrasDe(['Armar mi landing', 'Videos con IA y con mi avatar', 'Armar mi landing', 'algo raro', 'Ordenar mis ventas en un CRM', 'Ver mis números en un tablero']);
  assert.deepEqual(ms.map((m) => m.pestana), ['web', 'video', 'crm'], 'sin repetir, sin lo desconocido, hasta 3; el avatar va a Video');
  assert.equal(RETO_INTERES_YA(ms), 'Me dijiste que lo primero que quieres es armar tu landing, hacer tus videos con IA y ordenar tus ventas en el CRM. ¿Te muestro cómo hacerlo ahora, o empezamos tu día 1? Si lo resuelves primero, no te preocupes: tu reto te espera aquí.');
  assert.equal(RETO_MUESTRA(ms[0]), 'Te muestro dónde armar tu landing, en Web Generator. Dale play.');
  assert.doesNotMatch(RETO_MUESTRA_FIN(ms[0]), /juntos/, 'neutro en género');
  const { INTERESES_V2 } = await import('../lib/onboarding-arranque');
  for (const i of INTERESES_V2) assert.ok(muestrasDe([i.label]).length === 1, `«${i.label}» tiene su pestaña`);
  const chat = readFileSync(new URL('../app/second-brain/reto/ChatDelReto.tsx', import.meta.url), 'utf8');
  assert.ok(chat.includes("<QueHacemos titulo={vistas.length ? '¿Seguimos?' : '¿Qué hacemos ahora?'}"), 'el recuadro, arriba de la caja');
  assert.ok(chat.includes('{empezo1 && abiertos.filter('), 'los días, recién después de «Empezar mi día 1»');
  assert.ok(chat.includes("if (t) mostrarTutorial(t, { video: m.pestana });"), 'cada «Muéstrame…» corre su tutorial con su video');
  const ruta = readFileSync(new URL('../app/api/reto/route.ts', import.meta.url), 'utf8');
  assert.ok(ruta.includes("body.accion === 'dia1'") && ruta.includes("body.accion === 'muestra'"), 'la API guarda lo elegido');
});

test('el desplegable del reto: «El reto de 7 días de MaKo», el video de cada día abierto, el ícono y la flecha (20/11, V2, D1-17, R57-F6)', () => {
  const chat = readFileSync(new URL('../app/second-brain/reto/ChatDelReto.tsx', import.meta.url), 'utf8');
  assert.ok(chat.includes("const RETO_TITULO_DESPLEGABLE = 'El reto de 7 días de MaKo';") && chat.includes('{RETO_TITULO_DESPLEGABLE}</p>'), 'el título de la maqueta');
  assert.ok(chat.includes('{!futuro && <VideoEnElMenu dia={dia} />}'), 'cada día abierto o hecho, con su video');
  assert.ok(chat.includes('adelántalo al terminar el día de hoy'), 'el texto de la maqueta');
  assert.ok(chat.includes('className="rt-btn__ico"') && chat.includes('className="rt-btn__flecha"'), 'el ícono de la lista y la flecha');
});

test('los tres puntitos: cada mensaje del reto llega después de que MaKo escribe, de a uno (20/11, D1-10 y d24-11)', () => {
  const chat = readFileSync(new URL('../app/second-brain/reto/ChatDelReto.tsx', import.meta.url), 'utf8');
  assert.ok(chat.includes('const ap = useAparicion(claves);'), 'los mensajes pasan por la aparición');
  assert.ok(chat.indexOf('const ap = useAparicion(claves);') < chat.indexOf('ap.escribiendo]'), 'ap se declara antes de usarlo en un efecto');
  for (const k of ["ap.ver('hola')", "ap.ver('interes')", 'ap.ver(`dia:${dia.n}`)', 'ap.ver(`fin:${actual.n}`)']) assert.ok(chat.includes(k), `${k} espera su turno`);
  assert.ok(chat.includes('co-trabajando__puntos'), 'los puntitos del Ops Center');
  assert.ok(chat.includes('!empezo1 && ap.listo && !ap.escribiendo'), 'las opciones, recién cuando MaKo terminó de escribir');
});

test('el catálogo «Tutoriales de MaKo»: para empezar, el reto con los días cerrados y cada pestaña con video (20/11, V1 y D1-07)', async () => {
  const { gruposDelCatalogo } = await import('../app/second-brain/reto/CatalogoTutoriales');
  const videos = ['onboarding-bienvenida', 'recorrido', 'offer-coach', 'reto-dia-1', 'reto-dia-2', 'reto-dia-5', 'crm', 'plan'].map((key) => ({ key, duracion_s: 60 }));
  const g = gruposDelCatalogo(videos, 2);
  assert.deepEqual(g.map((x) => x.titulo), ['Para empezar', 'Tu reto de 7 días', 'Cómo funciona cada pestaña']);
  assert.deepEqual(g[0].tarjetas.map((t) => t.key), ['onboarding-bienvenida', 'recorrido'], 'sin video, no hay tarjeta (nunca un hueco)');
  assert.equal(g[1].tarjetas.find((t) => t.key === 'reto-dia-5')?.cerrado, 'Se abre el día 5', 'los días que no llegaron');
  assert.equal(g[1].tarjetas.find((t) => t.key === 'reto-dia-2')?.cerrado, undefined);
  assert.ok(g[2].tarjetas.some((t) => t.key === 'crm' && t.titulo.startsWith('Cómo funciona')), 'una por pestaña');
  const g2 = gruposDelCatalogo(['avatar', 'calendar', 'classroom-calendar'].map((key) => ({ key })), 1);
  assert.deepEqual(g2[0].tarjetas.map((t) => t.titulo), ['Cómo funciona Calendar', 'Cómo funciona Classroom › Calendar'], 'sin AI Avatar, y sin dos «Calendar»');
  const chat = readFileSync(new URL('../app/second-brain/reto/ChatDelReto.tsx', import.meta.url), 'utf8');
  assert.ok(chat.includes('<BotonTutoriales activo={catalogo}') && chat.includes('catalogo && d ? <CatalogoTutoriales'), 'el ícono en la cabecera cambia el hilo por el catálogo');
});

test('el fin de cada día: «¿Adelantas…?» recién al terminarlo, «Lo hago después» y «Mañana» guardados (20/11, D1-06, d24-13, R57-07, R57-F1, R57-F4)', async () => {
  const { diaTerminado, finDelDia, leerEstado: leer } = await import('../lib/reto/dias');
  const d3 = DIAS_RETO[2], d4 = DIAS_RETO[3];
  const e = { ...base, adelantado: 3, hechas: { '3:contactos': 'x', '3:automatizacion': 'x' }, leidas: {} };
  assert.equal(diaTerminado(e, d3), false, 'con una tarea sin hacer ni dejar, el día sigue');
  assert.equal(diaTerminado({ ...e, despues: ['3:calendar'] }, d3), true, 'dejada para después, el día termina');
  assert.equal(finDelDia(d3, d4, '9:00', 'Ana', ['calendar']), 'Tu día 3 quedó casi listo: te falta conectar tu calendario. Mañana a las 9:00 sigue el día 4: copia lo que le funciona a tu competencia.');
  assert.equal(finDelDia(d3, d4, '9:00', 'Ana', []), '¡Listo tu día 3! Mañana a las 9:00 sigue el día 4: copia lo que le funciona a tu competencia.');
  assert.match(finDelDia(DIAS_RETO[0], DIAS_RETO[1], '9:00', 'Ana', []), /^¡Terminaste tu día 1, Ana!/);
  assert.doesNotMatch(finDelDia(d3, d4, '9:00', 'Ana', []), /te escribo/, 'sin prometer el WhatsApp de cada mañana, que todavía no existe');
  assert.deepEqual(leer({ inicio: '2026-11-18T15:00:00Z', despues: ['3:calendar', 'raro'], manana: 4 }), { ...leer({ inicio: '2026-11-18T15:00:00Z' }), despues: ['3:calendar'], manana: 4 });
  const chat = readFileSync(new URL('../app/second-brain/reto/ChatDelReto.tsx', import.meta.url), 'utf8');
  assert.ok(chat.includes("const pregunta = termino && !!siguiente && !eligioManana;"), 'la pregunta, recién con el día terminado');
  assert.ok(chat.includes('<AdelantarDia n={siguiente.n}'), 'en el recuadro de opciones, no en la burbuja');
  assert.ok(chat.includes("{ void hacer({ accion: 'despues', dia: dia.n, id: t.id }); }"), '«Lo hago después» se guarda');
  assert.ok(chat.includes('{todas && dia.n === 2 && <Burbuja>'), '«¡Hiciste todo…!» sólo en el día 2');
  assert.ok(chat.includes("{p && (dia.n === 2 || diaTerminado(e, dia)) && ("), 'la prueba por WhatsApp, al final del día');
  const ruta = readFileSync(new URL('../app/api/reto/route.ts', import.meta.url), 'utf8');
  assert.ok(ruta.includes("body.accion === 'despues'") && ruta.includes("body.accion === 'manana'"), 'la API guarda los dos');
});

test('lo que dicen las tareas existe en la app (19/11): sin equipo que integre, sin clip de regalo, sin la tab AI Avatar', () => {
  const texto = JSON.stringify(DIAS_RETO);
  assert.doesNotMatch(texto, /integramos|lo hacemos por ti|nuestro equipo/i, 'nada que prometa un equipo: Martín no tiene');
  assert.doesNotMatch(texto, /regalo|gratis|ilimitad/i, 'sin regalos que la app no da');
  assert.doesNotMatch(texto, /AI Avatar/, 'la tab AI Avatar se cerró el 14/11: es «Tu personaje con IA», en Video');
  assert.match(DIAS_RETO[2].tareas[0].detalle, /CSV/, 'los contactos se cargan con un CSV');
});
