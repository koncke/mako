'use client';

// =============================================================================
// TableroDelCliente — sus proyectos y sus tareas, adentro de la ficha
// =============================================================================
// «Aun no veo el plan, las tareas y proyectos de cada cliente» (28/09/2026).
//
// ⚠️ SON LAS TABLAS DEL TABLERO DE VERDAD (`TablaProyectos` y `TablaTareas` de
// `app/plan/board/Tablas.tsx`), no un dibujo parecido. Es la misma regla que ya se
// pagó tres veces en la ficha de Customer Success: «parecido no es igual, y un segundo
// diseño de la misma cosa se mantiene sincronizado a mano hasta que alguien se olvida».
// Lo que cambia no es la pieza: es que acá no se le pasan las capacidades de escribir.
//
// ⚠️ Y ES DE SÓLO LECTURA A PROPÓSITO — no es una etapa, es lo que se midió. El tablero
// escribe por `fetch` DEL NAVEGADOR, y el workspace de esos fetch no sale del
// componente: sale de la URL de la PESTAÑA (`WsFetch` + `proxy.ts`). Montarlo acá
// escribible deja **24 `fetch` en 11 archivos** apuntando al workspace del que MIRA —
// los 2 de los Repos más 22 que el tablero dispara solo (el buscador, el dictado, la
// extracción de reuniones, las tres subidas de imagen…). Y no fallan ruidosamente:
// `/api/plan-board` hace upsert con `onConflict: 'workspace_id,id'`, así que arrastrar
// una tarjeta del cliente le CLONARÍA la fila al tablero del super admin. 200, sin
// error, y la tarea duplicada en el inquilino equivocado.
//
// Por eso las tablas se montan SIN `onSoltar`, SIN `onEliminar`, SIN `onFecha` y SIN
// `onHecha`: en este archivo «la prop ES la capacidad» (así lo dice `Tablas.tsx`), y lo
// que no se puede hacer no se dibuja como si se pudiera. Para editar está
// «Inspeccionar», que entra al cliente con su `?ws=` y ahí lectura y escritura son
// coherentes.

import { useCallback, useEffect, useState } from 'react';
import { TablaProyectos, TablaTareas } from '@/app/plan/board/Tablas';
import { useBoard } from '@/app/plan/board/useBoard';
import { projProgress, hoyISO } from '@/app/plan/board/piezas';
import type { BoardTask, Label, Repo, BoardUser } from '@/app/plan/board/types';
import { MONO } from './estilos';

/**
 * Lo que contesta /api/admin/tablero: UNA sola forma para los dos tableros.
 *
 * ⚠️ El server ya hizo la conversión al modelo del board. Acá NO se castea nada: un `as`
 * entre la fila de la base y `BoardTask` compila —los dos son objetos— y revienta al
 * dibujar, porque la fila no tiene `labels`. Medido en el navegador.
 */
type Trabajo = { dueno: boolean; tareas: BoardTask[]; proyectos: Label[] };

/**
 * Un Repo que NO escribe.
 *
 * ⚠️ LOS SEIS OBLIGATORIOS TIRAN en vez de devolver en silencio. Un no-op que resuelve
 * deja al board pintando el cambio con su estado optimista, así que la pantalla muestra
 * algo que la base no tiene y sólo se descubre al recargar — la peor de las tres
 * opciones. Si alguno llega a llamarse, es un control que quedó dibujado y hay que
 * verlo, no taparlo.
 *
 * ⚠️ Y LOS NUEVE OPCIONALES ESTÁN AUSENTES A PROPÓSITO: es el mecanismo que el propio
 * tipo `Repo` documenta («la ausencia tiene que VERSE: el bloque no se dibuja»).
 */
function repoDeLectura(dueno: boolean): Repo {
  const no = (): never => { throw new Error('Este tablero es de sólo lectura: entra al cliente para editarlo.'); };
  return {
    labelMode: dueno ? 'single' : 'multi',
    labelSingular: dueno ? 'Proyecto' : 'Categoría',
    labelPlural: dueno ? 'Proyectos' : 'Categorías',
    createTask: no, saveTask: no, deleteTask: no,
    createLabel: no, saveLabel: no, deleteLabel: no,
  };
}

