'use client';

// =============================================================================
// SelectorDatos — el «{ }» de TODOS los editores: un árbol con íconos y buscador
// =============================================================================
// Pedido de Martín (09/10/2026, sexta tanda): «Faltan datos que se pueden poner en el botón de
// "{}"... Siempre recuerda los desplegables tipo arbol y con los íconos al lado... Y esto para
// todos los lugares donde usamos el botón de {}, siempre lo mismo en todos lados» (WhatsApp 10) y
// «hazlo bien y siempre como arbol los desplegables» (MaKo en WhatsApp 4).
//
// Hasta acá había TRES «{ }» distintos: la lista plana del composer de WhatsApp (EditorMensajeWhatsApp),
// el desplegable por secciones del editor de avisos y del email (app/agencia/EditorMensaje.tsx) y el
// de la tarjeta MAKO (FlujoLienzo, `DATOS_MAKO`). Cada uno con su catálogo. Ésta es la pieza, y el
// catálogo es UNO (lib/variables-aviso.ts, `datosOfrecidos`).
//
// Dos formas de montarla, según el editor tenga o no su propio popover:
//   · `<SelectorDatos grupos onElegir />` — el botón «{ }» y su panel (el editor de avisos, la
//     tarjeta MAKO, el email);
//   · `<ArbolDeDatos grupos onElegir />` — sólo el panel, para adentro de un `PopoverWA` que el editor
//     ya abre desde su barra (el composer de WhatsApp).
//
// Lo que dibuja, y por qué así:
//   · CADA GRUPO ES UNA RAMA con su ícono, su nombre y cuántos datos tiene; se abre y se cierra.
//     Uno abierto a la vez: con diez ramas, abrir todas es la lista de 70 filas de la que el árbol
//     viene a salvar.
//   · EL BUSCADOR va arriba, siempre (con 70 datos no hay «pocas opciones»). Con texto, el árbol
//     se aplana a los resultados, cada uno con su rama al lado. Busca en el rótulo, el ejemplo y el
//     TOKEN: la palabra que uno tiene en la cabeza («saldo») suele ser la del token.
//   · CADA DATO muestra su rótulo y un valor de ejemplo, que es lo que contesta «¿qué va a decir?».
//   · INSERTA TEXTO PLANO: `onElegir(key)` y el editor escribe `{{key}}`. Un chip lo borraría el
//     serializador del editor rico (lib/variables-aviso.ts).
//   · LO QUE NO SE PUEDE RESOLVER NO LLEGA ACÁ: el filtro es del catálogo (`datosOfrecidos`), no de
//     esta pieza. Una segunda implementación de la regla de alcance sería la que se queda vieja.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './icons';
import { PopoverWA } from '../whatsapp/_shared/ComposerWhatsApp';
import { buscarDatos, type GrupoDatos } from '@/lib/variables-aviso';

const SANS = "'Geist', sans-serif";
const caja: CSSProperties = {
  width: 320, maxWidth: 'calc(100vw - 24px)', maxHeight: 420, display: 'flex', flexDirection: 'column',
  background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12,
  boxShadow: '0 12px 34px rgba(18,21,27,.18)', fontFamily: SANS, overflow: 'hidden',
};
const fila: CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: 'none', borderRadius: 8,
  background: 'transparent', color: 'var(--ink)', fontSize: 13.5, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
};

/** Una hoja: el rótulo y, debajo, el valor de ejemplo. `rama` = el grupo, en los resultados de la búsqueda. */
function Dato({ label, ejemplo, rama, icono, activo, onElegir }: { label: string; ejemplo: string; rama?: string; icono?: string; activo?: boolean; onElegir: () => void }) {
  return (
    <button type="button" role="menuitem" className="mk-dato" onClick={onElegir}
      style={{ ...fila, padding: '7px 10px 7px 12px', background: activo ? 'var(--surface-2)' : 'transparent' }}>
      {icono && <span aria-hidden style={{ flex: 'none', display: 'inline-flex', color: 'var(--faint)' }}><Icon name={icono} size={15} /></span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {rama && <span style={{ color: 'var(--dim)', fontWeight: 500 }}>{rama} › </span>}{label}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ejemplo.split('\n')[0]}</span>
      </span>
    </button>
  );
}

