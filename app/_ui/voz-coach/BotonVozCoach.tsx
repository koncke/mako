'use client';

// =============================================================================
// BotonVozCoach — escuchar un mensaje de un coach (Offer Coach, Funnel Coach) con la voz de la plataforma
// =============================================================================
// Martín (18/11/2026): «ponerle voz también a Offer Coach… para que vaya narrando lo que va preguntando». Lo que fija:
//   · NO TAPA EL TEXTO: es un botón chico DEBAJO del mensaje, que sigue ahí entero; el audio es un extra.
//   · SUENA SOLO LA PRIMERA VEZ, y sólo si el mensaje lo pide (`autoplay`: el último del coach, el que acaba de llegar) y la persona
//     no lo apagó («Que suene solo»). Un mensaje que ya sonó no vuelve a sonar solo (`sueneSolo`, lib/voz-coach-reglas.ts).
//   · SIN LA KEY O FUERA DE LA REVISIÓN, NADA: el botón no se dibuja (GET /api/voz-coach → `disponible`). Nada a medias.
//   · Un navegador que no deja sonar sin un toque (`play()` rechazado) queda quieto: el botón sigue para tocarlo.
// `fija`: una pregunta predefinida del coach; el servidor la guarda la primera vez y después sale al instante, sin pagarla.
// Se monta en el chat del coach (app/second-brain/ChatDelCoach.tsx lo monta el chat del onboarding, punta/offer-coach-v2).
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CLAVE_AUTO_VOZ_COACH, CLAVE_SONADOS_VOZ_COACH, conSonado, leerSonados, sueneSolo, textoParaVozCoach,
} from '@/lib/voz-coach-reglas';

/** Si el botón se muestra: se pregunta UNA vez por página (todos los mensajes comparten la respuesta). */
let disponibleP: Promise<boolean> | null = null;
const disponible = (): Promise<boolean> => (disponibleP ??= fetch('/api/voz-coach', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : { disponible: false }))
  .then((j: { disponible?: unknown }) => j.disponible === true)
  .catch(() => false));

// localStorage puede no estar (modo privado, una vista previa): sin él, el botón anda igual y sólo no recuerda.
const leer = (k: string): string | null => { try { return window.localStorage.getItem(k); } catch { return null; } };
const escribir = (k: string, v: string): void => { try { window.localStorage.setItem(k, v); } catch { /* sin memoria */ } };

type Estado = 'quieto' | 'cargando' | 'sonando' | 'error';

export function BotonVozCoach({ id, texto, fija = false, autoplay = false }: {
  /** El id del mensaje: para recordar que ya sonó. */
  id: string;
  /** El texto del mensaje, tal cual se ve: la voz saca lo que no se lee. */
  texto: string;
  /** Una pregunta predefinida del coach (se guarda la primera vez). */
  fija?: boolean;
  /** Que suene solo al aparecer (el último mensaje del coach). */
  autoplay?: boolean;
}) {
  const dicho = textoParaVozCoach(texto);
  const [ve, setVe] = useState(false);
  const [estado, setEstado] = useState<Estado>('quieto');
  const [auto, setAuto] = useState(true);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);

  useEffect(() => {
    if (!dicho) return;
    let vivo = true;
    setAuto(leer(CLAVE_AUTO_VOZ_COACH) !== '0');
    void disponible().then((d) => { if (vivo) setVe(d); });
    return () => { vivo = false; };
  }, [dicho]);

  useEffect(() => () => {
    audio.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
  }, []);

  const sonar = useCallback(async (solo: boolean) => {
    if (!dicho) return;
    if (audio.current && !audio.current.paused) { audio.current.pause(); audio.current.currentTime = 0; setEstado('quieto'); return; }
    escribir(CLAVE_SONADOS_VOZ_COACH, JSON.stringify(conSonado(leerSonados(leer(CLAVE_SONADOS_VOZ_COACH)), id)));
    try {
      if (!url.current) {
        setEstado('cargando');
        const r = await fetch('/api/voz-coach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto, fija }) });
        if (!r.ok) { setEstado('error'); return; }
        url.current = URL.createObjectURL(await r.blob());
      }
      const a = audio.current ?? new Audio();
      audio.current = a;
      a.src = url.current;
      a.onended = () => setEstado('quieto');
      await a.play();
      setEstado('sonando');
    } catch {
      // Sin un toque, el navegador puede no dejar sonar (la política de autoplay): queda para tocarlo.
      setEstado(solo ? 'quieto' : 'error');
    }
  }, [dicho, fija, id, texto]);

  useEffect(() => {
    if (!ve || !dicho) return;
    const yaSono = leerSonados(leer(CLAVE_SONADOS_VOZ_COACH)).includes(id);
    if (sueneSolo({ autoplay, apagado: leer(CLAVE_AUTO_VOZ_COACH) === '0', yaSono })) void sonar(true);
    // Sólo al aparecer: después, lo decide la persona.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ve]);

  if (!dicho || !ve) return null;
  const cambiarAuto = () => { const nuevo = !auto; setAuto(nuevo); escribir(CLAVE_AUTO_VOZ_COACH, nuevo ? '1' : '0'); };
  const rotulo = estado === 'sonando' ? 'Parar' : estado === 'cargando' ? 'Cargando…' : estado === 'error' ? 'No se pudo: reintentar' : 'Escuchar';
  return (
    <span className="mk-voz-coach" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 12 }}>
      <button
        type="button"
        onClick={() => void sonar(false)}
        disabled={estado === 'cargando'}
        aria-label={estado === 'sonando' ? 'Parar el audio de este mensaje' : 'Escuchar este mensaje'}
        className="mk-btn mk-btn--tertiary mk-btn--sm"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)' }}
      >
        <span aria-hidden>{estado === 'sonando' ? '■' : '▶'}</span> {rotulo}
      </button>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--faint)', cursor: 'pointer' }}>
        <input type="checkbox" checked={auto} onChange={cambiarAuto} /> Que suene solo
      </label>
    </span>
  );
}

export default BotonVozCoach;
