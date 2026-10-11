'use client';

// =============================================================================
// BloquesClosing — los bloques de la plantilla «Closing»: el embudo, los factores, los closers y las llamadas
// =============================================================================
// Lo que calculaba el `useMemo ag` de app/closing/ClosingBrowser.tsx, leído con
// lib/api-mako/areas/closing.helpers.ts (embudoDe, factoresDe, closersDe), y la LISTA de la tab con su
// búsqueda, filtros y orden (`BloqueLlamadas`).
//
// ⚠️ DESDE EL 11/10/2026 LA HOJA EJECUTA (decisión de Martín: Closing va COMPLETO al Dashboard y la tab se
// elimina). Cada llamada —una fila de la lista, un ejemplo de los factores— abre su ficha (./FichaLlamada.tsx)
// con las tareas: revisar a mano, re-evaluar con MaKo y re-analizar. Y la lista sincroniza con Fathom.
// Después de una tarea, `onRefrescar` vuelve a pedir la hoja: cambian juntos el embudo, los factores, los
// closers y la lista.
//
// ⚠️ «GANADA» NO ES UNA VENTA: la pone el modelo POR LLAMADA (en una R1 quiere decir que avanzó). Y con
// pocas perdidas, la brecha se mueve mucho: el bloque lo dice cuando son menos de 3.

import { useMemo, useState } from 'react';
import { Spinner } from '@/app/_ui';
import { Dropdown } from '@/app/components/Dropdown';
import type { EstiloEfectivo } from '@/lib/graficos-temas';
import type { DatosClosers, DatosEmbudoCierre, DatosFactores, DatosLlamadas, EjemploLlamada } from '@/lib/graficos-bloques-extra-catalogo';
import { NO_ARRASTRAR } from '../piezas';
import { MONO, Vacio, colorPuntaje, fechaCorta, fmt1, suave } from './piezas-extra';
import { FichaLlamada } from './FichaLlamada';
import {
  FILTRO_INICIAL, TONO_ROTULO, TOPE_MS, closersDeLista, colorDeTono, fechaDdMm, filtrarLlamadas, fmtPuntaje, postearTarea, textoDeSync,
  type FiltroLlamadas, type OrdenLlamadas,
} from './llamadas-modelo';

