'use client';
// =============================================================================
// GaleriaCreaciones — Explorar lo publicado (con estrellas) y lo que publicó tu negocio
// =============================================================================
// La lista es UNA fila por creación, con filete (no una pila de tarjetas): título, qué es y de quién, para qué sirve,
// y a la derecha la estrella, cuántos negocios la usan y «Usar». Los filtros escriben la URL (`?tab=`, `?tipo=`,
// `?orden=`, `?q=`) con el router de app/_ui/Link, que conserva el `?ws=`.
// =============================================================================

import { useCallback, useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Banner, Button, EmptyState, Tabs } from '@/app/_ui';
import {
  ENCHUFADOS, INFO_TIPO, TIPOS_CREACION, estaEnchufado, numeroCorto,
  type OrdenCreaciones, type TipoCreacion,
} from '@/lib/creaciones-reglas';
import type { Creacion } from '@/lib/creaciones';
import { BotonEstrella } from './BotonEstrella';
import { PublicarCreacion } from './PublicarCreacion';
import { listarCreacionesAction, misCreacionesAction, retirarCreacionAction, usarCreacionAction } from './actions';

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
  tabInicial, filtroInicial, inicial, mias: miasIniciales, error: errorInicial,
}: {
  tabInicial: 'explorar' | 'mias';
  filtroInicial: Filtro;
  inicial: { creaciones: Creacion[]; hayMas: boolean };
  mias: Creacion[];
  error: string | null;
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
  const pedido = useRef(0);

  const escribirUrl = (t: string, f: Filtro) => {
    const p = new URLSearchParams();
    if (t !== 'explorar') p.set('tab', t);
    if (f.tipo) p.set('tipo', f.tipo);
    if (f.orden !== 'estrellas') p.set('orden', f.orden);
    if (f.q.trim()) p.set('q', f.q.trim());
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

  const cambiarFiltro = (f: Filtro) => {
    setFiltro(f);
    escribirUrl(tab, f);
    void cargar(f, 1);
  };
  const cambiarTab = (t: string) => {
    const v = t === 'mias' ? 'mias' : 'explorar';
    setTab(v);
    escribirUrl(v, filtro);
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

  const tipoPublicar: TipoCreacion = filtro.tipo && estaEnchufado(filtro.tipo) ? filtro.tipo : ENCHUFADOS[0];

  return (
    <div>
      <Tabs
        tabs={[{ id: 'explorar', label: 'Explorar' }, { id: 'mias', label: 'Tus publicaciones', badge: mias.length || undefined }]}
        activa={tab}
        onCambio={cambiarTab}
        extra={<Button variant="primary" size="sm" onClick={() => setPublicando(true)}>Publicar</Button>}
      />
      {error && <div style={{ marginBottom: 16 }}><Banner tono="bad">{error}</Banner></div>}
      {aviso && <div style={{ marginBottom: 16 }}><Banner tono="warn">{aviso}</Banner></div>}

      {tab === 'explorar' ? (
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
          {mias.map((c) => <FilaMia key={c.id} c={c} onRetirar={() => retirar(c)} />)}
        </div>
      ) : (
        <EmptyState titulo="Tu negocio todavía no publicó nada." accion={{ label: 'Publicar', onClick: () => setPublicando(true) }} />
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

function FilaCreacion({ c, usando, onUsar }: { c: Creacion; usando: boolean; onUsar: () => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{c.titulo}</div>
        <Meta c={c} />
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

function FilaMia({ c, onRetirar }: { c: Creacion; onRetirar: () => void }) {
  const retirada = c.estado === 'retirada';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)', opacity: retirada ? 0.6 : 1 }}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{c.titulo}</div>
        <Meta c={c} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 'none', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
        <span title="Estrellas">★ {numeroCorto(c.estrellas)}</span>
        <span title="Negocios que la usan">{numeroCorto(c.usos)} {c.usos === 1 ? 'uso' : 'usos'}</span>
        {retirada
          ? <span style={{ color: 'var(--dim)' }}>Retirada</span>
          : <Button variant="tertiary" size="sm" onClick={onRetirar}>Retirar</Button>}
      </div>
    </div>
  );
}
