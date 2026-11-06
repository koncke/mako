'use client';
// =============================================================================
// GaleriaCreaciones — Explorar lo publicado (con estrellas) y lo que publicó tu negocio
// =============================================================================
// La lista es UNA fila por creación, con filete (no una pila de tarjetas): título, qué es y de quién, para qué sirve,
// y a la derecha la estrella, cuántos negocios la usan y «Usar». Los filtros escriben la URL (`?tab=`, `?tipo=`,
// `?orden=`, `?q=`, `?periodo=`) con el router de app/_ui/Link, que conserva el `?ws=`.
// Tres preguntas, tres pestañas (6/11/2026): «Explorar» (qué hay), «Ranking» (qué está gustando: las estrellas de la
// semana, del mes o de siempre, lib/creaciones-reglas.ts → `rankear`) y «Tus plantillas» (lo del negocio: las privadas,
// con «Compartir», y lo publicado).
// =============================================================================

import { useCallback, useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Banner, Button, EmptyState, Skeleton, Tabs } from '@/app/_ui';
import {
  ENCHUFADOS, INFO_TIPO, PERIODOS_RANKING, TIPOS_CREACION, estaEnchufado, numeroCorto,
  type OrdenCreaciones, type PeriodoRanking, type TipoCreacion,
} from '@/lib/creaciones-reglas';
import type { Creacion, CreacionRankeada } from '@/lib/creaciones';
import { BotonEstrella } from './BotonEstrella';
import { PublicarCreacion } from './PublicarCreacion';
import {
  compartirPlantillaAction, listarCreacionesAction, misCreacionesAction, rankingAction, retirarCreacionAction, usarCreacionAction,
} from './actions';

export type TabGaleria = 'explorar' | 'ranking' | 'mias';
const PERIODOS: Record<PeriodoRanking, { label: string; delPeriodo: string }> = {
  semana: { label: 'Esta semana', delPeriodo: 'esta semana' },
  mes: { label: 'Este mes', delPeriodo: 'este mes' },
  siempre: { label: 'Siempre', delPeriodo: '' },
};

type Filtro = { tipo: TipoCreacion | null; orden: OrdenCreaciones; q: string };
const ORDENES: Array<{ id: OrdenCreaciones; label: string }> = [
  { id: 'estrellas', label: 'Más estrellas' }, { id: 'usos', label: 'Más usadas' }, { id: 'recientes', label: 'Recientes' },
];

