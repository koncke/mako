'use client';

// =============================================================================
// /m/mako — la vista previa de lo que se va a mandar, a PANTALLA COMPLETA (WhatsApp del celular)
// =============================================================================
// Pedido de Martín (11/10/2026), lo trajo el chat de Offer: «la vista previa del documento… como lo
// tiene WhatsApp… en todos los chats que suben documentos». En el teléfono: elegir un archivo NO lo
// manda; la pantalla pasa a esta vista, se suman o se quitan archivos, se escribe el mensaje, y
// recién «Enviar» manda.
//
// La pantalla es la MISMA de los otros chats (app/whatsapp/_shared/VistaAdjuntos.tsx: la ✕, el
// nombre y las páginas, la foto o la primera página del PDF, el mensaje, la tira con «+» y «×»,
// Enviar). Esto es sólo la CAPA que la apoya sobre el teléfono, con lo que /m exige y la vista no sabe:
//   · ⚠️ VA POR PORTAL A #m-capas, nunca adentro del composer: `.m-mako-composer` es `fixed` con
//     z 35 (un contexto de apilamiento que deja todo lo de adentro DEBAJO del encabezado y de la
//     barra, z 40) y en iOS lleva un `transform` con el teclado, que descoloca todo `fixed` de adentro
//     (app/m/_ui/LEEME.md §4). Los sheets van al mismo lugar por lo mismo.
//   · z 60: tapa el encabezado y la barra (40) y queda debajo de los sheets (80) y del toast (90).
//   · NO lleva `data-m-sin-barra`: esa marca cambia el padding de .m-contenido (app/m/m.css), el
//     chat de atrás se reacomoda y al cerrar el scroll ya no está donde se dejó.
//   · Las áreas seguras: el fondo llega al borde y el contenido se corre (padding con
//     env(safe-area-inset-*), en mako.css). Con el teclado arriba, abajo no se deja la barra de inicio.
//   · El teclado de iOS no achica el layout: con el campo enfocado y el teclado arriba la capa mide lo
//     que el `visualViewport` (`altoTeclado`, la misma cuenta del composer). Sin esto, el campo y
//     Enviar quedan debajo del teclado. Sólo con el CAMPO enfocado: medir siempre achicaría la capa
//     a lo que se ve al hacer zoom con dos dedos, y la foto no se podría agrandar.
//   · «Atrás» (el de Android, el del navegador) la CIERRA, como la ✕, igual que un sheet (SheetM):
//     abrirla pone `?vista=adjuntos` con `pushState`. La ✕ y Escape son lo mismo que «atrás»;
//     cerrarla el código (Enviar) saca el parámetro con `replaceState`, sin navegar.
//
// ⚠️ NO SUBE NADA: muestra lo juntado. Subir es de ChatMako, recién cuando el composer llama `onEnviar`.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { VistaAdjuntos, type VistaAdjuntosProps } from '@/app/whatsapp/_shared/VistaAdjuntos';
import { altoTeclado } from './chat-ui';

const PARAM = 'vista';
const VALOR = 'adjuntos';

function urlCon(abierta: boolean): string {
  const u = new URL(window.location.href);
  if (abierta) u.searchParams.set(PARAM, VALOR); else u.searchParams.delete(PARAM);
  return u.pathname + u.search + u.hash;
}
function abiertaEnUrl(): boolean {
  try { return new URL(window.location.href).searchParams.get(PARAM) === VALOR; } catch { return false; }
}

export function VistaAdjuntosM(props: VistaAdjuntosProps) {
  const { onCerrar, enviando } = props;
  const [capa, setCapa] = useState<HTMLElement | null>(null);
  const [campo, setCampo] = useState(false);
  const [teclado, setTeclado] = useState<{ top: number; alto: number } | null>(null);
  /** La entrada del historial que puso esta vista sigue ahí (todavía no hubo «atrás»). */
  const entrada = useRef(false);
  const cerrar = useRef(onCerrar);
  useEffect(() => { cerrar.current = onCerrar; }, [onCerrar]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCapa(document.getElementById('m-capas') ?? document.body); }, []);

  // El teclado de iOS, sólo con el campo enfocado: la capa ocupa lo que se VE.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !campo) { setTeclado(null); return; }
    const medir = () => {
      const t = altoTeclado(window.innerHeight, vv);
      setTeclado(t > 0 ? { top: Math.round(vv.offsetTop), alto: Math.round(vv.height) } : null);
    };
    medir();
    vv.addEventListener('resize', medir);
    vv.addEventListener('scroll', medir);
    return () => { vv.removeEventListener('resize', medir); vv.removeEventListener('scroll', medir); };
  }, [campo]);

  // «Atrás» cierra la vista: una entrada propia en el historial mientras está abierta.
  useEffect(() => {
    window.history.pushState(null, '', urlCon(true));
    entrada.current = true;
    const alAtras = () => {
      if (!entrada.current || abiertaEnUrl()) return;
      entrada.current = false;
      cerrar.current();
    };
    window.addEventListener('popstate', alAtras);
    return () => {
      window.removeEventListener('popstate', alAtras);
      // La cerró el código (Enviar): se saca el parámetro sin navegar.
      if (entrada.current && abiertaEnUrl()) window.history.replaceState(null, '', urlCon(false));
      entrada.current = false;
    };
  }, []);

  /** La ✕ y Escape: la persona la cierra, que es lo mismo que «atrás» (y el «atrás» llama a onCerrar). */
  const pedirCierre = () => {
    if (enviando) return;
    if (entrada.current && abiertaEnUrl()) window.history.back();
    else onCerrar();
  };

  if (!capa) return null;
  const estilo: CSSProperties | undefined = teclado ? { top: teclado.top, height: teclado.alto, bottom: 'auto' } : undefined;
  return createPortal(
    <div
      className="m-mako-vista"
      data-teclado={teclado ? '' : undefined}
      style={estilo}
      onFocus={(e) => setCampo(e.target instanceof HTMLTextAreaElement)}
      onBlur={() => setCampo(false)}
    >
      <VistaAdjuntos {...props} onCerrar={pedirCierre} />
    </div>,
    capa,
  );
}