export function TableroDelCliente({ ws, nombre, user }: {
  ws: number;
  nombre: string;
  user: BoardUser;
}) {
  const [trabajo, setTrabajo] = useState<Trabajo | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * ⚠️ SE PIDE AL ABRIR, y acá sí hace falta el estado de carga. La ficha de un cliente
   * de Customer Success se sacó el suyo trayendo el trabajo con el HTML — puede, porque
   * son los leads de UN workspace. Acá serían los tableros de los NUEVE, y el más grande
   * tiene 212 tareas: bajarlos todos para abrir uno es pagar nueve veces lo que se mira
   * una. Lo que no se puede hacer es un spinner mudo (ver AGENTS.md).
   */
  const cargar = useCallback(async () => {
    setError(null);
    try {
      const j = await (await fetch(`/api/admin/tablero?ws=${ws}`)).json();
      if (!j?.ok) { setError(j?.error ?? 'No pude leer su tablero.'); return; }
      setTrabajo(j.trabajo as Trabajo);
    } catch {
      setError('No pude leer su tablero.');
    }
  }, [ws]);
  useEffect(() => { void cargar(); }, [cargar]);

  if (error) {
    // «No pude leer» NO se pinta como «no tiene nada»: son dos pantallas, y la segunda
    // sobre la primera es la mentira que nadie audita.
    return <p className="tc-mal">{error}</p>;
  }
  if (!trabajo) return <p className="tc-esp">Leyendo el tablero de {nombre}…</p>;
  return <Tablas trabajo={trabajo} nombre={nombre} user={user} />;
}

/** El board se arma en un hijo: `useBoard` es un hook y no puede colgar de un `if`. */
function Tablas({ trabajo, nombre, user }: { trabajo: Trabajo; nombre: string; user: BoardUser }) {
  const { tareas, proyectos } = trabajo;
  const board = useBoard(tareas, proyectos, user, repoDeLectura(trabajo.dueno));
  const hoy = hoyISO();

  // Lo abierto primero, y lo terminado al fondo: el mismo orden que el tablero.
  const abiertas = tareas.filter((t) => t.progress < 100).length;

  if (!tareas.length && !proyectos.length) {
    // Vacío de verdad: la lectura salió bien y no hay nada. Se puede decir.
    return <p className="tc-esp">{nombre} todavía no tiene nada en su tablero.</p>;
  }

  return (
    <div className="tc">
      <div className="tc-cab">
        <span className="tc-n">{proyectos.length}</span> {board.repo.labelPlural.toLowerCase()} ·{' '}
        <span className="tc-n">{abiertas}</span> {abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'} de{' '}
        <span className="tc-n">{tareas.length}</span>
      </div>

      {proyectos.length > 0 && (
        <>
          <div className="tc-rot">{board.repo.labelPlural}</div>
          {/* Sin `onDeadline` ni `onSoltar`: acá no se escribe. `onOpen` tampoco hace
              nada — el detalle de un proyecto es del tablero, y abrirlo desde afuera
              sería montar media pantalla más para no poder tocar nada. */}
          <TablaProyectos
            filas={proyectos.map((l) => ({ l, prog: projProgress(tareas, l.id) }))}
            board={board} topProjectId={null} hoy={hoy}
            labelPlural={board.repo.labelPlural}
            onOpen={() => {}}
            soloLectura
          />
        </>
      )}

      {tareas.length > 0 && (
        <>
          <div className="tc-rot">Tareas</div>
          <TablaTareas tareas={tareas} board={board} hoy={hoy} onOpen={() => {}} ask={(_m, ok) => ok()} soloLectura />
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

// ⚠️ Ningún backtick acá adentro: cierra la cadena a la mitad y la ruta contesta 200 sin
// cuerpo.
const CSS = `
.tc{ display:flex; flex-direction:column; gap:6px; }
.tc-cab{ font-size:12.5px; color:var(--dim); margin-bottom:6px; }
.tc-n{ font-family:${MONO}; font-weight:700; color:var(--ink); }
.tc-rot{ font-family:${MONO}; font-size:10px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--faint); margin:14px 2px 6px; }
.tc-esp{ margin:16px 2px; font-size:13.5px; color:var(--faint); }
.tc-mal{ margin:16px 2px; font-size:13.5px; color:var(--bad); }
`;
