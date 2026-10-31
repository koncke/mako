'use client';

// =============================================================================
// useAdjuntosDelChat — lo que se adjunta en la caja de un chat de MaKo cuyo modelo lee TEXTO (28/10/2026)
// =============================================================================
// Martín (28/10): «que se pueda utilizar el chat de la misma manera en todos lados» (lib/cajas-de-chat.ts). El «+» de la caja
// (Documento, Fotos, Cámara, Pegar) y lo soltado: fotos y PDF, con los topes del servidor (4 archivos, 4 MB en total:
// lib/mako-adjuntos.ts). Una foto grande se achica antes de subir (Vercel corta un POST de más de ~4,5 MB, en texto); una
// captura chica va tal cual, que su texto se lee mejor en PNG. El servidor los lee (lib/adjuntos-del-chat.ts). Lo usan el
// asesor de WhatsApp, Editar con MaKo y ChartIA; el molde es el del CRM (app/crm/lead-view/MakoAnalystLead.tsx).
// ⚠️ POR CONVERSACIÓN (28/10/2026, la verificación de 1d586a686): una pantalla que cambia de conversación sin remontarse (las
//    sesiones de MakoChat) pasa `conversacion`: lo juntado en la sesión 1 salía con el «hola» de la sesión 2.
// =============================================================================

import { useRef, useState } from 'react';
import type { AdjuntoCaja } from '@/app/admin/operaciones/useCentro';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import { achicarImagen } from '@/app/m/mako/achicar-imagen';
import { problemaDeSeleccion, tipoDeElegido } from '@/app/m/mako/chat-ui';
import { ACCEPT_ADJUNTOS_CHAT, ERROR_ADJUNTO } from '@/lib/mako-adjuntos';

/** Una captura de hasta esto va tal cual; una foto más grande se achica (el criterio del Ops Center, useCentro.ts). */
const TAL_CUAL_BYTES = 1_500_000;
let secuencia = 0;
/**
 * El archivo de verdad detrás de una copia achicada. La copia (JPEG, 1600 px) es para que la lea la IA y entre en el POST; para
 * PONER la imagen en un diseño hace falta el original: un PNG sin fondo achicado quedaría sobre negro (lo agarró la revisión, 30/10/2026).
 */
const ORIGINAL = new WeakMap<File, File>();
export const originalDe = (f: File): File => ORIGINAL.get(f) ?? f;
const SIN_ITEMS: AdjuntoCaja[] = [];

export function useAdjuntosDelChat({ puede, onError, conversacion = '', aceptaDeMas = '' }: {
  /** ¿Se puede sumar ahora? (no mientras MaKo contesta: lo juntado sale con el PRÓXIMO mensaje). */
  puede: boolean;
  /** Por qué no entró (la línea de error de la pantalla); null la limpia. */
  onError: (m: string | null) => void;
  /** De qué conversación es lo juntado, en una pantalla que cambia de conversación sin remontarse. Sin esto, una sola. */
  conversacion?: string;
  /** Tipos que esta caja junta además de los que lee la IA (el Image Editor: un SVG se pone en el diseño, ./acciones.ts). */
  aceptaDeMas?: string;
}) {
  // Lo juntado de cada conversación, también en un ref para decidir afuera de un updater (un updater no avisa errores).
  const [porConversacion, setPorConversacion] = useState<Record<string, AdjuntoCaja[]>>({});
  const ref = useRef<Record<string, AdjuntoCaja[]>>({});
  const actual = useRef(conversacion);
  actual.current = conversacion;
  const items = porConversacion[conversacion] ?? SIN_ITEMS;
  const [preparando, setPreparando] = useState(0);
  const poner = (c: string, l: AdjuntoCaja[]) => { ref.current = { ...ref.current, [c]: l }; setPorConversacion(ref.current); };

  const sumar = async (lista: File[]) => {
    if (!lista.length) return;
    // Lo que se suma es de la conversación donde se soltó, aunque achicar una foto tarde y se cambie en el medio.
    const de = conversacion;
    onError(null);
    setPreparando((p) => p + lista.length);
    const nuevos: AdjuntoCaja[] = [];
    try {
      for (const f of lista) {
        const tipo = tipoDeElegido(f);
        if (!tipo) { onError(ERROR_ADJUNTO.formato); continue; }
        try {
          const archivo = tipo === 'image' && f.size > TAL_CUAL_BYTES ? await achicarImagen(f) : f;
          if (archivo !== f) ORIGINAL.set(archivo, f);
          nuevos.push({ id: `adj-${++secuencia}`, file: archivo, tipo, url: URL.createObjectURL(archivo) });
        } catch { onError('No pude leer esa imagen.'); }
      }
    } finally { setPreparando((p) => Math.max(0, p - lista.length)); }
    if (!nuevos.length) return;
    const todos = [...(ref.current[de] ?? []), ...nuevos];
    const problema = problemaDeSeleccion(todos.map((a) => a.file.size));
    if (problema) { for (const a of nuevos) URL.revokeObjectURL(a.url); onError(problema); return; }
    poner(de, todos);
  };
  const quitar = (id: string) => {
    const ya = ref.current[conversacion] ?? [];
    const a = ya.find((x) => x.id === id);
    if (a) URL.revokeObjectURL(a.url);
    poner(conversacion, ya.filter((x) => x.id !== id));
  };

  const caja: AdjuntosDeCaja = {
    items, puede, onSumar: (fs) => { void sumar(fs); }, onQuitar: quitar, accept: aceptaDeMas ? `${ACCEPT_ADJUNTOS_CHAT},${aceptaDeMas}` : ACCEPT_ADJUNTOS_CHAT,
    onNoPuede: () => onError('Espera a que MaKo conteste para sumar archivos.'),
    onSinImagen: (puedeLeer) => onError(puedeLeer ? 'No hay una imagen copiada.' : 'Este navegador no deja pegar.'),
  };
  return {
    caja,
    /** ¿Hay algo para mandar? (la caja muestra la flecha aunque no haya texto). */
    hay: items.length > 0,
    /** Achicando una foto: todavía no se manda. */
    preparando: preparando > 0,
    /** Lo juntado, para mandarlo con el mensaje: la caja queda vacía. */
    tomar: (): File[] => {
      const c = actual.current;
      const l = ref.current[c] ?? [];
      poner(c, []);
      for (const a of l) URL.revokeObjectURL(a.url);
      return l.map((a) => a.file);
    },
  };
}

/** El cuerpo de un pedido con archivos: los campos de siempre en `datos` (JSON) y cada archivo en `adjuntos`. */
export function cuerpoConArchivos(datos: Record<string, unknown>, archivos: readonly File[]): FormData {
  const fd = new FormData();
  fd.append('datos', JSON.stringify(datos));
  for (const f of archivos) fd.append('adjuntos', f, f.name);
  return fd;
}
