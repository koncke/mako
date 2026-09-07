'use client';

// =============================================================================
// El tablero de KPIs — lo único verdaderamente nuevo de esta pantalla
// =============================================================================
// Todo lo demás de /general mide RESULTADOS: cierres, cash, cuotas vencidas,
// fatiga de creativo. Cosas que ya pasaron. Esta lista mide lo que se hace o no
// se hace en el período, que es lo único sobre lo que se puede actuar hoy.
//
// Tres reglas de la casa que gobiernan el render:
//
//  · Todo lo que va en una lista es `.mk-fila`, y su estado es `.mk-pill`. No se
//    inventa un tratamiento nuevo para algo que ya tiene anatomía.
//  · Adentro de una lista, la barra de progreso es el BORDE de la fila (2 px, a
//    ancho completo) o no existe. Una barra suelta al lado del texto deja el
//    hueco muerto que el rediseño vino a sacar.
//  · El COLOR NUNCA ES EL ÚNICO PORTADOR. Cada fila dice su estado con palabras
//    («atrasado», «sin datos») además del punto.
//
// ⚠️ Y la que más importa: un KPI en `sin-datos` se ve DISTINTO de uno en cero.
// «No pude leer la fuente» y «la fuente dice cero» son dos cosas, y confundirlas
// convierte un timeout de Meta en un reproche.
// =============================================================================

import { useState, useTransition } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Modal, Button, TextField, Select, Status, EmptyState, Checkbox } from '@/app/_ui';
import { TONO } from '@/app/_ui/tokens';
import { tonoDeSemaforo } from '@/lib/mako-gramatica';
import {
  SEMAFORO_DE_ESTADO, ESTADO_LABEL, CADENCIA_LABEL, FUENTES_KPI,
  type EstadoKpi, type Cadencia, type UnidadObjetivo,
} from '@/lib/objectives-modelo';
import { guardarKpiAction, apagarKpiAction, registrarKpiAction, sembrarKpisAction } from './actions';

/** Lo que la página serializa y baja. Nunca el catálogo entero: sólo lo que se pinta. */
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

const fmt = (n: number | null, unidad: UnidadObjetivo): string => {
  if (n === null) return '—';
  return unidad === 'usd' ? `US$${Math.round(n).toLocaleString('es-MX')}` : String(Math.round(n * 100) / 100);
};

export function KpisCard({ kpis, candidatos, objetivos, hoy, objetivoPrincipalId }: {
  kpis: KpiVista[];
  candidatos: CandidatoVista[];
  objetivos: Array<{ id: string; titulo: string }>;
  hoy: string;
  objetivoPrincipalId: string | null;
}) {
  const [editando, setEditando] = useState<KpiVista | 'nuevo' | null>(null);

  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 'var(--card-pad)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>KPIs</h2>
        {kpis.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setEditando('nuevo')}>Agregar KPI</Button>
        )}
      </div>

      {kpis.length === 0
        ? <Propuesta candidatos={candidatos} objetivoPrincipalId={objetivoPrincipalId} onManual={() => setEditando('nuevo')} />
        : (
          <div style={{ marginTop: 10 }}>
            {kpis.map((k) => <Fila key={k.id} k={k} hoy={hoy} onEditar={() => setEditando(k)} />)}
          </div>
        )}

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
// Una fila
// ─────────────────────────────────────────────────────────────────────────────

