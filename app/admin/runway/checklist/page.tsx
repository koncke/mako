// =============================================================================
// /admin/runway/checklist — lo que se hizo el 15 y 16/10/2026 y lo que queda, con casillas
// =============================================================================
// Pedido de Martín (16/10/2026): «Preparamelo tipo checklist en "runway" con todo lo que se hizo y lo que aún queda
// pendiente». /admin/runway sigue llevando a la Ticketera (tests/runway-decisiones.test.ts); esta es una sub-ruta.
// Lo marcado se guarda en app_settings del workspace de quien mira (acciones.ts).
//
// ⚠️ EL GUARD ES EL ROL DE AGENCIA (getSesionAdmin), y el proxy ya cierra /admin/* (SOLO_ADMIN).

import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { getSetting } from '@/lib/settings';
import { Pagina } from '@/app/_ui';
import { CLAVE_CHECKLIST, HECHO, PENDIENTE } from './datos';
import Checklist from './Checklist';

export const dynamic = 'force-dynamic';

export default async function ChecklistRunwayPage() {
  if (!(await getSesionAdmin())) redirect('/inicio');
  let iniciales: string[] = [];
  try {
    const crudo = await getSetting(CLAVE_CHECKLIST);
    const lista: unknown = crudo ? JSON.parse(crudo) : [];
    if (Array.isArray(lista)) iniciales = lista.filter((x): x is string => typeof x === 'string');
  } catch { iniciales = []; }
  return (
    <Pagina>
      <h1 style={{ fontSize: 'var(--fs-page)', margin: '0 0 4px' }}>Checklist del 15 y 16/10</h1>
      <p style={{ color: 'var(--dim)', margin: '0 0 16px' }}>Marca lo que ya revisaste. Se guarda en tu cuenta.</p>
      <Checklist hecho={HECHO} pendiente={PENDIENTE} iniciales={iniciales} />
    </Pagina>
  );
}
