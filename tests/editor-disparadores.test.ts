// =============================================================================
// El panel del CRON, DIBUJADO (app/automations/EditorDisparadores.tsx, EditorRecurrente.tsx)
// =============================================================================
// Sexta tanda del Chatbot (09/10/2026), FEEDBACK DE CRON (literal en app/admin/dev/chatbot/bitacora.ts):
//   1-2. la primera pantalla con botones GIGANTES «Producto», «Recurrente», «Etiqueta», «Instagram»,
//        «Messenger» y «Email», con su ícono (en vez de «Por tiempo» / «Por una acción»);
//   3.   «Etiqueta» es un CRON aparte, con «Se agrega…» / «Se elimina…» y la fila «Ignorar»;
//   6-8. los eventos de Instagram, Messenger y Email, los de anuncios apagados como en ManyChat, y
//        TODOS apagados con su motivo si el canal no está conectado;
//   9.   el Recurrente como el diálogo del Plan (varios días, cada N, fecha con calendario, hora con
//        reloj, huso con banderas) y «A quién» con «El grupo de MaKo»;
//   10.  más de un CRON.
//
// No hay DOM en los tests de esta casa (sin jsdom): se DIBUJA con `renderToStaticMarkup` y se mira
// el HTML. Los efectos no corren (el estado de los canales se prueba sobre `EventosDeCanal`, que lo
// recibe por prop).
//
// PROBADO ROMPIÉNDOLO (09/10/2026, base 10/10 en verde; arnés en el scratchpad, restaura de memoria):
// el número de cada rotura va al pie del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorDisparadores, EventosDeCanal } from '../app/automations/EditorDisparadores';
import { CalendarioMini } from '../app/automations/EditorRecurrente';
import { textoCohorte, type Disparador, type EstadoCanales } from '../lib/disparadores';

const PRODUCTOS = [
  { funnelId: 5, productoId: 9, nombre: 'Curso', esDefault: true, origenEntrega: 'declarado' as const,
    etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }],
    etapasEntrega: [{ value: 'onb', label: 'Bienvenida' }, { value: 'm1', label: 'Módulo 1' }] },
];
const ETIQUETAS = [
  { id: 3, nombre: 'Cualificado', archivada_at: '2026-10-08' },
  { id: 4, nombre: 'Seguimiento', color: '#2563EB' },
];

const dibujar = (lista: Disparador[], extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(EditorDisparadores, {
  lista, editando: null, onEditar: () => {}, onGuardar: () => {},
  productos: PRODUCTOS, etiquetas: ETIQUETAS, disparadores: [], etiquetaEtapa: (k: string) => k,
  tz: 'America/Mexico_City', rolAdmin: true, ...extra,
}));
const cuantos = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const botonesApagados = (html: string) => cuantos(html, /<button[^>]*disabled=""/g);

