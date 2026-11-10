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

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { EXTENSION_URL_TIENDA, VERSION_EN_TIENDA } from '@/lib/extension-tienda';
import {
  MENSAJE_REPLICA, SILENCIO_LECTURA_MS, alEstadoDeReplica, cancelarReplica, extensionReplica, juzgarEntrega,
  mensajeDeFallo, nuevoPedido, ofertaDeExtension, pedirReplica, soltarEntrega, tomarEntrega, volverAEntrega,
  type OfertaExtension,
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
   * puede volver a la pestaña. */
  | { fase: 'falla'; mensaje: string; aviso: boolean; entrega?: string };

/** Lo que vuelve de la extensión, ya juzgado: la foto de la copia idéntica y el texto que se veía. */
export type FotoDeLaExtension = { url: string; foto: Record<string, unknown>; texto: string; titulo: string };

const versionDelPuente = (): string | null => (typeof document === 'undefined' ? null : document.documentElement.getAttribute('data-mako-puente'));

/** El atributo del puente aparece al cargar, o al recargar después de instalar: la pantalla se entera sola (molde: SusPaginas). */
function suscribirPuente(avisar: () => void): () => void {
  const mo = new MutationObserver(avisar);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mako-puente'] });
  window.addEventListener('focus', avisar);
  return () => { mo.disconnect(); window.removeEventListener('focus', avisar); };
}
const instaladaAhora = () => extensionReplica(versionDelPuente());

export function useReplicaConExtension(alTomar: (f: FotoDeLaExtension) => void): {
  estado: EstadoExtension;
  /** Qué se ofrece antes de tocar nada (`ofertaDeExtension`): el botón sólo si la extensión instalada sabe replicar. */
  oferta: OfertaExtension;
  /** Abrir `url` con la extensión. */
  empezar: (url: string) => void;
  /** Tomar una entrega que ya está en la extensión (Replicar abierto por la extensión, `?extension=`). */
  recibir: (entrega: string, url?: string) => void;
  /** Volver a la pestaña (lo que se vio era la verificación). */
  volver: () => void;
  cancelar: () => void;
  /**
   * La réplica salió: la extensión borra la foto y cierra la pestaña que abrió. Se llama recién ahí (y al salir de la
   * pantalla): con la pestaña cerrada antes, un «era la verificación» del servidor no tenía adónde volver.
   */
  soltar: () => void;
} {
  const [estado, setEstado] = useState<EstadoExtension>({ fase: 'quieta' });
  // En el servidor no hay extensión que mirar: 'no' (con la tienda atrás, eso es 'nada' y no se dibuja; al hidratar, se mira).
  const instalada = useSyncExternalStore(suscribirPuente, instaladaAhora, () => 'no' as const);
  const oferta = ofertaDeExtension(instalada, VERSION_EN_TIENDA);
  const alTomarVivo = useRef(alTomar);
  useEffect(() => { alTomarVivo.current = alTomar; }, [alTomar]);
  const pedido = useRef<string | null>(null);
  const url = useRef<string | null>(null);
  const dejar = useRef<(() => void) | null>(null);
  /** La foto que se tomó y todavía no se soltó (la pestaña sigue abierta hasta que la réplica sale). */
  const tomada = useRef<string | null>(null);
  const soltar = useCallback(() => {
    if (tomada.current) soltarEntrega(window, tomada.current);
    tomada.current = null;
  }, []);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; dejar.current?.(); dejar.current = null; soltar(); };
  }, [soltar]);
  const poner = useCallback((e: EstadoExtension) => { if (montado.current) setEstado(e); }, []);

  const recibir = useCallback((entrega: string, urlPedida?: string) => {
    void (async () => {
      poner({ fase: 'tomando' });
      const e = await tomarEntrega(window, entrega);
      if (!montado.current) return;
      if (!e) { poner({ fase: 'falla', mensaje: MENSAJE_REPLICA.vencida, aviso: false }); return; }
      const j = juzgarEntrega(e);
      if (j !== 'ok') { poner({ fase: 'falla', mensaje: MENSAJE_REPLICA[j], aviso: true, entrega }); return; }
      soltar();
      tomada.current = entrega;
      dejar.current?.();
      dejar.current = null;
      poner({ fase: 'lista' });
      alTomarVivo.current({ url: urlPedida ?? url.current ?? e.url, foto: e.foto, texto: e.texto, titulo: e.titulo });
    })();
  }, [poner, soltar]);

  /** Escuchar lo que pasa con `p` (la lectura en la pestaña, la foto lista, la pestaña cerrada). */
  const escuchar = useCallback((p: string) => {
    dejar.current?.();
    pedido.current = p;
    dejar.current = alEstadoDeReplica(window, p, (a) => {
      if (a.fase === 'leyendo') poner({ fase: 'leyendo', hecho: a.hecho });
      // La pestaña sigue abierta: tocar el ícono otra vez vuelve a «leyendo» (seguimos escuchando).
      else if (a.fase === 'fallo') poner({ fase: 'falla', mensaje: mensajeDeFallo(a.motivo), aviso: a.motivo !== 'excepcion' });
      else if (a.fase === 'cerrada' || a.fase === 'se_fue') {
        dejar.current?.();
        dejar.current = null;
        pedido.current = null;
        poner({ fase: 'falla', mensaje: a.fase === 'cerrada' ? MENSAJE_REPLICA.cerrada : MENSAJE_REPLICA.seFue, aviso: true });
      }
      else recibir(a.entrega);
    });
  }, [poner, recibir]);

  const empezar = useCallback((u: string) => {
    // El botón sólo se dibuja con la extensión que sabe replicar; si se fue en el medio (se desinstaló), se vuelve a quieta y
    // el bloque dice qué hacer según `oferta`.
    if (extensionReplica(versionDelPuente()) !== 'si') { poner({ fase: 'quieta' }); return; }
    // «Volver a intentar»: la pestaña del intento anterior se cierra (si la abrió la extensión). Sin esto quedaba anotada, y
    // tocar el ícono en ella le entregaba la foto a un pedido que ya nadie escuchaba.
    if (pedido.current) cancelarReplica(window, pedido.current);
    dejar.current?.();
    dejar.current = null;
    pedido.current = null;
    url.current = u;
    poner({ fase: 'pidiendo' });
    void pedirReplica(window, u).then((r) => {
      if (!montado.current) return;
      if (!r.ok) {
        poner(r.motivo === 'destino'
          ? { fase: 'falla', mensaje: MENSAJE_REPLICA.destino, aviso: true }
          : { fase: 'falla', mensaje: MENSAJE_REPLICA.noAbrio, aviso: false });
        return;
      }
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

  return { estado, oferta, empezar, recibir, volver, cancelar, soltar };
}

/** El rótulo del botón (corto: lo que hace). */
export const BOTON_EXTENSION = 'Copiar con la extensión';

/**
 * Lo que se dibuja: el botón y, mientras tanto, en qué va. `primario`: el botón es la acción principal (la página no se
 * pudo leer de ninguna otra forma).
 */
export function BloqueExtension({ estado, oferta, onEmpezar, onVolver, onCancelar, primario = false }: {
  estado: EstadoExtension;
  oferta: OfertaExtension;
  onEmpezar: () => void;
  onVolver: () => void;
  onCancelar: () => void;
  primario?: boolean;
}) {
  if (estado.fase === 'lista') return null;
  // Sin una extensión que sepa replicar, no hay botón: se dice cómo conseguirla, o nada si la tienda todavía no la trae.
  if (estado.fase === 'quieta' && oferta !== 'copiar') {
    if (oferta === 'nada') return null;
    return (
      <div className="gp-ext" role="group" aria-label="Copiar con la extensión de MaKo">
        <style href="gp-ext" precedence="medium">{CSS_EXT}</style>
        {oferta === 'instalar' && (
          <div className="gp-ext-acciones">
            <a className="gp-btn gp-btn-contorno" href={EXTENSION_URL_TIENDA} target="_blank" rel="noreferrer noopener">
              <Ico n="descargar" t={14} /> Agregar a Chrome
            </a>
          </div>
        )}
        <p className="gp-ext-nota">{oferta === 'instalar' ? MENSAJE_REPLICA.sinExtension : MENSAJE_REPLICA.vieja}</p>
      </div>
    );
  }
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
        </div>
      )}
      {estado.fase === 'quieta' && <p className="gp-ext-nota">Abre la página en tu navegador y la copia tal cual, aunque bloquee a MaKo.</p>}
      {esperando && (
        <p className="gp-ext-estado" role="status">
          <span className="gp-giro" aria-hidden />
          {/* El texto en su propia caja: suelto, al no entrar en el renglón bajaba entero y dejaba el giro solo arriba (390 px). */}
          <span className="gp-ext-texto">
            {estado.fase === 'pidiendo' ? 'Abriendo la página…'
              : estado.fase === 'abierta' ? MENSAJE_REPLICA.abierta
                : estado.fase === 'leyendo' ? MENSAJE_REPLICA.copiando
                  : 'Trayendo la copia…'}
            {(estado.fase === 'abierta' || estado.fase === 'leyendo') && (
              <> <button type="button" className="gp-ext-cancelar" onClick={onCancelar}>Cancelar</button></>
            )}
          </span>
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
.gp .gp-ext-estado { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: 13.5px; line-height: 1.45; color: var(--gp-texto, #1f2937); }
.gp .gp-ext-estado > .gp-giro { flex: none; margin-top: 2px; }
.gp .gp-ext-texto { flex: 1 1 auto; min-width: 0; }
.gp .gp-ext a.gp-btn { text-decoration: none; }
.gp .gp-ext-cancelar { padding: 0; border: 0; background: transparent; font: inherit; font-size: 13px; color: var(--gp-tenue, #66666b); text-decoration: underline; cursor: pointer; }
.gp .gp-ext-cancelar:hover { color: var(--gp-texto, #1f2937); }
`;
