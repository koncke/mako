'use client';

// =============================================================================
// Los grupos de la persona, para la lista de chats (3/11/2026)
// =============================================================================
// Aparte de las pantallas: ChatSecondBrain y ChatClienteM no hacen pedidos propios (tests/ops-center-cliente.test.ts), y el super admin en lo suyo tiene
// `useChatCliente` apagado. No hay tiempo real en la app: se lee cada 15 s con la pestaña a la vista, y al volver a ella.
//
// ⚠️ UN FALLO MANTIENE LO DIBUJADO (la regla del 22/10, por el 503 de cada deploy): la fila fijada no se va porque un pedido no salió. Y lo que no cambió
// conserva la referencia (`mismoValor`): la lista no se redibuja cada 15 s.

import { useCallback, useEffect, useRef, useState } from 'react';
import { mismoValor } from '@/lib/centro-estable';
import type { GrupoDeLaLista } from './pantalla';

/** Cada cuánto se relee la lista. Sin medir con carga: es criterio. */
export const MS_LISTA_DE_GRUPOS = 15_000;

export type GruposDeLaLista = {
  /** null: todavía no se pudo leer ninguna vez. */
  grupos: readonly GrupoDeLaLista[] | null;
  /** La primera lectura todavía no volvió. */
  cargando: boolean;
  ahora: number;
  recargar: () => void;
  /** Ya lo leyó: el número se va en el acto, sin esperar la vuelta siguiente. */
  anotarLeido: (ws: number, hastaId: number) => void;
};

export function useGrupos(activo = true): GruposDeLaLista {
  const [grupos, setGrupos] = useState<readonly GrupoDeLaLista[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ahora, setAhora] = useState(() => Date.now());
  const vivo = useRef(true);
  // Lo que ya se marcó como leído acá: una lectura que salió antes de marcar no trae el número de vuelta.
  const leidos = useRef(new Map<number, number>());

  const recargar = useCallback(() => {
    void fetch('/api/grupos', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { ok?: boolean; grupos?: GrupoDeLaLista[] } | null) => {
        if (!vivo.current) return;
        setCargando(false);
        // «2 min»: con el minuto alcanza. Cada 15 s redibujaría el Ops Center entero, que monta este hook.
        setAhora((a) => (Date.now() - a >= 60_000 ? Date.now() : a));
        if (!j?.ok || !Array.isArray(j.grupos)) return;
        const lista = j.grupos.map((g) => {
          const leido = leidos.current.get(g.ws) ?? 0;
          return g.ultimo && g.ultimo.id <= leido ? { ...g, noLeidos: 0, hastaId: Math.max(g.hastaId, leido) } : g;
        });
        setGrupos((antes) => mismoValor(antes, lista));
      });
  }, []);

  useEffect(() => {
    vivo.current = true;
    if (!activo) return () => { vivo.current = false; };
    recargar();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') recargar(); }, MS_LISTA_DE_GRUPOS);
    const alVolver = () => { if (document.visibilityState === 'visible') recargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { vivo.current = false; window.clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [activo, recargar]);

  const anotarLeido = useCallback((ws: number, hastaId: number) => {
    leidos.current.set(ws, Math.max(leidos.current.get(ws) ?? 0, hastaId));
    // También hasta dónde: al volver a abrirlo, «Sin leer» no marca lo que se acaba de leer.
    setGrupos((antes) => antes?.map((g) => (g.ws === ws ? { ...g, noLeidos: 0, hastaId: Math.max(g.hastaId, hastaId) } : g)) ?? antes);
  }, []);

  return { grupos, cargando, ahora, recargar, anotarLeido };
}