test('la primera pantalla: los SIETE botones gigantes en 4+3, en orden y con su ícono; sin «Por tiempo» / «Por una acción»', () => {
  const html = dibujar([{ id: 'd1', trigger_tipo: 'manual' }]);
  const clases = [...html.matchAll(/data-clase-cron="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(clases, ['producto', 'recurrente', 'etiqueta', 'instagram', 'messenger', 'email', 'pagos']);
  for (const l of ['Producto', 'Recurrente', 'Etiqueta', 'Instagram', 'Messenger', 'Email', 'Pagos']) assert.match(html, new RegExp(`>${l}</button>`));
  // Cada botón lleva su ícono (un <svg>), no un emoji.
  assert.ok(cuantos(html, /<svg/g) >= 7, 'faltan los íconos de los botones');
  // 4+3, nunca 3+3+1 (11/10/2026: con «Pagos» son siete, y un botón solo en una tercera fila se ve roto).
  // Roto a propósito el 11/10/2026 (la grilla de vuelta en 3 columnas): 9 pass / 1 fail; restaurado: 10 / 0.
  const grilla = html.slice(html.indexOf('data-cron-clases'), html.indexOf('data-cron-clases') + 300);
  assert.match(grilla, /grid-template-columns:repeat\(4, minmax\(0, ?1fr\)\)/, 'siete botones en una grilla que no es de 4 dejan uno solo en la última fila');
  // 76 desde la décima tanda (CRON 1: con 92 los seis salían del recuadro); siguen siendo los grandes del panel.
  assert.match(html, /min-height:76px/, 'los botones dejaron de ser gigantes');
  assert.doesNotMatch(html, /Por tiempo|Por una acción/);
});

test('un CRON «Producto»: el desplegable dice las etapas puestas, y abajo «＋ Nuevo CRON»; con uno solo, sin pastillas', () => {
  const html = dibujar([{ id: 'd1', trigger_tipo: 'entrega_actual', etapa: 'onb', etapas: ['onb', 'm1'], producto_id: 9 }]);
  assert.match(html, /Llega a «Bienvenida» o «Módulo 1»/);
  // Los DOS recuadros (10/10/2026, CRON 3): el del CRON y el del «＋ Nuevo CRON».
  assert.match(html, /data-cron-recuadro="d1"/);
  assert.match(html, /mk-nuevo__mas[^>]*>＋<\/span>Nuevo CRON/);
  assert.doesNotMatch(html, /role="tablist"/, 'con un solo CRON no hay pastillas');
  assert.doesNotMatch(html, /Eliminar este CRON/, 'un CRON menos que uno no dispara nada: con uno solo no hay tacho');
});

// ⚠️ CADA CRON EN SU RECUADRO desde el 10/10/2026 (CRON 3: «Un cron debería tener un contenedor y ser más
// alto... Y que si creo más de 2, tenga scroll»): sin pastillas; el abierto muestra su editor, el otro lo
// que dispara, y cada uno su tacho en la esquina.
test('DOS CRON: un recuadro por CRON, cada uno con su tacho; el abierto con su editor («Se agrega…» e «Ignorar»)', () => {
  const html = dibujar([
    { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 5 },
    { id: 'd2', trigger_tipo: 'etiqueta_agregada', ignorar: [4] },
  ], { editando: 'd2' });
  assert.doesNotMatch(html, /role="tablist"/, 'volvieron las pastillas');
  assert.match(html, /data-cron-recuadro="d1"/);
  assert.match(html, /data-cron-recuadro="d2"/);
  assert.match(html, />CRON 1</);
  assert.match(html, />CRON 2</);
  assert.equal(html.split('aria-label="Eliminar este CRON"').length - 1, 2, 'un tacho por CRON');
  assert.match(html, /Se agrega etiqueta a un lead/);
  assert.match(html, />Ignorar</);
  assert.match(html, /«Seguimiento»/, 'el botón de «Ignorar» no dice cuáles');
});

test('una etiqueta puesta que se ARCHIVÓ se sigue diciendo (y no se pisa con la primera opción)', () => {
  const html = dibujar([{ id: 'd1', trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3 }]);
  assert.match(html, /Se le puso «Cualificado \(archivada\)»/);
  // «Ignorar» es de las dos genéricas, no de una etiqueta puntual.
  assert.doesNotMatch(html, />Ignorar</);
});

const ESTADO = (conectado: boolean | null): EstadoCanales => ({
  instagram: { conectado, motivo: conectado ? undefined : 'Sin conectar' },
  messenger: { conectado, motivo: conectado ? undefined : 'Sin conectar' },
  email: { conectado, motivo: conectado ? undefined : 'Sin conectar' },
});
const eventos = (clase: 'instagram' | 'messenger' | 'email', estado: EstadoCanales | null | undefined, d: Partial<Disparador> = {}) =>
  renderToStaticMarkup(createElement(EventosDeCanal, { clase, d: { id: 'd1', trigger_tipo: 'manual', ...d } as Disparador, estado, onElegir: () => {} }));

test('Instagram conectado: los seis eventos de ManyChat, y SÓLO el del anuncio apagado («Todavía no»)', () => {
  const html = eventos('instagram', ESTADO(true));
  assert.equal(cuantos(html, /<button/g), 6);
  assert.equal(botonesApagados(html), 1);
  assert.match(html, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*hace clic en un anuncio de Instagram/);
  assert.match(html, /Todavía no/);
  assert.doesNotMatch(html, /Sin conectar/);
});

test('sin conectar: TODOS apagados, con el motivo y «Conectar» ahí mismo (Messenger e Instagram, /integraciones en una ventana; el email, el modal)', () => {
  const ig = eventos('instagram', ESTADO(false));
  assert.equal(botonesApagados(ig), 6);
  assert.match(ig, /Sin conectar/);
  assert.match(ig, /href="\/integraciones"/);
  const ms = eventos('messenger', ESTADO(false));
  assert.equal(botonesApagados(ms), cuantos(ms, /<button/g));
  assert.match(ms, /href="\/integraciones"/);
  const em = eventos('email', ESTADO(false));
  assert.equal(botonesApagados(em), 1);
  assert.match(em, /Recibes un email/);
  // Desde la décima tanda (GENERAL 6: «sin salirse de la pestaña») el email se conecta en el modal de la tab
  // (ConectarMedio), no con un link a /email; lo cuida tests/medios-automatizacion.test.ts.
  assert.match(em, /<button type="button" data-conectar-canal="email" aria-haspopup="dialog"[^>]*>Conectar<\/button>/);
  assert.doesNotMatch(em, /href="\/email"/);
  // «No pude comprobarlo» también apaga: un evento que no puede llegar no arranca nunca.
  const nulo = eventos('instagram', null);
  assert.equal(botonesApagados(nulo), 6);
  assert.match(nulo, /No pude comprobarlo/);
  // Y el ya ELEGIDO no se apaga (se puede ver cuál era aunque se haya desconectado).
  assert.equal(botonesApagados(eventos('instagram', ESTADO(false), { trigger_tipo: 'instagram', subtipo: 'dm' })), 5);
});

test('Recurrente: los bloques del Plan (cada N, VARIOS días, inicio, hora, huso con país) y «A quién» con el grupo de MaKo', () => {
  const html = dibujar([{
    id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 5, grupo: true,
    cron: { unidad: 'semana', cada: 1, diaSemana: 2, dias: [2, 4], hora: 9, minuto: 0 },
  }]);
  for (const r of ['Repetir cada', 'Los días', 'Empieza', 'A las', 'Huso', 'A quién']) assert.match(html, new RegExp(`>${r}<`), `falta la fila «${r}»`);
  assert.match(html, /aria-label="Martes" aria-pressed="true"/);
  assert.match(html, /aria-label="Jueves" aria-pressed="true"/);
  assert.match(html, /aria-label="Lunes" aria-pressed="false"/);
  assert.match(html, /09:00/);
  assert.match(html, />Hoy</, 'sin fecha de inicio, arranca hoy');
  // El huso: México tiene varias zonas, así que van el país Y la zona.
  assert.match(html, /aria-label="País del huso horario"/);
  assert.match(html, /aria-label="Zona horaria"/);
  assert.match(html, /El grupo de MaKo y En «Agendado»/);
});

test('«A quién» dice la cohorte como cohorte: «En …» y «Tienen …», no «Llega a» ni «Se le puso»', () => {
  assert.equal(textoCohorte('Llega a «Agendado»'), 'En «Agendado»');
  assert.equal(textoCohorte('Se le puso «VIP»'), 'Tienen «VIP»');
  assert.equal(textoCohorte('Dejó el formulario'), 'Dejó el formulario');
});

test('el calendario de la fecha de inicio: arranca el lunes, y los días que ya pasaron no se eligen', () => {
  const html = renderToStaticMarkup(createElement(CalendarioMini, { valor: null, hoy: '2026-10-09', onElegir: () => {} }));
  assert.match(html, /octubre 2026/);
  // Del 1 al 8 de octubre ya pasaron.
  assert.equal(botonesApagados(html), 8);
  assert.match(html, /aria-pressed="true"[^>]*>9<\/button>/, 'sin fecha, el elegido es hoy');
  // El 1/10/2026 es jueves: con la semana arrancando el lunes, tres huecos antes.
  const grilla = html.slice(html.indexOf('>D</span>') + '>D</span>'.length);
  assert.equal(cuantos(grilla.slice(0, grilla.indexOf('<button')), /<span><\/span>/g), 3);
});

test('quien NO es admin mira: una fila por CRON con su texto, sin los botones ni «Nuevo CRON»; el pie se ve igual', () => {
  const html = dibujar([
    { id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 5 },
    { id: 'd2', trigger_tipo: 'etiqueta_quitada' },
  ], { rolAdmin: false, pie: createElement('span', null, 'pie-de-prueba') });
  assert.match(html, /Llega a «Agendado»/);
  assert.match(html, /Se elimina etiqueta a un lead/);
  assert.doesNotMatch(html, /data-clase-cron|Nuevo CRON|<button/);
  assert.match(html, /pie-de-prueba/);
});

// PROBADO ROMPIÉNDOLO (09/10/2026, base 10 / 0). Una rotura por vez, cada una cae en SU test:
//    1. sin «Email» en CLASES_DISPARADOR → 9 / 1.   2. los botones de 92 a 60 px → 9 / 1.
//    3. sin «＋ Nuevo CRON» → 9 / 1.   4. sin pastillas con dos CRON → 9 / 1.   5. sin «Ignorar» → 9 / 1.
//    6. la etiqueta archivada fuera de las opciones → 9 / 1.
//    7. los eventos prendidos con el canal sin conectar → 9 / 1.   8. el anuncio de Instagram prendido → 9 / 1.
//    9. «no pude comprobarlo» sin motivo → 9 / 1.   10. el evento ELEGIDO también apagado → 9 / 1.
//   11. el email linkeando a /integraciones → 9 / 1.   12. un solo día por semana → 9 / 1.
//   13. sin la zona del país → 9 / 1.   14. «A quién» sin el grupo → 9 / 1.
//   15. `textoCohorte` sin traducir → 8 / 2.   16. los días pasados elegibles → 9 / 1.
//   17. la semana arrancando el domingo → 9 / 1.   18. el setter sin el pie → 9 / 1.
