import type { ReactNode } from 'react';
// Las cuentas y sus dispositivos del Uso (CuentasYDispositivos.tsx): el mismo dibujo que «Tus cuentas de IA».
import '@/app/integraciones/tus-cuentas-ia.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { getWorkspaceActual, rutaConWs, wsSuperAdmin } from '@/lib/workspace';
import { RUTA_OPS_CENTER_NEGOCIO } from '@/lib/ops-center-ruta';
import { Pagina, PermissionState } from '@/app/_ui';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { esAdminDeTab } from '@/lib/puerta-admin-tab';
import { datosDelCentroSiOpera } from './datos';
import { PantallaSecondBrain, mapaDelSecondBrain, pideElMapa, type QuerySecondBrain } from '@/app/second-brain/pagina';

// =============================================================================
// /admin/operaciones — «Ops Center», la MISMA pantalla que /second-brain para el super admin (17/10/2026)
// =============================================================================
// Martín, mirando producción: «El Second Brain y el Centro deberían ser exactamente lo mismo en SuperAdmin» y «Me
// gustaría que quede el nombre de "Ops Center"». Esta página es una PUERTA: su guarda y, después, lo que arma
// app/second-brain/pagina.tsx (la pantalla es app/second-brain/ChatSecondBrain.tsx). Abre en el Cerebro; un `?chat=` con
// la clave de un chat (los links de siempre) abre ése, y `?ticketera=` la Ticketera entera. CentroApp.tsx se borró.
//
// ⚠️ La guarda va antes de leer nada (tests/operaciones.test.ts): `puedeOperar` acá, y otra vez adentro de
//    `datosDelCentroSiOpera`, que es la que lee la cola, los Runners, la Ticketera y los muñecos.
// ⚠️ NO SE ESPERA A VERCEL: su API tarda hasta 8 s («tarda mucho en aparecer», Martín, 15/10). Los pushes los pide la
//    pantalla después de dibujarse (useCentro.ts).

export const dynamic = 'force-dynamic';

export default async function OperacionesPage({ searchParams }: { searchParams: Promise<QuerySecondBrain> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');
  if (!puedeOperar(admin, await wsSuperAdmin())) {
    return <Pagina><PermissionState motivo="rol" que="Ops Center" /></Pagina>;
  }
  // Mirando a un CLIENTE (la pestaña con el ?ws= de otro negocio), el Ops Center de la plataforma no se dibuja: su «Tus cuentas
  // de IA» lee el negocio de la pestaña, y salían las computadoras de ese cliente debajo de las cuentas de Martín (23/10/2026,
  // «estas cruzando workspace»). Va al Ops Center de ese cliente, el mismo criterio que `quienOpera`. Con el ?ws= de la
  // plataforma (el teléfono lo lleva siempre) no es mirar a otro, y se queda.
  const ws = await getWorkspaceActual();
  const q = await searchParams;
  // `?grupo=` viaja: es lo que abre el grupo de ese cliente (app/second-brain/ChatSecondBrain.tsx).
  if (ws != null && ws !== (await wsSuperAdmin()) && q.grupo && /^\d{1,15}$/.test(q.grupo)) redirect(await rutaConWs(`${RUTA_OPS_CENTER_NEGOCIO}?grupo=${q.grupo}`));
  if (ws != null && ws !== (await wsSuperAdmin())) redirect(await rutaConWs(RUTA_OPS_CENTER_NEGOCIO));
  const [centro, veMapa] = await Promise.all([datosDelCentroSiOpera(), esAdminDeTab('second-brain')]);

  let mapa: ReactNode = null;
  if (veMapa && pideElMapa(q)) {
    mapa = await mapaDelSecondBrain();
  }

  return <PantallaSecondBrain veMapa={veMapa} mapa={mapa} centro={centro} q={q} inicio="centro" />;
}
