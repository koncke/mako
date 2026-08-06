// =============================================================================
// exportar — bajarse las tareas y los proyectos del tablero
// =============================================================================
// Sale del estado que el board YA tiene en memoria, no de una ruta nueva: así anda
// igual en el tablero del dueño (plan_tareas) que en el del cliente
// (experimento_tareas) sin duplicar permisos ni queries, y baja al instante.
//
// Dos formatos, porque son dos usos distintos:
//   · CSV      → para abrirlo en una planilla y filtrar/ordenar/sumar.
//   · Markdown → para leerlo, mandarlo por chat o pegarlo en un documento.
//
// Va TODO lo que se ve en la tarjeta: número, proyecto, prioridad, score, avance,
// deadline, checklist y el detalle completo. Un export al que le falta el detalle no
// sirve para nada — es justo el contexto que costó cargar.
// =============================================================================

import type { BoardTask, Label } from './types';
import { capacidad } from '@/lib/mako-capacidades';

/** «crm-lead» no le dice nada a nadie en una planilla: sale el nombre de la tab. */
const dondeSeHace = (id?: string): string => {
  if (!id) return '';
  const c = capacidad(id);
  return c ? `${c.tab} — ${c.que}` : id;
};

const hoy = (): string => new Date().toISOString().slice(0, 10);

