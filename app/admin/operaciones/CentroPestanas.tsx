'use client';

// =============================================================================
// El Centro de Operaciones en pestañas: Pedidos · Pushes · Áreas · Trabajos (15/10/2026)
// =============================================================================
// Las vistas de GitHub Projects son pestañas arriba de la tabla; acá también. La pestaña viaja en
// `?tab=` (leída en el server, escrita con el router de la casa, que conserva el `?ws=`). «Pedidos» es
// la de entrada: «Lo que quiero ver allí es lo que te pedí, los pushes de lo terminado, los pendientes que
// estamos trabajando ahora mismo, las cosas que ya están terminadas, empezadas, etc...» (Martín, 15/10).

import { useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button, ErrorState, PageHeader, Tabs } from '@/app/_ui';
import type { EstadoCarteros, Pedido } from '@/lib/operaciones';
import { PESTANAS_CENTRO, type Frente, type PedidoP, type PestanaCentro } from '@/lib/progreso-reglas';
import type { LecturaPushes } from '@/lib/progreso';
import CentroOperaciones from './CentroOperaciones';
import { Progreso } from './Progreso';


export function CentroPestanas({ inicial, frentes, pedidos, pushes, todos, hayCartero, ahora, sub, cola, carteros }: {
  inicial: PestanaCentro;
  frentes: Frente[];
  pedidos: PedidoP[];
  pushes: LecturaPushes;
  todos: boolean;
  hayCartero: boolean;
  ahora: number;
  sub: string;
  /** La cola de trabajos y los carteros; null si no se pudieron leer (Progreso se ve igual). */
  cola: Pedido[] | null;
  carteros: EstadoCarteros | null;
}) {
  const [tab, setTab] = useState<PestanaCentro>(inicial);
  const router = useRouter();
  const cambiar = (id: string) => {
    const t = (PESTANAS_CENTRO as readonly string[]).includes(id) ? (id as PestanaCentro) : 'pedidos';
    setTab(t);
    router.replace(t === 'pedidos' ? '/admin/operaciones' : `/admin/operaciones?tab=${t}`, { scroll: false });
  };
  // El número de la pestaña: lo que todavía no está terminado (sin empezar y empezado).
  const abiertos = pedidos.filter((p) => p.estado !== 'hecho').length;
  // «Sigo sin ver los pendientes y poder refrescar en el centro» (Martín, 15/10): en el teléfono se tira
  // hacia abajo; acá, el botón. Vuelve a leer bitácoras, Vercel y la cola sin perder la pestaña.
  const [actualizando, empezar] = useTransition();
  const hora = new Date(ahora).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  return (
    <>
      <PageHeader
        titulo="Centro de Operaciones"
        proposito="Tus pedidos: qué está sin empezar, qué se está trabajando y qué ya está en producción."
        accion={(
          <div className="prog-actualizar">
            <span className="prog-meta">{`Al día a las ${hora}`}</span>
            <Button variant="secondary" size="sm" loading={actualizando} onClick={() => empezar(() => router.refresh())}>Actualizar</Button>
          </div>
        )}
      />
      <Tabs
        tabs={[
          { id: 'pedidos', label: 'Pedidos', badge: abiertos || undefined },
          { id: 'pushes', label: 'Pushes' },
          { id: 'areas', label: 'Áreas' },
          { id: 'trabajos', label: 'Trabajos' },
        ]}
        activa={tab}
        onCambio={cambiar}
      />
      {tab !== 'trabajos'
        ? <Progreso vista={tab} frentes={frentes} pedidos={pedidos} pushes={pushes} todos={todos} hayCartero={hayCartero} ahora={ahora} />
        : cola && carteros
          ? <CentroOperaciones embebido sub={sub} pedidosIniciales={cola} carterosIniciales={carteros} />
          : <ErrorState titulo="No pude leer la cola de trabajos" />}
    </>
  );
}
