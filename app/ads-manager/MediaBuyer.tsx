'use client';

// =============================================================================
// Media Buyer — la pantalla (/ads-manager), la estructura y las funciones de Madgicx · AI Marketer, los colores de MaKo (25/10/2026)
// =============================================================================
// Martín, 25/10/2026, sobre la primera versión en producción: «Realmente no creo que la interfaz de madgicx se vea así de
// fea, con tantos botones, no se entiende... Copiala tal cual a la interfaz de madgicx». Las capturas reales están en
// docs/media-buyer/referencias/madgicx/ y el mapa pantalla por pantalla en docs/media-buyer/referencia.md. De arriba abajo,
// como en web-ai-marketer.png:
//   1. la mascota y «Buen día, 4 recomendaciones para ti.» / «Actualizado hace…»; a la derecha SÓLO la tuerca y «Pedirle
//      más a MaKo» (su «Ask AI Marketer to Do More»). El piloto automático, el interruptor y los topes van en la tuerca;
//      subir creativos y «Analizar ahora», en «Pedirle más»;
//   2. las dos tarjetas: lo que hizo MaKo con el % de la cuenta automatizado, y «Metas del mes»;
//   3. UN chip, «Todas las recomendaciones N»: abre Hechas y Descartadas;
//   4. la lista sobre su banda: baldosa, título, «MaKo» + etiquetas, tacho y «Lanzar» (web-filas-completed.png: la hecha
//      queda con «Hecha» en verde). Abierta, la fila es el detalle de web-detalle.png: cabecera con «Ocultar detalles», el
//      cuerpo (el porqué · el banner y los números · lo que cambia) y el pie con el botón.
// Sin banners (Madgicx no tiene): lo interno (la tabla sin instalar) no se le muestra al cliente, y conectar la cuenta va
// al saludo con globos (web-saludo.png) y a la tuerca. Lo que escribe va a /api/media-buyer; lo que decide, a lib/media-buyer/*.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Modal, RadioGroup, Select, Switch, TextField, Toast, useToast } from '@/app/_ui';
import { Criatura } from '@/app/_components/Criatura';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import type { ConfigMediaBuyer, Decision, KpiMediaBuyer, MetasDelMes } from '@/lib/media-buyer/tipos';
import { textoCupo, type CupoMediaBuyer } from '@/lib/media-buyer/plan';
import { RUTA_CAMBIAR_PLAN } from '@/lib/topes-plan';
import { CTAS, NOMBRE_CTA, errorDeTextos, type ConjuntoParaSubir, type Cta, type TextosCreativo } from '@/lib/media-buyer/creativos';
import { subirAlStaging } from './creativeUpload';
import { iniciales as inicialesSeguras } from '@/lib/unicode-seguro';
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
const NOMBRE_FILTRO: Record<Pestana, string> = { abiertas: 'Todas las recomendaciones', hechas: 'Hechas', descartadas: 'Descartadas' };

async function api<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }));
  return j as T & { ok: boolean; error?: string };
}

// Los íconos de línea de Madgicx (los suyos, redibujados en el mismo trazo).
const IcTuerca = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
);
const IcVarita = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5" /></svg>
);
const IcCapas = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></svg>
);
const IcLapiz = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
);
const IcFlor = () => (
  <svg className="mb-auto-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2.5a3.5 3.5 0 0 1 3.4 4.3 3.5 3.5 0 0 1 4.3 3.4 3.5 3.5 0 0 1-1.6 3 3.5 3.5 0 0 1-1.1 5.3 3.5 3.5 0 0 1-5 .3 3.5 3.5 0 0 1-5-.3 3.5 3.5 0 0 1-1.1-5.3 3.5 3.5 0 0 1-1.6-3 3.5 3.5 0 0 1 4.3-3.4A3.5 3.5 0 0 1 12 2.5z" /><circle cx="12" cy="12" r="2.6" /></svg>
);

// La pieza común (lib/unicode-seguro): cortar con `p[0]` parte un emoji y rompe la hidratación (React #418, ticket #10).
const iniciales = (s: string) => inicialesSeguras(s).toUpperCase();

