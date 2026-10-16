// =============================================================================
// /m/mas — More: la lista agrupada estilo Ajustes, por las FAMILIAS de la sidebar (v3, 14/10/2026)
// =============================================================================
//   1. Tu cuenta (avatar, nombre, negocio) → /m/cuenta
//   2. Una caja por familia de la sidebar, con su nombre de escritorio y en su orden (Operate ·
//      Analyze · Sales Machine · Content Machine · Customer Success): `gruposMas`
//   3. Pregúntale a MaKo, con el logo real como ícono (fuera de las familias, como en escritorio)
//   4. Super admin: el Centro de Operaciones (/admin/operaciones, en el teléfono /m/operaciones, sólo
//      para mirar) y la Ticketera (el mazo de decisiones; desde el 16/10/2026, adentro del Centro:
//      /m/operaciones?ticketera=tarjetas), en el orden de la barra de escritorio. La Ticketera se llamó
//      «Decisiones» y abría la lista hasta el 14/10/2026: Martín la renombró y pidió que se entre
//      directo al mazo (la lista es la vista secundaria).
//      ⚠️ Se apaga mientras el super admin MIRA a un cliente (15/10/2026), como en el Sidebar
//      («adminOnly se apaga mirando un cliente»): ahí la barra es la del cliente.
//   5. Versión de computadora
//
// ⚠️ DECISIONES NO VA EN `SECCIONES_MAS`, A PROPÓSITO (14/10/2026, acordado con el chat «Pricing MaKo»,
// dueño de la tab). SECCIONES_MAS es para tabs DEL NEGOCIO gateadas por una key de nav.ts (puedeVerKey),
// y de ahí salen la barra del rol, la cabecera y el desvío. Decisiones no es una tab del negocio: es el
// tablero de la PLATAFORMA, no tiene key en nav.ts, y su guard es «super admin» (getSesionAdmin =
// sesión con rol 'admin', la misma pregunta que se hace acá). Si entrara a SECCIONES_MAS podría «subir
// a la barra» de un rol al que le falta un destino, que es justo lo que no tiene que pasar.
//
// Lo que el rol no ve, NO aparece (`gruposMas` → `puedeVerKey`, la misma regla del Sidebar
// y del guard de cada sección). Lo que subió a la barra (porque el rol no ve CRM o Plan) no
// se repite aquí. More lo ve cualquiera con sesión: `requireMovil()` sin navKey.
// =============================================================================

import './mas.css';
import { requireMovil } from '@/lib/movil-guard';
import { getWorkspace } from '@/lib/workspace';
import { gruposMas } from '@/lib/movil-rutas';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { FilaM } from '../_ui/FilaM';
import { PantallaM } from '../_ui/PantallaM';
import { AvatarM, ListaM } from '../_ui/Piezas';
import { SeccionM } from '../_ui/SeccionM';
import { RUTA_CUENTA } from '../_ui/cabecera';
import { contarBadges } from '../badges';
import { FilaVersionComputadora } from './VersionComputadora';

export const dynamic = 'force-dynamic';

/** La Ticketera del super admin: vive adentro del Centro desde el 16/10/2026 (`?ticketera=`); esto es un atajo. */
const RUTA_TICKETERA = '/m/operaciones?ticketera=tarjetas';
/** El Centro de Operaciones del super admin, sólo para mirar (app/m/operaciones; en la URL, /admin/operaciones). */
const RUTA_CENTRO = '/m/operaciones';

export default async function MasPagina() {
  const ctx = await requireMovil();
  const grupos = gruposMas(ctx.rol, ctx.capa);
  const [negocio, badges] = await Promise.all([
    ctx.impersonando
      ? Promise.resolve(ctx.clienteNombre)
      : ctx.ws != null
        ? getWorkspace(ctx.ws).then((w) => w?.nombre?.trim() || null).catch(() => null)
        : Promise.resolve(null),
    contarBadges({ rol: ctx.rol, capa: ctx.capa, ws: ctx.ws }, grupos.flatMap((g) => g.secciones.map((s) => s.id))),
  ]);
  const nombre = (ctx.sesion.nombre ?? '').trim();

  return (
    <PantallaM>
      <ListaM>
        <FilaM
          leading={<AvatarM nombre={nombre} email={ctx.sesion.email} tam="lg" />}
          titulo={nombre || ctx.sesion.email}
          segunda={negocio ?? undefined}
          href={RUTA_CUENTA}
        />
      </ListaM>

      {grupos.map((g) => (
        <SeccionM key={g.familia ?? 'mako'} titulo={g.titulo ?? undefined}>
        <ListaM>
          {g.secciones.map((s) => (
            <FilaM
              key={s.id}
              navegacion
              // MaKo lleva el logo REAL (MakoLogo), no el ícono del set; es el único lugar
              // además de Today donde aparece.
              leading={s.id === 'mako' ? <span className="m-mas-logo" aria-hidden><MakoLogo size={32} animate={false} /></span> : undefined}
              icono={s.id === 'mako' ? undefined : s.icon}
              titulo={s.label}
              riel={badges[s.id] ? <span className="m-num">{badges[s.id]}</span> : undefined}
              href={s.href}
            />
          ))}
        </ListaM>
        </SeccionM>
      ))}

      {ctx.sesion.rol === 'admin' && !ctx.impersonando && (
        <SeccionM titulo="Super admin">
          <ListaM>
            <FilaM navegacion icono="config" titulo="Centro de Operaciones" href={RUTA_CENTRO} />
            <FilaM navegacion icono="admin" titulo="Ticketera" href={RUTA_TICKETERA} />
          </ListaM>
        </SeccionM>
      )}

      <div className="m-mas-compu">
        <ListaM>
          <FilaVersionComputadora />
        </ListaM>
      </div>
    </PantallaM>
  );
}
