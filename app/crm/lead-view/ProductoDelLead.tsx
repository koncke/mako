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
// producto, con la etapa de ESE tablero. El desplegable (en árbol desde el 12/10/2026) dice en
// cuáles está, y en cada uno:
//   · donde está → sus etapas; elegir una lo MUEVE ahí y ese funnel pasa a ser el que se mira;
//   · donde NO está → «Agregar a este funnel», que lo agrega en la etapa de entrada;
//   · «Quitar de este funnel», al fondo de sus etapas. Sólo con dos o más: sacarlo del único lo
//     dejaría en ningún tablero. El server lo vuelve a contar (esconder la opción no protege nada).
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
//
// ⚠️ DESDE EL 12/10/2026 ES UN SOLO DESPLEGABLE, EN ÁRBOL (`FunnelYEtapa`, abajo). Eran dos —el de
// productos y, al lado, el de la etapa del producto en vista— y Martín (punto 9): «Que sea solo 1
// desplegable de "PROSPECCIÓN" que es el funnel, y que sea un desplegable tipo arbol, que dentro de
// "PROSPECCIÓN" tenga mis etapas, y que ahí se configure eso... O le pueda agregar a otros funnel».
// Lo que se ofrece en cada funnel lo decide ./arbol-funnels.ts (puro, con test); las escrituras
// son las de siempre, de este hook. Se fueron `ProductoDelLead` y `EtapaEnProducto`: sin call
// sites, eran trabajo que no existe.

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/app/_ui/Link';
import { Toast, useToast, type ToastState } from '@/app/_ui/Toast';
import { IconoFunnel } from '@/app/_ui/iconos-menu';
import { Dropdown } from '@/app/components/Dropdown';
import {
  productosDeLaFichaAction, agregarAProductoAction, quitarDeProductoAction, deshacerQuitarAction,
  quitarLoteDeProductoAction, moverEtapaEnProductoAction, type ProductoFicha,
} from '../lead-funnel-actions';
import {
  funnelsDelArbol, seccionesDelArbol, funnelEnVista, leerEleccion, valorEtapa, type EtapaDelArbol,
} from './arbol-funnels';

export type { ProductoFicha };

const SANS = "'Geist', sans-serif";

/** Lo que la pantalla ya tiene de cada producto: alcanza para dibujar el botón antes de que el server conteste. */
export type ProductoOpcion = { id: number; nombre: string; esDefault: boolean };

type Deshacer = Parameters<typeof deshacerQuitarAction>[0];

// ── Las dos decisiones, puras ───────────────────────────────────────────────────
// Sin JSX ni nada de afuera: tests/lead-funnel-ficha.test.ts las saca de ESTE fuente y las ejecuta
// (el archivo no se puede importar en un test: trae server actions). La tercera —qué acción lleva
// cada funnel, `accionDelRenglon`— se mudó a ./arbol-funnels.ts con el árbol que la usa.

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
  /** La casa según los datos de la pantalla (el NULL ya resuelto al funnel del negocio). */
  casaId: number | null;
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
    foto, productos, puedeQuitar: puede, vista, idEnVista, casaId: casaDeLaPantalla, esperando, fallo,
    verProducto: setVistaId, agregar, quitar, moverEtapa, aviso: toast, cerrarAviso: clear,
  };
}

// ── El desplegable: los funnels y sus etapas, en árbol ─────────────────────────


/**
 * EL desplegable de la cabecera: «Funnel › Etapa» en el botón y, adentro, cada funnel con sus
 * etapas (punto 9 del 12/10/2026, ver la cabecera de este archivo y ./arbol-funnels.ts).
 *
 * Elegir una etapa MUEVE, en el funnel donde está:
 *   · en la CASA, por el camino de siempre (`onElegirCasa`: lo decide la ficha, que es la que tiene
 *     el wizard y la confirmación de mover — `pideWizardAlElegir`);
 *   · en un funnel AGREGADO, sólo su fila (`ficha.moverEtapa`), con su aviso y Deshacer.
 * Y en los dos casos el funnel pasa a ser el que se mira: el botón dice dónde quedó.
 *
 * ⚠️ ESPERA (apagado) en las dos ventanas cortas de `etapaEnEspera`: mover con las etapas de la
 * pantalla cuando el server dice que la casa es otra escribiría una clave que ahí no existe.
 */
