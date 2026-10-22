// =============================================================================
// La extracción de reuniones: sin datos inventados, con el nombre real y sin perder pedidos (17/10/2026)
// =============================================================================
// Martín pidió revisar si la extracción funciona, y se leyeron enteras las dos llamadas suyas del 16/10 contra las
// tarjetas que dejaron (docs/hallazgos-plan.md, «La extracción del 16/10 leída contra las dos transcripciones»).
// Este test fija los arreglos, y abajo están los NÚMEROS de la medición.
//
// MEDIDO EL 17/10/2026, con la extracción real (Gemini, la cascada gratis del Plan) sobre las dos llamadas:
//   «Revisión de MaKo» con Código Inmobiliario (Fathom 193666833, 123 min, 80k caracteres) y «Mau <> Martin»
//   (193681029, 121 min, 119k). La referencia son las 50 tarjetas #843-#892: las 37 que sacó la extracción el 16/10
//   y las 13 que se cargaron a mano porque faltaban. Cada par se revisó a mano, no sólo por parecido.
//
//   |                                              | 16/10 (antes) | 17/10, partes de 20k (lo que queda) |
//   |----------------------------------------------|---------------|-------------------------------------|
//   | pedidos de la revisión encontrados           | 26 de 36      | 30 de 36                            |
//   | pedidos de la llamada con Mauricio           | 11 de 14      | 11 de 14                            |
//   | tarjetas con «Martin Carballo»               | 17 de 37      | 0 de 55                             |
//   | tarjetas con un dato técnico que nadie dijo  | 14 de 37 (*)  | 0 de 55                             |
//   | bugs de MaKo archivados en «Cliente: X»      | 37 de 37      | 0                                   |
//   | largo del detalle (mediana)                  | 1.291         | ~960                                |
//   | tiempo de lectura                            | —             | 279 s y 154 s                       |
//   (*) las 6 que encontró la lectura a mano («Claude 3.5 Sonnet de 200k», «Sendgrid / Resend o similar»,
//   «Baileys», «inicio de 2025», «Pro/Team», «React Error Boundary») y 8 más del mismo tipo que encontró el control
//   (`DateRangeFilter`, «Graph», «CORS», «onPaste», «proyectoId», «DOM»…): ingeniería supuesta, no lo dicho.
//   Lo que todavía falta: la revisión pierde el bug de pantalla completa del Second Brain, «que guarde solo», Pablo
//   que no pudo agendar, el «43» de Offer y la tab de email de Chats (5 de los 10 que faltaban se recuperan, y
//   se pierde 1 que antes estaba). Los 3 de Mauricio son dudosos: «quitar» se resolvió en vivo, el «revísalo» del
//   repo es un pedido A él, y el cobro «vencido» estaba a verificar.
//   Con partes de 15k se encontraba lo mismo (30 de 36) y la de Mauricio tardó 399 s, más que los 300 s de Vercel.
//   La que estaba en «Cliente: Mauricio» es trabajo de SU negocio (su reto, sus anuncios): 10 tareas, 8 de él.
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. `limpiarLoDicho` sin `sacarLoNoDicho` ........................................ 1 fallo
//   2. `seDijo` sin «una letra de diferencia» (Maco / MaKo) .......................... 1 fallo
//   3. `datosDe` tomando cualquier número (los montos) ............................... 1 fallo
//   4. `fuenteDeDatos` sin las palabras sin puntuación («HMO.») ...................... 1 fallo
//   5. `aliasDelDueno` sin exigir el MISMO email ..................................... 1 fallo
//   6. el prompt otra vez con «MÍNIMO 600 caracteres» ................................ 1 fallo
//   7. `sinCitas` revisando también lo que va entre « » .............................. 1 fallo
//   8. `coerceCandidatas` sin pasar por `limpiarLoDicho` ............................. 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fuenteDeDatos, permitidosDe, sacarLoNoDicho, seDijo, limpiarLoDicho } from '../lib/detalle-sin-inventos';
import { aliasDelDueno, conNombreReal } from '../lib/tarea-dueno';

