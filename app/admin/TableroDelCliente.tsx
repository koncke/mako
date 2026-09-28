'use client';

// =============================================================================
// TableroDelCliente — EL tablero de ese cliente, adentro de su ficha
// =============================================================================
// «Aun no veo el plan, las tareas y proyectos de cada cliente» + «tienes que COPIAR
// tal cual el diseño» (28/09/2026).
//
// ⚠️ ES `PlanBoard` / `TodoBoard`, los mismos que monta `/plan` y los mismos que monta
// la ficha de un cliente en Customer Success — con sus cuatro vistas (Prioridades,
// Tareas, Proyectos, Recurrentes). No una tabla parecida: ese intento se reportó como
// «se ve completamente diferente y más fea», y tenía razón. La regla ya estaba escrita
// en la ficha de Customer Success: «parecido no es igual, y un segundo diseño de la
// misma cosa se mantiene sincronizado a mano hasta que alguien se olvida».
//
// ⚠️ Y LAS ESCRITURAS CAEN EN EL WORKSPACE DEL CLIENTE, no en el del que mira. Ésa es
// la única diferencia real con Customer Success, y es la que hay que tener presente:
// allá el tablero es del workspace actual, acá es de OTRO inquilino.
//
// El workspace del tablero NO puede viajar por la URL de la pestaña —ponerle `?ws=`
// apagaría el panel de atrás, porque `estaImpersonando()` pasaría a true y
// /customer-success dejaría de renderizar la vista de la plataforma—, así que viaja
// por `setWsDeTrabajo`, que el parche de `fetch` sólo aplica a las rutas del tablero.
// Todo lo demás (empezando por `/api/admin/*`, que el panel de atrás sigue llamando
// mientras el modal está abierto) sale como siempre. Ver `lib/ws-tab.ts`.
//
// ⚠️ SE PONE Y SE SACA CON EL MONTAJE, y el `useEffect` de limpieza es la mitad que
// importa: si quedara puesto después de cerrar la ficha, las llamadas del tablero
// PROPIO del super admin saldrían apuntando al cliente. Por eso el componente que lo
// setea es el que monta el board y nada más — no la ficha, que vive más tiempo.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { PlanBoard } from '@/app/plan/PlanBoard';
import { TodoBoard } from '@/app/plan/TodoBoard';
import { setWsDeTrabajo } from '@/lib/ws-tab';
import type { BoardUser } from '@/app/plan/board/types';
import type { TrabajoDeCliente } from '@/app/customer-success/trabajo';

export function TableroDelCliente({ ws, nombre, user }: {
  ws: number;
  nombre: string;
  user: BoardUser;
}) {
  const router = useRouter();
  const [trabajo, setTrabajo] = useState<TrabajoDeCliente | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * ⚠️ EL `?ws=` SE PONE ANTES DE PEDIR NADA, y se saca al desmontar. Va en su propio
   * efecto y primero en el archivo para que no dependa del orden de nada: el fetch de
   * abajo ya sale con él puesto.
   */
  useEffect(() => {
    setWsDeTrabajo(ws);
    return () => setWsDeTrabajo(null);
  }, [ws]);

  /**
   * ⚠️ SE PIDE AL ABRIR, y acá sí hace falta el estado de carga. La ficha de un cliente
   * de Customer Success se sacó el suyo trayendo el trabajo con el HTML — puede, porque
   * son los leads de UN workspace. Acá serían los tableros de los NUEVE, y el más grande
   * tiene 212 tareas: bajarlos todos para abrir uno es pagar nueve veces lo que se mira
   * una. Lo que no se puede hacer es un spinner mudo (AGENTS.md).
   */
  const cargar = useCallback(async () => {
    setError(null);
    try {
      const j = await (await fetch(`/api/admin/tablero?ws=${ws}`)).json();
      if (!j?.ok) { setError(j?.error ?? 'No pude leer su tablero.'); return; }
      setTrabajo(j.trabajo as TrabajoDeCliente);
    } catch {
      setError('No pude leer su tablero.');
    }
  }, [ws]);
  useEffect(() => { void cargar(); }, [cargar]);

  // «No pude leer» NO se pinta como «no tiene nada»: son dos pantallas, y la segunda
  // sobre la primera es la mentira que nadie audita.
  if (error) return <p className="tc-mal">{error}</p>;
  if (!trabajo) return <p className="tc-esp">Leyendo el tablero de {nombre}…</p>;

  /**
   * ⚠️ `embebido` Y `onRecargar`, igual que en la ficha de un cliente. El tablero fue
   * escrito asumiendo que ES la ruta: sin `embebido` escribe `?tarea=` en la URL de
   * /customer-success y la relee al reabrir, y su `location.reload()` CIERRA la ficha
   * —qué cliente está abierto es estado de React, no viaja en la URL—.
   *
   * ⚠️ Y SIN `clienteFijo`: en Customer Success el tablero está filtrado al trabajo de
   * UN lead y lo que se crea ahí nace suyo. Acá es el tablero ENTERO de ese workspace,
   * así que no hay ningún cliente que fijar — ponerle uno haría que toda tarea nueva
   * naciera atribuida a alguien que nadie eligió.
   */
  return trabajo.dueno
    ? (
      <PlanBoard user={user} tareas={trabajo.tareas} proyectos={trabajo.proyectos}
        vacio={false} clientes={[]} embebido onRecargar={() => { void cargar(); router.refresh(); }} />
    ) : (
      <TodoBoard tareas={trabajo.tareas} categorias={trabajo.categorias} demo={false}
        user={user} wsId={ws} clientes={[]} embebido
        onRecargar={() => { void cargar(); router.refresh(); }} />
    );
}
