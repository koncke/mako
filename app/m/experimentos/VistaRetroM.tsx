'use client';

// =============================================================================
// /m/experimentos — la tab «Retro»: la lista, el reporte (Overview · Plan) y decidir el plan
// =============================================================================
// Escritorio (RetroTab.tsx + RetroReport.tsx): la lista de retros (la tesis como título, cuándo se
// corrió y cuántas recomendaciones), y al abrir una, el reporte en tres vistas que abre en el PLAN
// (es lo único de la Retro que produce trabajo). Acá, las mismas dos primeras vistas con su nombre:
//   · Overview — la tesis del período, la fuga en plata y los hallazgos (cada uno abre su evidencia);
//   · Plan — Experiments y To-do, cada recomendación con Aceptar · Posponer · Descartar (con el
//     motivo, los cuatro de escritorio), y «Lo que quedó del retro pasado».
// Detail (los gráficos por herramienta) y generar una Retro nueva (un stream de minutos que una
// pantalla bloqueada corta) se quedan en la computadora.
// Referencia: el «inbox» de recomendaciones de Linear (Triage): una fila por cosa, se abre, se
// acepta o se descarta con su motivo, y Deshacer en el toast.
//
// ⚠️ LA RETRO ABIERTA VIVE EN LA URL (`?retro=<id>`) con `history.pushState`, que Next integra a su
//    router (node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md): el
//    «atrás» de Android vuelve a la lista (y antes, si hay una hoja abierta, cierra la hoja). Sin
//    viaje al server: las retros ya bajaron con la página.
// ⚠️ LO QUE DEVUELVE /api/retro (el reporte como quedó en la base) se guarda encima de las props
//    (`reportes`) y se suelta cuando llegan las del server: las props no se copian a un estado.
// =============================================================================

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { MakoStar } from '@/app/_components/MakoBrand';
import {
  ComputadoraM, FilaDatoM, FilaM, ListaM, PieM, PildoraM, SeccionM, SegmentadoM, SheetM, VacioM, useConexion, useToastM,
} from '@/app/m/_ui';
import { decidirPlan } from './api';
import {
  MOTIVOS_DESCARTE, R, VISTAS_RETRO, accionesDelPlan, estadoDelPlan, reporteM, retroDeParam, rotuloAceptar, toastDelPlan, urlCon,
  type HallazgoM, type OpPlan, type PlanItemM, type ReporteM, type RetroM, type VistaRetro,
} from './modelo';
import { EvidenciaM, TesisM } from './piezas';

/** Lo que se queda en la computadora en esta tab. */
export const RETRO_EN_LA_COMPUTADORA = `${R.nuevaRetro} y el Detail`;

export function VistaRetroM({ retros }: { retros: RetroM[] }) {
  const sp = useSearchParams();
  const selId = retroDeParam(sp.get('retro'));
  /** Esta pantalla puso la entrada del historial de la Retro abierta: «volver» es un «atrás». */
  const empujada = useRef(false);

  const [reportes, setReportes] = useState<ReadonlyMap<number, ReporteM>>(new Map());
  const [vistas, setVistas] = useState(retros);
  if (vistas !== retros) { setVistas(retros); setReportes(new Map()); }

  const abrir = (id: number) => {
    window.history.pushState(null, '', urlCon(window.location.href, { retro: String(id), sheet: null }));
    empujada.current = true;
    window.scrollTo({ top: 0 });
  };
  const volver = () => {
    if (empujada.current) { empujada.current = false; window.history.back(); return; }
    window.history.replaceState(null, '', urlCon(window.location.href, { retro: null, sheet: null }));
  };

  const sel = selId != null ? retros.find((r) => r.id === selId) ?? null : null;
  if (sel) {
    return (
      <DetalleRetro key={sel.id} retro={sel} reporte={reportes.get(sel.id) ?? sel.reporte} onVolver={volver}
        onReporte={(rep) => setReportes((m) => new Map(m).set(sel.id, rep))} />
    );
  }

  return (
    <div className="m-experimentos-retros">
      {retros.length === 0 ? <VacioM frase={`${R.sinRetros}.`} /> : (
        <ListaM>
          {retros.map((r) => <FilaM key={r.id} titulo={r.titulo} segunda={r.segunda} riel={r.aceptadas} onClick={() => abrir(r.id)} />)}
        </ListaM>
      )}
      <ComputadoraM que={RETRO_EN_LA_COMPUTADORA} />
    </div>
  );
}

