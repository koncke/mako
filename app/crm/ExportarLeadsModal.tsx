'use client';

// =============================================================================
// ExportarLeadsModal — bajarse los leads, de a UNA pregunta
// =============================================================================
// Antes preguntaba tres cosas (alcance / campos / formato) y el usuario tenía
// razón al quejarse: "en ningún momento me dejaste filtrar por etapas ni muchas
// otras cosas". Un CRM sin filtro de etapa, período, origen, persona y dinero no
// exporta lo que uno quiere; exporta todo y después hay que limpiarlo en Excel.
//
// El problema de agregar seis filtros es que el caso común se vuelve un
// interrogatorio. Por eso hay DOS caminos:
//   · Recetas ("mis clientes ganados", "lo que se perdió") → 2 clics y listo.
//   · "Lo armo yo" → los pasos aparecen SOLO si el usuario los pidió: primero se
//     elige qué acotar y eso decide qué se pregunta después (pasos condicionales).
//
// El contador del footer se recalcula en CADA paso: es la única forma de darse
// cuenta en el momento de que un filtro dejó afuera media base.
// =============================================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BAND_LABEL, type StageBand } from '@/lib/pipeline';
import { WizardShell } from '../_components/WizardShell';
import { descargar, nombreArchivo } from '../plan/board/exportar';
import { contarLeadsExportAction, exportLeadsAction, getOpcionesExportAction, type OpcionesExport } from './actions';
import {
  ACOTARES, BANDAS, CAMPOS_FECHA, CAMPOS_LEAD, CAMPOS_LEAD_HABITUALES, DINEROS,
  FILTROS_INICIALES, ORDENES, PERIODOS, RECETAS, SIN_ASIGNAR,
  filtrosDeReceta, slugAlcance,
  type CampoLead, type EtapaRef, type FiltrosLeads, type RecetaLeads,
} from './leads-exportar';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

const rotulo: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--faint)' };

/** Una opción clickeable: el mismo botón que usan todos los pasos de la app. */
function Opcion({ on, titulo, sub, onClick, multi = false, dot }: {
  on: boolean; titulo: string; sub?: string; onClick: () => void; multi?: boolean;
  /** Color del punto de la etapa: es como el usuario la reconoce en el Kanban. */
  dot?: string;
}) {
  return (
    <button type="button" onClick={onClick}
      style={{ width: '100%', padding: '12px 15px', borderRadius: 12, textAlign: 'left', fontFamily: SANS, display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', transition: 'border-color .12s, background .12s', border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface-2)', color: on ? 'var(--primary)' : 'var(--ink)' }}>
      <span style={{ width: 18, height: 18, flex: 'none', borderRadius: multi ? 6 : '50%', border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
      {dot && <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: dot }} />}
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: on ? 700 : 600 }}>{titulo}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );
}

