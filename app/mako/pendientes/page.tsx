// =============================================================================
// /mako/pendientes — la bandeja de las acciones que esperan un «sí»
// =============================================================================
// Una acción `chat` (lib/api-mako) queda PENDIENTE dos horas hasta que una
// persona la confirma: con un «sí» aparte en WhatsApp, o acá. Esta bandeja ve
// TODO el workspace, venga la pendiente del grupo de WhatsApp, del chat de la
// app o de la API — es la red para el «sí» que no se mandó, no llegó o se
// olvidó. Un aviso es un evento; una bandeja es un estado.
//
// Solo el admin del workspace: lo que se confirma acá se ejecuta de verdad.
// El registro (porId) se lee SOLO en este server component; el cliente recibe
// datos planos. tests/api-mako-registro.test.ts lo prohíbe en un 'use client'.
// =============================================================================

import Link from '@/app/_ui/Link';
import { Pagina, PageHeader } from '@/app/_ui';
import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { pendientesDelWorkspace, type Pendiente } from '@/lib/mako-pendientes';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { etiquetaDeCanal } from '@/lib/api-mako/canal';
import { porId } from '@/lib/api-mako/registro';
import { esAccion } from '@/lib/api-mako/tipos';
import { PANTALLA_DE_PROPUESTA } from '@/lib/propuestas-tipos';
import { BandejaPendientes, type FilaPendiente } from './BandejaPendientes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// El techo de la PÁGINA gobierna sus server actions (docs/hallazgos-infra.md). Acá
// se confirman acciones que corren IA, sincronizan Whop o analizan llamadas: sin
// esto la plataforma corta a mitad de camino y la propuesta queda «aplicándose»
// sin resultado, con la escritura hecha a medias.
export const maxDuration = 300;

/** Hora local del workspace, corta. La ISO cruda no le dice a nadie «vence en 40 min». */
function fmtHora(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz });
  } catch {
    return iso;
  }
}

function enCuanto(iso: string): string {
  const min = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (!Number.isFinite(min) || min <= 0) return 'vence ahora';
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `en ${h} h ${resto} min` : `en ${h} h`;
}

function aFila(p: Pendiente, tz: string): FilaPendiente {
  const def = porId(p.tipo);
  const accion = def && esAccion(def) ? def : null;
  return {
    id: p.id,
    resumen: p.resumen,
    origen: etiquetaDeCanal(p.grupoJid),
    operacion: def?.titulo ?? p.tipo,
    escribe: accion?.escribe ?? null,
    reversible: accion ? accion.reversible : null,
    vence: `${fmtHora(p.venceAt, tz)} (${enCuanto(p.venceAt)})`,
    creada: fmtHora(p.createdAt, tz),
    payload: p.payload,
  };
}

export default async function PendientesPage() {
  await requireRolWs([], { nav: 'mako' });
  const ws = await getWorkspaceActual();

  // Degrada a lista vacía en vez de romper: una bandeja caída no puede tumbar
  // la navegación. Lo que se pierde es la lista, no el acceso.
  let pendientes: Pendiente[] = [];
  let tz = TZ_DEFAULT;
  if (ws != null) {
    [pendientes, tz] = await Promise.all([
      pendientesDelWorkspace(ws).catch(() => [] as Pendiente[]),
      tzDeWorkspace(ws).catch(() => TZ_DEFAULT),
    ]);
  }
  const filas = pendientes.map((p) => aFila(p, tz));

  return (
    <Pagina>
      <PageHeader
        titulo="Acciones pendientes"
        proposito="Lo que MaKo propuso por WhatsApp, por el chat o por la API y todavía espera tu confirmación. Nada se ejecuta hasta que lo confirmes; lo que no confirmes vence solo a las dos horas."
        estado={filas.length ? <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>{filas.length} esperando</span> : null}
      />

      <BandejaPendientes filas={filas} />

      <p style={{ marginTop: 'var(--sect-gap)', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6 }}>
        Las propuestas con formulario se revisan en{' '}
        <Link href={PANTALLA_DE_PROPUESTA.accion.bandeja} style={{ color: 'var(--primary)', fontWeight: 600 }}>{PANTALLA_DE_PROPUESTA.accion.nombre}</Link>
        {' · '}
        <Link href={PANTALLA_DE_PROPUESTA.lead.bandeja} style={{ color: 'var(--primary)', fontWeight: 600 }}>{PANTALLA_DE_PROPUESTA.lead.nombre}</Link>
        {' · '}
        <Link href="/plan" style={{ color: 'var(--primary)', fontWeight: 600 }}>Borradores de tareas</Link>
      </p>
    </Pagina>
  );
}