/** Una celda de CSV: comillas dobles siempre, y las de adentro escapadas. */
const celda = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`;

const nombresDe = (t: BoardTask, labels: Label[]): string =>
  t.labels.map((id) => labels.find((l) => l.id === id)?.name).filter(Boolean).join(' · ');

/** Estado legible: es lo primero que se mira en una planilla. */
const estado = (t: BoardTask): string =>
  t.progress >= 100 ? 'Hecha' : t.progress > 0 ? 'En curso' : 'Pendiente';

/** El ID VISIBLE del proyecto (P11) — es como el dueño lo nombra al hablar de él. */
const pidsDe = (t: BoardTask, labels: Label[]): string =>
  t.labels.map((id) => labels.find((l) => l.id === id)?.pid).filter(Boolean).join(' · ');

/**
 * Qué columnas lleva el export además de las fijas (#, título, proyecto, estado).
 * Se elige en el modal: un CSV con veinte columnas no se lee, y uno sin la
 * justificación de prioridad no sirve para discutir el orden con nadie.
 */
export type CampoExtra = 'prioridad' | 'detalle' | 'razonScore' | 'deadline' | 'checklist' | 'notas' | 'origen' | 'haceloEn';

// ORDEN = lo que más se usa primero. Con los ocho a la vista el paso se leía como una
// pantalla de configuración; los cuatro de arriba son los que alguien quiere el 90% de
// las veces (qué es, cuánto pesa, para cuándo) y el resto vive detrás de "Avanzado".
export const CAMPOS_EXTRA: Array<{ id: CampoExtra; label: string; sub: string }> = [
  { id: 'detalle', label: 'Descripciones', sub: 'el contexto completo de cada tarea' },
  { id: 'prioridad', label: 'Prioridad y score', sub: 'la columna y el puntaje del Perro' },
  { id: 'deadline', label: 'Fecha y su razón', sub: 'para cuándo y por qué esa fecha' },
  { id: 'checklist', label: 'Checklist', sub: 'los pasos, con cuáles están hechos' },
  { id: 'razonScore', label: 'Por qué esa prioridad', sub: 'el argumento del Perro, textual' },
  { id: 'notas', label: 'Tus notas', sub: 'el cuaderno tuyo de cada tarjeta' },
  { id: 'origen', label: 'De dónde salió', sub: 'quién la creó y de qué reunión' },
  { id: 'haceloEn', label: 'Dónde hacerla', sub: 'la tab de MaKo que la resuelve' },
];

/** Los que vienen tildados y se muestran sin desplegar nada. */
export const CAMPOS_HABITUALES: CampoExtra[] = ['detalle', 'prioridad', 'deadline', 'checklist'];

export function tareasACSV(tasks: BoardTask[], labels: Label[], campos: CampoExtra[] = CAMPOS_EXTRA.map((c) => c.id)): string {
  const on = new Set(campos);
  const cab = ['#', 'Título', 'ID proyecto', 'Proyecto', 'Estado', 'Avance %'];
  if (on.has('prioridad')) cab.push('Prioridad', 'Score');
  if (on.has('razonScore')) cab.push('Por qué esa prioridad');
  if (on.has('deadline')) cab.push('Deadline', 'Por qué esa fecha');
  if (on.has('detalle')) cab.push('Descripción');
  if (on.has('checklist')) cab.push('Pasos', 'Hechos', 'Checklist');
  if (on.has('notas')) cab.push('Notas');
  if (on.has('haceloEn')) cab.push('Se hace en');
  if (on.has('origen')) cab.push('Origen', 'Fuente');

  const filas = tasks.map((t) => {
    const f: unknown[] = [t.num, t.title, pidsDe(t, labels), nombresDe(t, labels), estado(t), t.progress];
    if (on.has('prioridad')) f.push(t.priority, t.score);
    if (on.has('razonScore')) f.push(t.scoreRazon || '');
    if (on.has('deadline')) f.push(t.deadline || '', t.deadlineRazon || '');
    if (on.has('detalle')) f.push((t.detalle || '').replace(/\r?\n/g, ' '));
    if (on.has('checklist')) f.push(t.checklist.length, t.checklist.filter((c) => c.done).length, t.checklist.map((c) => `${c.done ? '[x]' : '[ ]'} ${c.text}`).join(' · '));
    if (on.has('notas')) f.push((t.notas || '').replace(/\r?\n/g, ' '));
    if (on.has('haceloEn')) f.push(dondeSeHace(t.haceloEn));
    if (on.has('origen')) f.push(t.origen, t.fuente ? `${t.fuente.tipo}${t.fuente.etiqueta ? `: ${t.fuente.etiqueta}` : ''}` : '');
    return f.map(celda).join(',');
  });
  // BOM al principio: sin él, Excel abre el archivo en Windows-1252 y los acentos
  // salen rotos ("Diseño" → "DiseÃ±o"). Un export ilegible no es un export.
  return `﻿${cab.map(celda).join(',')}\n${filas.join('\n')}\n`;
}

export function proyectosACSV(labels: Label[], tasks: BoardTask[], campos: CampoExtra[] = CAMPOS_EXTRA.map((c) => c.id)): string {
  const on = new Set(campos);
  const cab = ['ID', 'Proyecto', 'Emoji', 'Tareas', 'Abiertas', 'Hechas', 'Avance %'];
  if (on.has('prioridad')) cab.push('Score');
  if (on.has('razonScore')) cab.push('Por qué esa prioridad');
  if (on.has('deadline')) cab.push('Deadline');
  if (on.has('detalle')) cab.push('Descripción');
  if (on.has('notas')) cab.push('Notas');
  const filas = labels.map((l) => {
    const suyas = tasks.filter((t) => t.labels.includes(l.id));
    const hechas = suyas.filter((t) => t.progress >= 100).length;
    const avance = suyas.length ? Math.round((hechas / suyas.length) * 100) : 0;
    const f: unknown[] = [l.pid || '', l.name, l.emoji, suyas.length, suyas.length - hechas, hechas, avance];
    if (on.has('prioridad')) f.push(l.score);
    if (on.has('razonScore')) f.push(l.scoreRazon || '');
    if (on.has('deadline')) f.push(l.deadline || '');
    if (on.has('detalle')) f.push((l.detalle || '').replace(/\r?\n/g, ' '));
    if (on.has('notas')) f.push((l.notas || '').replace(/\r?\n/g, ' '));
    return f.map(celda).join(',');
  });
  return `﻿${cab.map(celda).join(',')}\n${filas.join('\n')}\n`;
}

/**
 * El tablero entero como documento: agrupado POR PROYECTO y ordenado por score, que
 * es como se lee de verdad. Las tareas hechas van al final de cada proyecto, tachadas.
 */
export function tableroAMarkdown(tasks: BoardTask[], labels: Label[], titulo = 'Plan', campos: CampoExtra[] = CAMPOS_EXTRA.map((c) => c.id)): string {
  const on = new Set(campos);
  const out: string[] = [`# ${titulo}`, '', `_${tasks.length} tareas · ${labels.length} proyectos · ${hoy()}_`, ''];
  const orden = [...labels].sort((a, b) => b.score - a.score);
  const sueltas = tasks.filter((t) => !t.labels.length);

  for (const l of orden) {
    const suyas = tasks.filter((t) => t.labels.includes(l.id)).sort((a, b) => Number(a.progress >= 100) - Number(b.progress >= 100) || b.score - a.score);
    if (!suyas.length) continue;
    const hechas = suyas.filter((t) => t.progress >= 100).length;
    // El P# va en el título: es el identificador con el que se lo busca y se lo nombra.
    out.push(`## ${l.emoji} ${l.pid ? `${l.pid} · ` : ''}${l.name}`, '', `_${on.has('prioridad') ? `prioridad ${l.score} · ` : ''}${suyas.length - hechas} pendientes de ${suyas.length}_`, '');
    if (l.detalle && on.has('detalle')) out.push(l.detalle, '');
    if (l.scoreRazon && on.has('razonScore')) out.push(`> Por qué esta prioridad: ${l.scoreRazon}`, '');
    if (l.notas && on.has('notas')) out.push(`> Tus notas: ${l.notas}`, '');
    for (const t of suyas) out.push(...tareaAMarkdown(t, on));
    out.push('');
  }
  if (sueltas.length) {
    out.push('## Sin proyecto', '');
    for (const t of sueltas) out.push(...tareaAMarkdown(t, on));
  }
  return out.join('\n');
}

