// =============================================================================
// /m/mas — More: la lista agrupada estilo Ajustes, por las FAMILIAS de la sidebar (v3, 14/10/2026)
// =============================================================================
//   1. Tu cuenta (avatar, nombre, negocio) → /m/cuenta
//   2. ARRIBA, sin título (17/10/2026, como la sidebar de escritorio): el Ops Center (sólo el super admin sin mirar un
//      cliente; /m/operaciones, con la Ticketera adentro) y Second Brain, cada uno con su CRIATURA del Ops Center.
//      Hasta ese día el Ops Center y la Ticketera iban en una caja «Super admin» al final: la Ticketera vive adentro
//      del Centro desde el 16/10, y la caja se fue con la familia Admin de escritorio.
//   3. Una caja por familia de la sidebar, con su nombre de escritorio y en su orden (Operate · Sales Machine)
//   4. El menú de la foto (API, Configuración del negocio, Reportar problema) y, para el super admin sin mirar un
//      cliente, el suyo (Billing, Client Agents, MaKo Context, AI Models, Knowledge, Dev): sin título, como en escritorio
//   5. Versión de computadora
//
// ⚠️ DESDE EL 17/10/2026 ESTÁ TODO LO QUE DIBUJA LA SIDEBAR (`masCompleto`, lib/movil-rutas.ts). Martín: «Implementa
// completamente MaKo Mobile en todas las tabs, porque hay muchas que aun no se pueden acceder». Antes More listaba sólo
// las secciones con pantalla (`SECCIONES_MAS`) y una tab sin ella no aparecía en ningún lado. Ahora una tab sin pantalla
// es una fila «En la computadora» que abre una hoja con el motivo y la salida a la versión de computadora (FilasMas.tsx),
// nunca un link pelado al escritorio encogido. Qué tab tiene pantalla, cuál es sólo de escritorio y cuál está en camino
// lo fija tests/movil-toda-tab.test.ts recorriendo nav.ts.
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
import { masCompleto, type FilaMas } from '@/lib/movil-rutas';
import { Criatura } from '@/app/_components/Criatura';
import { FilaM } from '../_ui/FilaM';
import { PantallaM } from '../_ui/PantallaM';
import { AvatarM, ListaM } from '../_ui/Piezas';
import { SeccionM } from '../_ui/SeccionM';
import { RUTA_CUENTA } from '../_ui/cabecera';
import { contarBadges } from '../badges';
import { FilaVersionComputadora } from './VersionComputadora';
import { FilaComputadoraM, FilaGrupoM } from './FilasMas';

export const dynamic = 'force-dynamic';

/** El Ops Center del super admin (app/m/operaciones; en la URL, /admin/operaciones), con la Ticketera adentro. */
const RUTA_CENTRO = '/m/operaciones';
/** Las filas de arriba llevan la criatura del Ops Center de ese nombre, como en escritorio (nav.ts → `criatura`). */
const criatura = (nombre: string) => <span className="m-mas-logo" aria-hidden><Criatura nombre={nombre} size={28} /></span>;

export default async function MasPagina() {
  const ctx = await requireMovil();
  // ⚠️ Se apaga mientras el super admin MIRA a un cliente (15/10/2026), como en el Sidebar: ahí la barra es la del cliente.
  const veOpsCenter = ctx.sesion.rol === 'admin' && !ctx.impersonando;
  const grupos = masCompleto(ctx.rol, ctx.capa, veOpsCenter);
  const ids = grupos.flatMap((g) => g.filas.flatMap((f) => (f.tipo === 'pantalla' && f.seccion ? [f.seccion] : [])));
  const [negocio, badges] = await Promise.all([
    ctx.impersonando
      ? Promise.resolve(ctx.clienteNombre)
      : ctx.ws != null
        ? getWorkspace(ctx.ws).then((w) => w?.nombre?.trim() || null).catch(() => null)
        : Promise.resolve(null),
    contarBadges({ rol: ctx.rol, capa: ctx.capa, ws: ctx.ws }, ids),
  ]);
  const nombre = (ctx.sesion.nombre ?? '').trim();
  const arriba = grupos.find((g) => g.id === 'arriba');
  const resto = grupos.filter((g) => g.id !== 'arriba');

  /** Una fila de More: su pantalla, la hoja «En la computadora», o la hoja de un desplegable. */
  const fila = (f: FilaMas, conCriatura = false) => (
    f.tipo === 'computadora' ? <FilaComputadoraM key={f.key} fila={f} />
      : f.tipo === 'grupo' ? <FilaGrupoM key={f.key} fila={f} />
        : (
          <FilaM key={f.key} navegacion {...(conCriatura ? { leading: criatura(f.label) } : { icono: f.icon })} titulo={f.label}
            riel={f.seccion && badges[f.seccion] ? <span className="m-num">{badges[f.seccion]}</span> : undefined} href={f.href} />
        )
  );

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

      {(veOpsCenter || arriba) && (
        <SeccionM titulo={null}>
          <ListaM>
            {veOpsCenter && <FilaM navegacion leading={criatura('Ops Center')} titulo="Ops Center" href={RUTA_CENTRO} />}
            {arriba?.filas.map((f) => fila(f, true))}
          </ListaM>
        </SeccionM>
      )}

      {resto.map((g) => (
        <SeccionM key={g.id} titulo={g.titulo ?? null}>
          <ListaM>{g.filas.map((f) => fila(f))}</ListaM>
        </SeccionM>
      ))}

      <div className="m-mas-compu">
        <ListaM>
          <FilaVersionComputadora />
        </ListaM>
      </div>
    </PantallaM>
  );
}
