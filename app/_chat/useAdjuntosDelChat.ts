'use client';

// =============================================================================
// useAdjuntosDelChat — lo que se adjunta en la caja de un chat de MaKo cuyo modelo lee TEXTO (28/10/2026)
// =============================================================================
// Martín (28/10): «que se pueda utilizar el chat de la misma manera en todos lados» (lib/cajas-de-chat.ts). El «+» de la caja
// (Documento, Fotos, Cámara, Pegar) y lo soltado: fotos y PDF, con los topes del servidor (4 archivos, 4 MB en total:
// lib/mako-adjuntos.ts). Una foto grande se achica antes de subir (Vercel corta un POST de más de ~4,5 MB, en texto); una
// captura chica va tal cual, que su texto se lee mejor en PNG. El servidor los lee (lib/adjuntos-del-chat.ts). Lo usan el
// asesor de WhatsApp, Editar con MaKo y ChartIA; el molde es el del CRM (app/crm/lead-view/MakoAnalystLead.tsx).
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

export function useAdjuntosDelChat({ puede, onError }: {
  /** ¿Se puede sumar ahora? (no mientras MaKo contesta: lo juntado sale con el PRÓXIMO mensaje). */
  puede: boolean;
  /** Por qué no entró (la línea de error de la pantalla); null la limpia. */
  onError: (m: string | null) => void;
}) {
  const [items, setItems] = useState<AdjuntoCaja[]>([]);
  // Lo juntado, para decidir afuera de un updater (un updater no avisa errores).
  const ref = useRef<AdjuntoCaja[]>([]);
  const [preparando, setPreparando] = useState(0);
  const poner = (l: AdjuntoCaja[]) => { ref.current = l; setItems(l); };

  const sumar = async (lista: File[]) => {
    if (!lista.length) return;
    onError(null);
    setPreparando((p) => p + lista.length);
    const nuevos: AdjuntoCaja[] = [];
    try {
      for (const f of lista) {
        const tipo = tipoDeElegido(f);
        if (!tipo) { onError(ERROR_ADJUNTO.formato); continue; }
        try {
          const archivo = tipo === 'image' && f.size > TAL_CUAL_BYTES ? await achicarImagen(f) : f;
          nuevos.push({ id: `adj-${++secuencia}`, file: archivo, tipo, url: URL.createObjectURL(archivo) });
        } catch { onError('No pude leer esa imagen.'); }
      }
    } finally { setPreparando((p) => Math.max(0, p - lista.length)); }
    if (!nuevos.length) return;
    const todos = [...ref.current, ...nuevos];
    const problema = problemaDeSeleccion(todos.map((a) => a.file.size));
    if (problema) { for (const a of nuevos) URL.revokeObjectURL(a.url); onError(problema); return; }
    poner(todos);
  };
  const quitar = (id: string) => {
    const a = ref.current.find((x) => x.id === id);
    if (a) URL.revokeObjectURL(a.url);
    poner(ref.current.filter((x) => x.id !== id));
  };

  const caja: AdjuntosDeCaja = {
    items, puede, onSumar: (fs) => { void sumar(fs); }, onQuitar: quitar, accept: ACCEPT_ADJUNTOS_CHAT,
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
      const l = ref.current;
      poner([]);
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
