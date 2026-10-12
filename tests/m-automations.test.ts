// =============================================================================
// MaKo Mobile — Automations en el teléfono: las tarjetas en orden y el disparador (app/m/automations)
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · las tarjetas se leen DESDE EL GRAFO (la raíz de la salida y cada puerto en el orden del lienzo),
//     no por el orden del array: el lienzo inserta en el medio y una condición abre ramas;
//   · una tarjeta suelta no se lista (no corre) y un ciclo no repite tarjetas;
//   · los títulos y lo que dicen son los del lienzo (`tituloDeTarjeta` / `nombreDeTarjeta`);
//   · cada ícono existe en app/_components/icons.tsx (uno inventado dibuja un punto, sin error);
//   · el disparador nombra la etapa con el kanban de SU embudo, no con la de otro producto;
//   · el toast de un error dice el motivo sólo si es corto;
//   · (12/10/2026) Publicar y Descartar mandan lo que la pantalla VIO (`visto`) y las dos rutas lo
//     comprueban ANTES de escribir: sin eso, una pantalla abierta desde la mañana publicaba su borrador
//     viejo encima de lo que la computadora publicó después (la regla vive en lib/secuencia-borrador.ts y
//     la prueba tests/secuencia-borrador.test.ts; acá, que el teléfono y las rutas la usen).
//
// Verificado ROMPIÉNDOLO (11/10/2026), cada rotura contra la base en verde (9/9), restaurando el
// archivo entero después de cada una (scratchpad/auto/romper.cjs):
//   · leer las tarjetas por el orden del array: 3 fallos, 6 pases.
//   · apilar los puertos al derecho (la rama de abajo primero): 1 fallo, 8 pases.
//   · nombrar la etapa sin el kanban de su embudo: 2 fallos, 7 pases.
//   · DELAY con un ícono que no está en icons.tsx («reloj», ANTES de sumarlo al set): 1 fallo, 8 pases.
//     (El 11/10 el reloj entró a icons.tsx y el DELAY lo usa; la rotura equivalente hoy es un nombre
//     inventado.)
//   · la fila sin el «· +N» de los otros CRON: 1 fallo, 8 pases.
//   · un motivo de 40 palabras en el toast: 1 fallo, 8 pases.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PasoGrafo } from '../lib/flujo-grafo';
import type { Disparador } from '../lib/disparadores';
import {
  borradorAlAbrir, cronEnLectura, frenoDePublicar, idsEnLectura, lineaDelDisparador, pasosEnLectura, textoDelDisparador, type NombresDisparo,
} from '../app/m/automations/modelo';
import { avisoCorto } from '../app/m/automations/reglas';

// El flujo: WhatsApp → DELAY 1 día → CONDITION (¿agendó? → WhatsApp «Te espero» | si no → WhatsApp «Te dejo la clase»).
// El ARRAY va desordenado a propósito (como queda después de insertar en el lienzo) y con una suelta.
const flujo: PasoGrafo[] = [
  { id: 'm4', canal: 'whatsapp', cuerpo: 'Te dejo la clase de nuevo', siguiente: null },
  { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola, te escribo por la llamada', siguiente: 'e1' },
  { id: 'c1', nodo: 'condicion', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'm3' }], si_no: 'm4' },
  { id: 'e1', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'c1' },
  { id: 'm3', canal: 'whatsapp', cuerpo: 'Te espero', siguiente: null },
  { id: 's1', canal: 'whatsapp', cuerpo: 'Nadie me apunta', siguiente: null },
];

test('las tarjetas se leen desde el grafo: la raíz, la rama de arriba entera y después la de abajo; sin la suelta', () => {
  assert.deepEqual(idsEnLectura(flujo), ['m1', 'e1', 'c1', 'm3', 'm4']);
});

test('un ciclo que vuelve al principio no repite tarjetas', () => {
  const ciclo: PasoGrafo[] = [
    { id: 'a', canal: 'whatsapp', cuerpo: 'Uno', siguiente: 'b' },
    { id: 'b', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 60 }, siguiente: 'a' },
  ];
  assert.deepEqual(idsEnLectura(ciclo), ['a', 'b']);
});

