'use client';

// =============================================================================
// Media Buyer — Automatizaciones (/ads-manager/automatizaciones): el «Automation Overview» de Madgicx, con los colores de MaKo
// =============================================================================
// Martín, 25/10/2026: «si quiero que tenga todas las funcionalidades». En Madgicx, al lado del AI Marketer viven las
// «Automation Tactics»: cada táctica se prende sola, con sus condiciones, sobre lo que uno elige, y una pantalla dice qué
// hicieron (docs/media-buyer/referencias/madgicx/automatizaciones-*.png). De arriba abajo, como ahí:
//   1. «Qué hicieron tus automatizaciones»: Prendió · Pausó · Subió presupuesto · Bajó presupuesto · Total, en 7 o 30 días,
//      y las acciones por día (automatizaciones-resumen.png);
//   2. la lista de tácticas: interruptor, la táctica, el modo (propone o automática), qué cubre, la frecuencia de los
//      últimos 14 días y la última vez (automatizaciones-lista.png), con «Editar» (umbrales con el recomendado al lado,
//      y qué campañas cubre: automatizaciones-condiciones.png, automatizaciones-aplica-a.png) e «Historial»
//      (automatizaciones-historial.png).
// Lo que NO se copia (dicho acá): elegir el evento de cada táctica (en MaKo es UNO por negocio: leads, agendas o ventas, y
// los dos últimos salen del CRM), el valor «dinámico» contra el promedio, y las reglas propias con Y/O (otra pieza).
// Las tácticas viven en lib/media-buyer/tacticas.ts; lo que se guarda pasa por la misma puerta que la tuerca (el plan sin
// piloto no deja ninguna automática).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Modal, RadioGroup, Switch, Toast, useToast } from '@/app/_ui';
import type { ConfigMediaBuyer, Decision } from '@/lib/media-buyer/tipos';
import type { CupoMediaBuyer } from '@/lib/media-buyer/plan';
import { textoCupo } from '@/lib/media-buyer/plan';
import { RUTA_CAMBIAR_PLAN } from '@/lib/topes-plan';
import { ORDEN_TACTICAS, TACTICAS, resolverTacticas, type ConfigTactica, type ConfigTacticas, type EstadoTactica, type TacticaAuto } from '@/lib/media-buyer/tacticas';
import { hace, queSeHizo } from './mb-modelo';

type Config = ConfigMediaBuyer & { ultimaCorrida: string | null; existeTabla: boolean };
type Campana = { id: string; nombre: string; prendida: boolean };

async function api<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))) as T & { ok: boolean; error?: string };
}

const DIA = 86_400_000;
const diaDe = (iso: string) => iso.slice(0, 10);
const ACCIONES = [
  { tipo: 'activar', nombre: 'Prendió', icono: '▶️' },
  { tipo: 'pausar', nombre: 'Pausó', icono: '⏸️' },
  { tipo: 'subir_presupuesto', nombre: 'Subió presupuesto', icono: '📈' },
  { tipo: 'bajar_presupuesto', nombre: 'Bajó presupuesto', icono: '📉' },
] as const;

