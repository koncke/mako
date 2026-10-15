'use client';

// =============================================================================
// El Centro de Operaciones en pestañas: En curso · Pedidos · Pushes · Trabajos (15/10/2026)
// =============================================================================
// Las vistas de GitHub Projects son pestañas arriba de la tabla; acá también. La pestaña viaja en
// `?tab=` (leída en el server, escrita con el router de la casa, que conserva el `?ws=`). «En curso» es
// la de entrada: es lo que Martín abre el Centro para ver («Sigo sin ver los pendientes»).

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
    const t = (PESTANAS_CENTRO as readonly string[]).includes(id) ? (id as PestanaCentro) : 'curso';
    setTab(t);
    router.replace(t === 'curso' ? '/admin/operaciones' : `/admin/operaciones?tab=${t}`, { scroll: false });
  };
  const pendientes = pedidos.filter((p) => p.estado === 'pendiente').length;
  // «Sigo sin ver los pendientes y poder refrescar en el centro» (Martín, 15/10): en el teléfono se tira
  // hacia abajo; acá, el botón. Vuelve a leer bitácoras, Vercel y la cola sin perder la pestaña.
  const [actualizando, empezar] = useTransition();
  const hora = new Date(ahora).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <PageHeader
        titulo="Centro de Operaciones"
        proposito="En qué andan los chats, tus pedidos y lo que se subió."
        accion={(
          <div className="prog-actualizar">
            <span className="prog-meta">{`Al día a las ${hora}`}</span>
            <Button variant="secondary" size="sm" loading={actualizando} onClick={() => empezar(() => router.refresh())}>Actualizar</Button>
          </div>
        )}
      />
      <Tabs
        tabs={[
          { id: 'curso', label: 'En curso' },
          { id: 'pedidos', label: 'Pedidos', badge: pendientes || undefined },
          { id: 'pushes', label: 'Pushes' },
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
