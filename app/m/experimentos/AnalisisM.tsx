// =============================================================================
// /m/experimentos — la tab «Análisis», destilada (server component, como la de escritorio)
// =============================================================================
// La de escritorio es app/experimentos/VistaAnalisis.tsx: el informe en el orden en que se PREGUNTA
// (las advertencias primero, la cascada, la fuga barata, los creativos, la meta, mes a mes). Acá va
// el MISMO orden con los MISMOS títulos y números; lo que se recorta son las tablas: cada escalón y
// cada mes es una fila (como la app de Stripe o la de Google Analytics, que no dibujan tablas en el
// teléfono), y quedan en la computadora «De dónde sale» de cada escalón, lo que contestaron los que
// no calificaban y la nota de la fuente de los creativos.
//
// Server component a propósito, como escritorio: el tipo `AnalisisNegocio` no cruza al navegador y
// la page sólo lo calcula cuando la URL pide `?tab=analisis` (`analisisNegocio` es lenta).
// ⚠️ Los rangos llevan `tab=analisis` (sin él, Experiments abre en Retro y el rango se calcula para
//    nadie) y navegan con el Link de la casa, que traduce la ruta de /m y conserva el `?ws=`.
// =============================================================================

import type { AnalisisNegocio } from '@/lib/analisis-modelo';
import { RANGOS_ANALISIS, fmtFechaLarga, n0Analisis as n0, pctAnalisis as pct, rangoHace } from '@/lib/experimentos-formato';
import { ComputadoraM, ErrorM, FilaDatoM, FilaM, ListaM, PildoraM, SeccionM, SegmentadoM } from '@/app/m/_ui';
import { R, advertenciaM, mesTexto, rangoElegido } from './modelo';

/** Lo que el teléfono no dibuja del informe (una fila, al final). */
export const ANALISIS_EN_LA_COMPUTADORA = 'Fuentes y respuestas del formulario';

type Creativo = AnalisisNegocio['creativos']['top_costo'][number];

function FilasCreativos({ items, destacar }: { items: Creativo[]; destacar: 'agendas' | 'costo' }) {
  if (items.length === 0) return <p className="m-experimentos-nota">Sin anuncios con agendas en el período.</p>;
  return (
    <ListaM>
      {items.map((x) => (
        <FilaM key={x.ad_id} titulo={x.nombre}
          segunda={destacar === 'costo' ? `${x.agendas} ag · ${x.dias_al_aire}d` : `${n0(x.costo_por_agenda)}/ag · ${x.dias_al_aire}d`}
          riel={destacar === 'costo' ? n0(x.costo_por_agenda) : `${x.agendas} ag`} />
      ))}
    </ListaM>
  );
}

