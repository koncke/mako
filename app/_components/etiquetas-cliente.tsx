'use client';

// =============================================================================
// etiquetas-cliente — las etiquetas del CRM del lado del navegador (mig 0224)
// =============================================================================
// Una sola lectura y una sola forma de dibujar una etiqueta para las cuatro pantallas que las
// usan: la ficha del lead (chips), la barra de lote del CRM, el CRUD (app/crm/EtiquetasModal.tsx)
// y el paso «⚡ Acción» de un flujo (app/_components/EditorAccionMako.tsx). Desde la segunda tanda
// (08/10/2026) también la tarjeta 🏷️ del lienzo (app/chatbot/EditorEtiqueta.tsx); y el selector LOCAL
// que tenía app/chatbot/FlujoLienzo.tsx para la condición «tiene la etiqueta» se reemplaza por éste:
// dos selectores de la misma cosa son dos «＋ Nueva» que crean distinto.
//
// El dato sale de GET /api/crm/etiquetas; crear va por POST {action:'crear'} (sólo el admin: el
// server lo decide). La lista se guarda UNA vez por pestaña y se vuelve a pedir cuando alguien
// crea, edita o archiva (`avisarCambioEtiquetas`): sin eso, la etiqueta recién creada en el CRUD
// no aparecería en el desplegable de la ficha que está abierta al lado.
// =============================================================================

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown } from '@/app/components/Dropdown';
import type { Etiqueta } from '@/lib/etiquetas';

export type { Etiqueta };

const EVENTO = 'mako:etiquetas-cambiaron';
let cache: Promise<Etiqueta[]> | null = null;
/** Con las archivadas: sólo para NOMBRAR una que ya está elegida (ver `SelectorEtiqueta`). */
let cacheTodas: Promise<Etiqueta[]> | null = null;

function pedir(): Promise<Etiqueta[]> {
  cache ??= fetch('/api/crm/etiquetas', { cache: 'no-store' })
    .then((r) => r.json())
    .then((j: { ok?: boolean; etiquetas?: Etiqueta[]; error?: string }) => {
      if (!j.ok) throw new Error(j.error || 'No se pudieron leer las etiquetas.');
      return j.etiquetas ?? [];
    })
    .catch((e) => { cache = null; throw e; });
  return cache;
}

function pedirTodas(): Promise<Etiqueta[]> {
  cacheTodas ??= fetch('/api/crm/etiquetas?archivadas=1', { cache: 'no-store' })
    .then((r) => r.json())
    .then((j: { ok?: boolean; etiquetas?: Etiqueta[]; error?: string }) => {
      if (!j.ok) throw new Error(j.error || 'No se pudieron leer las etiquetas.');
      return j.etiquetas ?? [];
    })
    .catch((e) => { cacheTodas = null; throw e; });
  return cacheTodas;
}

/** Alguien creó, editó o archivó una etiqueta: las listas abiertas se vuelven a pedir. */
export function avisarCambioEtiquetas(): void {
  cache = null;
  cacheTodas = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO));
}

/**
 * La etiqueta `id` cuando NO está entre las vivas: archivada (la devuelve con su nombre) o borrada
 * del todo (`null`). `undefined` mientras no hace falta o mientras carga. Para que un valor ya
 * elegido se siga LEYENDO aunque no se pueda volver a elegir (AGENTS.md: un desplegable cuyo valor
 * no está entre sus opciones no muestra nada).
 */
function useEtiquetaFuera(id: number | null): Etiqueta | null | undefined {
  // Lo hallado lleva su id: lo que se devuelve se DERIVA de eso, sin resetear estado en el efecto.
  const [hallada, setHallada] = useState<{ id: number; e: Etiqueta | null } | null>(null);
  useEffect(() => {
    if (id == null) return;
    let vivo = true;
    pedirTodas().then((todas) => { if (vivo) setHallada({ id, e: todas.find((x) => x.id === id) ?? null }); })
      .catch(() => { if (vivo) setHallada({ id, e: null }); });
    return () => { vivo = false; };
  }, [id]);
  return id != null && hallada?.id === id ? hallada.e : undefined;
}