const chip = (activo: boolean): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 999, border: `1px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
  background: activo ? 'var(--primary-bg)' : 'var(--surface)', color: activo ? 'var(--primary-strong)' : 'var(--ink)',
  font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
});
const control: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontSize: 13,
};

export function GaleriaCreaciones({
  tabInicial, filtroInicial, inicial, mias: miasIniciales, error: errorInicial, periodoInicial = 'semana', rankingInicial = null,
}: {
  tabInicial: TabGaleria;
  filtroInicial: Filtro;
  inicial: { creaciones: Creacion[]; hayMas: boolean };
  mias: Creacion[];
  error: string | null;
  periodoInicial?: PeriodoRanking;
  /** El ranking ya leído en el server (con `?tab=ranking`); sin esto, se lee al abrir la pestaña. */
  rankingInicial?: CreacionRankeada[] | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(tabInicial);
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [lista, setLista] = useState(inicial.creaciones);
  const [hayMas, setHayMas] = useState(inicial.hayMas);
  const [pagina, setPagina] = useState(1);
  const [mias, setMias] = useState(miasIniciales);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(errorInicial);
  const [publicando, setPublicando] = useState(false);
  const [usando, setUsando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoRanking>(periodoInicial);
  const [ranking, setRanking] = useState<CreacionRankeada[] | null>(rankingInicial);
  const [compartiendo, setCompartiendo] = useState<number | null>(null);
  const pedido = useRef(0);
  const pedidoRanking = useRef(0);

  const escribirUrl = (t: string, f: Filtro, per: PeriodoRanking = periodo) => {
    const p = new URLSearchParams();
    if (t !== 'explorar') p.set('tab', t);
    if (f.tipo) p.set('tipo', f.tipo);
    if (f.orden !== 'estrellas') p.set('orden', f.orden);
    if (f.q.trim()) p.set('q', f.q.trim());
    if (t === 'ranking' && per !== 'semana') p.set('periodo', per);
    const qs = p.toString();
    router.replace(`/creaciones${qs ? `?${qs}` : ''}`, { scroll: false });
  };

  const cargar = async (f: Filtro, pag = 1) => {
    const mio = ++pedido.current;
    setCargando(true);
    const r = await listarCreacionesAction({ ...f, pagina: pag }).catch(() => ({ error: 'Sin conexión' }));
    if (mio !== pedido.current) return;
    setCargando(false);
    if ('error' in r) { setError(r.error); return; }
    setError(null);
    setLista((antes) => (pag === 1 ? r.creaciones : [...antes, ...r.creaciones]));
    setHayMas(r.hayMas);
    setPagina(pag);
  };

  const cargarRanking = async (per: PeriodoRanking, tipo: TipoCreacion | null) => {
    const mio = ++pedidoRanking.current;
    setRanking(null);
    const r = await rankingAction(per, tipo).catch(() => ({ error: 'Sin conexión' }));
    if (mio !== pedidoRanking.current) return;
    if ('error' in r) { setError(r.error); setRanking([]); return; }
    setError(null);
    setRanking(r);
  };

  const cambiarFiltro = (f: Filtro) => {
    setFiltro(f);
    escribirUrl(tab, f);
    if (tab === 'ranking') void cargarRanking(periodo, f.tipo);
    else void cargar(f, 1);
  };
  const cambiarTab = (t: string) => {
    const v: TabGaleria = t === 'mias' ? 'mias' : t === 'ranking' ? 'ranking' : 'explorar';
    setTab(v);
    escribirUrl(v, filtro);
    if (v === 'ranking' && ranking == null) void cargarRanking(periodo, filtro.tipo);
  };
  const cambiarPeriodo = (per: PeriodoRanking) => {
    setPeriodo(per);
    escribirUrl('ranking', filtro, per);
    void cargarRanking(per, filtro.tipo);
  };

  const recargarMias = useCallback(async () => {
    const r = await misCreacionesAction().catch(() => null);
    if (r && !('error' in r)) setMias(r);
  }, []);
  const cerrarPublicar = useCallback(() => setPublicando(false), []);
  // No es el onCerrar del Modal: su identidad no importa.
  const alPublicar = () => { void recargarMias(); void cargar(filtro, 1); };

  const usar = async (c: Creacion) => {
    if (usando) return;
    setUsando(c.id);
    setAviso(null);
    const r = await usarCreacionAction(c.id).catch(() => ({ error: 'Sin conexión' }));
    setUsando(null);
    if ('error' in r) { setAviso(r.error); return; }
    router.push(r.ruta);
  };

  const retirar = async (c: Creacion) => {
    const r = await retirarCreacionAction(c.id).catch(() => ({ error: 'Sin conexión' }));
    if ('error' in r) { setAviso(r.error); return; }
    setMias((xs) => xs.map((x) => (x.id === c.id ? { ...x, estado: 'retirada' } : x)));
    setLista((xs) => xs.filter((x) => x.id !== c.id));
  };

  /** Una plantilla sólo del negocio, a la comunidad: crea su copia limpia (la privada queda). */
  const compartir = async (c: Creacion) => {
    if (compartiendo) return;
    setCompartiendo(c.id);
    setAviso(null);
    const r = await compartirPlantillaAction(c.id).catch(() => ({ error: 'Sin conexión' }));
    setCompartiendo(null);
    if ('error' in r) { setAviso(r.error); return; }
    void recargarMias();
    setAviso(r.actualizada ? 'Actualizada en la galería.' : 'Compartida con la comunidad.');
  };

  const tipoPublicar: TipoCreacion = filtro.tipo && estaEnchufado(filtro.tipo) ? filtro.tipo : ENCHUFADOS[0];

  return (
    <div>
      <Tabs
        tabs={[
          { id: 'explorar', label: 'Explorar' },
          { id: 'ranking', label: 'Ranking' },
          { id: 'mias', label: 'Tus plantillas', badge: mias.filter((x) => x.estado !== 'retirada').length || undefined },
        ]}
        activa={tab}
        onCambio={cambiarTab}
        extra={<Button variant="primary" size="sm" onClick={() => setPublicando(true)}>Publicar</Button>}
      />
      {error && <div style={{ marginBottom: 16 }}><Banner tono="bad">{error}</Banner></div>}
      {aviso && <div style={{ marginBottom: 16 }}><Banner tono="warn">{aviso}</Banner></div>}

      {tab === 'ranking' ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {PERIODOS_RANKING.map((per) => (
              <button key={per} type="button" style={chip(periodo === per)} aria-pressed={periodo === per} onClick={() => cambiarPeriodo(per)}>{PERIODOS[per].label}</button>
            ))}
            <span style={{ flex: 1 }} />
            <select aria-label="Tipo" style={control} value={filtro.tipo ?? ''} onChange={(e) => cambiarFiltro({ ...filtro, tipo: (TIPOS_CREACION as readonly string[]).includes(e.target.value) ? e.target.value as TipoCreacion : null })}>
              <option value="">Todas</option>
              {TIPOS_CREACION.map((t) => <option key={t} value={t}>{INFO_TIPO[t].titulo}</option>)}
            </select>
          </div>
          {ranking == null ? (
            // Mientras carga, las filas que vienen (AGENTS.md: un loader es parte del diseño, no un renglón suelto).
            <div aria-busy="true" aria-label="Cargando el ranking" style={{ borderTop: '1px solid var(--border)' }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                  <Skeleton w={24} h={18} /><div style={{ flex: 1 }}><Skeleton w="40%" h={15} /><Skeleton w="25%" h={11} style={{ marginTop: 6 }} /></div><Skeleton w={90} h={28} radius={8} />
                </div>
              ))}
            </div>
          ) : ranking.length ? (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--border)' }}>
              {ranking.map((c) => (
                <li key={c.id}>
                  <FilaCreacion c={c} usando={usando === c.id} onUsar={() => usar(c)}
                    antes={<span aria-label={`Puesto ${c.puesto}`} style={{ width: 36, flex: 'none', fontSize: 18, fontWeight: 800, color: c.puesto <= 3 ? 'var(--ink)' : 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{c.puesto}</span>}
                    nota={periodo === 'siempre' ? null : `+${numeroCorto(c.delPeriodo)} ★ ${PERIODOS[periodo].delPeriodo}`} />
                </li>
              ))}
            </ol>
          ) : !error && (
            <EmptyState titulo={periodo === 'siempre' ? 'Todavía nadie dio una estrella.' : `Nadie dio una estrella ${PERIODOS[periodo].delPeriodo}.`} />
          )}
        </>
      ) : tab === 'explorar' ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button type="button" style={chip(!filtro.tipo)} aria-pressed={!filtro.tipo} onClick={() => cambiarFiltro({ ...filtro, tipo: null })}>Todas</button>
            {TIPOS_CREACION.map((t) => (
              <button key={t} type="button" style={chip(filtro.tipo === t)} aria-pressed={filtro.tipo === t} onClick={() => cambiarFiltro({ ...filtro, tipo: t })}>{INFO_TIPO[t].titulo}</button>
            ))}
            <span style={{ flex: 1 }} />
            <input
              type="search" aria-label="Buscar" placeholder="Buscar" style={{ ...control, minWidth: 160 }} defaultValue={filtro.q}
              onKeyDown={(e) => { if (e.key === 'Enter') cambiarFiltro({ ...filtro, q: (e.target as HTMLInputElement).value }); }}
            />
            <select aria-label="Orden" style={control} value={filtro.orden} onChange={(e) => cambiarFiltro({ ...filtro, orden: e.target.value as OrdenCreaciones })}>
              {ORDENES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>

          {lista.length ? (
            <div style={{ borderTop: '1px solid var(--border)', opacity: cargando ? 0.6 : 1 }}>
              {lista.map((c) => <FilaCreacion key={c.id} c={c} usando={usando === c.id} onUsar={() => usar(c)} />)}
            </div>
          ) : !error && (
            <EmptyState
              titulo={filtro.tipo || filtro.q ? 'Nada publicado con ese filtro.' : 'Todavía no hay creaciones publicadas.'}
              accion={{ label: 'Publicar la primera', onClick: () => setPublicando(true) }}
            />
          )}
          {hayMas && (
            <div style={{ marginTop: 16 }}>
              <Button variant="secondary" onClick={() => cargar(filtro, pagina + 1)} loading={cargando}>Ver más</Button>
            </div>
          )}
        </>
      ) : mias.length ? (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {mias.map((c) => <FilaMia key={c.id} c={c} onRetirar={() => retirar(c)} onCompartir={() => compartir(c)} compartiendo={compartiendo === c.id} />)}
        </div>
      ) : (
        <EmptyState titulo="Tu negocio todavía no tiene plantillas." accion={{ label: 'Publicar', onClick: () => setPublicando(true) }} />
      )}

      {publicando && <PublicarCreacion tipo={tipoPublicar} onCerrar={cerrarPublicar} onPublicada={alPublicar} />}
    </div>
  );
}

function Meta({ c }: { c: Creacion }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>
      {c.tipoTitulo.charAt(0).toUpperCase() + c.tipoTitulo.slice(1)} · {c.deMako ? 'de MaKo' : `por ${c.autor}`}
    </div>
  );
}

function FilaCreacion({ c, usando, onUsar, antes, nota }: { c: Creacion; usando: boolean; onUsar: () => void; antes?: React.ReactNode; nota?: string | null }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      {antes}
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{c.titulo}</div>
        <Meta c={c} />
        {nota && <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--good)', marginTop: 2 }}>{nota}</div>}
        {c.descripcion && (
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.descripcion}</p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
        <span style={{ fontSize: 12, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }} title="Negocios que la usan">
          {numeroCorto(c.usos)} {c.usos === 1 ? 'uso' : 'usos'}
        </span>
        <BotonEstrella creacionId={c.id} estrellas={c.estrellas} conEstrella={c.conEstrella} mia={c.mia} />
        {c.sePuedeUsar
          ? <Button variant="secondary" size="sm" onClick={onUsar} loading={usando} aria-label={`Usar «${c.titulo}» en mi negocio`}>Usar</Button>
          : <span style={{ fontSize: 12, color: 'var(--dim)' }}>Pronto</span>}
      </div>
    </div>
  );
}

function FilaMia({ c, onRetirar, onCompartir, compartiendo }: { c: Creacion; onRetirar: () => void; onCompartir: () => void; compartiendo: boolean }) {
  const retirada = c.estado === 'retirada';
  const privada = c.estado === 'privada';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)', opacity: retirada ? 0.6 : 1 }}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{c.titulo}</div>
        <Meta c={c} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 'none', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
        {privada ? (
          <>
            <span>🔒 Sólo tu negocio</span>
            <Button variant="secondary" size="sm" onClick={onCompartir} loading={compartiendo}>Compartir</Button>
            <Button variant="tertiary" size="sm" onClick={onRetirar}>Quitar</Button>
          </>
        ) : (
          <>
            <span title="Estrellas">★ {numeroCorto(c.estrellas)}</span>
            <span title="Negocios que la usan">{numeroCorto(c.usos)} {c.usos === 1 ? 'uso' : 'usos'}</span>
            {retirada
              ? <span style={{ color: 'var(--dim)' }}>Retirada</span>
              : <Button variant="tertiary" size="sm" onClick={onRetirar}>Retirar</Button>}
          </>
        )}
      </div>
    </div>
  );
}