export function FunnelYEtapa({ ficha, etapasCasa, etapaCasa, onElegirCasa, ariaLabel, width = 260, align = 'right' }: {
  ficha: FichaProductos;
  /** Las etapas de la CASA que tiene la pantalla: las mismas con las que decide el wizard. */
  etapasCasa: readonly EtapaDelArbol[];
  /** La etapa del lead en su casa, según la pantalla. */
  etapaCasa: string | null;
  /** Mover en la casa: la ficha decide si pasa por el wizard o por la confirmación. */
  onElegirCasa: (etapa: string) => void;
  ariaLabel: string;
  width?: number;
  align?: 'left' | 'right';
}) {
  const funnels = funnelsDelArbol({ foto: ficha.foto, productos: ficha.productos, casaId: ficha.casaId, etapasCasa, etapaCasa });
  const secciones = seccionesDelArbol(funnels, ficha.puedeQuitar);
  const enVista = funnelEnVista(funnels, ficha.idEnVista);
  const etapa = enVista?.etapas.find((s) => s.key === enVista.etapa) ?? null;
  // Mientras espera, el botón nombra el funnel que se va a mirar y NINGUNA etapa: la de la casa ahí
  // sería la de otro tablero, cambiada medio segundo después (ver `etapaEnEspera`).
  const nombreEnEspera = ficha.foto.find((f) => f.id === ficha.idEnVista)?.nombre ?? enVista?.nombre ?? 'Funnel';

  const elegir = (v: string) => {
    const e = leerEleccion(v);
    if (!e) return;
    const f = funnels.find((x) => x.id === e.funnelId);
    if (!f) return;
    // Las dos acciones sobre el funnel van por el server del hook, con el producto del server: sin
    // respuesta del server el árbol no las ofrece (sólo tiene la casa).
    const p = ficha.productos?.find((x) => x.id === e.funnelId);
    if (e.tipo === 'agregar') { if (p) ficha.agregar(p); return; }
    if (e.tipo === 'quitar') { if (p) ficha.quitar(p); return; }
    ficha.verProducto(f.id);
    if (f.esCasa) onElegirCasa(e.etapa);
    else if (p) ficha.moverEtapa(p, e.etapa);
  };

  return (
    <>
      <Dropdown
        value={ficha.esperando || !enVista || !etapa ? '' : valorEtapa(enVista.id, etapa.key)}
        secciones={secciones}
        onChange={elegir}
        disabled={ficha.esperando}
        placeholder="Funnel"
        ariaLabel={ariaLabel}
        align={align}
        width={width}
        icono={<span title="Funnel" style={{ display: 'flex', color: 'var(--dim)' }}><IconoFunnel /></span>}
        // El botón dice las DOS cosas, el funnel y su etapa: la pastilla de la etapa que estaba arriba
        // del nombre se fue (ahí van las etiquetas), así que éste es el único lugar donde se lee.
        botonLabel={ficha.esperando || !enVista ? <span>{nombreEnEspera}</span> : (
          <>
            <span>{enVista.nombre}</span>
            <span aria-hidden style={{ color: 'var(--faint)', margin: '0 6px' }}>›</span>
            <span style={{ fontWeight: 500 }}>{etapa?.label ?? 'Etapa borrada'}</span>
          </>
        )}
        buttonStyle={{ fontSize: 13, fontWeight: 600 }}
      />
      {ficha.fallo && !ficha.productos && <span style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--bad)' }}>No se pudo cargar</span>}
      {/* El aviso de agregar, quitar y mover en un agregado (con su Deshacer). */}
      <Toast state={ficha.aviso} onClose={ficha.cerrarAviso} />
    </>
  );
}