// ── Una Retro abierta ─────────────────────────────────────────────────────────

function DetalleRetro({ retro, reporte, onVolver, onReporte }: {
  retro: RetroM;
  reporte: ReporteM | null;
  onVolver: () => void;
  onReporte: (r: ReporteM) => void;
}) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  // Abre en el PLAN, como escritorio: es lo único de la Retro que produce trabajo.
  const [vista, setVista] = useState<VistaRetro>('plan');

  // La hoja de una recomendación o de un hallazgo (nunca dos: abrir una reemplaza a la otra).
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemAbierto, setItemAbierto] = useState(false);
  const [motivos, setMotivos] = useState(false);
  const [hallazgo, setHallazgo] = useState<HallazgoM | null>(null);
  const [hallazgoAbierto, setHallazgoAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<OpPlan | null>(null);

  const item = useMemo(() => reporte?.plan.find((p) => p.id === itemId) ?? null, [reporte, itemId]);
  const abrirItem = (id: string) => { setItemId(id); setMotivos(false); setItemAbierto(true); };

  /**
   * Una decisión, por /api/retro. Nunca dos a la vez: el server lee, modifica y escribe el reporte
   * entero (lib/retro-pipeline.ts, `aplicarPlan`), y dos seguidas se pisan. La guarda es un ref y no
   * el estado: el «Deshacer» del toast llama a esta función desde un render viejo.
   */
  const enCurso = useRef(false);
  const decidir = async (it: PlanItemM, op: OpPlan, motivo?: string): Promise<boolean> => {
    if (enCurso.current) { if (op === 'deshacer') toast('No se pudo deshacer'); return false; }
    enCurso.current = true;
    setOcupado(op);
    const r = await decidirPlan(retro.id, it.id, op, motivo);
    enCurso.current = false;
    setOcupado(null);
    if (!r.ok) { toast(op === 'deshacer' ? 'No se pudo deshacer' : 'No se pudo aplicar'); return false; }
    onReporte(reporteM(r.datos));
    return true;
  };

  const elegir = async (it: PlanItemM, op: Exclude<OpPlan, 'deshacer'>, motivo?: string) => {
    if (!(await decidir(it, op, motivo))) return;
    // Los motivos se sueltan al ABRIR la próxima (abrirItem): soltarlos acá cambiaba lo de adentro
    // de la hoja durante los 220 ms en que se va.
    setItemAbierto(false);
    if (op === 'aceptar') {
      // Aceptar CREA el experimento y sus tareas en el server: Experiments y el Plan se enteran con el refresh.
      toast(toastDelPlan(op, it.kind));
      window.setTimeout(() => router.refresh(), 400);
      return;
    }
    toast(toastDelPlan(op, it.kind), {
      // Por `decidir`: una a la vez también acá (dos escrituras del mismo reporte se pisan en el server).
      deshacer: () => { void decidir(it, 'deshacer'); },
    });
  };

  const filaPlan = (p: PlanItemM) => {
    const st = estadoDelPlan(p.status);
    return (
      <FilaM key={p.id} titulo={p.titulo}
        leading={<span className="m-icono"><MakoStar size={18} animate={false} /></span>}
        segunda={p.prio ? `${p.prio} · ${p.impacto}` : p.impacto}
        pill={st ? <PildoraM tono={st.tono}>{st.label}</PildoraM> : undefined}
        onClick={() => abrirItem(p.id)} />
    );
  };

  const exps = reporte?.plan.filter((p) => p.kind === 'exp') ?? [];
  const tareas = reporte?.plan.filter((p) => p.kind === 'tarea') ?? [];

  // ── La hoja de una recomendación ──
  const acciones = item ? accionesDelPlan(item.status) : 'ninguna';
  const estado = item ? estadoDelPlan(item.status) : null;
  const pieItem = !item ? undefined : motivos ? (
    <PieM>
      <Button variant="secondary" size="lg" full loading={ocupado === 'descartar'} disabled={!enLinea || ocupado != null}
        onClick={() => { void elegir(item, 'descartar'); }}>Descartar sin motivo</Button>
      <Button variant="tertiary" size="lg" full disabled={ocupado != null} onClick={() => setMotivos(false)}>Volver a la recomendación</Button>
    </PieM>
  ) : acciones === 'decidir' ? (
    <PieM consecuencia={item.kind === 'exp' ? 'Arranca el experimento y sus tareas van al Plan.' : 'La tarea va al Plan.'}>
      <Button variant="primary" size="lg" full loading={ocupado === 'aceptar'} disabled={!enLinea || ocupado != null}
        onClick={() => { void elegir(item, 'aceptar'); }}>{rotuloAceptar(item.kind)}</Button>
      <Button variant="secondary" size="lg" full loading={ocupado === 'posponer'} disabled={!enLinea || ocupado != null}
        onClick={() => { void elegir(item, 'posponer'); }}>{R.posponer}</Button>
      <Button variant="tertiary" size="lg" full disabled={!enLinea || ocupado != null} onClick={() => setMotivos(true)}>{R.descartar}</Button>
    </PieM>
  ) : acciones === 'deshacer' ? (
    <PieM>
      <Button variant="secondary" size="lg" full loading={ocupado === 'deshacer'} disabled={!enLinea || ocupado != null}
        onClick={() => { void decidir(item, 'deshacer'); }}>{R.deshacer}</Button>
    </PieM>
  ) : undefined;

  const cuerpoItem = !item ? null : motivos ? (
    <div className="m-experimentos-hoja">
      <h3 className="m-experimentos-hoja__titulo">{R.motivo}</h3>
      <ListaM etiqueta={R.motivo}>
        {MOTIVOS_DESCARTE.map((m) => (
          <FilaM key={m} titulo={m} navegacion chevron={false} deshabilitada={!enLinea || ocupado != null}
            onClick={() => { void elegir(item, 'descartar', m); }} />
        ))}
      </ListaM>
    </div>
  ) : (
    <div className="m-experimentos-hoja">
      <h3 className="m-experimentos-hoja__titulo m-experimentos-hoja__titulo--mako">
        <MakoStar size={16} animate={false} /><span>{item.titulo}</span>
      </h3>
      {item.origen && <p className="m-experimentos-meta">{item.origen}</p>}
      <p className="m-experimentos-hoja__texto">{item.why}</p>
      <ListaM>
        <FilaDatoM k="Impacto estimado" v={item.impacto} />
        {item.prio && <FilaDatoM k="Prioridad" v={item.prio} />}
        {estado && <FilaDatoM k="Estado" v={<PildoraM tono={estado.tono}>{estado.label}</PildoraM>} />}
      </ListaM>
      {item.chain.length > 0 && (
        <>
          <h4 className="m-experimentos-hoja__sub">{R.paraProbarlo}</h4>
          <ListaM>
            {item.chain.map((t, i) => <FilaM key={i} titulo={t} navegacion riel={R.planTodo} />)}
          </ListaM>
        </>
      )}
    </div>
  );

  // ── La hoja de un hallazgo ──
  const rec = hallazgo?.recId ? reporte?.plan.find((p) => p.id === hallazgo.recId) ?? null : null;

  return (
    <div className="m-experimentos-retro">
      <button type="button" className="m-experimentos-volver" onClick={onVolver}>
        <Icon name="chevron" size={18} />{R.todas}
      </button>
      <h2 className="m-experimentos-retro__titulo">{retro.titulo}</h2>
      <p className="m-experimentos-meta">{retro.periodo}</p>

      {!reporte ? (
        // Una Retro de antes del reporte v3 (escritorio la dibuja con su «formato anterior»).
        <p className="m-experimentos-resumen">{retro.resumen || '—'}</p>
      ) : (
        <>
          <div className="m-experimentos-retro__vistas">
            <SegmentadoM etiqueta="Vista de la Retro" valor={vista} onCambio={setVista} opciones={[...VISTAS_RETRO]} />
          </div>

          {vista === 'overview' ? (
            <>
              <TesisM texto={reporte.tesis.texto} highlight={reporte.tesis.highlight} rotulo={R.tesis} />
              {reporte.fuga && (
                <section className="m-experimentos-fuga">
                  <span className="m-experimentos-fuga__valor">{reporte.fuga.valor}<small>{reporte.fuga.unidad}</small></span>
                  <span className="m-experimentos-fuga__titulo">{reporte.fuga.titulo}</span>
                  <p className="m-experimentos-fuga__texto">{reporte.fuga.texto}</p>
                </section>
              )}
              <SeccionM titulo={R.hallazgos}>
                {reporte.hallazgos.length === 0 ? <VacioM frase="Sin hallazgos en esta Retro." /> : (
                  <ListaM>
                    {reporte.hallazgos.map((f) => (
                      <FilaM key={f.id} titulo={f.corto} segunda={`${f.tipoLabel} · ${f.herramienta}`}
                        leading={<span className="m-experimentos-punto" data-tono={f.tipo === 'cruce' ? 'info' : f.tipo === 'anomalia' ? 'warn' : f.salud} aria-hidden />}
                        onClick={() => { setHallazgo(f); setHallazgoAbierto(true); }} />
                    ))}
                  </ListaM>
                )}
              </SeccionM>
            </>
          ) : (
            <>
              <SeccionM titulo={R.planExps}>
                {exps.length > 0 ? <ListaM>{exps.map(filaPlan)}</ListaM> : <VacioM frase={R.sinExps} />}
              </SeccionM>
              <SeccionM titulo={R.planTodo}>
                {tareas.length > 0 ? <ListaM>{tareas.map(filaPlan)}</ListaM> : <VacioM frase={R.sinTareas} />}
              </SeccionM>
              {reporte.seguimiento.length > 0 && (
                <SeccionM titulo={R.seguimiento}>
                  <ListaM>
                    {reporte.seguimiento.map((s, i) => (
                      <FilaM key={i} titulo={s.title} segunda={s.estado} riel={s.fx}
                        leading={<span className="m-experimentos-punto" data-tono={s.st === 'done' ? 'good' : s.st === 'curso' ? 'warn' : 'gris'} aria-hidden />} />
                    ))}
                  </ListaM>
                </SeccionM>
              )}
            </>
          )}
        </>
      )}

      <ComputadoraM que={RETRO_EN_LA_COMPUTADORA} />

      <SheetM abierto={itemAbierto} onCerrar={() => setItemAbierto(false)}
        titulo={item?.kind === 'tarea' ? R.planTodo : R.planExp} id="recomendacion" snap="alto"
        ocupado={ocupado != null} rotuloCerrar="Volver a la Retro" pie={pieItem}>
        {cuerpoItem}
      </SheetM>

      <SheetM abierto={hallazgoAbierto} onCerrar={() => setHallazgoAbierto(false)}
        titulo={hallazgo ? `${hallazgo.tipoLabel} · ${hallazgo.herramienta}` : R.hallazgos} id="hallazgo" snap="alto"
        rotuloCerrar="Volver a la Retro"
        pie={rec ? (
          <PieM>
            <Button variant="secondary" size="lg" full onClick={() => { setHallazgoAbierto(false); setVista('plan'); abrirItem(rec.id); }}>
              Ver la recomendación
            </Button>
          </PieM>
        ) : undefined}>
        {hallazgo && (
          <div className="m-experimentos-hoja">
            <EvidenciaM ev={hallazgo.ev} />
            <p className="m-experimentos-hoja__frase m-experimentos-hoja__titulo--mako">
              <MakoStar size={16} animate={false} /><span>{hallazgo.insight}</span>
            </p>
            {hallazgo.fuente && <p className="m-experimentos-meta">Fuente: {hallazgo.fuente}</p>}
          </div>
        )}
      </SheetM>
    </div>
  );
}
