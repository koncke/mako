// El reto de 7 días (lib/reto/dias.ts), 18/11/2026: qué día está abierto, cómo está cada uno, qué falta, y las reglas de Martín
// (sin botones de atajo, WhatsApp escribiendo ELLOS, nada invasivo el día 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** El código de un archivo, con los finales de línea de GitHub (LF): con core.autocrlf=true la copia de Windows está en CRLF, y un
 *  `includes` con '\n' daba un falso rojo en el filtro del pre-push (el chat de WhatsApp, 20/11). Toda lectura de código pasa por acá. */
const fuente = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
import { DIAS_RETO, RETO_SUB, diaAbierto, estadoDeLosDias, leerEstado, mensajeEscrito, proximaTarea, tareaHecha, type EstadoReto } from '../lib/reto/dias';

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
  const ruta = fuente('../app/api/reto/route.ts');
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
    // «Tu onboarding» (D1-14) está hecha desde el principio: no tiene dónde hacerse ni botón. Toda otra tarea, con su marca.
    for (const t of d.tareas) assert.ok(t.siempre ? t.marcas.length === 0 && tareaHecha({ v: 1, inicio: '2026-11-20T12:00:00Z', adelantado: 0, hechas: {} } as never, d.n, t.id) : t.marcas.length > 0 && t.marcas.every((m) => m.sel && m.haz), `${d.n}:${t.id} se marca (sin botón de atajo)`);
    assert.equal(d.video, `reto-dia-${d.n}`, 'su video es el SUYO (nunca el de la landing)');
  }
  // EL DÍA 1, EN DOS CHATS (Martín, 15/11: «Oferta y Funnel Coach en DOS chats separados»): primero la oferta con el Offer Coach y
  // después el sistema para conseguir clientes con el Funnel Coach, y la marca lleva de la fila de uno a la del otro.
  const d1 = DIAS_RETO[0];
  // 20/11 (D1-14): el texto de la maqueta.
  assert.equal(d1.mensaje, 'Hoy es tu día 1. Tu onboarding ya está; ahora tu oferta, con Offer Coach, y tu sistema de adquisición de clientes, con Funnel Coach. Empecemos por tu oferta.');
  assert.deepEqual(d1.tareas.map((t) => [t.id, t.titulo]), [
    ['onboarding', 'Tu onboarding'],
    ['offer', 'Tu oferta, con Offer Coach'],
    ['funnel', 'Tu sistema de adquisición, con Funnel Coach'],
  ]);
  assert.deepEqual(d1.tareas.map((t) => t.marcas.map((m) => m.sel)), [[], ['[data-recorrido="sb-offer"]'], ['[data-recorrido="sb-funnel"]']]);
  // Las dos marcas existen en la barra (las filas de los coaches, con la prop `marca` de FilaDeChat), sólo con los dos coaches.
  const barra = fuente('../app/second-brain/ChatSecondBrain.tsx');
  assert.match(barra, /<FilaDeChat titulo=\{ORIGEN_OFFER_COACH\} marca="sb-offer"/);
  assert.match(barra, /<FilaDeChat titulo=\{ORIGEN_FUNNEL_COACH\} marca="sb-funnel"/);
  const d3 = DIAS_RETO[2];
  assert.doesNotMatch(JSON.stringify(d3), /planilla|mándame/i, 'el día 3 no pide la lista de clientes');
  assert.ok(d3.whatsapp?.audio, 'el día 3 prueba un audio a MaKo');
  assert.equal(DIAS_RETO[5].whatsapp, undefined, 'el día 6 no tiene WhatsApp');
  assert.equal(mensajeEscrito(DIAS_RETO[1].whatsapp!, '18:00'), 'Hola MaKo, prefiero que me escribas a las 18:00 sobre el reto.');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
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
  const leerSin = (r: string) => fuente(`../${r}`).replace(/^[ \t]*\/\/.*$/gm, '');
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
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.match(chat, /alTocar: onTocado/, 'el video del día avisa lo tocado');
  // 20/11 (auditoría D1-01, d24-07, d24-12 y R57-09): tocar lo marcado NO da la tarea por hecha; sólo relee el reto.
  assert.doesNotMatch(chat, /accion: 'hecha'/, 'el chat del reto nunca marca «hecha» por un toque');
  // 20/11 (D1-03, d24-09 y R57-12): nada se marca solo a los 0,9 s; lo que falta, al terminar o cerrar el video del día.
  assert.ok(!chat.includes('}, 900)'), 'sin la marca automática a los 900 ms');
  assert.ok(chat.includes('alTerminar: () => onFin?.()') && chat.includes('onTermina={() => onFin?.()}'), 'la marca de lo que falta sale al terminar el video');
  assert.ok(chat.includes("marcarTarea(marcasDeLaTarea(t), () => { void leer(); }, dia.n === 1 ? undefined : () => { void hacer({ accion: 'despues', dia: dia.n, id: t.id }); })"), 'el día 1 sin «Lo hago después» (F1)');
  assert.match(chat, /¡Hiciste todo lo del día \{dia\.n\}!/, 'con todo hecho, la felicita y pasa a WhatsApp');
});

test('cada tarea del reto se cierra por lo que MaKo LEE, nunca por tocar la pestaña (20/11, D1-01, d24-07, d24-12, R57-09)', () => {
  const senales = fuente('../lib/reto/senales.ts');
  for (const d of DIAS_RETO) for (const t of d.tareas) if (!t.siempre) assert.ok(senales.includes(`'${d.n}:${t.id}': async`), `la tarea ${d.n}:${t.id} tiene su lectura`);
  // Las trampas medidas: el funnel por defecto de todo negocio, la foto de Google, las secuencias que nacen apagadas, el plan de arranque.
  assert.ok(senales.includes("eq('es_default', false)"), 'el funnel por defecto no cuenta');
  assert.ok(senales.includes(String.raw`\/object\/public\/avatars\/`), 'sólo la foto subida a MaKo');
  assert.ok(senales.includes("eq('activa', true)"), 'sólo una automatización activa');
  assert.ok(senales.includes('tareasEnElPlan'), 'sólo las tareas que dejó el CoPilot');
  const ruta = fuente('../app/api/reto/route.ts');
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
  // Sin funnel, los días 4 a 6 de siempre (el día 2 lleva igual sus integraciones: sin funnel, Meta, como la maqueta; d24-05).
  assert.deepEqual(diasDelReto(null).filter((d) => d.n !== 2), DIAS_RETO.filter((d) => d.n !== 2), 'sin funnel, los días de siempre');
  assert.deepEqual(diasDelReto('youtube').map((d) => d.tareas.map((x) => x.id)), DIAS_RETO.map((d) => d.tareas.map((x) => x.id)), 'los ids no cambian (las lecturas y lo guardado siguen valiendo)');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('diasDelReto(d.funnel, d.integraciones).filter') && chat.includes('diasDelReto(d.funnel, d.integraciones).map'), 'el chat y el desplegable usan los días del funnel (y las integraciones de lo que eligió, d24-05)');
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
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes("<QueHacemos titulo={vistas.length ? '¿Seguimos?' : '¿Qué hacemos ahora?'}"), 'el recuadro, arriba de la caja');
  assert.ok(chat.includes('{empezo1 && abiertos.filter('), 'los días, recién después de «Empezar mi día 1»');
  assert.ok(chat.includes("if (t) mostrarTutorial(t, { video: m.pestana });"), 'cada «Muéstrame…» corre su tutorial con su video');
  const ruta = fuente('../app/api/reto/route.ts');
  assert.ok(ruta.includes("body.accion === 'dia1'") && ruta.includes("body.accion === 'muestra'"), 'la API guarda lo elegido');
});