export function BloqueEmbudoCierre({ d, estilo }: { d: DatosEmbudoCierre; estilo: EstiloEfectivo }) {
  if (!d.r1 && !d.r2) return <Vacio>Sin llamadas de venta analizadas en este período.</Vacio>;
  const color = estilo.colores[0] ?? 'var(--primary)';
  const etapas = [
    { rotulo: 'Diagnóstico · R1', n: d.r1 },
    { rotulo: 'Propuesta · R2', n: d.r2 },
    { rotulo: 'Cierre ganado', n: d.ganadasR2 },
  ];
  const max = Math.max(1, ...etapas.map((e) => e.n));
  const pasos = [
    { de: etapas[0].rotulo, a: etapas[1].rotulo, pct: d.r1 ? Math.round((d.r2 / d.r1) * 100) : null, perdidas: d.r1 - d.r2 },
    { de: etapas[1].rotulo, a: etapas[2].rotulo, pct: d.r2 ? Math.round((d.ganadasR2 / d.r2) * 100) : null, perdidas: d.r2 - d.ganadasR2 },
  ];
  const fuga = [...pasos].filter((p) => p.pct != null).sort((a, b) => (a.pct as number) - (b.pct as number))[0];
  return (
    <>
      <div style={{ display: 'grid', gap: 6 }}>
        {etapas.map((e, i) => (
          <div key={e.rotulo} style={{ display: 'grid', gap: 6 }}>
            <div className="bx-fila">
              <span style={{ width: 132, flex: 'none', color: 'var(--dim)' }}>{e.rotulo}</span>
              <span className="bx-carril" style={{ height: 26, borderRadius: 7 }}>
                <span style={{ width: `${Math.max(2, (e.n / max) * 100)}%`, background: suave(color, 30 + i * 22), borderRadius: 7 }} />
              </span>
              <span className="bx-num" style={{ width: 40, textAlign: 'right', color: 'var(--ink)', fontWeight: 600 }}>{e.n}</span>
            </div>
            {i < pasos.length && (
              <div className="bx-num" style={{ paddingLeft: 142, color: pasos[i].pct != null && pasos[i].pct! < 50 ? 'var(--bad)' : 'var(--faint)' }}>
                ↓ {pasos[i].pct != null ? `${pasos[i].pct}% sigue` : '—'}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="bx-linea">
        {d.tasa != null ? `Tasa de cierre ${d.tasa}% de las R2` : 'Todavía no hay R2'}
        {fuga && fuga.perdidas > 0 ? ` · la mayor fuga está entre ${fuga.de.split(' · ')[0].toLowerCase()} y ${fuga.a.split(' · ')[0].toLowerCase()}` : ''}
      </div>
      <div className="bx-linea">Cuenta llamadas, no personas: una R2 cuya R1 no se analizó cuenta igual.</div>
    </>
  );
}

function Ejemplos({ titulo, xs, color, onAbrir }: { titulo: string; xs: EjemploLlamada[]; color: string; onAbrir: (id: number) => void }) {
  if (!xs.length) return null;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>{titulo}</span>
      {xs.map((x) => (
        <button key={x.id} type="button" className={`bx-boton ${NO_ARRASTRAR}`} onClick={() => onAbrir(x.id)} style={{ fontWeight: 500 }}>
          <span style={{ fontFamily: MONO, color }}>{fmt1(x.puntaje)}</span> · {fechaCorta(x.fecha)}{x.tipo ? ` · ${x.tipo}` : ''} · Ver la llamada →
        </button>
      ))}
    </div>
  );
}

export function BloqueFactores({ d, onRefrescar }: { d: DatosFactores; onRefrescar: () => void }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  // La ficha de un ejemplo (con sus tareas). Sin datos se devuelve antes: el estado va arriba de todo.
  const [ficha, setFicha] = useState<number | null>(null);
  if (!d.ganadas || !d.perdidas) return <Vacio>Hace falta al menos una llamada ganada y una perdida para comparar.</Vacio>;
  const filas = d.dimensiones ?? [];
  const top = filas[0];
  const pos = (s: number | null) => `${Math.max(0, Math.min(10, s ?? 0)) * 10}%`;
  return (
    <>
      {top && top.brecha != null && top.brecha > 0 && (
        <div style={{ border: `1px solid ${suave('var(--mako)', 45)}`, background: suave('var(--mako)', 10), borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>✦ {top.dimension} decide tus cierres <span style={{ fontFamily: MONO, color: 'var(--mako-ink)' }}>+{fmt1(top.brecha)}</span></span>
          <span className="bx-linea">Ganadas {fmt1(top.ganadas)} · perdidas {fmt1(top.perdidas)} · equipo {fmt1(top.equipo)}</span>
        </div>
      )}
      <div className="bx-linea">
        {d.ganadas} ganadas · {d.perdidas} perdidas{d.enProceso ? ` · ${d.enProceso} en proceso no cuentan` : ''}
        {d.perdidas < 3 ? ' · con tan pocas perdidas la brecha se mueve mucho' : ''}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--faint)' }}>
        <span><span style={{ color: 'var(--bad)' }}>●</span> perdidas</span>
        <span><span style={{ color: 'var(--good)' }}>●</span> ganadas</span>
        <span>│ equipo</span>
      </div>
      <div className="bx-lista" style={{ gap: 4 }}>
        {filas.map((f, i) => {
          const on = abierta === f.dimension;
          const dif = i < 3 && f.brecha != null && f.brecha > 0;
          const a = Math.min(f.ganadas ?? 0, f.perdidas ?? 0), b = Math.max(f.ganadas ?? 0, f.perdidas ?? 0);
          return (
            <div key={f.dimension} style={{ display: 'grid', gap: 8 }}>
              <button type="button" className={`bx-tarjeta ${NO_ARRASTRAR}`} aria-expanded={on} onClick={() => setAbierta(on ? null : f.dimension)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: '9px 12px', background: 'transparent', border: 'none', borderRadius: 10 }}>
                <span style={{ width: 190, flex: 'none', fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.dimension}{dif && <span className="bx-chip" style={{ marginLeft: 8, color: 'var(--mako-ink)', background: suave('var(--mako)', 14) }}>Diferenciador</span>}
                </span>
                <span style={{ flex: 1, position: 'relative', height: 18, minWidth: 80 }}>
                  <span style={{ position: 'absolute', left: 0, right: 0, top: 8, height: 2, background: 'var(--surface-2)' }} />
                  {f.ganadas != null && f.perdidas != null && <span style={{ position: 'absolute', left: pos(a), width: `calc(${pos(b)} - ${pos(a)})`, top: 8, height: 2, background: 'var(--border-strong)' }} />}
                  {f.equipo != null && <span style={{ position: 'absolute', left: pos(f.equipo), top: 2, width: 2, height: 14, background: 'var(--faint)' }} />}
                  {f.perdidas != null && <span style={{ position: 'absolute', left: `calc(${pos(f.perdidas)} - 6px)`, top: 3, width: 12, height: 12, borderRadius: '50%', background: 'var(--bad)' }} />}
                  {f.ganadas != null && <span style={{ position: 'absolute', left: `calc(${pos(f.ganadas)} - 6px)`, top: 3, width: 12, height: 12, borderRadius: '50%', background: 'var(--good)' }} />}
                </span>
                <span className="bx-num" style={{ width: 56, textAlign: 'right', color: f.brecha != null && f.brecha > 0 ? 'var(--good)' : 'var(--dim)' }}>
                  {f.brecha == null ? '—' : `${f.brecha > 0 ? '+' : ''}${fmt1(f.brecha)}`}
                </span>
              </button>
              {on && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, padding: '0 12px 8px' }}>
                  <Ejemplos titulo="Donde brilló (ganadas)" xs={f.brillo} color="var(--good)" onAbrir={setFicha} />
                  <Ejemplos titulo="Donde faltó (perdidas)" xs={f.falto} color="var(--bad)" onAbrir={setFicha} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {ficha != null && <FichaLlamada recordingId={ficha} onCerrar={() => setFicha(null)} onCambio={onRefrescar} />}
    </>
  );
}

const iniciales = (s: string) => {
  const p = s.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '—';
};

export function BloqueClosers({ d, estilo }: { d: DatosClosers; estilo: EstiloEfectivo }) {
  const closers = d.closers ?? [];
  if (!closers.length) return <Vacio>Sin llamadas de venta analizadas en este período.</Vacio>;
  return (
    <div className="bx-grilla">
      {closers.map((c, i) => {
        const color = estilo.colores[i % Math.max(1, estilo.colores.length)] ?? 'var(--primary)';
        return (
          <div key={c.closer} className="bx-tarjeta">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700, color, background: suave(color, 16) }}>{iniciales(c.closer)}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.closer}</span>
              <span style={{ fontSize: 22, fontWeight: 600, color: colorPuntaje(c.puntaje), fontVariantNumeric: 'tabular-nums' }}>{fmt1(c.puntaje)}</span>
            </div>
            <span className="bx-linea">{c.llamadas} {c.llamadas === 1 ? 'llamada' : 'llamadas'} · {c.ganadas} {c.ganadas === 1 ? 'ganada' : 'ganadas'}</span>
            {c.flojo && (
              <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                Punto débil: <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{c.flojo.dimension}</b> <span style={{ fontFamily: MONO, color: colorPuntaje(c.flojo.puntaje) }}>{fmt1(c.flojo.puntaje)}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Las llamadas: la lista de la tab, con su búsqueda, sus filtros y la sincronización ──────

const TIPOS: ReadonlyArray<[FiltroLlamadas['tipo'], string]> = [['todas', 'Todas'], ['R1', 'R1'], ['R2', 'R2']];
const ORDENES: ReadonlyArray<[OrdenLlamadas, string]> = [['fecha', 'Fecha'], ['puntaje', 'Puntaje'], ['duracion', 'Duración']];
const TONOS_LISTA = ['good', 'warn', 'bad'] as const;

/**
 * La lista de llamadas de venta analizadas del período (la columna izquierda de la vista «Llamadas» de la
 * tab). Buscar, filtrar y ordenar es de la pantalla (`filtrarLlamadas`, ./llamadas-modelo.ts); el detalle
 * de cada una se pide al abrir su ficha. Arriba, cuándo se actualizó y «Sincronizar» (POST
 * /api/closing/sync, hasta 5 min); vacía, el mismo botón en grande, como la tab.
 *
 * ⚠️ «Actualizado» y no «Sincronizado»: la fecha es la del último cambio de CUALQUIER llamada, y eso incluye
 * una revisión a mano (getClosingViewData, `lastSync`). Afirmar un sync que no se puede probar es inventar.
 * ⚠️ Los contadores de servicio, sin analizar y con error son de TODO el historial (como en la tab): la lista
 * sí es del período de la hoja. La línea lo dice.
 */
export function BloqueLlamadas({ d, onRefrescar }: { d: DatosLlamadas; onRefrescar: () => void }) {
  const [f, setF] = useState<FiltroLlamadas>(FILTRO_INICIAL);
  const [ficha, setFicha] = useState<number | null>(null);
  const [sync, setSync] = useState<{ corriendo: boolean; texto: string | null; mal: boolean }>({ corriendo: false, texto: null, mal: false });
  const todas = useMemo(() => d.llamadas ?? [], [d.llamadas]);
  const visibles = useMemo(() => filtrarLlamadas(todas, f), [todas, f]);
  const closers = useMemo(() => closersDeLista(todas), [todas]);
  const n = d.counts;
  const cambiar = (p: Partial<FiltroLlamadas>) => setF((x) => ({ ...x, ...p }));

  const sincronizar = async () => {
    setSync({ corriendo: true, texto: null, mal: false });
    const r = await postearTarea('/api/closing/sync', {}, TOPE_MS.sincronizar);
    setSync({ corriendo: false, texto: r.ok ? textoDeSync(r.j) : r.error, mal: !r.ok });
    // También si venció el tope: el server puede haber terminado, y la hoja lo muestra.
    onRefrescar();
  };

  const historial = [
    n?.servicio ? `${n.servicio} de servicio excluidas` : null,
    n?.pendientes ? `${n.pendientes} sin analizar` : null,
    n?.errores ? `${n.errores} con error` : null,
  ].filter(Boolean).join(' · ');

  const botonSync = (
    <button type="button" className={`bx-boton ${NO_ARRASTRAR}`} disabled={sync.corriendo} onClick={() => void sincronizar()}>↻ Sincronizar</button>
  );
  const lineaSync = sync.corriendo
    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Spinner size={12} /> Sincronizando · hasta 5 min</span>
    : <span style={{ color: sync.mal ? 'var(--bad)' : undefined }}>{sync.texto ?? (d.ultimaSync ? `Actualizado ${fechaDdMm(d.ultimaSync)}` : 'Sin sincronizar')}</span>;

  const abrir = ficha != null && <FichaLlamada recordingId={ficha} onCerrar={() => setFicha(null)} onCambio={onRefrescar} />;

  if (!todas.length) {
    return (
      <>
        <Vacio>
          <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
            <span>Sin llamadas de venta analizadas en este período.</span>
            {(n?.total ?? 0) > 0 && (
              <span style={{ fontFamily: MONO, fontSize: 11.5 }}>{n.total} procesadas · {n.servicio} de servicio · {n.internas} internas · {n.test} de prueba</span>
            )}
            <span className="lk-sin-imprimir" style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
              <button type="button" className={`bx-boton ${NO_ARRASTRAR}`} disabled={sync.corriendo} onClick={() => void sincronizar()}
                style={{ padding: '8px 14px', border: '1px solid var(--primary)', borderRadius: 10 }}>
                {sync.corriendo ? 'Sincronizando · hasta 5 min' : '↻ Sincronizar llamadas'}
              </button>
              {sync.texto && <span style={{ color: sync.mal ? 'var(--bad)' : 'var(--dim)' }}>{sync.texto}</span>}
            </span>
          </div>
        </Vacio>
        {abrir}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
      <div className="bx-fila" style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 4 }}>
        <span className="bx-linea">
          {todas.length} {todas.length === 1 ? 'analizada' : 'analizadas'}{historial ? ` · en todo el historial: ${historial}` : ''}
        </span>
        <span className="bx-linea lk-sin-imprimir" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{lineaSync} · {botonSync}</span>
      </div>

      <div className={`lk-sin-imprimir ${NO_ARRASTRAR}`} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input className="bx-buscar" type="search" value={f.q} onChange={(e) => cambiar({ q: e.target.value })} placeholder="Buscar lead, empresa…" aria-label="Buscar una llamada" />
        <div className="bx-pildoras" role="group" aria-label="Tipo de reunión">
          {TIPOS.map(([k, l]) => <button key={k} type="button" className="bx-pildora" aria-pressed={f.tipo === k} onClick={() => cambiar({ tipo: k })}>{l}</button>)}
        </div>
        <div role="group" aria-label="Resultado" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {TONOS_LISTA.map((t) => (
            <button key={t} type="button" aria-pressed={f.tono === t} aria-label={TONO_ROTULO[t]} title={TONO_ROTULO[t]}
              onClick={() => cambiar({ tono: f.tono === t ? null : t })}
              style={{ width: 15, height: 15, padding: 0, borderRadius: '50%', cursor: 'pointer', background: colorDeTono(t), border: `2px solid ${f.tono === t ? 'var(--ink)' : 'transparent'}`, opacity: f.tono == null || f.tono === t ? 1 : 0.3 }} />
          ))}
        </div>
        {closers.length > 1 && (
          <Dropdown
            value={f.closer ?? ''}
            onChange={(v) => cambiar({ closer: v || null })}
            ariaLabel="Filtrar por closer"
            buttonStyle={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12.5, fontWeight: 600 }}
            options={[
              { value: '', label: 'Todos los closers', icono: 'equipo' },
              ...closers.map((c) => ({ value: c, label: c, avatar: null })),
            ]}
          />
        )}
        <div className="bx-pildoras" role="group" aria-label="Ordenar por" style={{ marginLeft: 'auto' }}>
          {ORDENES.map(([k, l]) => <button key={k} type="button" className="bx-pildora" aria-pressed={f.orden === k} onClick={() => cambiar({ orden: k })}>{l}</button>)}
        </div>
        <span className="bx-num">{visibles.length} de {todas.length}</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {visibles.map((c) => (
          <button key={c.id} type="button" className={`bx-renglon ${NO_ARRASTRAR}`} onClick={() => setFicha(c.id)} style={{ opacity: c.conTranscript ? 1 : 0.55 }}
            title={c.conTranscript ? undefined : 'Sin transcript'}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: colorDeTono(c.tono) }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre ?? '—'}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ fontFamily: MONO, color: 'var(--dim)' }}>{c.tipo ?? '—'}</span> · {c.empresa || c.email || '—'} · {fechaDdMm(c.fecha)}{c.closer ? ` · ${c.closer}` : ''}
              </span>
            </span>
            <span style={{ flex: 'none', fontSize: 14, fontWeight: 700, fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color: colorPuntaje(c.puntaje) }}>{fmtPuntaje(c.puntaje)}</span>
          </button>
        ))}
        {visibles.length === 0 && <div className="bx-linea" style={{ padding: 20, textAlign: 'center' }}>Nada con estos filtros.</div>}
      </div>
      {abrir}
    </div>
  );
}
