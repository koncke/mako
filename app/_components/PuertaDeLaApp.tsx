'use client';

// =============================================================================
// PuertaDeLaApp — la app de escritorio pide el login de la persona en cada ventana nueva (25/10/2026)
// =============================================================================
// Martín: «la app de desktop jamás me pidió login, eso esta muy mal, entró directo a la cuenta de Mauricio». La regla y el
// porqué viven en lib/app-escritorio-reglas.ts; acá sólo se aplica:
//   · fuera de la app (una pestaña del navegador, el teléfono) no hace nada;
//   · en el login (y en lo público), la ventana anota desde cuándo espera (la hora del SERVIDOR, /api/auth/entrada);
//   · en el resto, pasa sólo si ya entró en ESTA ventana o si la sesión nació después de esa hora; si no, al login de la app
//     (`/login?app=1`), que no dice «Ya tienes la sesión abierta» y pide entrar.
// Mientras decide, una tapa: sin ella se veía un instante la cuenta que hubiera en el perfil (la de otro). La tapa sólo se
// pinta en la app instalada de la computadora (puerta-app.css); en una pestaña común no tapa nada.
// Sin red no se traba: si /api/auth/entrada no contesta, pasa (la sesión la sigue mirando el servidor en cada pedido).

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { esPublica } from '@/lib/rutas-publicas';
import {
  CLAVE_PUERTA, PARAM_APP, decidirPuerta, destinoTrasLogin, escribirPuerta, esVentanaDeApp, leerPuerta, loginDeLaApp,
} from '@/lib/app-escritorio-reglas';
import './puerta-app.css';

const leerGuardado = (): string | null => { try { return sessionStorage.getItem(CLAVE_PUERTA); } catch { return null; } };
const guardar = (v: string) => { try { sessionStorage.setItem(CLAVE_PUERTA, v); } catch { /* sin sessionStorage: pregunta en cada carga */ } };
const entrada = (): Promise<{ ahora?: number; emitida?: number | null } | null> =>
  fetch('/api/auth/entrada', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
const MODOS_DE_APP = ['standalone', 'window-controls-overlay', 'minimal-ui'];

export function PuertaDeLaApp() {
  const ruta = usePathname() ?? '';
  const publica = esPublica(ruta);
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    const instalada = MODOS_DE_APP.some((m) => window.matchMedia(`(display-mode: ${m})`).matches);
    const conParam = new URLSearchParams(window.location.search).get(PARAM_APP) === '1';
    const puerta = leerPuerta(leerGuardado());
    if (!esVentanaDeApp({ instalada, conParam, marcada: puerta != null, ua: navigator.userAgent })) { setAbierta(true); return; }
    if (puerta === 'adentro') { setAbierta(true); return; }
    let vivo = true;
    void (async () => {
      const e = await entrada();
      if (!vivo) return;
      if (!e?.ahora) { setAbierta(true); return; }
      // En el login: la ventana empieza a esperar acá (si arrancó sin sesión, el proxy la trajo directo).
      if (publica) { if (!puerta) guardar(escribirPuerta({ desde: e.ahora })); setAbierta(true); return; }
      const d = decidirPuerta({ puerta, emitida: e.emitida ?? null });
      if (d === 'entro') { guardar(escribirPuerta('adentro')); setAbierta(true); return; }
      if (!puerta) guardar(escribirPuerta({ desde: e.ahora }));
      window.location.replace(loginDeLaApp(destinoTrasLogin(window.location.pathname, window.location.search)));
    })();
    return () => { vivo = false; };
  }, [ruta, publica]);
  if (publica || abierta) return null;
  return <div className="puerta-app" aria-hidden />;
}
