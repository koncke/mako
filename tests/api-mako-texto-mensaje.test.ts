// =============================================================================
// El texto de UN mensaje de WhatsApp o email en un flujo CON ramas, por la API de MaKo (25/10/2026)
// =============================================================================
// El Cerebro (25/10): «El hueco que anotaste (cambiar el texto de un mensaje de WhatsApp o email dentro de un flujo CON ramas)
// ciérralo… Usa la misma puerta (`publicarPasos`) y la misma ruta por tarjeta». Fija:
//   · `textoParaGuardar` (lib/botones-api.ts, puro): el texto de un WhatsApp, el texto y/o el asunto de un email, sin tocar
//     nada más del flujo; lo que por ahí no se ve va al lienzo (una nota de voz o un archivo, varias partes, el WhatsApp
//     oficial, un email con diseño) y un DM va por cambiar_botones_mensaje;
//   · cambiar el texto SUELTA las variantes del texto viejo (`variantes: []`), y lo dice; el mismo texto no suelta nada. Vale
//     también para el texto de un DM. `setSecuenciaPasos` respeta el `[]` explícito (antes volvían las guardadas, y el motor
//     las sorteaba: a 4 de cada 5 leads les llegaba el texto viejo);
//   · `cambiar_texto_mensaje`: por HTTP, de PANTALLA, AL FINAL del área (AGENTS.md: no le saca el lugar a editar_pasos ni al
//     CRON en el chat), con su ruta PATCH …/mensajes/{tarjeta}/texto, en el snapshot y en docs/api-mako.md.
// Correr: node --import tsx --test tests/api-mako-texto-mensaje.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { porId, REGISTRO } from '../lib/api-mako/registro';
import { botonesParaGuardar, textoParaGuardar } from '../lib/botones-api';
import type { PasoGrafo } from '../lib/flujo-grafo';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const V = ['Hola {{nombre}}, ¿cómo va?', '¡Ey {{nombre}}!', 'Buenas, {{nombre}}', '¿Qué tal, {{nombre}}?'];
const F: PasoGrafo[] = [
  { id: 'cron', nodo: 'inicio', canal: 'whatsapp', siguiente: 'w1' } as PasoGrafo,
  { id: 'w1', canal: 'whatsapp', cuerpo: 'Hola {{nombre}}', variantes: V, siguiente: 'c1' } as PasoGrafo,
  { id: 'c1', nodo: 'condicion', canal: 'whatsapp', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'contesto' }], siguiente: 'w2' }], si_no: 'e1' } as PasoGrafo,
  { id: 'w2', canal: 'whatsapp', cuerpo: 'Genial, te escribo en un rato.', siguiente: null } as PasoGrafo,
  { id: 'e1', canal: 'email', asunto: 'Te esperamos', cuerpo: 'Hola {{nombre}}, la clase es el jueves.', siguiente: 'w3' } as PasoGrafo,
  { id: 'w3', canal: 'whatsapp', tipo: 'audio', audio_id: 5, cuerpo: 'Te dejo el link', siguiente: 'w4' } as PasoGrafo,
  { id: 'w4', canal: 'whatsapp', proveedor: 'oficial', template_wa: 'recordatorio_clase', cuerpo: 'Mañana es tu clase', siguiente: 'e2' } as PasoGrafo,
  { id: 'e2', canal: 'email', asunto: 'Con diseño', cuerpo: 'texto', cuerpo_html: '<p>texto</p>', siguiente: 'w5' } as PasoGrafo,
  { id: 'w5', canal: 'whatsapp', cuerpo: 'Uno', partes: [{ tipo: 'texto', cuerpo: 'Uno' }, { tipo: 'texto', cuerpo: 'Dos' }], siguiente: 'dm' } as PasoGrafo,
  { id: 'dm', canal: 'instagram', cuerpo: 'Hola por Instagram', variantes: ['Hola, ¿qué tal?', 'Buenas'], siguiente: null } as PasoGrafo,
];
const sin = (pasos: readonly PasoGrafo[], id: string) => pasos.filter((p) => p.id !== id);
const de = (pasos: readonly PasoGrafo[], id: string) => pasos.find((p) => p.id === id) as PasoGrafo & { variantes?: string[]; asunto?: string };
const error = (t: string, nuevo: { texto?: string; asunto?: string }) => { const r = textoParaGuardar(F, t, 'Bienvenida', nuevo); return r.ok ? '' : r.error; };