test('el desplegable del reto: «El reto de 7 días de MaKo», el video de cada día abierto, el ícono y la flecha (20/11, V2, D1-17, R57-F6)', () => {
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes("const RETO_TITULO_DESPLEGABLE = 'El reto de 7 días de MaKo';") && chat.includes('{RETO_TITULO_DESPLEGABLE}</p>'), 'el título de la maqueta');
  assert.ok(chat.includes('{!futuro && <VideoEnElMenu dia={dia} />}'), 'cada día abierto o hecho, con su video');
  assert.ok(chat.includes('adelántalo al terminar el día de hoy'), 'el texto de la maqueta');
  assert.ok(chat.includes('className="rt-btn__ico"') && chat.includes('className="rt-btn__flecha"'), 'el ícono de la lista y la flecha');
});

test('los tres puntitos: cada mensaje del reto llega después de que MaKo escribe, de a uno (20/11, D1-10 y d24-11)', () => {
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
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
  assert.deepEqual(g.map((x) => x.titulo), ['Para empezar', 'Tu reto de 7 días', 'Cada pestaña']);
  assert.deepEqual(g[0].tarjetas.map((t) => t.key), ['onboarding-bienvenida', 'recorrido'], 'sin video, no hay tarjeta (nunca un hueco)');
  assert.equal(g[1].tarjetas.find((t) => t.key === 'reto-dia-5')?.cerrado, 'Se abre el día 5', 'los días que no llegaron');
  assert.equal(g[1].tarjetas.find((t) => t.key === 'reto-dia-2')?.cerrado, undefined);
  assert.ok(g[2].tarjetas.some((t) => t.key === 'crm' && t.titulo === 'CRM'), 'una por pestaña, con su nombre (nunca «Cómo funciona…», Martín 20/11)');
  const g2 = gruposDelCatalogo(['avatar', 'calendar', 'classroom-calendar'].map((key) => ({ key })), 1);
  assert.deepEqual(g2[0].tarjetas.map((t) => t.titulo), ['Calendar', 'Classroom › Calendar'], 'sin AI Avatar, y sin dos «Calendar»');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
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
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes("const pregunta = termino && !!siguiente && !eligioManana;"), 'la pregunta, recién con el día terminado');
  assert.ok(chat.includes('<AdelantarDia n={siguiente.n}'), 'en el recuadro de opciones, no en la burbuja');
  assert.ok(chat.includes("{ void hacer({ accion: 'despues', dia: dia.n, id: t.id }); }"), '«Lo hago después» se guarda');
  assert.ok(chat.includes('{todas && dia.n === 2 && <Burbuja>'), '«¡Hiciste todo…!» sólo en el día 2');
  // El día 7 la saca del día: va después del cierre del reto (R57-08).
  assert.ok(chat.includes("{p && ((dia.n === 2 && llega2(3)) || (dia.n !== 2 && dia.n !== 7 && diaTerminado(e, dia))) && ("), 'la prueba por WhatsApp, al final del día (la hora del día 2, en su paso)');
  const ruta = fuente('../app/api/reto/route.ts');
  assert.ok(ruta.includes("body.accion === 'despues'") && ruta.includes("body.accion === 'manana'"), 'la API guarda los dos');
});

test('Essential en prueba: el reto abre UNA vez cada cosa de Pro de los días 4 a 6, y lo dice sin vender (20/11, R57-03, la A)', async () => {
  const { decidirProDelReto, VENTANA_MS } = await import('../lib/reto/pro-del-reto');
  const ahora = h('2026-11-22T15:00:00Z');
  const e = { ...base, adelantado: 5 };
  assert.deepEqual(decidirProDelReto(e, 'replicar-guion', { enPrueba: false, ahora }), { abre: false, nuevo: null }, 'fuera de la prueba, el candado de siempre');
  assert.equal(decidirProDelReto(e, 'ai-avatar', { enPrueba: true, ahora }).abre, false, 'el día 6 todavía no se abrió');
  const r = decidirProDelReto(e, 'replicar-guion', { enPrueba: true, ahora });
  assert.equal(r.abre, true); assert.ok(r.nuevo, 'la primera vez se anota');
  const usado = { ...e, pro: { 'replicar-guion': r.nuevo! } };
  assert.deepEqual(decidirProDelReto(usado, 'replicar-guion', { enPrueba: true, ahora: ahora + 60_000 }), { abre: true, nuevo: null }, 'el mismo uso (analizar, generar, guardar)');
  assert.deepEqual(decidirProDelReto(usado, 'replicar-guion', { enPrueba: true, ahora: ahora + VENTANA_MS + 1 }), { abre: false, nuevo: null }, 'la segunda vez, candado');
  for (const [f, fn] of [['lib/editor-landing/replicar-candado.ts', 'replicar-landing'], ['lib/copywriter/replica-candado.ts', 'replicar-guion'], ['lib/editores-ia-pro.ts', 'ia-editores'], ['app/ai-avatar/acceso.ts', 'ai-avatar']]) {
    assert.ok(fuente('../' + f).includes(`abreElReto('${fn}'`), `${f} pregunta al reto`);
  }
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('NOTA_PRO_UNA_VEZ') && !/Pasar a Pro/.test(chat), 'la tarjeta lo dice, sin «Pasar a Pro»');
  const { NOTA_PRO_UNA_VEZ } = await import('../lib/reto/pro-del-reto');
  assert.equal(NOTA_PRO_UNA_VEZ, 'Esto es de Pro: en tu prueba lo usas una vez.');
});

