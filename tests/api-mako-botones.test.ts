// =============================================================================
// La API de MaKo declara el texto y los botones de un DM de Instagram, y crea con IA por HTTP (25/10/2026)
// =============================================================================
// El Cerebro (25/10, con el pedido de Leandro): «La API de MaKo no los declara. Leandro configura con su Claude por la API, y ya
// le pasó con Instagram» (memoria api-mako-con-cada-feature). Fija:
//   · `cambiar_botones_mensaje`: por HTTP (lo que usa el Claude de un cliente), de PANTALLA (la persona lo confirma), con
//     `botones` que puede ir vacía (los saca), en el snapshot de HTTP y en docs/api-mako.md;
//   · lo que decide sin escribir (`botonesParaGuardar`, lib/botones-api.ts): sólo un DM de Instagram o Messenger, hasta 3, un
//     título de hasta 20, UNA cosa por botón, «sigue» a otra tarjeta de la misma automatización, un link web; el id de un
//     botón que se queda; y nada que no se pueda publicar (sólo los errores NUEVOS);
//   · la ficha y las inscripciones del lead dicen los botones (con su puerto) y si espera un toque; crear con IA dice que los arma;
//   · el TEXTO de un DM por la misma operación (el Cerebro, 25/10: «editarlos (texto del mensaje, títulos y destino de cada
//     botón)»): sin «botones» se quedan, sin «texto» también; uno de varias partes, al lienzo; con botones, hasta 640;
//   · crear con IA por HTTP (el Cerebro, 25/10: «SÍ, abre `crear_automatizacion_con_ia` por HTTP»): con la IA del negocio,
//     dicho, y 40 s para el modelo por HTTP (la ruta corta a 60).
// Correr: node --import tsx --test tests/api-mako-botones.test.ts
// ROTURAS (25/10/2026, una por vez y restaurada; base 5 / 0): la operación sin http → 4 / 1; «sigue» a la misma tarjeta
// aceptado → 4 / 1; el id de antes perdido → 4 / 1; un error que el flujo ya tenía frena el cambio → 4 / 1; la ficha sin
// los botones → 4 / 1. Y el texto y crear por HTTP (25/10/2026, base 7 / 0): el texto solo no se guarda, el texto con
// botones no se guarda, un texto vacío aceptado, uno de varias partes aceptado, crear sin http, crear sin el plazo de
// HTTP, la ficha sin el puerto → 6 / 1 cada una.
// LE QUITABA HERRAMIENTAS AL CHAT (25/10/2026, con tests/ops-center-clasificador-app; base 55 / 0): las descripciones de
// 3a443b08f → 52 / 3 (sin editar_pasos_secuencia_mensajes ni cambiar_crons_secuencia); vuelven «automatización» y «flujo» →
// 54 / 1 (sin cambiar_crons_secuencia: empata y está declarada antes); nombra «WhatsApp» → 54 / 1. 60 caracteres más queda
// VERDE a propósito: ya no va antes que editar_pasos, así que si crece, la que sale del presupuesto es ella.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { porId } from '../lib/api-mako/registro';
import { botonesParaGuardar } from '../lib/botones-api';
import { botonesDe } from '../lib/botones-social';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const GATE: PasoGrafo[] = [
  { id: 'cron', nodo: 'inicio', canal: 'instagram', siguiente: 'm1' } as PasoGrafo,
  { id: 'm1', canal: 'instagram', cuerpo: '¡Ey! Te dejo el recurso:', siguiente: null, botones: [{ id: 'b1', titulo: 'Obtener recurso', siguiente: 'c1' }] } as PasoGrafo,
  { id: 'c1', nodo: 'condicion', canal: 'instagram', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'sigue_instagram' }], siguiente: 'm2' }], si_no: 'm3' } as PasoGrafo,
  { id: 'm2', canal: 'instagram', cuerpo: '¡Aquí está! https://fiesta.example/recurso', siguiente: null } as PasoGrafo,
  { id: 'm3', canal: 'instagram', cuerpo: 'Síguenos y toca el botón.', siguiente: null, botones: [{ id: 'b1', titulo: 'Ya te sigo', siguiente: 'c1' }] } as PasoGrafo,
  { id: 'w1', canal: 'whatsapp', cuerpo: 'Hola', siguiente: null } as PasoGrafo,
];