test('los nombres son los del lienzo: el título en inglés y lo que dice cada tarjeta', () => {
  const pasos = pasosEnLectura(flujo);
  assert.deepEqual(pasos.map((p) => p.titulo), ['WHATSAPP', 'DELAY', 'CONDITION', 'WHATSAPP', 'WHATSAPP']);
  assert.equal(pasos[1].linea, '1 día');
  assert.equal(pasos[2].linea, 'Agendó');
  assert.ok(pasos[0].linea?.startsWith('Hola, te escribo'));
});

test('cada ícono de una tarjeta existe en app/_components/icons.tsx', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '_components', 'icons.tsx'), 'utf8');
  const existe = (n: string) => new RegExp(`^\\s+'?${n.replace(/[-]/g, '\\-')}'?\\s*:`, 'm').test(src);
  const todos: PasoGrafo[] = [
    ...flujo,
    { id: 'x1', canal: 'email', asunto: 'Hola', cuerpo: 'Hola', siguiente: null },
    { id: 'x2', canal: 'instagram', cuerpo: 'Hola', siguiente: null },
    { id: 'x3', canal: 'messenger', cuerpo: 'Hola', siguiente: null },
  ];
  // Cada uno como su propia raíz: el grafo sólo para leer los íconos.
  const iconos = new Set<string>();
  for (const p of todos) for (const x of pasosEnLectura([{ ...p, siguiente: null } as PasoGrafo])) iconos.add(x.icono);
  for (const p of pasosEnLectura(flujo)) iconos.add(p.icono);
  assert.ok(iconos.size >= 4);
  for (const n of iconos) assert.ok(existe(n), `«${n}» no está en icons.tsx`);
});

test('el borrador se abre renumerado, como el lienzo', () => {
  const abierto = borradorAlAbrir(flujo) as Array<PasoGrafo & { orden?: number }>;
  assert.deepEqual(abierto.map((p) => p.orden), [1, 2, 3, 4, 5, 6]);
});

test('Publicar se frena con la misma función del lienzo: una suelta frena, sin ella no', () => {
  assert.ok(frenoDePublicar(flujo));
  assert.equal(frenoDePublicar(flujo.filter((p) => p.id !== 's1')), null);
});

const nombres: NombresDisparo = {
  productos: [
    { funnelId: 7, productoId: 70, etapas: [{ value: 'agendado', label: 'Agendado' }], etapasEntrega: [] },
    // La MISMA clave en otro producto, con otro nombre: no se tiene que colar.
    { funnelId: 8, productoId: 80, etapas: [{ value: 'agendado', label: 'Llamada reservada' }], etapasEntrega: [] },
  ],
  etiquetas: [{ id: 5, nombre: 'Cualificado' }],
  triggers: [{ value: 'instant_form_sin_agenda', label: 'Dejó el formulario sin agendar' }],
  etiquetaEtapa: (k) => k,
  tz: 'America/Mexico_City',
};

test('el disparador nombra la etapa con el kanban de SU embudo', () => {
  const d: Disparador = { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 8 };
  assert.equal(textoDelDisparador(d, nombres), 'Llega a «Llamada reservada»');
  assert.equal(textoDelDisparador({ ...d, funnel_id: 7 }, nombres), 'Llega a «Agendado»');
  // Un evento de antes se dice como es y con su MARCA, igual que la tarjeta CRON del lienzo.
  assert.equal(textoDelDisparador({ id: 'd1', trigger_tipo: 'instant_form_sin_agenda' }, nombres), 'Dejó el formulario sin agendar (de antes)');
  assert.equal(textoDelDisparador({ id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 5 }, nombres), 'Se le puso «Cualificado»');
});

test('la fila dice el primer CRON y cuántos más tiene', () => {
  const base = { id: 1, trigger_tipo: 'etapa_actual', etapa: 'agendado', etapas: [], funnel_id: 7, producto_id: null, etiqueta_id: null, cron: null, cron_proxima_at: null };
  assert.equal(lineaDelDisparador(base, nombres), 'Llega a «Agendado»');
  assert.equal(lineaDelDisparador({
    ...base,
    disparadores: [
      { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 7 },
      { id: 'd2', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 5 },
    ],
  }, nombres), 'Llega a «Agendado» · +1');
  // En el sheet, la tarjeta CRON abre el «+1»: una fila por disparador, en su orden.
  const cron = cronEnLectura({
    ...base,
    disparadores: [
      { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 7 },
      { id: 'd2', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 5 },
    ],
  }, nombres);
  assert.deepEqual(cron.map((p) => [p.titulo, p.linea]), [['CRON', 'Llega a «Agendado»'], ['CRON', 'Se le puso «Cualificado»']]);
});