export function Automatizaciones({ config: inicial, decisiones, cupo }: { config: Config; decisiones: Decision[]; cupo: CupoMediaBuyer }) {
  const [config, setConfig] = useState(inicial);
  const [dias, setDias] = useState<7 | 30>(7);
  const [editando, setEditando] = useState<TacticaAuto | null>(null);
  const [historial, setHistorial] = useState<TacticaAuto | null>(null);
  const [guardando, setGuardando] = useState<TacticaAuto | null>(null);
  const [menu, setMenu] = useState<TacticaAuto | null>(null);
  const { toast, show, clear } = useToast();

  const resueltas = useMemo(() => resolverTacticas(config.tacticas, { piloto: config.modo === 'piloto', pilotoPermitido: cupo.piloto }), [config.tacticas, config.modo, cupo.piloto]);
  // Lo hecho por las tácticas de MaKo (lo lanzado por el piloto o por una persona; las subidas a mano no cuentan).
  const hechas = useMemo(() => decisiones.filter((d) => d.tactica !== 'manual' && (d.estado === 'aplicada' || d.estado === 'deshecha') && d.aplicadaAt), [decisiones]);
  const desde = Date.now() - dias * DIA;
  const enVentana = hechas.filter((d) => Date.parse(d.aplicadaAt!) >= desde);
  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = dias - 1; i >= 0; i--) m.set(diaDe(new Date(Date.now() - i * DIA).toISOString()), 0);
    for (const d of enVentana) { const k = diaDe(d.aplicadaAt!); if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m];
  }, [enVentana, dias]);
  const maxDia = Math.max(1, ...porDia.map(([, n]) => n));

  const guardarTactica = useCallback(async (t: TacticaAuto, cambio: ConfigTactica): Promise<boolean> => {
    setGuardando(t);
    // Sólo la táctica tocada: el servidor la mezcla con lo guardado (revisión de tren-l, falla 2).
    const tacticas: ConfigTacticas = { [t]: { ...(config.tacticas[t] ?? {}), ...cambio } };
    const r = await api<{ config: Config }>({ op: 'config', cambio: { tacticas } });
    setGuardando(null);
    if (r.ok) { setConfig((c) => ({ ...c, tacticas: r.config.tacticas })); show('Guardado', undefined, 'good'); return true; }
    show(r.error ?? 'No se pudo guardar.', undefined, 'bad');
    return false;
  }, [config.tacticas, show]);

  return (
    <div className="mb">
      <div className="mb-arriba">
        <header className="mb-cab">
          <div className="mb-saludo">
            <Link href="/ads-manager" className="mba-volver">‹ Media Buyer</Link>
            <h1>Automatizaciones</h1>
            <p>Cada táctica de MaKo, prendida o apagada, con sus condiciones.</p>
          </div>
          <div className="mb-acciones">
            <span className="mb-kpi" role="group" aria-label="Período">
              {([7, 30] as const).map((n) => <button key={n} type="button" aria-pressed={dias === n} onClick={() => setDias(n)}>{n} días</button>)}
            </span>
          </div>
        </header>

        {/* ── 1. Qué hicieron (automatizaciones-resumen.png) ── */}
        <section className="mb-tarjeta mba-resumen">
          <h2>Qué hizo el Media Buyer <small>últimos {dias} días</small></h2>
          <div className="mba-contadores">
            {ACCIONES.map((a) => (
              <div key={a.tipo} className="mba-contador">
                <span aria-hidden>{a.icono}</span>
                <b>{enVentana.filter((d) => d.tipo === a.tipo).length}</b>
                <em>{a.nombre}</em>
              </div>
            ))}
            <div className="mba-contador" data-total="1"><span aria-hidden>Σ</span><b>{enVentana.length}</b><em>En total</em></div>
          </div>
          <div className="mba-barras" aria-label="Acciones por día">
            {porDia.map(([dia, n]) => <i key={dia} title={`${dia}: ${n}`} style={{ height: `${(n / maxDia) * 100}%` }} data-cero={n === 0 ? '1' : '0'} />)}
          </div>
        </section>
        <div className="mb-chips"><span className="mb-chip-tab" style={{ cursor: 'default' }}>Tácticas<span className="mb-chip-n">{ORDEN_TACTICAS.filter((t) => resueltas[t].estado !== 'apagada').length} de {ORDEN_TACTICAS.length}</span></span></div>
      </div>

      {/* ── 2. Las tácticas (automatizaciones-lista.png) ── */}
      <div className="mb-banda">
        {!cupo.piloto && (
          <p className="mb-cupo">{cupo.recomendacionesDia != null ? textoCupo(cupo.recomendacionesDia) : 'Las tácticas automáticas son de MaKo Pro.'}<Link href={RUTA_CAMBIAR_PLAN}>Pasar a Pro</Link></p>
        )}
        {ORDEN_TACTICAS.map((t) => {
          const def = TACTICAS[t];
          const r = resueltas[t];
          const suyas = hechas.filter((d) => d.tactica === t);
          const ultima = decisiones.filter((d) => d.tactica === t).map((d) => d.creada).sort().pop() ?? null;
          const frec = Array.from({ length: 14 }, (_, i) => { const k = diaDe(new Date(Date.now() - (13 - i) * DIA).toISOString()); return decisiones.filter((d) => d.tactica === t && diaDe(d.creada) === k).length; });
          const maxF = Math.max(1, ...frec);
          const prendida = r.estado !== 'apagada';
          return (
            <article key={t} className="mb-dec mba-tactica" data-apagada={prendida ? '0' : '1'}>
              <div className="mb-dec-fila" style={{ cursor: 'default' }}>
                <Switch checked={prendida} disabled={guardando === t || !config.existeTabla}
                  onChange={(v) => void guardarTactica(t, { estado: v ? (r.estado === 'apagada' ? 'propone' : r.estado) : 'apagada' })} />
                <span className="mb-baldosa" aria-hidden>{def.icono}</span>
                <div className="mb-dec-cuerpo">
                  <h3 className="mb-dec-titulo mba-titulo">{def.nombre}</h3>
                  <div className="mb-dec-meta">
                    <span className="mb-etq">{def.nivel}</span>
                    <span className="mb-etq">{r.campanas ? `${r.campanas.size} ${r.campanas.size === 1 ? 'campaña' : 'campañas'}` : 'Toda la cuenta'}</span>
                    <span className="mba-que">{def.que}</span>
                  </div>
                </div>
                <div className="mba-frec" aria-label="Recomendaciones de los últimos 14 días">
                  {frec.map((n, i) => <i key={i} style={{ height: `${Math.max(8, (n / maxF) * 100)}%` }} data-cero={n === 0 ? '1' : '0'} />)}
                </div>
                <div className="mba-ultima"><b>{suyas.length}</b><span>{ultima ? `última ${hace(ultima)}` : 'nunca'}</span></div>
                {/* Como en Madgicx: la fila dice el estado y lo demás va en el «⋯» (automatizaciones-lista.png). */}
                <span className="mb-etq mba-modo" data-modo={r.estado}>{r.estado === 'automatica' ? 'Automática' : r.estado === 'propone' ? 'Propone' : 'Apagada'}</span>
                <div className="mba-mas">
                  <button type="button" className="mb-tuerca" aria-label={`Más de ${def.nombre}`} aria-haspopup="menu" aria-expanded={menu === t}
                    onClick={() => setMenu((m) => (m === t ? null : t))}>⋯</button>
                  {menu === t && (
                    <div className="mb-menu mba-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => { setMenu(null); setEditando(t); }}>Editar</button>
                      <button type="button" role="menuitem" onClick={() => { setMenu(null); setHistorial(t); }}>Historial<i>{decisiones.filter((d) => d.tactica === t).length}</i></button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {editando && (
        <EditarTactica t={editando} actual={config.tacticas[editando] ?? {}} estado={resueltas[editando].estado} pilotoPermitido={cupo.piloto} guardando={guardando === editando}
          onCerrar={() => setEditando(null)}
          onGuardar={async (c) => { if (await guardarTactica(editando, c)) setEditando(null); }} />
      )}
      {historial && (
        <Modal titulo={`Historial de ${TACTICAS[historial].nombre}`} ancho={680} onCerrar={() => setHistorial(null)}
          pie={<Button variant="secondary" onClick={() => setHistorial(null)}>Cerrar</Button>}>
          {(() => {
            const ds = decisiones.filter((d) => d.tactica === historial);
            if (!ds.length) return <p className="mb-cupo">Todavía no recomendó nada en 30 días.</p>;
            return (
              <div className="mb-tabla">
                <table>
                  <thead><tr><th>Cuándo</th><th>Qué</th><th>Estado</th></tr></thead>
                  <tbody>{ds.map((d) => (
                    <tr key={d.id}>
                      <td>{hace(d.aplicadaAt ?? d.creada)}</td>
                      <td>{d.estado === 'aplicada' || d.estado === 'deshecha' ? queSeHizo(d) : d.titulo}</td>
                      <td>{ESTADO[d.estado]}{d.estado === 'aplicada' ? ` · ${d.origen === 'piloto' ? 'piloto automático' : d.aplicadaPor ?? 'tu equipo'}` : ''}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            );
          })()}
        </Modal>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

const ESTADO: Record<Decision['estado'], string> = {
  abierta: 'Abierta', aplicada: 'Hecha', descartada: 'Descartada', deshecha: 'Deshecha', fallida: 'No se pudo', vencida: 'Vencida', bloqueada: 'Frenada por un tope',
};

// ── Editar una táctica: sus condiciones con el valor recomendado al lado (automatizaciones-condiciones.png) y qué cubre
// (automatizaciones-aplica-a.png: toda la cuenta, o las campañas que se elijan).

function EditarTactica({ t, actual, estado: estadoActual, pilotoPermitido, guardando, onCerrar, onGuardar }: {
  t: TacticaAuto; actual: ConfigTactica; estado: EstadoTactica; pilotoPermitido: boolean; guardando: boolean;
  onCerrar: () => void; onGuardar: (c: ConfigTactica) => void;
}) {
  const def = TACTICAS[t];
  const [estado, setEstado] = useState<EstadoTactica>(estadoActual === 'apagada' ? 'propone' : estadoActual);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(def.parametros.map((p) => [p.id, String(actual.parametros?.[p.id] ?? p.recomendado)])));
  const [cubre, setCubre] = useState<'todas' | 'elegidas'>(actual.campanas?.length ? 'elegidas' : 'todas');
  const [elegidas, setElegidas] = useState<Set<string>>(new Set(actual.campanas ?? []));
  const [campanas, setCampanas] = useState<Campana[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    if (campanas) return;
    const r = await api<{ campanas: Campana[] }>({ op: 'campanas' });
    if (r.ok) setCampanas(r.campanas); else { setAviso(r.error ?? 'No pude leer la cuenta.'); setCampanas([]); }
  }, [campanas]);
  useEffect(() => { if (cubre === 'elegidas') void cargar(); }, [cubre, cargar]);
  const unidad = (u: string) => (u === 'veces' ? '×' : u === '%' ? '%' : u === 'días' ? 'días' : '');
  const guardar = () => {
    const parametros: Record<string, number> = {};
    for (const p of def.parametros) { const n = Number(String(vals[p.id]).replace(',', '.')); if (Number.isFinite(n)) parametros[p.id] = n; }
    onGuardar({ estado, parametros, campanas: cubre === 'todas' ? null : [...elegidas] });
  };
  return (
    <Modal titulo={`${def.icono} ${def.nombre}`} ancho={620} onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar}>Cancelar</Button><Button loading={guardando} disabled={cubre === 'elegidas' && elegidas.size === 0} onClick={guardar}>Guardar</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p style={{ margin: 0, color: 'var(--dim)' }}>{def.que}</p>
        <RadioGroup label="Qué hace cuando se cumple" value={estado} onChange={(v) => setEstado(v === 'automatica' && pilotoPermitido ? 'automatica' : 'propone')} options={[
          { value: 'propone', label: 'Propone', hint: 'Deja la recomendación y espera tu «Lanzar».' },
          { value: 'automatica', label: 'Automática', hint: pilotoPermitido ? 'La lanza sola, una vez por día, dentro de tus topes. Queda en «Hechas» con su «Deshacer».' : 'Es de MaKo Pro.' },
        ]} />
        <div className="mb-tabla">
          <table>
            <thead><tr><th>Condición</th><th>Valor</th><th>Recomendado</th></tr></thead>
            <tbody>{def.parametros.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td><span className="mb-editar" style={{ marginTop: 0 }}><input inputMode="decimal" value={vals[p.id]} aria-label={p.nombre} onChange={(e) => setVals((v) => ({ ...v, [p.id]: e.target.value }))} /><span>{unidad(p.unidad)}</span></span></td>
                <td><button type="button" className="mba-reco" onClick={() => setVals((v) => ({ ...v, [p.id]: String(p.recomendado) }))}>{p.recomendado}{unidad(p.unidad) ? ` ${unidad(p.unidad)}` : ''}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <RadioGroup label="Qué cubre" value={cubre} onChange={(v) => setCubre(v === 'elegidas' ? 'elegidas' : 'todas')} options={[
          { value: 'todas', label: 'Toda la cuenta', hint: 'Las campañas nuevas entran solas.' },
          { value: 'elegidas', label: 'Sólo las campañas que elija' },
        ]} />
        {cubre === 'elegidas' && (
          <div className="mba-campanas">
            {aviso && <p className="mb-cupo">{aviso}</p>}
            {!campanas && <p className="mb-cupo">Leyendo la cuenta…</p>}
            {campanas?.map((c) => (
              <label key={c.id} className="mb-var" data-on={elegidas.has(c.id) ? '1' : '0'}>
                <input type="checkbox" checked={elegidas.has(c.id)} onChange={() => setElegidas((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />
                <span className="mb-var-txt"><b>{c.nombre}</b><em>{c.prendida ? 'Activa' : 'Pausada'}</em></span>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