test('la operación: por HTTP, de pantalla, y «botones» puede ir vacía (los saca)', () => {
  const d = porId('cambiar_botones_mensaje');
  assert.ok(d, 'no está declarada');
  assert.ok(d.canales.includes('http'), 'el Claude de un cliente usa HTTP');
  assert.equal(d.tipo, 'accion');
  assert.equal((d as { confirmacion?: string }).confirmacion, 'pantalla');
  const b = d.parametros.find((p) => p.nombre === 'botones')!;
  assert.equal(b.vaciaEsValor, true);
  assert.equal(b.obligatorio, undefined, '[] tiene que llegar');
  assert.ok(leer('tests/api-mako-http.snapshot.txt').split('\n').includes('cambiar_botones_mensaje'));
  assert.match(leer('docs/api-mako.md'), /cambiar_botones_mensaje/);
});

test('cambiar los botones: el id de antes se queda, uno nuevo toma uno libre, y un link web', () => {
  const r = botonesParaGuardar(GATE, 'm1', [{ titulo: 'Ver la clase', link: 'https://fiesta.example/clase' }, { titulo: 'obtener recurso', sigue: 'c1' }], 'Recurso');
  assert.ok(r.ok, r.ok ? '' : r.error);
  assert.deepEqual(r.ok && r.botones.map((b) => [b.id, b.titulo, b.siguiente ?? b.url]), [['b2', 'Ver la clase', 'https://fiesta.example/clase'], ['b1', 'obtener recurso', 'c1']]);
  assert.match(r.ok ? r.resumen : '', /«Ver la clase» abre https:\/\/fiesta\.example\/clase · «obtener recurso» sigue en c1/);
  // [] los saca (los de «Ya te sigo»: la condición sigue teniendo quien llegue).
  const sin = botonesParaGuardar(GATE, 'm3', [], 'Recurso');
  assert.ok(sin.ok && botonesDe(sin.pasos.find((p) => p.id === 'm3')).length === 0 && !('botones' in sin.pasos.find((p) => p.id === 'm3')!), sin.ok ? '' : sin.error);
  // Sacarle el único botón a «Obtener recurso» deja la condición y sus mensajes sueltos: no se publica, y se dice.
  const suelta = botonesParaGuardar(GATE, 'm1', [], 'Recurso');
  assert.ok(!suelta.ok && /tarjetas sueltas: c1, m2, m3/.test(suelta.error), suelta.ok ? 'se aceptó' : suelta.error);
});

test('lo que no se puede, dicho: otra tarjeta, otro canal, de más, a la misma, sin decidir, una dirección mala', () => {
  const err = (t: string, l: unknown[]) => { const r = botonesParaGuardar(GATE, t, l as never, 'Recurso'); return r.ok ? '' : r.error; };
  assert.match(err('zz', []), /no tiene una tarjeta «zz»/);
  assert.match(err('w1', [{ titulo: 'A', sigue: 'c1' }]), /un mensaje de Instagram o Messenger: esa tarjeta no lo es/);
  assert.match(err('c1', [{ titulo: 'A', sigue: 'm2' }]), /un mensaje de Instagram o Messenger: esa tarjeta no lo es/);
  assert.match(err('m1', [1, 2, 3, 4].map((k) => ({ titulo: `B${k}`, sigue: 'c1' }))), /hasta 3 botones/);
  assert.match(err('m1', [{ titulo: 'Un título larguísimo de más', sigue: 'c1' }]), /pasa de 20 letras/);
  assert.match(err('m1', [{ titulo: 'A' }]), /hace UNA cosa/);
  assert.match(err('m1', [{ titulo: 'A', sigue: 'c1', link: 'https://x.example' }]), /hace UNA cosa/);
  assert.match(err('m1', [{ titulo: 'A', sigue: 'm1' }]), /no es otra tarjeta/, 'un botón que vuelve al mismo mensaje');
  assert.match(err('m1', [{ titulo: 'A', sigue: 'otra' }]), /no es otra tarjeta/);
  assert.match(err('m1', [{ titulo: 'A', link: 'javascript:alert(1)' }]), /no es una dirección web/);
});

