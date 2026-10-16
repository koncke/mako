'use client';

// =============================================================================
// GuionesGlobal — la galería con TODOS los guiones del negocio
// =============================================================================
// La matriz muestra los guiones de UNA celda por vez; esta vista los aplana:
// cada guion de cada celda, con el avatar y la motivación de compra de la que
// salió. Es lo que convierte al guion en una pieza que se sigue (¿cuáles quedaron
// en borrador?, ¿qué grabamos esta semana?) en vez de un texto enterrado.
//
// La barra pasó de SIETE controles en dos filas a TRES, y el ahorro no es
// estético: el pipeline de estados es a la vez el RESUMEN y el FILTRO, así que
// la fila de contadores desaparece sin perder información. Los <input type="date">
// nativos —que se ven distinto en cada navegador— se van adentro del popover.
// =============================================================================

import { useMemo, useState, type CSSProperties } from 'react';
import { conBuscador } from '../components/dropdown-reglas';

/** Para buscar sin que un acento o una mayúscula escondan el resultado. */
const sinAcentos = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
import { Input, NoResults, EmptyState, Tag, Button } from '../_ui';
import { GuionCard, GuionCardFantasma, GUION_CARD_MIN, type GuionCardData } from './GuionCard';
import { GuionLector } from './GuionLector';
import { masRecientePrimero } from './reglas';
import {
  ESTADOS_GUION, ESTADO_GUION_LABEL, COLOR_ESTADO_GUION,
  fechaGuion, diaGuion, type EstadoGuion, type GuionItem,
} from '../onboarding/guion-ui';

const MONO = "'Geist Mono', monospace";
const TODOS = '';

type Avatar = { id: string; nombre: string; segmento: string };
type Celda = { id: string; avatarId: string; nombre: string; guiones: GuionItem[] };
type AnguloLite = { id: string; nombre: string; emoji: string };

type Fila = GuionCardData & { celdaId: string; avatarId: string };

