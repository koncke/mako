'use client';

// =============================================================================
// CobroBoton — «Cobrar con MaKo»: el producto que cobra un botón de la landing (tanda 4)
// =============================================================================
// Pedido (14/10/2026): el «Botón de pago» de una landing cobra por la PASARELA DE MaKo (Stripe del
// negocio) en vez de llevar a un link pegado. En el panel «Destino» de un botón, arriba del selector de
// siempre, la lista de productos ACTIVOS del catálogo: elegir uno guarda `href: 'pago:<id>'`
// (lib/editor-landing/pago-landing.ts). Sin Stripe conectado, una frase y «Conectar Stripe», que abre EL
// modal de /integraciones ahí mismo (app/_components/ConectarIntegracion.tsx; AGENTS.md «Para conectar una
// integración JAMÁS se sale de la tab», Martín 14/10/2026). Siempre Stripe, aunque el negocio tenga Mercado
// Pago: la landing cobra sólo con Stripe (`pasarelaDeLanding`). El botón sigue aceptando un link pegado
// (el selector de abajo).
//
// El estado (pasarelas + productos) se lee con la acción `cobro` de /api/landing-generator y se guarda
// en memoria por workspace, 30 s. Al quedar conectada en el modal se relee YA (`onConectado`), y lo
// leído les llega a TODOS los que lo usan: este panel, el rótulo del botón (BotonesVista) y el aviso de
// Publicar (DialogoPublicar). Volver a la pestaña también relee si venció (pudo conectarla en otra).
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import Link, { useWs } from '@/app/_ui/Link';
import { useConectarIntegracion } from '@/app/_components/ConectarIntegracion';
import { pedirDocs } from '../../cliente';
import { FilaMenu, Icono, MenuFilas } from '../BarraFormato';
import {
  TEXTO_NO_COBRA, pasarelaDeLanding, precioDe, productoDeHref, type EstadoCobroLanding,
} from '@/lib/editor-landing/pago-landing';

const VIGENCIA_MS = 30_000;
type Guardado = { estado: EstadoCobroLanding; at: number };
const cache = new Map<string, Guardado>();
const enCurso = new Map<string, Promise<EstadoCobroLanding | string>>();
/** Quién muestra el estado de cada workspace: una lectura nueva les llega a todos, no sólo al que la pidió. */
const oyentes = new Map<string, Set<(e: EstadoCobroLanding) => void>>();

/** Lo leído (o el error, como texto corto). Un pedido por workspace a la vez. */
function leer(clave: string): Promise<EstadoCobroLanding | string> {
  const ya = enCurso.get(clave);
  if (ya) return ya;
  const p = pedirDocs<'cobro'>({ accion: 'cobro' }).then((r) => {
    enCurso.delete(clave);
    if (!r.ok) return 'No pude leer tus productos.';
    cache.set(clave, { estado: r.cobro, at: Date.now() });
    oyentes.get(clave)?.forEach((f) => f(r.cobro));
    return r.cobro;
  });
  enCurso.set(clave, p);
  return p;
}

export type EstadoCobroEditor = { estado: EstadoCobroLanding | null; error: string | null; cargando: boolean; recargar: () => void };

