// =============================================================================
// La VENTANA del chat de la tab Chats (cabecera, hilo, composer): lo que no se ve y rompe en silencio
// =============================================================================
// app/chats/VentanaChat.tsx + Hilo.tsx + Composer.tsx, la copia de respond.io (docs/diseno-chats.md §3).
// Lo que decide la ventana vive puro en app/chats/ventana-reglas.ts y acá se EJECUTA; lo que sólo se
// puede ver en el fuente (una `key`, un atributo, a qué endpoint llama un botón) se lee como texto, sin
// comentarios. Cinco cosas que, rotas, no dan ningún síntoma hasta que le pasan a un cliente:
//
//   · el COMPOSER SE MONTA CON `key` POR CONVERSACIÓN: sin ella, una nota de voz grabada en el chat A
//     sale al contacto B (la sesión de voz guarda el `onSend` del render en que se apretó el 🎤; el
//     mismo bug que fija tests/whatsapp-sexta-tanda.test.ts:319 en /whatsapp);
//   · TODO WHATSAPP SALE CON LA `linea` de la identidad elegida: sin ella el servidor usa la línea por
//     default y, en un negocio con dos números, el mensaje sale por el que no es;
//   · MAKO NUNCA ENVÍA: el botón «MaKo» escribe una sugerencia EN EL CAMPO y la persona decide (un canal
//     propone y una persona confirma);
//   · el enviar del rincón de abajo a la derecha lleva `data-esquina-ocupada` (AGENTS.md: sin la marca,
//     la esquina de los avisos lo tapa y el clic no le llega nunca);
//   · lo que se guarda en el navegador y la caché de fotos llevan el WORKSPACE en la clave (el super
//     admin abre dos clientes en dos pestañas del mismo origen).
//
// Y las reglas que se dibujan: «Posponer hasta» con sus fechas, el hilo agrupado como respond.io, los
// ticks, «No pude leer» como tercer estado y el menú de asignar sin MaKo (la ruta la rechaza).
//
// PROBADO ROMPIÉNDOLO (14/10/2026) con un arnés que aplica cada rotura sola sobre el código en verde
// (16 pass / 0 fail), corre este archivo y restaura de memoria:
//   · `<Composer key={chat.clave}` → `<Composer` en VentanaChat.tsx            → 15 / 1 («se monta con key»)
//   · `linea: i.cuenta` borrado de `cuerpoTextoWhatsApp`                        → 14 / 2 («sale con la línea»
//     y «cada envío de WhatsApp pasa por el armador»)
//   · `fd.append('linea', …)` borrado de `formArchivoWhatsApp`                 → 15 / 1 («sale con la línea»)
//   · `sugerirConMaKo` llama a `enviarTexto()` después de poner la sugerencia  → 15 / 1 («MaKo nunca envía»)
//   · `ponerSugerencia` reemplaza siempre (se come lo que escribió la persona) → 15 / 1 («no pisa»)
//   · `data-esquina-ocupada` borrado del composer                              → 15 / 1 («esquina»)
//   · `claveBorradoresLocal` sin el ws (`'mako-chats-borradores'`)             → 15 / 1 («el ws en la clave»)
//   · `claveFoto` de AvatarRio sin el ws                                        → 15 / 1 («el ws en la clave»)
//   · «Más tarde hoy» siempre en el menú (sin el corte de una hora)             → 15 / 1 («Posponer hasta»)
//   · `candidatosAsignar` sin el filtro de MaKo                                 → 15 / 1 («asignar sin MaKo»)
//   · `textoFallas` devuelve null siempre                                       → 15 / 1 («No pude leer»)
// Restaurado: 16 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IdentidadCanal, MensajeChat } from '../lib/chats-tipos';
import {
  armarHilo, candidatosAsignar, claveBorradoresLocal, cuerpoTextoWhatsApp, etiquetaDia, fechaOpcion, formArchivoWhatsApp,
  guardarBorradorLocal, identidadInicial, leerBorradorLocal, momentoExacto, motivoNoEnvio, opcionesPosponer, partirEnlaces,
  plegarEventos, ponerSugerencia, siguienteEtapa, textoFallas, textoHasta, tickDe,
} from '../app/chats/ventana-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El fuente sin comentarios: un comentario que nombra el patrón no puede hacer pasar el test. */
const sinComentarios = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
  .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

