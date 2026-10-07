// =============================================================================
// /compartido/curso/[token] — el portal del curso que ve el cliente con su link personal
// =============================================================================
// «Quiero que los clientes de Mauricio puedan ingresar a MaKo con un nivel de acceso especial
// que solo ellos tienen, donde solo ven las clases de Mauricio y las tareas» (Martín, 06/10/2026).
//
// ES UN LINK FIRMADO, NO UNA CUENTA (el porqué, en lib/curso-acceso.ts): sin sesión, público por
// el prefijo `/compartido` (lib/rutas-publicas.ts) y sin el chrome de la app (PublicRouteGate).
// Sólo muestra las clases y tareas de los productos de ESE cliente.
//
// ⚠️ EL WORKSPACE SALE DE LA FIRMA (`leerAccesoCurso(token).ws`) y todo corre adentro de
// `runWithWorkspace`: sin sesión, `getTenantDb` caería al workspace por defecto. Y lo primero
// adentro es `resolverAcceso`, que mira en la base que la versión siga vigente, que no esté
// revocado y que el lead siga siendo un cliente ganado.
//
// Un link que no abre (firma mala, revocado, versión vieja, ya no es cliente) ve UNA sola
// pantalla, sin decir por qué: distinguir los casos ayudaría a enumerar tokens.
//
// ⚠️ EL LINK PUEDE SER EL DEL LÍDER DE UN ÁREA (#665, `c2.`). `resolverAccesoPortal` lo resuelve y el
// área SALE DE SU FILA en la base; con ella, `armarVistaAlumno` arma SÓLO las clases por área de esa
// área y sin el nombre del cliente. El ingreso se le cuenta a SU acceso.

import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { runWithWorkspace } from '@/lib/workspace';
import { leerTokenPortal } from '@/lib/curso-acceso';
import { headers } from 'next/headers';
import { resolverAccesoPortal, contarIngreso } from '@/lib/curso-datos';
import { armarVistaAlumno, type VistaAlumno } from '@/lib/curso-portal';
import { Pagina } from '@/app/_ui/Pagina';
import PortalAlumno from './PortalAlumno';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * La tarjeta que arma WhatsApp al pegar el link. ⚠️ SE PISA LA DE MaKo del layout (el
 * `openGraph` de una página reemplaza ENTERO el del layout): el link lo recibe el cliente de
 * Mauricio, y lo que ve antes de abrirlo no es la marca de la herramienta. Genérica a propósito:
 * el scraper la arma sin que nadie haga clic, así que acá no va ni el nombre del cliente.
 */
export const metadata: Metadata = {
  title: 'Tu programa',
  description: 'Tus clases y tareas.',
  robots: { index: false, follow: false },
  openGraph: { type: 'website', title: 'Tu programa', description: 'Tus clases y tareas.' },
  twitter: { card: 'summary', title: 'Tu programa', description: 'Tus clases y tareas.' },
  appleWebApp: { capable: true, title: 'Tu programa' },
};

export default async function PortalCursoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const firma = leerTokenPortal(token);
  if (!firma) return <Aviso titulo="Este link ya no está activo." />;

  const r = await runWithWorkspace(firma.ws, async (): Promise<{ vista: VistaAlumno } | 'inactivo' | 'fallo'> => {
    const acceso = await resolverAccesoPortal(token);
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
    const conteo = navega ? contarIngreso(acceso.leadId, acceso.area) : Promise.resolve();
    try {
      return { vista: await armarVistaAlumno(acceso.leadId, { lider: acceso.area }) };
    } catch (e) {
      console.error('[curso-portal] no pude armar la vista del alumno:', e instanceof Error ? e.message : e);
      return 'fallo';
    } finally {
      await conteo;
    }
  });

  if (r === 'inactivo') return <Aviso titulo="Este link ya no está activo." />;
  if (r === 'fallo') return <Aviso titulo="No pudimos cargar tus clases." detalle="Intenta de nuevo en un rato." />;
  return <PortalAlumno token={token} vista={r.vista} />;
}

/** La pantalla de un link que no abre (o de una lectura caída): una frase, sin el porqué. */
function Aviso({ titulo, detalle }: { titulo: string; detalle?: string }) {
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
