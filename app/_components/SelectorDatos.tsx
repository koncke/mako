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
//   · `<SelectorDatos grupos onElegir />` — el botón «{ }» y su panel, para un editor sin barra propia;
//   · `<ArbolDeDatos grupos onElegir />` — sólo el panel, para adentro de un `PopoverWA` que el editor
//     ya abre desde su barra.
//
// DÓNDE ESTÁ MONTADA (segunda pasada de la sexta tanda): `ArbolDeDatos` en el composer de WhatsApp
// (app/automations/EditorMensajeWhatsApp.tsx, que es también el de «MaKo en WhatsApp» y el de los avisos
// de Configuraciones › Notificaciones, app/agencia/FlujoAviso.tsx), en el asunto y el cuerpo del email
// (app/automations/EditorEmailGmail.tsx) y en el de Instagram / Messenger (app/automations/EditorMensajeSocial.tsx).
// El editor de marcas de /mensajes (app/agencia/EditorMensaje.tsx) se fue: lo reemplazó el de WhatsApp.
// La tarjeta MAKO del lienzo de Automations (app/automations/FlujoLienzo.tsx, `EditorMako`) le pasa el árbol del
// contexto con que Publicar la valida (`contextoDeTarjeta`). Y desde la undécima tanda también lo abre el campo
// mismo al tocar un `{{dato}}` (app/_components/CampoConDatos.tsx), con `seleccionado`. `SelectorDatos` (el
// botón suelto) no lo monta nadie.
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
//   · LA SUB-RAMA (undécima tanda, punto 6: «Próxima reunión» adentro de «Reuniones»): la dice el catálogo
//     (`ramasDelGrupo`), y se abre y se cierra como una rama.
//   · EL DATO ELEGIDO (undécima tanda, punto 7: «si los clickeo que salte el desplegable con el dato que elegí y
//     que se pueda cambiar allí mismo por otro dato»): `seleccionado` abre SU rama, lo marca con ✓ y lo trae a la
//     vista. Lo pasa el campo que se tocó (app/_components/CampoConDatos.tsx).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { Icon } from './icons';
import { PopoverWA } from '../whatsapp/_shared/ComposerWhatsApp';
import { buscarDatos, ramasDelGrupo, type GrupoDatos } from '@/lib/variables-aviso';

/** La rama (y la sub-rama) donde está la clave, o null si no está en el árbol. Pura (test). */
export function ramaDelDato(grupos: readonly GrupoDatos[], clave: string | null | undefined): { grupo: string; rama: string | null } | null {
  const k = (clave ?? '').toLowerCase();
  if (!k) return null;
  for (const g of grupos) {
    const d = g.items.find((x) => x.key === k);
    if (d) return { grupo: g.key, rama: d.rama ?? null };
  }
  return null;
}

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
function Dato({ label, ejemplo, rama, icono, activo, marcado, refBoton, onElegir }: { label: string; ejemplo: string; rama?: string; icono?: string; activo?: boolean; marcado?: boolean; refBoton?: Ref<HTMLButtonElement>; onElegir: () => void }) {
  return (
    <button type="button" role="menuitem" className="mk-dato" onClick={onElegir} ref={refBoton} aria-current={marcado || undefined}
      style={{ ...fila, padding: '7px 10px 7px 12px', background: activo || marcado ? 'var(--surface-2)' : 'transparent' }}>
      {icono && <span aria-hidden style={{ flex: 'none', display: 'inline-flex', color: 'var(--faint)' }}><Icon name={icono} size={15} /></span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {rama && <span style={{ color: 'var(--dim)', fontWeight: 500 }}>{rama} › </span>}{label}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--dim)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ejemplo.split('\n')[0]}</span>
      </span>
      {marcado && <span aria-hidden style={{ flex: 'none', color: 'var(--primary)', fontWeight: 700 }}>✓</span>}
    </button>
  );
}

