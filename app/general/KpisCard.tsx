'use client';

// =============================================================================
// El tablero de KPIs — una fila de barras, no una lista de párrafos
// =============================================================================
// ⚠️ ESTO SE REHIZO ENTERO EL 07/09/2026 Y CONVIENE SABER POR QUÉ, porque la
// primera versión parecía razonable y era ilegible.
//
// Era una lista: por cada KPI, el nombre + una pastilla «lo mide MaKo» + una
// frase explicando para qué sirve + el valor a la derecha. Ocho KPIs = ocho
// párrafos. El dueño lo vio y lo dijo así: *«está horrible, mucho texto… todo
// tiene que ser MUY gráfico… que de una pasada rápida ya se entienda»*.
//
// El test de la casa es literal y esa versión lo reprobaba: **si en UN SEGUNDO
// no se deduce qué pasa, la pantalla está mal.** Un segundo no alcanza para leer
// ocho frases, así que la respuesta tiene que estar en la FORMA.
//
// Ahora cada KPI es una BARRA llena hasta su % del compromiso, del color de su
// estado. Se ve cuál está en rojo sin leer una palabra. Lo que se fue, y no
// vuelve:
//   · la frase del «porque»  → es copy de la propuesta, no del tablero
//   · la pastilla por fila   → metadato del editor; en el tablero es ruido × 8
//   · el valor repetido      → el número ya está arriba de la barra
//
// ⚠️ Y la barra NO es decoración: es EL DATO. El veto de la casa contra
// «sparklines y anillos de progreso» aplica cuando el gráfico SUSTITUYE al
// contenido; acá el llenado ES el porcentaje del compromiso, que es exactamente
// lo que la fila tiene para decir.
// =============================================================================

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Modal, Button, TextField, Select, Status, EmptyState, Checkbox } from '@/app/_ui';
import { TONO } from '@/app/_ui/tokens';
import { tonoDeSemaforo } from '@/lib/mako-gramatica';
import {
  SEMAFORO_DE_ESTADO, ESTADO_LABEL, CADENCIA_LABEL, FUENTES_KPI,
  type EstadoKpi, type Cadencia, type UnidadObjetivo,
} from '@/lib/objectives-modelo';
import { guardarKpiAction, apagarKpiAction, registrarKpiAction, sembrarKpisAction } from './actions';

export type KpiVista = {
  id: string;
  nombre: string;
  cadencia: Cadencia;
  compromiso: number;
  unidad: UnidadObjetivo;
  fuente: 'auto' | 'manual';
  fuenteId: string | null;
  objectiveId: string | null;
  valor: number | null;
  error?: string;
  estado: EstadoKpi;
  pct: number | null;
  umbralVerde: number;
  umbralAmbar: number;
};

export type CandidatoVista = { nombre: string; porque: string; cadencia: Cadencia; compromiso: number; unidad: UnidadObjetivo; fuente: 'auto' | 'manual' };