function Fila({ k, hoy, onEditar }: { k: KpiVista; hoy: string; onEditar: () => void }) {
  const router = useRouter();
  const [pendiente, arrancar] = useTransition();
  const [valor, setValor] = useState('');
  const tono = tonoDeSemaforo(SEMAFORO_DE_ESTADO[k.estado]);
  const t = TONO[tono];
  const sinDatos = k.estado === 'sin-datos';

  const registrar = () => {
    if (valor === '') return;
    arrancar(async () => {
      await registrarKpiAction(k.id, k.cadencia, hoy, Number(valor));
      setValor('');
      router.refresh();
    });
  };

  return (
    <div className="mk-fila" style={{ alignItems: 'center' }}>
      <span aria-hidden style={{ flex: 'none', width: 11, height: 11, borderRadius: '50%', background: t.fill, marginTop: 0 }} />

      <div className="mk-fila__txt">
        <div className="mk-fila__l1">
          <button type="button" onClick={onEditar}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
            <span className="mk-fila__t">{k.nombre}</span>
          </button>
          <Status tono={tono}>{ESTADO_LABEL[k.estado]}</Status>
        </div>
        <span className="mk-fila__c">
          {/* ⚠️ Un KPI sin datos NO muestra «0 de 7»: mostraría un incumplimiento
              que nadie midió. Dice qué pasó y, si es manual, qué falta hacer. */}
          {sinDatos
            ? (k.error ?? 'todavía no hay dato para este período')
            : `${fmt(k.valor, k.unidad)} de ${fmt(k.compromiso, k.unidad)} ${CADENCIA_LABEL[k.cadencia]}`}
        </span>
      </div>

      {k.fuente === 'manual' ? (
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number" min="0" inputMode="decimal" className="mk-input"
            value={valor} onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); registrar(); } }}
            placeholder={k.valor === null ? '—' : String(k.valor)}
            aria-label={`Registrar ${k.nombre}`}
            style={{ width: 84, textAlign: 'right' }}
          />
          <Button size="sm" variant="secondary" onClick={registrar} loading={pendiente} disabled={valor === ''}>
            Registrar
          </Button>
        </div>
      ) : (
        <span className="mk-fila__riel" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {sinDatos ? '—' : `${fmt(k.valor, k.unidad)} / ${fmt(k.compromiso, k.unidad)}`}
        </span>
      )}

      {/* La barra es el borde de la fila, nunca una barra suelta. Con `sin-datos`
          NO se dibuja: una barra en cero afirma un incumplimiento que no se midió. */}
      {!sinDatos && k.pct !== null && (
        <span className="mk-fila__barra" aria-hidden>
          <i style={{ width: `${Math.min(100, k.pct)}%`, background: t.fill }} />
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El arranque: MaKo propone
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ NUNCA UNA PANTALLA EN BLANCO. Es donde muere toda feature de objetivos: nadie
 * se sienta a inventar sus indicadores desde cero. MaKo propone leyendo el funnel
 * y la fase del negocio, y la persona destilda lo que no le sirve.
 *
 * Los nombres son lo único que viaja al server: los candidatos se vuelven a
 * resolver allá. Si el objeto entero viajara armado desde el navegador, cualquiera
 * podría sembrar un KPI con la fuente y el compromiso que quisiera.
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
        detalle="Un KPI es lo que mueve tu objetivo: algo que se hace cada día o cada semana y que se puede dar por cumplido."
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
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 4px', lineHeight: 1.5 }}>
        Estos salen de tu funnel y de la fase de tu negocio. Quita los que no te sirvan.
      </p>
      <div>
        {candidatos.map((c) => (
          <div key={c.nombre} className="mk-fila" style={{ alignItems: 'center' }}>
            {/* El NOMBRE es el label del checkbox, no un `<span>` al lado con un
                rótulo escondido: así el área clickeable ES el nombre, y el lector
                de pantalla anuncia qué se está tildando sin leer el texto dos veces. */}
            <div className="mk-fila__txt">
              <div className="mk-fila__l1">
                <Checkbox
                  checked={elegidos.has(c.nombre)}
                  onChange={() => toggle(c.nombre)}
                  label={<span className="mk-fila__t">{c.nombre}</span>}
                />
                <Status tono={c.fuente === 'auto' ? 'info' : 'neutral'}>
                  {c.fuente === 'auto' ? 'lo mide MaKo' : 'lo registras tú'}
                </Status>
              </div>
              <span className="mk-fila__c">{c.porque}</span>
            </div>
            <span className="mk-fila__riel">
              {fmt(c.compromiso, c.unidad)} {CADENCIA_LABEL[c.cadencia]}
            </span>
          </div>
        ))}
      </div>
      {error && <span className="mk-err" role="alert">{error}</span>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
        <Button onClick={sembrar} loading={pendiente} disabled={elegidos.size === 0}>
          Usar {elegidos.size === 1 ? 'este KPI' : `estos ${elegidos.size} KPIs`}
        </Button>
        <Button variant="tertiary" onClick={onManual} disabled={pendiente}>Prefiero escribir el mío</Button>
      </div>
      <p style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', margin: '10px 0 0' }}>
        Los compromisos son un punto de partida: se ajustan cuando quieras.
      </p>
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
          id: kpi?.id,
          objectiveId: objectiveId || null,
          nombre,
          cadencia,
          compromiso: Number(compromiso) || 0,
          unidad,
          fuente,
          fuenteId: fuente === 'auto' ? fuenteId : null,
          umbralVerde: kpi?.umbralVerde,
          umbralAmbar: kpi?.umbralAmbar,
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
      try {
        await apagarKpiAction(kpi.id);
        onCerrar();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
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
          <Button onClick={guardar} loading={pendiente} disabled={!nombre.trim()}>Guardar KPI</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
          placeholder="Contenido publicado" maxLength={60} />

        <Select label="Quién carga el número" value={fuente} onChange={setFuente}
          options={[
            { value: 'auto', label: 'MaKo lo mide solo' },
            { value: 'manual', label: 'Lo registro yo' },
          ]}
          hint={fuente === 'auto'
            ? 'Sale de los datos que ya están en la app. Si un día no puede leerlos, lo dice — no cuenta cero.'
            : 'Vas a poder cargarlo desde esta misma lista.'} />

        {fuente === 'auto' && (
          <Select label="De dónde lo saca" value={fuenteId} onChange={(v) => { setFuenteId(v); const d = FUENTES_KPI.find((f) => f.id === v); if (d) setUnidad(d.unidad); }}
            options={FUENTES_KPI.map((f) => ({ value: f.id, label: f.label }))}
            hint={def?.que} />
        )}

        {fuente === 'manual' && (
          <Select label="Unidad" value={unidad} onChange={setUnidad}
            options={[{ value: 'cantidad', label: 'Cantidad' }, { value: 'usd', label: 'Dólares' }]} />
        )}

        <Select label="Cada cuánto se cuenta" value={cadencia} onChange={setCadencia}
          options={[
            { value: 'diaria', label: 'Todos los días' },
            { value: 'semanal', label: 'Cada semana' },
          ]} />

        <TextField label={cadencia === 'diaria' ? 'Compromiso por día' : 'Compromiso por semana'}
          value={compromiso} onChange={(e) => setCompromiso(e.target.value)}
          type="number" min="0" inputMode="decimal"
          prefix={(fuente === 'auto' ? def?.unidad : unidad) === 'usd' ? 'US$' : undefined}
          hint="Es lo que tiene que pasar para que el KPI quede en verde." />

        {objetivos.length > 0 && (
          <Select label="A qué objetivo empuja" value={objectiveId} onChange={setObjectiveId}
            options={[{ value: '', label: 'A ninguno por ahora' }, ...objetivos.map((o) => ({ value: o.id, label: o.titulo }))]}
            hint="Sirve para que la pantalla pueda decir qué debería moverse si lo cumples." />
        )}

        {error && <span className="mk-err" role="alert">{error}</span>}
      </div>
    </Modal>
  );
}
