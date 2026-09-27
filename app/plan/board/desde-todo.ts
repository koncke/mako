// =============================================================================
// desde-todo — fila del tablero del CLIENTE → modelo del board
// =============================================================================
// Los dos mappers de ENTRADA de `experimento_tareas` / `tarea_categorias`. Vivían
// adentro de `app/plan/TodoBoard.tsx`, que es `'use client'`.
//
// ⚠️ SE MUDARON ACÁ EL 26/09/2026 PORQUE UN SERVER COMPONENT LOS NECESITA, y un
// `.tsx` con `'use client'` NO exporta valores al grafo del server: exporta una
// referencia de cliente. No falla al importar — falla al USARLO, en otro archivo y
// sin nombrar ninguno de los dos (AGENTS.md lo tiene medido: una hora de producción
// sirviendo el deploy viejo por exactamente esto).
//
// Quien los necesita es `/productivity-analyst`, la pantalla que se llevó los
// gráficos del tablero: lee las filas en el server y las dibuja sin montar un
// `useBoard`, que sería un segundo escritor sobre las mismas tareas.
//
// ⚠️ Y SON UNA SOLA DEFINICIÓN, no una copia. Este mapper es la puerta de entrada
// del tablero del cliente: cada campo que falte acá nace vacío en pantalla y el
// próximo guardado lo manda como `null` a la base. Dos copias garantizan que una
// pierda un campo — ya pasó tres veces en este archivo (prioridad, Quarter,
// recurrencia).

import { type BoardTask, type Label, prioFromScore, scoreFromPrio } from './types';
import type { Tarea, Categoria } from '@/lib/todo';

export const toBoard = (t: Tarea): BoardTask => ({
  // El board del cliente (experimento_tareas) todavía no persiste emoji por tarea:
  // default 📌. El emoji-por-tarea con memoria vive en el board del dueño (SEED).
  id: String(t.id), num: t.id, emoji: '📌', title: t.titulo, detalle: t.detalle ?? '',
  priority: prioFromScore(t.score || scoreFromPrio[t.prioridad]), score: t.score || scoreFromPrio[t.prioridad],
  scoreRazon: t.score_razon ?? undefined,
  progress: t.progreso, deadline: t.deadline ?? '', quarter: t.quarter ?? undefined, recurrente: t.recurrente, recurrencia: t.recurrencia,
  labels: t.categorias.map(String), checklist: t.checklist, historial: t.historial,
  origen: t.origen === 'manual' ? 'user' : 'ia', enPrioridad: t.en_prioridad,
  // De dónde salió: pinta el mismo chip que en el board del dueño (con link al minuto).
  fuente: (t.fuente as BoardTask['fuente']) ?? undefined,
  // DE QUIÉN es (mig 0172). Va en el mapper de ENTRADA o el chip nace vacío en cada carga
  // aunque la fila tenga el cliente escrito — y peor: el próximo `editPatch` lo mandaría
  // como `null` y borraría la asignación sin que nadie la tocara.
  clienteLeadId: t.cliente_lead_id, clienteNombre: t.cliente_nombre,
});
// ⚠️ `recurrente` VA ACÁ Y EN LOS DOS PAYLOADS DE ABAJO (mig 0164). Este mapper es la
// puerta de ENTRADA del tablero del cliente: sin él, el interruptor nace apagado en cada
// carga aunque la fila diga `true`, o sea que marcarlo «no hace nada» al recargar.
export const toLabel = (c: Categoria): Label => ({ id: String(c.id), emoji: c.emoji, name: c.nombre, color: c.color, score: c.prioridad, scoreRazon: c.score_razon ?? undefined, deadline: c.deadline ?? undefined, quarter: c.quarter ?? undefined, recurrente: c.recurrente, recurrencia: c.recurrencia, clienteLeadId: c.cliente_lead_id, clienteNombre: c.cliente_nombre,
  // SU PORTADA (mig 0173). Puerta de ENTRADA del tablero del cliente: sin esto la banda
  // nace vacía en cada carga aunque la fila la tenga escrita.
  portada: c.portada,
  // El encuadre y el ícono (mig 0174). La misma trampa de siempre: lo que el mapper
  // de LECTURA no trae vuelve como `undefined` y el próximo upsert borra la columna.
  portadaY: c.portada_y,
  icono: c.icono,
  detalle: c.detalle, historial: c.historial });