const VENTANA = sinComentarios(leer('app/chats/VentanaChat.tsx'));
const COMPOSER = sinComentarios(leer('app/chats/Composer.tsx'));
const PIEZAS = sinComentarios(leer('app/chats/ventana-piezas.tsx'));
const HILO = sinComentarios(leer('app/chats/Hilo.tsx'));

/** El cuerpo de una función del fuente (desde su firma hasta la llave que la cierra). */
function cuerpoDe(src: string, firma: RegExp): string {
  const m = firma.exec(src);
  assert.ok(m, `no encontré ${firma}: el test no está mirando lo que debe`);
  const desde = src.indexOf('{', m.index + m[0].length - 1);
  let prof = 0;
  for (let i = desde; i < src.length; i++) {
    if (src[i] === '{') prof++;
    else if (src[i] === '}' && --prof === 0) return src.slice(m.index, i + 1);
  }
  assert.fail(`la función ${firma} no cierra`);
}

const wa = (o: Partial<IdentidadCanal> = {}): IdentidadCanal => ({
  canal: 'whatsapp', cuenta: 'ventas', rotulo: 'WhatsApp (Ventas)', destino: '+52 55 1234 5678', ref: '5215512345678@s.whatsapp.net',
  telefono: '5215512345678', ultimaFecha: null, puedeEscribir: true, motivoNoEscribir: null, bloqueado: false, ...o,
});
const ig = (o: Partial<IdentidadCanal> = {}): IdentidadCanal => ({
  canal: 'instagram', cuenta: 'acc_1', rotulo: 'Instagram', destino: '@ana', ref: '77', telefono: null, ultimaFecha: null,
  puedeEscribir: false, motivoNoEscribir: 'Ventana de 24 h cerrada', bloqueado: false, ...o,
});
const msg = (o: Partial<MensajeChat> & { id: string; fecha: string }): MensajeChat => ({
  tipo: 'mensaje', canal: 'whatsapp', cuenta: 'ventas', saliente: false, autor: null, texto: 'hola', formato: 'text',
  mediaUrl: null, mediaMime: null, status: null, error: null, ...o,
});

// ── Las cinco cosas que no se ven ────────────────────────────────────────────────────────────

test('el composer se monta con key por conversación (y la ventana también)', () => {
  // Sin la key, la sesión de voz y los adjuntos juntados en A salen al contacto B.
  assert.match(VENTANA, /<Composer\s+key=\{chat\.clave\}/, 'VentanaChat monta el Composer sin key por conversación');
  assert.equal((VENTANA.match(/<Composer\b/g) ?? []).length, 1, 'hay más de un montaje del Composer: revisar que todos lleven key');
  // La clave del montaje es SIEMPRE la de la lista: si la lectura devolviera otra, el composer se
  // remontaría a mitad de escribir. Se fija la línea que la pisa.
  assert.match(VENTANA, /const chat: ChatResumen = \{ \.\.\.base, \.\.\.\(parche\?\.datos \?\? \{\}\), clave \}/, 'la clave del chat dibujado no es la de la lista');
  // El otro lado del contrato (§3): ChatsApp monta la ventana con key por clave.
  assert.match(sinComentarios(leer('app/chats/ChatsApp.tsx')), /<VentanaChat\s+key=\{seleccion\.clave\}/, 'ChatsApp monta VentanaChat sin key por clave');
});

test('todo WhatsApp sale con la línea de la identidad elegida (texto y multipart)', () => {
  const i = wa({ cuenta: 'soporte' });
  assert.deepEqual(cuerpoTextoWhatsApp(i, 'hola', 12), { chat: i.ref, telefono: i.telefono, texto: 'hola', leadId: 12, linea: 'soporte' });
  const fd = formArchivoWhatsApp(i, new Blob(['x']), 'a.pdf', { leadId: 12, caption: 'mira', tipo: '' });
  assert.equal(fd.get('linea'), 'soporte', 'el multipart sale sin la línea');
  assert.equal(fd.get('chat'), i.ref);
  assert.equal(fd.get('caption'), 'mira');
  assert.equal(fd.get('tipo'), '');
  assert.ok(fd.get('archivo') instanceof Blob);
  const voz = formArchivoWhatsApp(i, new Blob(['x']), 'nota-de-voz.mp3', { leadId: null, tipo: 'audio' });
  assert.equal(voz.get('linea'), 'soporte');
  assert.equal(voz.get('tipo'), 'audio');
  assert.equal(voz.get('leadId'), null, 'sin lead no se manda un leadId vacío');
  // Un WhatsApp SIN línea no sale: caería a la línea por default.
  assert.equal(motivoNoEnvio(wa({ cuenta: null }), false), 'Falta la línea de WhatsApp');
  assert.equal(motivoNoEnvio(wa(), false), null);
});

