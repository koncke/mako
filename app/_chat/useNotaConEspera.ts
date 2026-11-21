'use client';
// =============================================================================
// LA NOTA DE VOZ QUE SE TRANSCRIBE Y, SI FALLA, QUEDA (21/11/2026, el inventario de botones, tanda E)
// =============================================================================
// Para una caja con `voz` (app/_chat/CajaChat.tsx) que quiere la nota como TEXTO (el onboarding V2). Lo que faltaba en el camino de la
// nota que se transcribe sola (./nota-que-se-manda.ts):
//   · CANCELAR mientras se transcribe (puede tardar hasta 5 minutos con el campo apagado): «borrar» la nota corta el pedido;
//   · una nota que FALLA no se pierde: queda en la barra (`pendiente`) para volver a mandarla o borrarla. Antes la revisión se vaciaba
//     antes de entregarse y había que grabar de nuevo.
// Lo que entrega es el texto (`onTexto`); la pantalla lo manda como si lo hubiera escrito.
// =============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribirNota } from '@/app/_components/transcribir-nota';
import { notaEnMp3 } from '@/app/second-brain/nota-de-voz';
import { textoDeLaNota } from './preparar-nota';

type Nota = { blob: Blob; secs: number; url: string };

export function useNotaConEspera(o: { onTexto: (t: string) => void; onError: (m: string) => void }) {
  const [nota, setNota] = useState<Nota | null>(null);
  const [enCurso, setEnCurso] = useState(false);
  const corte = useRef<AbortController | null>(null);
  const onTexto = useRef(o.onTexto);
  const onError = useRef(o.onError);
  useEffect(() => { onTexto.current = o.onTexto; onError.current = o.onError; });

  const transcribir = useCallback(async (n: Nota) => {
    corte.current?.abort();
    const c = new AbortController();
    corte.current = c;
    setNota(n);
    setEnCurso(true);
    try {
      let mp3: Blob;
      try { mp3 = await notaEnMp3(n.blob); } catch (e) { if (!c.signal.aborted) onError.current(e instanceof Error ? e.message : 'No se pudo procesar el audio.'); return; }
      if (c.signal.aborted) return;
      const r = textoDeLaNota(await transcribirNota(mp3, 300_000, 'chat', c.signal));
      if (c.signal.aborted) return;
      // Falla: la nota QUEDA en la barra, para volver a mandarla o borrarla.
      if ('error' in r) { onError.current(r.error); return; }
      URL.revokeObjectURL(n.url);
      setNota(null);
      onTexto.current(r.texto);
    } finally {
      if (corte.current === c) { corte.current = null; setEnCurso(false); }
    }
  }, []);

  // Borrar la nota: también CANCELA la que se está transcribiendo.
  const borrar = useCallback(() => {
    corte.current?.abort();
    corte.current = null;
    setEnCurso(false);
    setNota((x) => { if (x) URL.revokeObjectURL(x.url); return null; });
  }, []);
  const reintentar = useCallback(() => { if (nota && !corte.current) void transcribir(nota); }, [nota, transcribir]);
  const onAudio = useCallback((blob: Blob, secs: number) => { void transcribir({ blob, secs, url: URL.createObjectURL(blob) }); }, [transcribir]);
  useEffect(() => () => { corte.current?.abort(); }, []);

  return {
    onAudio,
    enCurso,
    pendiente: nota ? { url: nota.url, secs: nota.secs, onBorrar: borrar, onDejar: reintentar } : null,
  };
}
