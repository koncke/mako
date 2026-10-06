// =============================================================================
// /mi-curso — el curso del cliente, para quien entró con su cookie de alumno
// =============================================================================
// «Al igual que en la vista de Agencia, se debería poder INVITAR al cliente a MaKo para que tenga
// acceso al curso» (Martín, 06/10/2026).
//
// ⚠️ NO ES UNA PANTALLA DE MaKo: el alumno no tiene `mako_session` (el porqué, medido, en
// lib/alumno-sesion.ts). El proxy deja pasar esta ruta EXACTA sin sesión (`decidirRutaAlumno`,
// lib/rutas-publicas.ts) y la página se autentica sola con `mako_alumno`. Va sin el chrome de la
// app (PublicRouteGate): sin sidebar y sin los pollers, que sin sesión darían 401 en bucle.
//
// Dibuja EXACTAMENTE lo mismo que /compartido/curso/<token>: la cookie se traduce al token `c1.`
// de esa misma (ws, lead, versión) y se le pasa a PortalAlumno, así que el progreso, las tareas y
// los videos van por las rutas del portal sin tocarlas. Y la cookie NO se cree: `cargarPortal` la
// revalida contra la base en cada pedido (versión vigente, no revocado, lead ganado), así que
// revocar el acceso la corta en el pedido siguiente.
//
// Se llega por el link del mail (/api/compartido/curso/entrar) o entrando con Google con el email
// al que se lo invitó (el callback). Sin cookie válida → /login.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { firmarAccesoCurso } from '@/lib/curso-acceso';
import { firmaDeLaCookie } from '@/lib/alumno-acceso';
import PortalAlumno from '@/app/compartido/curso/[token]/PortalAlumno';
import { METADATA_PORTAL, cargarPortal, AvisoPortal } from './portal-comun';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = METADATA_PORTAL;

export default async function MiCursoPage() {
  const firma = await firmaDeLaCookie();
  // ⚠️ /login sin `?ws=` es la excepción escrita de AGENTS.md: sin sesión no hay pestaña que
  // preservar. Y sin `?next=`: el alumno vuelve acá solo, por el callback.
  if (!firma) redirect('/login');
  const token = firmarAccesoCurso(firma);
  if (!token) redirect('/login');

  const r = await cargarPortal(token);
  if (r === 'inactivo') return <AvisoPortal titulo="Tu acceso ya no está activo." />;
  if (r === 'fallo') return <AvisoPortal titulo="No pudimos cargar tus clases." detalle="Intenta de nuevo en un rato." />;
  return <PortalAlumno token={token} vista={r.vista} />;
}
