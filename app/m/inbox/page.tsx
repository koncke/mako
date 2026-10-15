// =============================================================================
// /m/inbox — lo que espera una decisión, y los avisos que ya salieron (v2)
// =============================================================================
// Server component: lee las CINCO bandejas (`leerParaDecidir`, lib/inbox-movil.ts) y
// el feed de avisos del workspace (`listNotificaciones`), y le pasa al cliente lo que
// ya está decidido — quién ve qué lo resolvió la lectura con la regla del Sidebar.
// El título («Inbox») lo pone el shell; esta pantalla no dibuja título ni «Actualizado».
//
// ⚠️ `maxDuration = 420` NO ES DECORATIVO: el techo de la PÁGINA gobierna sus server
// actions, y confirmar una acción de MaKo puede correr IA o analizar una llamada. Sin
// esto la plataforma corta a mitad y la propuesta queda «aplicándose» sin resultado
// (app/mako/pendientes/page.tsx, app/m/inbox/acciones.ts).
//
// ⚠️ `leerParaDecidir` ESCRIBE (vence las pendientes vencidas, como el escritorio):
// va acá, en la página, y nunca en un sondeo. El badge de la barra usa
// `contarParaDecidir`, que no escribe.
//
// ⚠️ QUÉ VA A «PARA DECIDIR» Y QUÉ A LA FILA DE LA COMPUTADORA sale de la MISMA regla del
// badge (`DECIDIBLES_EN_TELEFONO`) más `accionMovil`: el número del segmentado y el de la
// barra no pueden contar cosas distintas por dos reglas distintas.
//
// ⚠️ EL LINK DE UN AVISO ES DE ESCRITORIO: se traduce con `rutaMovil`. Si no hay
// equivalente en el teléfono, el aviso se queda en lectura (no se manda a escritorio
// desde una fila).
//
// `?vista=avisos` y `?abrir=<key>` son de la PANTALLA (qué segmento, qué sheet), nunca
// de los datos: el workspace es el de `requireMovil`/`getWorkspaceActual`.
// =============================================================================

import './inbox.css';
import { requireMovil } from '@/lib/movil-guard';
import { DECIDIBLES_EN_TELEFONO, leerParaDecidir, type ParaDecidir } from '@/lib/inbox-movil';
import { TIPOS_DECISION } from '@/lib/inbox-movil-reglas';
import { listNotificaciones, type Notificacion } from '@/lib/notificaciones';
import { getNotifVistoHasta } from '@/lib/perfil';
import { rutaMovil } from '@/lib/movil-rutas';
import { PantallaM } from '../_ui/PantallaM';
import { InboxM, type AvisoM } from './InboxM';
import { aDecisionM, iconoDeRuta } from './decision-m';
import { claveDeParam, vistaDeParam } from './inbox-ui';

export const dynamic = 'force-dynamic';
// 420 y no 300 (tanda 7 del Web Generator, 15/10/2026; Martín: «Todas las funciones a la API de MaKo»): confirmar
// replicar_landing por chat corre hasta ~275 s (lib/editor-landing/replicar.ts: imágenes hasta los 265 s, más
// guardar el tema y crear) y antes y después van los pasos del modelo y el envío: 300 lo cortaba. Plan Pro con
// fluid compute: tope 800. tests/mako-doer-plazo.test.ts.
export const maxDuration = 420;

const TOPE_AVISOS = 30;
const TOPE_DESCRIPCION = 140;

/** Una línea, sin marcas de WhatsApp: la fila es una frase (~110 caracteres). */
function frase(s: string | null | undefined): string | null {
  const t = (s ?? '').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > TOPE_DESCRIPCION ? `${t.slice(0, TOPE_DESCRIPCION - 1)}…` : t;
}

function aAviso(n: Notificacion, vistoHasta: string | null): AvisoM {
  const r = rutaMovil(n.link);
  // La propia bandeja no se linkea a sí misma.
  const ruta = r && r !== '/m/inbox' ? r : null;
  return {
    id: n.id,
    titulo: n.titulo,
    descripcion: frase(n.descripcion),
    ruta,
    icono: iconoDeRuta(ruta),
    createdAt: n.createdAt,
    urgente: n.severidad === 'urgente',
    nuevo: vistoHasta ? Date.parse(n.createdAt) > Date.parse(vistoHasta) : true,
  };
}

export default async function InboxPagina({ searchParams }: {
  searchParams: Promise<{ vista?: string | string[]; abrir?: string | string[] }>;
}) {
  const ctx = await requireMovil();
  const p = await searchParams;
  const quien = { rol: ctx.rol, capa: ctx.capa };
  // Los avisos hablan del negocio entero: sólo admin (como en escritorio).
  const conAvisos = ctx.ws != null && ctx.rol === 'admin';

  const [decidir, feed] = await Promise.all([
    leerParaDecidir(quien).catch((e): ParaDecidir => {
      console.error('[m/inbox] leerParaDecidir:', e instanceof Error ? e.message : e);
      // No se pudo leer NADA: todas las bandejas cuentan como falla (nunca «Nada para decidir»).
      return { items: [], fallas: [...TIPOS_DECISION], tipos: [...TIPOS_DECISION], recortados: [] };
    }),
    (async () => {
      if (!conAvisos || ctx.ws == null) return { avisos: [] as AvisoM[], falla: false, marcar: null as string | null };
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
  const decisiones = decidir.items.map((i) => aDecisionM(i, DECIDIBLES_EN_TELEFONO.has(i.tipo)));
  // Una bandeja de la computadora que llegó a su tope: «100+ para revisar», no «100».
  const recortadoCompu = decidir.recortados.some((t) => !DECIDIBLES_EN_TELEFONO.has(t));

  return (
    <PantallaM>
      <InboxM
        decisiones={decisiones}
        fallas={fallas}
        recortadoCompu={recortadoCompu}
        avisos={feed.avisos}
        avisosFalla={feed.falla}
        marcarHasta={feed.marcar}
        conAvisos={conAvisos}
        vistaInicial={vistaDeParam(p.vista, conAvisos)}
        abrirInicial={claveDeParam(p.abrir)}
      />
    </PantallaM>
  );
}