test('la marca de cada tarea lleva la tarea, y la tarjeta del día su título (20/11, f24-03, f24-04, R57-15, R57-F2)', async () => {
  const { marcasDeLaTarea } = await import('../lib/reto/dias');
  const contactos = DIAS_RETO[2].tareas[0];
  const ms = marcasDeLaTarea(contactos);
  assert.equal(ms.at(-1)!.titulo, contactos.titulo); assert.equal(ms.at(-1)!.texto, contactos.detalle);
  const perfil = DIAS_RETO[1].tareas.find((x) => x.id === 'perfil')!;
  assert.equal(marcasDeLaTarea(perfil)[0].titulo, perfil.marcas[0].titulo, 'las del camino quedan como están');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes("{hoy ? 'Lo que te toca hoy' : 'Lo que te tocó'}") && chat.includes('<p className="rt-tarjeta__t">{dia.titulo}</p>'));
});

test('la caja del reto le escribe al MaKo del Ops Center con el contexto del reto, en su conversación (20/11, D1-09 y R57-13)', async () => {
  const { contextoDelRetoDe } = await import('../lib/reto/contexto');
  const e = { ...base, adelantado: 3, hechas: { '3:contactos': 'x' }, leidas: { '3:contactos': 'Leí 134 contactos en tu CRM.' }, despues: ['3:calendar'] };
  const c = contextoDelRetoDe(e, { funnel: 'anuncios-a-whatsapp', intereses: ['Armar mi landing'], ahora: h('2026-11-18T23:00:00Z') });
  assert.match(c, /Va en el día 3 de 7: «Tus contactos y tu primera automatización»/);
  assert.ok(c.includes('Ya hizo hoy: Leí 134 contactos en tu CRM.'), 'lo que MaKo leyó');
  assert.ok(c.includes('Le falta hoy: Tu primera automatización de mensajes (en Automations).'));
  assert.ok(c.includes('Dejó para después: Conecta Google Calendar (en Calendar).'));
  assert.match(c, /armar tu landing/);
  assert.doesNotMatch(c, /nuestro equipo|lo integramos/i, 'sin prometer un equipo');
  assert.match(contextoDelRetoDe(null, {}), /Todavía no empezó su reto/);
  const { TABS_CON_CHAT_PROPIO, TAB_RETO, ORIGEN_RETO, origenDeClave } = await import('../lib/chat-mako-reglas');
  assert.ok(TABS_CON_CHAT_PROPIO.includes(TAB_RETO), 'su conversación propia');
  assert.equal(origenDeClave(`mako-movil:u7:${TAB_RETO}`), ORIGEN_RETO, 'y su fila fija');
  const ruta = fuente('../app/api/mako/chat/route.ts');
  assert.ok(ruta.includes(String.raw`if (desde?.tab === ORIGEN_RETO) return { contexto: ` + '`${CONTEXTO_SECOND_BRAIN}' + String.raw`\n\n` + '${await contextoDelReto(quien.ws)}` };'), 'una rama mínima en contextoDelChat');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('<CajaDelCliente k={k} campo={campo}') && chat.includes('tab: TAB_RETO'), 'la caja de siempre (adjuntos y voz), en la conversación del reto');
  assert.ok(!chat.includes('Para preguntarle algo a MaKo, el Ops Center'), 'sin el texto fijo de antes');
});

test('cambiar el reto no pisa la hora que guardó el WhatsApp en el medio (20/11, lo encontró el chat de WhatsApp)', async () => {
  const { cambiarReto } = await import('../lib/reto/cambiar');
  let guardado: string | null = JSON.stringify({ ...base, adelantado: 3, hechas: {}, leidas: {} });
  let lecturas = 0;
  const io = {
    // La carrera: justo después de la primera lectura de acá, la hora llega por WhatsApp (lib/reto/respuestas.ts) y se guarda.
    leer: async () => { lecturas++; const g = guardado; if (lecturas === 1) guardado = JSON.stringify({ ...JSON.parse(guardado!), horaWa: '18:00' }); return g; },
    cas: async (esperado: string | null, nuevo: string) => { if (esperado !== guardado) return false; guardado = nuevo; return true; },
  };
  const r = await cambiarReto(io, (x) => ({ ...x, hechas: { ...x.hechas, '3:contactos': 'ahora' }, leidas: { ...(x.leidas ?? {}), '3:contactos': 'Leí 5 contactos en tu CRM.' } }));
  const final = JSON.parse(guardado!);
  assert.equal(final.horaWa, '18:00', 'la hora del WhatsApp queda');
  assert.equal(final.leidas['3:contactos'], 'Leí 5 contactos en tu CRM.', 'y lo leído también');
  assert.equal(r?.horaWa, '18:00');
  assert.equal(lecturas, 2, 'perdió el primer compare-and-set y releyó');
  const ruta = fuente('../app/api/reto/route.ts');
  assert.ok(!ruta.includes('setSetting(CLAVE_RETO'), 'la API no reescribe el reto entero');
  assert.ok(ruta.includes('cambiarReto(IO, (x) => ({ ...x, hechas:') && ruta.includes('const escrito = await cambiarReto(IO,'), 'conLoLeido y las acciones, con compare-and-set');
  assert.ok(!fuente('../lib/reto/pro-del-reto-server.ts').includes('setSetting(CLAVE_RETO'), 'el uso de Pro tampoco');
});

test('cada día abre con el velo y MaKo escribiendo, y su video con «dale play»; el día 2 termina en el perfil (20/11, V5, V14, d24-19)', () => {
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes("const fase = useEntrada(`reto-dia-${dia.n}`, hoy);") && chat.includes('<EntradaEscribiendo foto='), 'la entrada del motor (no una propia)');
  assert.ok(chat.includes('useDalePlay(boton, {') && chat.includes('dalePlay={dalePlay} />'), 'el «dale play» del motor, en los dos videos');
  assert.ok(!chat.includes('<video ref='), 'sin el reproductor del navegador (V14)');
  assert.ok(chat.indexOf('<TarjetaHora p={p}') > 0 && chat.indexOf('<TarjetaHora p={p}') < chat.indexOf('<Burbuja><p>{RETO_D2_PERFIL}</p></Burbuja>'), 'la hora antes del perfil');
  assert.ok(chat.includes("const ultimo = dia.n === 2 ? dia.tareas.find((t) => t.id === 'perfil') : undefined;"), 'el perfil sale de la tarjeta del día 2');
});

