'use client';

// =============================================================================
// ProductoDelLead — en qué productos está este lead, y cuál se está mirando
// =============================================================================
// Pedido de Martín (06/10/2026), textual: «Le acabo de dar a un lead a "Mover a prueba" y se
// desapareció del producto principal de Mauricio. Eso JAMÁS debe pasar... No se debe "Mover" se
// debe agregar al otro producto... en el desplegable, tal como lo hacemos en Customer Success,
// cuando está en más de 2 productos, salta el botón de X para sacarlo de alguno... Y si hay
// productos en los que no está, en lugar del botón de X, un ícono que indique que se lo puede
// agregar.»
//
// ⚠️ HASTA EL 06/10 ESTE DESPLEGABLE MOVÍA: un lead vivía en UN producto y elegir otro lo sacaba
// del primero, detrás de un Confirm «Mover a X». Desde la mig 0207 un lead puede estar en varios:
// su CASA (`leads.funnel_id`, NULL = el del negocio) y una fila de `lead_funnel` por cada OTRO
// producto, con la etapa de ESE tablero. El desplegable ahora dice en cuáles está:
//   · elegir uno donde está → cambia el PRODUCTO EN VISTA, y la etapa de al lado pasa a ser la
//     suya (`EtapaEnProducto`, abajo);
//   · elegir uno donde NO está, o tocar su «+» → lo agrega, en la etapa de entrada de ese producto;
//   · la X → lo saca de ése. Sólo con dos o más: sacarlo del único lo dejaría en ningún tablero. El
//     server lo vuelve a contar (esconder la X no protege nada).
// Actúa al toque, sin «¿estás seguro?», y el aviso trae Deshacer: el molde es Customer Success
// (app/customer-success/FichaEntrega.tsx).
//
// ⚠️ LO QUE AGREGAR NO HACE (decisión v1, lib/lead-funnel.ts): escribe la fila y una línea de
// historial. No toca estado, monto, nutrición ni la etiqueta de WhatsApp: todo eso sigue a la casa.
// Por eso mover la etapa en un producto agregado no abre el wizard — no hay venta que registrar ahí.
//
// ⚠️ `funnel_id = null` ES EL PRODUCTO DEL NEGOCIO, no «sin producto» (medido el 30/09/2026: los
// 1.530 leads de los 6 workspaces lo tenían en NULL). Acá se trabaja SIEMPRE con ids reales: el
// server resuelve el NULL al leer, y la escritura de la casa pasa por `casaParaEscribir`.
//
// ⚠️ UNA SOLA FUENTE PARA LAS DOS PUERTAS. El estado vive en `useProductosDeLaFicha` y lo usan el
// pop-up (app/crm/LeadSheet.tsx) y la ruta (app/crm/[id]/LeadDetailBody.tsx): es la misma ficha, y
// ya se pagó que una se quedara con la versión anterior.

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { Toast, useToast, type ToastState } from '@/app/_ui/Toast';
import { Dropdown, type DropdownOption, type DropdownGroup } from '@/app/components/Dropdown';
import { BAND_LABEL, type StageBand } from '@/lib/pipeline';
import {
  productosDeLaFichaAction, agregarAProductoAction, quitarDeProductoAction, deshacerQuitarAction,
  quitarLoteDeProductoAction, moverEtapaEnProductoAction, type ProductoFicha,
} from '../lead-funnel-actions';

export type { ProductoFicha };

const SANS = "'Geist', sans-serif";

/** Lo que la pantalla ya tiene de cada producto: alcanza para dibujar el botón antes de que el server conteste. */
export type ProductoOpcion = { id: number; nombre: string; esDefault: boolean };

type Deshacer = Parameters<typeof deshacerQuitarAction>[0];

// ── Las tres decisiones, puras ──────────────────────────────────────────────────
// Sin JSX ni nada de afuera: tests/lead-funnel-ficha.test.ts las saca de ESTE fuente y las ejecuta
// (el archivo no se puede importar en un test: trae server actions).

/** Qué botón lleva el renglón de un producto: la X donde está (sólo con dos o más), el «+» donde no. */
export function accionDelRenglon(esta: boolean, puedeQuitar: boolean): 'quitar' | 'agregar' | null {
  if (!esta) return 'agregar';
  return puedeQuitar ? 'quitar' : null;
}

/**
 * El producto en vista: el pedido, si el lead ESTÁ ahí; si no, su casa.
 *
 * Es un CÁLCULO y no un estado que se dispara: si se quita el producto que se estaba mirando, la
 * vista vuelve sola a la casa, y si se deshace, vuelve sola al producto — sin un camino por gesto.
 */
export function productoEnVista<P extends { id: number; esta: boolean; esCasa: boolean }>(productos: readonly P[] | null, pedido: number | null): P | null {
  if (!productos) return null;
  return productos.find((p) => p.id === pedido && p.esta) ?? productos.find((p) => p.esCasa) ?? null;
}

