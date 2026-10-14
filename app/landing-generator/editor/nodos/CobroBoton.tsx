'use client';

// =============================================================================
// CobroBoton — «Cobrar con MaKo»: el producto que cobra un botón de la landing (tanda 4)
// =============================================================================
// Pedido (14/10/2026): el «Botón de pago» de una landing cobra por la PASARELA DE MaKo (Stripe del
// negocio) en vez de llevar a un link pegado. En el panel «Destino» de un botón, arriba del selector de
// siempre, la lista de productos ACTIVOS del catálogo: elegir uno guarda `href: 'pago:<id>'`
// (lib/editor-landing/pago-landing.ts). Sin Stripe conectado, una frase y el link a /integraciones; el
// botón sigue aceptando un link pegado (el selector de abajo).
//
// El estado (pasarelas + productos) se lee con la acción `cobro` de /api/landing-generator y se guarda
// en memoria por workspace, 30 s; al volver a la pestaña se relee (la persona conecta Stripe en
// /integraciones —se abre en otra pestaña— y vuelve). Lo usan este panel, el rótulo del botón
// (BotonesVista) y el aviso de Publicar (DialogoPublicar).
// =============================================================================

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link, { useWs } from '@/app/_ui/Link';
import { pedirDocs } from '../../cliente';
import { FilaMenu, Icono, MenuFilas } from '../BarraFormato';
import {
  TEXTO_NO_COBRA, pasarelaDeLanding, precioDe, productoDeHref, type EstadoCobroLanding,
} from '@/lib/editor-landing/pago-landing';

const VIGENCIA_MS = 30_000;
type Guardado = { estado: EstadoCobroLanding; at: number };
const cache = new Map<string, Guardado>();
const enCurso = new Map<string, Promise<EstadoCobroLanding | string>>();

/** Lo leído (o el error, como texto corto). Un pedido por workspace a la vez. */
function leer(clave: string): Promise<EstadoCobroLanding | string> {
  const ya = enCurso.get(clave);
  if (ya) return ya;
  const p = pedirDocs<'cobro'>({ accion: 'cobro' }).then((r) => {
    enCurso.delete(clave);
    if (!r.ok) return 'No pude leer tus productos.';
    cache.set(clave, { estado: r.cobro, at: Date.now() });
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
    // Volver a la pestaña relee si lo guardado venció: Stripe se conecta en /integraciones, en otra.
    const alVolver = () => { if (document.visibilityState === 'visible') pedir(false); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [activo, pedir]);

  return { estado, error, cargando, recargar: () => pedir(true) };
}

const CSS_COBRO = [
  '.gmx-cobro{padding:2px}',
  '.gmx-cobro .gmx-nota{padding:4px 8px 6px}',
  '.gmx-cobro .gmx-nota a{color:var(--gmx-azul);font-weight:600}',
  '.gmx-cobro-aviso{display:flex;gap:6px;align-items:flex-start;padding:4px 8px 6px;font-size:12px;color:var(--gmx-peligro)}',
].join('\n');

/**
 * La sección «Cobrar con MaKo» del panel de un botón. `valor` es el href del botón; elegir un producto
 * llama a `onElegir(id)` (quien llama guarda `pago:<id>`), y «Quitar cobro» deja el botón sin destino.
 */
export function PanelCobro({ valor, onElegir, onQuitar }: { valor: string; onElegir: (productoId: number) => void; onQuitar: () => void }) {
  const { estado, error, cargando, recargar } = useCobroLanding();
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
        <Link href="/integraciones" target="_blank" rel="noopener noreferrer">Integraciones</Link>
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
      {elegido !== null && (
        <MenuFilas etiqueta="Cobro">
          <FilaMenu nombre="Quitar cobro" icono={<Icono nombre="desenlazar" />} onClick={onQuitar} />
        </MenuFilas>
      )}
    </div>
  );
}

export default PanelCobro;
