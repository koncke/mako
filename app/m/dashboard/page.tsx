// =============================================================================
// /m/dashboard — «Dashboard» en el teléfono: las dos hojas del informe, en la forma fija
// =============================================================================
// docs/diseno-mako-mobile-v2.md, «Dashboard», y el prototipo (`data-ir="dashboard"`):
// segmentado Marketing | Comercial, UN gráfico por hoja (leads por día; cash por semana) con el
// valor de la barra tocada arriba, la lista de números con su variación contra el período
// anterior y, en Comercial, «A quién cobrarle» con «Marcar cobrado» + Deshacer. Las hojas propias
// del informe se abren desde «Otras hojas» (./[hoja]) en la misma forma fija.
//
// Quién lo ve: la regla de escritorio (app/dashboard/page.tsx). El ítem `graphics` lo ven el admin
// y el CLOSER, pero el closer ve SÓLO la hoja Closing (decisión 6 de Martín) y sólo si su negocio
// la compró; si no, a Today. Al closer no se le lee ni Marketing ni Comercial.
//
// ⚠️ El período sale de `?periodo=` (validado contra los que ofrece la pantalla) y la hoja elegida
//    de `?hoja=`; el workspace NUNCA de la URL: lo resuelven `requireMovil` y las lecturas.
// ⚠️ maxDuration 60: desde acá se marca una cuota cobrada (`marcarPagoAction`), y una server
//    action hereda el techo de la página que la invoca. Y las lecturas de la pauta son paginadas.
// =============================================================================

import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL, puedeVerKey } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { hoyEnTijuana } from '@/lib/date-utils';
import { leerTablero } from '@/lib/graficos-tablero';
import { hojaDeRol, informeDeRol } from '@/lib/graficos-plantillas';
import { ComputadoraM, FilaM, ListaM, PantallaM, SeccionM } from '@/app/m/_ui';
import { DashboardM } from './DashboardM';
import { entraEnTelefono, esHojaInicial, hojaComercial, hojaMarketing, hojaPropia, periodoPropio } from './datos';
import { PERIODOS_MOVIL, PERIODO_DEFAULT, periodoDeParam, periodosParaHoja } from './modelo';
import './dashboard.css';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Busqueda = { periodo?: string | string[]; hoja?: string | string[] };
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DashboardPagina({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const ctx = await requireMovil({ navKey: 'graphics' });
  const p = await searchParams;
  // El «hoy» de los períodos es el de escritorio (app/dashboard/page.tsx).
  const hoy = hoyEnTijuana();

  // El closer y el setter ven SÓLO su hoja (Closing y Chat Analyst: `HOJA_DE_ROL`), la de escritorio, con sus
  // ids fijos y en memoria. Preguntar sólo por el closer dejaba al setter en la rama del admin: Marketing,
  // Comercial y las hojas del informe.
  const unica = hojaDeRol(ctx.rol);
  const informeRol = informeDeRol(ctx.rol);
  if (unica && informeRol) {
    if (!tabEnCapa(unica.capa, ctx.capa)) redirect(await rutaConWs(HOME_MOVIL));
    const h = informeRol.hojas[0];
    const def = periodoPropio(h);
    const periodos = def ? periodosParaHoja(def) : [];
    const periodo = def ? periodoDeParam(uno(p.periodo), periodos, def) : null;
    const hoja = await hojaPropia(h, periodo, hoy);
    return (
      <PantallaM refrescable>
        <DashboardM hojas={[hoja]} hojaInicial={hoja.id} periodo={periodo} periodos={periodos} fichaLead={false} />
        <ComputadoraM que={unica.plantilla === 'closing' ? 'Llamadas, embudo y factores' : 'Las conversaciones y sus tablas'} />
      </PantallaM>
    );
  }

  const periodo = periodoDeParam(uno(p.periodo), PERIODOS_MOVIL, PERIODO_DEFAULT);
  const [marketing, comercial, lectura] = await Promise.all([
    hojaMarketing(periodo, hoy),
    hojaComercial(periodo, hoy),
    // Sólo para listar las hojas propias: si no se puede leer, no hay «Otras hojas» (el resto sigue).
    leerTablero().catch(() => null),
  ]);
  const otras = (lectura?.tablero.hojas ?? []).filter((h) => !esHojaInicial(h) && entraEnTelefono(h));

  return (
    <PantallaM refrescable>
      <DashboardM
        hojas={[marketing, comercial]}
        hojaInicial={uno(p.hoja) === 'comercial' ? 'comercial' : 'marketing'}
        periodo={periodo}
        periodos={[...PERIODOS_MOVIL]}
        fichaLead={puedeVerKey('crm', ctx.rol, ctx.capa)}
      />
      {otras.length > 0 && (
        <SeccionM titulo="Otras hojas">
          <ListaM>
            {otras.map((h) => (
              <FilaM key={h.id} icono="graphics" titulo={h.nombre} navegacion href={`/m/dashboard/${encodeURIComponent(h.id)}`} />
            ))}
          </ListaM>
        </SeccionM>
      )}
      <ComputadoraM que="Editar el tablero" />
    </PantallaM>
  );
}