/** Compacto a propósito: `US$2.0k` y no `US$2,000`. Adentro de una barra, cada carácter cuesta. */
const fmt = (n: number | null, unidad: UnidadObjetivo): string => {
  if (n === null) return '—';
  if (unidad === 'usd') {
    return n >= 1000 ? `US$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `US$${Math.round(n)}`;
  }
  return String(Math.round(n * 100) / 100);
};

const ALTO_BARRA = 132;

export function KpisCard({ kpis, candidatos, objetivos, objetivoPrincipalId }: {
  kpis: KpiVista[];
  candidatos: CandidatoVista[];
  objetivos: Array<{ id: string; titulo: string }>;
  objetivoPrincipalId: string | null;
}) {
  const [editando, setEditando] = useState<KpiVista | 'nuevo' | null>(null);

  if (kpis.length === 0) {
    return (
      <section>
        <Propuesta candidatos={candidatos} objetivoPrincipalId={objetivoPrincipalId} onManual={() => setEditando('nuevo')} />
        {editando && (
          <EditorKpi kpi={null} objetivos={objetivos} objetivoPrincipalId={objetivoPrincipalId} onCerrar={() => setEditando(null)} />
        )}
      </section>
    );
  }

  return (
    <section>
      {/* Sin tarjeta y sin subtítulo. La regla de la casa: las tarjetas son el
          contenedor perezoso, y el espacio en blanco separa igual de bien. */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 600, fontSize: 22, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)' }}>KPIs</h2>
        <button type="button" onClick={() => setEditando('nuevo')}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 13.5, color: 'var(--dim)', cursor: 'pointer' }}>
          + agregar
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, overflowX: 'auto' }} className="mk-scroll-x">
        {kpis.map((k) => <Barra key={k.id} k={k} onAbrir={() => setEditando(k)} />)}
      </div>

      {editando && (
        <EditorKpi
          kpi={editando === 'nuevo' ? null : editando}
          objetivos={objetivos}
          objetivoPrincipalId={objetivoPrincipalId}
          onCerrar={() => setEditando(null)}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Una barra
// ─────────────────────────────────────────────────────────────────────────────

function Barra({ k, onAbrir }: { k: KpiVista; onAbrir: () => void }) {
  const router = useRouter();
  const [pendiente, arrancar] = useTransition();
  const [editandoValor, setEditandoValor] = useState(false);
  const [valor, setValor] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const tono = tonoDeSemaforo(SEMAFORO_DE_ESTADO[k.estado]);
  const t = TONO[tono];
  const sinDatos = k.estado === 'sin-datos';
  const alto = sinDatos ? 0 : Math.max(3, Math.round(((k.pct ?? 0) / 100) * ALTO_BARRA));

  useEffect(() => { if (editandoValor) inputRef.current?.focus(); }, [editandoValor]);

  const registrar = () => {
    if (valor === '') { setEditandoValor(false); return; }
    arrancar(async () => {
      await registrarKpiAction(k.id, k.cadencia, Number(valor));
      setValor(''); setEditandoValor(false);
      router.refresh();
    });
  };

  // El número de un KPI manual se edita EN EL LUGAR: un click y ya se escribe.
  // Registrar es la acción de todos los días, así que mandarla a un modal sería
  // ponerle un paso al camino más recorrido.
  const editable = k.fuente === 'manual';

  return (
    <div style={{ flex: '1 1 0', minWidth: 78, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {editandoValor ? (
        <input
          ref={inputRef}
          type="number" min="0" inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={registrar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); registrar(); }
            if (e.key === 'Escape') { setValor(''); setEditandoValor(false); }
          }}
          aria-label={`Registrar ${k.nombre}`}
          style={{
            width: '100%', textAlign: 'center', fontSize: 15, fontWeight: 600,
            border: `1px solid ${t.fill}`, borderRadius: 7, padding: '2px 0',
            background: 'var(--surface)', color: 'var(--ink)', outline: 'none',
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => (editable ? setEditandoValor(true) : onAbrir())}
          title={editable ? 'Toca para registrar' : k.nombre}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
            fontSize: 15, fontWeight: 600, color: sinDatos ? 'var(--faint)' : 'var(--ink)',
            fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
          }}
        >
          {sinDatos ? '—' : fmt(k.valor, k.unidad)}
        </button>
      )}

      {/* El carril. `overflow: hidden` no es prolijidad: un valor por encima del
          compromiso llenaría más del 100% y desbordaría la caja — este repo ya
          pagó una barra de 1468% que se llevó el ancho de la página entera. */}
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`${k.nombre}: ${sinDatos ? 'sin datos' : `${Math.round(k.pct ?? 0)}% de ${fmt(k.compromiso, k.unidad)}`}`}
        style={{
          width: '100%', height: ALTO_BARRA, padding: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'flex-end',
          background: 'var(--surface-2)', borderRadius: 10, overflow: 'hidden',
          // Sin datos NO se pinta relleno: una barra en cero afirma un
          // incumplimiento que nadie midió. Se marca con el borde punteado, que
          // se lee como «acá falta algo», no como «esto salió mal».
          border: sinDatos ? '1px dashed var(--border-strong)' : '1px solid transparent',
        }}
      >
        {!sinDatos && (
          <span style={{
            display: 'block', width: '100%', height: alto,
            background: t.fill, borderRadius: 9,
            transition: 'height .35s ease-out',
          }} />
        )}
      </button>

      {/* El nombre, y NADA más. Dos renglones como techo: un tercero descuadra la
          fila entera y ningún nombre de KPI necesita tres. */}
      <span style={{
        fontSize: 11.5, lineHeight: 1.3, color: 'var(--dim)', textAlign: 'center',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {k.nombre}
      </span>
      {pendiente && <span style={{ fontSize: 10, color: 'var(--faint)' }}>guardando…</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El arranque: MaKo propone
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ ES UN PASO APARTE, NO EL TABLERO — y confundirlos fue la mitad del problema
 * de la primera versión. Esto es una DECISIÓN de ocho ítems; el tablero es una
 * lectura. Mezclarlos daba una pantalla que no era ninguna de las dos.
 *
 * Igual acá el texto se recortó: los nombres se entienden solos («Cierres»,
 * «Reuniones agendadas») y ocho justificaciones apiladas son el muro que el dueño
 * marcó. El porqué de cada uno queda en el `title`, para quien lo busque.
 */
function Propuesta({ candidatos, objetivoPrincipalId, onManual }: {
  candidatos: CandidatoVista[];
  objetivoPrincipalId: string | null;
  onManual: () => void;
}) {
  const router = useRouter();
  const [elegidos, setElegidos] = useState<Set<string>>(new Set(candidatos.map((c) => c.nombre)));
  const [pendiente, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (candidatos.length === 0) {
    return (
      <EmptyState
        titulo="Todavía no hay KPIs"
        detalle="Un KPI es lo que mueve tu objetivo: algo que se hace cada semana y se puede dar por cumplido."
        accion={{ label: 'Crear el primero', onClick: onManual }}
      />
    );
  }

  const sembrar = () => {
    setError(null);
    arrancar(async () => {
      try {
        await sembrarKpisAction([...elegidos], objetivoPrincipalId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const toggle = (nombre: string) => {
    setElegidos((prev) => {
      const s = new Set(prev);
      if (s.has(nombre)) s.delete(nombre); else s.add(nombre);
      return s;
    });
  };

  return (
    <div>
      <h2 style={{ fontWeight: 600, fontSize: 22, letterSpacing: '-0.02em', margin: '0 0 18px', color: 'var(--ink)' }}>
        Elige los KPIs que vas a seguir
      </h2>

      {/* Fichas, no renglones de prosa. Cada una: nombre + compromiso, nada más. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 10 }}>
        {candidatos.map((c) => {
          const on = elegidos.has(c.nombre);
          return (
            <label key={c.nombre} title={c.porque}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer',
                padding: '13px 15px', borderRadius: 12,
                border: `1px solid ${on ? 'var(--primary-weak)' : 'var(--border)'}`,
                background: on ? 'var(--primary-bg)' : 'var(--surface)',
              }}>
              <Checkbox checked={on} onChange={() => toggle(c.nombre)} label={
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{c.nombre}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(c.compromiso, c.unidad)} {CADENCIA_LABEL[c.cadencia]}
                  </span>
                </span>
              } />
            </label>
          );
        })}
      </div>

      {error && <span className="mk-err" role="alert">{error}</span>}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 20, flexWrap: 'wrap' }}>
        <Button onClick={sembrar} loading={pendiente} disabled={elegidos.size === 0}>
          Usar {elegidos.size === 1 ? 'este KPI' : `estos ${elegidos.size}`}
        </Button>
        <button type="button" onClick={onManual} disabled={pendiente}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 13.5, color: 'var(--dim)', cursor: 'pointer' }}>
          Escribir el mío
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El editor
// ─────────────────────────────────────────────────────────────────────────────

function EditorKpi({ kpi, objetivos, objetivoPrincipalId, onCerrar }: {
  kpi: KpiVista | null;
  objetivos: Array<{ id: string; titulo: string }>;
  objetivoPrincipalId: string | null;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pendiente, arrancar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState(kpi?.nombre ?? '');
  const [cadencia, setCadencia] = useState<string>(kpi?.cadencia ?? 'semanal');
  const [compromiso, setCompromiso] = useState(kpi ? String(kpi.compromiso) : '');
  const [fuente, setFuente] = useState<string>(kpi?.fuente ?? 'manual');
  const [fuenteId, setFuenteId] = useState<string>(kpi?.fuenteId ?? FUENTES_KPI[0].id);
  const [objectiveId, setObjectiveId] = useState<string>(kpi?.objectiveId ?? objetivoPrincipalId ?? '');
  const [unidad, setUnidad] = useState<string>(kpi?.unidad ?? 'cantidad');

  const def = FUENTES_KPI.find((f) => f.id === fuenteId);

  const guardar = () => {
    setError(null);
    arrancar(async () => {
      try {
        await guardarKpiAction({
          id: kpi?.id, objectiveId: objectiveId || null, nombre, cadencia,
          compromiso: Number(compromiso) || 0, unidad, fuente,
          fuenteId: fuente === 'auto' ? fuenteId : null,
          umbralVerde: kpi?.umbralVerde, umbralAmbar: kpi?.umbralAmbar,
        });
        onCerrar();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const apagar = () => {
    if (!kpi) return;
    arrancar(async () => {
      try { await apagarKpiAction(kpi.id); onCerrar(); router.refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    });
  };

  return (
    <Modal
      titulo={kpi ? kpi.nombre : 'Nuevo KPI'}
      onCerrar={onCerrar}
      pie={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}>
          {kpi && <Button variant="tertiary" onClick={apagar} disabled={pendiente}>Dejar de seguirlo</Button>}
          <span style={{ flex: 1 }} />
          <Button variant="secondary" onClick={onCerrar} disabled={pendiente}>No guardar</Button>
          <Button onClick={guardar} loading={pendiente} disabled={!nombre.trim()}>Guardar</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* El estado de hoy, arriba y como dato: es lo primero que alguien quiere
            saber al abrir un KPI, y en el tablero la barra no lleva números finos. */}
        {kpi && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {kpi.valor === null ? '—' : fmt(kpi.valor, kpi.unidad)}
            </span>
            <span style={{ fontSize: 14, color: 'var(--dim)' }}>de {fmt(kpi.compromiso, kpi.unidad)} {CADENCIA_LABEL[kpi.cadencia]}</span>
            <Status tono={tonoDeSemaforo(SEMAFORO_DE_ESTADO[kpi.estado])}>{ESTADO_LABEL[kpi.estado]}</Status>
            {kpi.error && <span style={{ fontSize: 13, color: 'var(--faint)', width: '100%' }}>{kpi.error}</span>}
          </div>
        )}

        <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
          placeholder="Contenido publicado" maxLength={60} />

        <Select label="Quién carga el número" value={fuente} onChange={setFuente}
          options={[{ value: 'auto', label: 'MaKo lo mide solo' }, { value: 'manual', label: 'Lo registro yo' }]}
          hint={fuente === 'auto'
            ? 'Si un día no puede leerlo, lo dice — no cuenta cero.'
            : 'Lo cargas tocando el número en el tablero.'} />

        {fuente === 'auto' && (
          <Select label="De dónde lo saca" value={fuenteId}
            onChange={(v) => { setFuenteId(v); const d = FUENTES_KPI.find((f) => f.id === v); if (d) setUnidad(d.unidad); }}
            options={FUENTES_KPI.map((f) => ({ value: f.id, label: f.label }))} hint={def?.que} />
        )}

        {fuente === 'manual' && (
          <Select label="Unidad" value={unidad} onChange={setUnidad}
            options={[{ value: 'cantidad', label: 'Cantidad' }, { value: 'usd', label: 'Dólares' }]} />
        )}

        <Select label="Cada cuánto se cuenta" value={cadencia} onChange={setCadencia}
          options={[{ value: 'diaria', label: 'Todos los días' }, { value: 'semanal', label: 'Cada semana' }]} />

        <TextField label={cadencia === 'diaria' ? 'Compromiso por día' : 'Compromiso por semana'}
          value={compromiso} onChange={(e) => setCompromiso(e.target.value)}
          type="number" min="0" inputMode="decimal"
          prefix={(fuente === 'auto' ? def?.unidad : unidad) === 'usd' ? 'US$' : undefined} />

        {objetivos.length > 0 && (
          <Select label="A qué objetivo empuja" value={objectiveId} onChange={setObjectiveId}
            options={[{ value: '', label: 'A ninguno por ahora' }, ...objetivos.map((o) => ({ value: o.id, label: o.titulo }))]} />
        )}

        {error && <span className="mk-err" role="alert">{error}</span>}
      </div>
    </Modal>
  );
}
