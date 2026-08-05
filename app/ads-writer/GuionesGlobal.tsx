'use client';

// =============================================================================
// GuionesGlobal — TODOS los guiones del negocio, en una sola lista
// =============================================================================
// La matriz muestra los guiones de UNA celda por vez; esta vista los aplana:
// cada guion de cada celda, con el avatar y la motivación de compra a los que
// pertenece, filtrable por fecha, estado, ángulo y avatar. Es lo que convierte
// al guion en una pieza que se sigue (¿cuáles quedaron en borrador?, ¿qué
// grabamos esta semana?) en vez de un texto enterrado adentro de una celda.
//
// Lee y escribe /api/onboarding/razones (la misma fuente que la matriz): cambiar
// el estado va por la acción 'guion-estado', que toca UN guion y no reenvía la
// matriz entera — si no, pisaría lo que se esté editando en la otra vista.
// =============================================================================

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { SeccionCard, parsearSecciones } from '../components/SeccionCard';
import { EstadoChip } from '../onboarding/EstadoChip';
import { ESTADOS_GUION, ESTADO_GUION_LABEL, fechaGuion, diaGuion, type EstadoGuion, type GuionItem } from '../onboarding/guion-ui';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Avatar = { id: string; nombre: string; segmento: string };
type Celda = { id: string; avatarId: string; nombre: string; guiones: GuionItem[] };

/** Un guion + de dónde salió. Es la unidad de esta vista. */
type Fila = { g: GuionItem; celdaId: string; celdaNombre: string; avatarNombre: string; avatarId: string };

const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };
const btnMini: CSSProperties = { padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12, fontWeight: 500, cursor: 'pointer', flex: 'none' };
const inputFecha: CSSProperties = { fontFamily: SANS, fontSize: 12.5, color: 'var(--ink)', padding: '7px 9px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)' };

const TODOS = '';

