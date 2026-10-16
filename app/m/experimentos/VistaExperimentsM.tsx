'use client';

// =============================================================================
// /m/experimentos — la tab «Experiments»: los que corren, los guardados y su hoja
// =============================================================================
// Escritorio (ExperimentsTab.tsx): las tarjetas de los que corren (título y su píldora, la métrica,
// baseline → actual con la variación, la línea, «día X de Y») con «Cerrar y concluir» y «Descartar»,
// y abajo «Guardados · sin arrancar» con «Iniciar». Acá, la tarjeta del prototipo v3 (`experimentos`,
// docs/prototipos/mako-mobile-tableros.html) y lo que se hace con ella en una hoja, como un ticker
// de la app de Bolsa de iOS: el número grande, de dónde viene, y tocarla abre el detalle.
//
// ⚠️ LO QUE SE CERRÓ, SE INICIÓ O SE DESCARTÓ SE ESCONDE YA (`hechos`), y se suelta cuando llegan
//    las props nuevas del server (el patrón de React de «ajustar el estado cuando cambia una prop»):
//    sin eso, la tarjeta seguiría ahí hasta el refresh y un segundo toque cerraría dos veces. Las
//    props NO se copian a un estado: tirar para refrescar trae lo nuevo (tests/movil-refrescar.test.ts).
// =============================================================================

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { ComputadoraM, FilaDatoM, FilaM, ListaM, PieM, PildoraM, SeccionM, SheetM, VacioM, useConexion, useToastM } from '@/app/m/_ui';
import { accionExperimento } from './api';
import { R, diasTexto, type ExpActivoM, type ExpGuardadoM } from './modelo';
import { LineaM } from './piezas';

type Op = 'cerrar' | 'descartar' | 'iniciar';
type Sel = { tipo: 'activo'; e: ExpActivoM } | { tipo: 'guardado'; e: ExpGuardadoM };

const TOAST_OK: Record<Op, string> = { cerrar: 'Experimento cerrado', iniciar: 'Experimento iniciado', descartar: 'Descartado' };
const TOAST_MAL: Record<Op, string> = { cerrar: 'No se pudo cerrar', iniciar: 'No se pudo iniciar', descartar: 'No se pudo descartar' };

/** Lo que se queda en la computadora en esta tab. */
export const EXPERIMENTS_EN_LA_COMPUTADORA = 'Editar la propuesta de MaKo';

