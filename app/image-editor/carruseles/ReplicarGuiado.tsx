'use client';

// =============================================================================
// Replicar un carrusel, GUIADO: la pestaña donde MaKo pregunta antes de generar (9/11/2026)
// =============================================================================
// Martín, 9/11/2026: «Le acabo de dar a crear un carrusel, me llevó directamente al editor y no está bueno eso» y «ni siquiera me
// pregunta qué oferta». Lo que pidió: al elegir un carrusel se abre una pestaña donde MaKo pregunta en su chat, «con el tutorial
// que se opaca la pantalla, que le vaya señalando la pregunta», qué oferta, qué avatar (sólo si el carrusel tiene una persona) y
// qué quiere cambiar. El diseño: docs/relevo/nube-carruseles-guiado.md.
//
// Tres piezas, montadas por ./../ImageEditorCliente.tsx adentro de `PantallaCrear` (la tarjeta de MaKo no desaparece nunca):
//   · `useGuiado`: el estado. Las preguntas y el orden los decide lib/carruseles/guiado.ts (puro, con su test); acá se lee la
//     lectura (¿tiene persona?: POST /api/image-editor/carruseles/leer, en paralelo a la primera pregunta) y se guardan las
//     respuestas. Nada se guarda en la base hasta «Generar».
//   · `ChatReplica`: la tarjeta izquierda. El panel, el hilo y la caja únicos de los chats de MaKo (PanelDeChat + AperturaMako,
//     que dibuja con HiloMako, + CajaChat). Lo escrito en la caja CONTESTA la pregunta («Lo escribo yo») o se anota como pedido:
//     no va a ninguna IA, así que anda sin la app de escritorio. Mientras MaKo espera una respuesta, el velo de la guía
//     (app/_ui/guia/VeloGuia.tsx) opaca la pestaña y señala la pregunta (`image-editor-pregunta`, ../guia-image.ts).
//   · `ReplicarGuiado`: el centro. El original, lámina por lámina, y con «Generar», el armado en vivo de siempre
//     (./EditarCarrusel.tsx) con el pedido del guiado y cada lámina AL LADO de su original, sin abrir el editor solo: se juzga
//     antes de entregar (AGENTS.md, «chequear antes de entregar»).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { AperturaMako, type EstadoApertura } from '@/app/_chat/AperturaMako';
import { CajaChat } from '@/app/_chat/CajaChat';
import { HiloMako } from '@/app/_chat/HiloMako';
import { ancla } from '@/app/_ui/guia/ancla';
import { cerrarGuia, registrarGuia, senalar, soltarGuia } from '@/app/_ui/guia/store';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import {
  escribir as escribirEnElGuiado, pasoDe, pedidoDelGuiado, preguntaDe, responder, seguir as seguirGuiado,
  type HechosGuiado, type OfertaElegible, type PedidoGuiado, type RespuestasGuiado,
} from '@/lib/carruseles/guiado';
import { imagenesDe, type Carrusel } from '@/lib/carruseles/explorar';
import type { Boton } from '@/lib/aperturas/reglas';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { GUIA_IMAGE } from '../guia-image';
import { EditarCarrusel } from './EditarCarrusel';
import { useImagenesVivas } from './imagenes-vivas';
import s from './explorar.module.css';

/** Lo que el server sabe del negocio para las preguntas (app/image-editor/page.tsx): sus ofertas, sus fotos y su kit. */
export type BaseGuiado = { ofertas: OfertaElegible[] | null; fotos: { cara: boolean; look: boolean }; kit: boolean };

export const BASE_SIN_DATOS: BaseGuiado = { ofertas: null, fotos: { cara: false, look: false }, kit: false };

export type Guiado = {
  c: Carrusel;
  hechos: HechosGuiado;
  r: RespuestasGuiado;
  elegir: (b: Boton<never>) => void;
  escribir: (t: string) => void;
  seguir: () => void;
  /** Lo que viaja a la ruta al generar (null = falta contestar la oferta). */
  pedido: PedidoGuiado | null;
  /** Se volvió del armado: las preguntas quedan como estaban, sin el «listo». */
  volverDelArmado: () => void;
};

/** Cuántas láminas tiene el ejemplo, para preguntar y para el resumen: un anuncio es una. */
const laminasDe = (c: Carrusel) => (c.clase === 'anuncio' ? 1 : c.laminas ?? Math.max(1, imagenesDe(c).length));