export function GuionesGlobal({ celdas, avatares, onEstado, onBorrar, onIrAMatriz }: {
  celdas: Celda[];
  avatares: Avatar[];
  onEstado: (celdaId: string, guionId: string, estado: EstadoGuion) => void;
  onBorrar: (celdaId: string, guionId: string) => void;
  onIrAMatriz: (celdaId: string) => void;
}) {
  const [q, setQ] = useState('');
  const [fEstado, setFEstado] = useState<string>(TODOS);
  const [fAngulo, setFAngulo] = useState<string>(TODOS);
  const [fAvatar, setFAvatar] = useState<string>(TODOS);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [orden, setOrden] = useState<'nuevos' | 'viejos'>('nuevos');
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const filas = useMemo<Fila[]>(() => {
    const nombreAvatar = new Map(avatares.map((a) => [a.id, a.nombre]));
    return celdas.flatMap((c) => c.guiones.map((g) => ({
      g, celdaId: c.id, celdaNombre: c.nombre,
      avatarId: c.avatarId, avatarNombre: nombreAvatar.get(c.avatarId) ?? 'Sin avatar',
    })));
  }, [celdas, avatares]);

  // Las opciones de ángulo salen de los guiones REALES, no del catálogo: un
  // filtro que ofrece ángulos sin ningún guion solo da resultados vacíos.
  const angulos = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of filas) if (f.g.anguloNombre) m.set(f.g.anguloNombre, f.g.anguloNombre);
    return [...m.keys()].sort((a, b) => a.localeCompare(b, 'es'));
  }, [filas]);

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = filas.filter((f) => {
      if (fEstado && f.g.estado !== fEstado) return false;
      if (fAngulo && f.g.anguloNombre !== fAngulo) return false;
      if (fAvatar && f.avatarId !== fAvatar) return false;
      if (desde || hasta) {
        const dia = diaGuion(f.g.creadoEn);
        // Un guion sin fecha (anterior al campo) NO puede afirmarse dentro de un
        // rango: se oculta cuando hay filtro de fechas, en vez de colarse.
        if (!dia) return false;
        if (desde && dia < desde) return false;
        if (hasta && dia > hasta) return false;
      }
      if (needle) {
        const blob = `${f.g.texto} ${f.g.anguloNombre} ${f.celdaNombre} ${f.avatarNombre}`.toLowerCase();
        if (!blob.includes(needle)) return false;
      }
      return true;
    });
    // Los "sin fecha" (creadoEn 0) van SIEMPRE al final, en los dos órdenes: en
    // ascendente encabezarían la lista fingiendo ser los más viejos.
    return out.sort((a, b) => {
      if (!a.g.creadoEn && !b.g.creadoEn) return 0;
      if (!a.g.creadoEn) return 1;
      if (!b.g.creadoEn) return -1;
      return orden === 'nuevos' ? b.g.creadoEn - a.g.creadoEn : a.g.creadoEn - b.g.creadoEn;
    });
  }, [filas, q, fEstado, fAngulo, fAvatar, desde, hasta, orden]);

  const hayFiltro = !!(q || fEstado || fAngulo || fAvatar || desde || hasta);
  const limpiar = () => { setQ(''); setFEstado(TODOS); setFAngulo(TODOS); setFAvatar(TODOS); setDesde(''); setHasta(''); };

  const copiar = async (g: GuionItem) => {
    try { await navigator.clipboard.writeText(g.texto); setCopiado(g.id); setTimeout(() => setCopiado(null), 1600); } catch { /* sin portapapeles */ }
  };
  const descargar = (f: Fila) => {
    const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '');
    const md = `# Guion · ${f.celdaNombre}\n\nAvatar: ${f.avatarNombre}\nÁngulo: ${f.g.anguloNombre}\nEstructura: ${f.g.estructuraNombre || '—'}\nEstado: ${ESTADO_GUION_LABEL[f.g.estado]}\nCreado: ${fechaGuion(f.g.creadoEn)}\n\n${f.g.texto}\n`;
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `guion-${slug(f.g.anguloNombre || 'general')}-${slug(f.celdaNombre)}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  // Cuántos hay en cada estado: el pulso de la producción de un vistazo.
  const porEstado = useMemo(() => {
    const m = Object.fromEntries(ESTADOS_GUION.map((e) => [e, 0])) as Record<EstadoGuion, number>;
    for (const f of filas) m[f.g.estado] += 1;
    return m;
  }, [filas]);

  if (!filas.length) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '56px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
        <h2 style={{ fontSize: 23, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 10px' }}>Todavía no escribiste ningún guion</h2>
        <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6 }}>Ve a <b>Matriz</b>, abre un anuncio y pídele a MaKo que lo escriba. Acá vas a ver todos juntos, con su estado.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={eyebrow}>{visibles.length} de {filas.length} guiones</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {ESTADOS_GUION.map((e) => (
            <button key={e} type="button" onClick={() => setFEstado(fEstado === e ? TODOS : e)}
              style={{ ...btnMini, background: fEstado === e ? 'var(--primary-bg)' : 'var(--surface)', borderColor: fEstado === e ? 'var(--primary)' : 'var(--border-strong)', color: fEstado === e ? 'var(--primary)' : 'var(--dim)' }}>
              {ESTADO_GUION_LABEL[e]} · {porEstado[e]}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 13, background: 'var(--surface-2)', marginBottom: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el texto del guion…"
          style={{ ...inputFecha, flex: '1 1 220px', minWidth: 0 }} />
        <Dropdown value={fAngulo} onChange={setFAngulo} width={168} ariaLabel="Filtrar por ángulo" placeholder="Todos los ángulos"
          options={[{ value: TODOS, label: 'Todos los ángulos' }, ...angulos.map((a) => ({ value: a, label: a }))]} />
        <Dropdown value={fAvatar} onChange={setFAvatar} width={168} ariaLabel="Filtrar por avatar" placeholder="Todos los avatares"
          options={[{ value: TODOS, label: 'Todos los avatares' }, ...avatares.map((a) => ({ value: a.id, label: a.nombre, sub: a.segmento }))]} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SANS, fontSize: 12, color: 'var(--dim)' }}>
          Desde <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} style={inputFecha} />
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: SANS, fontSize: 12, color: 'var(--dim)' }}>
          Hasta <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} style={inputFecha} />
        </label>
        <Dropdown value={orden} onChange={(v) => setOrden(v as 'nuevos' | 'viejos')} width={148} ariaLabel="Ordenar"
          options={[{ value: 'nuevos', label: 'Más nuevos primero' }, { value: 'viejos', label: 'Más viejos primero' }]} />
        {hayFiltro && <button type="button" onClick={limpiar} style={btnMini}>✕ Limpiar</button>}
      </div>

      {!visibles.length && (
        <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, textAlign: 'center', padding: '34px 0' }}>
          Ningún guion coincide con estos filtros.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visibles.map((f) => {
          const abierto = abiertoId === f.g.id;
          const secciones = parsearSecciones(f.g.texto, undefined, 20);
          return (
            <div key={f.g.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', background: 'var(--surface-2)', borderBottom: abierto ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setAbiertoId(abierto ? null : f.g.id)}
                  style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SANS, padding: 0 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 10px', flex: 'none' }}>{f.g.anguloNombre}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{f.celdaNombre}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--faint)' }}>· {f.avatarNombre}</span>
                  <span aria-hidden style={{ marginLeft: 'auto', flex: 'none', color: 'var(--faint)', fontSize: 12, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                </button>
                <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)', flex: 'none', whiteSpace: 'nowrap' }}>{fechaGuion(f.g.creadoEn)}{f.g.estructuraNombre ? ` · ${f.g.estructuraNombre}` : ''}</span>
                <EstadoChip estado={f.g.estado} onChange={(e) => onEstado(f.celdaId, f.g.id, e)} />
                <button type="button" onClick={() => onIrAMatriz(f.celdaId)} style={btnMini} title="Abrir este anuncio en la matriz">↗ Anuncio</button>
                <button type="button" onClick={() => copiar(f.g)} style={btnMini} title="Copiar todo el guion">{copiado === f.g.id ? '✓ Copiado' : '📋 Copiar'}</button>
                <button type="button" onClick={() => descargar(f)} style={btnMini} title="Descargar como .md">⬇ .md</button>
                <button type="button" onClick={() => onBorrar(f.celdaId, f.g.id)} aria-label="Borrar guion" style={{ ...btnMini, padding: '5px 8px' }}>✕</button>
              </div>
              {abierto && (
                <div style={{ padding: 12 }}>
                  {secciones.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {secciones.map((s, i) => (
                        <SeccionCard key={s.titulo + i} s={s} abiertoDefault={i < 1} icono="🎬" size="sm" />
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>{f.g.texto}</div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5, marginTop: 10 }}>Para editarlo, ábrelo en su anuncio con <b>↗ Anuncio</b>.</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
