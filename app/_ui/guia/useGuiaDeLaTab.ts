'use client';

// =============================================================================
// useGuiaDeLaTab — lo único que llama una tab para tener su guía (29/10/2026)
// =============================================================================
//   const guia = useGuiaDeLaTab('mako', { listo: k.cargado, hechos: { sinApp, sinIA } });
//   <button className="co-ayuda" onClick={() => guia.ofrecer()}>?</button>
// Registra el catálogo de la tab (lib/guia/catalogo.ts → guiaDe), y la PRIMERA VEZ de la persona en la tab, cuando la tab está
// lista hace 1,2 s, sin un modal encima ni otra cosa hablando, pregunta «¿Quieres que te ayude a aprender a usar esta pestaña?»
// (lib/guia/reglas.ts → debePreguntar). Lo contestado marca lo visto (lib/guia/primera-vez.ts). `?guia=<objetivo>` en la URL
// (el «Ir a <Tab>» de otra pantalla) empieza ese objetivo apenas la tab está lista, y se saca de la URL.

import { useEffect, useRef, useState } from 'react';
import { useProfundidadModales } from '@/app/_components/pila-modales';
import { guiaDe } from '@/lib/guia/catalogo';
import { esAngosta } from '@/lib/guia/huecos';
import { debePreguntar, ESPERA_PREGUNTA_MS } from '@/lib/guia/reglas';
import { marcasAlContestar, yaLaVio } from '@/lib/guia/primera-vez';
import type { HechosGuia, RolGuia } from '@/lib/guia/tipos';
import { marcarVistos, useVistos, vistosAhora } from '../useVisto';
import { guiaAhora, hechosDeLaGuia, ofrecer, preguntarPrimeraVez, registrarGuia, sinPrimeraVez, soltarGuia } from './store';

export function useGuiaDeLaTab(key: string, o: { listo: boolean; hechos?: HechosGuia; rol?: RolGuia; onboardingPendiente?: boolean }): { ofrecer: (objetivo?: string) => void } {
  const guia = guiaDe(key);
  const hechos = o.hechos ?? {};
  const firma = JSON.stringify(hechos);
  useEffect(() => {
    if (!guia) return;
    registrarGuia(guia, hechos, o.rol);
    return () => soltarGuia(guia.key);
  }, [guia?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (guia) hechosDeLaGuia(hechos); }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps

  const vistos = useVistos();
  const modales = useProfundidadModales();
  const [listoDesde, setListoDesde] = useState<number | null>(null);
  useEffect(() => { if (o.listo && listoDesde == null) setListoDesde(Date.now()); }, [o.listo, listoDesde]);
  const decidido = useRef(false);

  // La primera vez: se decide una sola vez por visita, a los 1,2 s de estar lista.
  useEffect(() => {
    if (!guia || decidido.current || listoDesde == null) return;
    const vio = yaLaVio(vistos, guia.key);
    if (vio === true) { decidido.current = true; sinPrimeraVez(); return; }
    const mirar = () => {
      const e = guiaAhora();
      const angosta = typeof window !== 'undefined' && esAngosta(window.innerWidth);
      const si = debePreguntar({
        yaLaVio: yaLaVio(vistosAhora(), guia.key), listoHaceMs: Date.now() - listoDesde, modalAbierto: modales > 0,
        otraHablando: e.dice != null || e.objetivo != null, onboardingPendiente: o.onboardingPendiente, soloComputadora: guia.soloComputadora, angosta,
      });
      if (!si) return;
      decidido.current = true;
      preguntarPrimeraVez((yaSabe) => marcarVistos(marcasAlContestar(vistosAhora() ?? new Set(), guia.key, yaSabe)));
    };
    const falta = Math.max(0, ESPERA_PREGUNTA_MS - (Date.now() - listoDesde));
    const t = window.setTimeout(mirar, falta + 30);
    return () => window.clearTimeout(t);
  }, [guia, vistos, listoDesde, modales, o.onboardingPendiente]);

  // Un «Ir a <Tab>» de otra pantalla trae `?guia=<objetivo>`: se empieza con la tab lista, y se saca de la URL.
  useEffect(() => {
    if (!guia || listoDesde == null) return;
    try {
      const u = new URL(window.location.href);
      const pedido = u.searchParams.get('guia');
      if (!pedido) return;
      u.searchParams.delete('guia');
      window.history.replaceState(null, '', u);
      decidido.current = true;
      ofrecer(pedido === '1' ? undefined : pedido);
    } catch { /* es una comodidad */ }
  }, [guia, listoDesde]);

  return { ofrecer };
}