/** «Seguimiento (archivada)»: así se nombra una archivada donde todavía está puesta o elegida. */
export const nombreConEstado = (e: Pick<Etiqueta, 'nombre'> & { archivada_at?: string | null }): string =>
  e.archivada_at ? `${e.nombre} (archivada)` : e.nombre;

export type CrearEtiqueta = (nombre: string, color?: string) => Promise<{ ok: true; etiqueta: Etiqueta } | { ok: false; error: string }>;

/** Crea una etiqueta (sólo el admin). Devuelve el error del server tal cual. */
export const crearEtiquetaCliente: CrearEtiqueta = async (nombre, color) => {
  try {
    const r = await fetch('/api/crm/etiquetas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'crear', nombre, ...(color ? { color } : {}) }),
    });
    const j = await r.json() as { ok?: boolean; etiqueta?: Etiqueta; error?: string };
    if (!j.ok || !j.etiqueta) return { ok: false, error: j.error || 'No se pudo crear.' };
    avisarCambioEtiquetas();
    return { ok: true, etiqueta: j.etiqueta };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo crear.' };
  }
};

/** Las etiquetas vivas del negocio. `null` mientras carga. */
export function useEtiquetas(): { etiquetas: Etiqueta[] | null; error: string | null; recargar: () => void } {
  const [etiquetas, setEtiquetas] = useState<Etiqueta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    let vivo = true;
    pedir().then((e) => { if (vivo) { setEtiquetas(e); setError(null); } })
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [vuelta]);
  useEffect(() => {
    const otra = () => setVuelta((v) => v + 1);
    window.addEventListener(EVENTO, otra);
    return () => window.removeEventListener(EVENTO, otra);
  }, []);
  const recargar = useCallback(() => { cache = null; setVuelta((v) => v + 1); }, []);
  return { etiquetas, error, recargar };
}

/**
 * El chip de una etiqueta: su color de fondo, suave, y el nombre. Una ARCHIVADA que el lead
 * todavía tiene se dibuja apagada y con «(archivada)»: ya no cuenta en las automatizaciones
 * (decisión del 08/10/2026) y la fila queda como historia.
 */
export function ChipEtiqueta({ e, onSacar, ocupado, chico }: { e: Pick<Etiqueta, 'nombre' | 'color' | 'emoji'> & { archivada_at?: string | null }; onSacar?: () => void; ocupado?: boolean; chico?: boolean }) {
  const nombre = nombreConEstado(e);
  const estilo: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 220,
    padding: chico ? '2px 8px' : '4px 10px', borderRadius: 999,
    fontSize: chico ? 11.5 : 12.5, fontWeight: 600, lineHeight: 1.3,
    background: `${e.color}24`, color: e.archivada_at ? 'var(--dim)' : 'var(--ink)', border: `1px solid ${e.color}66`,
    opacity: ocupado ? 0.55 : e.archivada_at ? 0.75 : 1,
  };
  return (
    <span style={estilo} title={nombre}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: e.color, flex: 'none' }} />
      {e.emoji && <span aria-hidden>{e.emoji}</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
      {onSacar && (
        <button type="button" onClick={onSacar} disabled={ocupado} aria-label={`Sacar ${nombre}`} title="Sacar"
          style={{ border: 'none', background: 'transparent', color: 'var(--dim)', cursor: ocupado ? 'default' : 'pointer', padding: 0, marginLeft: 2, fontSize: 13, lineHeight: 1 }}>×</button>
      )}
    </span>
  );
}

const NUEVA = '__nueva__';

/**
 * Elegir una etiqueta de un desplegable, con «+ Nueva» al final (el molde de ManyChat: «Add Tag» →
 * una existente o crear una). Crear abre un campo de una línea en el lugar; Enter crea y elige.
 * `excluir` saca de la lista las que ya están puestas.
 */