test('el toast de un error: el motivo si es corto, el genérico si no', () => {
  assert.equal(avisoCorto('No se activó: Conecta tu WhatsApp.', 'No se activó'), 'Conecta tu WhatsApp');
  assert.equal(avisoCorto('No se activó: al paso 2 («Mover de etapa») le falta «monto».', 'No se activó'), 'No se activó');
  assert.equal(avisoCorto(undefined, 'No se pausó'), 'No se pausó');
  assert.equal(avisoCorto('', 'No se pausó'), 'No se pausó');
});

// ── Publicar y Descartar mandan lo que se VIO (hallazgo del 12/10/2026) ─────────────────────────
// Que la regla exista no alcanza: si la pantalla deja de mandar `visto` o la ruta escribe antes de mirarlo,
// todo sigue compilando y el teléfono vuelve a pisar lo de la computadora sin un solo error.

const codigo = (r: string) => readFileSync(join(__dirname, '..', ...r.split('/')), 'utf8')
  .replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta}»`);
  return src.slice(i, j);
};

test('⚠️ Publicar y Descartar mandan lo que se vio, y las dos rutas lo comprueban ANTES de escribir', () => {
  const pantalla = codigo('app/m/automations/AutomationsM.tsx');
  const publicar = tramo(pantalla, 'const publicar = async () => {', 'const rehacer');
  assert.match(publicar, /pedir\(RUTA_PASOS, 'PATCH', \{ id: a\.id, pasos: b\.pasos, visto: \{ base: b\.base, guardado_at: b\.guardado_at \} \}\)/);
  assert.match(publicar, /if \(!r\.ok && r\.desactualizado\) \{ cambioAfuera\(\); return; \}/);
  // El descarte de después: sólo el borrador que se publicó (la base ya la movió Publicar).
  assert.match(publicar, /action: 'descartar-borrador', secuenciaId: a\.id, visto: \{ guardado_at: b\.guardado_at \}/);
  const descartar = tramo(pantalla, 'const descartar = async () => {', 'const pie');
  assert.match(descartar, /action: 'descartar-borrador', secuenciaId: a\.id, visto: \{ base: b\.base, guardado_at: b\.guardado_at \}/);
  assert.match(descartar, /if \(!r\.ok && r\.desactualizado\) \{ cambioAfuera\(\); return; \}/);
  // «Deshacer» un descarte vuelve a guardar con OTRO `guardado_at`: Publicar manda ése, no el leído.
  assert.match(tramo(pantalla, 'const rehacer', 'const descartar'), /poner\(id, \{ descartada: false, guardado_at: r\.guardado_at \}\)/);
  assert.match(pantalla, /c\.guardado_at \? \{ \.\.\.a\.borrador, guardado_at: c\.guardado_at \}/);
  // La ruta de Publicar comprueba ANTES de `setSecuenciaPasos`.
  const patch = tramo(codigo('app/api/whatsapp/secuencias/route.ts'), 'export async function PATCH', 'if (typeof body.activa');
  const iComprobar = patch.indexOf('comprobarVisto(');
  assert.ok(iComprobar > 0 && iComprobar < patch.indexOf('setSecuenciaPasos('), 'Publicar escribe antes de mirar lo que se vio');
  assert.match(patch, /desactualizado: true[^\n]*status: 409/);
  // La de descartar le pasa `visto` a la lib.
  const rama = tramo(codigo('app/api/chat-agent/secuencias/route.ts'), "if (body.action === 'borrador' || body.action === 'descartar-borrador')", 'status: 404');
  assert.match(rama, /descartarBorradorSecuencia\(db, id, body\.visto\)/);
  // Y lo que se vio baja del server con el borrador.
  assert.match(codigo('app/m/automations/datos.ts'), /base: visto\.base,\s*guardado_at: visto\.guardado_at,/);
});
