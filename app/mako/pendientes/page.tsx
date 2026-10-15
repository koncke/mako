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
import { aFila } from '@/lib/bandeja-filas';
import { PANTALLA_DE_PROPUESTA } from '@/lib/propuestas-tipos';
import { BandejaPendientes } from './BandejaPendientes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// El techo de la PÁGINA gobierna sus server actions (docs/hallazgos-infra.md). Acá
// se confirman acciones que corren IA o analizan llamadas: sin
// esto la plataforma corta a mitad de camino y la propuesta queda «aplicándose»
// sin resultado, con la escritura hecha a medias.
// 420 y no 300 (tanda 7 del Web Generator, 15/10/2026; Martín: «Todas las funciones a la API de MaKo»): confirmar
// replicar_landing por chat corre hasta ~275 s (lib/editor-landing/replicar.ts: imágenes hasta los 265 s, más
// guardar el tema y crear) y antes y después van los pasos del modelo y el envío: 300 lo cortaba. Plan Pro con
// fluid compute: tope 800. tests/mako-doer-plazo.test.ts.
export const maxDuration = 420;

// La fila (aFila, con su hora local y su «vence en…») vive en lib/bandeja-filas.ts: la
// comparte el Inbox del teléfono, que muestra las mismas pendientes.

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