export function SelectorEtiqueta({ value, onElegir, excluir, placeholder = 'Etiqueta', width, disabled, ariaLabel, buttonStyle, accion = false, icono }: {
  value: number | null;
  onElegir: (e: Etiqueta) => void;
  excluir?: ReadonlySet<number>;
  placeholder?: string;
  width?: number | string;
  disabled?: boolean;
  ariaLabel?: string;
  buttonStyle?: CSSProperties;
  /** Un desplegable de ACCIÓN («Poner etiqueta»): no refleja lo elegido. */
  accion?: boolean;
  icono?: ReactNode;
}) {
  const { etiquetas, error } = useEtiquetas();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [fallo, setFallo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // ⚠️ EL VALOR ELEGIDO SE NOMBRA AUNQUE YA NO SE PUEDA ELEGIR (revisión del 08/10/2026,
  // etiquetas-6/datos-5). La lista son las VIVAS: un paso «⚡ Acción» que apunta a una etiqueta
  // archivada mostraba «Elige una etiqueta», como si no tuviera ninguna, y no se veía a cuál
  // apuntaba. Entra como renglón apagado («Seguimiento (archivada)»), que se lee y no se elige.
  const fuera = !accion && value != null && etiquetas != null && !etiquetas.some((e) => e.id === value);
  const deFuera = useEtiquetaFuera(fuera ? value : null);
  const lista = (etiquetas ?? []).filter((e) => !excluir?.has(e.id));
  const opciones = [
    ...(fuera && deFuera !== undefined
      ? [{ value: String(value), label: deFuera ? nombreConEstado(deFuera) : 'Una etiqueta que ya no está', color: deFuera?.color, disabled: true }]
      : []),
    ...lista.map((e) => ({ value: String(e.id), label: `${e.emoji ? `${e.emoji} ` : ''}${e.nombre}`, color: e.color })),
    { value: NUEVA, label: 'Nueva', crear: true },
  ];

  const crear = async () => {
    const n = nombre.trim();
    if (!n || ocupado) return;
    setOcupado(true);
    setFallo(null);
    const r = await crearEtiquetaCliente(n);
    setOcupado(false);
    if (!r.ok) { setFallo(r.error); return; }
    setCreando(false);
    setNombre('');
    onElegir(r.etiqueta);
  };

  // ⚠️ CON UN ANCHO EN PORCENTAJE, EL ENVOLTORIO TAMBIÉN LO LLEVA. Era un `inline-flex` sin ancho,
  // así que el `width="100%"` del desplegable se resolvía contra una caja que medía lo que su
  // contenido: el botón quedaba del largo del texto y no llenaba la frase de la tarjeta 🏷️ ni el
  // campo del paso «⚡ Acción». Con un número, el desplegable ya se dimensiona solo.
  const envoltorio: CSSProperties = { display: 'inline-flex', flexDirection: 'column', gap: 4, minWidth: 0, ...(typeof width === 'string' ? { width } : null) };

  if (creando) {
    return (
      <span style={envoltorio}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input autoFocus value={nombre} maxLength={40} placeholder="Nombre" aria-label="Nombre de la etiqueta nueva"
            onChange={(ev) => setNombre(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); void crear(); } if (ev.key === 'Escape') { ev.stopPropagation(); setCreando(false); } }}
            style={{ height: 32, padding: '0 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, width: typeof width === 'number' ? Math.max(140, width - 70) : 160 }} />
          <button type="button" className="mk-icon-btn" onClick={() => void crear()} disabled={ocupado || !nombre.trim()} style={{ height: 32, padding: '0 10px', fontSize: 12.5, fontWeight: 600 }}>Crear</button>
          <button type="button" className="mk-icon-btn" onClick={() => { setCreando(false); setFallo(null); }} aria-label="Cancelar" style={{ height: 32, width: 32 }}>×</button>
        </span>
        {fallo && <span role="alert" style={{ fontSize: 12, color: 'var(--bad)' }}>{fallo}</span>}
      </span>
    );
  }

  return (
    <span style={envoltorio}>
      <Dropdown
        value={value != null ? String(value) : ''}
        options={opciones}
        placeholder={placeholder}
        disabled={disabled || !etiquetas}
        width={width}
        ariaLabel={ariaLabel ?? placeholder}
        buttonStyle={buttonStyle}
        resetAfterSelect={accion}
        icono={icono}
        onChange={(v) => {
          if (v === NUEVA) { setCreando(true); return; }
          const e = lista.find((x) => String(x.id) === v);
          if (e) onElegir(e);
        }}
      />
      {error && <span role="alert" style={{ fontSize: 12, color: 'var(--bad)' }}>{error}</span>}
    </span>
  );
}
