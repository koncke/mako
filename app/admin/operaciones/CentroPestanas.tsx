'use client';

// =============================================================================
// El Centro de Operaciones en pestañas: Chats · Avance · Pushes · Áreas (15/10/2026)
// =============================================================================
// Las vistas de GitHub Projects son pestañas arriba de la tabla; acá también. La pestaña viaja en
// `?tab=` (leída en el server, escrita con el router de la casa, que conserva el `?ws=`). «Pedidos» es
// la de entrada: «Lo que quiero ver allí es lo que te pedí, los pushes de lo terminado, los pendientes que
// estamos trabajando ahora mismo, las cosas que ya están terminadas, empezadas, etc...» (Martín, 15/10).

// ⚠️ «Trabajos» NO es una pestaña (Martín, 15/10: «No entiendo para nada la tab de "trabajos", eliminala»):
// mandar un trabajo firmado, los carteros y la clave viven en «Cartero y trabajos», un modal del encabezado,
// hasta que el envío pase adentro de cada chat.

import { useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button, ErrorState, Modal, PageHeader, Tabs } from '@/app/_ui';
import type { EstadoCarteros, Pedido } from '@/lib/operaciones';
import type { ChatCentro, TrabajoP } from '@/lib/centro-chats';
import { PESTANAS_CENTRO, type Frente, type NovedadP, type PedidoP, type PestanaCentro } from '@/lib/progreso-reglas';
import type { LecturaPushes } from '@/lib/progreso';
import CentroOperaciones from './CentroOperaciones';
import { ChatsCentro } from './ChatsCentro';
import { Progreso } from './Progreso';

export function CentroPestanas({ inicial, frentes, pedidos, pushes, novedades, todos, hayCartero, ahora, sub, cola, carteros, chats, cuentas }: {
  inicial: PestanaCentro;
  frentes: Frente[];
  pedidos: PedidoP[];
  pushes: LecturaPushes;
  novedades: NovedadP[];
  todos: boolean;
  hayCartero: boolean;
  ahora: number;
  sub: string;
  /** La cola de trabajos y los carteros; null si no se pudieron leer (lo demás se ve igual). */
  cola: Pedido[] | null;
  carteros: EstadoCarteros | null;
  chats: ChatCentro[];
  cuentas: string[];
}) {
  const [tab, setTab] = useState<PestanaCentro>(inicial);
  const [cartero, setCartero] = useState(false);
  const router = useRouter();
  const cambiar = (id: string) => {
    const t = (PESTANAS_CENTRO as readonly string[]).includes(id) ? (id as PestanaCentro) : PESTANAS_CENTRO[0];
    setTab(t);
    router.replace(t === PESTANAS_CENTRO[0] ? '/admin/operaciones' : `/admin/operaciones?tab=${t}`, { scroll: false });
  };
  // El número de Avance: lo que todavía no está terminado (sin empezar y empezado).
  const abiertos = pedidos.filter((p) => p.estado !== 'hecho').length;
  const trabajando = chats.filter((c) => c.estado === 'trabajando' && !c.viejo).length;
  // «Sigo sin ver los pendientes y poder refrescar en el centro» (Martín, 15/10): en el teléfono se tira
  // hacia abajo; acá, el botón. Vuelve a leer bitácoras, Vercel y la cola sin perder la pestaña.
  const [actualizando, empezar] = useTransition();
  const hora = new Date(ahora).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const trabajos: TrabajoP[] = (cola ?? []).map((p) => ({ id: p.id, destino: p.destino, destino_titulo: p.destino_titulo, destino_cuenta: p.destino_cuenta, created_at: p.created_at }));

  return (
    <>
      <PageHeader
        titulo="Centro de Operaciones"
        proposito="Tus chats, en qué anda cada uno, y el avance de lo que pediste."
        acciones={<Button variant="tertiary" size="sm" onClick={() => setCartero(true)}>Cartero y trabajos</Button>}
        accion={(
          <div className="prog-actualizar">
            <span className="prog-meta">{`Al día a las ${hora}`}</span>
            <Button variant="secondary" size="sm" loading={actualizando} onClick={() => empezar(() => router.refresh())}>Actualizar</Button>
          </div>
        )}
      />
      <Tabs
        tabs={[
          { id: 'chats', label: 'Chats', badge: trabajando || undefined },
          { id: 'pedidos', label: 'Avance', badge: abiertos || undefined },
          { id: 'pushes', label: 'Pushes' },
          { id: 'areas', label: 'Áreas' },
        ]}
        activa={tab}
        onCambio={cambiar}
      />
      {tab === 'chats'
        ? <ChatsCentro chats={chats} cuentas={cuentas} pedidos={pedidos} trabajos={trabajos} pushes={pushes.ok ? pushes.pushes : []} ahora={ahora} />
        : <Progreso vista={tab} frentes={frentes} pedidos={pedidos} pushes={pushes} novedades={novedades} todos={todos} hayCartero={hayCartero} ahora={ahora} />}
      {cartero && (
        <Modal titulo="Cartero y trabajos" onCerrar={() => setCartero(false)} ancho={980}>
          {cola && carteros
            ? <CentroOperaciones embebido sub={sub} pedidosIniciales={cola} carterosIniciales={carteros} />
            : <ErrorState titulo="No pude leer la cola de trabajos" />}
        </Modal>
      )}
    </>
  );
}
