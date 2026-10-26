'use client';

// =============================================================================
// La nota de voz de un mensaje ya enviado, adentro de su burbuja (26/10/2026)
// =============================================================================
// Martín, desde el Centro, con captura de su nota dibujada como texto: «Y esto fue un audio, se deberia mandar el audio
// directamente... Y de ultima en los 3 puntitos ver la transcripción». Como la nota de voz de WhatsApp: el reproductor de la
// casa (AudioPlay, el mismo del chat con MaKo de cada cliente, app/_chat/HiloMako.tsx), con lo que dura. La transcripción
// NO va en la burbuja: la abre «Ver transcripción» del menú del mensaje, y se ve debajo del reproductor.
// El chat de destino sigue recibiendo la transcripción como texto: eso no cambió (lib/operaciones-reglas.ts → «Las notas
// de voz enviadas»).
// ⚠️ SIN EL AUDIO, LA TRANSCRIPCIÓN EN SU LUGAR: si el MP3 no subió, o pasaron sus 14 días, un reproductor que no suena no le
//    sirve a nadie. Mientras sube (los primeros segundos en otro dispositivo), un reproductor quieto del mismo tamaño.
// ⚠️ Quien la monta le da `key={id}` (Hilo.tsx), como a las fotos: la conversación se dibuja por posición.

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';
import { TOPE_REINTENTOS_MS, proximoIntento } from './fotos-enviadas';
import { escucharTranscripciones, leerVozEnviada, transcripcionAbierta, vozYaLeida } from './voces-enviadas';

/** Cuánto sirve la URL del servidor antes de pedir otra (la firma dura una hora: lib/operaciones-adjuntos.ts). */
const RENOVAR_MS = 50 * 60 * 1000;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

export function VozEnviada({ id, segundos, creado, transcripcion }: {
  id: string; segundos: number; creado?: string;
  /** Lo que se transcribió, ya dibujado (Hilo.tsx → TextoConListas). */
  transcripcion: ReactNode;
}) {
  // undefined = todavía no se sabe; null = no hay audio (se lee la transcripción).
  const [url, setUrl] = useState<string | null | undefined>(() => vozYaLeida(id));
  const abierta = useSyncExternalStore(escucharTranscripciones, () => transcripcionAbierta(id), () => false);
  useEffect(() => {
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout> | null = null;
    let intento = 0;
    const desde = creado ? Date.parse(creado) : NaN;
    const mirar = () => {
      void leerVozEnviada(id).then((u) => {
        if (!vivo) return;
        if (u) {
          setUrl(u);
          // La del servidor vence: antes de que pase, otra (la de este navegador, `blob:`, no).
          if (!u.startsWith('blob:')) reloj = setTimeout(mirar, RENOVAR_MS);
          return;
        }
        // Sube DESPUÉS de mandar: mientras el mensaje es nuevo, se vuelve a preguntar (12, 24, 48 s…). Uno viejo, no.
        const viejo = Number.isFinite(desde) && Date.now() - desde > TOPE_REINTENTOS_MS;
        const espera = viejo ? null : proximoIntento(intento, desde, Date.now());
        intento += 1;
        if (espera != null) reloj = setTimeout(mirar, espera);
        else setUrl(null);
      });
    };
    mirar();
    return () => { vivo = false; if (reloj) clearTimeout(reloj); };
  }, [id, creado]);

  if (url === null) return <>{transcripcion}</>;
  return (
    <span className="co-voz">
      {url
        ? <AudioPlay src={url} duracion={segundos} color="var(--primary)" style={{ width: 240 }} />
        : (
          <span className="co-voz__quieto" role="img" aria-label={`Nota de voz de ${fmt(segundos)}`}>
            <span className="co-voz__play" aria-hidden /><span className="co-voz__barra" aria-hidden /><span className="co-voz__dur">{fmt(segundos)}</span>
          </span>
        )}
      {abierta && <span className="co-voz__transcripcion">{transcripcion}</span>}
    </span>
  );
}
