'use client';

// =============================================================================
// Media Buyer — la pantalla (/ads-manager), copiada de Madgicx · AI Marketer (25/10/2026)
// =============================================================================
// Martín, 25/10/2026: «Quiero que sea una app de IA, como un media buyer de MaKo… copia también el diseño de esa app de
// referencia, el diseño y la funcionalidad». La referencia y qué se copió de cada pantalla: docs/media-buyer/referencia.md
// (capturas en docs/media-buyer/referencias/madgicx/). De arriba abajo, como en Madgicx:
//   1. el saludo con la mascota y el número de decisiones, «Actualizado hace…», y a la derecha el piloto, ⚙ y «Pedirle
//      más a MaKo» (el «Ask AI Marketer to Do More»);
//   2. dos tarjetas: «Lo que hizo MaKo» con la actividad y el % en piloto automático, y «Metas del mes»;
//   3. las pestañas Abiertas · Hechas · Descartadas;
//   4. la fila de cada decisión (baldosa, título, «MaKo» + etiquetas, 🗑 y «Lanzar») que se abre en el detalle de tres
//      columnas (el porqué · los números · lo que cambia) con su pie.
// Lo que escribe va a /api/media-buyer; lo que decide y lanza, a lib/media-buyer/*.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, EmptyState, IconButton, Modal, RadioGroup, Select, Switch, TextField, Toast, useToast } from '@/app/_ui';
import { Criatura } from '@/app/_components/Criatura';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import type { ConfigMediaBuyer, Decision, KpiMediaBuyer, MetasDelMes } from '@/lib/media-buyer/tipos';
import {
  ICONO_TIPO, NIVEL, NOMBRE_TACTICA, hace, monto, pestanaDe, porcentajeAutomatico, queSeHizo, saludo, tonoDe, verboLanzar,
  type Pestana,
} from './mb-modelo';

type Config = ConfigMediaBuyer & { ultimaCorrida: string | null; ultimaCorridaInfo: Record<string, unknown> | null; existeTabla: boolean };
type EstadoZernio = { tieneClave: boolean; cuenta: string | null; conectado: boolean };

const NOMBRE_KPI: Record<KpiMediaBuyer, { varios: string; costo: string }> = {
  lead: { varios: 'Leads', costo: 'Costo por lead' },
  agenda: { varios: 'Agendas', costo: 'Costo por agenda' },
  venta: { varios: 'Ventas', costo: 'Costo por venta' },
};

async function api<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }));
  return j as T & { ok: boolean; error?: string };
}