/** El guiado del carrusel elegido; `null` sin ninguno (la tab llama al hook siempre: un hook no va detrás de un `if`). */
export function useGuiado(c: Carrusel | null, base: BaseGuiado): Guiado | null {
  const [lectura, setLectura] = useState<{ persona: boolean | null; leyendo: boolean }>({ persona: null, leyendo: true });
  const id = c?.id ?? null;
  useEffect(() => {
    if (id == null) return;
    let vivo = true;
    setLectura({ persona: null, leyendo: true });
    // La lectura corre mientras se contesta la oferta. Cualquier falla es «no sé» (`null`): el avatar se pregunta igual.
    fetch('/api/image-editor/carruseles/leer', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }), signal: AbortSignal.timeout(65_000),
    })
      .then((r) => r.json() as Promise<{ ok?: boolean; persona?: boolean | null }>)
      .then((j) => { if (vivo) setLectura({ persona: j?.ok && typeof j.persona === 'boolean' ? j.persona : null, leyendo: false }); })
      .catch(() => { if (vivo) setLectura({ persona: null, leyendo: false }); });
    return () => { vivo = false; };
  }, [id]);
  const hechos = useMemo<HechosGuiado | null>(() => (c ? {
    laminas: laminasDe(c), creador: c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre,
    ofertas: base.ofertas, persona: lectura.persona, leyendo: lectura.leyendo, fotos: base.fotos, kit: base.kit,
  } : null), [c, base, lectura]);
  const [r, setR] = useState<RespuestasGuiado>({});
  // Otro carrusel es otro guiado: lo contestado no viaja de uno al otro.
  useEffect(() => { setR({}); }, [id]);
  const elegir = useCallback((b: Boton<never>) => setR((x) => (hechos ? responder(hechos, x, b) : x)), [hechos]);
  const escribir = useCallback((t: string) => setR((x) => (hechos ? escribirEnElGuiado(hechos, x, t) : x)), [hechos]);
  const seguir = useCallback(() => setR(seguirGuiado), []);
  const volverDelArmado = useCallback(() => setR((x) => ({ ...x, listo: false })), []);
  const pedido = useMemo(() => (hechos ? pedidoDelGuiado(hechos, r) : null), [hechos, r]);
  return useMemo(() => (c && hechos ? { c, hechos, r, elegir, escribir, seguir, pedido, volverDelArmado } : null),
    [c, hechos, r, elegir, escribir, seguir, pedido, volverDelArmado]);
}

const QUIEN = { nombre: 'MaKo', aspecto: ASPECTO_MAKO };
const nada = () => {};

/**
 * El velo: mientras MaKo espera una respuesta, la pestaña se opaca y la pregunta lleva el aro (el de la guía de la casa). Se
 * registra la guía de Image sólo mientras este chat está montado y se suelta al irse: así no queda hablando en el chat del Cerebro.
 */
function useVeloDeLaPregunta(id: string | null) {
  useEffect(() => {
    registrarGuia(GUIA_IMAGE, {});
    return () => { cerrarGuia(); soltarGuia(GUIA_IMAGE.key); };
  }, []);
  useEffect(() => {
    if (!id) { cerrarGuia(); return; }
    // Un cuadro después: la pregunta tiene que estar en pantalla para que el velo la encuentre (si no, «No lo veo»).
    const t = window.setTimeout(() => senalar([{ ancla: 'image-editor-pregunta', frase: 'Contesta aquí para seguir.' }], 'La pregunta'), 60);
    return () => window.clearTimeout(t);
  }, [id]);
}

