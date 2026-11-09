'use client';

// =============================================================================
// crear/ConLaExtension — «Copiar con la extensión»: la página que MaKo no puede bajar, copiada desde tu navegador
// =============================================================================
// Martín (9/11/2026): «habíamos quedado en actualizar la extensión de Mako para que se pueda replicar por allí. Y de esa
// manera siempre vamos a poder replicar cualquier landing». Cuando el servidor no baja la página (Beacons detrás de
// Cloudflare, lovable.dev, el «Vercel Security Checkpoint» de vidalytics.com) o la foto no sale en la ventana (una app de
// Vite en módulos), esto pide a la extensión que la abra a la vista; la persona pasa la barrera si la hay, toca el ícono de
// MaKo y la foto vuelve acá (lib/editor-landing/replica-extension-cliente.ts). La barrera no se evade: la pasa ella.
//
// `useReplicaConExtension(alTomar)`: el estado y los pasos; `alTomar` recibe la foto ya juzgada (la página, no la
// verificación de un antibots) y la pantalla sigue con ella como con la del lector. `BloqueExtension`: lo que se dibuja.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { EXTENSION_URL_TIENDA, lineaDeVersion } from '@/lib/extension-tienda';
import {
  MENSAJE_REPLICA, SILENCIO_LECTURA_MS, VERSION_REPLICA, alEstadoDeReplica, cancelarReplica, extensionReplica, juzgarEntrega,
  mensajeDeFallo, nuevoPedido, pedirReplica, soltarEntrega, tomarEntrega, volverAEntrega,
} from '@/lib/editor-landing/replica-extension-cliente';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { Ico } from '../Ico';

export type EstadoExtension =
  | { fase: 'quieta' }
  | { fase: 'pidiendo' }
  | { fase: 'abierta' }
  | { fase: 'leyendo'; hecho: number }
  | { fase: 'tomando' }
  | { fase: 'lista' }
  /** `aviso`: algo que la persona resuelve (la verificación, la pestaña cerrada); si no, un error nuestro. `entrega`: se
   * puede volver a la pestaña. `instalar`: falta la extensión, o es de antes. */
  | { fase: 'falla'; mensaje: string; aviso: boolean; entrega?: string; instalar?: boolean };

/** Lo que vuelve de la extensión, ya juzgado: la foto de la copia idéntica y el texto que se veía. */
export type FotoDeLaExtension = { url: string; foto: Record<string, unknown>; texto: string; titulo: string };

const versionDelPuente = (): string | null => (typeof document === 'undefined' ? null : document.documentElement.getAttribute('data-mako-puente'));

