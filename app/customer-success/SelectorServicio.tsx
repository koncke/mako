'use client';

// =============================================================================
// SelectorServicio — de qué servicio es el tablero
// =============================================================================
// «El desplegable de productos se debería ver exactamente igual como este» (Martín,
// 05/10/2026, señalando el del CRM). Y se ve igual porque es LA MISMA PIEZA: el
// primitive `Dropdown` del repo ya trae las tres cosas de esa captura —el lápiz por
// renglón (`acciones`), el «Nuevo producto» con su ＋ (`crear`) y el renglón gris con filete
// (`sutil`)—. Lo que no se pudo importar es el `SelectorFunnel` del CRM, y el porqué
// importa:
//
// ⚠️ EL DEL CRM ELIGE UN EMBUDO, ÉSTE ELIGE UN PRODUCTO. Allá el `value` es
// `funnels.id` y del producto sólo viaja el NOMBRE; acá el tablero es por producto
// (mig 0188), así que el id tiene que ser el del producto. Son dos preguntas distintas
// que se ven igual, y copiar el componente habría traído el id equivocado.
//
// ⚠️ Y EL OTRO NAVEGA. El del CRM hace `router.push('/crm?funnel=N')`: cambiar de
// producto es cambiar de página. Acá es estado local — el tablero ya está en memoria y
// cambiar de servicio no pide nada.
//
// ─────────────────────────────────────────────────────────────────────────────
// «SI CREO UN PRODUCTO ACÁ, DEBE APARECER EN EL CRM»
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ NO ALCANZA CON `upsertProducto`, y es el error que parecía obvio. El desplegable
// del CRM lista EMBUDOS, no productos: un producto suelto no aparece ahí por más que
// esté en la tabla. Lo que hace falta es la cadena entera
// —`producto → oferta_productos → oferta → funnel_ofertas → funnel`, con el funnel
// naciendo CON sus etapas— y eso ya está escrito en `crearProductoConFunnel`
// (lib/producto-con-funnel.ts). Al revés ya funcionaba: el alta del CRM escribe en
// `productos` con `activo: true`, que es justo lo que lee esta pantalla.

import { useState } from 'react';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';

export type ServicioElegible = { id: number; nombre: string };

/** El lápiz de cada renglón. Mismo molde y mismo tamaño que el del CRM. */
function LapizIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function SelectorServicio({ servicios, servicio, onServicio, onEditarEtapas, onNuevo, puedeEditar }: {
  servicios: ServicioElegible[];
  servicio: number | null;
  onServicio: (id: number) => void;
  /** El lápiz: abre las etapas de ESE servicio, que no tiene por qué ser el activo. */
  onEditarEtapas: (id: number) => void;
  /** Crea el producto con su embudo, para que también aparezca en el CRM. */
  onNuevo: (nombre: string) => Promise<string | null>;
  /** Sin esto no hay lápiz ni alta: cambiar las etapas le cambia el tablero al equipo. */
  puedeEditar: boolean;
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [mal, setMal] = useState('');
  const [guardando, setGuardando] = useState(false);

  const actual = servicios.find((s) => s.id === servicio) ?? servicios[0] ?? null;
  if (!actual) return null;

  // ⚠️ EL ACTIVO VA PRIMERO, como en el CRM: el desplegable se abre con el que estás
  // mirando arriba, y no hay que buscarlo en una lista alfabética.
  const enOrden = [actual, ...servicios.filter((s) => s.id !== actual.id)];
  const opciones: DropdownOption[] = enOrden.map((s) => ({
    value: String(s.id),
    label: s.nombre,
    ...(puedeEditar ? {
      acciones: [{
        icono: <LapizIcon />,
        title: `Editar las etapas de ${s.nombre}`,
        onClick: () => onEditarEtapas(s.id),
        // El lápiz ABRE el editor: sin cerrar, el menú queda flotando encima del modal
        // (vive en un portal con su propio z-index) y le tapa el título.
        cierra: true,
      }],
    } : {}),
  }));
  if (puedeEditar) {
    // ⚠️ SIN «＋» EN EL RÓTULO: `crear` ya lo dibuja. Con los dos salía «＋＋ Nuevo
    // producto»; el del CRM (`CrmToolbar.tsx`) dice 'Nuevo producto' a secas.
    opciones.push({ value: '__nuevo', label: 'Nuevo producto', crear: true });
  }

  const crear = async () => {
    const n = nombre.trim();
    if (!n) return;
    setGuardando(true); setMal('');
    const err = await onNuevo(n);
    setGuardando(false);
    if (err) { setMal(err); return; }
    setCreando(false); setNombre('');
  };

  return (
    <>
      <Dropdown
        value={String(actual.id)}
        options={opciones}
        width={210}
        align="right"
        ariaLabel="Producto que dibuja el tablero"
        onChange={(v) => { if (v === '__nuevo') { setCreando(true); setMal(''); } else onServicio(Number(v)); }}
      />

      {/* El alta es un renglón, no un modal: lo único que hace falta es el NOMBRE. El
          precio y el tipo se completan en el catálogo de productos — acá se está
          eligiendo qué tablero mirar, no cerrando el modelo de negocio. */}
      {creando && (
        <span className="ss-nuevo">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus
            placeholder="Nombre del producto" aria-label="Nombre del producto nuevo"
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void crear(); }
              if (e.key === 'Escape') { e.stopPropagation(); setCreando(false); setMal(''); }
            }} />
          <button type="button" onClick={() => void crear()} disabled={!nombre.trim() || guardando}>
            {guardando ? 'Creando…' : 'Crear'}
          </button>
          <button type="button" className="ss-x" onClick={() => { setCreando(false); setMal(''); }}
            aria-label="No crear">✕</button>
          {mal && <span className="ss-mal">{mal}</span>}
        </span>
      )}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </>
  );
}

const CSS = `
.ss-nuevo{ display:inline-flex; align-items:center; gap:6px; flex:none; }
.ss-nuevo input{ width:170px; padding:6px 10px; border:1px solid var(--border); border-radius:9px;
  font:inherit; font-size:13px; background:var(--surface); color:var(--ink); }
.ss-nuevo button{ padding:6px 11px; border:1px solid var(--border-strong); border-radius:9px;
  background:var(--surface); color:var(--ink); font:inherit; font-size:12.5px; font-weight:600;
  cursor:pointer; white-space:nowrap; }
.ss-nuevo button:disabled{ opacity:.5; cursor:default; }
.ss-x{ padding:6px 9px !important; color:var(--dim) !important; }
.ss-mal{ font-size:12px; color:var(--bad); }
`;