export function AnalisisM({ datos, error, desde, hasta }: {
  datos: AnalisisNegocio | null;
  error: string;
  /** El rango que pidió la URL (para marcar cuál de los tres es). */
  desde: string | null;
  hasta: string | null;
}) {
  if (error || !datos) {
    // Un rango mal escrito no se arregla reintentando: la salida es volver al de siempre.
    return /rango|fecha/i.test(error)
      ? <ErrorM frase="Ese rango de fechas no sirve." arreglo={{ rotulo: 'Ver el rango de siempre', href: '/m/experimentos?tab=analisis' }} />
      : <ErrorM frase="No pude armar el análisis. No es nada tuyo." />;
  }

  const a = datos;
  const c = a.cascada;
  const elegido = rangoElegido(desde, hasta) ?? '';
  const conUsd = (v: number | null, usd: number | null) => (usd == null ? n0(v) : `${n0(v)} · ~US$${n0(usd)}`);

  return (
    <div className="m-experimentos-analisis">
      {/* El rango, arriba y visible: nunca un «histórico» mudo. */}
      <p className="m-experimentos-periodo">{fmtFechaLarga(a.periodo.desde)} – {fmtFechaLarga(a.periodo.hasta)}</p>
      <SegmentadoM<string>
        etiqueta="Período"
        valor={elegido}
        opciones={RANGOS_ANALISIS.map((r) => {
          const x = rangoHace(r.dias);
          return { id: String(r.dias), label: r.label, href: `/m/experimentos?tab=analisis&desde=${x.desde}&hasta=${x.hasta}` };
        })}
      />

      {/* Las advertencias van PRIMERO, no al pie. */}
      {a.advertencias.length > 0 && (
        <SeccionM titulo={R.antesDeLeer}>
          <ListaM>
            {a.advertencias.map((w, i) => {
              const x = advertenciaM(w);
              return (
                <div key={i} className="m-experimentos-aviso" data-tono={x.tono}><i aria-hidden />{x.texto}</div>
              );
            })}
          </ListaM>
        </SeccionM>
      )}

      <SeccionM titulo={R.cascada}>
        <ListaM>
          <FilaDatoM k="Inversión" v={conUsd(c.inversion, c.inversion_usd)} />
          <FilaDatoM k="Ingreso" v={c.ingreso_usd == null ? '—' : `US$${n0(c.ingreso_usd)}`} />
          <FilaDatoM k="ROAS" v={c.roas == null ? '—' : `${c.roas}x`} />
        </ListaM>
        <ListaM etiqueta="Escalones">
          {c.escalones.map((e, i) => (
            <FilaM key={`${e.nombre}-${i}`} titulo={e.nombre}
              segunda={[
                e.costo_unitario == null ? null : `${conUsd(e.costo_unitario, e.costo_unitario_usd)} c/u`,
                e.conversion_desde_anterior == null ? null : `sobrevive ${pct(e.conversion_desde_anterior)}`,
              ].filter(Boolean).join(' · ') || undefined}
              riel={n0(e.cantidad)} />
          ))}
        </ListaM>
        <ListaM>
          <FilaDatoM k="Show rate" v={pct(a.tasas.show_rate)} />
          <FilaDatoM k="No-show" v={pct(a.tasas.no_show)} />
          <FilaDatoM k="Cierre sobre asistencias" v={pct(a.tasas.tasa_cierre_sobre_asistencias)} />
          <FilaDatoM k="Agendas por cada cierre"v={a.tasas.agendas_por_cierre ?? '—'} />
        </ListaM>
      </SeccionM>

      <SeccionM titulo={R.calificaban}>
        <ListaM>
          <FilaDatoM k="Asistieron" v={a.calificacion.asistieron} />
          <FilaDatoM k="Calificados" v={a.calificacion.calificados} />
          <FilaDatoM k="No calificaban" v={a.calificacion.no_calificados} />
          <FilaDatoM k="Sin marcar" v={a.calificacion.sin_marcar} />
        </ListaM>
      </SeccionM>

      <SeccionM titulo={R.creativos}>
        <h3 className="m-experimentos-sub">{R.masTrajeron}</h3>
        <FilasCreativos items={a.creativos.top_volumen.slice(0, 5)} destacar="agendas" />
        <h3 className="m-experimentos-sub">{R.masBaratos}</h3>
        <FilasCreativos items={a.creativos.top_costo.slice(0, 5)} destacar="costo" />
        {a.creativos.escondidos.length > 0 && (
          <>
            <h3 className="m-experimentos-sub">{R.escondidos}</h3>
            <FilasCreativos items={a.creativos.escondidos} destacar="costo" />
          </>
        )}
      </SeccionM>

      {a.plan && (
        <SeccionM titulo={R.meta}>
          <ListaM>
            <FilaDatoM k="Cierres objetivo" v={a.plan.cierres_objetivo} />
            <FilaDatoM k="Asistencias" v={a.plan.asistencias_necesarias ?? '—'} />
            <FilaDatoM k="Agendas" v={a.plan.agendas_necesarias ?? '—'} />
            <FilaDatoM k="Inversión" v={n0(a.plan.inversion_necesaria)} />
          </ListaM>
          {a.plan.contradiccion && (
            <div className="m-experimentos-contradiccion"><PildoraM tono="warn">No alcanza</PildoraM><p>{a.plan.contradiccion}</p></div>
          )}
        </SeccionM>
      )}

      <SeccionM titulo={R.mesAMes}>
        {a.serie.length === 0 ? <p className="m-experimentos-nota">Sin meses en el rango.</p> : (
          <ListaM>
            {a.serie.map((f) => (
              <FilaM key={f.periodo} titulo={mesTexto(f.periodo)}
                segunda={`inversión ${n0(f.meta_inversion)} · ${f.agendas_creadas} agendas · ${f.ganados} cierres`} />
            ))}
          </ListaM>
        )}
      </SeccionM>

      <ComputadoraM que={ANALISIS_EN_LA_COMPUTADORA} />
    </div>
  );
}