test('cada envío de WhatsApp del composer pasa por el armador que pone la línea', () => {
  const usos = COMPOSER.match(/\/api\/whatsapp\/evolution\/mensajes/g) ?? [];
  assert.equal(usos.length, 2, `esperaba 2 envíos a /api/whatsapp/evolution/mensajes (texto y archivo), hay ${usos.length}`);
  assert.match(COMPOSER, /postJson<[^>]*>\('\/api\/whatsapp\/evolution\/mensajes', cuerpoTextoWhatsApp\(/, 'el texto de WhatsApp no sale por cuerpoTextoWhatsApp');
  assert.match(COMPOSER, /const fd = formArchivoWhatsApp\(/, 'el archivo de WhatsApp no se arma con formArchivoWhatsApp');
  assert.match(COMPOSER, /fetch\('\/api\/whatsapp\/evolution\/mensajes', \{ method: 'POST', body: fd\b/, 'el multipart no manda el `fd` armado');
  // Y el armador del texto no se puede «olvidar» de la línea: la pone siempre, aunque sea null.
  assert.ok('linea' in cuerpoTextoWhatsApp(wa(), 'x', null), 'cuerpoTextoWhatsApp perdió el campo linea');
});

test('MaKo nunca envía: sugiere en el campo y la persona decide', () => {
  const mako = cuerpoDe(COMPOSER, /async function sugerirConMaKo\(\)/);
  assert.match(mako, /'\/api\/whatsapp\/advisor'/, 'el botón MaKo no le pide la sugerencia al asesor');
  assert.match(mako, /action: 'recommend'/, 'el pedido al asesor no es `recommend`');
  for (const prohibido of [
    /\/api\/whatsapp\/evolution\/mensajes/, /\/api\/chats\/social/, /\/api\/whatsapp\/evolution\/borradores/,
    /\benviarTexto\(/, /\benviarAdjuntos\(/, /\bresolverBorrador\(/, /\bmandarArchivo\(/, /\bonPendiente\(/, /\bonEnviado\(/,
  ]) {
    assert.doesNotMatch(mako, prohibido, `sugerirConMaKo envía algo (${prohibido}): MaKo propone, una persona confirma`);
  }
  assert.match(mako, /setTexto\(nuevo\)/, 'la sugerencia no va al campo');
});

test('la sugerencia de MaKo no pisa lo que escribió la persona', () => {
  assert.equal(ponerSugerencia('', null, 'Hola Ana'), 'Hola Ana');
  assert.equal(ponerSugerencia('  ', null, 'Hola Ana'), 'Hola Ana');
  // Pedir otra cambia la anterior (es cambiar de idea), no las apila.
  assert.equal(ponerSugerencia('Hola Ana', 'Hola Ana', '¿Seguimos mañana?'), '¿Seguimos mañana?');
  // Lo propio queda, y la sugerencia va debajo.
  assert.equal(ponerSugerencia('Mira esto  ', 'Hola Ana', 'Hola Ana'), 'Mira esto\n\nHola Ana');
});

test('el enviar del rincón lleva data-esquina-ocupada', () => {
  assert.match(COMPOSER, /<div className="rio-comp" data-esquina-ocupada="">/, 'el composer perdió data-esquina-ocupada: la esquina de avisos tapa el Enviar');
  // El enviar vive adentro de esa raíz (es lo que la marca protege).
  const raiz = COMPOSER.indexOf('data-esquina-ocupada');
  assert.ok(COMPOSER.indexOf('className="rio-enviar"', raiz) > raiz, 'el Enviar no está dentro de la raíz marcada');
});

test('lo del navegador y la caché de fotos llevan el ws en la clave', () => {
  assert.equal(claveBorradoresLocal(7), 'mako-chats-borradores:ws7');
  assert.notEqual(claveBorradoresLocal(7), claveBorradoresLocal(8));
  const mem = new Map<string, string>();
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  guardarBorradorLocal(st, 7, 'lead:1', 'hola');
  assert.equal(leerBorradorLocal(st, 7, 'lead:1'), 'hola');
  assert.equal(leerBorradorLocal(st, 8, 'lead:1'), '', 'el borrador de un cliente aparece en el otro');
  assert.deepEqual([...mem.keys()], ['mako-chats-borradores:ws7']);
  // Sin ws no se guarda ni se lee nada (no hay a qué cliente atarlo).
  guardarBorradorLocal(st, null, 'lead:1', 'x');
  assert.equal(leerBorradorLocal(st, null, 'lead:1'), '');
  // Vaciar el texto borra el borrador.
  guardarBorradorLocal(st, 7, 'lead:1', '   ');
  assert.equal(leerBorradorLocal(st, 7, 'lead:1'), '');
  // Un almacén roto no tira.
  const roto = { getItem: () => '{no es json', setItem: () => { throw new Error('lleno'); } };
  assert.equal(leerBorradorLocal(roto, 7, 'lead:1'), '');
  assert.doesNotThrow(() => guardarBorradorLocal(roto, 7, 'lead:1', 'x'));
  // En el fuente: nadie toca el almacén con una clave literal, y la caché de fotos lleva el ws.
  for (const [nombre, src] of [['Composer', COMPOSER], ['VentanaChat', VENTANA], ['Hilo', HILO], ['ventana-piezas', PIEZAS]] as const) {
    assert.doesNotMatch(src, /\.(getItem|setItem|removeItem)\(\s*['"`]/, `${nombre}: una clave literal en el almacén del navegador (sin ws)`);
  }
  assert.match(PIEZAS, /const claveFoto = `\$\{ws \?\? 0\}\|\$\{digitos\}`/, 'la caché de «sin foto» no lleva el ws');
  assert.match(PIEZAS, /sinFoto\.has\(claveFoto\)/);
});

// ── Lo que se dibuja ─────────────────────────────────────────────────────────────────────────

test('Posponer hasta: las siete opciones de respond.io con su fecha, y «Más tarde hoy» sólo si cae después de «1 hora»', () => {
  // Jueves 15/10/2026, 3:52 p. m. (la captura 43 de respond.io es un jueves a esa hora).
  const jue = new Date(2026, 9, 15, 15, 52);
  const o = opcionesPosponer(jue);
  assert.deepEqual(o.map((x) => x.label), ['30 min', '1 hora', '3 horas', 'Más tarde hoy', 'Mañana', 'Este fin de semana', 'Próxima semana']);
  assert.deepEqual(o.map((x) => fechaOpcion(x.hasta)), [
    'jue, 4:22 p. m.', 'jue, 4:52 p. m.', 'jue, 6:52 p. m.', 'jue, 6:00 p. m.', 'vie, 8:00 a. m.', 'sáb, 8:00 a. m.', 'jue, 8:00 a. m.',
  ]);
  assert.equal(o[6].hasta.getDate(), 22, '«Próxima semana» es el mismo día de la semana que viene');
  // A las 5:30 p. m. «Más tarde hoy» (6:00) caería antes que «1 hora» (6:30): sale del menú.
  assert.ok(!opcionesPosponer(new Date(2026, 9, 15, 17, 30)).some((x) => x.key === 'hoy'));
  // Un sábado, «Este fin de semana» es el domingo; un domingo, el sábado que viene.
  assert.equal(opcionesPosponer(new Date(2026, 9, 17, 16, 0)).find((x) => x.key === 'finde')?.hasta.getDay(), 0);
  const dom = opcionesPosponer(new Date(2026, 9, 18, 16, 0)).find((x) => x.key === 'finde')?.hasta;
  assert.equal(dom?.getDay(), 6);
  assert.equal(dom?.getDate(), 24);
  // El subtítulo de la cabecera.
  assert.equal(textoHasta(new Date(2026, 9, 15, 18, 15).toISOString(), jue), 'hoy, 6:15 p. m.');
  assert.equal(textoHasta(new Date(2026, 9, 16, 8, 0).toISOString(), jue), 'mañana, 8:00 a. m.');
  assert.equal(textoHasta(new Date(2026, 11, 12, 8, 0).toISOString(), jue), '12 dic, 8:00 a. m.');
  assert.equal(textoHasta('no es fecha', jue), null);
});

test('el chip de fecha dice Hoy, Ayer o «12 dic 2025», y el tooltip la hora exacta', () => {
  const ahora = new Date(2026, 9, 15, 10, 0);
  assert.equal(etiquetaDia(new Date(2026, 9, 15, 0, 1), ahora), 'Hoy');
  assert.equal(etiquetaDia(new Date(2026, 9, 14, 23, 59), ahora), 'Ayer');
  assert.equal(etiquetaDia(new Date(2025, 11, 12, 9, 0), ahora), '12 dic 2025');
  const iso = new Date(2026, 5, 4, 14, 57, 41).toISOString();
  assert.equal(momentoExacto(iso, true), 'Enviado: 4 jun, 2:57:41 p. m.');
  assert.equal(momentoExacto(iso, false), 'Recibido: 4 jun, 2:57:41 p. m.');
  assert.equal(momentoExacto(iso, null), '4 jun, 2:57:41 p. m.');
  assert.equal(momentoExacto('', true), '');
});

test('el hilo se arma como respond.io: por día, agrupado por quién habla, eventos juntos', () => {
  const ahora = new Date(2026, 9, 15, 12, 0);
  const f = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
  const dias = armarHilo([
    msg({ id: 'wa:1', fecha: f(14, 9) }),
    msg({ id: 'wa:2', fecha: f(14, 9, 1) }),
    msg({ id: 'wa:3', fecha: f(14, 9, 2), saliente: true }),
    msg({ id: 'ev:1', fecha: f(15, 8), tipo: 'evento', canal: null, partes: [{ t: 'Cerrada por ' }, { t: 'Ana', b: true }] }),
    msg({ id: 'ev:2', fecha: f(15, 8, 1), tipo: 'evento', canal: null }),
    msg({ id: 'ig:1', fecha: f(15, 9), canal: 'instagram' }),
    msg({ id: 'wa:4', fecha: f(15, 9, 1) }),
    msg({ id: 'nota:1', fecha: f(15, 10), tipo: 'comentario', canal: null, saliente: true, autor: 'Ana' }),
    msg({ id: 'x', fecha: 'roto' }),
  ], ahora);
  assert.deepEqual(dias.map((d) => d.etiqueta), ['Ayer', 'Hoy'], 'un mensaje sin fecha legible abrió un día propio');
  const ayer = dias[0].items;
  assert.deepEqual(ayer.map((it) => (it.k === 'msg' ? [it.m.id, it.primero, it.ultimo] : it.k)), [
    ['wa:1', true, false], ['wa:2', false, true], ['wa:3', true, true],
  ]);
  const hoy = dias[1].items;
  assert.equal(hoy[0].k, 'eventos');
  assert.deepEqual(hoy[0].k === 'eventos' ? hoy[0].eventos.map((e) => e.id) : [], ['ev:1', 'ev:2']);
  // Otro canal es otro grupo (cada uno lleva su insignia), y un comentario nunca se junta con un mensaje.
  // (`x` no tiene fecha legible: va al día del anterior, nunca a un «1 ene 1970».)
  assert.deepEqual(hoy.slice(1).map((it) => (it.k === 'msg' ? [it.m.id, it.primero, it.ultimo] : it.k)), [
    ['ig:1', true, true], ['wa:4', true, true], ['nota:1', true, true], ['x', true, true],
  ]);
  // Una tirada larga de eventos se pliega: 3 arriba, «N eventos más», 2 abajo.
  assert.deepEqual(plegarEventos([1, 2, 3, 4, 5, 6]).ocultos, []);
  assert.deepEqual(plegarEventos([1, 2, 3, 4, 5, 6, 7, 8]), { cabeza: [1, 2, 3], ocultos: [4, 5, 6], cola: [7, 8] });
});

test('los ticks de la saliente y los links del texto', () => {
  assert.deepEqual(['sent', 'delivered', 'read', 'failed', null].map((s) => tickDe(s as MensajeChat['status'])), ['enviado', 'entregado', 'leido', 'fallido', null]);
  assert.match(HILO, /title=\{m\.error \|\| 'No se entregó'\}/, 'el fallido no muestra el error del canal en el tooltip');
  assert.deepEqual(partirEnlaces('Mira https://mako.app/x. Escribe a ana@mail.com, gracias'), [
    { t: 'Mira ' }, { t: 'https://mako.app/x', href: 'https://mako.app/x' }, { t: '. Escribe a ' },
    { t: 'ana@mail.com', href: 'mailto:ana@mail.com' }, { t: ', gracias' },
  ]);
});

test('por dónde se escribe: la identidad inicial puede escribir, y el motivo cuando no', () => {
  assert.equal(identidadInicial([ig(), wa()])?.canal, 'whatsapp', 'arrancó por una identidad que no puede escribir');
  assert.equal(identidadInicial([ig()])?.canal, 'instagram', 'sin ninguna que pueda, la primera igual (gris con su motivo)');
  assert.equal(identidadInicial([]), null);
  assert.equal(motivoNoEnvio(ig(), false), 'Ventana de 24 h cerrada');
  assert.equal(motivoNoEnvio(wa(), true), 'Contacto bloqueado');
  assert.equal(motivoNoEnvio(null, false), 'Sin canal para escribir');
});

test('el menú de asignar ofrece el equipo sin MaKo (la ruta la rechaza), sin repetidos ni la actual', () => {
  const equipo = [{ nombre: 'Ana' }, { nombre: 'Luis' }, { nombre: 'Ana' }, { nombre: 'MaKo' }, { nombre: ' ' }, { nombre: 'Lucía' }];
  assert.deepEqual(candidatosAsignar(equipo, null, ''), ['Ana', 'Luis', 'Lucía']);
  assert.deepEqual(candidatosAsignar(equipo, 'Ana', ''), ['Luis', 'Lucía']);
  assert.deepEqual(candidatosAsignar(equipo, null, 'lu'), ['Luis', 'Lucía']);
  // En el fuente: la cabecera usa esta regla y no arma su propia lista con MaKo.
  assert.match(VENTANA, /candidatosAsignar\(equipo, chat\.asignado, busca\)/);
  assert.doesNotMatch(VENTANA, /'MaKo'\]/, 'la cabecera vuelve a sumar MaKo a mano a los candidatos');
});

test('«No pude leer» es un tercer estado: la franja nombra lo que falta', () => {
  const canales = [wa({ cuenta: 'ventas', rotulo: 'WhatsApp (Ventas)' })];
  assert.equal(textoFallas([], canales), null);
  assert.equal(textoFallas(['whatsapp:ventas', 'notas'], canales), 'No pude leer: WhatsApp (Ventas), comentarios.');
  assert.equal(textoFallas(['whatsapp:otra', 'instagram', 'instagram'], canales), 'No pude leer: WhatsApp (otra), Instagram y Messenger.');
  // La ventana la dibuja (y no la tira): las `fallas` del hilo llegan a la pantalla.
  assert.match(VENTANA, /textoFallas\(hilo\?\.fallas \?\? \[\], chat\.canales\)/);
  // Sin nada leído, el hilo dice que no pudo y ofrece Reintentar; nunca «Sin mensajes todavía».
  assert.match(HILO, /\{error \? \(/, 'el hilo vacío no distingue «no pude leer» de «no hay mensajes»');
});

test('la etapa: la flecha pasa a la siguiente, y sin etapa a la primera', () => {
  const etapas = [{ key: 'a', label: 'Nuevo', color: '#000' }, { key: 'b', label: 'Caliente', color: '#000' }];
  assert.equal(siguienteEtapa(etapas, null)?.key, 'a');
  assert.equal(siguienteEtapa(etapas, 'a')?.key, 'b');
  assert.equal(siguienteEtapa(etapas, 'b'), null);
  assert.equal(siguienteEtapa(etapas, 'borrada'), null, 'una etapa que ya no existe no salta a la primera');
  assert.equal(siguienteEtapa([], null), null);
});

test('la ventana usa los endpoints del plano (§2.2 y §2.3) y no inventa otros', () => {
  for (const ruta of ['/api/chats/hilo?clave=', '/api/chats/estado', '/api/chats/asignar', '/api/chats/etapa', '/api/chats/lead', '/api/whatsapp/evolution/block']) {
    assert.ok(VENTANA.includes(ruta), `VentanaChat no usa ${ruta}`);
  }
  for (const ruta of ['/api/chats/social', '/api/chats/comentario', '/api/whatsapp/evolution/borradores', '/api/whatsapp/advisor']) {
    assert.ok(COMPOSER.includes(ruta), `Composer no usa ${ruta}`);
  }
  // El sondeo del hilo: 8 s con la pestaña a la vista y corte a los 15 s.
  assert.match(VENTANA, /const SONDEO_MS = 8_000;/);
  assert.match(VENTANA, /const CORTE_MS = 15_000;/);
  assert.match(VENTANA, /document\.visibilityState === 'visible'\) void cargar\(\)/);
  assert.match(VENTANA, /AbortSignal\.timeout\(CORTE_MS\)/);
});