// Renglones reales de las dos llamadas (recortados): es lo que la tarjeta puede afirmar.
const DICHO = fuenteDeDatos([
  '[00:55:05] Martin Carballo: recargar la página directamente. Esta pantalla se rompió, bueno, otro bug, al entrar al editor dice Esta pantalla se rompió al dibujarse.',
  '[01:38:17] Juan Ejemplo: Sí, leí solo al principio 40.000 de 64.000 caracteres.',
  '[01:38:24] Martin Carballo: Esa es otra cosa que la ventana de contexto solamente lee 40.000 caracteres.',
  '[00:42:02] Martin Carballo: tu API key es restringida solo para enviar email. Esto es un error de Maco.',
  '[00:28:04] Mauricio Ejemplo Uno: te pagó 4.000 en lugar de 6.000, para el de 20 mil dólares.',
  '[00:23:54] Mauricio Ejemplo Uno: no sé por qué hay dos Macarios, el de HMO.',
  '[01:40:02] Mauricio Ejemplo Uno: el programa sale nueve mil quinientos, y Joan lo vio.',
].join('\n'));
const PERMITIDOS = permitidosDe(['Feature: Video Editor', 'Feature: Offer Generator', 'Martin Koncke']);

test('el dato técnico que nadie dijo se saca con su renglón; lo dicho y las citas quedan', () => {
  const detalle = [
    '**Qué hay que hacer**', 'Arreglar el editor de video, que se rompe al entrar.', '',
    '**Por qué**', '«al entrar al editor dice Esta pantalla se rompió al dibujarse» (Martin Koncke, 00:55:05). Lo atribuyó al React del modal.', '',
    '**Detalles concretos**',
    '- Capturar el error en el React Error Boundary para que no se congele todo.',
    '- Pasa al recargar la página directamente.',
    '- Subir el límite para modelos como Claude 3.5 Sonnet de 200k tokens.',
    '- La ventana lee 40.000 de 64.000 caracteres.',
    '- Validar la clave del proveedor (Sendgrid / Resend o similar).',
    '- Joan lo contó así: «lo probé en el Vercel de prueba».', '',
    '**Listo cuando**', 'Se entra al editor sin que diga «Esta pantalla se rompió».',
  ].join('\n');
  const r = sacarLoNoDicho(detalle, DICHO, PERMITIDOS);
  assert.ok(!/Boundary|Sonnet|Sendgrid/.test(r.detalle), r.detalle);
  assert.ok(r.detalle.includes('- Pasa al recargar la página directamente.'), 'lo dicho queda');
  assert.ok(r.detalle.includes('- La ventana lee 40.000 de 64.000 caracteres.'), 'un número dicho queda');
  assert.ok(r.detalle.includes('«al entrar al editor dice Esta pantalla se rompió al dibujarse» (Martin Koncke, 00:55:05)'), 'la cita y el minuto no se tocan');
  assert.ok(!r.detalle.includes('Lo atribuyó al React'), 'la frase suelta con el dato inventado se va');
  assert.ok(r.detalle.includes('«lo probé en el Vercel de prueba»'), 'lo que va entre « » es la voz de la reunión: no se revisa');
  assert.deepEqual([...new Set(r.sacado)].sort(), ['200k', '3.5', 'Boundary', 'React', 'Sendgrid', 'Sonnet'].sort());
  for (const t of ['**Qué hay que hacer**', '**Por qué**', '**Detalles concretos**', '**Listo cuando**']) assert.ok(r.detalle.includes(t), `queda el título ${t}`);
});