test('lo que dicen las tareas existe en la app (19/11): sin equipo que integre, el regalo sólo el día 6 (existe desde el 20/11), sin la tab AI Avatar', () => {
  const texto = JSON.stringify(DIAS_RETO);
  assert.doesNotMatch(texto, /integramos|lo hacemos por ti|nuestro equipo/i, 'nada que prometa un equipo: Martín no tiene');
  assert.doesNotMatch(texto, /gratis|ilimitad/i);
  // 20/11: el clip de 10 s de regalo existe (app/second-brain/reto/ClipDelReto.tsx): sólo lo nombra el día 6, el que lo da.
  assert.deepEqual(DIAS_RETO.filter((d) => /regalo/i.test(JSON.stringify(d))).map((d) => d.n), [6], 'el regalo, sólo en el día que lo da');
  assert.doesNotMatch(texto, /AI Avatar/, 'la tab AI Avatar se cerró el 14/11: es «Tu personaje con IA», en Video');
  assert.match(DIAS_RETO[2].tareas[0].detalle, /CSV/, 'los contactos se cargan con un CSV');
});

test('el clip de regalo del día 6 (20/11, R57-02): cada estado de AI Avatar tiene su vista, y la frase cuenta como el servidor', async () => {
  const { vistaDelClip, frasePorEscribir, CADA_MS_CLIP } = await import('../lib/reto/clip-del-reto');
  const { fraseDelClip, MAX_PALABRAS_CLIP } = await import('../lib/reto/clip-regalo-reglas');
  assert.deepEqual(vistaDelClip(null, null), { v: 'nada' }, 'antes de la respuesta, nada (nunca una promesa)');
  assert.deepEqual(vistaDelClip(null, 'El clip de regalo lo pide quien administra el negocio.'), { v: 'aviso', texto: 'El clip de regalo lo pide quien administra el negocio.' }, 'el error, tal cual');
  assert.deepEqual(vistaDelClip({ estado: 'disponible', segundos: 10, maxPalabras: 25 }, null), { v: 'pedir', aviso: null, segundos: 10, max: 25 });
  assert.deepEqual(vistaDelClip({ estado: 'generando', desde: '2026-11-20T10:00:00.000Z' }, null), { v: 'generando' });
  assert.deepEqual(vistaDelClip({ estado: 'listo', url: 'https://x/clip.mp4', planId: 'p1' }, null), { v: 'listo', url: 'https://x/clip.mp4' });
  assert.deepEqual(vistaDelClip({ estado: 'no-disponible', texto: 'El clip de regalo es parte del reto de tu prueba.' }, null), { v: 'aviso', texto: 'El clip de regalo es parte del reto de tu prueba.' });
  const conOtro = vistaDelClip({ estado: 'fallo', texto: 'No salió tu clip. No se te cobró nada: puedes pedirlo otra vez.', puedeReintentar: true }, null);
  assert.equal(conOtro.v, 'pedir', 'un fallo con intento vuelve al formulario');
  assert.equal(conOtro.v === 'pedir' && conOtro.aviso, 'No salió tu clip. No se te cobró nada: puedes pedirlo otra vez.', 'y dice por qué');
  assert.deepEqual(vistaDelClip({ estado: 'fallo', texto: 'Ya se intentó dos veces.', puedeReintentar: false }, null), { v: 'fallo', texto: 'Ya se intentó dos veces.' }, 'sin intento, sin botón');
  assert.equal(CADA_MS_CLIP, 10_000, 'el contrato de AI Avatar: cada ~10 s');

  // La frase: el botón deja mandar exactamente lo que el servidor acepta.
  assert.deepEqual(frasePorEscribir(''), { palabras: 0, lista: false, aviso: null });
  assert.deepEqual(frasePorEscribir('Hola'), { palabras: 1, lista: false, aviso: null }, 'una palabra: todavía no se reta');
  assert.deepEqual(frasePorEscribir('«Tres errores que te cuestan clientes»'), { palabras: 6, lista: true, aviso: null }, 'las comillas no cuentan');
  const larga = Array.from({ length: MAX_PALABRAS_CLIP + 1 }, (_, i) => `p${i}`).join(' ');
  const r = frasePorEscribir(larga);
  assert.equal(r.lista, false);
  assert.match(r.aviso ?? '', new RegExp(`la tuya tiene ${MAX_PALABRAS_CLIP + 1}`), 'si se pasa, cuántas tiene (el texto del servidor)');
  for (const t of ['', 'Hola', 'dos palabras', '« dos palabras »', larga, '  muchas   espacios  y  «comillas» ', Array.from({ length: MAX_PALABRAS_CLIP }, () => 'a').join(' ')]) {
    assert.equal(frasePorEscribir(t).lista, fraseDelClip(t).ok, `cuenta igual que el servidor: «${t.slice(0, 30)}»`);
    const srv = fraseDelClip(t);
    if (srv.ok) assert.equal(frasePorEscribir(t).palabras, srv.palabras, `las mismas palabras que el servidor: «${t.slice(0, 30)}»`);
  }

  // El componente: llama a las acciones de AI Avatar, pregunta cada 10 s SÓLO mientras se genera, y al quedar listo relee el reto.
  // La tarjeta vive en ClipDelReto.tsx (un formulario, no otra caja de chat: tests/chat-unico.test.ts); el día 6 y el releer, en el chat.
  const soloChat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  const clip = fuente('../app/second-brain/reto/ClipDelReto.tsx');
  const chat = soloChat + clip;
  assert.ok(!/<textarea/.test(soloChat), 'el chat del reto no arma otra caja');
  assert.ok(clip.includes('role="alert">{error}<ReportarASoporte /></p>'), 'el error, con «Reportar a Soporte» (tests/reportar-a-soporte.test.ts)');
  assert.ok(chat.includes("import { clipDeRegaloAction, pedirClipDeRegaloAction } from '@/app/ai-avatar/regalo/actions';"), 'las acciones del contrato');
  assert.ok(chat.includes('{dia.n === 6 && <ClipDelReto onListo={onClipListo} />}'), 'en el día 6');
  assert.ok(chat.includes('onClipListo={() => { void leer(); }}'), 'listo, relee el reto: la tarea del clip se marca sola');
  assert.match(chat, /useEffect\(\(\) => \{\n\s+if \(!generando\) return;\n\s+const t = setTimeout\(\(\) => \{ void preguntar\(\); \}, CADA_MS_CLIP\);\n\s+return \(\) => clearTimeout\(t\);\n\s+\}, \[generando, vuelta, preguntar\]\);/,
    'una consulta 10 s después de cada respuesta, sólo mientras se genera');
  assert.ok(chat.includes("if (ahora === 'listo' && antes.current === 'generando') onListo?.();"), 'relee sólo al pasar de «generando» a «listo»');
  assert.ok(!/function ClipDelReto\(\) \{\n\s+return null;/.test(chat), 'ya no es el lugar vacío');
  assert.doesNotMatch(chat, /gratis|ilimitad/i);
});

test('el clip de regalo trae escrita la frase: el gancho de su guion más nuevo, sin cortarlo en silencio (20/11)', async () => {
  const { ganchoDelGuion, guionMasNuevo, frasePorEscribir } = await import('../lib/reto/clip-del-reto');
  const p = (t: string) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
  const sec = (s: string) => ({ type: 'heading', attrs: { level: 2, seccion: s }, content: [{ type: 'text', text: s }] });
  const doc = (...c: object[]) => ({ type: 'doc', content: c }) as never;
  assert.equal(ganchoDelGuion(doc(sec('GANCHO'), p(''), p('¿Tus llamadas no cierran?  Esto te pasa por tres errores.'), sec('HISTORIA'), p('Hace un año…'))),
    '¿Tus llamadas no cierran? Esto te pasa por tres errores.', 'lo que está bajo «Gancho», sin los párrafos vacíos');
  assert.equal(ganchoDelGuion(doc(sec('HISTORIA'), p('Hace un año…'), sec('GANCHO'), sec('CTA'), p('Agenda tu llamada.'))), '', 'un «Gancho» vacío no se llena con otra sección');
  assert.equal(ganchoDelGuion(doc({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Mi guion' }] }, p('Tres errores que te cuestan clientes.'))),
    'Tres errores que te cuestan clientes.', 'sin secciones, el primer párrafo (no el título)');
  const largo = 'Si vendes servicios caros y tus llamadas no cierran, esto es para ti. ' + Array.from({ length: 30 }, (_, i) => `palabra${i}`).join(' ') + '.';
  assert.equal(ganchoDelGuion(doc(sec('GANCHO'), p(largo))), 'Si vendes servicios caros y tus llamadas no cierran, esto es para ti.', 'largo: su primera oración');
  const sinPunto = Array.from({ length: 30 }, (_, i) => `palabra${i}`).join(' ');
  assert.equal(ganchoDelGuion(doc(sec('GANCHO'), p(sinPunto))), sinPunto, 'sin una oración que entre, entero: no se corta en silencio');
  assert.ok(frasePorEscribir(sinPunto).aviso, 'y la cuenta le dice cuánto sobra');
  assert.equal(ganchoDelGuion(null), '');
  assert.deepEqual(guionMasNuevo([{ id: 'a', actualizado: '2026-11-19T10:00:00Z' }, { id: 'b', actualizado: '2026-11-20T10:00:00Z', papelera: '2026-11-20T11:00:00Z' }, { id: 'c', actualizado: '2026-11-19T12:00:00Z' }])?.id, 'c', 'el más nuevo fuera de la papelera');
  assert.equal(guionMasNuevo([]), null);

  const chat = fuente('../app/second-brain/reto/ClipDelReto.tsx');
  assert.ok(chat.includes('setFrase((f) => (f.trim() ? f : g))'), 'nunca le pisa lo que escribió');
  assert.ok(chat.includes("import { pedirAbrir, pedirListar } from '@/app/copywriter/cliente';"), 'con los pedidos de lectura del Copywriter');
  assert.ok(chat.includes('if (!conFormulario || prellenada.current) return;'), 'una sola vez, y sólo con el formulario a la vista');
});

test('tanda 7 (20/11): los textos de la maqueta, las marcas que faltaban y «Tu onboarding» ya hecha (D1-14, d24-24, R57-16, f24-08, d24-20, f24-05, R57-18)', async () => {
  const { DIAS_RETO: D, tareaHecha: hecha, marcasDeLaTarea, leerEstado: leer } = await import('../lib/reto/dias');
  const msj = D.map((d) => d.mensaje);
  assert.deepEqual(msj.slice(1), [
    'Día 2: conectamos todo. Dale play: te muestro la app, la extensión y tus integraciones.',
    'Día 3: tus contactos y tu primera automatización. Dale play: te muestro dónde va todo.',
    'Día 4: copiamos lo que ya le funciona a tu competencia. Dale play.',
    'Día 5: tu carrusel y tu guion, replicando lo que ya funcionó. Dale play.',
    'Día 6: tu video con IA, sin grabarte. El clip de 10 segundos va de regalo. Dale play.',
    'Día 7, el último: tu Marketing CoPilot revisa todo y arma tu semana. Dale play.',
  ], 'los mensajes de los días 2 a 7, los de la maqueta');
  assert.equal(D[0].titulo, 'Tu onboarding, tu oferta y tu sistema de adquisición');
  const t = (n: number, id: string) => D[n - 1].tareas.find((x) => x.id === id)!;
  assert.deepEqual([t(2, 'extension').titulo, t(2, 'extension').detalle], ['La extensión de MaKo para Chrome', 'MaKo a mano mientras navegas: tus leads, tus chats y tus anuncios.'], 'f24-08');
  assert.deepEqual([t(3, 'calendar').titulo, t(3, 'calendar').detalle], ['Conecta Google Calendar', 'Las llamadas que agenden caen en tu calendario.']);
  assert.equal(t(3, 'contactos').detalle, 'Con un CSV, aunque vengan de otro sistema.', 'sin «lo integramos»: el CRM quedó afuera (el Cerebro, 20/11)');
  assert.equal(t(7, 'copilot').detalle, 'Revisa todo lo que armaste en la semana.');
  // «Tu onboarding»: hecha desde el principio, sin lectura ni marca, y lo viejo guardado no la toca.
  const vacio = leer(JSON.stringify({ v: 1, inicio: '2026-11-20T12:00:00Z', adelantado: 0, hechas: {} }))!;
  assert.ok(hecha(vacio, 1, 'onboarding') && !hecha(vacio, 1, 'offer'), '«Tu onboarding» siempre hecha; las demás no');
  // d24-20: el perfil termina en la foto, con «Entendido» (sin clic), y lo marca el motor con ese botón.
  const perfil = t(2, 'perfil').marcas;
  assert.deepEqual(perfil[perfil.length - 1], { sel: '[data-recorrido="tour-settings-foto"]', titulo: 'Tu foto', texto: 'Súbela aquí. Tu nombre, tu WhatsApp y tu negocio ya están guardados.', haz: 'Entendido', lado: 'derecha', listo: 'Entendido', propia: true });
  assert.equal(marcasDeLaTarea(t(2, 'perfil')).at(-1)!.texto, 'Súbela aquí. Tu nombre, tu WhatsApp y tu negocio ya están guardados.', 'el motor muestra SU texto, no el de la tarea');
  const info = fuente('../app/perfil/InformacionPersonal.tsx');
  assert.ok(info.includes('data-recorrido={MARCA.settingsFoto}'), 'el botón de la foto lleva su ancla (la del chat del onboarding, OD-11)');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('{ alOmitir: alDejar, libre: m.libre, ...(m.listo ? { listo: m.listo } : {}) }'), 'marcarTarea le pasa «Entendido» al motor');
  // f24-05: después de CRM, el «⋮» (app/crm/CrmToolbar.tsx, `ancla('crm-mas')`).
  assert.deepEqual(t(3, 'contactos').marcas.map((m) => m.sel), ['aside[data-sidebar] a[href^="/crm"]', '[data-recorrido="crm-mas"]']);
  // R57-18: Video, «Crear desde cero» y la tarjeta «Tu personaje con IA».
  assert.deepEqual(t(6, 'personaje').marcas.map((m) => m.sel), ['aside[data-sidebar] a[href^="/video-editor"]', 'a[href="/video-editor?ver=crear"]', 'button.cr-plantilla[aria-label="Usar la plantilla Tu personaje con IA"]']);
  assert.match(fuente('../app/video-editor/vista.ts'), /RUTA_CREAR_VIDEO = '\/video-editor\?ver=crear'/, 'el link de «Crear desde cero»');
  assert.match(fuente('../app/_crear/TarjetaPlantilla.tsx'), /aria-label=\{`Usar la plantilla \$\{pl\.nombre\}`\}/, 'la tarjeta se nombra así');
  assert.match(fuente('../app/video-editor/plantillas-crear.ts'), /nombre: 'Tu personaje con IA'/);
  // El clip: la marca muestra la tarjeta de regalo del chat.
  assert.equal(t(6, 'clip').marcas[0].sel, '[data-recorrido="sb-reto-dia-6-clip"]');
  assert.ok(marcasDeLaTarea(t(6, 'clip')).length === 1);
});

test('d24-05 y d24-06 (20/11): las integraciones de lo que eligió, con la marca hasta su tarjeta, y el QR de la app en el chat', async () => {
  const { integracionesDelReto, diasDelReto, marcasDeLaTarea } = await import('../lib/reto/dias');
  assert.deepEqual(integracionesDelReto(['anuncios-a-vsl']).map((i) => i.key), ['panda', 'meta'], 'con VSL: el reproductor y Meta');
  assert.deepEqual(integracionesDelReto(['organico']).map((i) => [i.key, i.para]), [['zernio', 'tu funnel de Instagram']]);
  assert.deepEqual(integracionesDelReto(['anuncios-a-whatsapp', 'organico', 'anuncios-a-vsl']).map((i) => i.key), ['meta', 'whatsapp', 'zernio'], 'sin repetir y hasta 3');
  assert.deepEqual(integracionesDelReto([null]).map((i) => i.key), ['meta'], 'sin funnel, Meta (la maqueta)');
  assert.ok(!integracionesDelReto(['anuncios-a-vsl', 'youtube']).some((i) => /calendar|google/.test(i.key)), 'Google Calendar no: es la tarea del día 3');
  const t2 = diasDelReto('organico')[1].tareas.find((x) => x.id === 'integraciones')!;
  assert.match(t2.detalle, /^Instagram \(Zernio\): lo que pide lo que elegiste\./);
  const ult = marcasDeLaTarea(t2).at(-1)!;
  assert.equal(ult.sel, '[data-recorrido="tour-int-zernio"], [data-recorrido="tour-int-mas"]', 'baja hasta la tarjeta (o «Mostrar más», si está escondida)');
  assert.equal(ult.texto, 'La necesitas para tu funnel de Instagram. Conéctala cuando quieras.', 'con su propio texto, no el de la tarea');
  assert.equal(ult.listo, 'Entendido');
  const board = fuente('../app/integraciones/IntegracionesBoard.tsx');
  assert.ok(board.includes('data-recorrido={marcaIntegracion(i.key)}') && board.includes('data-recorrido={MARCA.integracionesMas}'), 'las dos anclas existen');
  // La ruta manda las integraciones con su estado y el QR mientras la app no esté; el chat dibuja las dos tarjetas en el día 2.
  const ruta = fuente('../app/api/reto/route.ts');
  assert.ok(ruta.includes("estadoDeIntegraciones().catch(() => []), tareaHecha(e, 2, 'app') ? null : qrDeLaApp()"), 'el QR sólo con la app sin instalar');
  assert.ok(ruta.includes('if (!e || abierto < 2) return { integraciones: [], qrApp: null };'), 'sólo con el día 2 abierto');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes("{dia.n === 2 && qrApp && !tareaHecha(e, 2, 'app') && !tareaDespues(e, 2, 'app') && <TarjetaQrApp"), 'el QR, junto al video del día 2');
  assert.ok(chat.indexOf('<TarjetaQrApp') < chat.indexOf('<div className="rt-tarjeta" data-recorrido={`sb-reto-dia-${dia.n}`}>'), 'el QR va antes de la tarjeta del día (con el video)');
  assert.ok(chat.includes('{dia.n === 2 && llega2(2) && (integraciones.length > 0\n        ? <TarjetaIntegraciones'), 'la tarjeta de las integraciones en el día 2, en su paso');
  assert.ok(chat.includes("const esperaLaApp = !!d?.qrApp && !!e && !tareaHecha(e, 2, 'app') && !tareaDespues(e, 2, 'app');"), 'relee mientras espera la app');
  const tarjetas = fuente('../app/second-brain/reto/TarjetasDia2.tsx');
  for (const x of ['La app de MaKo en tu teléfono', 'Los avisos de tu negocio, al instante. Aparte de MaKo por WhatsApp.', 'Escanéalo con tu teléfono. Instala MaKo y activa los avisos. Sigo solo cuando estén.', 'Lo hago después', 'Te falta integrar esto', 'Falta integrar']) assert.ok(tarjetas.includes(x), `falta «${x}»`);
});

test('D1-05 (20/11): terminado el día 1 en Funnel Coach, «Vuelve a tu reto» sobre la fila del reto, una vez', () => {
  const h = fuente('../app/second-brain/reto/useVueltaAlReto.ts');
  assert.ok(h.includes("titulo: 'Vuelve a tu reto', texto: 'Tu día 1 está completo.', haz: 'Haz clic en Reto de 7 días'"), 'los textos de la maqueta');
  assert.ok(h.includes('const seCompleto = antes.current === false && completo;'), 'sólo si lo ve completarse (no cada vez que abre Funnel Coach)');
  assert.ok(h.includes('if (!seCompleto || yaMarcada(CLAVE) || senalAhora() || !seVe(MARCA_VUELTA.sel)) return;'), 'una vez por visita, sin pisar otra marca, con la fila a la vista');
  assert.ok(h.includes('if (!activo || completo !== false) return;'), 'relee sólo mientras falta');
  const sb = fuente('../app/second-brain/ChatSecondBrain.tsx');
  assert.ok(sb.includes('useVueltaAlReto(retoV2 && dosCoaches && verFunnel && !reto);'), 'con Funnel Coach a la vista y el reto cerrado');
});

test('tanda 8 (20/11): el cierre del reto con el piloto y lo pendiente (R57-08), lo de ayer en la tarjeta de hoy (d24-21) y el video arriba con su hora (f24-07)', async () => {
  const { DIAS_RETO: D, finDelDia: fin, RETO_PILOTO } = await import('../lib/reto/dias');
  assert.equal(fin(D[6], undefined, '9:00', 'Ana', []), '¡Terminaste tu reto de 7 días, Ana! Tu negocio ya está armado en MaKo.');
  assert.equal(fin(D[6], undefined, '9:00', '', ['calendar', 'clip']), '¡Terminaste tu reto de 7 días! Tu negocio ya está armado en MaKo. Te queda pendiente conectar tu calendario y tu clip de regalo: lo retomas cuando quieras.', 'cierra aunque quede algo, y lo nombra');
  assert.equal(RETO_PILOTO('anuncios-a-vsl'), 'El piloto automático lo prendemos cuando tus anuncios estén corriendo: te aviso.');
  assert.equal(RETO_PILOTO('organico'), 'El piloto automático lo prendemos cuando publiques tu primera semana: te aviso.');
  assert.equal(RETO_PILOTO(null), RETO_PILOTO('youtube'), 'sin funnel, el de publicar');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(!/genial/.test(chat), 'sin «genial»');
  const iFin = chat.indexOf('{finDelDia(actual, siguiente, horaWa, nombre, falta)}'), iPil = chat.indexOf('{RETO_PILOTO(d.funnel)}'), iAudio = chat.indexOf('<TarjetaPrueba p={actual.whatsapp}');
  assert.ok(iFin > 0 && iFin < iPil && iPil < iAudio, 'el cierre, el piloto y recién después la tarjeta del audio');
  assert.ok(chat.includes('? abiertos.flatMap((x) => x.tareas.filter((t) => !tareaHecha(e, x.n, t.id)).map((t) => t.id))'), 'el día 7 nombra lo pendiente de todo el reto');
  // d24-21
  assert.ok(chat.includes('deAntes={dia.n === d.abierto ? abiertos.filter((x) => x.n < dia.n).flatMap((x) => x.tareas.filter((t) => !tareaHecha(e, x.n, t.id))'), 'sólo el día de hoy, con lo sin hacer de antes');
  const iAntes = chat.indexOf('{deAntes.map((x) => fila(x.t, x.n))}');
  assert.ok(iAntes > 0 && iAntes < chat.indexOf('{enLaTarjeta.map((t) => fila(t))}'), 'lo de antes se dibuja, y primero');
  assert.ok(chat.includes('<span className="rt-tarea__de">Del día {n} · </span>'), 'con «Del día N»');
  assert.ok(chat.includes("void hacer({ accion: 'despues', dia: n, id: t.id })"), '«Lo hago después» se guarda en SU día');
  // f24-07
  const iVideo = chat.indexOf('<VideoDelDia dia={dia} onTocado={onTocadoEnVideo}'), iMsj = chat.indexOf('<p className="rt-dia__msj">{dia.mensaje}</p>');
  assert.ok(iVideo > 0 && iVideo < iMsj, 'el video arriba y el texto abajo');
  assert.ok(chat.includes('<Burbuja ancho hora={dia.n > 1 ? hora : null}>'), 'con la hora del mensaje desde el día 2');
});

test('d24-08 (20/11): el día 2 de hoy va en pasos, de a uno y con su mensaje; uno que ya pasó se ve entero', () => {
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes("const paso2 = pasos2 ? ['app', 'extension', 'integraciones'].findIndex((id) => !tareaHecha(e, 2, id) && !tareaDespues(e, 2, id)) : -1;"), 'el paso: el primero sin hacer ni dejar para después');
  assert.ok(chat.includes('const pasos2 = dia.n === 2 && hoy;'), 'sólo el día 2 de HOY');
  assert.ok(chat.includes("const enLaTarjeta = pasos2 ? primeras.filter((t) => t.id === 'app') :"), 'la tarjeta del día empieza sólo con la app');
  assert.ok(chat.includes('{pasos2 && llega2(1) && tarea2(\'extension\') && ('), 'la extensión, en su paso');
  assert.ok(chat.includes('<Burbuja><p>{RETO_D2_EXT}</p></Burbuja>'), 'con su mensaje');
  assert.ok(chat.includes('{ultimo && llega2(3) && ('), 'el perfil, recién con los tres primeros listos');
  assert.ok(chat.includes('const deAUna = hoy && (dia.n === 3 || dia.n === 4);') && chat.includes(': deAUna && iSigue >= 0 ? primeras.slice(0, iSigue + 1) : primeras;'), 'los días 3 y 4 de hoy, de a una tarea');
});

test('R57-19 y R57-20 (20/11): el reto empieza con la prueba, y cada día se abre a su hora en SU zona', async () => {
  const { inicioConLaPrueba, diaAbierto: abierto, leerEstado: leer, desfaseHoras, zonaValida } = await import('../lib/reto/dias');
  const ahora = Date.parse('2026-11-20T15:00:00Z');
  assert.equal(new Date(inicioConLaPrueba(ahora, '2026-11-25T15:00:00Z')).toISOString(), '2026-11-18T15:00:00.000Z', 'el día 1 es el primero de la prueba (cobra en 5 días: empezó hace 2)');
  assert.equal(inicioConLaPrueba(ahora, null), ahora, 'sin prueba (la revisión de Martín), ahora');
  assert.equal(inicioConLaPrueba(ahora, '2026-12-20T15:00:00Z'), ahora, 'nunca en el futuro');
  assert.equal(desfaseHoras(ahora, 'America/Mexico_City'), -6);
  assert.equal(desfaseHoras(ahora, 'America/Argentina/Buenos_Aires'), -3);
  assert.equal(desfaseHoras(ahora, 'Europe/Madrid'), 1);
  assert.equal(desfaseHoras(ahora), -3, 'sin zona, Argentina (los retos de antes)');
  assert.ok(zonaValida('America/Bogota') && !zonaValida('Marte/Base') && !zonaValida('a b'), 'sólo zonas que existen');
  // Empezó el 18 a las 9:00 de México. El 19 a las 13:00 UTC son las 10:00 en Argentina y las 7:00 en México.
  const base = { v: 1, inicio: '2026-11-18T15:00:00Z', adelantado: 1, hechas: {}, leidas: {} };
  const mx = leer(JSON.stringify({ ...base, zona: 'America/Mexico_City' }))!;
  const sin = leer(JSON.stringify(base))!;
  assert.equal(mx.zona, 'America/Mexico_City', 'la zona se guarda');
  assert.equal(leer(JSON.stringify({ ...base, zona: 'Marte/Base' }))!.zona, undefined, 'una zona inválida no');
  assert.equal(abierto(sin, Date.parse('2026-11-19T13:00:00Z')), 2, 'con la hora de Argentina, el 2 ya está abierto');
  assert.equal(abierto(mx, Date.parse('2026-11-19T13:00:00Z')), 1, 'en México son las 7:00: todavía no');
  assert.equal(abierto(mx, Date.parse('2026-11-19T15:00:00Z')), 2, 'a las 9:00 de México, sí');
  const ruta = fuente('../app/api/reto/route.ts');
  assert.ok(ruta.includes("inicio: new Date(inicioConLaPrueba(ahora, await cobroDeLaPrueba())).toISOString()"), 'al empezar, el inicio de la prueba');
  assert.ok(ruta.includes("const zona = typeof body.zona === 'string' && zonaValida(body.zona) ? body.zona : undefined;"), 'y la zona del navegador, validada');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes("accion: 'empezar', zona: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone;"), 'el chat manda su zona al empezar');
});