export function MediaBuyer({ nombre, inicial, metas, tieneMeta }: {
  nombre: string;
  inicial: { config: Config; decisiones: Decision[]; existeTabla: boolean };
  metas: MetasDelMes | null;
  tieneMeta: boolean;
}) {
  const [config, setConfig] = useState<Config>(inicial.config);
  const [decisiones, setDecisiones] = useState<Decision[]>(inicial.decisiones);
  const [pestana, setPestana] = useState<Pestana>('abiertas');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [confirmarPiloto, setConfirmarPiloto] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [zernio, setZernio] = useState<EstadoZernio | null>(null);
  const [pedidoMako, setPedidoMako] = useState<{ texto: string; vez: number } | null>(null);
  const { toast, show, clear } = useToast();
  const [hora, setHora] = useState(12);
  useEffect(() => { setHora(new Date().getHours()); }, []);

  const recargar = useCallback(async () => {
    const r = await fetch('/api/media-buyer', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { setConfig(r.config); setDecisiones(r.decisiones); }
  }, []);
  const leerZernio = useCallback(async () => {
    const r = await api<EstadoZernio>({ op: 'estado_zernio' });
    if (r.ok) setZernio({ tieneClave: r.tieneClave, cuenta: r.cuenta, conectado: r.conectado });
  }, []);
  useEffect(() => { void leerZernio(); }, [leerZernio]);

  const porPestana = useMemo(() => {
    const g: Record<Pestana, Decision[]> = { abiertas: [], hechas: [], descartadas: [] };
    for (const d of decisiones) g[pestanaDe(d.estado)].push(d);
    return g;
  }, [decisiones]);
  const aplicadas = useMemo(() => decisiones.filter((d) => d.estado === 'aplicada' || d.estado === 'deshecha')
    .sort((a, b) => ((b.aplicadaAt ?? '') < (a.aplicadaAt ?? '') ? -1 : 1)), [decisiones]);
  const automatico = porcentajeAutomatico(decisiones);
  const nAbiertas = porPestana.abiertas.length;

  const accion = useCallback(async (d: Decision, body: Record<string, unknown>, ok: string) => {
    setOcupada(d.id);
    const r = await api<{ ajuste?: string | null }>({ ...body, id: d.id });
    setOcupada(null);
    if (r.ok) show(r.ajuste ? `${ok}. ${r.ajuste}` : ok, undefined, r.ajuste ? 'warn' : 'good');
    else show(r.error ?? 'No se pudo.', undefined, 'bad');
    await recargar();
    return r.ok;
  }, [recargar, show]);

  const guardarConfig = useCallback(async (cambio: Partial<ConfigMediaBuyer>): Promise<boolean> => {
    const r = await api<{ config: Config }>({ op: 'config', cambio });
    if (r.ok) { setConfig(r.config); return true; }
    show(r.error ?? 'No se pudo guardar.', undefined, 'bad');
    return false;
  }, [show]);

  const analizar = useCallback(async () => {
    setAnalizando(true);
    const r = await api<{ resumen?: { nuevas?: number; lanzadas?: number } }>({ op: 'analizar' });
    setAnalizando(false);
    if (r.ok) {
      const n = r.resumen?.nuevas ?? 0;
      show(n ? `${n} ${n === 1 ? 'decisión nueva' : 'decisiones nuevas'}` : 'Sin decisiones nuevas', undefined, 'good');
    } else show(r.error ?? 'MaKo no pudo leer la cuenta.', undefined, 'bad');
    await recargar();
  }, [recargar, show]);

  const piloto = config.modo === 'piloto';
  const kpi = NOMBRE_KPI[config.kpi];
  const actualizado = config.ultimaCorrida ? `Actualizado ${hace(config.ultimaCorrida)}` : 'Todavía no miró tu cuenta';

  // Lo que MaKo (el chat) ve de esta pantalla: las decisiones abiertas, en texto.
  const pantalla = useMemo(() => [
    `Media Buyer · modo ${piloto ? 'piloto automático' : 'propone y apruebo'} · ${config.encendido ? 'encendido' : 'apagado'}`,
    ...porPestana.abiertas.slice(0, 12).map((d) => `- ${d.titulo} (${NOMBRE_TACTICA[d.tactica]}): ${d.titular}`),
  ].join('\n'), [config.encendido, piloto, porPestana.abiertas]);

  return (
    <div className="mb">
      {/* ── 1. La cabecera ── */}
      <header className="mb-cab">
        <div className="mb-mascota" aria-hidden><Criatura nombre="MaKo" size={46} estrella /></div>
        <div className="mb-saludo">
          <h1>{saludo(hora)}, {nombre}: <b>{nAbiertas}</b> {nAbiertas === 1 ? 'decisión' : 'decisiones'} para ti.</h1>
          <p>{actualizado}</p>
        </div>
        <div className="mb-acciones">
          <label className="mb-piloto" data-on={piloto ? '1' : '0'} title="Con el piloto automático, MaKo lanza sus decisiones solo, dentro de tus topes">
            <Switch checked={piloto} disabled={!config.existeTabla} onChange={(v) => { if (v) setConfirmarPiloto(true); else void guardarConfig({ modo: 'propone' }); }} />
            Piloto automático
          </label>
          <IconButton title="Ajustes del Media Buyer" onClick={() => setAjustes(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </IconButton>
          <Button variant="secondary" onClick={() => setPidiendo(true)}>Pedirle más a MaKo</Button>
        </div>
      </header>

      {/* Lo que frena todo, arriba (una cinta por motivo) */}
      <div className="mb-avisos">
        {!config.existeTabla && <Alert tono="warn">El registro de decisiones todavía no está instalado: MaKo no lanza nada hasta que esté.</Alert>}
        {config.existeTabla && !config.encendido && config.ultimaCorrida && (
          <Alert tono="bad" accion={{ label: 'Prender', onClick: () => void guardarConfig({ encendido: true }) }}>El Media Buyer está apagado: no analiza ni lanza nada.</Alert>
        )}
        {zernio && !zernio.conectado && (
          <Alert tono="info">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {tieneMeta ? 'Para crear anuncios nuevos, conecta tu cuenta publicitaria por Zernio.' : 'Conecta tu cuenta publicitaria para que MaKo la pueda operar.'}
              <ConectarViaZernio red="metaads" volver="/ads-manager" adAccountId={zernio.cuenta} size="sm" onConectado={() => { void leerZernio(); void recargar(); }}>Conectar con Facebook</ConectarViaZernio>
            </span>
          </Alert>
        )}
      </div>

      {config.existeTabla && !config.encendido && !config.ultimaCorrida && (
        <Arranque tieneMeta={tieneMeta} zernio={zernio} kpi={config.kpi}
          onZernio={() => { void leerZernio(); }}
          onPrender={async (kpiElegido) => {
            if (await guardarConfig({ kpi: kpiElegido })) {
              if (await guardarConfig({ encendido: true, modo: 'propone' })) void analizar();
            }
          }} />
      )}

      {/* ── 2. Las dos tarjetas ── */}
      <section className="mb-tarjetas">
        <div className="mb-tarjeta">
          <h2>Lo que hizo MaKo <small>{aplicadas.length} {aplicadas.length === 1 ? 'cambio' : 'cambios'} en 30 días</small></h2>
          <div className="mb-actividad">
            {aplicadas.length === 0 && <div className="mb-vacio-act">Todavía no lanzó nada.</div>}
            {aplicadas.slice(0, 20).map((d) => {
              const esPiloto = d.origen === 'piloto';
              const quien = esPiloto ? 'Piloto automático' : (d.aplicadaPor ?? 'Alguien del equipo');
              return (
                <div className="mb-act" key={d.id}>
                  <span className="mb-act-av" data-piloto={esPiloto ? '1' : '0'} aria-hidden>
                    {esPiloto ? <Criatura nombre="MaKo" size={22} estrella /> : quien.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div className="mb-act-txt">
                    <b>{quien}{d.estado === 'deshecha' ? ' · deshecho' : ''}</b>
                    <span>{queSeHizo(d)} · {hace(d.aplicadaAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mb-auto">
            <span className="mb-auto-ic" aria-hidden>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 4.8L20 8l-4 4 1 6-5-2.7L7 18l1-6-4-4 5.6-1.2z" /></svg>
            </span>
            <div className="mb-auto-cuerpo">
              <div className="mb-auto-fila"><span>En piloto automático</span><em>{automatico}%</em></div>
              <div className="mb-barra" data-tono="mako"><i style={{ width: `${automatico}%` }} /></div>
            </div>
          </div>
        </div>

        <div className="mb-tarjeta">
          <div className="mb-tarjeta-cab">
            <h2>Metas del mes {metas && <small>{metas.diasQuedan === 1 ? 'queda 1 día' : `quedan ${metas.diasQuedan} días`}</small>}</h2>
            <Button size="sm" variant="secondary" onClick={() => setAjustes(true)}>Editar</Button>
          </div>
          {!metas && <div className="mb-vacio-act">No pude leer los números del mes.</div>}
          {metas && (() => {
            const fmt = (u: number) => (metas.convierte ? `US$ ${u.toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : `${u.toLocaleString('es-MX', { maximumFractionDigits: 0 })} ${metas.moneda ?? ''}`);
            const res = config.kpi === 'venta' ? metas.resultados.ventas : config.kpi === 'agenda' ? metas.resultados.agendas : metas.resultados.leads;
            const costo = res > 0 ? metas.gasto / res : null;
            const obj = config.objetivo;
            const delta = costo != null && obj ? costo / obj - 1 : null;
            return (
              <>
                <div className="mb-meta">
                  <div className="mb-meta-fila"><span>Ventas (tu CRM)</span><strong>{fmt(metas.caja)}{config.metaVentasMes ? <small> / {fmt(config.metaVentasMes)}</small> : null}</strong></div>
                  <div className="mb-barra" data-tono="bien"><i style={{ width: `${config.metaVentasMes ? Math.min(100, (metas.caja / config.metaVentasMes) * 100) : 0}%` }} /></div>
                </div>
                <div className="mb-meta">
                  <div className="mb-meta-fila"><span>Gasto en Meta</span><strong>{fmt(metas.gasto)}{config.metaGastoMes ? <small> / {fmt(config.metaGastoMes)}</small> : null}</strong></div>
                  <div className="mb-barra"><i style={{ width: `${config.metaGastoMes ? Math.min(100, (metas.gasto / config.metaGastoMes) * 100) : 0}%` }} /></div>
                </div>
                <div className="mb-meta">
                  <div className="mb-meta-fila">
                    <span>{kpi.costo}</span>
                    <strong>
                      {costo != null ? fmt(costo) : '—'}{obj ? <small> / {fmt(obj)}</small> : null}
                      {delta != null && <span className="mb-chip" data-tono={delta <= 0 ? 'bien' : 'mal'}>{delta <= 0 ? '' : '+'}{Math.round(delta * 100)}%</span>}
                    </strong>
                  </div>
                  <div className="mb-barra" data-tono={delta != null && delta > 0 ? 'mal' : 'bien'}><i style={{ width: `${costo != null && obj ? Math.min(100, (costo / obj) * 100) : 0}%` }} /></div>
                </div>
              </>
            );
          })()}
        </div>
      </section>

      {/* ── 3. Las pestañas ── */}
      <nav className="mb-pestanas" role="tablist">
        {(['abiertas', 'hechas', 'descartadas'] as Pestana[]).map((p) => (
          <button key={p} type="button" role="tab" className="mb-pestana" aria-selected={pestana === p} onClick={() => setPestana(p)}>
            {p === 'abiertas' ? 'Abiertas' : p === 'hechas' ? 'Hechas' : 'Descartadas'}
            <i>{porPestana[p].length}</i>
          </button>
        ))}
        <div className="mb-pestanas-der">
          <Button size="sm" variant="secondary" loading={analizando} disabled={!config.encendido || !config.existeTabla} onClick={() => void analizar()}>Analizar ahora</Button>
        </div>
      </nav>

      {/* ── 4. La lista ── */}
      <div className="mb-lista">
        {porPestana[pestana].length === 0 && (
          pestana === 'abiertas'
            ? <EmptyState titulo={config.ultimaCorrida ? 'Sin decisiones abiertas' : 'MaKo todavía no miró tu cuenta'}
              detalle={config.ultimaCorrida ? 'MaKo vuelve a mirar la cuenta mañana temprano.' : 'Mira la cuenta una vez por día y propone qué subir, bajar, pausar o variar.'}
              accion={config.encendido && config.existeTabla ? { label: 'Analizar ahora', onClick: () => void analizar() } : undefined} />
            : <EmptyState titulo={pestana === 'hechas' ? 'Nada lanzado todavía' : 'Nada descartado'} inline />
        )}
        {porPestana[pestana].map((d) => (
          <FilaDecision key={d.id} d={d} abierta={abierta === d.id} ocupada={ocupada === d.id} encendido={config.encendido}
            onAbrir={() => setAbierta((x) => (x === d.id ? null : d.id))}
            onLanzar={(extra) => accion(d, { op: 'lanzar', ...extra }, d.tipo.startsWith('variaciones') ? 'Anuncios creados' : 'Lanzado')}
            onDescartar={() => accion(d, { op: 'descartar' }, 'Descartada')}
            onDeshacer={() => accion(d, { op: 'deshacer' }, 'Deshecho')}
            onReabrir={() => accion(d, { op: 'reabrir' }, 'Abierta otra vez')}
            onCalificar={(n) => accion(d, { op: 'calificar', estrellas: n }, 'Gracias')} />
        ))}
      </div>

      {ajustes && <AjustesModal config={config} zernio={zernio} onCerrar={() => setAjustes(false)} onGuardar={guardarConfig} onZernio={() => { void leerZernio(); void recargar(); }} />}
      {pidiendo && <PedidoModal onCerrar={() => setPidiendo(false)} onEnviar={(texto) => { setPedidoMako({ texto, vez: Date.now() }); setPidiendo(false); }} />}
      {confirmarPiloto && (
        <Modal titulo="¿Prender el piloto automático?" ancho={480} onCerrar={() => setConfirmarPiloto(false)}
          pie={<>
            <Button variant="secondary" onClick={() => setConfirmarPiloto(false)}>Cancelar</Button>
            <Button onClick={async () => { if (await guardarConfig({ modo: 'piloto', encendido: true })) setConfirmarPiloto(false); }}>Prender piloto</Button>
          </>}>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 'var(--fs-md)', color: 'var(--dim)' }}>
            <li>MaKo lanza solo sus decisiones, una vez por día.</li>
            <li>Sube como mucho {config.subidaMaxPctDia}% por día{config.presupuestoMaxDia ? `, y la cuenta no pasa de ${config.presupuestoMaxDia} por día` : ''}.</li>
            <li>Todo queda en «Hechas», con su porqué y un botón para deshacerlo.</li>
          </ul>
        </Modal>
      )}
      <MakoEnLaTab tab="Media Buyer" pedido={pedidoMako} pantalla={pantalla} encimaDeModales />
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

// ── Una decisión: la fila y, abierta, el detalle de tres columnas ─────────────

function FilaDecision({ d, abierta, ocupada, encendido, onAbrir, onLanzar, onDescartar, onDeshacer, onReabrir, onCalificar }: {
  d: Decision; abierta: boolean; ocupada: boolean; encendido: boolean;
  onAbrir: () => void;
  onLanzar: (extra: { presupuesto?: number; elegidas?: string[] }) => Promise<boolean>;
  onDescartar: () => void; onDeshacer: () => void; onReabrir: () => void; onCalificar: (n: number) => void;
}) {
  const p = pestanaDe(d.estado);
  const tono = tonoDe(d);
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set((d.variaciones ?? []).filter((v) => v.elegida).map((v) => v.id)));
  const [editando, setEditando] = useState(false);
  const [montoTxt, setMontoTxt] = useState(d.despues.presupuesto != null ? String(d.despues.presupuesto) : '');
  const esVar = d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook';
  const lanzar = () => {
    const extra: { presupuesto?: number; elegidas?: string[] } = {};
    if (esVar) extra.elegidas = [...elegidas];
    if (editando && montoTxt.trim()) extra.presupuesto = Number(montoTxt.replace(',', '.'));
    void onLanzar(extra).then((ok) => { if (ok) setEditando(false); });
  };
  const estadoEtq = d.estado === 'fallida' ? { t: 'No se pudo', tono: 'mal' } : d.estado === 'bloqueada' ? { t: 'Frenada por un tope', tono: 'cuidado' }
    : d.estado === 'vencida' ? { t: 'Vencida', tono: undefined } : d.estado === 'deshecha' ? { t: 'Deshecha', tono: undefined }
      : d.estado === 'aplicada' ? { t: d.origen === 'piloto' ? 'Piloto automático' : `Lanzada por ${d.aplicadaPor ?? 'tu equipo'}`, tono: d.origen === 'piloto' ? 'mako' : 'bien' } : null;

  return (
    <article className="mb-dec" data-abierta={abierta ? '1' : '0'}>
      <div className="mb-dec-fila" onClick={onAbrir} role="button" tabIndex={0} aria-expanded={abierta}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}>
        <span className="mb-baldosa" aria-hidden>{ICONO_TIPO[d.tipo]}</span>
        <div className="mb-dec-cuerpo">
          <h3 className="mb-dec-titulo">{d.titulo}</h3>
          <div className="mb-dec-meta">
            <span className="mb-fuente"><Criatura nombre="MaKo" size={16} estrella /> MaKo</span>
            <span className="mb-etq" data-tono="mako">{NOMBRE_TACTICA[d.tactica]}</span>
            <span className="mb-etq">{NIVEL[d.nivel]}</span>
            {d.campanaNombre && <span className="mb-etq" title={d.campanaNombre}>{d.campanaNombre}</span>}
            {estadoEtq && <span className="mb-etq" data-tono={estadoEtq.tono}>{estadoEtq.t}</span>}
            <span>{hace(p === 'hechas' ? d.aplicadaAt : d.creada)}</span>
          </div>
        </div>
        <div className="mb-dec-der" onClick={(e) => e.stopPropagation()}>
          {p === 'abiertas' && <>
            <BotonBorrar talla="lg" title="Descartar esta decisión" disabled={ocupada} onClick={onDescartar} />
            <Button className="mb-lanzar" loading={ocupada} disabled={!encendido} onClick={() => (abierta ? lanzar() : onAbrir())}>
              {abierta ? verboLanzar(d) : 'Lanzar'}
            </Button>
          </>}
          {p === 'hechas' && <>
            <span className="mb-estrellas" aria-label="Calificar">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" data-on={(d.estrellas ?? 0) >= n ? '1' : '0'} title={`${n} de 5`} onClick={() => onCalificar(n)}>★</button>)}
            </span>
            {d.estado === 'aplicada' && <Button variant="secondary" loading={ocupada} onClick={onDeshacer}>Deshacer</Button>}
          </>}
          {p === 'descartadas' && <Button variant="secondary" loading={ocupada} onClick={onReabrir}>Volver a abrir</Button>}
        </div>
      </div>

      {abierta && (
        <div className="mb-detalle">
          <div className="mb-det-grid">
            <div className="mb-det-col">
              <ul className="mb-porque">
                {d.porque.map((t, i) => <li key={i} data-ic={['💡', '📊', '🛡️', '✅'][i % 4]}>{t}</li>)}
              </ul>
            </div>
            <div className="mb-det-col">
              <div className="mb-banner" data-tono={tono}>
                <span className="mb-banner-ic" aria-hidden><span>{ICONO_TIPO[d.tipo]}</span></span>
                <b>{d.titular}</b>
              </div>
              {esVar ? (
                <div className="mb-vars">
                  {(d.variaciones ?? []).map((v) => {
                    const on = elegidas.has(v.id);
                    return (
                      <label key={v.id} className="mb-var" data-on={on ? '1' : '0'}>
                        <input type="checkbox" checked={on} disabled={p !== 'abiertas'} onChange={() => setElegidas((s) => { const n = new Set(s); if (n.has(v.id)) n.delete(v.id); else n.add(v.id); return n; })} />
                        <span className="mb-var-txt">
                          {v.gancho && <b>{v.gancho}</b>}
                          <p>{v.textoPrincipal}</p>
                          {v.titulo && <em>Título: {v.titulo}</em>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="mb-tabla">
                  <div className="mb-tabla-tit">Por qué ahora</div>
                  <table>
                    <thead><tr><th>Condición</th><th>Valor</th><th>Por qué este valor</th></tr></thead>
                    <tbody>{d.numeros.map((n, i) => <tr key={i}><td>{n.condicion}</td><td>{n.valor}</td><td>{n.porQue}</td></tr>)}</tbody>
                  </table>
                  <div className="mb-tabla-pie">Como máximo un cambio por día en cada {NIVEL[d.nivel].toLowerCase()}</div>
                </div>
              )}
            </div>
            <div className="mb-det-col">
              <h4 className="mb-ajustes-tit">Lo que cambia</h4>
              <dl className="mb-kv">
                {d.campanaNombre && <div><dt>Campaña</dt><dd>{d.campanaNombre}</dd></div>}
                <div><dt>{NIVEL[d.nivel]}</dt><dd>{d.entidadNombre}</dd></div>
                {(d.antes.presupuesto != null || d.despues.presupuesto != null) && (
                  <div><dt>Presupuesto diario</dt><dd>{monto(d.antes.presupuesto, d.moneda)}<span className="mb-flecha">→</span>{monto(d.despues.presupuesto, d.moneda)}</dd></div>
                )}
                {(d.antes.estado || d.despues.estado) && (
                  <div><dt>Estado</dt><dd>{d.antes.estado === 'PAUSED' ? 'Pausado' : 'Activo'}<span className="mb-flecha">→</span>{d.despues.estado === 'PAUSED' ? 'Pausado' : 'Activo'}</dd></div>
                )}
                {esVar && <div><dt>Anuncios nuevos</dt><dd>{p === 'abiertas' ? elegidas.size : d.creados.length}, en el mismo conjunto</dd></div>}
                {d.canal && <div><dt>Por dónde</dt><dd>{d.canal === 'zernio' ? 'Zernio' : 'Meta'}</dd></div>}
              </dl>
              {editando && d.despues.presupuesto != null && (
                <div className="mb-editar">
                  <input inputMode="decimal" value={montoTxt} onChange={(e) => setMontoTxt(e.target.value)} aria-label="Presupuesto diario nuevo, en la moneda de la cuenta" />
                  <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>{d.moneda ?? ''} por día</span>
                </div>
              )}
            </div>
          </div>
          <div className="mb-det-pie">
            <p data-tono={d.error ? (d.estado === 'bloqueada' ? 'cuidado' : 'mal') : undefined}>{d.error ?? d.nota ?? ''}</p>
            {p === 'abiertas' && <>
              {d.despues.presupuesto != null && <Button variant="secondary" onClick={() => setEditando((x) => !x)}>{editando ? 'Usar el de MaKo' : 'Editar'}</Button>}
              <Button loading={ocupada} disabled={!encendido || (esVar && elegidas.size === 0)} onClick={lanzar}>{verboLanzar(d)}</Button>
            </>}
            {p !== 'abiertas' && <Button variant="secondary" onClick={onAbrir}>Ocultar</Button>}
          </div>
        </div>
      )}
    </article>
  );
}

// ── El arranque: el onboarding de la tab, en tres pasos (lib/tab-onboarding-catalogo.ts → 'ads-manager') ──
// Conectar la cuenta · el resultado que se busca (el objetivo lo recomienda MaKo con los datos) · prenderlo en «propone».
// Madgicx no muestra el suyo en sus capturas; éste sigue la regla de la casa (una pregunta por paso, nada que redactar).

function Arranque({ tieneMeta, zernio, kpi, onZernio, onPrender }: {
  tieneMeta: boolean; zernio: EstadoZernio | null; kpi: KpiMediaBuyer;
  onZernio: () => void;
  onPrender: (kpi: KpiMediaBuyer) => Promise<void>;
}) {
  const [elegido, setElegido] = useState<KpiMediaBuyer>(kpi);
  const [prendiendo, setPrendiendo] = useState(false);
  const conectada = tieneMeta || !!zernio?.conectado;
  return (
    <section className="mb-tarjeta" aria-label="Prender el Media Buyer">
      <h2>Prende tu Media Buyer <small>tres pasos</small></h2>
      <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 16, fontSize: 'var(--fs-md)' }}>
        <li>
          <b>Tu cuenta publicitaria</b>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', color: 'var(--dim)' }}>
            {conectada ? <span>Conectada{zernio?.conectado ? ' por Zernio' : ''}.</span> : <span>Todavía no está conectada.</span>}
            {!zernio?.conectado && (
              <ConectarViaZernio red="metaads" volver="/ads-manager" adAccountId={zernio?.cuenta ?? null} size="sm" variant={conectada ? 'secondary' : 'primary'} onConectado={onZernio}>
                Conectar con Facebook
              </ConectarViaZernio>
            )}
          </div>
        </li>
        <li>
          <b>El resultado que buscas</b>
          <div style={{ marginTop: 6 }}>
            <RadioGroup value={elegido} onChange={(v) => setElegido(v as KpiMediaBuyer)} options={[
              { value: 'lead', label: 'Leads', hint: 'Personas que dejan sus datos.' },
              { value: 'agenda', label: 'Agendas', hint: 'Leads que reservan una llamada (tu CRM).' },
              { value: 'venta', label: 'Ventas', hint: 'Leads que compran (tu CRM).' },
            ]} />
          </div>
        </li>
        <li>
          <b>Prenderlo</b>
          <p style={{ margin: '6px 0 10px', color: 'var(--dim)' }}>Arranca proponiendo: cada decisión espera tu «Lanzar».</p>
          <Button loading={prendiendo} disabled={!conectada} onClick={async () => { setPrendiendo(true); await onPrender(elegido); setPrendiendo(false); }}>Prender el Media Buyer</Button>
        </li>
      </ol>
    </section>
  );
}

// ── Ajustes (el ⚙ de Madgicx: el KPI y su objetivo, más los topes, el modo y la conexión) ──

function AjustesModal({ config, zernio, onCerrar, onGuardar, onZernio }: {
  config: Config; zernio: EstadoZernio | null;
  onCerrar: () => void;
  onGuardar: (c: Partial<ConfigMediaBuyer>) => Promise<boolean>;
  onZernio: () => void;
}) {
  const [modo, setModo] = useState(config.modo);
  const [encendido, setEncendido] = useState(config.encendido);
  const [kpi, setKpi] = useState<KpiMediaBuyer>(config.kpi);
  const txt = (n: number | null) => (n == null ? '' : String(n));
  const [objetivo, setObjetivo] = useState(txt(config.objetivo));
  const [subida, setSubida] = useState(String(config.subidaMaxPctDia));
  const [maxDia, setMaxDia] = useState(txt(config.presupuestoMaxDia));
  const [ventas, setVentas] = useState(txt(config.metaVentasMes));
  const [gasto, setGasto] = useState(txt(config.metaGastoMes));
  const [cuenta, setCuenta] = useState(config.cuentaPublicitaria ?? '');
  const [guardando, setGuardando] = useState(false);
  const num = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(',', '.')));
  const guardar = async () => {
    setGuardando(true);
    const ok = await onGuardar({
      modo, encendido, kpi, objetivo: num(objetivo), subidaMaxPctDia: Number(subida || 0), presupuestoMaxDia: num(maxDia),
      metaVentasMes: num(ventas), metaGastoMes: num(gasto), cuentaPublicitaria: cuenta.trim() || null,
    });
    setGuardando(false);
    if (ok) onCerrar();
  };
  const recomendado = config.ultimaCorridaInfo && typeof config.ultimaCorridaInfo.objetivo === 'number' && config.ultimaCorridaInfo.objetivoEsRecomendado ? config.ultimaCorridaInfo.objetivo as number : null;
  return (
    <Modal titulo="Ajustes del Media Buyer" ancho={640} onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar}>Cancelar</Button><Button loading={guardando} onClick={() => void guardar()}>Guardar</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Switch checked={encendido} onChange={setEncendido} label="Media Buyer encendido" hint="Apagado, MaKo no analiza ni lanza nada." />
        <RadioGroup label="Modo" value={modo} onChange={(v) => setModo(v === 'piloto' ? 'piloto' : 'propone')} options={[
          { value: 'propone', label: 'Propone y yo apruebo', hint: 'Cada decisión espera tu «Lanzar».' },
          { value: 'piloto', label: 'Piloto automático', hint: 'MaKo lanza solo, dentro de tus topes.' },
        ]} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
          <Select label="Resultado principal" value={kpi} onChange={(v) => setKpi(v as KpiMediaBuyer)} options={[
            { value: 'lead', label: 'Leads' }, { value: 'agenda', label: 'Agendas' }, { value: 'venta', label: 'Ventas' },
          ]} />
          <TextField label={`${NOMBRE_KPI[kpi].costo} objetivo`} inputMode="decimal" value={objetivo} onChange={(e) => setObjetivo(e.target.value)}
            placeholder={recomendado ? `MaKo recomienda ${recomendado}` : 'MaKo lo recomienda'} hint="En dólares. Vacío: lo calcula MaKo con tu cuenta." />
          <TextField label="Subida máxima por día" inputMode="numeric" value={subida} onChange={(e) => setSubida(e.target.value)} suffix="%" />
          <TextField label="Presupuesto máximo por día" inputMode="decimal" value={maxDia} onChange={(e) => setMaxDia(e.target.value)} placeholder="Sin tope" hint="La suma de lo prendido, en dólares." />
          <TextField label="Meta de ventas del mes" inputMode="decimal" value={ventas} onChange={(e) => setVentas(e.target.value)} placeholder="Sin meta" />
          <TextField label="Gasto previsto del mes" inputMode="decimal" value={gasto} onChange={(e) => setGasto(e.target.value)} placeholder="Sin meta" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--fs-md)' }}>Cuenta publicitaria</div>
          <TextField label="Cuenta (act_…)" value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder={zernio?.cuenta ?? 'act_123456789'}
            hint="Sólo si no está en Integraciones: la de Integraciones manda." />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
            {zernio?.conectado ? <span>Conectada por Zernio: MaKo puede crear anuncios nuevos.</span> : <span>Sin Zernio, MaKo opera con tu token de Meta y no puede crear anuncios nuevos.</span>}
            <ConectarViaZernio red="metaads" volver="/ads-manager" adAccountId={zernio?.cuenta ?? null} size="sm" variant="secondary" onConectado={onZernio}>
              {zernio?.conectado ? 'Reconectar' : 'Conectar con Facebook'}
            </ConectarViaZernio>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── «Pedirle más a MaKo» (el «Ask AI Marketer to Do More»): el pedido va al chat de MaKo de la tab ──

function PedidoModal({ onCerrar, onEnviar }: { onCerrar: () => void; onEnviar: (texto: string) => void }) {
  const [texto, setTexto] = useState('');
  return (
    <Modal titulo="Pedirle más a MaKo" ancho={520} onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar}>Cancelar</Button><Button disabled={texto.trim().length < 4} onClick={() => onEnviar(`Media Buyer: ${texto.trim()}`)}>Enviar</Button></>}>
      <TextField multiline label="¿Qué más quieres que haga?" value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Por ejemplo: «prueba un público de intereses en la campaña de leads»" maxLength={600} />
    </Modal>
  );
}
