'use client';

// =============================================================================
// Media Buyer — Automatizaciones (/ads-manager/automatizaciones): con la densidad de «Hoy» (27/10/2026)
// =============================================================================
// Hasta el 27/10 era el «Automation Overview» de Madgicx con su hoja propia (mb.css): cinco contadores con emoji, barras por
// día, y por táctica un interruptor, su emoji, dos etiquetas, la frase de qué hace, catorce barritas, la última vez, el modo y
// un «⋯» con «Editar» e «Historial». Martín rechazó esa densidad en Hoy («Una cantidad de botones y texto impresionante»).
// Ahora, con el molde de Settings de la casa (los ajustes de Linear, app/_ui/Ajustes.tsx) dentro del marco del Media Buyer:
//   1. «Lo que hizo»: cuatro números (prendió, pausó, subió, bajó) en 7 o 30 días, como los números del mes de Campañas;
//   2. una FILA por táctica: el nombre, una línea gris con lo que cubre y la última vez, y a la derecha su estado con la flecha.
//      Toda la fila abre el detalle: el estado, los umbrales con el recomendado al lado, qué campañas cubre y lo último que hizo.
// `?t=<táctica>` (el lápiz del panel de agentes, la tuerca de una recomendación) abre ese detalle de entrada: hasta el 27/10 el
// link existía y la página no lo leía.
// Lo que se guarda manda SÓLO lo que se cambió: el servidor lo mezcla campo por campo (tacticas.ts → mezclarTacticas; falla 2
// de la verificación de tren-m). El plan sin piloto no deja ninguna automática (lib/media-buyer/store.ts → guardarConfig).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Button, Modal, Toast, useToast } from '@/app/_ui';
import { FilaAjustes, GrupoAjustes, TituloAjustes } from '@/app/_ui/Ajustes';
import { CtaPasarAPro } from '@/app/_components/CtaPasarAPro';
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
const ACCIONES = [
  { tipo: 'activar', nombre: 'Prendió' },
  { tipo: 'pausar', nombre: 'Pausó' },
  { tipo: 'subir_presupuesto', nombre: 'Subió presupuesto' },
  { tipo: 'bajar_presupuesto', nombre: 'Bajó presupuesto' },
] as const;
const NOMBRE_ESTADO: Record<EstadoTactica, string> = { apagada: 'Apagada', propone: 'Propone', automatica: 'Automática' };