test('f24-01 y R57-F5 (20/11): el reto abierto en el teléfono dice «Sigamos en tu computadora», antes de cualquier desvío', () => {
  const m = fuente('../app/m/second-brain/page.tsx');
  const i = m.indexOf("if (uno(sp.reto) === '1') {");
  assert.ok(i > 0, 'mira el ?reto=1 del link del correo');
  assert.ok(m.includes('if (yo && ws != null && veOnboardingV2({ email, ws })) return <PantallaM><SeguirEnPcReto nombre={primerNombre(yo.nombre ?? \'\')} email={email} /></PantallaM>;'), 'la pantalla del reto, adentro de PantallaM (tests/movil-refrescar.test.ts)');
  assert.ok(!m.includes('onboarding/ChatArranque'), 'sin el chat del onboarding: le sumaría sus rutas al Ops Center (tests/d6b-rutas.test.ts)');
  assert.ok(i < m.indexOf("if (ctx.sesion.rol === 'admin' && !ctx.impersonando) redirect(await rutaConWs(RUTA_CENTRO_M));"), 'antes del desvío al Centro (perdería el ?reto=)');
  const avisos = fuente('../lib/reto/avisos.ts');
  assert.match(avisos, /RUTA_RETO = '\/second-brain\?reto=1'/, 'el link del correo es ése');
});

