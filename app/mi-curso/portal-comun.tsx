import 'server-only';

// =============================================================================
// portal-comun — lo que comparten las DOS puertas al portal del alumno
// =============================================================================
// El curso de un cliente se abre por dos lados y tiene que verse y contarse IGUAL:
//   · /compartido/curso/<token>  — el link firmado (WhatsApp, o copiado de la ficha);
//   · /mi-curso                  — la cookie del alumno (el link del mail, o Google).
// Las dos terminan en un token `c1.` y dibujan el mismo PortalAlumno con ese token, así que las
// rutas de progreso/tarea/video sirven para las dos sin tocarlas.
//
// ⚠️ CON DOS COPIAS, LA SEGUNDA SE QUEDA VIEJA (AGENTS.md, «Una cosa, un lugar»): la regla de qué
// cuenta como un ingreso costó una corrección (ver abajo) y vive acá UNA vez. Hoy la usa /mi-curso;
// app/compartido/curso/[token]/page.tsx tiene todavía su copia — mudarla a esto es una línea por
// pieza y quedó anotado para el dueño de ese archivo.
//
// ⚠️ EL WORKSPACE SALE DE LA FIRMA (`leerAccesoCurso(token).ws`) y todo corre adentro de
// `runWithWorkspace`: sin sesión, `getTenantDb` caería al workspace por defecto. Lo primero adentro
// es `resolverAcceso` (versión vigente, no revocado, lead ganado).

import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { headers } from 'next/headers';
import { runWithWorkspace } from '@/lib/workspace';
import { leerAccesoCurso } from '@/lib/curso-acceso';
import { resolverAcceso, contarIngreso } from '@/lib/curso-datos';
import { armarVistaAlumno, type VistaAlumno } from '@/lib/curso-portal';
import { Pagina } from '@/app/_ui/Pagina';

/**
 * La tarjeta que arma WhatsApp al pegar el link, y el título de la pestaña. ⚠️ Pisa la de MaKo del
 * layout (el `openGraph` de una página reemplaza ENTERO el del layout): lo ve el cliente del
 * negocio antes de abrirlo. Genérica a propósito —el scraper la arma sin que nadie haga clic— y
 * sin indexar: es la puerta de una persona.
 */
export const METADATA_PORTAL: Metadata = {
  title: 'Tu programa',
  description: 'Tus clases y tareas.',
  robots: { index: false, follow: false },
  openGraph: { type: 'website', title: 'Tu programa', description: 'Tus clases y tareas.' },
  twitter: { card: 'summary', title: 'Tu programa', description: 'Tus clases y tareas.' },
  appleWebApp: { capable: true, title: 'Tu programa' },
};

export type CargaPortal = { vista: VistaAlumno } | 'inactivo' | 'fallo';

/**
 * Resuelve el token y arma la vista del alumno. `'inactivo'` = el link/la cookie ya no abre (firma
 * mala, revocado, versión vieja, ya no es cliente) — UNA sola respuesta, sin el porqué: distinguir
 * los casos ayudaría a enumerar tokens. `'fallo'` = no se pudo armar la vista.
 *
 * ⚠️ Un error de base en `resolverAcceso` TIRA (no es «ya no está activo»): la página muestra su
 * error, igual que antes.
 */
export async function cargarPortal(token: string): Promise<CargaPortal> {
  const firma = leerAccesoCurso(token);
  if (!firma) return 'inactivo';
  return runWithWorkspace(firma.ws, async (): Promise<CargaPortal> => {
    const acceso = await resolverAcceso(token);
    if (!acceso) return 'inactivo';
    // El ingreso se cuenta ANTES de cualquier otra salida: si armar la vista falla, la persona
    // igual entró. Corre en paralelo y no tira (lib/curso-datos.ts).
    //
    // ⚠️ SÓLO UNA NAVEGACIÓN DE VERDAD ES UN INGRESO. Este server component corre también con el
    // `router.refresh()` que sigue a un paso de etapa (llega con dest 'empty' y el header `rsc`) y
    // cuando WhatsApp arma la vista previa del link — al mandarlo y al pegarlo a mano —, que no
    // manda Sec-Fetch-*. Contados, «Entró N veces» de la ficha medía mensajes, no visitas.
    const h = await headers();
    const dest = h.get('sec-fetch-dest');
    const esVistaPrevia = /whatsapp|facebookexternalhit|bot|crawler|preview/i.test(h.get('user-agent') ?? '');
    const navega = dest ? dest === 'document' : (!h.get('rsc') && !esVistaPrevia);
    const conteo = navega ? contarIngreso(acceso.leadId) : Promise.resolve();
    try {
      return { vista: await armarVistaAlumno(acceso.leadId, { alcance: acceso.alcance }) };
    } catch (e) {
      console.error('[curso-portal] no pude armar la vista del alumno:', e instanceof Error ? e.message : e);
      return 'fallo';
    } finally {
      await conteo;
    }
  });
}

/** La pantalla de un acceso que no abre (o de una lectura caída): una frase, sin el porqué. */
export function AvisoPortal({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <Pagina style={caja}>
      <div style={tarjeta}>
        <p style={tit}>{titulo}</p>
        {detalle && <p style={sub}>{detalle}</p>}
      </div>
    </Pagina>
  );
}

const caja = {
  minHeight: '100vh', display: 'grid', placeItems: 'center',
  padding: '24px 16px', background: 'var(--bg)', color: 'var(--ink)',
} satisfies CSSProperties;
const tarjeta: CSSProperties = {
  maxWidth: 420, width: '100%', textAlign: 'center', padding: '32px 24px',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
};
const tit: CSSProperties = { margin: 0, fontSize: 'var(--fs-sect)', fontWeight: 600, lineHeight: 1.3 };
const sub: CSSProperties = { margin: '8px 0 0', fontSize: 'var(--fs-md)', color: 'var(--dim)' };