export function GuionesGlobal({ celdas, avatares, angulos, cargando, onEstado, onRetroceder, onBorrar, onIrAMatriz, onEditar, onEscribirPrimero }: {
  celdas: Celda[];
  avatares: Avatar[];
  angulos: AnguloLite[];
  cargando: boolean;
  onEstado: (celdaId: string, guionId: string, estado: EstadoGuion) => void;
  /** Salida desde 'publicado', que el chip ya no hace solo. Confirma arriba. */
  onRetroceder: (celdaId: string, guionId: string) => void;
  /** Devuelve si el guion se borró de verdad: el lector se cierra SOLO si sí.
   *  Antes se cerraba de una y la pregunta «¿Borrar?» quedaba flotando sobre la
   *  galería, así que cancelar te dejaba igual afuera del guion que estabas leyendo. */
  onBorrar: (celdaId: string, guionId: string) => Promise<boolean>;
  onIrAMatriz: (celdaId: string) => void;
  onEditar: (celdaId: string, guionId: string, texto: string) => void;
  onEscribirPrimero: () => void;
}) {
  const [q, setQ] = useState('');
  // Multi-selección: el pipeline es resumen y filtro a la vez. Vacío = todos.
  const [estadosOn, setEstadosOn] = useState<EstadoGuion[]>([]);
  const [fAngulo, setFAngulo] = useState(TODOS);
  const [fAvatar, setFAvatar] = useState(TODOS);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [menu, setMenuCrudo] = useState<null | 'raiz' | 'angulo' | 'avatar' | 'fecha'>(null);
  // El buscador de una lista del filtro (sexta tanda, general 11: «la barra de búsqueda en todos los
  // desplegables… al menos que tenga muy pocas opciones»): el mismo umbral que el Dropdown de la casa
  // (`conBuscador`), y arranca vacío en cada lista que se abre.
  const [buscaMenu, setBuscaMenu] = useState('');
  const setMenu = (m: typeof menu) => { setMenuCrudo(m); setBuscaMenu(''); };
  const coincide = (s: string) => sinAcentos(s).includes(sinAcentos(buscaMenu.trim()));
  const [abierto, setAbierto] = useState<string | null>(null);

  const emojiDe = useMemo(() => {
    const m = new Map(angulos.map((a) => [a.id, a.emoji]));
    return (g: GuionItem) => m.get(g.anguloId);
  }, [angulos]);

  const filas = useMemo<Fila[]>(() => {
    const nombre = new Map(avatares.map((a) => [a.id, a.nombre]));
    return celdas.flatMap((c) => c.guiones.map((g) => ({
      g, celdaId: c.id, celdaNombre: c.nombre,
      avatarId: c.avatarId, avatarNombre: nombre.get(c.avatarId) ?? 'Sin avatar',
      anguloEmoji: emojiDe(g),
    })));
  }, [celdas, avatares, emojiDe]);

  // Las opciones salen de los guiones REALES: un filtro que ofrece un ángulo sin
  // ningún guion solo entrega resultados vacíos.
  const angulosUsados = useMemo(() => {
    const s = new Set(filas.map((f) => f.g.anguloNombre).filter(Boolean));
    return [...s].sort((a, b) => a.localeCompare(b, 'es'));
  }, [filas]);

  const porEstado = useMemo(() => {
    const m = Object.fromEntries(ESTADOS_GUION.map((e) => [e, 0])) as Record<EstadoGuion, number>;
    for (const f of filas) m[f.g.estado] += 1;
    return m;
  }, [filas]);

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = filas.filter((f) => {
      if (estadosOn.length && !estadosOn.includes(f.g.estado)) return false;
      if (fAngulo && f.g.anguloNombre !== fAngulo) return false;
      if (fAvatar && f.avatarId !== fAvatar) return false;
      if (desde || hasta) {
        const dia = diaGuion(f.g.creadoEn);
        // Un guion sin fecha no puede afirmarse dentro de un rango: se oculta
        // cuando hay filtro de fechas, en vez de colarse.
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
    // El más nuevo primero y los «sin fecha» al final: la regla vive en ./reglas.ts, la misma que
    // ordena el historial del teléfono (app/m/copywriting).
    return out.sort((a, b) => masRecientePrimero(a.g, b.g));
  }, [filas, q, estadosOn, fAngulo, fAvatar, desde, hasta]);

  const nFiltros = (fAngulo ? 1 : 0) + (fAvatar ? 1 : 0) + (desde || hasta ? 1 : 0);
  const hayFiltro = !!(q || estadosOn.length || nFiltros);
  const limpiar = () => { setQ(''); setEstadosOn([]); setFAngulo(TODOS); setFAvatar(TODOS); setDesde(''); setHasta(''); };

  const togglePipeline = (e: EstadoGuion) =>
    setEstadosOn((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const filaAbierta = abierto ? filas.find((f) => f.g.id === abierto) ?? null : null;
  const avatarNombreDe = (id: string) => avatares.find((a) => a.id === id)?.nombre;

  // Devuelve si copió DE VERDAD: sin clipboard (http:// en la red local, permiso
  // denegado) el catch se tragaba el error y el botón decía «Copiado» igual.
  const copiar = async (g: GuionItem) => {
    try { await navigator.clipboard.writeText(g.texto); return true; } catch { return false; }
  };
  const descargar = (f: Fila) => {
    const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '');
    const md = `# Guion · ${f.celdaNombre}\n\nAvatar: ${f.avatarNombre}\nÁngulo: ${f.g.anguloNombre}\nEstructura: ${f.g.estructuraNombre || '—'}\nEstado: ${ESTADO_GUION_LABEL[f.g.estado]}\nCreado: ${fechaGuion(f.g.creadoEn)}\n\n${f.g.texto}\n`;
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `guion-${slug(f.g.anguloNombre || 'general')}-${slug(f.celdaNombre)}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  if (cargando && !filas.length) {
    return (
      <div style={grilla}>
        {Array.from({ length: 6 }, (_, i) => <GuionCardFantasma key={i} />)}
      </div>
    );
  }

  if (!filas.length) {
    return (
      <EmptyState
        titulo="Todavía no escribiste ningún guion"
        detalle="Cada anuncio de la matriz puede tener varios guiones, uno por ángulo, para testearlos por separado. MaKo elige el ángulo y lo escribe con tu voz."
        accion={{ label: '✦ Escribir el primero', onClick: onEscribirPrimero }}
      />
    );
  }

  return (
    <div>
      {/* ── La barra: tres controles ─────────────────────────────────────────
          ⚠️ El botón «Filtrar» y su popover viven FUERA del `.mk-scroll-x`. Esa
          clase es `overflow-x: auto`, y por la regla de CSS Overflow el eje que
          queda en `visible` pasa a `auto`: la caja recorta en LOS DOS ejes. Con
          el popover adentro, colgado con `top: calc(100% + 6px)` de una fila de
          ~44px, el menú caía justo fuera del área pintable y no se veía NADA —
          ángulo, avatar y fecha quedaban inalcanzables. El scroll de mobile lo
          sigue teniendo el pipeline, que es lo único que se pone ancho. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en el texto del guion…"
          aria-label="Buscar en el texto del guion"
          style={{ maxWidth: 280, minWidth: 190, flex: '1 1 190px' }} />

        <div className="mk-scroll-x" style={{ flex: '0 1 auto', minWidth: 0 }}>
          {/* El pipeline: resumen Y filtro. Por eso desapareció una fila entera. */}
          <div style={capsula} role="group" aria-label="Filtrar por estado">
            {ESTADOS_GUION.map((e) => {
              const on = estadosOn.includes(e);
              return (
                <button key={e} type="button" className="mk-pipe-item" onClick={() => togglePipeline(e)}
                  aria-pressed={on}
                  style={{
                    ...capsulaItem,
                    background: on ? 'var(--surface)' : 'transparent',
                    boxShadow: on ? '0 1px 2px rgba(18,21,27,.05)' : undefined,
                    color: on ? 'var(--ink)' : 'var(--dim)',
                    fontWeight: on ? 600 : 500,
                  }}>
                  <span aria-hidden style={{
                    width: 7, height: 7, borderRadius: '50%', flex: 'none',
                    background: on ? COLOR_ESTADO_GUION[e] : 'transparent',
                    border: on ? 'none' : '1px solid var(--border-strong)',
                  }} />
                  {ESTADO_GUION_LABEL[e]}
                  <span style={{ fontFamily: MONO, fontSize: 'var(--fs-meta)', fontVariantNumeric: 'tabular-nums', opacity: .75 }}>{porEstado[e]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Un botón, un popover con drill-down: el resto de los filtros. FUERA
            del contenedor con overflow — ver el comentario de arriba. */}
        <div style={{ position: 'relative', flex: 'none' }}>
          <Button variant={nFiltros ? 'secondary' : 'tertiary'}
            aria-haspopup="menu" aria-expanded={!!menu}
            onClick={() => setMenu(menu ? null : 'raiz')}>
            Filtrar{nFiltros ? ` · ${nFiltros}` : ''}
          </Button>
          {menu && (
            <>
              <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={popover} role="menu">
                  {menu === 'raiz' && (
                    <>
                      <MenuFila label="Ángulo" valor={fAngulo || 'Todos'} onClick={() => setMenu('angulo')} />
                      <MenuFila label="Avatar" valor={fAvatar ? (avatarNombreDe(fAvatar) ?? 'Uno') : 'Todos'} onClick={() => setMenu('avatar')} />
                      <MenuFila label="Fecha" valor={desde || hasta ? 'Acotada' : 'Toda'} onClick={() => setMenu('fecha')} />
                    </>
                  )}
                  {menu === 'angulo' && (
                    <MenuSub titulo="Ángulo" onVolver={() => setMenu('raiz')}
                      busqueda={conBuscador(angulosUsados.length + 1) ? { valor: buscaMenu, onCambiar: setBuscaMenu } : undefined}>
                      <MenuOpcion label="Todos los ángulos" on={!fAngulo} onClick={() => { setFAngulo(TODOS); setMenu('raiz'); }} />
                      {angulosUsados.filter(coincide).map((a) => (
                        <MenuOpcion key={a} label={a} on={fAngulo === a} onClick={() => { setFAngulo(a); setMenu('raiz'); }} />
                      ))}
                    </MenuSub>
                  )}
                  {menu === 'avatar' && (
                    <MenuSub titulo="Avatar" onVolver={() => setMenu('raiz')}
                      busqueda={conBuscador(avatares.length + 1) ? { valor: buscaMenu, onCambiar: setBuscaMenu } : undefined}>
                      <MenuOpcion label="Todos los avatares" on={!fAvatar} onClick={() => { setFAvatar(TODOS); setMenu('raiz'); }} />
                      {avatares.filter((a) => coincide(`${a.nombre} ${a.segmento ?? ''}`)).map((a) => (
                        <MenuOpcion key={a.id} label={a.nombre} sub={a.segmento} on={fAvatar === a.id} onClick={() => { setFAvatar(a.id); setMenu('raiz'); }} />
                      ))}
                    </MenuSub>
                  )}
                  {menu === 'fecha' && (
                    <MenuSub titulo="Fecha" onVolver={() => setMenu('raiz')}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 2px' }}>
                        <label style={campoFecha}>Desde
                          <Input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
                        </label>
                        <label style={campoFecha}>Hasta
                          <Input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
                        </label>
                        {(desde || hasta) && (
                          <Button variant="tertiary" onClick={() => { setDesde(''); setHasta(''); }}>Quitar el rango</Button>
                        )}
                      </div>
                    </MenuSub>
                  )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Conteo + chips de lo que está filtrando, uno por CATEGORÍA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontFamily: MONO, fontSize: 'var(--fs-meta)', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
          {visibles.length} de {filas.length}
        </span>
        {fAngulo && <ChipFiltro label={`Ángulo: ${fAngulo}`} onQuitar={() => setFAngulo(TODOS)} />}
        {fAvatar && <ChipFiltro label={`Avatar: ${avatarNombreDe(fAvatar) ?? '—'}`} onQuitar={() => setFAvatar(TODOS)} />}
        {(desde || hasta) && <ChipFiltro label={`Fecha: ${desde || '…'} → ${hasta || '…'}`} onQuitar={() => { setDesde(''); setHasta(''); }} />}
        {hayFiltro && <button type="button" onClick={limpiar} style={linkLimpiar}>Limpiar todo</button>}
      </div>

      {visibles.length ? (
        <div style={grilla}>
          {visibles.map((f) => (
            <GuionCard key={f.g.id} data={f}
              onAbrir={() => setAbierto(f.g.id)}
              onEstado={(e) => onEstado(f.celdaId, f.g.id, e)}
              onRetrocederEstado={() => onRetroceder(f.celdaId, f.g.id)} />
          ))}
        </div>
      ) : (
        <NoResults query={q || undefined} onLimpiar={limpiar} />
      )}

      {filaAbierta && (
        <GuionLector
          g={filaAbierta.g}
          celdaNombre={filaAbierta.celdaNombre}
          avatarNombre={filaAbierta.avatarNombre}
          anguloEmoji={filaAbierta.anguloEmoji}
          onCerrar={() => setAbierto(null)}
          onEstado={(e) => onEstado(filaAbierta.celdaId, filaAbierta.g.id, e)}
          onRetrocederEstado={() => onRetroceder(filaAbierta.celdaId, filaAbierta.g.id)}
          onEditar={(texto) => onEditar(filaAbierta.celdaId, filaAbierta.g.id, texto)}
          onBorrar={async () => { if (await onBorrar(filaAbierta.celdaId, filaAbierta.g.id)) setAbierto(null); }}
          onCopiar={() => copiar(filaAbierta.g)}
          onDescargar={() => descargar(filaAbierta)}
          irAlAnuncio={() => { setAbierto(null); onIrAMatriz(filaAbierta.celdaId); }}
        />
      )}
    </div>
  );
}

// ── Piezas del popover ───────────────────────────────────────────────────────
function MenuFila({ label, valor, onClick }: { label: string; valor: string; onClick: () => void }) {
  return (
    <button type="button" className="mk-menu-fila" onClick={onClick} style={menuFila}>
      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
      <span style={{ marginLeft: 'auto', color: 'var(--dim)', fontSize: 'var(--fs-sm)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor}</span>
      <span aria-hidden style={{ color: 'var(--faint)' }}>›</span>
    </button>
  );
}

function MenuSub({ titulo, onVolver, children, busqueda }: { titulo: string; onVolver: () => void; children: React.ReactNode;
  /** Con esto, un campo para buscar arriba de la lista. Quien llama decide cuándo (`conBuscador`) y filtra. */
  busqueda?: { valor: string; onCambiar: (s: string) => void } }) {
  return (
    <>
      <button type="button" className="mk-menu-fila" onClick={onVolver} style={{ ...menuFila, color: 'var(--dim)' }}>
        <span aria-hidden>‹</span> <span style={{ fontWeight: 600 }}>{titulo}</span>
      </button>
      {busqueda && (
        <input autoFocus value={busqueda.valor} onChange={(e) => busqueda.onCambiar(e.target.value)} placeholder="Buscar…"
          aria-label={`Buscar en ${titulo.toLowerCase()}`}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', margin: '2px 0 6px', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontSize: 'var(--fs-sm)', outline: 'none' }} />
      )}
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>{children}</div>
    </>
  );
}

function MenuOpcion({ label, sub, on, onClick }: { label: string; sub?: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="mk-menu-fila" onClick={onClick} style={{ ...menuFila, background: on ? 'var(--surface-2)' : 'transparent' }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: on ? 600 : 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>{sub}</span>}
      </span>
      {on && <span style={{ marginLeft: 'auto', color: 'var(--primary)' }}>✓</span>}
    </button>
  );
}

function ChipFiltro({ label, onQuitar }: { label: string; onQuitar: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Tag>{label}</Tag>
      <button type="button" onClick={onQuitar} aria-label={`Quitar ${label}`}
        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--faint)', fontSize: 12, padding: 2 }}>✕</button>
    </span>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const grilla: CSSProperties = {
  display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${GUION_CARD_MIN}px, 1fr))`, gap: 14,
};

const capsula: CSSProperties = {
  display: 'inline-flex', flex: 'none', gap: 4, padding: 4,
  background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
};

const capsulaItem: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7,
  minHeight: 'calc(var(--touch) - 8px)', padding: '0 13px', borderRadius: 'var(--r-sm)', border: 'none',
  fontFamily: "'Geist', sans-serif", fontSize: 'var(--fs-sm)', cursor: 'pointer',
  whiteSpace: 'nowrap', transition: 'background .14s ease, color .14s ease',
};

const popover: CSSProperties = {
  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, width: 268,
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
  boxShadow: '0 16px 40px rgba(18,21,27,.22)', padding: 6,
};

const menuFila: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
  minHeight: 'var(--touch)', padding: '6px 11px', borderRadius: 'var(--r-sm)', border: 'none', background: 'transparent',
  cursor: 'pointer', fontFamily: "'Geist', sans-serif", fontSize: 'var(--fs-sm)', color: 'var(--ink)',
};

const campoFecha: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 5,
  fontSize: 'var(--fs-meta)', color: 'var(--dim)', fontWeight: 600,
};

const linkLimpiar: CSSProperties = {
  border: 'none', background: 'none', cursor: 'pointer', padding: 0,
  fontFamily: "'Geist', sans-serif", fontSize: 'var(--fs-meta)', color: 'var(--primary)', fontWeight: 600,
};