test('un error que el flujo ya tenía no frena; uno NUEVO, sí', () => {
  // El flujo ya tiene un problema (una condición sin ramas): cambiar un botón igual se puede.
  const roto = GATE.map((p) => (p.id === 'c1' ? { ...p, ramas: [] } : p)) as PasoGrafo[];
  assert.ok(botonesParaGuardar(roto, 'm3', [{ titulo: 'Ya te sigo', sigue: 'c1' }], 'Recurso').ok);
  // Un texto de más de 640 con botones no se publica (`problemasDeBotones`): eso sí es nuevo.
  const largo = GATE.map((p) => (p.id === 'm2' ? { ...p, cuerpo: 'x'.repeat(700) } : p)) as PasoGrafo[];
  const r = botonesParaGuardar(largo, 'm2', [{ titulo: 'Más', sigue: 'm3' }], 'Recurso');
  assert.ok(!r.ok && /Así no se puede publicar/.test(r.error), r.ok ? 'se aceptó' : r.error);
});

test('la ficha dice los botones; las inscripciones, si espera un toque; crear con IA, que los arma', () => {
  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /\.\.\.\(botonesDe\(p\)\.length \? \{ botones: botonesDe\(p\)\.map\(\(b\) => \(b\.url \? \{ id: b\.id, titulo: b\.titulo, link: b\.url \} : \{ id: b\.id, titulo: b\.titulo, puerto: `btn:\$\{b\.id\}`, sigue: b\.siguiente \?\? null \}\)\) \} : \{\}\),/);
  assert.match(run, /espera_toque: vivas\.get\(Number\(f\.secuencia_id\)\)!\.esperaToque/);
  const def = leer('lib/api-mako/areas/chatbot.def.ts');
  assert.match(def, /un mensaje de Instagram o Messenger, sus botones: id, titulo y «sigue» —la tarjeta a la que lleva el toque, por el puerto «btn:<id>»—/);
  assert.match(def, /Por Instagram o Messenger arma también los botones del DM, y el recurso a cambio de seguir la cuenta/);
  assert.match(def, /espera_toque: está parado en un DM con botones/);
});

test('el texto de un DM: solo, con botones, y lo que no se puede', () => {
  // Sólo el texto: los botones se quedan como estaban (los ids y lo que cuelga de ellos).
  const solo = botonesParaGuardar(GATE, 'm1', null, 'Recurso', '  ¡Hola {{nombre}}! Aquí va:  ');
  assert.ok(solo.ok, solo.ok ? '' : solo.error);
  const m1 = solo.ok ? solo.pasos.find((p) => p.id === 'm1')! : null;
  assert.equal(m1?.cuerpo, '¡Hola {{nombre}}! Aquí va:');
  assert.deepEqual(botonesDe(m1!).map((b) => [b.id, b.titulo, b.siguiente]), [['b1', 'Obtener recurso', 'c1']]);
  assert.match(solo.ok ? solo.resumen : '', /^Texto del mensaje m1 de «Recurso»: «¡Hola \{\{nombre\}\}! Aquí va:»$/);
  // Texto y botones juntos.
  const los2 = botonesParaGuardar(GATE, 'm3', [{ titulo: 'Ya te sigo', sigue: 'c1' }], 'Recurso', 'Síguenos y vuelve a tocar.');
  assert.ok(los2.ok && los2.pasos.find((p) => p.id === 'm3')!.cuerpo === 'Síguenos y vuelve a tocar.', los2.ok ? '' : los2.error);
  assert.match(los2.ok ? los2.resumen : '', /^Texto \(«Síguenos y vuelve a tocar\.»\) y botones del mensaje m3/);
  const err = (t: string, l: unknown[] | null, x?: string, pasos = GATE) => { const r = botonesParaGuardar(pasos, t, l as never, 'Recurso', x); return r.ok ? '' : r.error; };
  assert.match(err('m1', null), /Pasa los botones, el texto, «en_comentario» o «variantes»/);
  assert.match(err('m1', null, '   '), /no puede quedar vacío/);
  assert.match(err('w1', null, 'Hola'), /un mensaje de Instagram o Messenger/, 'el texto de WhatsApp va por editar_pasos');
  // Con botones, Instagram corta en 640: un texto más largo no se publica.
  assert.match(err('m1', null, 'x'.repeat(700)), /Así no se puede publicar/);
  // Un mensaje de varias partes: al lienzo.
  const conPartes = GATE.map((p) => (p.id === 'm2' ? { ...p, partes: [{ tipo: 'texto', cuerpo: 'Uno' }, { tipo: 'texto', cuerpo: 'Dos' }] } : p)) as PasoGrafo[];
  assert.match(err('m2', null, 'Nuevo', conPartes), /varios mensajes seguidos/);
  // La operación lo declara, y sin «botones» no se pide la lista.
  const d = porId('cambiar_botones_mensaje')!;
  const t = d.parametros.find((p) => p.nombre === 'texto');
  assert.ok(t && !t.obligatorio && t.tipo === 'string');
  assert.match(d.descripcion, /Sin botones, se quedan; sin texto, también/);
  // El 25/10 le quitaba el lugar a editar_pasos_secuencia_mensajes en el chat de MaKo (tests/ops-center-clasificador-app): dice
  // de entrada que es SÓLO para un DM, y no nombra «WhatsApp» (sumaría puntos en un pedido de WhatsApp).
  assert.match(d.descripcion, /^SÓLO para un DM de Instagram o Messenger \(los demás mensajes, con editar_pasos_secuencia_mensajes\)/);
  assert.doesNotMatch(`${d.titulo} ${d.descripcion}`, /whatsapp|texto y botones/i);
  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /const lista = Array\.isArray\(input\.botones\) \? \(input\.botones as BotonPedido\[\]\) : null;/);
});