export function VistaExperimentsM({ activos, guardados, onNuevo }: {
  activos: ExpActivoM[];
  guardados: ExpGuardadoM[];
  onNuevo: () => void;
}) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();

  const [hechos, setHechos] = useState<ReadonlySet<number>>(new Set());
  const [vistos, setVistos] = useState({ activos, guardados });
  if (vistos.activos !== activos || vistos.guardados !== guardados) {
    setVistos({ activos, guardados });
    setHechos(new Set());
  }

  const [sel, setSel] = useState<Sel | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [ocupado, setOcupado] = useState<Op | null>(null);

  const abrir = (s: Sel) => { setSel(s); setAbierta(true); };

  const hacer = async (op: Op, id: number) => {
    if (ocupado) return;
    setOcupado(op);
    const r = await accionExperimento(op, id);
    setOcupado(null);
    if (!r.ok) { toast(TOAST_MAL[op]); return; }
    setHechos((h) => new Set(h).add(id));
    setAbierta(false);
    toast(TOAST_OK[op]);
    // Después del cierre por código (replaceState): un refresh pedido antes se descarta.
    window.setTimeout(() => router.refresh(), 400);
  };

  const corren = activos.filter((e) => !hechos.has(e.id));
  const quietos = guardados.filter((e) => !hechos.has(e.id));

  const cuerpo = sel?.tipo === 'activo' ? (
    <div className="m-experimentos-hoja">
      <PildoraM tono={sel.e.tono}>{sel.e.estado}</PildoraM>
      <p className="m-experimentos-hoja__texto">{sel.e.hipotesis}</p>
      <div className="m-experimentos-cifra">
        <span className="m-experimentos-cifra__k">{sel.e.metrica}</span>
        <span className="m-experimentos-cifra__v"><span>{sel.e.antes} →</span><strong>{sel.e.ahora}</strong>{sel.e.delta && <em>{sel.e.delta}</em>}</span>
      </div>
      <LineaM serie={sel.e.serie} tono={sel.e.linea} />
      <ListaM>
        <FilaDatoM k="Avance" v={`día ${sel.e.dia} de ${sel.e.dias}`} />
        {sel.e.objetivo && <FilaDatoM k="Objetivo" v={sel.e.objetivo} />}
        {sel.e.desde && <FilaDatoM k="Desde" v={sel.e.desde} />}
      </ListaM>
      {sel.e.cambio && (
        <>
          <h4 className="m-experimentos-hoja__sub">{R.queCambia}</h4>
          <p className="m-experimentos-hoja__texto">{sel.e.cambio}</p>
        </>
      )}
    </div>
  ) : sel?.tipo === 'guardado' ? (
    <div className="m-experimentos-hoja">
      <p className="m-experimentos-hoja__texto">{sel.e.hipotesis}</p>
      <ListaM>
        <FilaDatoM k="Métrica" v={sel.e.metrica} />
        <FilaDatoM k="Objetivo" v={sel.e.objetivo} />
        <FilaDatoM k="Ventana" v={sel.e.ventana} />
      </ListaM>
      {sel.e.cambio && (
        <>
          <h4 className="m-experimentos-hoja__sub">{R.queCambia}</h4>
          <p className="m-experimentos-hoja__texto">{sel.e.cambio}</p>
        </>
      )}
    </div>
  ) : null;

  const faltan = sel?.tipo === 'activo' ? Math.max(0, sel.e.dias - sel.e.dia) : 0;
  const pie = sel ? (
    <PieM consecuencia={sel.tipo === 'guardado'
      ? 'MaKo mide el baseline y arranca hoy.'
      : faltan > 0 ? `Faltan ${diasTexto(faltan)}: puede no concluir.` : 'MaKo mide el resultado y escribe la conclusión.'}>
      {sel.tipo === 'activo' ? (
        <Button variant="primary" size="lg" full loading={ocupado === 'cerrar'} disabled={!enLinea || ocupado != null}
          onClick={() => { void hacer('cerrar', sel.e.id); }}>{R.cerrar}</Button>
      ) : (
        <Button variant="primary" size="lg" full loading={ocupado === 'iniciar'} disabled={!enLinea || ocupado != null}
          onClick={() => { void hacer('iniciar', sel.e.id); }}>{R.iniciar}</Button>
      )}
      <Button variant="tertiary" size="lg" full loading={ocupado === 'descartar'} disabled={!enLinea || ocupado != null}
        onClick={() => { void hacer('descartar', sel.e.id); }}>{R.descartar} experimento</Button>
    </PieM>
  ) : undefined;

  return (
    <div className="m-experimentos-exps">
      {corren.length === 0 && quietos.length === 0 ? (
        <VacioM frase={`${R.sinCorrer}.`} accion={{ rotulo: R.primero, onClick: onNuevo }} />
      ) : (
        <>
          {corren.map((e) => (
            <button key={e.id} type="button" className="m-experimentos-exp" onClick={() => abrir({ tipo: 'activo', e })}>
              <span className="m-experimentos-exp__cab">
                <b>{e.titulo}</b>
                <PildoraM tono={e.tono}>{e.estado}</PildoraM>
              </span>
              <span className="m-experimentos-exp__metrica">{e.metrica}</span>
              <span className="m-experimentos-cifra__v"><span>{e.antes} →</span><strong>{e.ahora}</strong>{e.delta && <em>{e.delta}</em>}</span>
              <span className="m-experimentos-avance" data-listo={e.listo || undefined}><i style={{ width: `${Math.round(e.avance * 100)}%` }} /></span>
              <span className="m-experimentos-exp__dia">día {e.dia} de {e.dias}</span>
            </button>
          ))}
          {quietos.length > 0 && (
            <SeccionM titulo={R.guardados}>
              <ListaM>
                {quietos.map((e) => (
                  <FilaM key={e.id} titulo={e.titulo} segunda={`${e.metrica} · ${e.ventana}`} onClick={() => abrir({ tipo: 'guardado', e })} />
                ))}
              </ListaM>
            </SeccionM>
          )}
        </>
      )}
      <ComputadoraM que={EXPERIMENTS_EN_LA_COMPUTADORA} />

      <SheetM abierto={abierta} onCerrar={() => setAbierta(false)} titulo={sel?.e.titulo ?? 'Experimento'} id="experimento"
        snap="alto" ocupado={ocupado != null} rotuloCerrar="Volver a Experiments" pie={pie}>
        {cuerpo}
      </SheetM>
    </div>
  );
}