test('el texto de un WhatsApp en un flujo con ramas: sólo esa tarjeta, y suelta las variantes del texto viejo (lo dice)', () => {
  const r = textoParaGuardar(F, 'w1', 'Bienvenida', { texto: '  Hola {{nombre}}, la clase es a las 19  ' });
  assert.ok(r.ok, r.ok ? '' : r.error);
  const w1 = de(r.pasos, 'w1');
  assert.equal(w1.cuerpo, 'Hola {{nombre}}, la clase es a las 19');
  assert.deepEqual(w1.variantes, [], 'las variantes del texto viejo se sorteaban: 4 de cada 5 recibían lo que ya no decía');
  assert.equal(w1.siguiente, 'c1');
  assert.deepEqual(sin(r.pasos, 'w1'), sin(F, 'w1'), 'no toca nada más del flujo');
  assert.match(r.resumen, /^WhatsApp w1 de «Bienvenida»: texto «Hola \{\{nombre\}\}, la clase es a las 19» \(se quitan sus 4 variantes del texto anterior\)$/);
  // El mismo texto no suelta nada: las variantes siguen siendo de ESE texto.
  const igual = textoParaGuardar(F, 'w1', 'Bienvenida', { texto: 'Hola {{nombre}}' });
  assert.ok(igual.ok && de(igual.pasos, 'w1').variantes?.length === 4 && !/variantes/.test(igual.resumen));
});

test('un email: el texto, el asunto o los dos; el asunto no es de un WhatsApp', () => {
  const asunto = textoParaGuardar(F, 'e1', 'Bienvenida', { asunto: 'Mañana te esperamos' });
  assert.ok(asunto.ok, asunto.ok ? '' : asunto.error);
  assert.equal(de(asunto.pasos, 'e1').asunto, 'Mañana te esperamos');
  assert.equal(de(asunto.pasos, 'e1').cuerpo, 'Hola {{nombre}}, la clase es el jueves.');
  const los2 = textoParaGuardar(F, 'e1', 'Bienvenida', { texto: 'La clase es el viernes.', asunto: 'Cambió el día' });
  assert.ok(los2.ok && de(los2.pasos, 'e1').cuerpo === 'La clase es el viernes.' && de(los2.pasos, 'e1').asunto === 'Cambió el día');
  assert.match(los2.ok ? los2.resumen : '', /^Email e1 de «Bienvenida»: texto «La clase es el viernes\.» y asunto «Cambió el día»$/);
  assert.match(error('w2', { asunto: 'Hola' }), /El asunto es de un email/);
  assert.match(error('e1', { asunto: '  ' }), /El asunto no puede quedar vacío/);
});

test('lo que por aquí no se ve va al lienzo, un DM va por cambiar_botones_mensaje, y nada vacío', () => {
  assert.match(error('w3', { texto: 'Nuevo pie' }), /nota de voz o un archivo: se cambia en el lienzo/);
  assert.match(error('w5', { texto: 'Nuevo' }), /varios mensajes seguidos/);
  assert.match(error('w4', { texto: 'Nuevo' }), /WhatsApp oficial, con una plantilla que aprobó Meta/);
  assert.match(error('e2', { texto: 'Nuevo' }), /tiene diseño: su texto se cambia en el editor del email/);
  assert.ok(textoParaGuardar(F, 'e2', 'Bienvenida', { asunto: 'Otro asunto' }).ok, 'el asunto de un email con diseño sí: el HTML no se toca');
  assert.match(error('dm', { texto: 'Hola' }), /cambiar_botones_mensaje/);
  assert.match(error('c1', { texto: 'Hola' }), /no es un mensaje/);
  assert.match(error('zz', { texto: 'Hola' }), /«Bienvenida» no tiene una tarjeta «zz»/);
  assert.match(error('w2', { texto: '   ' }), /no puede quedar vacío/);
  assert.match(error('w2', {}), /Pasa el texto, el asunto/);
});