test('crear con IA sale por HTTP, con la IA del negocio dicha y 40 s para el modelo', () => {
  const d = porId('crear_automatizacion_con_ia')!;
  assert.ok(d.canales.includes('http'));
  assert.equal(d.costo, 'ia');
  assert.equal((d as { lenta?: boolean }).lenta, true);
  assert.match(d.descripcion, /Usa la IA del negocio; por la API, si en 40 s no termina, da un error sin crear nada\./);
  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /const PLAZO_CREAR_HTTP_MS = 40_000;/);
  assert.match(run, /const plazoMs = ctx\.canal === 'http' \? PLAZO_CREAR_HTTP_MS : 170_000;/);
  assert.ok(leer('tests/api-mako-http.snapshot.txt').split('\n').includes('crear_automatizacion_con_ia'), 'el snapshot de HTTP no la tiene');
});

test('crear con IA por HTTP: la pregunta vuelve como `faltan` (400), no como un texto de error (422)', () => {
  // El Cerebro (25/10): «que vuelva como `faltan`, no como texto de error». La de `preparar()` (preguntaAntes) y la que hace
  // el modelo al ejecutar, las dos con el parámetro que la contesta.
  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /if \(!dado\) return \{ error: preguntaParaWhatsApp\(await conConteos\(p, contarCohorte\)\), faltan: \[p\.sobre\] \};/);
  assert.match(run, /if \(!r\.ok && 'pregunta' in r\) return \{ ok: false, resumen: preguntaParaWhatsApp\(r\.pregunta\), datos: \{ faltan: \[r\.pregunta\.sobre\] \} \};/);
  const flujo = leer('lib/api-mako/flujo.ts');
  assert.match(flujo, /ok: r\.yaEstaba === true, resumen: r\.error, via: 'ninguna',\n[^\n]*\n\s+\.\.\.\(r\.faltan\?\.length \? \{ faltan: r\.faltan \} : \{\}\),/, 'aplicarEnElActo perdía el `faltan` de preparar()');
  assert.match(flujo, /if \(faltanAlEjecutar\?\.length\) return \{ ok: false, resumen: c\.resumen, via: 'pendiente', faltan: faltanAlEjecutar \};/);
  const http = leer('lib/api-mako/rutas-http.ts');
  const con400 = http.indexOf('if (res.faltan?.length) return errorJson(400, res.resumen, { faltan: res.faltan }, conPermiso, def);');
  assert.ok(con400 > 0, 'la escritura directa no devuelve `faltan`');
  assert.ok(con400 < http.indexOf('return errorJson(422, res.resumen, {}, conPermiso, def);'), 'el 400 con `faltan` va antes del 422');
});
