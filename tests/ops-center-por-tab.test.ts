// =============================================================================
// Un chat por tab en la lista del Ops Center, los dormidos fuera, y el «Completado» que dice qué se completó (10/11/2026)
// =============================================================================
// Martín: «se están creando una cantidad de chats impresionante… La idea era tener un chat por cada tab de MaKo o cada funcionalidad»
// y «las tarjetas de completado… que yo rápidamente pueda identificar qué se completó… qué funcionalidad, qué feature, qué tab». Esto
// fija, con el índice REAL de tabs (app/admin/operaciones/tabs.ts → indiceDeTabs):
//   1. de qué tab es un chat: por su nombre, por su bitácora o por una tab nombrada en su título; y lo que no es de ninguna, solo;
//   2. la lista agrupa por tab: la cabeza es el que se llama como ella, los de tarea van adentro, y uno solo es su propia fila;
//   3. adentro van plegados, salvo lo que espera, trabaja o se mira; en la computadora y en el teléfono;
//   4. un chat dormido hace días sale de la lista y no deja nada esperando;
//   5. el «Completado» arranca con «Tab · Función», en el hilo y arriba de la caja;
//   6. las dos pantallas lo usan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DIAS_DORMIDO, chatDormido, esperasSinDormidos, filasDeGrupos, plegarGrupo, porJefe, tabDeChat, vaEnLaLista, type ChatCentro, type LineaChat,
} from '../lib/centro-chats';
import { rotuloDelCompletado, voyDelCompletado } from '../lib/centro-rotulo-completado';
import { indiceDeTabs } from '../app/admin/operaciones/tabs';
import { YaEstaMensaje } from '../app/admin/operaciones/Avance';
import { BloqueCompletado } from '../app/admin/operaciones/BloqueCompletado';
import { GruposPorJefe } from '../app/admin/operaciones/GruposPorJefe';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (r: string) => sinComentarios(readFileSync(join(REPO, r), 'utf8'));
const INDICE = indiceDeTabs();
const AHORA = Date.parse('2026-11-10T15:00:00.000Z');
const HORA = 3_600_000;

