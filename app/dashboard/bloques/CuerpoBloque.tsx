'use client';

// =============================================================================
// CuerpoBloque — dibuja un bloque del Dashboard (Revenue, A quién cobrarle, cohortes…)
// =============================================================================
// Recibe lo que devolvió /api/graficos {accion:'bloques'} para este bloque (lib/graficos-bloques.ts) y lo
// dibuja con el diseño de la tab vieja de Comercial, con los tokens de la app (modo oscuro) y la letra
// de la hoja. El TÍTULO de la tarjeta lo dibuja el editor: acá no se repite.
//
// Los seis de Comercial los dibuja esta carpeta (un archivo por bloque). Los demás —los de las tabs de
// Analysts (BLOQUES_EXTRA)— van ENTEROS a `CuerpoBloqueExtra` (./extra/, de otra corrida), con las MISMAS
// props.
//
// `onRefrescar` vuelve a pedir los datos de la HOJA: después de marcar una cuota cobrada cambian juntos
// el Revenue, el Outstanding y «A quién cobrarle».

import type { Bloque } from '@/lib/graficos-catalogo';
import type { EstiloEfectivo } from '@/lib/graficos-temas';
import { CuerpoBloqueExtra } from './extra/CuerpoBloqueExtra';
import {
  esBloqueComercial, payloadDe,
  type DatosCobranza, type DatosCohortes, type DatosFunnel, type DatosRevenue, type DatosScl,
} from './datos-comercial';
import { Aviso, Raiz } from './piezas';
import { BloqueRevenue } from './BloqueRevenue';
import { BloqueCobranza } from './BloqueCobranza';
import { BloqueFunnel } from './BloqueFunnel';
import { BloqueScl } from './BloqueScl';
import { BloqueCohortes } from './BloqueCohortes';

export type EstadoBloque = { cargando: boolean; error?: string; datos?: unknown };

export function CuerpoBloque({ b, estado, estilo, desde, hasta, onRefrescar }: {
  b: Bloque; estado: EstadoBloque; estilo: EstiloEfectivo; desde: string; hasta: string; onRefrescar: () => void;
}) {
  if (!esBloqueComercial(b.bloque)) {
    return <CuerpoBloqueExtra b={b} estado={estado} estilo={estilo} desde={desde} hasta={hasta} onRefrescar={onRefrescar} />;
  }
  const d = payloadDe(estado.datos, b.bloque);

  // «A quién cobrarle» se queda montado aunque no haya datos: su toast (con el «Deshacer» de 5 s) vive
  // adentro, y la hoja recarga justo después de marcar una cuota.
  if (b.bloque === 'cobranza') {
    return (
      <Raiz>
        <BloqueCobranza d={d as DatosCobranza | null} cargando={estado.cargando} error={estado.error} estilo={estilo} onRefrescar={onRefrescar} />
      </Raiz>
    );
  }

  // Como un gráfico (app/dashboard/Grafico.tsx): sin datos, el giro o el error; con un error, el error.
  if (!d || estado.error) return <Raiz><Aviso cargando={estado.cargando} error={estado.error} /></Raiz>;

  return (
    <Raiz>
      {b.bloque === 'revenue' && <BloqueRevenue d={d as DatosRevenue} estilo={estilo} />}
      {b.bloque === 'funnel_maduro' && <BloqueFunnel d={d as DatosFunnel} estilo={estilo} />}
      {b.bloque === 'scl' && <BloqueScl d={d as DatosScl} />}
      {(b.bloque === 'cohortes_mes' || b.bloque === 'cohortes_semana') && <BloqueCohortes d={d as DatosCohortes} estilo={estilo} />}
    </Raiz>
  );
}