test('el texto de un DM también suelta las variantes del texto viejo', () => {
  const r = botonesParaGuardar(F, 'dm', null, 'Bienvenida', 'Hola, te dejo el recurso');
  assert.ok(r.ok, r.ok ? '' : r.error);
  assert.deepEqual(de(r.pasos, 'dm').variantes, []);
  assert.match(r.resumen, /\(se quitan sus 2 variantes del texto anterior\)$/);
});

test('la operación: por HTTP, de pantalla, al FINAL del área, con su ruta; y el guardado respeta un [] explícito', () => {
  const d = porId('cambiar_texto_mensaje')!;
  assert.ok(d, 'no está declarada');
  assert.ok(d.canales.includes('http'));
  assert.equal((d as { confirmacion?: string }).confirmacion, 'pantalla');
  assert.deepEqual(d.parametros.filter((p) => p.obligatorio).map((p) => p.nombre), ['secuenciaId', 'tarjeta']);
  const chatbot = REGISTRO.filter((x) => x.area === 'chatbot').map((x) => x.id);
  // Esto pedía `chatbot.at(-1) === 'cambiar_texto_mensaje'`, o sea «es LA última», y se puso rojo el 31/10/2026 con la
  // primera operación que se declaró después — como se iba a poner con cada una. Lo que la regla de AGENTS.md cuida no es
  // ser la última para siempre: es no HABERLE SACADO EL LUGAR a las que ya estaban. La que importa es la de los CRON, que
  // pesa ~4.100 caracteres y entra de una sola vez o no entra; el margen con el que entra lo mide e imprime el test 4 de
  // tests/ops-center-bateria.
  assert.ok(
    chatbot.indexOf('cambiar_texto_mensaje') > chatbot.indexOf('cambiar_crons_secuencia'),
    'una operación nueva va AL FINAL del área, detrás de las que ya estaban: a igual puntaje el chat trae la declarada antes, y adelantarse le saca el lugar a la que se pidió',
  );
  assert.ok(leer('lib/api-mako/rest.ts').includes("['PATCH', '/chatbot/secuencias/{secuenciaId}/mensajes/{tarjeta}/texto', 'cambiar_texto_mensaje'],"));
  assert.ok(leer('tests/api-mako-http.snapshot.txt').split('\n').includes('cambiar_texto_mensaje'));
  assert.match(leer('docs/api-mako.md'), /cambiar_texto_mensaje/);
  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /const r = textoParaGuardar\(s\.pasos as PasoGrafo\[\], str\(input, 'tarjeta'\), String\(s\.nombre \?\? ''\), \{ texto, asunto \}\);/);
  // Con el «igual» que la propuesta ya avisó (10/11/2026, tests/leandro-whatsapp-0911.test.ts, el 7).
  assert.match(run, /cambiar_texto_mensaje: \{[\s\S]*?await publicarPasos\(id, payload\.pasos as PasoSecuencia\[\], \{ aunqueDuplique: payload\.aunqueDuplique === true \}\);/, 'la misma puerta que el lienzo');
  // `setSecuenciaPasos`: la clave AUSENTE conserva las de antes; un [] explícito es «ya no tiene».
  assert.ok(leer('lib/nutricion.ts').includes('const vs = Array.isArray(p.variantes) ? p.variantes : variantesPrevias.get(idDe(flujo, i));'));
});

// ROTURAS (25/10/2026, harness del scratchpad `roturas-texto.cjs`, una por vez y restaurada; base 5 / 0): el guardado no
// respeta el [] explícito → 4 / 1; cambiar el texto no suelta las variantes → 3 / 2 (el WhatsApp y el DM); el mismo texto las
// suelta; el WhatsApp oficial se reescribe; un email con diseño pierde el HTML; el asunto en un WhatsApp; una nota de voz se
// reescribe; un DM entra por acá → 4 / 1 cada una.
