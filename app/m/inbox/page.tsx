// =============================================================================
// /m/inbox — lo que espera una decisión, y los avisos que ya salieron
// =============================================================================
// Server component: lee las CINCO bandejas (`leerParaDecidir`, lib/inbox-movil.ts) y
// el feed de avisos del workspace (`listNotificaciones`), y le pasa al cliente lo que
// ya está decidido — quién ve qué lo resolvió la lectura con la regla del Sidebar.
//
// ⚠️ `maxDuration = 300` NO ES DECORATIVO: el techo de la PÁGINA gobierna sus server
// actions, y confirmar una acción de MaKo puede correr IA o analizar una llamada. Sin
// esto la plataforma corta a mitad y la propuesta queda «aplicándose» sin resultado
// (app/mako/pendientes/page.tsx, app/m/inbox/acciones.ts).
//
// ⚠️ `leerParaDecidir` ESCRIBE (vence las pendientes vencidas, como el escritorio):
// va acá, en la página, y nunca en un sondeo. El badge de la barra usa
// `contarParaDecidir`, que no escribe.
//
// ⚠️ EL LINK DE UN AVISO ES DE ESCRITORIO: se traduce con `rutaMovil`. Si no hay
// equivalente en el teléfono, el aviso se queda en lectura (no se manda a escritorio
// desde una fila: eso es «Abrir en la computadora», y sólo en una decisión).
// =============================================================================

import './inbox.css';
import { requireMovil } from '@/lib/movil-guard';
import { leerParaDecidir, type ParaDecidir } from '@/lib/inbox-movil';
import { TIPOS_DECISION, type ItemDecision } from '@/lib/inbox-movil-reglas';
import { listNotificaciones, type Notificacion } from '@/lib/notificaciones';
import { getNotifVistoHasta } from '@/lib/perfil';
import { rutaMovil } from '@/lib/movil-rutas';
import { PantallaM } from '../_ui/PantallaM';
import { InboxM, type AvisoM } from './InboxM';
import { fraseHeroe } from './inbox-ui';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TOPE_AVISOS = 30;
const TOPE_DESCRIPCION = 140;

/** Una línea, sin marcas de WhatsApp: la fila es una frase (~110 caracteres). */
function frase(s: string | null | undefined): string | null {
  const t = (s ?? '').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > TOPE_DESCRIPCION ? `${t.slice(0, TOPE_DESCRIPCION - 1)}…` : t;
}

function aAviso(n: Notificacion, vistoHasta: string | null): AvisoM {
  const ruta = rutaMovil(n.link);
  return {
    id: n.id,
    titulo: n.titulo,
    descripcion: frase(n.descripcion),
    // La propia bandeja no se linkea a sí misma.
    ruta: ruta && ruta !== '/m/inbox' ? ruta : null,
    createdAt: n.createdAt,
    urgente: n.severidad === 'urgente',
    nuevo: vistoHasta ? Date.parse(n.createdAt) > Date.parse(vistoHasta) : true,
  };
}

/** Los ítems viajan al navegador: el `escribe` técnico (tablas, endpoints) no hace falta allá. */
function paraCliente(i: ItemDecision): ItemDecision {
  return { ...i, escribe: null };
}

export default async function InboxPagina() {
  const ctx = await requireMovil();
  const quien = { rol: ctx.rol, capa: ctx.capa };

  const [decidir, feed] = await Promise.all([
    leerParaDecidir(quien).catch((e): ParaDecidir => {
      console.error('[m/inbox] leerParaDecidir:', e instanceof Error ? e.message : e);
      // No se pudo leer NADA: todas las bandejas cuentan como falla (nunca «Nada para decidir»).
      return { items: [], fallas: [...TIPOS_DECISION], tipos: [...TIPOS_DECISION], recortados: [] };
    }),
    (async () => {
      // Los avisos hablan del negocio entero: sólo admin (como en escritorio).
      if (ctx.ws == null || ctx.rol !== 'admin') return { avisos: [] as AvisoM[], falla: false, marcar: null as string | null };
      try {
        const [lista, visto] = await Promise.all([
          listNotificaciones(ctx.ws, { limite: TOPE_AVISOS }),
          getNotifVistoHasta(ctx.ws).catch(() => null),
        ]);
        const avisos = lista.map((n) => aAviso(n, visto));
        const masNuevo = lista[0]?.createdAt ?? null;
        const marcar = masNuevo && (!visto || Date.parse(masNuevo) > Date.parse(visto)) ? masNuevo : null;
        return { avisos, falla: false, marcar };
      } catch (e) {
        console.error('[m/inbox] avisos:', e instanceof Error ? e.message : e);
        return { avisos: [] as AvisoM[], falla: true, marcar: null };
      }
    })(),
  ]);

  // Sólo las fallas de bandejas que este rol VE (un closer no tiene «acciones de MaKo»).
  const fallas = decidir.fallas.filter((t) => decidir.tipos.includes(t));

  return (
    <PantallaM
      titulo={fraseHeroe(decidir.items.length, fallas.length > 0) ?? undefined}
      actualizado={new Date()}
      refrescable
    >
      <InboxM
        items={decidir.items.map(paraCliente)}
        fallas={fallas}
        avisos={feed.avisos}
        avisosFalla={feed.falla}
        marcarHasta={feed.marcar}
        conAvisos={ctx.rol === 'admin'}
      />
    </PantallaM>
  );
}