function tareaAMarkdown(t: BoardTask, on: Set<CampoExtra>): string[] {
  const hecha = t.progress >= 100;
  const tit = hecha ? `~~${t.title}~~` : t.title;
  const meta = [
    on.has('prioridad') ? `prioridad ${t.priority}` : '',
    on.has('prioridad') ? `score ${t.score}` : '',
    on.has('deadline') && t.deadline ? `para el ${t.deadline}` : '',
    hecha ? 'hecha' : t.progress > 0 ? `${t.progress}%` : '',
  ].filter(Boolean).join(' · ');
  const l: string[] = [`- [${hecha ? 'x' : ' '}] **#${t.num} ${tit}**${meta ? ` — _${meta}_` : ''}`];
  // El detalle indentado, no como cita: pegado en un doc queda como parte del ítem.
  if (t.detalle && on.has('detalle')) for (const linea of t.detalle.split(/\r?\n/)) l.push(`  ${linea}`);
  if (t.scoreRazon && on.has('razonScore')) l.push(`  _Por qué esta prioridad: ${t.scoreRazon}_`);
  if (t.deadlineRazon && on.has('deadline')) l.push(`  _Por qué esta fecha: ${t.deadlineRazon}_`);
  if (t.notas && on.has('notas')) l.push(`  _Tus notas: ${t.notas}_`);
  if (t.haceloEn && on.has('haceloEn')) l.push(`  _Se hace en: ${dondeSeHace(t.haceloEn)}_`);
  if (on.has('origen') && t.fuente) l.push(`  _De: ${t.fuente.tipo}${t.fuente.etiqueta ? ` · ${t.fuente.etiqueta}` : ''}_`);
  if (on.has('checklist')) for (const c of t.checklist) l.push(`  - [${c.done ? 'x' : ' '}] ${c.text}`);
  return l;
}

/** Dispara la descarga en el navegador. */
export function descargar(nombre: string, contenido: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // El revoke va diferido: hacerlo en la misma vuelta cancela la descarga en Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/**
 * El nombre dice QUÉ te bajaste, no solo cuándo.
 *
 * Antes era `${titulo}-${que}-${fecha}`, o sea que TODO salía como
 * «plan-completo-2026-08-06»: bajabas los anuncios, bajabas el plan entero y bajabas
 * tres tareas sueltas, y los tres archivos se llamaban igual. En la carpeta de
 * Descargas eso es un archivo que no se puede distinguir de otro sin abrirlo — y el
 * segundo pisa al primero.
 *
 * `detalle` es lo que se eligió (los proyectos, el subconjunto, cuántas filas).
 */
export const nombreArchivo = (titulo: string, que: string, ext: string, detalle?: string): string =>
  [slug(titulo), que, detalle ? slug(detalle) : '', hoy()].filter(Boolean).join('-') + `.${ext}`;
