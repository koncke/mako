'use client';

// =============================================================================
// VistaAfuera — una landing de AFUERA en el panel del diagnóstico, aislada en un iframe
// =============================================================================
// Tanda 2, punto 8 (docs/diseno-editor-landing.md, T5): «se tiene que previsualizar y comenzar con los
// "comentarios"». El HTML bajado se sirve desde una ruta propia (`srcPaginaDiagnostico`,
// app/api/landing-generator/diagnostico/pagina/route.ts) con la política `sandbox` (origen opaco), y el
// iframe además lleva `sandbox="allow-scripts"`: la página corre sus scripts (una página armada en el
// navegador se tiene que poder ver) pero no ve nada de hola-mako.com, no manda formularios y no abre
// ventanas.
//
// Las citas se buscan ADENTRO del iframe (el script de `documentoDiagnostico`) y la caja de cada una
// vuelve por `postMessage`, relativa a la vista del iframe: acá se le suma dónde está el iframe en la
// ventana. El protocolo está escrito en lib/editor-landing/diagnostico.ts.
//
// ⚠️ SÓLO SE ACEPTAN MENSAJES DE ESTE IFRAME (`ev.source`), y los números se sanean (`cajaDeMensaje`): la
//    página de afuera corre en la misma ventana que el script y podría mandar cualquier cosa.
// ⚠️ SI EL SCRIPT NO CONTESTA (el iframe no cargó: sin el bloque de cabeceras de next.config.ts la ruta
//    sale con `X-Frame-Options: DENY`), la vista lo dice a los 12 s y los comentarios se señalan sobre la
//    vista entera: la lista y el recorrido funcionan igual.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { MARCA_MENSAJE, TOPES_DIAGNOSTICO, cajaDeMensaje, srcPaginaDiagnostico } from '@/lib/editor-landing/diagnostico';
import { EVENTO_MOVIO, cajaDeRect, recortarA, type ControlVista, type ObjetivoVista } from './vista';

type CajaIframe = [number, number, number, number, number];
type EstadoVista = 'cargando' | 'lista' | 'error' | 'muda';

/** Cuánto se espera el «listo» del script antes de decir que la página no se pudo mostrar. */
const ESPERA_LISTO_MS = 12_000;
/** Cuánto se espera la caja después de pedirle al iframe que traiga una cita. */
const ESPERA_IR_MS = 900;

