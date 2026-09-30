'use client';

// =============================================================================
// TraerDeOtroProducto — elegir de qué producto, y cuáles
// =============================================================================
// Pedido de Martín (30/09/2026), textual: «al seleccionar traer de otro producto, se
// seleccione de que otro producto y aparezcan todas las columnas, los filtros, la barra
// de busqueda. Y que se pueda hacer selección múltiple».
//
// ⚠️ REEMPLAZA AL FORMULARIO, NO SE ABRE DEBAJO. Nació como un renglón al pie del alta
// («Traer uno de otro producto») y con eso el modal pedía dos cosas a la vez: cargar a
// alguien nuevo y buscar a alguien que ya está. Son dos tareas distintas y ninguna es un
// paso de la otra — por eso acá hay un «Atrás» y no un «Cancelar»: se vuelve al alta, no
// se cierra el modal.
//
// ⚠️ MUEVE, NO COPIA, y el botón lo dice con esa palabra. El producto de un lead es UNA
// columna (`leads.funnel_id`), así que traer a alguien acá es sacarlo de allá con su
// recorrido entero. Y entra por la etapa de ENTRADA del embudo destino: la etapa del
// embudo de origen es una clave SUYA y puede no existir acá — conservarla dibujaría al
// recién llegado como «fuera del embudo».

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { leadsDeProductoAction, moverLeadsAFunnelAction, type LeadParaTraer } from './actions';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** El tope de la PANTALLA, no el de la consulta: se dice cuántos quedaron afuera. */
const TOPE = 300;

