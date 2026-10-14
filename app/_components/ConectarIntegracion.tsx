'use client';

// =============================================================================
// ConectarIntegracion — EL modal de /integraciones, abierto en CUALQUIER tab
// =============================================================================
// Martín, 14/10/2026, textual: «Esto significa también el botón de "Conectar" si no lo tiene conectado debería saltar
// el pop-up ahí. Esto como regla siempre, en todas las tabs, para una integración jamás se debe salir de la tab.»
//
// UNA pieza, tres formas de usarla (todas montan el MISMO `ServicioSuelto` → `ServicioModal` de /integraciones, con su
// carrusel, su tutorial, «Probar» y el estado real; nunca un segundo formulario para la misma credencial):
//
//   · `useConectarIntegracion()` → `{ abrir(servicio), modal }`: para una pantalla que decide sola cuándo abrir (el
//     Calendario lo abre al entrar sin Google) o que ya tiene su botón con su estilo. `modal` va en el árbol.
//   · `<BotonIntegracion servicio="meta">Conectar</BotonIntegracion>`: un `<button>` que abre el modal. Por default se
//     ve como el texto que lo rodea (un link de una frase); el `style` de quien lo monta manda.
//   · `<LinkIntegracion href={link}>`: para un link que arma lib/ (el fallo de la IA trae `/integraciones?abrir=gemini`,
//     que también viaja por WhatsApp, donde no hay modal). Si el link nombra una integración, abre el modal; si no
//     (la grilla entera, el Pixel, el agente de Claude), sigue siendo un link (`servicioDeLink`, lib/integracion-en-tab.ts).
//
// Y `useVueltaDeGoogle(abrir, onOk)`: el OAuth de Google es un redirect de página entera; el callback vuelve a ESTA tab
// con `?gcal=<resultado>` (lib/gcal-estado.ts → `destinoGcal`). Con un fallo, el modal se vuelve a abrir diciendo qué
// pasó; con un «ok», avisa a la pantalla. Y el parámetro se borra (un F5 no repite el aviso).
//
// ⚠️ `ServicioSuelto` se carga A DEMANDA (`next/dynamic`): la grilla de /integraciones no viaja con cada tab.
// ⚠️ Y VA POR PORTAL AL `body`, REGISTRADO EN LA PILA DE MODALES (`CapaIntegracion`). Se abre desde adentro de cualquier
//    cosa —un `<Modal>` (Campañas del CRM), una tarjeta con su propio clic (la Calificación), la barra del Calendario—,
//    y las tres trampas son de esta casa: un `position: fixed` adentro de un ancestro con `transform` (la animación de
//    un modal) se ubica contra ESE ancestro y no contra la ventana; el Escape lo contestaba el modal de abajo, que no
//    sabía que había otro encima; y un clic adentro BURBUJEA por el árbol de React hasta el `onClick` del que lo montó
//    (la tarjeta de la Calificación abría su sí/no). Por eso la capa frena la propagación y el botón también.

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import Link, { useRouter } from '@/app/_ui/Link';
import { servicioDeLink } from '@/lib/integracion-en-tab';
import { useCapaModal } from './pila-modales';

const ServicioSuelto = dynamic(() => import('@/app/integraciones/ServicioSuelto'), { ssr: false, loading: () => null });

type Abierto = { servicio: string; motivoGoogle: string | null };

/** El modal de una integración, para abrirlo desde la pantalla que sea. `modal` se pone en el árbol (es `null` cerrado). */
export function useConectarIntegracion(opts?: {
  /** Quedó conectada (guardó y probó). La pantalla puede volver a leer lo que dependía de eso. */
  onConectado?: (servicio: string) => void;
}): { abrir: (servicio: string, motivoGoogle?: string | null) => void; cerrar: () => void; abierto: string | null; modal: ReactNode } {
  const [abierto, setAbierto] = useState<Abierto | null>(null);
  const onConectado = opts?.onConectado;
  const abrir = useCallback((servicio: string, motivoGoogle: string | null = null) => setAbierto({ servicio, motivoGoogle }), []);
  const cerrar = useCallback(() => setAbierto(null), []);
  const modal = abierto ? (
    <CapaIntegracion onCerrar={cerrar}>
      <ServicioSuelto key={abierto.servicio} servicio={abierto.servicio} motivoGoogle={abierto.motivoGoogle}
        onCerrar={cerrar} onConectado={() => onConectado?.(abierto.servicio)} />
    </CapaIntegracion>
  ) : null;
  return { abrir, cerrar, abierto: abierto?.servicio ?? null, modal };
}