export function Automatizaciones({ config: inicial, decisiones, cupo, abrir = null }: {
  config: Config; decisiones: Decision[]; cupo: CupoMediaBuyer;
  /** `?t=<táctica>`: abre su detalle de entrada. */
  abrir?: TacticaAuto | null;
}) {
  const [config, setConfig] = useState(inicial);
  const [dias, setDias] = useState<7 | 30>(7);
  const [editando, setEditando] = useState<TacticaAuto | null>(abrir);
  const [guardando, setGuardando] = useState(false);
  const { toast, show, clear } = useToast();

  const resueltas = useMemo(() => resolverTacticas(config.tacticas, { piloto: config.modo === 'piloto', pilotoPermitido: cupo.piloto }), [config.tacticas, config.modo, cupo.piloto]);
  // Lo hecho por las tácticas de MaKo (lanzado por el piloto o por una persona; los cambios a mano no cuentan).
  const hechas = useMemo(() => decisiones.filter((d) => d.tactica !== 'manual' && (d.estado === 'aplicada' || d.estado === 'deshecha') && d.aplicadaAt), [decisiones]);
  const desde = Date.now() - dias * DIA;
  const enVentana = hechas.filter((d) => Date.parse(d.aplicadaAt!) >= desde);

  const guardarTactica = useCallback(async (t: TacticaAuto, cambio: ConfigTactica): Promise<boolean> => {
    setGuardando(true);
    // Sólo lo que se tocó de la táctica: el servidor lo mezcla campo por campo con lo guardado (fallas 2 de tren-l y de tren-m).
    const tacticas: ConfigTacticas = { [t]: cambio };
    const r = await api<{ config: Config }>({ op: 'config', cambio: { tacticas } });
    setGuardando(false);
    if (r.ok) { setConfig((c) => ({ ...c, tacticas: r.config.tacticas })); show('Guardado', undefined, 'good'); return true; }
    show(r.error ?? 'No se pudo guardar.', undefined, 'bad');
    return false;
  }, [show]);

  const prendidas = ORDEN_TACTICAS.filter((t) => resueltas[t].estado !== 'apagada').length;
  return (
    <div className="aa">
      <div className="aa-ajustes">
        <TituloAjustes titulo="Automatizaciones" volver={{ href: '/ads-manager', label: 'Marketing CoPilot' }} />

        <GrupoAjustes titulo="Lo que hizo" accion={
          <span className="aa-seg" role="group" aria-label="Período">
            {([7, 30] as const).map((n) => <button key={n} type="button" aria-pressed={dias === n} onClick={() => setDias(n)}>{n} días</button>)}
          </span>
        }>
          <dl className="aa-cuenta" aria-label={`Lo que hizo en ${dias} días`}>
            {ACCIONES.map((a) => <div key={a.tipo}><dt>{a.nombre}</dt><dd>{enVentana.filter((d) => d.tipo === a.tipo).length}</dd></div>)}
          </dl>
        </GrupoAjustes>

        {/* El cupo del plan: al cliente de una agencia el piloto se lo habilita ELLA (6/11/2026, #494), no se le ofrece comprarlo. */}
        <GrupoAjustes titulo="Tácticas" descripcion={cupo.piloto ? `${prendidas} de ${ORDEN_TACTICAS.length} prendidas`
          : <>{cupo.recomendacionesDia != null ? textoCupo(cupo.recomendacionesDia) : 'Las automáticas son de MaKo Pro.'} <CtaPasarAPro><Link href={RUTA_CAMBIAR_PLAN} className="aa-link">Pasar a Pro</Link></CtaPasarAPro></>}>
          {ORDEN_TACTICAS.map((t) => {
            const r = resueltas[t];
            const ultima = decisiones.filter((d) => d.tactica === t).map((d) => d.creada).sort().pop() ?? null;
            const cubre = r.campanas ? `${r.campanas.size} ${r.campanas.size === 1 ? 'campaña' : 'campañas'}` : 'Toda la cuenta';
            return (
              <FilaAjustes key={t} titulo={TACTICAS[t].nombre} detalle={`${cubre} · ${ultima ? `última ${hace(ultima)}` : 'todavía nada'}`}
                valor={<span className="aa-estado-t" data-e={r.estado}>{NOMBRE_ESTADO[r.estado]}</span>} onClick={() => setEditando(t)} />
            );
          })}
        </GrupoAjustes>
      </div>

      {editando && (
        <EditarTactica key={editando} t={editando} actual={config.tacticas[editando] ?? {}} estado={resueltas[editando].estado} pilotoPermitido={cupo.piloto}
          historial={decisiones.filter((d) => d.tactica === editando)} guardando={guardando} puedeGuardar={config.existeTabla}
          onCerrar={() => setEditando(null)}
          onGuardar={async (c) => { if (await guardarTactica(editando, c)) setEditando(null); }} />
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

// ── El detalle de una táctica: su estado, sus condiciones con el valor recomendado al lado, qué cubre y lo último que hizo.
// Manda sólo lo que cambió (lo demás queda como lo guardó otro).

function EditarTactica({ t, actual, estado: estadoActual, pilotoPermitido, historial, guardando, puedeGuardar, onCerrar, onGuardar }: {
  t: TacticaAuto; actual: ConfigTactica; estado: EstadoTactica; pilotoPermitido: boolean; historial: Decision[]; guardando: boolean; puedeGuardar: boolean;
  onCerrar: () => void; onGuardar: (c: ConfigTactica) => void;
}) {
  const def = TACTICAS[t];
  const valorDe = (id: string) => String(actual.parametros?.[id] ?? def.parametros.find((p) => p.id === id)!.recomendado);
  const [estado, setEstado] = useState<EstadoTactica>(estadoActual);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(def.parametros.map((p) => [p.id, valorDe(p.id)])));
  const [cubre, setCubre] = useState<'todas' | 'elegidas'>(actual.campanas?.length ? 'elegidas' : 'todas');
  const [elegidas, setElegidas] = useState<Set<string>>(new Set(actual.campanas ?? []));
  const [campanas, setCampanas] = useState<Campana[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    if (cubre !== 'elegidas' || campanas) return;
    void api<{ campanas: Campana[] }>({ op: 'campanas' }).then((r) => {
      if (r.ok) setCampanas(r.campanas); else { setAviso(r.error ?? 'No pude leer la cuenta.'); setCampanas([]); }
    });
  }, [cubre, campanas]);
  const unidad = (u: string) => (u === 'veces' ? '×' : u === '%' ? '%' : u === 'días' ? 'días' : '');

  const cambio = (): ConfigTactica => {
    const c: ConfigTactica = {};
    if (estado !== estadoActual) c.estado = estado;
    const parametros: Record<string, number> = {};
    for (const p of def.parametros) {
      const n = Number(String(vals[p.id]).replace(',', '.'));
      if (Number.isFinite(n) && String(vals[p.id]) !== valorDe(p.id)) parametros[p.id] = n;
    }
    if (Object.keys(parametros).length) c.parametros = parametros;
    const nuevas = cubre === 'todas' ? null : [...elegidas].sort();
    const antes = actual.campanas?.length ? [...actual.campanas].sort() : null;
    if (JSON.stringify(nuevas) !== JSON.stringify(antes)) c.campanas = nuevas;
    return c;
  };
  const c = cambio();
  const nada = Object.keys(c).length === 0;

  return (
    <Modal titulo={def.nombre} encabezado={def.que} ancho={600} onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar}>Cerrar</Button>
        <Button loading={guardando} disabled={nada || !puedeGuardar || (cubre === 'elegidas' && elegidas.size === 0)} onClick={() => onGuardar(c)}>Guardar</Button></>}>
      <div className="aa aa-hoja aa-tactica">
        <div className="aa-hoja-fila">
          <span>Qué hace cuando se cumple</span>
          <span className="aa-seg" role="group" aria-label="Estado">
            {(['apagada', 'propone', 'automatica'] as const).map((e) => (
              <button key={e} type="button" aria-pressed={estado === e} disabled={e === 'automatica' && !pilotoPermitido && estadoActual !== 'automatica'}
                title={e === 'automatica' && !pilotoPermitido ? 'Es de MaKo Pro' : undefined} onClick={() => setEstado(e)}>{NOMBRE_ESTADO[e]}</button>
            ))}
          </span>
        </div>
        {def.parametros.map((p) => (
          <div key={p.id} className="aa-hoja-fila">
            <span>{p.nombre}</span>
            <span className="aa-campo">
              <input className="aj-en-linea" style={{ width: 84 }} inputMode="decimal" value={vals[p.id]} aria-label={p.nombre}
                onChange={(e) => setVals((v) => ({ ...v, [p.id]: e.target.value }))} />
              {unidad(p.unidad) && <span>{unidad(p.unidad)}</span>}
              {String(p.recomendado) !== vals[p.id] && (
                <button type="button" className="aa-link" title="El que usa MaKo si no lo cambias" onClick={() => setVals((v) => ({ ...v, [p.id]: String(p.recomendado) }))}>
                  Recomendado: {p.recomendado}
                </button>
              )}
            </span>
          </div>
        ))}
        <div className="aa-hoja-fila">
          <span>Qué cubre</span>
          <span className="aa-seg" role="group" aria-label="Qué cubre">
            <button type="button" aria-pressed={cubre === 'todas'} onClick={() => setCubre('todas')}>Toda la cuenta</button>
            <button type="button" aria-pressed={cubre === 'elegidas'} onClick={() => setCubre('elegidas')}>Algunas campañas</button>
          </span>
        </div>
        {cubre === 'elegidas' && (
          <div className="aa-campanas">
            {aviso && <p className="aa-act-vacia">{aviso}</p>}
            {!campanas && <p className="aa-act-vacia">Leyendo la cuenta…</p>}
            {campanas?.map((x) => (
              <label key={x.id} className="aa-var" data-on={elegidas.has(x.id) ? '1' : '0'}>
                <input type="checkbox" checked={elegidas.has(x.id)} onChange={() => setElegidas((s) => { const n = new Set(s); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; })} />
                <span><b>{x.nombre}</b><p>{x.prendida ? 'Activa' : 'Pausada'}</p></span>
              </label>
            ))}
          </div>
        )}
        <h3 className="aa-act-sec">Lo último</h3>
        {historial.length
          ? (
            <ul className="aa-act-lista">
              {historial.slice(0, 6).map((d) => (
                <li key={d.id}><b>{d.estado === 'aplicada' || d.estado === 'deshecha' ? queSeHizo(d) : d.titulo}</b><small>{ESTADO[d.estado]} · {hace(d.aplicadaAt ?? d.creada)}</small></li>
              ))}
            </ul>
          )
          : <p className="aa-act-vacia">Todavía no recomendó nada en 30 días.</p>}
      </div>
    </Modal>
  );
}

const ESTADO: Record<Decision['estado'], string> = {
  abierta: 'Abierta', aplicada: 'Hecha', descartada: 'Descartada', deshecha: 'Deshecha', fallida: 'No se pudo', vencida: 'Vencida', bloqueada: 'Frenada por un tope',
};
