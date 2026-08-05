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

const hoy = (): string => new Date().toISOString().slice(0, 10);

/** Una celda de CSV: comillas dobles siempre, y las de adentro escapadas. */
const celda = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`;

const nombresDe = (t: BoardTask, labels: Label[]): string =>
  t.labels.map((id) => labels.find((l) => l.id === id)?.name).filter(Boolean).join(' · ');

/** Estado legible: es lo primero que se mira en una planilla. */
const estado = (t: BoardTask): string =>
  t.progress >= 100 ? 'Hecha' : t.progress > 0 ? 'En curso' : 'Pendiente';

export function tareasACSV(tasks: BoardTask[], labels: Label[]): string {
  const cab = ['#', 'Título', 'Proyecto', 'Prioridad', 'Score', 'Estado', 'Avance %', 'Deadline', 'Checklist', 'Hechos', 'Detalle', 'Por qué ese score', 'Origen', 'Fuente'];
  const filas = tasks.map((t) => [
    t.num, t.title, nombresDe(t, labels), t.priority, t.score, estado(t), t.progress,
    t.deadline || '', t.checklist.length, t.checklist.filter((c) => c.done).length,
    (t.detalle || '').replace(/\r?\n/g, ' '), t.scoreRazon || '', t.origen,
    t.fuente ? `${t.fuente.tipo}${t.fuente.etiqueta ? `: ${t.fuente.etiqueta}` : ''}` : '',
  ].map(celda).join(','));
  // BOM al principio: sin él, Excel abre el archivo en Windows-1252 y los acentos
  // salen rotos ("Diseño" → "DiseÃ±o"). Un export ilegible no es un export.
  return `﻿${cab.map(celda).join(',')}\n${filas.join('\n')}\n`;
}

export function proyectosACSV(labels: Label[], tasks: BoardTask[]): string {
  const cab = ['Proyecto', 'Emoji', 'Score', 'Tareas', 'Abiertas', 'Hechas', 'Avance %', 'Deadline', 'Descripción'];
  const filas = labels.map((l) => {
    const suyas = tasks.filter((t) => t.labels.includes(l.id));
    const hechas = suyas.filter((t) => t.progress >= 100).length;
    const avance = suyas.length ? Math.round((hechas / suyas.length) * 100) : 0;
    return [l.name, l.emoji, l.score, suyas.length, suyas.length - hechas, hechas, avance, l.deadline || '', (l.detalle || '').replace(/\r?\n/g, ' ')].map(celda).join(',');
  });
  return `﻿${cab.map(celda).join(',')}\n${filas.join('\n')}\n`;
}

/**
 * El tablero entero como documento: agrupado POR PROYECTO y ordenado por score, que
 * es como se lee de verdad. Las tareas hechas van al final de cada proyecto, tachadas.
 */
export function tableroAMarkdown(tasks: BoardTask[], labels: Label[], titulo = 'Plan'): string {
  const out: string[] = [`# ${titulo}`, '', `_${tasks.length} tareas · ${labels.length} proyectos · ${hoy()}_`, ''];
  const orden = [...labels].sort((a, b) => b.score - a.score);
  const sueltas = tasks.filter((t) => !t.labels.length);

  for (const l of orden) {
    const suyas = tasks.filter((t) => t.labels.includes(l.id)).sort((a, b) => Number(a.progress >= 100) - Number(b.progress >= 100) || b.score - a.score);
    if (!suyas.length) continue;
    const hechas = suyas.filter((t) => t.progress >= 100).length;
    out.push(`## ${l.emoji} ${l.name}`, '', `_prioridad ${l.score} · ${suyas.length - hechas} pendientes de ${suyas.length}_`, '');
    if (l.detalle) out.push(l.detalle, '');
    for (const t of suyas) out.push(...tareaAMarkdown(t));
    out.push('');
  }
  if (sueltas.length) {
    out.push('## Sin proyecto', '');
    for (const t of sueltas) out.push(...tareaAMarkdown(t));
  }
  return out.join('\n');
}

function tareaAMarkdown(t: BoardTask): string[] {
  const hecha = t.progress >= 100;
  const tit = hecha ? `~~${t.title}~~` : t.title;
  const meta = [`prioridad ${t.priority}`, `score ${t.score}`, t.deadline ? `para el ${t.deadline}` : '', hecha ? 'hecha' : t.progress > 0 ? `${t.progress}%` : ''].filter(Boolean).join(' · ');
  const l: string[] = [`- [${hecha ? 'x' : ' '}] **#${t.num} ${tit}** — _${meta}_`];
  // El detalle indentado, no como cita: pegado en un doc queda como parte del ítem.
  if (t.detalle) for (const linea of t.detalle.split(/\r?\n/)) l.push(`  ${linea}`);
  for (const c of t.checklist) l.push(`  - [${c.done ? 'x' : ' '}] ${c.text}`);
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

export const nombreArchivo = (titulo: string, que: string, ext: string): string =>
  `${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${que}-${hoy()}.${ext}`;