export function useReplicaConExtension(alTomar: (f: FotoDeLaExtension) => void): {
  estado: EstadoExtension;
  /** Abrir `url` con la extensión. */
  empezar: (url: string) => void;
  /** Tomar una entrega que ya está en la extensión (Replicar abierto por la extensión, `?extension=`). */
  recibir: (entrega: string, url?: string) => void;
  /** Volver a la pestaña (lo que se vio era la verificación). */
  volver: () => void;
  cancelar: () => void;
} {
  const [estado, setEstado] = useState<EstadoExtension>({ fase: 'quieta' });
  const alTomarVivo = useRef(alTomar);
  useEffect(() => { alTomarVivo.current = alTomar; }, [alTomar]);
  const pedido = useRef<string | null>(null);
  const url = useRef<string | null>(null);
  const dejar = useRef<(() => void) | null>(null);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; dejar.current?.(); dejar.current = null; }; }, []);
  const poner = useCallback((e: EstadoExtension) => { if (montado.current) setEstado(e); }, []);

  const recibir = useCallback((entrega: string, urlPedida?: string) => {
    void (async () => {
      poner({ fase: 'tomando' });
      const e = await tomarEntrega(window, entrega);
      if (!montado.current) return;
      if (!e) { poner({ fase: 'falla', mensaje: MENSAJE_REPLICA.vencida, aviso: false }); return; }
      const j = juzgarEntrega(e);
      if (j !== 'ok') { poner({ fase: 'falla', mensaje: MENSAJE_REPLICA[j], aviso: true, entrega }); return; }
      soltarEntrega(window, entrega);
      dejar.current?.();
      dejar.current = null;
      poner({ fase: 'lista' });
      alTomarVivo.current({ url: urlPedida ?? url.current ?? e.url, foto: e.foto, texto: e.texto, titulo: e.titulo });
    })();
  }, [poner]);

  /** Escuchar lo que pasa con `p` (la lectura en la pestaña, la foto lista, la pestaña cerrada). */
  const escuchar = useCallback((p: string) => {
    dejar.current?.();
    pedido.current = p;
    dejar.current = alEstadoDeReplica(window, p, (a) => {
      if (a.fase === 'leyendo') poner({ fase: 'leyendo', hecho: a.hecho });
      // La pestaña sigue abierta: tocar el ícono otra vez vuelve a «leyendo» (seguimos escuchando).
      else if (a.fase === 'fallo') poner({ fase: 'falla', mensaje: mensajeDeFallo(a.motivo), aviso: a.motivo !== 'excepcion' });
      else if (a.fase === 'cerrada') { dejar.current?.(); dejar.current = null; poner({ fase: 'falla', mensaje: MENSAJE_REPLICA.cerrada, aviso: true }); }
      else recibir(a.entrega);
    });
  }, [poner, recibir]);

  const empezar = useCallback((u: string) => {
    const ext = extensionReplica(versionDelPuente());
    if (ext !== 'si') {
      const frase = ext === 'no' ? MENSAJE_REPLICA.sinExtension : MENSAJE_REPLICA.vieja;
      // Si la tienda todavía no publica una versión que sepa replicar, instalar o actualizar no la traería: se dice eso.
      const linea = lineaDeVersion(VERSION_REPLICA, frase);
      poner({ fase: 'falla', mensaje: linea, aviso: true, instalar: linea === frase });
      return;
    }
    url.current = u;
    poner({ fase: 'pidiendo' });
    void pedirReplica(window, u).then((r) => {
      if (!montado.current) return;
      if (!r.ok) { poner({ fase: 'falla', mensaje: MENSAJE_REPLICA.noAbrio, aviso: false }); return; }
      escuchar(r.pedido);
      poner({ fase: 'abierta' });
    });
  }, [escuchar, poner]);

  const volver = useCallback(() => {
    if (estado.fase !== 'falla' || !estado.entrega) return;
    // Sin pedido (la entrega vino por la dirección), se arma uno: con él la extensión vuelve a avisar acá.
    const p = pedido.current ?? nuevoPedido();
    escuchar(p);
    const entrega = estado.entrega;
    void volverAEntrega(window, entrega, undefined, p).then((ok) => {
      if (!montado.current) return;
      poner(ok ? { fase: 'abierta' } : { fase: 'falla', mensaje: MENSAJE_REPLICA.vencida, aviso: false });
    });
  }, [estado, escuchar, poner]);

  const cancelar = useCallback(() => {
    if (pedido.current) cancelarReplica(window, pedido.current);
    dejar.current?.();
    dejar.current = null;
    pedido.current = null;
    poner({ fase: 'quieta' });
  }, [poner]);

  // Sin noticias de la lectura en mucho rato, se cortó (la página se recargó o se fue): se dice, no se espera para siempre.
  useEffect(() => {
    if (estado.fase !== 'leyendo') return;
    const t = setTimeout(() => poner({ fase: 'falla', mensaje: MENSAJE_REPLICA.cortada, aviso: true }), SILENCIO_LECTURA_MS);
    return () => clearTimeout(t);
  }, [estado, poner]);

  return { estado, empezar, recibir, volver, cancelar };
}