test('d24-22 (20/11): el reto es un proyecto del Plan, con una tarea por día que se cierra cuando MaKo leyó todo lo del día', async () => {
  const { planDelReto, tareasDelRetoParaElPlan, diaDeLaUrl, urlDelDiaEnElPlan, RETO_EN_TU_PLAN } = await import('../lib/reto/plan-reglas');
  const { DIAS_RETO: D, leerEstado: leer } = await import('../lib/reto/dias');
  const t = tareasDelRetoParaElPlan(D);
  assert.equal(t.length, 7);
  assert.equal(t[2].titulo, 'Día 3: Tus contactos y tu primera automatización');
  assert.match(t[2].detalle, /^· Carga tus clientes en el CRM\n· Tu primera automatización de mensajes\n· Conecta Google Calendar$/);
  assert.equal(diaDeLaUrl(urlDelDiaEnElPlan(5)), 5);
  assert.equal(diaDeLaUrl('/second-brain?reto=1&dia=12'), null, 'sólo del 1 al 7');
  const iso = '2026-11-20T12:00:00Z';
  const e = leer(JSON.stringify({ v: 1, inicio: iso, adelantado: 3, hechas: { '1:offer': iso, '1:funnel': iso, '2:app': iso }, leidas: { '1:offer': 'x', '1:funnel': 'x', '2:app': 'x' }, despues: ['2:extension', '2:integraciones', '2:perfil'] }))!;
  // Nada en el Plan: crea los 7.
  assert.deepEqual(planDelReto(D, e, []), { crear: [1, 2, 3, 4, 5, 6, 7], cerrar: [] });
  // Con los 7: cierra el día 1 (hecho: «Tu onboarding» va siempre hecha) y no el 2 (lo dejado para después no es hacerlo).
  const enPlan = D.map((d) => ({ dia: d.n, id: String(100 + d.n), hecha: false }));
  assert.deepEqual(planDelReto(D, e, enPlan), { crear: [], cerrar: ['101'] });
  // Nunca reabre: una tarea cerrada a mano de un día sin hacer queda cerrada.
  assert.deepEqual(planDelReto(D, e, enPlan.map((x) => (x.dia === 4 ? { ...x, hecha: true } : x))).cerrar, ['101']);
  assert.deepEqual(planDelReto(D, e, enPlan.map((x) => (x.dia === 1 ? { ...x, hecha: true } : x))).cerrar, [], 'lo ya cerrado no se vuelve a mover');
  assert.equal(leer(JSON.stringify({ v: 1, inicio: iso, adelantado: 1, hechas: {}, enElPlan: true }))!.enElPlan, true, 'se guarda que ya está en el Plan');
  // Por las funciones del Plan, nunca por fuera (el Cerebro, 20/11): ningún archivo del Plan cambia.
  const plan = fuente('../lib/reto/plan.ts');
  assert.ok(plan.includes("import { crearCategoria, crearTarea, listCategorias, listTareas, moverTarea } from '@/lib/todo';"), 'las del Plan de los clientes');
  assert.ok(!/from\(|\.insert\(|\.update\(/.test(plan), 'sin escribir la base por su cuenta');
  assert.ok(plan.includes("return tableroDeCapa((await getWorkspace(ws))?.capa) !== 'dueno';"), 'sólo el tablero de los clientes');
  // La primera vez se reserva con compare-and-set: dos pedidos a la vez no crean el proyecto dos veces.
  const ruta = fuente('../app/api/reto/route.ts');
  assert.ok(ruta.includes('reservo = !!x && x.enElPlan !== true && (await IO.cas(crudo, JSON.stringify({ ...x, enElPlan: true })).catch(() => false));'), 'la reserva');
  assert.ok(ruta.includes('if (reservo) await alPlan();'), 'crea sólo quien la ganó');
  // El final del día 3 lo cuenta y marca Plan, sólo con el proyecto creado.
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('const enElPlan3 = termino && actual?.n === 3 && !!e?.enElPlan;'), 'sólo con el proyecto creado');
  assert.ok(chat.includes("{enElPlan3 && ap.ver('plan') && <Burbuja><p>{RETO_EN_TU_PLAN}</p></Burbuja>}"));
  assert.equal(RETO_EN_TU_PLAN, 'Tu reto también está en tu Plan: cada día se cierra solo cuando leo que lo hiciste.');
  assert.ok(chat.includes("const MARCA_PLAN: MarcaReto = { sel: 'aside[data-sidebar] a[href^=\"/plan\"]'"), 'marca Plan en la barra');
});