/**
 * ¿El selector de etapa tiene que esperar? En dos ventanas, las dos cortas:
 *   · todavía no se sabe en qué productos está y lo que se mira NO es la casa de los datos de la
 *     pantalla (se abrió desde el tablero de otro producto): dibujar la etapa de la casa ahí sería
 *     mostrar la de otro tablero y cambiarla medio segundo después;
 *   · el server dice que la casa es otra que la de los datos de la pantalla (se acaba de quitar la
 *     casa y la ficha todavía no se releyó). Las etapas que tiene la pantalla son las del producto
 *     anterior, y mover con ellas escribiría una clave que en la casa nueva no existe.
 */
export function etapaEnEspera(o: { cargado: boolean; fallo: boolean; idEnVista: number | null; vistaEsCasa: boolean; casaDeLaPantalla: number | null }): boolean {
  if (!o.cargado) return !o.fallo && o.idEnVista != null && o.idEnVista !== o.casaDeLaPantalla;
  return o.vistaEsCasa && o.idEnVista !== o.casaDeLaPantalla;
}

// ── El estado de la ficha ───────────────────────────────────────────────────────

export type FichaProductos = {
  /** Lo que la pantalla ya tenía: los productos del workspace. */
  foto: readonly ProductoOpcion[];
  /** En cuáles está y con qué etapa. `null` mientras el server no contestó. */
  productos: ProductoFicha[] | null;
  puedeQuitar: boolean;
  /** El producto que se mira. `null` = todavía no se sabe: la ficha se comporta como en la casa. */
  vista: ProductoFicha | null;
  /** El id que nombra el botón, también antes de que el server conteste. */
  idEnVista: number | null;
  /** El selector de etapa espera (ver `etapaEnEspera`). */
  esperando: boolean;
  fallo: string | null;
  verProducto: (id: number) => void;
  agregar: (p: ProductoFicha) => void;
  quitar: (p: ProductoFicha) => void;
  /** Mueve la tarjeta en un producto AGREGADO. La casa se mueve por el camino de siempre (wizard). */
  moverEtapa: (p: ProductoFicha, etapa: string) => void;
  aviso: ToastState;
  cerrarAviso: () => void;
};