let n = 0;
const chat = (titulo: string, extra: Partial<ChatCentro> = {}): ChatCentro => {
  n += 1;
  const local = `local_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  return {
    clave: `nombre:${titulo.toLowerCase()}`, sesion: local, porNombre: false, titulo, cuenta: 'claude1', estado: 'abierto', vistoAt: AHORA, viejo: false,
    actividad: AHORA - HORA, pedidos: [], pidioAca: [], trabajos: [], miembros: [local], sesiones: [], ...extra,
  };
};

test('1. de qué tab es un chat: su nombre, su bitácora o una tab nombrada en su título', () => {
  assert.ok(INDICE.length > 30, `el índice tiene ${INDICE.length} tabs: no se armó`);
  const tab = (titulo: string, area?: string) => tabDeChat({ titulo, area }, INDICE);
  assert.deepEqual(tab('Image'), { tab: 'Image', jefe: true });
  assert.deepEqual(tab('Image Editor'), { tab: 'Image', jefe: true }, 'el área «Image Editor» es la tab «Image» (slugDev)');
  assert.deepEqual(tab('Image › Portadas de carruseles'), { tab: 'Image', jefe: false });
  assert.deepEqual(tab('Borrar la co-edición del editor de imágenes'), { tab: 'Image', jefe: false }, 'un chat de tarea: por cómo le dice la gente');
  assert.deepEqual(tab('Arreglar filaPropia', 'Image Editor'), { tab: 'Image', jefe: false }, 'por el área de su bitácora');
  assert.deepEqual(tab('CRM'), { tab: 'CRM', jefe: true });
  assert.deepEqual(tab('CRM › Lead Detail'), { tab: 'CRM', jefe: false });
  assert.deepEqual(tab('Arreglar el kanban del CRM'), { tab: 'CRM', jefe: false });
  assert.deepEqual(tab('Lead Insights'), { tab: 'CRM', jefe: true }, 'un área del grupo «CRM» es el CRM');
  assert.deepEqual(tab('Dashboard'), { tab: 'Dashboard', jefe: true });
  assert.deepEqual(tab('Cerebro › Integración'), { tab: 'Cerebro', jefe: false }, 'lo del Cerebro es del Cerebro');
  // Lo que no nombra ninguna: solo, como hasta ahora. Una palabra de todos los días no agrupa.
  assert.equal(tab('Arreglar filaPropia del perfil'), null);
  assert.equal(tab('Agrupar los chats por tab'), null, '«chats» es castellano, no la tab');
  assert.equal(tab('Arreglar el plan de pagos'), null, '«plan» tampoco');
  assert.equal(tabDeChat({ titulo: 'CRM' }, undefined), null, 'sin índice, nada');
});

test('2. la lista agrupa por tab: la cabeza es el que se llama como ella, y uno solo es su propia fila', () => {
  const tabDe = (c: ChatCentro) => tabDeChat(c, INDICE);
  const lista = [
    chat('Borrar la co-edición del editor de imágenes'), chat('Image'), chat('Image › Portadas de carruseles'),
    chat('CRM'), chat('Arreglar filaPropia'), chat('Velocidad de llamada del Dashboard'),
  ];
  const g = porJefe(lista, tabDe);
  const resumen = g.map((x) => ({ grupo: x.jefe, cabeza: x.chat?.titulo ?? null, adentro: x.subs.map((s) => s.titulo) }));
  assert.deepEqual(resumen, [
    { grupo: 'Image', cabeza: 'Image', adentro: ['Borrar la co-edición del editor de imágenes', 'Image › Portadas de carruseles'] },
    { grupo: 'CRM', cabeza: 'CRM', adentro: [] },
    { grupo: 'Arreglar filaPropia', cabeza: 'Arreglar filaPropia', adentro: [] },
    { grupo: 'Dashboard', cabeza: 'Velocidad de llamada del Dashboard', adentro: [] },
  ]);
  // Sin el índice, lo de siempre (por el nombre del jefe): «Image › Portadas» va con «Image», la tarea va sola.
  assert.deepEqual(porJefe(lista).map((x) => x.jefe).slice(0, 2), ['Borrar la co-edición del editor de imágenes', 'Image']);
});

test('3. adentro van plegados, salvo lo que espera, trabaja o se mira; uno solo sin cabeza no se pliega', () => {
  const [g] = porJefe([chat('Image'), chat('Image › Portadas'), chat('Image › Fuentes'), chat('Image › Espera algo')], (c) => tabDeChat(c, INDICE));
  const siempre = (c: ChatCentro) => c.titulo.includes('Espera');
  assert.deepEqual(plegarGrupo(g, false, siempre).subs.map((c) => c.titulo), ['Image › Espera algo']);
  assert.equal(plegarGrupo(g, false, siempre).ocultos, 2);
  assert.equal(plegarGrupo(g, true, siempre).subs.length, 3);
  // El teléfono: la cabeza, el que se ve siempre (corrido) y «Ver 2 más».
  assert.deepEqual(filasDeGrupos([g], new Set(), siempre).map((f) => (f.tipo === 'chat' ? `${f.sub ? '↳ ' : ''}${f.c.titulo}` : f.tipo === 'plegados' ? `+${f.n}` : `[${f.nombre}]`)),
    ['Image', '↳ Image › Espera algo', '+2']);
  // Sin cabeza y varios: el nombre de la tab arriba. Sin cabeza y uno: él solo, sin correrse (23/10/2026).
  const huerfanos = porJefe([chat('CRM › A'), chat('CRM › B')]);
  assert.deepEqual(filasDeGrupos(huerfanos, new Set([huerfanos[0].clave]), () => false).map((f) => f.tipo === 'tab' ? `[${f.nombre}]` : f.tipo === 'chat' ? `${f.sub ? '↳ ' : ''}${f.c.titulo}` : '+'),
    ['[CRM]', '↳ CRM › A', '↳ CRM › B']);
  const solo = porJefe([chat('CRM › A')]);
  assert.deepEqual(filasDeGrupos(solo, new Set(), () => false).map((f) => (f.tipo === 'chat' ? `${f.sub}:${f.c.titulo}` : f.tipo)), ['false:CRM › A']);
  // La computadora: «Mostrar 2 chats» debajo de la cabeza.
  const html = renderToStaticMarkup(createElement(GruposPorJefe<ChatCentro>, {
    chats: [chat('Image'), chat('Image › Portadas'), chat('Image › Fuentes')], fila: (c) => createElement('p', { key: c.clave }, c.titulo),
    tabDe: (c) => tabDeChat(c, INDICE), plegado: { abiertos: new Set<string>(), alternar: () => {}, siempre: () => false },
  }));
  assert.match(html, /<p>Image<\/p>/);
  assert.doesNotMatch(html, /Image › Portadas/);
  assert.match(html, /Mostrar 2 chats/);
});

test('4. un chat dormido hace días sale de la lista y no deja nada esperando; el Cerebro, el que se mira y el que trabaja, no', () => {
  const dias = (d: number) => AHORA - d * 24 * HORA;
  const dormido = chat('Arreglar algo viejo', { actividad: dias(DIAS_DORMIDO + 1) });
  const despierto = chat('CRM', { actividad: dias(1) });
  const trabajando = chat('Video', { actividad: dias(9), estado: 'trabajando' });
  const cerebro = chat('Cerebro', { actividad: dias(9) });
  assert.equal(chatDormido(dormido, AHORA), true);
  assert.equal(chatDormido(despierto, AHORA), false);
  assert.equal(chatDormido(trabajando, AHORA), false);
  assert.equal(chatDormido({ ...trabajando, viejo: true }, AHORA), true, 'una foto vieja de «trabajando» no lo despierta');
  const esperas = { [dormido.miembros[0]]: 2, [despierto.miembros[0]]: 1, [cerebro.miembros[0]]: 1 };
  assert.deepEqual(esperasSinDormidos(esperas, [dormido, despierto, cerebro], AHORA), { [despierto.miembros[0]]: 1, [cerebro.miembros[0]]: 1 });
  const nada = { [despierto.miembros[0]]: 1 };
  assert.equal(esperasSinDormidos(nada, [dormido, despierto], AHORA), nada, 'sin nada que sacar, el mismo objeto');
  assert.equal(vaEnLaLista(dormido, AHORA, null, false), false);
  assert.equal(vaEnLaLista(dormido, AHORA, dormido.clave, false), true, 'el que se está mirando');
  assert.equal(vaEnLaLista(dormido, AHORA, null, true), true, 'buscándolo');
  assert.equal(vaEnLaLista(cerebro, AHORA, null, false), true);
});

const LOCAL = 'local_00000001-0000-4000-8000-000000000000';
const turno = (uuid: string, at: string, texto: string, rol: 'el' | 'yo' = 'el'): LineaChat =>
  ({ tipo: 'turno', instante: Date.parse(at), turno: { local: LOCAL, uuid, rol, de: null, texto, at, trabajo: null } });

test('5. el «Completado» arranca con «Tab · Función»', () => {
  const lineas = [
    turno('v0', '2026-11-10T09:00:00.000Z', 'Voy a trabajar en la hoja Ventas.'),
    turno('y0', '2026-11-10T09:30:00.000Z', 'Ya está: la hoja Ventas.'),
    turno('v1', '2026-11-10T10:00:00.000Z', 'Voy a trabajar en **la hoja Velocidad de llamada**.'),
    turno('y1', '2026-11-10T11:00:00.000Z', 'Ya está: la hoja nueva con su gráfico.'),
  ];
  const ya = (l: LineaChat) => (l.tipo === 'turno' ? l.turno : (null as never));
  assert.equal(voyDelCompletado(lineas, ya(lineas[3])), 'La hoja Velocidad de llamada', 'el de SU trabajo, no el de antes');
  assert.equal(rotuloDelCompletado({ titulo: 'Dashboard' }, INDICE, lineas, ya(lineas[3])), 'Dashboard · La hoja Velocidad de llamada');
  assert.equal(rotuloDelCompletado({ titulo: 'Image › Portadas de carruseles' }, INDICE, [], ya(lineas[3])), 'Image · Portadas de carruseles');
  assert.equal(rotuloDelCompletado({ titulo: 'Borrar la co-edición del editor de imágenes' }, INDICE, [], ya(lineas[3])), 'Image · Borrar la co-edición del editor de imágenes');
  assert.equal(rotuloDelCompletado({ titulo: 'CRM' }, INDICE, [], ya(lineas[3])), 'CRM', 'sin «Voy a trabajar en…», la tab sola');
  assert.equal(rotuloDelCompletado({ titulo: 'Arreglar filaPropia' }, INDICE, [], ya(lineas[3])), 'Arreglar filaPropia', 'sin tab, lo que se hizo');
  // En pantalla: donde decía «Completado».
  const t = ya(lineas[3]);
  const enElHilo = renderToStaticMarkup(createElement(YaEstaMensaje, { t, chat: { clave: 'nombre:dashboard', sesion: LOCAL, titulo: 'Dashboard' }, rotulo: 'Dashboard · La hoja Velocidad de llamada' }));
  assert.match(enElHilo, /<span class="co-ya__rotulo">Dashboard · La hoja Velocidad de llamada<\/span>/);
  assert.match(renderToStaticMarkup(createElement(YaEstaMensaje, { t, chat: { clave: 'x', sesion: LOCAL, titulo: 'x' } })), /<span class="co-ya__rotulo">Completado<\/span>/);
  const arriba = renderToStaticMarkup(createElement(BloqueCompletado, {
    chat: { clave: 'nombre:dashboard', sesion: LOCAL, titulo: 'Dashboard' }, lineas, yaVisto: Date.parse('2026-11-10T09:45:00.000Z'), hayPreguntas: false, indiceTabs: INDICE,
  }));
  assert.match(arriba, /<span class="co-ya__rotulo">Dashboard · La hoja Velocidad de llamada<\/span>/);
});

test('6. las dos pantallas lo usan: la lista por tab y sin dormidos, el bloque sin dormidos, el «trabado» con todas', () => {
  const compu = leer('app/admin/operaciones/PiezasCentro.tsx');
  assert.match(compu, /visibles\.filter\(\(c\) => vaEnLaLista\(c, k\.ahora, actual, buscando\)\)/);
  assert.match(compu, /seccionesDeChats\(enLista, avisos, esperanRespuesta\)/);
  assert.match(compu, /<GruposPorJefe chats=\{corte\} fila=\{fila\} tabDe=\{tabDe\} plegado=\{plegado\} \/>/);
  assert.match(compu, /indiceTabs=\{k\.indiceTabs\}/, 'la conversación recibe el índice');
  const movil = leer('app/m/operaciones/ChatsMovil.tsx');
  assert.match(movil, /filasDeGrupos\(porJefe\(corte, tabDe\), gruposAbiertos, siempre\)/);
  assert.match(movil, /chats\.filter\(\(c\) => vaEnLaLista\(c, ahora/);
  for (const [nombre, src] of [['computadora', leer('app/admin/operaciones/Conversacion.tsx')], ['teléfono', movil]] as const) {
    assert.match(src, /chatDormido\(/, `${nombre}: el bloque mira si el chat duerme`);
    assert.match(src, /const bloque = dormido \? [^:\n]+ : preguntasParaElBloque\(lineas\);/, `${nombre}: dormido, sin preguntas`);
    assert.match(src, /const deLaApp = dormido \? [^:\n]+ : preguntasDeLaApp\(lineas\);/, `${nombre}: dormido, sin las de la app`);
    assert.match(src, /const trabado = chatTrabadoEnLaApp\(lineas\)/, `${nombre}: «trabado» con todas las de la app`);
    assert.match(src, /indiceTabs=\{indiceTabs\}/, `${nombre}: el bloque de «Completado» con el índice`);
  }
  assert.match(leer('app/admin/operaciones/useCentro.ts'), /esperasSinDormidos\(esperas, conVigia, ahoraLista\)/);
  for (const r of ['app/admin/operaciones/datos.ts', 'app/m/operaciones/page.tsx']) assert.match(leer(r), /indiceTabs: indiceDeTabs\(\)/, `${r} no manda el índice`);
});

// PROBADO ROMPIÉNDOLO (10/11/2026, base 6/0; cada rotura sola, restaurada de memoria):
//   · `tabDeChat` sin buscar por el área de la bitácora                        → 5/1 (1)
//   · las palabras comunes («plan», «perfil») buscadas adentro del título      → 5/1 (1)
//   · el Cerebro como una tab más                                              → 5/1 (1)
//   · un chat de tarea solo en su tab no sube a cabeza                         → 5/1 (2)
//   · plegado también lo que espera a Martín                                   → 5/1 (3)
//   · se pliega el huérfano solo («Mostrar 1 chat» sin nada que diga de qué)   → 5/1 (3)
//   · dormido aunque esté trabajando                                           → 5/1 (4)
//   · el Cerebro se duerme                                                     → 5/1 (4)
//   · el chat que se está mirando sale de la lista                             → 5/1 (4)
//   · el rótulo sin el «Voy a trabajar en…»                                    → 5/1 (5)
//   · el rótulo sin la tab                                                     → 5/1 (5)
//   · la computadora lista los dormidos / sin agrupar por tab                  → 5/1 (6) cada una
//   · el globito cuenta a los dormidos                                         → 5/1 (6)
//   · NEUTRO: renombrar una variable local del rótulo                          → 6/0 (verde, como tiene que ser)