/** El rótulo del botón (corto: lo que hace). */
export const BOTON_EXTENSION = 'Copiar con la extensión';

/**
 * Lo que se dibuja: el botón y, mientras tanto, en qué va. `primario`: el botón es la acción principal (la página no se
 * pudo leer de ninguna otra forma).
 */
export function BloqueExtension({ estado, onEmpezar, onVolver, onCancelar, primario = false }: {
  estado: EstadoExtension;
  onEmpezar: () => void;
  onVolver: () => void;
  onCancelar: () => void;
  primario?: boolean;
}) {
  if (estado.fase === 'lista') return null;
  const esperando = estado.fase === 'pidiendo' || estado.fase === 'abierta' || estado.fase === 'leyendo' || estado.fase === 'tomando';
  return (
    <div className="gp-ext" role="group" aria-label="Copiar con la extensión de MaKo">
      <style href="gp-ext" precedence="medium">{CSS_EXT}</style>
      {!esperando && (
        <div className="gp-ext-acciones">
          <button type="button" className={`gp-btn ${primario ? 'gp-btn-primario' : 'gp-btn-contorno'}`} onClick={onEmpezar}>
            <Ico n="rompecabezas" t={14} /> {estado.fase === 'falla' ? 'Volver a intentar' : BOTON_EXTENSION}
          </button>
          {estado.fase === 'falla' && estado.entrega && (
            <button type="button" className="gp-btn gp-btn-contorno" onClick={onVolver}>
              <Ico n="globo" t={14} /> Ir a la pestaña
            </button>
          )}
          {estado.fase === 'falla' && estado.instalar && (
            <a className="gp-btn gp-btn-contorno" href={EXTENSION_URL_TIENDA} target="_blank" rel="noreferrer noopener">
              <Ico n="descargar" t={14} /> Agregar a Chrome
            </a>
          )}
        </div>
      )}
      {estado.fase === 'quieta' && <p className="gp-ext-nota">Abre la página en tu navegador y la copia tal cual, aunque bloquee a MaKo.</p>}
      {esperando && (
        <p className="gp-ext-estado" role="status">
          <span className="gp-giro" aria-hidden />
          {estado.fase === 'pidiendo' ? 'Abriendo la página…'
            : estado.fase === 'abierta' ? MENSAJE_REPLICA.abierta
              : estado.fase === 'leyendo' ? `Copiando la página en tu navegador… ${estado.hecho} %`
                : 'Trayendo la copia…'}
          {(estado.fase === 'abierta' || estado.fase === 'leyendo') && (
            <button type="button" className="gp-ext-cancelar" onClick={onCancelar}>Cancelar</button>
          )}
        </p>
      )}
      {estado.fase === 'falla' && (estado.aviso
        ? <p className="gp-ext-nota" role="status">{estado.mensaje}</p>
        : <p className="gp-ext-error" role="alert">{estado.mensaje}<ReportarASoporte /></p>)}
    </div>
  );
}

/** La hoja (tokens de CSS_GP, con respaldo: también se monta adentro del Diagnóstico). */
const CSS_EXT = `
.gp .gp-ext { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; width: 100%; }
.gp .gp-ext-acciones { display: flex; flex-wrap: wrap; gap: 8px; }
.gp .gp-ext-nota { margin: 0; font-size: 13px; color: var(--gp-tenue, #66666b); }
.gp .gp-ext-error { margin: 0; font-size: 13px; font-weight: 600; color: var(--gp-titulo, #002253); }
.gp .gp-ext-estado { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; font-size: 13.5px; color: var(--gp-texto, #1f2937); }
.gp .gp-ext-cancelar { padding: 0; border: 0; background: transparent; font: inherit; font-size: 13px; color: var(--gp-tenue, #66666b); text-decoration: underline; cursor: pointer; }
.gp .gp-ext-cancelar:hover { color: var(--gp-texto, #1f2937); }
`;