/** El panel: el buscador y el árbol. Sin botón: para adentro de un popover que ya existe. */
export function ArbolDeDatos({ grupos, onElegir, seleccionado, vacio = 'Nada que coincida.' }: {
  /** Lo que ESTE mensaje puede resolver, ya agrupado (`datosOfrecidos`, lib/variables-aviso.ts). */
  grupos: GrupoDatos[];
  /** La clave elegida; el editor escribe `{{clave}}` donde estaba el cursor. */
  onElegir: (key: string) => void;
  /** El dato que ya está en el texto (el `{{clave}}` que se tocó): su rama abierta, con ✓ y a la vista. */
  seleccionado?: string | null;
  vacio?: string;
}) {
  const [q, setQ] = useState('');
  const elegido = ramaDelDato(grupos, seleccionado);
  // Abierta de entrada: la del dato elegido; sin él, la primera (casi siempre «Lead», lo que más se usa).
  const [abierta, setAbierta] = useState<string | null>(elegido?.grupo ?? grupos[0]?.key ?? null);
  /** Las sub-ramas CERRADAS (`grupo:rama`): de entrada, todas abiertas. */
  const [subCerradas, setSubCerradas] = useState<ReadonlySet<string>>(() => new Set());
  const [cursor, setCursor] = useState(0);
  const buscador = useRef<HTMLInputElement | null>(null);
  const botonElegido = useRef<HTMLButtonElement | null>(null);
  const resultados = useMemo(() => buscarDatos(grupos, q), [grupos, q]);
  const buscando = q.trim().length > 0;
  const claveElegida = elegido ? (seleccionado ?? '').toLowerCase() : null;

  // El foco al buscador al abrir. Con `rAF`: el popover se ubica en su primer layout. Y el dato elegido, a la vista
  // (el árbol scrollea: con 50 datos, el de abajo de «Reuniones» queda fuera).
  useEffect(() => {
    const id = requestAnimationFrame(() => { buscador.current?.focus(); botonElegido.current?.scrollIntoView?.({ block: 'nearest' }); });
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => { setCursor(0); }, [q]);
  const alternarSub = (k: string) => setSubCerradas((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const hoja = (d: GrupoDatos['items'][number]) => (
    <Dato key={d.key} label={d.label} ejemplo={d.ejemplo} marcado={d.key === claveElegida}
      refBoton={d.key === claveElegida ? botonElegido : undefined} onElegir={() => onElegir(d.key)} />
  );

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
              <Dato key={r.dato.key} label={r.dato.label} ejemplo={r.dato.ejemplo} rama={r.dato.rama ? `${r.grupo.titulo} › ${r.dato.rama}` : r.grupo.titulo} icono={r.grupo.icono}
                activo={i === cursor} marcado={r.dato.key === claveElegida} onElegir={() => onElegir(r.dato.key)} />
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
                  {ramasDelGrupo(g.items).map((r) => {
                    if (r.rama == null) return r.items.map(hoja);
                    const k = `${g.key}:${r.rama}`;
                    const sub = !subCerradas.has(k);
                    return (
                      <div key={k}>
                        <button type="button" className="mk-dato" aria-expanded={sub} onClick={() => alternarSub(k)} style={{ ...fila, padding: '7px 10px', fontWeight: 600 }}>
                          <span style={{ flex: 1, minWidth: 0 }}>{r.rama}</span>
                          <span style={{ flex: 'none', fontSize: 12, color: 'var(--faint)', fontWeight: 500 }}>{r.items.length}</span>
                          <span aria-hidden style={{ flex: 'none', display: 'inline-flex', color: 'var(--faint)', transform: sub ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>›</span>
                        </button>
                        {sub && (
                          <div role="group" aria-label={r.rama} style={{ marginLeft: 12, paddingLeft: 6, borderLeft: '1px solid var(--border)' }}>
                            {r.items.map(hoja)}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