/** El panel: el buscador y el árbol. Sin botón: para adentro de un popover que ya existe. */
export function ArbolDeDatos({ grupos, onElegir, vacio = 'Nada que coincida.' }: {
  /** Lo que ESTE mensaje puede resolver, ya agrupado (`datosOfrecidos`, lib/variables-aviso.ts). */
  grupos: GrupoDatos[];
  /** La clave elegida; el editor escribe `{{clave}}` donde estaba el cursor. */
  onElegir: (key: string) => void;
  vacio?: string;
}) {
  const [q, setQ] = useState('');
  // Abierta de entrada: la primera rama (casi siempre «Lead», lo que más se usa).
  const [abierta, setAbierta] = useState<string | null>(grupos[0]?.key ?? null);
  const [cursor, setCursor] = useState(0);
  const buscador = useRef<HTMLInputElement | null>(null);
  const resultados = useMemo(() => buscarDatos(grupos, q), [grupos, q]);
  const buscando = q.trim().length > 0;

  // El foco al buscador al abrir. Con `rAF`: el popover se ubica en su primer layout.
  useEffect(() => { const id = requestAnimationFrame(() => buscador.current?.focus()); return () => cancelAnimationFrame(id); }, []);
  useEffect(() => { setCursor(0); }, [q]);

  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!buscando || !resultados.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(resultados.length - 1, c + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); onElegir(resultados[Math.min(cursor, resultados.length - 1)]!.dato.key); }
  };

  return (
    <div role="menu" aria-label="Datos" style={caja}>
      <style>{'.mk-dato:hover{background:var(--surface-2)!important}'}</style>
      <div style={{ flex: 'none', padding: 8, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', height: 36, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)' }}>
          <span aria-hidden style={{ display: 'inline-flex', color: 'var(--faint)' }}><Icon name="search" size={15} /></span>
          <input ref={buscador} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={tecla} placeholder="Buscar un dato" aria-label="Buscar un dato"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5 }} />
        </div>
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: 6 }}>
        {buscando ? (
          resultados.length
            ? resultados.map((r, i) => (
              <Dato key={r.dato.key} label={r.dato.label} ejemplo={r.dato.ejemplo} rama={r.grupo.titulo} icono={r.grupo.icono} activo={i === cursor} onElegir={() => onElegir(r.dato.key)} />
            ))
            : <div style={{ padding: '10px 12px', color: 'var(--faint)', fontSize: 13 }}>{vacio}</div>
        ) : grupos.map((g) => {
          const on = abierta === g.key;
          return (
            <div key={g.key}>
              <button type="button" className="mk-dato" aria-expanded={on} onClick={() => setAbierta(on ? null : g.key)} style={{ ...fila, fontWeight: 600 }}>
                <span aria-hidden style={{ flex: 'none', display: 'inline-flex', color: on ? 'var(--primary)' : 'var(--dim)' }}><Icon name={g.icono} size={17} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>{g.titulo}</span>
                <span style={{ flex: 'none', fontSize: 12, color: 'var(--faint)', fontWeight: 500 }}>{g.items.length}</span>
                <span aria-hidden style={{ flex: 'none', display: 'inline-flex', color: 'var(--faint)', transform: on ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>›</span>
              </button>
              {on && (
                <div role="group" aria-label={g.titulo} style={{ marginLeft: 18, paddingLeft: 6, borderLeft: '1px solid var(--border)' }}>
                  {g.items.map((d) => <Dato key={d.key} label={d.label} ejemplo={d.ejemplo} onElegir={() => onElegir(d.key)} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * El botón «{ }» y su panel. `boton` cambia la cara del botón (un editor con su propia barra); sin
 * él, el «{ }» de la casa. Sin `grupos` no hay botón: un «{ }» que abre una lista vacía se lee roto.
 */
export function SelectorDatos({ grupos, onElegir, disabled, boton, etiqueta = 'Insertar un dato' }: {
  grupos: GrupoDatos[];
  onElegir: (key: string) => void;
  disabled?: boolean;
  /** La cara del botón. Default: «{ }». */
  boton?: ReactNode;
  etiqueta?: string;
}) {
  const [ancla, setAncla] = useState<HTMLButtonElement | null>(null);
  const [abierto, setAbierto] = useState(false);
  if (!grupos.length) return null;
  return (
    <>
      <button type="button" ref={setAncla} disabled={disabled} title={etiqueta} aria-label={etiqueta} aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        style={{
          height: 32, minWidth: 38, padding: '0 9px', borderRadius: 8, border: '1px solid var(--border-strong)',
          background: abierto ? 'var(--surface-2)' : 'var(--surface)', color: abierto ? 'var(--primary)' : 'var(--dim)',
          fontFamily: "'Geist Mono', monospace", fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>{boton ?? '{ }'}</button>
      {abierto && (
        <PopoverWA ancla={ancla} etiqueta="Datos" onCerrar={() => setAbierto(false)}>
          <ArbolDeDatos grupos={grupos} onElegir={(k) => { onElegir(k); setAbierto(false); }} />
        </PopoverWA>
      )}
    </>
  );
}
