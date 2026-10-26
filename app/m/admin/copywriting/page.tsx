// =============================================================================
// /m/admin/copywriting — «Copy Method» (Copywriting › Method) en el teléfono: el cerebro de redacción de MaKo
// =============================================================================
// La herramienta del super admin de escritorio (app/admin/copywriting) destilada: la metodología curada (cargada o
// no, y «Cargar metodología») y el swipe de ejemplos reales (la lista, guardar uno nuevo y borrarlo). Lee lo MISMO
// que escritorio (lib/copywriting-metodo.ts) y escribe por la MISMA ruta (/api/mako/copywriting), con su puerta.
//
// Referencia de app real: Readwise en el teléfono (el «swipe file» es una colección de textos guardados: una fila
// por texto con su fuente debajo y tres líneas del cuerpo; guardar uno nuevo es una hoja que sube).
//
// Quién: la puerta de escritorio, `getSesionAdmin()` (el rol GLOBAL admin, como app/admin/copywriting/page.tsx y la
// ruta), ANTES de leer nada, como las demás herramientas del super admin en el teléfono (/m/cobros). No es
// `requireMovil({ navKey })`: la key 'admin-copywriting' es de ADMIN_NAV, no de TODOS_LOS_ITEMS, y `puedeVerKey` diría
// que no a todos. Su fila de SECCIONES_MAS es oculta y `superAdmin` (lib/movil-creacion.ts): le da la cabecera (vuelve a
// More) y el título; se llega por la barra de secciones de Copywriting, que sólo el super admin ve con «Method».
// =============================================================================

import './admin-copywriting.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { listEjemplos, metodoSembrado } from '@/lib/copywriting-metodo';
import { ErrorM, PantallaM } from '@/app/m/_ui';
import { SeccionesTabM } from '@/app/m/_ui/SeccionesTabM';
import { vistaDe } from '../../_creacion/secciones';
import { CopyMethodM } from './CopyMethodM';

export const dynamic = 'force-dynamic';

export default async function CopyMethodPagina() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  const ctx = await requireMovil();
  const datos = await Promise.all([metodoSembrado(), listEjemplos()]).catch(() => null);
  return (
    <PantallaM>
      <SeccionesTabM tab="copywriting" activa="admin-copywriting" vista={vistaDe(ctx)} />
      {datos
        ? <CopyMethodM metodo={datos[0]} ejemplos={datos[1]} />
        : <ErrorM frase="No se pudo leer el cerebro de copywriting. Es un problema nuestro: vuelve a intentar." />}
    </PantallaM>
  );
}