export function useProductosDeLaFicha({ leadId, casa, foto, onCasaCambiada }: {
  leadId: number;
  /** `leads.funnel_id` tal como lo tienen los datos de la pantalla (NULL = el del negocio). */
  casa: number | null | undefined;
  foto: readonly ProductoOpcion[];
  /**
   * Se quitó la casa, o se deshizo: la etapa y las etapas que tiene la pantalla quedaron viejas.
   * La ruta no lo necesita (su `router.refresh()` le trae el lead de nuevo); el pop-up sí, porque
   * sus datos los trajo una action al abrir y el refresh no los toca.
   */
  onCasaCambiada?: () => void;
}): FichaProductos {
  const router = useRouter();
  // ⚠️ EL TABLERO DESDE EL QUE SE ABRIÓ: el de un producto secundario viaja con `?funnel=N`, el del
  // negocio no lleva nada. Si el lead está en N, la ficha abre mirando N; si no, su casa.
  const sp = useSearchParams();
  const crudo = Number(sp?.get('funnel'));
  const pedido = Number.isFinite(crudo) && crudo > 0 ? crudo : null;
  // Con un solo producto no hay nada que elegir ni que agregar: ni se pregunta.
  const hayVarios = foto.length >= 2;

  const [productos, setProductos] = useState<ProductoFicha[] | null>(null);
  const [puede, setPuede] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [vistaId, setVistaId] = useState<number | null>(pedido);
  const [ocupado, startTrabajo] = useTransition();
  const { toast, show, clear } = useToast();

  // ⚠️ OTRO LEAD EN LA MISMA FICHA: el modal no siempre se desmonta (con la ficha en la caché del
  // LeadEditModal se re-pinta con el lead nuevo), y un estado sembrado no se resiembra solo.
  const [prevLead, setPrevLead] = useState(leadId);
  if (prevLead !== leadId) {
    setPrevLead(leadId); setProductos(null); setPuede(false); setFallo(null); setVistaId(pedido);
  }

  const aplicar = useCallback((r: Awaited<ReturnType<typeof productosDeLaFichaAction>>) => {
    if (r.ok) { setProductos(r.productos); setPuede(r.puedeQuitar); setFallo(null); }
    else setFallo(r.error);
  }, []);

  useEffect(() => {
    if (!hayVarios) return;
    let vivo = true;
    productosDeLaFichaAction(leadId)
      .then((r) => { if (vivo) aplicar(r); })
      .catch(() => { if (vivo) setFallo('No se pudo cargar.'); });
    return () => { vivo = false; };
  }, [leadId, hayVarios, aplicar]);

  const casaDeLaPantalla = casa != null ? Number(casa) : (foto.find((p) => p.esDefault)?.id ?? null);
  const vista = productoEnVista(productos, vistaId);
  const idEnVista = vista?.id
    ?? (productos ? casaDeLaPantalla : (vistaId != null && foto.some((p) => p.id === vistaId) ? vistaId : casaDeLaPantalla));
  const esperando = hayVarios && etapaEnEspera({ cargado: productos != null, fallo: fallo != null, idEnVista, vistaEsCasa: !!vista?.esCasa, casaDeLaPantalla });

  /** Después de escribir: la lista de nuevo, el tablero de atrás, y la ficha si cambió la casa. */
  const despues = async (casaCambio: boolean) => {
    aplicar(await productosDeLaFichaAction(leadId));
    router.refresh();
    if (casaCambio) onCasaCambiada?.();
  };
  const fallar = (msg: string) => show(msg, undefined, 'bad');

  const agregar = (p: ProductoFicha) => {
    if (ocupado || p.esta) return;
    startTrabajo(async () => {
      const r = await agregarAProductoAction(leadId, p.id);
      if (!r.ok) { fallar(r.error); return; }
      // Se pasa a mirar el producto recién agregado: es lo que hace Customer Success (ahí se elige
      // el producto ANTES de agregarlo) y es lo que dice dónde quedó.
      setVistaId(p.id);
      await despues(false);
      if (!r.agregado) return;   // ya estaba: no hay nada que deshacer
      // ⚠️ EL DESHACER BORRA SÓLO LA FILA (`quitarLoteDeProductoAction`), no `quitarDeProductoAction`:
      // si en esos cinco segundos la fila pasó a ser la casa, «quitar» promovería otra o se negaría;
      // borrar la fila que este gesto creó no puede tocar una casa.
      show(`Agregado a ${p.nombre}`, () => startTrabajo(async () => {
        const u = await quitarLoteDeProductoAction([leadId], p.id);
        if (!u.ok) { fallar(u.error); return; }
        await despues(false);
      }));
    });
  };

  const quitar = (p: ProductoFicha) => {
    if (ocupado || !p.esta) return;
    startTrabajo(async () => {
      const r = await quitarDeProductoAction(leadId, p.id);
      if (!r.ok) { fallar(r.error); return; }
      const d: Deshacer = r.deshacer;
      await despues(!!d.casaAntes);
      show(`Quitado de ${p.nombre}`, () => startTrabajo(async () => {
        const u = await deshacerQuitarAction(d);
        if (!u.ok) { fallar(u.error); return; }
        await despues(!!d.casaAntes);
      }));
    });
  };

  const moverEtapa = (p: ProductoFicha, etapa: string) => {
    // La casa NO pasa por acá: su etapa es la del lead y se mueve con el wizard de siempre.
    if (ocupado || p.esCasa || !etapa || etapa === p.etapa) return;
    const nombre = p.etapas.find((s) => s.key === etapa)?.label ?? etapa;
    const poner = (k: string | null) => setProductos((ps) => ps && ps.map((x) => (x.id === p.id ? { ...x, etapa: k } : x)));
    const previa = p.etapa;
    poner(etapa);   // al toque: se ve movida antes de que el server conteste
    startTrabajo(async () => {
      const r = await moverEtapaEnProductoAction(leadId, p.id, etapa);
      if (!r.ok) { poner(previa); fallar(r.error); return; }
      router.refresh();
      show(`Movido a ${nombre}`, () => {
        poner(r.antes);
        startTrabajo(async () => {
          const u = await moverEtapaEnProductoAction(leadId, p.id, r.antes);
          if (!u.ok) { poner(etapa); fallar(u.error); return; }
          router.refresh();
        });
      });
    });
  };

  return {
    foto, productos, puedeQuitar: puede, vista, idEnVista, esperando, fallo,
    verProducto: setVistaId, agregar, quitar, moverEtapa, aviso: toast, cerrarAviso: clear,
  };
}

// ── El desplegable de productos ─────────────────────────────────────────────────

function IconoProducto() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.6 7.8 12 3 3.4 7.8 12 12.6z" /><path d="M3.4 7.8v8.4L12 21v-8.4" /><path d="M20.6 7.8v8.4L12 21" />
    </svg>
  );
}