export function MediaBuyer({ nombre, inicial, metas, tieneMeta, decisionInicial = null }: {
  nombre: string;
  inicial: { config: Config; decisiones: Decision[]; existeTabla: boolean; cupo: CupoMediaBuyer };
  metas: MetasDelMes | null;
  tieneMeta: boolean;
  /** `?decision=<id>`: la recomendación que abre un link (un aviso, MaKo), en su filtro y abierta. */
  decisionInicial?: string | null;
}) {
  const [config, setConfig] = useState<Config>(inicial.config);
  const [decisiones, setDecisiones] = useState<Decision[]>(inicial.decisiones);
  // El plan del negocio (MaKo Esencial: N recomendaciones por día y sin piloto automático; lib/media-buyer/plan.ts).
  const [cupo, setCupo] = useState<CupoMediaBuyer>(inicial.cupo);
  const deLink = decisionInicial ? inicial.decisiones.find((d) => d.id === decisionInicial) ?? null : null;
  const [filtro, setFiltro] = useState<Pestana>(deLink ? pestanaDe(deLink.estado) : 'abiertas');
  const [menu, setMenu] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(deLink?.id ?? null);
  const [ajustes, setAjustes] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [descartando, setDescartando] = useState<Decision | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [zernio, setZernio] = useState<EstadoZernio | null>(null);
  const [pedidoMako, setPedidoMako] = useState<{ texto: string; vez: number } | null>(null);
  const { toast, show, clear } = useToast();
  const [hora, setHora] = useState(12);
  useEffect(() => { setHora(new Date().getHours()); }, []);
  const chipRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: MouseEvent) => { if (!chipRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [menu]);

  const recargar = useCallback(async () => {
    const r = await fetch('/api/media-buyer', { cache: 'no-store' }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { setConfig(r.config); setDecisiones(r.decisiones); if (r.cupo) setCupo(r.cupo); }
  }, []);
  const leerZernio = useCallback(async () => {
    const r = await api<EstadoZernio>({ op: 'estado_zernio' });
    if (r.ok) setZernio({ tieneClave: r.tieneClave, cuenta: r.cuenta, conectado: r.conectado });
  }, []);
  useEffect(() => { void leerZernio(); }, [leerZernio]);

  const porFiltro = useMemo(() => {
    const g: Record<Pestana, Decision[]> = { abiertas: [], hechas: [], descartadas: [] };
    for (const d of decisiones) g[pestanaDe(d.estado)].push(d);
    return g;
  }, [decisiones]);
  const aplicadas = useMemo(() => decisiones.filter((d) => d.estado === 'aplicada' || d.estado === 'deshecha')
    .sort((a, b) => ((b.aplicadaAt ?? '') < (a.aplicadaAt ?? '') ? -1 : 1)), [decisiones]);
  const personas = useMemo(() => [...new Set(aplicadas.map((d) => (d.origen === 'piloto' ? 'MaKo' : d.aplicadaPor ?? 'Equipo')))], [aplicadas]);
  const automatico = porcentajeAutomatico(decisiones);
  const nAbiertas = porFiltro.abiertas.length;

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
      show(n ? `${n} ${n === 1 ? 'recomendación nueva' : 'recomendaciones nuevas'}` : 'Sin recomendaciones nuevas', undefined, 'good');
      setFiltro('abiertas');
    } else show(r.error ?? 'MaKo no pudo leer la cuenta.', undefined, 'bad');
    await recargar();
  }, [recargar, show]);

  const kpi = NOMBRE_KPI[config.kpi];
  const actualizado = config.ultimaCorrida ? `Actualizado ${hace(config.ultimaCorrida)}` : 'Todavía no miró tu cuenta';
  const conectada = tieneMeta || !!zernio?.conectado;
  const fueraDelCupo = Number(config.ultimaCorridaInfo?.fueraDelCupo ?? 0);
  const lista = porFiltro[filtro];

  // Lo que MaKo (el chat) ve de esta pantalla: las recomendaciones abiertas, en texto.
  const pantalla = useMemo(() => [
    `Media Buyer · modo ${config.modo === 'piloto' ? 'piloto automático' : 'propone y apruebo'} · ${config.encendido ? 'encendido' : 'apagado'}`,
    ...porFiltro.abiertas.slice(0, 12).map((d) => `- ${d.titulo} (${NOMBRE_TACTICA[d.tactica]}): ${d.titular}`),
  ].join('\n'), [config.encendido, config.modo, porFiltro.abiertas]);

  return (
    <div className="mb">
      <div className="mb-arriba">
        {/* ── 1. La cabecera: la mascota, el saludo, y sólo la tuerca y «Pedirle más a MaKo» ── */}
        <header className="mb-cab">
          <div className="mb-mascota" aria-hidden><Criatura nombre="MaKo" size={54} estrella /></div>
          <div className="mb-saludo">
            <h1>{saludo(hora)}, <b>{nAbiertas}</b> {nAbiertas === 1 ? 'recomendación' : 'recomendaciones'} para ti.</h1>
            <p>{actualizado}</p>
          </div>
          <div className="mb-acciones">
            <button type="button" className="mb-tuerca" title="Ajustes del Media Buyer" aria-label="Ajustes del Media Buyer" onClick={() => setAjustes(true)}><IcTuerca /></button>
            <button type="button" className="mb-pedir" onClick={() => setPidiendo(true)}><IcVarita />Pedirle más a MaKo</button>
          </div>
        </header>

        {/* ── 2. Las dos tarjetas ── */}
        <section className="mb-tarjetas">
          <div className="mb-tarjeta">
            <div className="mb-tarjeta-cab">
              <h2>Lo que hizo MaKo <small>{aplicadas.length} {aplicadas.length === 1 ? 'cambio' : 'cambios'} en 30 días</small></h2>
              {personas.length > 0 && (
                <span className="mb-caras" aria-hidden>
                  {personas.slice(0, 4).map((p) => <span key={p}>{p === 'MaKo' ? <Criatura nombre="MaKo" size={18} estrella /> : iniciales(p)}</span>)}
                </span>
              )}
            </div>
            <div className="mb-actividad">
              {aplicadas.length === 0 && <div className="mb-vacio-act">Todavía no lanzó nada.</div>}
              {aplicadas.slice(0, 20).map((d) => {
                const esPiloto = d.origen === 'piloto';
                const quien = esPiloto ? 'Piloto automático' : (d.aplicadaPor ?? 'Alguien del equipo');
                return (
                  <div className="mb-act" key={d.id}>
                    <span className="mb-act-av" data-piloto={esPiloto ? '1' : '0'} aria-hidden>
                      {esPiloto ? <Criatura nombre="MaKo" size={20} estrella /> : iniciales(quien)}
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
              <IcFlor />
              <div className="mb-auto-cuerpo">
                <div className="mb-fila-dato"><span>Porcentaje de la cuenta automatizado</span><em>{automatico}%</em></div>
                <div className="mb-barra"><i style={{ width: `${automatico}%` }} /></div>
              </div>
            </div>
          </div>

          <div className="mb-tarjeta">
            <div className="mb-tarjeta-cab">
              <h2>Metas del mes {metas && <small>{metas.diasQuedan === 1 ? 'queda 1 día' : `quedan ${metas.diasQuedan} días`}</small>}</h2>
              <button type="button" className="mb-editar-meta" onClick={() => setAjustes(true)}><IcLapiz />Editar</button>
            </div>
            {!metas && <div className="mb-vacio-act">No pude leer los números del mes.</div>}
            {metas && (() => {
              const fmt = (u: number) => (metas.convierte ? `$${u.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : `${u.toLocaleString('es-MX', { maximumFractionDigits: 0 })} ${metas.moneda ?? ''}`);
              const res = config.kpi === 'venta' ? metas.resultados.ventas : config.kpi === 'agenda' ? metas.resultados.agendas : metas.resultados.leads;
              const costo = res > 0 ? metas.gasto / res : null;
              const obj = config.objetivo;
              const delta = costo != null && obj ? costo / obj - 1 : null;
              const pct = (a: number, b: number | null) => (b ? Math.min(100, (a / b) * 100) : 0);
              return (
                <div className="mb-metas">
                  <div className="mb-meta">
                    <div className="mb-fila-dato"><span><span aria-hidden>💰</span>Ventas</span><strong>{fmt(metas.caja)}{config.metaVentasMes ? <small> / {fmt(config.metaVentasMes)}</small> : null}</strong></div>
                    <div className="mb-barra"><i style={{ width: `${pct(metas.caja, config.metaVentasMes)}%` }} /></div>
                  </div>
                  <div className="mb-meta">
                    <div className="mb-fila-dato"><span><span aria-hidden>📣</span>Gasto en Meta</span><strong>{fmt(metas.gasto)}{config.metaGastoMes ? <small> / {fmt(config.metaGastoMes)}</small> : null}</strong></div>
                    <div className="mb-barra"><i style={{ width: `${pct(metas.gasto, config.metaGastoMes)}%` }} /></div>
                  </div>
                  <div className="mb-meta">
                    <div className="mb-fila-dato">
                      <span><IcCapas />{kpi.costo}</span>
                      <strong>
                        {costo != null ? fmt(costo) : '—'}{obj ? <small> / {fmt(obj)}</small> : null}
                        {delta != null && <span className="mb-insignia" data-tono={delta <= 0 ? undefined : 'mal'}>{delta <= 0 ? '' : '+'}{Math.round(delta * 100)}%</span>}
                      </strong>
                    </div>
                    <div className="mb-barra" data-tono={delta != null && delta > 0 ? 'mal' : 'verde'}><i style={{ width: `${costo != null && obj ? Math.min(100, (obj / costo) * 100) : 0}%` }} /></div>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* ── 3. El chip: «Todas las recomendaciones N» (abre Hechas y Descartadas) ── */}
        <div className="mb-chips" ref={chipRef}>
          <button type="button" className="mb-chip-tab" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((x) => !x)}>
            <IcCapas />{NOMBRE_FILTRO[filtro]}
            <span className="mb-chip-n">{lista.length}
              {filtro !== 'abiertas' && <span className="mb-chip-x" role="button" aria-label="Volver a todas" onClick={(e) => { e.stopPropagation(); setFiltro('abiertas'); setMenu(false); }}>✕</span>}
            </span>
          </button>
          {menu && (
            <div className="mb-menu" role="menu">
              {(['abiertas', 'hechas', 'descartadas'] as Pestana[]).map((p) => (
                <button key={p} type="button" role="menuitemradio" aria-checked={filtro === p} onClick={() => { setFiltro(p); setMenu(false); }}>
                  {NOMBRE_FILTRO[p]}<i>{porFiltro[p].length}</i>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. La banda con la lista ── */}
      <div className="mb-banda">
        {filtro === 'abiertas' && (!config.encendido || lista.length === 0) && (
          <Saludo config={config} conectada={conectada} zernio={zernio} analizando={analizando} hayAbiertas={lista.length > 0}
            onZernio={() => { void leerZernio(); void recargar(); }}
            onAnalizar={() => void analizar()}
            onPrender={async (kpiElegido) => {
              if (await guardarConfig({ kpi: kpiElegido })) {
                if (await guardarConfig({ encendido: true, modo: 'propone' })) void analizar();
              }
            }} />
        )}
        {filtro !== 'abiertas' && lista.length === 0 && <p className="mb-cupo">{filtro === 'hechas' ? 'Nada lanzado todavía.' : 'Nada descartado.'}</p>}
        {porDia(lista, filtro).map(({ dia, ds }) => (
          <section key={dia ?? 'todas'} className="mb-grupo">
            {dia && <h4 className="mb-dia">{dia}</h4>}
            {ds.map((d) => (
              <FilaDecision key={d.id} d={d} abierta={abierta === d.id} ocupada={ocupada === d.id} encendido={config.encendido}
                onAbrir={() => setAbierta((x) => (x === d.id ? null : d.id))}
                onLanzar={(extra) => accion(d, { op: 'lanzar', ...extra }, d.tipo.startsWith('variaciones') ? 'Anuncios creados' : 'Lanzado')}
                onDescartar={() => setDescartando(d)}
                onDeshacer={() => accion(d, { op: 'deshacer' }, 'Deshecho')}
                onReabrir={() => accion(d, { op: 'reabrir' }, 'Abierta otra vez')}
                onCalificar={(n) => accion(d, { op: 'calificar', estrellas: n }, 'Gracias')}
                onHooksAVideo={async (elegidas) => {
                  const r = await api<{ cargados: number }>({ op: 'hooks_a_video', id: d.id, elegidas });
                  if (r.ok) show(r.cargados ? `${r.cargados} ${r.cargados === 1 ? 'guion' : 'guiones'} en Video Generator` : 'Ya estaban en Video Generator', undefined, 'good');
                  else show(r.error ?? 'No se pudo.', undefined, 'bad');
                }} />
            ))}
          </section>
        ))}
        {filtro === 'abiertas' && cupo.recomendacionesDia != null && fueraDelCupo > 0 && (
          <p className="mb-cupo">{textoCupo(cupo.recomendacionesDia)}<Link href={RUTA_CAMBIAR_PLAN}>Pasar a Pro</Link></p>
        )}
      </div>

      {ajustes && <AjustesModal config={config} cupo={cupo} zernio={zernio} onCerrar={() => setAjustes(false)} onGuardar={guardarConfig} onZernio={() => { void leerZernio(); void recargar(); }} />}
      {descartando && (
        <DescartarModal onCerrar={() => setDescartando(null)}
          onDescartar={async (motivo) => { const d = descartando; setDescartando(null); await accion(d, { op: 'descartar', motivo }, 'Descartada'); }} />
      )}
      {subiendo && <SubirCreativosModal onCerrar={() => setSubiendo(false)} onListo={(msg) => { setSubiendo(false); show(msg, undefined, 'good'); setFiltro('hechas'); void recargar(); }} />}
      {pidiendo && (
        <PedidoModal puedeAnalizar={config.encendido && config.existeTabla} puedeSubir={config.existeTabla} analizando={analizando}
          onAnalizar={() => { setPidiendo(false); void analizar(); }}
          onSubir={() => { setPidiendo(false); setSubiendo(true); }}
          onCerrar={() => setPidiendo(false)}
          onEnviar={(texto) => { setPedidoMako({ texto, vez: Date.now() }); setPidiendo(false); }} />
      )}
      <MakoEnLaTab tab="Media Buyer" pedido={pedidoMako} pantalla={pantalla} encimaDeModales />
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

// «Completed» de Madgicx agrupa lo hecho por día (ai-marketer-hechas.png). Las demás listas van sin grupos.
function porDia(ds: Decision[], filtro: Pestana): { dia: string | null; ds: Decision[] }[] {
  if (filtro !== 'hechas') return [{ dia: null, ds }];
  const fmt = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
  const hoy = new Date(); const ayer = new Date(Date.now() - 86_400_000);
  const clave = (x: Date) => x.toISOString().slice(0, 10);
  const grupos = new Map<string, Decision[]>();
  for (const d of [...ds].sort((a, b) => ((b.aplicadaAt ?? b.creada) < (a.aplicadaAt ?? a.creada) ? -1 : 1))) {
    const f = new Date(d.aplicadaAt ?? d.creada);
    const k = clave(f) === clave(hoy) ? 'Hoy' : clave(f) === clave(ayer) ? 'Ayer' : fmt.format(f).replace(/^./, (c) => c.toUpperCase());
    grupos.set(k, [...(grupos.get(k) ?? []), d]);
  }
  return [...grupos].map(([dia, g]) => ({ dia, ds: g }));
}

// ── Descartar, con el porqué (el «Are you sure you want to dismiss?» de Madgicx, ai-marketer-descartar.png). El motivo es
// opcional y queda en `motivo_descarte` (para leer qué tácticas le erran a este negocio; el motor todavía no lo usa).

function DescartarModal({ onCerrar, onDescartar }: { onCerrar: () => void; onDescartar: (motivo: string | null) => void }) {
  const [motivo, setMotivo] = useState('');
  return (
    <Modal titulo="¿Descartar esta recomendación?" ancho={520} onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar}>Cancelar</Button><Button onClick={() => onDescartar(motivo.trim() || null)}>Descartar</Button></>}>
      <TextField multiline label="¿Por qué? (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500}
        placeholder="Por ejemplo: «esta campaña la manejo yo»" />
    </Modal>
  );
}

// ── El saludo con globos (web-saludo.png): Madgicx no muestra su estado vacío, así que el arranque y «nada para hoy» van
// en su tarjeta de saludo. Los pasos son los del onboarding de la tab (lib/tab-onboarding-catalogo.ts → 'ads-manager'):
// conectar la cuenta · el resultado que se busca · prenderlo en «propone». Una cosa por globo, nada que redactar.

function Saludo({ config, conectada, zernio, analizando, hayAbiertas, onZernio, onAnalizar, onPrender }: {
  config: Config; conectada: boolean; zernio: EstadoZernio | null; analizando: boolean; hayAbiertas: boolean;
  onZernio: () => void; onAnalizar: () => void;
  onPrender: (kpi: KpiMediaBuyer) => Promise<void>;
}) {
  const [elegido, setElegido] = useState<KpiMediaBuyer>(config.kpi);
  const [prendiendo, setPrendiendo] = useState(false);
  const primeraVez = !config.ultimaCorrida;
  const tercero = !config.existeTabla ? 'Todavía no miré tu cuenta.'
    : !conectada ? 'Conecta tu cuenta publicitaria para empezar.'
      : !config.encendido ? (primeraVez ? '¿Qué resultado buscas?' : 'Estoy apagado: no miro ni lanzo nada.')
        : primeraVez ? 'Voy a mirar tu cuenta ahora.'
          : hayAbiertas ? 'Estas son mis recomendaciones de hoy.' : 'Hoy no hay nada para cambiar. Vuelvo a mirar mañana.';
  return (
    <section className="mb-hola" aria-label="MaKo, tu media buyer">
      <div className="mb-hola-cara" aria-hidden><Criatura nombre="MaKo" size={74} estrella /></div>
      <div className="mb-globos">
        <span className="mb-globo">¡Hola! Soy MaKo, tu media buyer.</span>
        <span className="mb-globo">Miro tu cuenta una vez por día y te dejo recomendaciones.</span>
        <span className="mb-globo">{tercero}</span>
        {config.existeTabla && (
          <div className="mb-hola-acciones">
            {!conectada && (
              <ConectarViaZernio red="metaads" volver="/ads-manager" adAccountId={zernio?.cuenta ?? null} onConectado={onZernio}>Conectar con Facebook</ConectarViaZernio>
            )}
            {conectada && !config.encendido && primeraVez && (
              <>
                <span className="mb-kpi" role="group" aria-label="El resultado que buscas">
                  {(['lead', 'agenda', 'venta'] as KpiMediaBuyer[]).map((k) => (
                    <button key={k} type="button" aria-pressed={elegido === k} onClick={() => setElegido(k)}>{NOMBRE_KPI[k].varios}</button>
                  ))}
                </span>
                <button type="button" className="mb-lanzar" disabled={prendiendo} onClick={async () => { setPrendiendo(true); await onPrender(elegido); setPrendiendo(false); }}>Prender</button>
              </>
            )}
            {conectada && !config.encendido && !primeraVez && (
              <button type="button" className="mb-lanzar" disabled={prendiendo} onClick={async () => { setPrendiendo(true); await onPrender(config.kpi); setPrendiendo(false); }}>Prender</button>
            )}
            {conectada && config.encendido && primeraVez && (
              <button type="button" className="mb-lanzar" disabled={analizando} onClick={onAnalizar}>{analizando ? 'Mirando…' : 'Analizar ahora'}</button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Una recomendación: la fila y, abierta, el detalle (web-detalle.png) ──────────

function FilaDecision({ d, abierta, ocupada, encendido, onAbrir, onLanzar, onDescartar, onDeshacer, onReabrir, onCalificar, onHooksAVideo }: {
  d: Decision; abierta: boolean; ocupada: boolean; encendido: boolean;
  onAbrir: () => void;
  onLanzar: (extra: { presupuesto?: number; elegidas?: string[] }) => Promise<boolean>;
  onDescartar: () => void; onDeshacer: () => void; onReabrir: () => void; onCalificar: (n: number) => void;
  onHooksAVideo: (elegidas: string[]) => void;
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
      : d.estado === 'aplicada' ? { t: d.origen === 'piloto' ? 'Piloto automático' : `Lanzada por ${d.aplicadaPor ?? 'tu equipo'}`, tono: undefined } : null;

  return (
    <article className="mb-dec" data-abierta={abierta ? '1' : '0'}>
      <div className="mb-dec-fila" onClick={onAbrir} role="button" tabIndex={0} aria-expanded={abierta}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}>
        <span className="mb-baldosa" aria-hidden>{ICONO_TIPO[d.tipo]}</span>
        <div className="mb-dec-cuerpo">
          <h3 className="mb-dec-titulo">{d.titulo}</h3>
          <div className="mb-dec-meta">
            <span className="mb-fuente"><span className="mb-fuente-av" aria-hidden><Criatura nombre="MaKo" size={16} estrella /></span>MaKo</span>
            <span className="mb-etq">{NOMBRE_TACTICA[d.tactica]}</span>
            {d.campanaNombre && <span className="mb-etq" title={d.campanaNombre}>{d.campanaNombre}</span>}
            {estadoEtq && <span className="mb-etq" data-tono={estadoEtq.tono}>{estadoEtq.t}</span>}
          </div>
        </div>
        <div className="mb-dec-der" onClick={(e) => e.stopPropagation()}>
          {p === 'abiertas' && <>
            <BotonBorrar talla="lg" title="Descartar esta recomendación" disabled={ocupada} onClick={onDescartar} />
            {/* Abierta, el botón principal es el del pie, como el «Hide Details» de Madgicx (web-detalle.png). */}
            {abierta
              ? <button type="button" className="mb-secundario" onClick={onAbrir}>Ocultar detalles</button>
              : <button type="button" className="mb-lanzar" disabled={!encendido || ocupada} onClick={onAbrir}>Lanzar</button>}
          </>}
          {p === 'hechas' && <>
            <span className="mb-estrellas" aria-label="Calificar">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" data-on={(d.estrellas ?? 0) >= n ? '1' : '0'} title={`${n} de 5`} onClick={() => onCalificar(n)}>★</button>)}
            </span>
            <button type="button" className="mb-lanzar" data-hecha="1" onClick={onAbrir}>{d.estado === 'deshecha' ? 'Deshecha' : 'Hecha'}</button>
          </>}
          {p === 'descartadas' && <button type="button" className="mb-secundario" disabled={ocupada} onClick={onReabrir}>Volver a abrir</button>}
        </div>
      </div>

      {abierta && (
        <div className="mb-detalle">
          <div className="mb-det-grid">
            <div className="mb-det-col">
              <ul className="mb-porque">
                {d.porque.map((t, i) => <li key={i} data-ic={['💻', '📉', '🤝', '✅'][i % 4]}>{t}</li>)}
              </ul>
            </div>
            <div className="mb-det-col">
              <div className="mb-banner" data-tono={tono === 'mal' || tono === 'bien' ? tono : undefined}>
                <span className="mb-banner-ic" aria-hidden>{ICONO_TIPO[d.tipo]}</span>
                <b>{d.titular}</b>
              </div>
              {esVar ? (
                <>
                  <h4 className="mb-det-sub">{d.tipo === 'variaciones_hook' ? 'Elige los ganchos que quieres probar' : 'Elige los textos que quieres probar'}</h4>
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
                </>
              ) : (
                <>
                  <div className="mb-tabla">
                    <table>
                      <thead><tr><th>Condición</th><th>Valor</th><th>Por qué este valor</th></tr></thead>
                      <tbody>{d.numeros.map((n, i) => <tr key={i}><td>{n.condicion}</td><td>{n.valor}</td><td>{n.porQue}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <span className="mb-pastilla">Como máximo un cambio por día en cada {NIVEL[d.nivel].toLowerCase()}</span>
                </>
              )}
            </div>
            <div className="mb-det-col">
              <div className="mb-ajustes">
                <h4>Lo que cambia</h4>
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
                  <div><dt>Propuesta</dt><dd>{hace(d.creada)}</dd></div>
                </dl>
                {editando && d.despues.presupuesto != null && (
                  <div className="mb-editar">
                    <input inputMode="decimal" value={montoTxt} onChange={(e) => setMontoTxt(e.target.value)} aria-label="Presupuesto diario nuevo, en la moneda de la cuenta" />
                    <span>{d.moneda ?? ''} por día</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mb-det-pie">
            <p data-tono={d.error ? (d.estado === 'bloqueada' ? 'cuidado' : 'mal') : undefined}>{d.error ?? d.nota ?? ''}</p>
            {p === 'abiertas' && <>
              {d.despues.presupuesto != null && <button type="button" className="mb-secundario" onClick={() => setEditando((x) => !x)}>{editando ? 'Usar el de MaKo' : 'Editar'}</button>}
              {d.tipo === 'variaciones_hook' && <button type="button" className="mb-secundario" disabled={elegidas.size === 0} onClick={() => onHooksAVideo([...elegidas])}>Filmarlos en Video Generator</button>}
              <button type="button" className="mb-lanzar" disabled={ocupada || !encendido || (esVar && elegidas.size === 0)} onClick={lanzar}>{ocupada ? 'Lanzando…' : verboLanzar(d)}</button>
            </>}
            {p === 'hechas' && d.estado === 'aplicada' && <button type="button" className="mb-secundario" disabled={ocupada} onClick={onDeshacer}>Deshacer</button>}
            {p !== 'abiertas' && <button type="button" className="mb-secundario" onClick={onAbrir}>Ocultar detalles</button>}
          </div>
        </div>
      )}
    </article>
  );
}

// ── La tuerca (el popup «Primary KPI» de Madgicx, academy-05.png, con lo que MaKo agrega: el modo, los topes y la cuenta) ──

function AjustesModal({ config, cupo, zernio, onCerrar, onGuardar, onZernio }: {
  config: Config; cupo: CupoMediaBuyer; zernio: EstadoZernio | null;
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
          <Select label="Resultado principal" value={kpi} onChange={(v) => setKpi(v as KpiMediaBuyer)} options={[
            { value: 'lead', label: 'Leads' }, { value: 'agenda', label: 'Agendas' }, { value: 'venta', label: 'Ventas' },
          ]} />
          <TextField label={`${NOMBRE_KPI[kpi].costo} objetivo`} inputMode="decimal" value={objetivo} onChange={(e) => setObjetivo(e.target.value)}
            placeholder={recomendado ? `MaKo recomienda ${recomendado}` : 'MaKo lo recomienda'} hint="En dólares. Vacío: lo calcula MaKo." />
        </div>
        <div>
          <RadioGroup label="Modo" value={modo} disabled={!cupo.piloto} onChange={(v) => setModo(v === 'piloto' ? 'piloto' : 'propone')} options={[
            { value: 'propone', label: 'Propone y yo apruebo', hint: 'Cada recomendación espera tu «Lanzar».' },
            { value: 'piloto', label: 'Piloto automático', hint: 'MaKo lanza solo, una vez por día, dentro de tus topes. Todo queda en «Hechas» con su «Deshacer».' },
          ]} />
          {!cupo.piloto && (
            <p className="mk-hint" style={{ margin: '8px 0 0' }}>
              {cupo.recomendacionesDia != null ? textoCupo(cupo.recomendacionesDia) : 'El piloto automático es de MaKo Pro.'}{' '}
              <Link href={RUTA_CAMBIAR_PLAN} className="mb-pro-link">Pasar a Pro</Link>
            </p>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
          <TextField label="Subida máxima por día" inputMode="numeric" value={subida} onChange={(e) => setSubida(e.target.value)} suffix="%" />
          <TextField label="Presupuesto máximo por día" inputMode="decimal" value={maxDia} onChange={(e) => setMaxDia(e.target.value)} placeholder="Sin tope" hint="La suma de lo prendido, en dólares." />
          <TextField label="Meta de ventas del mes" inputMode="decimal" value={ventas} onChange={(e) => setVentas(e.target.value)} placeholder="Sin meta" />
          <TextField label="Gasto previsto del mes" inputMode="decimal" value={gasto} onChange={(e) => setGasto(e.target.value)} placeholder="Sin meta" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <div style={{ fontWeight: 500, fontSize: 15 }}>Cuenta publicitaria</div>
          <TextField label="Cuenta (act_…)" value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder={zernio?.cuenta ?? 'act_123456789'}
            hint="Sólo si no está en Integraciones: la de Integraciones manda." />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 14, color: 'var(--dim)' }}>
            {zernio?.conectado ? <span>Conectada por Zernio: MaKo puede crear anuncios nuevos.</span> : <span>Sin Zernio, MaKo opera con tu token de Meta y no crea anuncios nuevos.</span>}
            <ConectarViaZernio red="metaads" volver="/ads-manager" adAccountId={zernio?.cuenta ?? null} size="sm" variant="secondary" onConectado={onZernio}>
              {zernio?.conectado ? 'Reconectar' : 'Conectar con Facebook'}
            </ConectarViaZernio>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <Switch checked={encendido} onChange={setEncendido} label="Media Buyer encendido" hint="Apagado, MaKo no mira tu cuenta ni lanza nada." />
        </div>
      </div>
    </Modal>
  );
}

// ── Subir creativos nuevos a un conjunto (lo que Meta rechaza con la app del cliente: va por su Zernio) ──
// Un modal: el conjunto, los archivos (subidos al staging con su barra), los textos (los del mejor anuncio del conjunto,
// editables) y publicar. Cada archivo es un anuncio nuevo en el conjunto; queda en «Hechas» con su «Deshacer».

type ArchivoEnSubida = { clave: string; nombre: string; tipo: 'image' | 'video'; progreso: number; path: string | null; error: string | null };

function SubirCreativosModal({ onCerrar, onListo }: { onCerrar: () => void; onListo: (msg: string) => void }) {
  const [conjuntos, setConjuntos] = useState<ConjuntoParaSubir[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [adSetId, setAdSetId] = useState('');
  const [textos, setTextos] = useState<TextosCreativo>({ textoPrincipal: '', titulo: '', cta: 'LEARN_MORE', link: null, formularioId: null });
  const [deAnuncio, setDeAnuncio] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<ArchivoEnSubida[]>([]);
  const [pausa, setPausa] = useState(false);
  const [publicando, setPublicando] = useState(false);
  useEffect(() => {
    void api<{ conjuntos: ConjuntoParaSubir[]; conectado: boolean }>({ op: 'subir_preparar' }).then((r) => {
      if (!r.ok) { setAviso(r.error ?? 'No pude leer la cuenta.'); setConjuntos([]); return; }
      setConjuntos(r.conjuntos);
      if (!r.conectado) setAviso('Para publicar creativos nuevos conecta tu cuenta por Zernio (Ajustes → Conectar con Facebook).');
    });
  }, []);
  const elegir = (id: string) => {
    setAdSetId(id);
    setDeAnuncio(null);
    void api<{ plantilla: { textos: TextosCreativo; deAnuncio: string | null } | null }>({ op: 'subir_preparar', adSetId: id }).then((r) => {
      if (r.ok && r.plantilla) { setTextos(r.plantilla.textos); setDeAnuncio(r.plantilla.deAnuncio); }
    });
  };
  const agregar = (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, 10)) {
      const clave = `${f.name}-${f.size}-${Date.now()}`;
      const tipo = f.type.startsWith('video') ? 'video' as const : 'image' as const;
      setArchivos((xs) => [...xs, { clave, nombre: f.name, tipo, progreso: 0, path: null, error: null }]);
      const cambiar = (c: Partial<ArchivoEnSubida>) => setArchivos((xs) => xs.map((x) => (x.clave === clave ? { ...x, ...c } : x)));
      subirAlStaging(f, (p) => cambiar({ progreso: p })).then((r) => cambiar({ path: r.path, progreso: 100 }), (e) => cambiar({ error: e instanceof Error ? e.message : String(e) }));
    }
  };
  const listos = archivos.filter((a) => a.path && !a.error);
  const subiendoAun = archivos.some((a) => !a.path && !a.error);
  const falta = !adSetId ? 'Elige el conjunto.' : !listos.length ? 'Sube al menos un archivo.' : errorDeTextos(textos);
  const publicar = async () => {
    setPublicando(true);
    const r = await api<{ creados: string[]; errores: string[] }>({
      op: 'subir_creativos', adSetId, textos, activo: !pausa,
      archivos: listos.map((a) => ({ path: a.path, tipo: a.tipo, nombre: a.nombre })),
    });
    setPublicando(false);
    if (r.ok) onListo(r.errores?.length ? `Se crearon ${r.creados.length} de ${listos.length}` : `${r.creados.length} ${r.creados.length === 1 ? 'anuncio creado' : 'anuncios creados'}`);
    else setAviso(r.error ?? 'No se pudo publicar.');
  };
  return (
    <Modal titulo="Subir creativos" ancho={680} alto="min(88vh, 760px)" onCerrar={onCerrar}
      pie={<>
        {falta && <span style={{ marginRight: 'auto', fontSize: 'var(--fs-sm)', color: 'var(--faint)' }}>{falta}</span>}
        <Button variant="secondary" onClick={onCerrar}>Cancelar</Button>
        <Button loading={publicando} disabled={!!falta || subiendoAun} onClick={() => void publicar()}>
          {listos.length ? `Publicar ${listos.length} ${listos.length === 1 ? 'anuncio' : 'anuncios'}` : 'Publicar'}
        </Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {aviso && <Alert tono="warn">{aviso}</Alert>}
        <Select label="Conjunto" value={adSetId} onChange={elegir} placeholder={conjuntos ? 'Elige el conjunto' : 'Leyendo la cuenta…'}
          options={(conjuntos ?? []).map((c) => ({ value: c.id, label: c.nombre, sub: `${c.campana ?? 'Sin campaña'} · ${c.prendido ? 'activo' : 'pausado'} · ${c.anuncios} ${c.anuncios === 1 ? 'anuncio' : 'anuncios'}` }))} />
        <div>
          <div className="mk-label" style={{ marginBottom: 8 }}>Archivos</div>
          <label className="mb-soltar">
            <input type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
            <span>Elige imágenes o videos (hasta 10)</span>
          </label>
          {archivos.length > 0 && (
            <ul className="mb-archivos">
              {archivos.map((a) => (
                <li key={a.clave}>
                  <span aria-hidden>{a.tipo === 'video' ? '🎬' : '🖼️'}</span>
                  <span className="mb-archivo-nombre">{a.nombre}</span>
                  {a.error ? <em data-tono="mal">{a.error}</em> : a.path ? <em>Listo</em> : <div className="mb-barra" style={{ width: 120 }}><i style={{ width: `${a.progreso}%` }} /></div>}
                  <button type="button" className="mb-quitar" aria-label={`Quitar ${a.nombre}`} onClick={() => setArchivos((xs) => xs.filter((x) => x.clave !== a.clave))}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <TextField multiline label="Texto principal" value={textos.textoPrincipal} maxLength={2200}
          hint={deAnuncio ? `Del mejor anuncio del conjunto: «${deAnuncio}».` : undefined}
          onChange={(e) => setTextos((t) => ({ ...t, textoPrincipal: e.target.value }))} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
          <TextField label="Título" value={textos.titulo} maxLength={255} onChange={(e) => setTextos((t) => ({ ...t, titulo: e.target.value }))} />
          <Select label="Botón" value={textos.cta} onChange={(v) => setTextos((t) => ({ ...t, cta: v as Cta }))}
            options={CTAS.map((c) => ({ value: c, label: NOMBRE_CTA[c] }))} />
        </div>
        {textos.formularioId
          ? <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>Usa el formulario instantáneo del conjunto.</p>
          : <TextField label="Link de destino" value={textos.link ?? ''} placeholder="https://" onChange={(e) => setTextos((t) => ({ ...t, link: e.target.value || null }))} />}
        <Switch checked={pausa} onChange={setPausa} label="Dejarlos en pausa" hint="Si no, empiezan a entregar con el presupuesto del conjunto." />
      </div>
    </Modal>
  );
}

// ── «Pedirle más a MaKo» (el «Ask AI Marketer to Do More» de Madgicx). Lo que Madgicx abre ahí no se ve en ninguna captura
// pública: arriba, las dos cosas que MaKo hace en el acto (mirar la cuenta, subir creativos); abajo, el pedido libre al chat.

function PedidoModal({ puedeAnalizar, puedeSubir, analizando, onAnalizar, onSubir, onCerrar, onEnviar }: {
  puedeAnalizar: boolean; puedeSubir: boolean; analizando: boolean;
  onAnalizar: () => void; onSubir: () => void;
  onCerrar: () => void; onEnviar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState('');
  return (
    <Modal titulo="Pedirle más a MaKo" ancho={560} onCerrar={onCerrar}
      pie={<><Button variant="secondary" onClick={onCerrar}>Cancelar</Button><Button disabled={texto.trim().length < 4} onClick={() => onEnviar(`Media Buyer: ${texto.trim()}`)}>Enviar</Button></>}>
      <div className="mb-pedir-ops">
        <button type="button" className="mb-pedir-op" disabled={!puedeAnalizar || analizando} onClick={onAnalizar}><span aria-hidden>🔎</span><span>Mirar mi cuenta ahora</span></button>
        <button type="button" className="mb-pedir-op" disabled={!puedeSubir} onClick={onSubir}><span aria-hidden>⬆️</span><span>Subir creativos nuevos</span></button>
      </div>
      <TextField multiline label="¿Qué más quieres que haga?" value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Por ejemplo: «prueba un público de intereses en la campaña de leads»" maxLength={600} />
    </Modal>
  );
}