/** La tarjeta izquierda mientras se replica: MaKo pregunta, la persona toca o escribe. */
export function ChatReplica({ g, volver }: { g: Guiado; volver: ReactNode }) {
  const hilo = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState('');
  const paso = pasoDe(g.hechos, g.r);
  const pregunta = preguntaDe(g.hechos, g.r);
  useVeloDeLaPregunta(pregunta ? `${pregunta.id}:${g.r.charla?.length ?? 0}` : null);
  const estado: EstadoApertura<never> = { apertura: pregunta, charla: g.r.charla ?? [], elegir: g.elegir };
  // Con lo nuevo, el hilo baja (como cualquier chat).
  useEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [g.r.charla?.length, paso]);
  // El saludo: qué se va a hacer y con cuántas láminas, antes de la primera pregunta (no se guarda: nada de esto se guarda).
  const saludo = useMemo<ItemHilo[]>(() => [{
    k: 'msg', id: 'replica-saludo', role: 'assistant', at: null,
    texto: `Vamos a hacer tu versión del carrusel de ${g.hechos.creador} (${g.hechos.laminas === 1 ? 'una lámina' : `${g.hechos.laminas} láminas`}). Antes, unas preguntas cortas.`,
  }], [g.hechos.creador, g.hechos.laminas]);
  const mandar = () => { const t = texto.trim(); if (!t) return; g.escribir(t); setTexto(''); };
  const linea = paso === 'leyendo' ? 'Miro sus láminas para ver si tiene una persona…'
    : g.r.escribiendo ? 'Lo que escribas es tu respuesta.'
    : paso === 'listo' ? 'Armando tu versión…' : '';
  return (
    <PanelDeChat hilo={hilo}
      cabecera={{ clave: `replicar:${g.c.id}`, titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo: paso === 'leyendo' || paso === 'listo' ? 'trabajando' : 'despierto', antes: volver }}
      // Sin adjuntos A PROPÓSITO: acá se contesta qué hacer con el ejemplo, y lo escrito no va a ninguna IA (no leería un archivo).
      caja={<div className="co-caja"><CajaChat texto={texto} onTexto={setTexto} onMandar={mandar} sinAdjuntos enterManda
        placeholder={g.r.escribiendo ? 'Escríbelo aquí' : 'Escríbele a MaKo'} apagado={paso === 'listo'} /></div>}
      estado={linea}>
      <HiloMako items={saludo} quien={QUIEN} ahora={0} escribiendo={paso === 'leyendo' ? { segs: 0 } : null} tarjeta={null} onTarjeta={nada} onReintentar={nada} onRecargar={nada} />
      <div {...ancla('image-editor-pregunta')}>
        <AperturaMako estado={estado} quien={QUIEN} acciones={{}} />
      </div>
      {paso === 'pausado' ? (
        <div className="ch-apertura__botones" role="group" aria-label="Seguir con las preguntas">
          <button type="button" className="of-pill of-pill--mako" onClick={g.seguir}>Seguir</button>
        </div>
      ) : null}
    </PanelDeChat>
  );
}

/** El centro mientras se replica: el original, y con «Generar» el armado en vivo, al lado de cada lámina original. */
export function ReplicarGuiado({ g, onSalir }: { g: Guiado; onSalir: () => void }) {
  const todas = imagenesDe(g.c);
  // Una que no carga (un 403 de Instagram) no se dibuja: nunca el ícono roto (./imagenes-vivas.ts).
  const { vivas: imagenes, alFallar } = useImagenesVivas(todas);
  const armando = g.r.listo && g.pedido;
  return (
    <div className={s.raiz}>
      <div className={s.col}>
        <header className={s.cabeza}>
          <h1>Tu versión del carrusel de {g.hechos.creador}</h1>
          <div className={s.botones}>
            <button type="button" className={s.pastilla} onClick={onSalir}>← Elegir otro</button>
            {g.c.url ? <a className={s.pastilla} href={g.c.url} target="_blank" rel="noopener noreferrer">Ver el original ↗</a> : null}
          </div>
        </header>
        {imagenes.length ? (
          <ol className={s.grilla} aria-label="Las láminas del original">
            {imagenes.map((src, i) => (
              <li key={`${src}-${i}`} style={{ listStyle: 'none' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- una imagen del CDN de la fuente o de nuestro bucket */}
                <img src={src} alt={`Lámina ${i + 1} del original`} loading="lazy" referrerPolicy="no-referrer" onError={() => alFallar(src)} style={{ width: '100%', aspectRatio: g.c.clase === 'anuncio' ? '1 / 1' : '4 / 5', objectFit: 'cover', borderRadius: 12, display: 'block' }} />
              </li>
            ))}
          </ol>
        ) : (
          <p className={s.aviso}>Todavía no tengo sus láminas guardadas: MaKo arma tu versión mirando su portada y su texto.</p>
        )}
        {/* @lifeofarjav (10/11/2026): 6 láminas en Instagram y sólo la portada guardada; se veía una sola, sin decir por qué. La
            misma nota que el carrusel abierto (./CarruselAbierto.tsx). */}
        {imagenes.length === 1 && (g.c.laminas ?? 0) > 1 ? <p className={s.aviso}>Tiene {g.c.laminas} láminas; todavía sólo está guardada la portada.</p> : null}
      </div>
      {/* Todas, también las rotas: el armado pone cada original AL LADO de su lámina, y sacar una del medio correría el par. */}
      {armando ? <EditarCarrusel key={`${g.c.id}:armado`} carrusel={g.c} guiado={g.pedido} originales={todas} onCerrar={g.volverDelArmado} /> : null}
    </div>
  );
}
