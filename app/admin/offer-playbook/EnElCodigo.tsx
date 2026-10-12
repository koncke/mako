// =============================================================================
// EnElCodigo — lo que MaKo APLICA hoy, leído del código y no del documento
// =============================================================================
// El documento (docs/offer-marco.md) dice el porqué; esto dice lo que corre: las
// piezas que el chat pregunta, las dimensiones con que diagnostica y cuándo una
// oferta queda «lista» salen de lib/offer-marco.ts, el mismo módulo que usan el
// chat, el PDF y el motor. Si el documento y el código se separan, acá se ve el
// código — que es lo que recibe el cliente. (Y esa diferencia es justo lo que
// lista la pestaña «A definir».)
//
// Tres piezas de la pestaña Criterio: los indicadores, la grilla de piezas y la
// tabla de la rúbrica. Sin 'use client': se dibujan en el servidor.
// =============================================================================

import { Tag, Status } from '@/app/_ui';
import { PIEZAS, DIMENSIONES, DIMENSIONES_CRITICAS, dimensionLabel } from '@/lib/offer-marco';

/**
 * Cuándo el código dice «lista para vender»: las críticas en `criticas` o más y
 * ninguna dimensión por debajo de `piso`. Vive en `calcularDiagnostico`
 * (lib/offer-reglas.ts) como literales; el test corre esa función con estos dos
 * números y falla si se separan.
 */
export const LISTA_PARA_VENDER = { criticas: 7, piso: 5 } as const;

/** «a, b y c». */
const conY = (xs: readonly string[]): string =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

export function Indicadores() {
  const minimas = PIEZAS.filter((p) => p.minimo).length;
  return (
    <div className="opb-kpis">
      <div className="opb-kpi">
        <span className="opb-kpi__n">{PIEZAS.length}</span>
        <span className="opb-kpi__t">piezas</span>
        <span className="opb-kpi__s">{minimas} mínimas para analizar</span>
      </div>
      <div className="opb-kpi">
        <span className="opb-kpi__n">{DIMENSIONES.length}</span>
        <span className="opb-kpi__t">dimensiones</span>
        <span className="opb-kpi__s">{DIMENSIONES_CRITICAS.length} críticas</span>
      </div>
      <div className="opb-kpi">
        <span className="opb-kpi__n">{LISTA_PARA_VENDER.criticas}+</span>
        <span className="opb-kpi__t">lista para vender</span>
        <span className="opb-kpi__s">
          en {conY(DIMENSIONES_CRITICAS.map(dimensionLabel))}; ninguna bajo {LISTA_PARA_VENDER.piso}
        </span>
      </div>
    </div>
  );
}

export function GrillaPiezas() {
  return (
    <div className="opb-piezas">
      {PIEZAS.map((p, i) => (
        <div key={p.key} className="opb-pieza" data-minima={p.minimo}>
          <div className="opb-pieza__cab">
            <span className="opb-pieza__n">{String(i + 1).padStart(2, '0')}</span>
            <span className="opb-pieza__t">{p.label}</span>
            {p.minimo && <Tag color="var(--primary)">Mínima</Tag>}
          </div>
          <p className="opb-pieza__q">{p.que}</p>
        </div>
      ))}
    </div>
  );
}

/** La rúbrica: una fila por dimensión, con lo que mide y cómo se ve cada franja. */
export function TablaRubrica() {
  return (
    <div className="mk-scroll-x opb-marco">
      <table className="opb-tabla opb-rubrica">
        <colgroup>
          <col style={{ width: 150 }} />
          <col style={{ width: '22%' }} />
          <col />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Dimensión</th>
            <th scope="col">Qué mide</th>
            <th scope="col" className="opb-mal">0-3<span className="opb-th__s">débil</span></th>
            <th scope="col" className="opb-reg">4-6<span className="opb-th__s">a medias</span></th>
            <th scope="col" className="opb-bien">7-10<span className="opb-th__s">fuerte</span></th>
          </tr>
        </thead>
        <tbody>
          {DIMENSIONES.map((d) => {
            const critica = DIMENSIONES_CRITICAS.includes(d.id);
            return (
              <tr key={d.id} data-critica={critica}>
                <td>
                  <div className="opb-dim">
                    <span className="opb-dim__id">{d.id}</span>
                    <span className="opb-dim__t">{d.label}</span>
                    {critica && <Status tono="warn">Crítica</Status>}
                  </div>
                </td>
                <td className="opb-tenue">{d.mide}</td>
                <td>{d.bajo}</td>
                <td>{d.medio}</td>
                <td>{d.alto}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
