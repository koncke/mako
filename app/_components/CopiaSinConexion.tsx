'use client';

// =============================================================================
// <CopiaSinConexion> — renueva la copia de MaKo sin conexión mientras hay conexión (28/10/2026)
// =============================================================================
// No pinta nada salvo el panel de lo escrito sin conexión (<SubirCambios>, T2), que sólo aparece si hay algo en la cola.
// Sólo trabaja en un navegador donde la persona ACTIVÓ MaKo sin conexión (Settings › Instalar la app): ahí
// registra el service worker (el que sirve el cascarón sin red, public/sw.js) y guarda la copia al entrar si la última tiene
// más de `CADA_MS`, cada `CADA_MS`, al volver la red y al volver a la pestaña. En una PC donde nadie lo activó no hace nada:
// ni crea la base ni pide nada al servidor.
// Lo monta el layout sólo con sesión, en la computadora y sin mirar la cuenta de otro (app/layout.tsx).
// Varias pestañas abiertas guardan UNA vez: el candado del navegador (`navigator.locks`) y la hora de la última.
// =============================================================================

import { useEffect, useState } from 'react';
import { registrarServiceWorker } from '@/lib/push-cliente';
import { estaActivado, guardarAhora, tocaGuardar as toca } from '@/lib/sin-conexion/en-la-app';
import { CADA_MS, EVENTO_ACTIVADO } from '@/lib/sin-conexion/reglas';
import { SubirCambios } from './SubirCambios';

export function CopiaSinConexion({ email }: { email: string }) {
  // T2: activado en este navegador, monta el panel de lo escrito sin conexión (que sólo se ve si la cola tiene algo).
  const [activado, setActivado] = useState(false);
  useEffect(() => {
    if (!email || typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) return;
    let vivo = true;
    let activo = false;
    let reloj: ReturnType<typeof setInterval> | null = null;

    // La hora de la última copia Y la del último intento fallido (después de un fallo se espera: en-la-app.ts).
    const tocaGuardar = () => toca(email);
    const guardar = async () => {
      if (!vivo || !activo || !navigator.onLine || document.visibilityState === 'hidden' || !(await tocaGuardar())) return;
      const correr = async () => {
        // Otra pestaña pudo guardar mientras esperábamos el candado.
        if (!(await tocaGuardar())) return;
        const r = await guardarAhora(email).catch((e) => { console.warn('[sin-conexion]', e instanceof Error ? e.message : e); return 'error' as const; });
        if (r === 'desconectada') vivo = false;
      };
      if (navigator.locks?.request) await navigator.locks.request('mako-sin-conexion', { ifAvailable: true }, async (candado) => { if (candado) await correr(); });
      else await correr();
    };

    const arrancar = async () => {
      if (activo || !vivo || !(await estaActivado(email)) || !vivo) return;
      activo = true;
      setActivado(true);
      await registrarServiceWorker();
      await guardar();
      reloj = setInterval(() => void guardar(), CADA_MS);
    };
    void arrancar();
    const alVolver = () => void guardar();
    // La fila de Perfil avisa cuando la persona lo activa en esta pestaña (`EVENTO_ACTIVADO`): sin recargar, empieza a renovar.
    const alActivar = () => void arrancar();
    window.addEventListener('online', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener(EVENTO_ACTIVADO, alActivar);
    return () => {
      vivo = false;
      if (reloj) clearInterval(reloj);
      window.removeEventListener('online', alVolver);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener(EVENTO_ACTIVADO, alActivar);
    };
  }, [email]);
  return activado ? <SubirCambios email={email} /> : null;
}