export function VistaAfuera({ url, objetivos, controlRef, senal, onUbicar }: {
  url: string;
  objetivos: ObjetivoVista[];
  controlRef: MutableRefObject<ControlVista | null>;
  /** Donde avisa que se movió (`EVENTO_MOVIO`): el scroll del iframe no llega al documento. */
  senal: EventTarget;
  /** Cambió qué citas se encontraron (la lista vuelve a pintar «Sin ubicar»). */
  onUbicar: () => void;
}) {
  const ws = useWs();
  const src = conWs(srcPaginaDiagnostico(url), ws);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cajas = useRef<Array<CajaIframe | null>>([]);
  const recibidas = useRef(false);
  const esperas = useRef(new Map<number, () => void>());
  const [estado, setEstado] = useState<EstadoVista>('cargando');
  const [mensaje, setMensaje] = useState('');
  const objetivosRef = useRef(objetivos);
  const onUbicarRef = useRef(onUbicar);
  useLayoutEffect(() => { objetivosRef.current = objetivos; onUbicarRef.current = onUbicar; });
  const firma = JSON.stringify(objetivos.map((o) => o.cita));

  // Otra URL: todo de nuevo. Se ajusta durante el render (el patrón de React para «cambió una prop»).
  const [srcAntes, setSrcAntes] = useState(src);
  if (src !== srcAntes) { setSrcAntes(src); setEstado('cargando'); setMensaje(''); }

  const mandar = useCallback((m: Record<string, unknown>) => {
    try { iframeRef.current?.contentWindow?.postMessage({ ...m, [MARCA_MENSAJE]: 1 }, '*'); } catch { /* el iframe se fue */ }
  }, []);
  const mandarCitas = useCallback(() => {
    cajas.current = [];
    mandar({ tipo: 'citas', citas: objetivosRef.current.slice(0, TOPES_DIAGNOSTICO.citas).map((o) => o.cita) });
  }, [mandar]);

  useEffect(() => {
    const onMensaje = (ev: MessageEvent) => {
      if (!iframeRef.current || ev.source !== iframeRef.current.contentWindow) return;
      const d = ev.data as Record<string, unknown> | null;
      if (!d || typeof d !== 'object' || d[MARCA_MENSAJE] !== 1) return;
      if (d.tipo === 'listo') { setEstado('lista'); mandarCitas(); return; }
      if (d.tipo === 'error') { setEstado('error'); setMensaje(String(d.mensaje ?? '').slice(0, 300)); return; }
      if (d.tipo === 'cajas' && Array.isArray(d.cajas)) {
        const nuevas = (d.cajas as unknown[]).slice(0, TOPES_DIAGNOSTICO.citas).map(cajaDeMensaje);
        const marca = (xs: Array<CajaIframe | null>) => xs.map((c) => (c ? '1' : '0')).join('');
        const cambio = !recibidas.current || marca(nuevas) !== marca(cajas.current);
        cajas.current = nuevas;
        recibidas.current = true;
        if (cambio) onUbicarRef.current();
        if (typeof d.ir === 'number') { esperas.current.get(d.ir)?.(); esperas.current.delete(d.ir); }
        senal.dispatchEvent(new Event(EVENTO_MOVIO));
      }
    };
    window.addEventListener('message', onMensaje);
    return () => window.removeEventListener('message', onMensaje);
  }, [mandarCitas, senal]);

  // Cambió la lista de comentarios (se resolvió uno, llegó un análisis nuevo): se mandan otra vez.
  useEffect(() => { if (estado === 'lista') mandarCitas(); }, [firma, estado, mandarCitas]);

  // Sin «listo» en un rato: la página no se pudo mostrar acá.
  useEffect(() => {
    if (estado !== 'cargando') return;
    const t = setTimeout(() => setEstado((e) => (e === 'cargando' ? 'muda' : e)), ESPERA_LISTO_MS);
    return () => clearTimeout(t);
  }, [estado, src]);

  useLayoutEffect(() => {
    const indice = (id: number) => objetivosRef.current.findIndex((o) => o.id === id);
    const control: ControlVista = {
      caja(id) {
        const f = iframeRef.current?.getBoundingClientRect();
        if (!f) return null;
        const vista = cajaDeRect(f);
        const c = cajas.current[indice(id)];
        if (!c) return vista;
        return recortarA({ x: f.left + c[0], y: f.top + c[1], ancho: c[2], alto: c[3] }, vista);
      },
      async ir(id) {
        const i = indice(id);
        if (i >= 0 && i < TOPES_DIAGNOSTICO.citas) {
          await new Promise<void>((listo) => {
            const t = setTimeout(() => { esperas.current.delete(i); listo(); }, ESPERA_IR_MS);
            esperas.current.set(i, () => { clearTimeout(t); listo(); });
            mandar({ tipo: 'ir', i });
          });
        }
        return control.caja(id);
      },
      posicion(id) {
        const c = cajas.current[indice(id)];
        return c ? c[4] : null;
      },
      // Hasta la primera respuesta del script no se sabe nada: un iframe que no cargó no es «no está».
      ubicacion: (id) => (!recibidas.current ? undefined : cajas.current[indice(id)] ? 'cita' : null),
    };
    controlRef.current = control;
    return () => { if (controlRef.current === control) controlRef.current = null; };
  }, [controlRef, mandar]);

  return (
    <div className="gdg-vista gdg-vista--afuera">
      <iframe
        key={src}
        ref={iframeRef}
        className="gdg-iframe"
        src={src}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        title="Vista de la página"
      />
      {(estado === 'error' || estado === 'muda') && (
        <div className="gdg-vista-aviso" role="status">
          <p>{estado === 'error' && mensaje ? mensaje : 'No pude mostrar la página aquí.'}</p>
          <a className="gp-btn gp-btn-contorno" href={url} target="_blank" rel="noopener noreferrer">Abrir la página</a>
        </div>
      )}
    </div>
  );
}