/** Un evento que no sigue subiendo por el árbol de React (los portales burbujean hasta quien los montó). */
const frenar = (e: SyntheticEvent) => e.stopPropagation();

/**
 * La capa del modal: al `body` por portal, anotada en la pila (el de abajo deja de contestar el Escape y se sigue
 * viendo detrás: `anidada`), y el Escape la cierra a ELLA. Ver el ⚠️ de arriba.
 */
function CapaIntegracion({ onCerrar, children }: { onCerrar: () => void; children: ReactNode }) {
  const capa = useCapaModal(true, { anidada: true });
  const esElDeArriba = capa.esElDeArriba;
  const cerrarRef = useRef(onCerrar);
  useLayoutEffect(() => { cerrarRef.current = onCerrar; });
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !esElDeArriba()) return;
      e.stopImmediatePropagation();
      cerrarRef.current();
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [esElDeArriba]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div data-capa-integracion="" style={{ position: 'relative', zIndex: capa.z }}
      onClick={frenar} onMouseDown={frenar} onMouseUp={frenar} onPointerDown={frenar} onPointerUp={frenar} onKeyDown={frenar} onDoubleClick={frenar}>
      {children}
    </div>,
    document.body,
  );
}

/** Lo que trae un `<button>` y no un link: se lo saca, así se ve como el texto que lo rodea hasta que el `style` diga otra cosa. */
const COMO_TEXTO: CSSProperties = {
  appearance: 'none', background: 'none', border: 0, padding: 0, margin: 0, font: 'inherit', color: 'inherit',
  cursor: 'pointer', textAlign: 'inherit', display: 'inline', textDecoration: 'none',
};

/** Un botón que abre el modal de UNA integración ahí mismo. */
export function BotonIntegracion({ servicio, children, style, className, title, onConectado }: {
  /** La clave de la integración (lib/integraciones-catalogo.ts): 'meta', 'google', 'calendly', 'elevenlabs'… */
  servicio: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  title?: string;
  onConectado?: (servicio: string) => void;
}) {
  const { abrir, modal } = useConectarIntegracion({ onConectado });
  return (
    <>
      <button type="button" className={className} title={title} data-conectar-integracion={servicio}
        style={{ ...COMO_TEXTO, ...style }} onClick={(e) => { e.stopPropagation(); abrir(servicio); }}>
        {children}
      </button>
      {modal}
    </>
  );
}

/** Un link a /integraciones que, si nombra una integración, abre su modal en vez de navegar. */
export function LinkIntegracion({ href, children, style, className, title, onConectado }: {
  href: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  title?: string;
  onConectado?: (servicio: string) => void;
}) {
  const servicio = servicioDeLink(href);
  if (servicio) return <BotonIntegracion servicio={servicio} style={style} className={className} title={title} onConectado={onConectado}>{children}</BotonIntegracion>;
  return <Link href={href} style={style} className={className} title={title}>{children}</Link>;
}

/**
 * La vuelta del OAuth de Google a ESTA tab (`?gcal=`): con un fallo vuelve a abrir el modal diciendo qué pasó; con un
 * «ok» llama a `onOk`. Se consume una vez y se borra de la URL (sin scroll, con el `?ws=` de la pestaña).
 */
export function useVueltaDeGoogle(abrir: (servicio: string, motivoGoogle?: string | null) => void, onOk?: () => void): string | null {
  const sp = useSearchParams();
  const router = useRouter();
  const gcal = sp.get('gcal');
  const visto = useRef<string | null>(null);
  useEffect(() => {
    if (!gcal) { visto.current = null; return; }
    if (visto.current === gcal) return;
    visto.current = gcal;
    if (gcal === 'ok') onOk?.();
    else abrir('google', gcal);
    const q = new URLSearchParams(sp.toString());
    q.delete('gcal');
    router.replace(`${window.location.pathname}${q.size ? `?${q}` : ''}`, { scroll: false });
  }, [gcal, sp, router, abrir, onOk]);
  return gcal;
}

/**
 * Para una tab que ofrece conectar Google pero no tiene nada que hacer con la vuelta más que decir si falló: se monta
 * UNA vez en la pantalla (el OAuth vuelve con la página recargada) y, con un fallo, vuelve a abrir el modal de Google.
 */
export function VueltaDeGoogle({ onOk }: { onOk?: () => void }) {
  const { abrir, modal } = useConectarIntegracion();
  useVueltaDeGoogle(abrir, onOk);
  return <>{modal}</>;
}
