// =============================================================================
// /m/inbox — lo que el SERVER le agrega a cada decisión y a cada aviso antes de bajarlos
// =============================================================================
// Puro (sin server-only ni 'use client'), pero lo llama SÓLO page.tsx: el cliente
// importa nada más que los TIPOS. Así la pantalla no se trae al navegador el registro de
// orígenes ni el mapa de rutas.
//
// ⚠️ LA ESTRELLA DORADA ES «LO PROPUSO MaKo», NO «ES UNA ACCIÓN DE MaKo». Todas las
// pendientes y propuestas pasan por la API de MaKo, pero las que llegan por la API
// (un agente de afuera con un token), por Claude Code, por la landing o por un paso
// «⚡ Acción» de una automatización las propuso OTRO. La estrella va sólo en:
//   · un cambio del CRM automático (lo aplicó MaKo y espera el visto bueno);
//   · una pendiente o propuesta que vino de MaKo por WhatsApp, del chat de la app o de MaKo.
// Los borradores del plan y los contactos van con su ícono gris (como el prototipo):
// se revisan en la computadora y la estrella ahí sería ruido.
//
// El origen se compara contra las MISMAS funciones que lo escriben
// (`etiquetaDeOrigen`, `etiquetaDeCanal`): si cambia una etiqueta, esto la sigue.
// =============================================================================

import { etiquetaDeOrigen, type ItemDecision } from '@/lib/inbox-movil-reglas';
import { etiquetaDeCanal, PREFIJO_APP } from '@/lib/api-mako/canal';
import { DESTINOS_MOVIL, SECCIONES_MAS, rutaMovil } from '@/lib/movil-rutas';

/** La decisión como la recibe la pantalla. */
export type DecisionM = ItemDecision & {
  /** La estrella dorada: la propuso MaKo (ver arriba). */
  deMako: boolean;
  /** El ícono gris de la fila cuando NO es de MaKo (`app/_components/icons.tsx`). */
  icono: string;
  /** La ficha del lead en el teléfono (`/m/crm/<id>`), si la decisión es sobre uno. */
  ficha: string | null;
  /** Se decide en el teléfono. false = va plegada en la fila «… · En la computadora». */
  enTelefono: boolean;
};

const ORIGENES_DE_MAKO: ReadonlySet<string> = new Set([
  etiquetaDeOrigen('whatsapp'),
  etiquetaDeOrigen('app'),
  etiquetaDeOrigen('mako'),
  etiquetaDeCanal('0@g.us'),
  etiquetaDeCanal(`${PREFIJO_APP}0`),
]);

const ICONO_POR_ORIGEN: Readonly<Record<string, string>> = {
  [etiquetaDeOrigen('api')]: 'api',
  [etiquetaDeOrigen('claude-code')]: 'api',
  [etiquetaDeOrigen('flujo:x')]: 'chatbot',
  [etiquetaDeOrigen('landing')]: 'web',
};

export function propusoMako(i: Pick<ItemDecision, 'tipo' | 'origen'>): boolean {
  if (i.tipo === 'confirmacion') return true;
  if (i.tipo === 'pendiente' || i.tipo === 'accion') return ORIGENES_DE_MAKO.has(i.origen);
  return false;
}

export function iconoDeDecision(i: Pick<ItemDecision, 'tipo' | 'origen'>): string {
  if (i.tipo === 'borrador') return 'todo';
  if (i.tipo === 'lead' || i.tipo === 'confirmacion') return 'crm';
  return ICONO_POR_ORIGEN[i.origen] ?? 'rayo';
}

/**
 * `enTelefono` lo decide quien llama con la MISMA regla del badge
 * (`DECIDIBLES_EN_TELEFONO`, lib/inbox-movil.ts, que es server-only) más `accionMovil`.
 * El `escribe` técnico (tablas, endpoints) no viaja al navegador.
 */
export function aDecisionM(i: ItemDecision, enTelefono: boolean): DecisionM {
  const ruta = i.tipo === 'confirmacion' ? rutaMovil(i.linkEscritorio) : null;
  return {
    ...i,
    escribe: null,
    deMako: propusoMako(i),
    icono: iconoDeDecision(i),
    ficha: ruta && /^\/m\/crm\/\d+$/.test(ruta) ? ruta : null,
    enTelefono: enTelefono && i.accionMovil !== 'computadora',
  };
}

/**
 * El ícono de un aviso: el de la sección del teléfono a la que lleva su link (la misma
 * tabla que la barra y More, lib/movil-rutas.ts). Sin link, o a MaKo (su ícono de línea
 * se lee como una cruz), la campana.
 */
export function iconoDeRuta(ruta: string | null): string {
  if (!ruta) return 'bell';
  const p = ruta.split(/[?#]/)[0];
  const s = [...DESTINOS_MOVIL, ...SECCIONES_MAS]
    .filter((d) => p === d.href || p.startsWith(`${d.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return !s || s.icon === 'mako' ? 'bell' : s.icon;
}