/** La cruz de Customer Success (viewBox 16, trazo 1.5). */
function IconoQuitar() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/** El «+» del mismo molde, para los productos donde no está. */
function IconoAgregar() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function ProductoDelLead({ ficha, rotulo = true }: {
  ficha: FichaProductos;
  /**
   * Con `false`, sin la palabra «Producto» al lado: va el ícono adentro del botón, como en
   * la barra de lote del tablero. Es lo que usa la fila de controles del pop-up, donde el
   * rótulo suelto quedaba «todo amontonado» (Martín, 06/10/2026).
   */
  rotulo?: boolean;
}) {
  const { foto, productos } = ficha;
  // Con un solo producto no hay nada que elegir, y un desplegable de una opción es un
  // control que promete una decisión que no existe.
  if (foto.length < 2) return null;

  // ⚠️ LOS PRODUCTOS EN LOS QUE NO ESTÁ SE OFRECEN IGUAL, con «No está» en gris (como Customer
  // Success): el pedido es justamente poder agregarlo. Y mientras el server no contestó se dibujan
  // los de la pantalla, sin marcas y con el desplegable apagado: pintar «No está» sin saberlo
  // afirmaría ceros.
  const opciones: DropdownOption[] = productos
    ? productos.map((p) => {
      const accion = accionDelRenglon(p.esta, ficha.puedeQuitar);
      return {
        value: String(p.id),
        label: p.nombre,
        sub: p.esta ? undefined : 'No está',
        acciones: accion === 'quitar'
          ? [{ icono: <IconoQuitar />, title: 'Quitar de este producto', tone: 'bad' as const, cierra: true, onClick: () => ficha.quitar(p) }]
          : accion === 'agregar'
            ? [{ icono: <IconoAgregar />, title: 'Agregar a este producto', cierra: true, onClick: () => ficha.agregar(p) }]
            : undefined,
      };
    })
    : foto.map((p) => ({ value: String(p.id), label: p.nombre }));
  const enVista = foto.find((p) => p.id === ficha.idEnVista)?.nombre ?? 'el del negocio';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {rotulo && <span style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--faint)' }}>Producto</span>}
        <Dropdown
          value={String(ficha.idEnVista ?? '')}
          options={opciones}
          onChange={(v) => {
            const p = productos?.find((x) => String(x.id) === v);
            if (!p) return;
            // Donde está, elegirlo es MIRARLO; donde no, es lo mismo que su «+».
            if (p.esta) ficha.verProducto(p.id); else ficha.agregar(p);
          }}
          disabled={!productos}
          placeholder="Producto"
          ariaLabel={`Producto en vista: ${enVista}`}
          align={rotulo ? 'right' : 'left'}
          icono={rotulo ? undefined : <span title="Producto" style={{ display: 'flex', color: 'var(--dim)' }}><IconoProducto /></span>}
          buttonStyle={rotulo ? undefined : { fontSize: 13, fontWeight: 600 }}
        />
      </div>
      {ficha.fallo && !productos && <span style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--bad)' }}>No se pudo cargar</span>}
      {/* El aviso de las dos piezas (este desplegable y `EtapaEnProducto`). Va acá porque las dos
          existen sólo con dos productos o más, que es cuando este componente se dibuja. */}
      <Toast state={ficha.aviso} onClose={ficha.cerrarAviso} />
    </>
  );
}

// ── La etapa en un producto AGREGADO ────────────────────────────────────────────

/**
 * El selector de etapa cuando lo que se mira NO es la casa: las etapas de ESE producto y la etapa
 * de su fila. Mover escribe sólo la fila (`moverEtapaEnProductoAction`), sin wizard y sin tocar el
 * recorrido de la casa, con aviso y Deshacer.
 */
export function EtapaEnProducto({ ficha, producto, width, align = 'left', columnas = false }: {
  ficha: FichaProductos;
  producto: ProductoFicha;
  width?: number;
  align?: 'left' | 'right';
  /** Como el selector de la ruta: Pipeline + Salida | Nutrición, lado a lado. */
  columnas?: boolean;
}) {
  const deBanda = (b: StageBand): DropdownOption[] => producto.etapas
    .filter((s) => ((s.band as StageBand | undefined) ?? 'pipeline') === b)
    .map((s) => ({ value: s.key, label: s.label, color: s.dot, ...(columnas ? {} : { sub: BAND_LABEL[b] }) }));
  const grupo = (title: string, b: StageBand): DropdownGroup[] => { const o = deBanda(b); return o.length ? [{ title, options: o }] : []; };
  const cols = [[...grupo('Pipeline', 'pipeline'), ...grupo('Salida', 'salidas')], grupo('Nutrición', 'nutricion')].filter((c) => c.length);
  return (
    <Dropdown
      value={producto.etapa ?? ''}
      placeholder="Etapa borrada"
      align={align}
      width={width}
      ariaLabel={`Etapa en ${producto.nombre}`}
      onChange={(k) => ficha.moverEtapa(producto, k)}
      {...(columnas
        ? { columns: cols }
        : { options: [...deBanda('pipeline'), ...deBanda('nutricion'), ...deBanda('salidas')], buttonStyle: { fontSize: 13, fontWeight: 600 } })}
    />
  );
}