test('no es un invento: el nombre mal transcripto, un monto dicho en palabras, una palabra con punto', () => {
  assert.equal(seDijo('MaKo', DICHO), true, '«Maco» en la transcripción');
  assert.equal(seDijo('20.000', DICHO), true, 'los montos no se revisan');
  assert.equal(seDijo('HMO', DICHO), true, '«HMO.» al final de una frase');
  assert.equal(seDijo('2025', DICHO), false, 'un año que nadie dijo sí');
  assert.equal(seDijo('Baileys', DICHO), false);
  const r = sacarLoNoDicho('**Detalles concretos**\n- Se cobraron 20.000 dólares.\n- El programa sale 9.500 dólares.\n- Había dos Macarios, el de HMO.\n- Con Maco conectado.', DICHO, PERMITIDOS);
  assert.deepEqual(r.sacado, []);
});

test('el nombre de la cuenta de Fathom se cambia por el de la persona, sólo con el MISMO email', () => {
  const yo = { nombre: 'Martin Koncke', email: 'martinkoncke@gmail.com' };
  const a = aliasDelDueno({ name: 'Martin Carballo', email: 'MartinKoncke@gmail.com' }, yo);
  assert.deepEqual(a, { de: 'Martin Carballo', a: 'Martin Koncke' });
  assert.equal(aliasDelDueno({ name: 'Martin Carballo', email: 'otro@x.com' }, yo), null, 'otro email es otra persona');
  assert.equal(aliasDelDueno({ name: 'Martin Koncke', email: 'martinkoncke@gmail.com' }, yo), null, 'mismo nombre: nada que cambiar');
  assert.equal(conNombreReal('«yo me lo llevo» (Martín Carballo, 00:55:05) y MARTIN CARBALLO; Carballosa no', a!), '«yo me lo llevo» (Martin Koncke, 00:55:05) y Martin Koncke; Carballosa no');
  const t = limpiarLoDicho({ titulo: 'Lo que pidió Martin Carballo', detalle: '**Por qué**\n(Martin Carballo, 12:40).', dueno: 'Martin Carballo', dichoPor: 'Martin Carballo' }, { datos: DICHO, permitidos: PERMITIDOS, alias: a });
  assert.ok(![t.titulo, t.detalle, t.dueno, t.dichoPor].some((x) => /Carballo/.test(x)), JSON.stringify(t));
});

test('limpiarLoDicho saca lo no dicho del detalle y no toca el título', () => {
  const t = limpiarLoDicho({ titulo: 'Resolver el crash del editor', detalle: '**Detalles concretos**\n- Pasa al recargar la página.\n- Usar el React Error Boundary.', dueno: '', dichoPor: '' }, { datos: DICHO, permitidos: PERMITIDOS });
  assert.equal(t.titulo, 'Resolver el crash del editor');
  assert.ok(!t.detalle.includes('Boundary'), t.detalle);
  assert.deepEqual(t.sacado.sort(), ['Boundary', 'React']);
});

const leer = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

test('el prompt ya no pide 600 caracteres, y pide lo dicho y los pedidos de una revisión de producto', () => {
  const src = leer('lib/plan-fathom.ts');
  const prompt = src.slice(src.indexOf('export const PLAN_FATHOM_SYSTEM_TEMPLATE'), src.indexOf('export const PLAN_FATHOM_USER_TEMPLATE'));
  assert.ok(!/M[ÍI]NIMO 600/i.test(prompt), 'el piso de 600 caracteres es lo que empujaba a rellenar');
  assert.match(prompt, /CADA DATO DEL DETALLE SE DIJO EN LA REUNIÓN/);
  assert.match(prompt, /REVISIÓN DE UN PRODUCTO/);
  assert.match(prompt, /EL NOMBRE DE QUIEN MIRA EL TABLERO/);
  // Y el cableado: cada tarea del modelo pasa por la limpieza, con el control armado una vez por reunión.
  assert.match(src, /const limpio = limpiarLoDicho\(/, 'coerceCandidatas dejó de limpiar lo que no se dijo');
  assert.match(src, /coerceCandidatas\(obj, proyectos, yo, participantes, dicho, control\)/);
  assert.match(src, /const alias = aliasDelDueno\(meta\?\.recorded_by, yo\);/);
});