const th: CSSProperties = {
  textAlign: 'left', fontFamily: MONO, fontSize: 10, letterSpacing: '.08em',
  textTransform: 'uppercase', color: 'var(--faint)', fontWeight: 600,
  padding: '0 10px 7px', whiteSpace: 'nowrap',
};
const td: CSSProperties = {
  padding: '9px 10px', fontFamily: SANS, fontSize: 13.5, color: 'var(--ink)',
  borderTop: '1px solid var(--border)', maxWidth: 220,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

export type ProductoOrigen = { id: number; nombre: string; esDefault: boolean };

export function TraerDeOtroProducto({ productos, destino, onAtras, onTraidos }: {
  /** Todos los productos del workspace, incluido el de destino (que se excluye acá). */
  productos: ProductoOrigen[];
  /** A dónde van. `null` = el producto del negocio. */
  destino: number | null;
  /** Volver al formulario de alta. No cierra el modal. */
  onAtras: () => void;
  onTraidos: (movidos: number, fallaron: number) => void;
}) {
  // ⚠️ El de destino se saca de la lista: «traer de este producto a este producto» no es
  // una opción, es un control que no hace nada. Y `null` resuelve al del negocio, que es
  // donde el tablero dibuja a los leads sin funnel.
  const delNegocio = productos.find((p) => p.esDefault) ?? null;
  const destinoId = destino ?? delNegocio?.id ?? null;
  const origenes = useMemo(
    () => productos.filter((p) => p.id !== destinoId),
    [productos, destinoId],
  );

  const [origen, setOrigen] = useState<number | null>(origenes[0]?.id ?? null);
  const [filas, setFilas] = useState<LeadParaTraer[] | null>(null);
  const [q, setQ] = useState('');
  const [etapa, setEtapa] = useState('');
  const [sel, setSel] = useState<number[]>([]);
  const [moviendo, startMover] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Al cambiar de producto se recarga TODO y se limpia la selección: arrastrar ids de un
  // producto a la lista de otro es mover gente que la persona ya no está mirando.
  useEffect(() => {
    if (origen == null) { setFilas([]); return; }
    let vivo = true;
    setFilas(null);
    setSel([]);
    setEtapa('');
    const pedido = origen === (delNegocio?.id ?? -1) ? null : origen;
    void leadsDeProductoAction(pedido)
      .then((r) => { if (vivo) setFilas(r.filas); })
      .catch(() => { if (vivo) setFilas([]); });
    return () => { vivo = false; };
  }, [origen, delNegocio?.id]);

  /** Las etapas que de verdad hay en esta lista: un filtro con opciones vacías no filtra nada. */
  const etapas = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of filas ?? []) if (!m.has(f.etapaKey)) m.set(f.etapaKey, f.etapa);
    return [...m].map(([key, label]) => ({ key, label }));
  }, [filas]);

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return (filas ?? []).filter((f) => {
      if (etapa && f.etapaKey !== etapa) return false;
      if (!texto) return true;
      return [f.nombre, f.email, f.telefono, f.empresa]
        .some((v) => (v ?? '').toLowerCase().includes(texto));
    });
  }, [filas, q, etapa]);

  const enPantalla = visibles.slice(0, TOPE);
  const ocultos = visibles.length - enPantalla.length;
  const todosTildados = enPantalla.length > 0 && enPantalla.every((f) => sel.includes(f.id));

  const alternar = (id: number) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const alternarTodos = () => {
    // ⚠️ Tilda lo VISIBLE, no lo que hay. Con un filtro puesto, un «todos» que se lleve lo
    // que está escondido mueve gente que la persona no vio.
    const ids = enPantalla.map((f) => f.id);
    setSel((p) => (todosTildados ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]));
  };

  const opciones: DropdownOption[] = origenes.map((p) => ({ value: String(p.id), label: p.nombre }));
  const opcionesEtapa: DropdownOption[] = [
    { value: '', label: 'Todas las etapas' },
    ...etapas.map((e) => ({ value: e.key, label: e.label })),
  ];

  if (!origenes.length) {
    return (
      <div>
        <p style={{ fontFamily: SANS, fontSize: 14, color: 'var(--dim)', margin: 0 }}>
          Solo tienes este producto. Crea otro para poder traer leads de ahí.
        </p>
        <button type="button" onClick={onAtras} style={btnAtras}>← Atrás</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
      {/* La barra: de dónde, qué busco, qué etapa. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--faint)', flex: 'none' }}>Traer de</span>
        <Dropdown
          value={String(origen ?? '')}
          options={opciones}
          onChange={(v) => setOrigen(Number(v))}
          ariaLabel="De qué producto traer"
          width={220}
        />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, email o teléfono"
          style={{
            flex: '1 1 220px', minWidth: 160, padding: '9px 12px', borderRadius: 10,
            border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
            color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none',
          }}
        />
        {/* El filtro de etapa sólo aparece cuando hay más de una: con una sola es un
            desplegable que no puede cambiar nada. */}
        {etapas.length > 1 && (
          <Dropdown
            value={etapa}
            options={opcionesEtapa}
            onChange={setEtapa}
            ariaLabel="Filtrar por etapa"
            width={190}
          />
        )}
      </div>

      {/* La tabla. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
            <tr>
              <th style={{ ...th, width: 34, padding: '10px 0 7px 12px' }}>
                <input type="checkbox" checked={todosTildados} onChange={alternarTodos}
                  aria-label="Tildar todos los de la lista"
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
              </th>
              <th style={th}>Nombre</th>
              <th style={th}>Empresa</th>
              <th style={th}>Email</th>
              <th style={th}>Teléfono</th>
              <th style={th}>Etapa</th>
            </tr>
          </thead>
          <tbody>
            {enPantalla.map((f) => {
              const on = sel.includes(f.id);
              return (
                <tr key={f.id} onClick={() => alternar(f.id)}
                  style={{ cursor: 'pointer', background: on ? 'var(--primary-weak)' : 'transparent' }}>
                  <td style={{ ...td, padding: '9px 0 9px 12px' }}>
                    <input type="checkbox" checked={on} readOnly tabIndex={-1}
                      aria-label={`Traer a ${f.nombre}`}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)', pointerEvents: 'none' }} />
                  </td>
                  <td style={{ ...td, fontWeight: 600 }}>{f.nombre}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{f.empresa || '—'}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{f.email || '—'}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{f.telefono || '—'}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{f.etapa}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Los tres estados, y son DISTINTOS: todavía no llegó · llegó vacío · el filtro
            no deja nada. Un solo texto para los tres haría pensar que el producto está
            vacío cuando lo que pasa es que el filtro no deja pasar a nadie. */}
        {filas === null && (
          <p style={{ fontFamily: SANS, fontSize: 13.5, color: 'var(--faint)', padding: '22px 14px', margin: 0 }}>Cargando…</p>
        )}
        {filas?.length === 0 && (
          <p style={{ fontFamily: SANS, fontSize: 13.5, color: 'var(--dim)', padding: '22px 14px', margin: 0 }}>Ese producto no tiene leads.</p>
        )}
        {!!filas?.length && visibles.length === 0 && (
          <p style={{ fontFamily: SANS, fontSize: 13.5, color: 'var(--dim)', padding: '22px 14px', margin: 0 }}>Nadie con esos filtros.</p>
        )}
      </div>

      {/* ⚠️ SI SE RECORTÓ, SE DICE. Una lista que corta en silencio se lee como que ahí
          termina el producto, y «tildar todos» dejaría afuera a los que no se ven. */}
      {ocultos > 0 && (
        <span style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--warn)' }}>
          Se muestran {TOPE} de {visibles.length}. Busca o filtra para ver el resto.
        </span>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={onAtras} disabled={moviendo} style={btnAtras}>← Atrás</button>
        <span style={{ flex: 1 }} />
        {err && <span style={{ fontFamily: SANS, fontSize: 13, color: 'var(--bad)' }}>{err}</span>}
        <button type="button" disabled={moviendo || !sel.length}
          onClick={() => startMover(async () => {
            setErr(null);
            const r = await moverLeadsAFunnelAction(sel, destino);
            if (!r.movidos && r.fallaron) { setErr('No se pudo mover ninguno.'); return; }
            onTraidos(r.movidos, r.fallaron);
          })}
          style={{
            padding: '11px 22px', borderRadius: 10, border: 'none',
            background: 'var(--primary)', color: '#fff', fontFamily: SANS,
            fontSize: 14, fontWeight: 700,
            cursor: moviendo || !sel.length ? 'default' : 'pointer',
            opacity: moviendo || !sel.length ? 0.45 : 1,
          }}>
          {moviendo ? 'Moviendo…' : sel.length ? `Mover ${sel.length} aquí` : 'Mover aquí'}
        </button>
      </div>
    </div>
  );
}

const btnAtras: CSSProperties = {
  flex: 'none', padding: '10px 16px', borderRadius: 10,
  border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--ink)', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};