/** Las pasarelas y los productos del negocio, para el editor. `activo: false` no pide nada. */
export function useCobroLanding(activo = true): EstadoCobroEditor {
  const ws = useWs();
  const clave = String(ws ?? 'propio');
  const [estado, setEstado] = useState<EstadoCobroLanding | null>(() => cache.get(clave)?.estado ?? null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const pedir = useCallback((forzar: boolean) => {
    const g = cache.get(clave);
    if (!forzar && g && Date.now() - g.at < VIGENCIA_MS) { setEstado(g.estado); setError(null); return; }
    setCargando(true);
    void leer(clave).then((r) => {
      setCargando(false);
      if (typeof r === 'string') setError(r);
      else { setEstado(r); setError(null); }
    });
  }, [clave]);

  useEffect(() => {
    if (!activo) return;
    pedir(false);
    // Lo que relea otro (el panel, al conectar Stripe en el modal) también llega acá: el rótulo del
    // botón no se queda diciendo «Conecta Stripe» con Stripe ya conectado.
    const alLeer = (e: EstadoCobroLanding) => { setEstado(e); setError(null); };
    const delWs = oyentes.get(clave) ?? new Set();
    delWs.add(alLeer);
    oyentes.set(clave, delWs);
    // Volver a la pestaña relee si lo guardado venció (la pudo conectar en otra pestaña).
    const alVolver = () => { if (document.visibilityState === 'visible') pedir(false); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { delWs.delete(alLeer); document.removeEventListener('visibilitychange', alVolver); };
  }, [activo, pedir, clave]);

  return { estado, error, cargando, recargar: () => pedir(true) };
}

const CSS_COBRO = [
  '.gmx-cobro{padding:2px}',
  '.gmx-cobro .gmx-nota{padding:4px 8px 6px}',
  '.gmx-cobro .gmx-nota a,.gmx-cobro-conectar{color:var(--gmx-azul);font-weight:600}',
  '.gmx-cobro-conectar{appearance:none;background:none;border:0;padding:0;cursor:pointer;text-decoration:none}',
  '.gmx-cobro-aviso{display:flex;gap:6px;align-items:flex-start;padding:4px 8px 6px;font-size:12px;color:var(--gmx-peligro)}',
].join('\n');

/**
 * La sección «Cobrar con MaKo» del panel de un botón. `valor` es el href del botón; elegir un producto
 * llama a `onElegir(id)` (quien llama guarda `pago:<id>`), y «Quitar cobro» deja el botón sin destino.
 */
export function PanelCobro({ valor, onElegir, onQuitar }: { valor: string; onElegir: (productoId: number) => void; onQuitar: () => void }) {
  const { estado, error, cargando, recargar } = useCobroLanding();
  const { abrir, abierto, modal } = useConectarIntegracion({ onConectado: recargar });
  // ⚠️ El panel vive en un `Flotante` (BarraFormato.tsx) que se CIERRA con cualquier `pointerdown` de
  //    afuera —un listener del documento, en captura: el `frenar` de la capa del modal, que es de React,
  //    llega tarde— y sólo perdona un clic dentro de una capa `[data-gmx-capa]` de `data-gmx-z` mayor.
  //    El modal de la integración va por portal al `body`, FUERA del panel: sin esta marca, el primer
  //    clic adentro del modal cierra el panel, y con él el modal (vive acá). Está encima por construcción
  //    (se abre desde el panel); su z real no sirve, porque el primer render de la pila la da en la base.
  useLayoutEffect(() => {
    if (!abierto) return;
    document.querySelectorAll<HTMLElement>('[data-capa-integracion]').forEach((el) => {
      el.setAttribute('data-gmx-capa', '');
      el.setAttribute('data-gmx-z', '2147483647');
    });
  }, [abierto]);
  const elegido = productoDeHref(valor);
  const pasarela = estado ? pasarelaDeLanding(estado.conectadas) : null;
  const inactivo = estado && elegido !== null && !estado.productos.some((p) => p.id === elegido);

  let cuerpo: ReactNode;
  if (!estado) {
    cuerpo = cargando || !error
      ? <div className="gmx-vacio"><span className="gmx-giro" role="status" aria-label="Cargando" /></div>
      : (
        <MenuFilas etiqueta="Productos">
          <div className="gmx-vacio">{error}</div>
          <FilaMenu nombre="Reintentar" icono={<Icono nombre="recargar" />} onClick={recargar} />
        </MenuFilas>
      );
  } else if (!pasarela) {
    const motivo = estado.conectadas.includes('mercadopago') ? 'solo-mercadopago' : 'sin-pasarela';
    cuerpo = (
      <p className="gmx-nota">
        {TEXTO_NO_COBRA[motivo]}{' '}
        <button type="button" className="gmx-cobro-conectar" data-conectar-integracion="stripe"
          onClick={(e) => { e.stopPropagation(); abrir('stripe'); }}>Conectar Stripe</button>
      </p>
    );
  } else if (!estado.productos.length) {
    cuerpo = (
      <p className="gmx-nota">
        No tienes productos activos.{' '}
        <Link href="/second-brain?area=productos" target="_blank" rel="noopener noreferrer">Catálogo</Link>
      </p>
    );
  } else {
    cuerpo = (
      <MenuFilas etiqueta="Productos">
        {estado.productos.map((p) => {
          const precio = precioDe(p);
          return (
            <FilaMenu key={p.id} nombre={p.nombre} icono={<Icono nombre="tarjeta-credito" />} atajo={precio ?? 'Sin precio'}
              apagado={!precio} titulo={precio ? undefined : TEXTO_NO_COBRA['sin-precio']}
              activo={elegido === p.id ? true : undefined} onClick={() => onElegir(p.id)} />
          );
        })}
      </MenuFilas>
    );
  }

  return (
    <div className="gmx-cobro">
      <style href="gmx-cobro" precedence="medium">{CSS_COBRO}</style>
      <div className="gmx-grupo">Cobrar con MaKo</div>
      {inactivo && <div className="gmx-cobro-aviso" role="alert"><Icono nombre="advertencia" tam={14} />{TEXTO_NO_COBRA['sin-producto']}</div>}
      {cuerpo}
      {modal}
      {elegido !== null && (
        <MenuFilas etiqueta="Cobro">
          <FilaMenu nombre="Quitar cobro" icono={<Icono nombre="desenlazar" />} onClick={onQuitar} />
        </MenuFilas>
      )}
    </div>
  );
}

export default PanelCobro;