/** Botón chico de lote (Todas / Ninguna). */
function Lote({ children, onClick, activo = false }: { children: ReactNode; onClick: () => void; activo?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      style={{ flex: 'none', padding: '7px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: activo ? 'var(--primary)' : 'var(--dim)', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
      {children}
    </button>
  );
}

type PasoId = 'receta' | 'banda' | 'etapas' | 'acotar' | 'periodo' | 'campoFecha' | 'origen' | 'persona' | 'dinero' | 'campos' | 'orden' | 'formato';

const PREGUNTAS: Record<PasoId, { q: string; sub?: string }> = {
  receta:     { q: '¿Qué necesitas?', sub: 'Elige un armado listo o constrúyelo tú.' },
  banda:      { q: '¿En qué parte del funnel?' },
  etapas:     { q: '¿Qué etapas?', sub: 'Las etapas reales de tu funnel, con cuántos leads tiene cada una hoy.' },
  acotar:     { q: '¿Quieres acotar más?', sub: 'Cada cosa que marques agrega una pregunta. Si no, seguimos.' },
  periodo:    { q: '¿De qué período?' },
  campoFecha: { q: '¿Qué fecha mira ese período?' },
  origen:     { q: '¿De qué origen?', sub: 'Los orígenes que existen de verdad en tu base.' },
  persona:    { q: '¿De quién son?', sub: 'Entra si es el closer o el setter del lead.' },
  dinero:     { q: '¿Filtramos por dinero?' },
  campos:     { q: '¿Qué datos lleva cada lead?', sub: 'El número y el nombre van siempre. Esto es lo demás.' },
  orden:      { q: '¿Cómo lo ordenamos?' },
  formato:    { q: '¿En qué formato?' },
};

const plural = (n: number, s: string, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function ExportarLeadsModal({ onClose }: { onClose: () => void }) {
  const [paso, setPaso] = useState(0);
  const [f, setF] = useState<FiltrosLeads>(FILTROS_INICIALES);
  const [opciones, setOpciones] = useState<OpcionesExport | null>(null);
  const [verAvanzado, setVerAvanzado] = useState(false);
  const [cuantos, setCuantos] = useState<number | null>(null);
  const [bajando, setBajando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (patch: Partial<FiltrosLeads>) => setF((p) => ({ ...p, ...patch }));

  const etapasRef = useMemo<EtapaRef[]>(
    () => (opciones?.etapas ?? []).map((e) => ({ key: e.key, label: e.label, band: e.band })),
    [opciones],
  );

  // Las etapas, los orígenes y el equipo salen de la base: preguntar con opciones
  // que en este CRM no existen es peor que no preguntar.
  useEffect(() => {
    let vivo = true;
    getOpcionesExportAction()
      .then((o) => {
        if (!vivo) return;
        setOpciones(o);
        // Las recetas ("lo que está vivo") se resuelven CONTRA el funnel real, así
        // que hay que re-aplicarlas cuando llegan las etapas.
        const refs = o.etapas.map((e) => ({ key: e.key, label: e.label, band: e.band }));
        setF((p) => (p.receta === 'custom' ? p : { ...p, ...filtrosDeReceta(p.receta, refs) }));
      })
      .catch(() => { if (vivo) setOpciones({ etapas: [], origenes: [], equipo: [], sinAsignar: 0 }); });
    return () => { vivo = false; };
  }, []);

  // Los pasos se arman según lo que el usuario pidió: una receta son dos pantallas,
  // y en "lo armo yo" solo aparecen las preguntas de lo que eligió acotar.
  const pasos = useMemo<PasoId[]>(() => {
    const p: PasoId[] = ['receta'];
    if (f.receta === 'custom') {
      p.push('banda');
      if (f.banda === 'elegir') p.push('etapas');
      p.push('acotar');
      if (f.acotar.includes('fecha')) p.push('periodo', 'campoFecha');
      if (f.acotar.includes('origen')) p.push('origen');
      if (f.acotar.includes('persona')) p.push('persona');
      if (f.acotar.includes('dinero')) p.push('dinero');
      p.push('campos', 'orden');
    }
    p.push('formato');
    return p;
  }, [f.receta, f.banda, f.acotar]);

  const idx = Math.min(paso, pasos.length - 1);
  const actual = pasos[idx];
  const enUltimo = idx >= pasos.length - 1;

  // El contador se recalcula en cada paso. Va con un respiro de 220ms porque en los
  // pasos multi-selección cada tilde dispararía una consulta a la base entera.
  // El ref se sincroniza en un efecto (no durante el render) y declarado ANTES del
  // que cuenta: los efectos de un componente corren en orden, así que cuando el de
  // abajo lee fRef.current ya tiene el filtro de este render.
  const fRef = useRef(f);
  useEffect(() => { fRef.current = f; });
  const claveConteo = JSON.stringify([f.banda, f.etapas, f.acotar, f.periodo, f.campoFecha, f.origenes, f.personas, f.dinero]);
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      if (!vivo) return;
      // El "contando…" recién aparece cuando la consulta arranca de verdad: si se
      // limpiara al tocar cada opción, el footer parpadearía en cada tilde.
      setCuantos(null);
      contarLeadsExportAction(fRef.current)
        .then((n) => { if (vivo) setCuantos(n); })
        .catch(() => { if (vivo) setCuantos(null); });
    }, 220);
    return () => { vivo = false; clearTimeout(t); };
  }, [claveConteo]);

  const elegirReceta = (id: RecetaLeads) => setF((p) => ({ ...p, receta: id, ...filtrosDeReceta(id, etapasRef) }));

  const bajar = () => {
    setBajando(true);
    setErr(null);
    exportLeadsAction(f)
      .then((contenido) => {
        const ext = f.formato === 'md' ? 'md' : 'csv';
        descargar(
          nombreArchivo('Leads', slugAlcance(f), ext, cuantos == null ? '' : `${cuantos} leads`),
          contenido,
          f.formato === 'md' ? 'text/markdown' : 'text/csv',
        );
        onClose();
      })
      .catch((e) => { setErr(e instanceof Error ? e.message : 'No se pudo exportar'); setBajando(false); });
  };

  // ── Cuerpo de cada paso ────────────────────────────────────────────────────

  const columna = (hijos: ReactNode) => <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{hijos}</div>;

  const pasoEtapas = () => {
    const etapas = opciones?.etapas ?? [];
    if (!etapas.length) return <div style={{ fontSize: 13, color: 'var(--faint)', fontFamily: SANS }}>Cargando las etapas de tu funnel…</div>;
    const todasOn = etapas.every((e) => f.etapas.includes(e.key));
    const bandas: StageBand[] = ['pipeline', 'nutricion', 'salidas'];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Lote activo={todasOn} onClick={() => set({ etapas: todasOn ? [] : etapas.map((e) => e.key) })}>{todasOn ? 'Ninguna' : 'Todas'}</Lote>
        </div>
        {bandas.map((band) => {
          const del = etapas.filter((e) => e.band === band);
          if (!del.length) return null;
          return (
            <div key={band} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ ...rotulo, textAlign: 'left' }}>{BAND_LABEL[band]}</span>
              {del.map((e) => (
                <Opcion key={e.key} multi dot={e.dot} on={f.etapas.includes(e.key)} titulo={e.label}
                  sub={plural(e.n, 'lead')} onClick={() => set({ etapas: toggle(f.etapas, e.key) })} />
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const pasoOrigen = () => {
    const origenes = opciones?.origenes ?? [];
    if (!origenes.length) return <div style={{ fontSize: 13, color: 'var(--faint)', fontFamily: SANS }}>Todavía no hay orígenes cargados en tus leads.</div>;
    const todosOn = origenes.every((o) => f.origenes.includes(o.valor));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Lote activo={todosOn} onClick={() => set({ origenes: todosOn ? [] : origenes.map((o) => o.valor) })}>{todosOn ? 'Ninguno' : 'Todos'}</Lote>
        </div>
        {origenes.map((o) => (
          <Opcion key={o.valor} multi on={f.origenes.includes(o.valor)} titulo={o.valor} sub={plural(o.n, 'lead')}
            onClick={() => set({ origenes: toggle(f.origenes, o.valor) })} />
        ))}
      </div>
    );
  };

  const pasoPersona = () => {
    const equipo = opciones?.equipo ?? [];
    return columna(
      <>
        {equipo.map((m) => (
          <Opcion key={m.email} multi on={f.personas.includes(m.nombre)} titulo={m.nombre} sub={m.email}
            onClick={() => set({ personas: toggle(f.personas, m.nombre) })} />
        ))}
        <Opcion multi on={f.personas.includes(SIN_ASIGNAR)} titulo="Sin asignar"
          sub={`${plural(opciones?.sinAsignar ?? 0, 'lead')} sin closer ni setter`}
          onClick={() => set({ personas: toggle(f.personas, SIN_ASIGNAR) })} />
        {!equipo.length && <div style={{ fontSize: 12.5, color: 'var(--faint)', fontFamily: SANS }}>No hay nadie más en el equipo de este workspace.</div>}
      </>,
    );
  };

  const pasoCampos = () => {
    const habituales = CAMPOS_LEAD.filter((c) => CAMPOS_LEAD_HABITUALES.includes(c.id));
    const resto = CAMPOS_LEAD.filter((c) => !CAMPOS_LEAD_HABITUALES.includes(c.id));
    const todosOn = CAMPOS_LEAD.every((c) => f.campos.includes(c.id));
    const toggleCampo = (c: CampoLead) => set({ campos: toggle(f.campos, c) });
    return columna(
      <>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Lote activo={todosOn} onClick={() => set({ campos: todosOn ? [] : CAMPOS_LEAD.map((c) => c.id) })}>{todosOn ? 'Ninguno' : 'Todos'}</Lote>
        </div>
        {habituales.map((c) => <Opcion key={c.id} multi on={f.campos.includes(c.id)} titulo={c.label} sub={c.sub} onClick={() => toggleCampo(c.id)} />)}
        <button type="button" onClick={() => setVerAvanzado((v) => !v)}
          style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'var(--dim)', fontFamily: MONO, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>
          {verAvanzado ? '▾ Avanzado' : `▸ Avanzado (${resto.length})`}
        </button>
        {verAvanzado && resto.map((c) => <Opcion key={c.id} multi on={f.campos.includes(c.id)} titulo={c.label} sub={c.sub} onClick={() => toggleCampo(c.id)} />)}
      </>,
    );
  };

  const cuerpo = () => {
    switch (actual) {
      case 'receta':
        return columna(RECETAS.map((r) => <Opcion key={r.id} on={f.receta === r.id} titulo={r.label} sub={r.sub} onClick={() => elegirReceta(r.id)} />));
      case 'banda':
        return columna(BANDAS.map((b) => <Opcion key={b.id} on={f.banda === b.id} titulo={b.label} sub={b.sub} onClick={() => set({ banda: b.id, ...(b.id === 'elegir' ? {} : { etapas: [] }) })} />));
      case 'etapas':
        return pasoEtapas();
      case 'acotar':
        return columna(
          <>
            <Opcion on={!f.acotar.length} titulo="No, así está bien" sub="me llevo todo lo que hay en esas etapas" onClick={() => set({ acotar: [] })} />
            {ACOTARES.map((a) => (
              <Opcion key={a.id} multi on={f.acotar.includes(a.id)} titulo={a.label} sub={a.sub}
                onClick={() => set({ acotar: toggle(f.acotar, a.id) })} />
            ))}
          </>,
        );
      case 'periodo':
        return columna(PERIODOS.map((p) => <Opcion key={p.id} on={f.periodo === p.id} titulo={p.label} sub={p.sub} onClick={() => set({ periodo: p.id })} />));
      case 'campoFecha':
        return columna(CAMPOS_FECHA.map((c) => <Opcion key={c.id} on={f.campoFecha === c.id} titulo={c.label} sub={c.sub} onClick={() => set({ campoFecha: c.id })} />));
      case 'origen':
        return pasoOrigen();
      case 'persona':
        return pasoPersona();
      case 'dinero':
        return columna(DINEROS.map((d) => <Opcion key={d.id} on={f.dinero === d.id} titulo={d.label} sub={d.sub} onClick={() => set({ dinero: d.id })} />));
      case 'campos':
        return pasoCampos();
      case 'orden':
        return columna(ORDENES.map((o) => <Opcion key={o.id} on={f.orden === o.id} titulo={o.label} sub={o.sub} onClick={() => set({ orden: o.id })} />));
      default:
        return columna(
          <>
            <Opcion on={f.formato === 'csv'} titulo="Planilla (CSV)" sub="para filtrar, ordenar y sumar en Excel o Sheets" onClick={() => set({ formato: 'csv' })} />
            <Opcion on={f.formato === 'md'} titulo="Documento (Markdown)" sub="una ficha por lead, agrupada por etapa, para leer o mandar por chat" onClick={() => set({ formato: 'md' })} />
          </>,
        );
    }
  };

  // Un paso que exige elegir algo no deja avanzar vacío: si no, el export sale con
  // cero leads y no se entiende por qué.
  const puedeAvanzar = (() => {
    if (actual === 'etapas') return f.etapas.length > 0;
    if (actual === 'origen') return f.origenes.length > 0;
    if (actual === 'persona') return f.personas.length > 0;
    if (enUltimo) return (cuantos ?? 0) > 0;
    return true;
  })();

  const resumen = cuantos == null ? 'contando…' : plural(cuantos, 'lead');
  const hayAlgo = (cuantos ?? 0) > 0;
  const { q, sub } = PREGUNTAS[actual];

  return (
    <WizardShell
      titulo={`Exportar leads · ${resumen}`}
      total={pasos.length} idx={idx}
      pregunta={q} sub={sub}
      error={err}
      pending={bajando}
      puedeAvanzar={puedeAvanzar}
      enUltimo={enUltimo}
      confirmLabel={hayAlgo ? `Descargar ${resumen} ↓` : 'No hay nada para bajar'}
      atrasLabel={idx === 0 ? 'Cancelar' : 'Atrás'}
      onAtras={() => (idx === 0 ? onClose() : setPaso(idx - 1))}
      onSiguiente={() => setPaso(Math.min(idx + 1, pasos.length - 1))}
      onConfirmar={() => { if (hayAlgo && !bajando) bajar(); }}
      onClose={onClose}
      extraFooter={<span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{resumen}</span>}
    >
      {cuerpo()}
    </WizardShell>
  );
}
