'use client';

// =============================================================================
// TarjetaSetup — lo que el plan pide dejar CONECTADO, adentro del chat del onboarding (27/10/2026)
// =============================================================================
// Martín (27/10/2026), textual: «no dejarlos avanzar hasta que no hayan hecho su setup, descargar la app de mako, instalar
// la extensión, conectar su cuenta de Meta con login, etc... Claro que siempre el sistema debe detectar si ya lo tienen».
//
// Una fila por paso, con lo que MaKo DETECTÓ (lib/setup-negocio-server.ts): ✓ hecho, saltado, o el botón que lo resuelve.
// Nada se tilda a mano. Lo que gobierna esta pieza:
//   · JAMÁS SE SALE DE LA PANTALLA para conectar (AGENTS.md): Meta y Google Calendar abren EL modal de /integraciones
//     (`BotonIntegracion`, Meta va a Zernio con el login de Facebook); WhatsApp, el QR de Automations (`ConectarMedio`); la
//     computadora y la IA, «Tus cuentas de IA» en un Modal. La extensión es la única que se instala afuera: en la Chrome
//     Web Store cuando publica la versión de hoy (`EXTENSION_EN_TIENDA`), si no, la página de instalar.
//   · LA EXTENSIÓN SE VE EN EL NAVEGADOR: `data-mako-puente` en el `<html>` (`useExtensionInstalada`). Apenas aparece, se
//     le dice al servidor qué versión es (acción `setup-extension`) y la lista se vuelve a mirar.
//   · VUELVE A MIRAR SOLA al cerrar un modal, al conectar, y al volver a la pestaña (después de instalar algo afuera).
//   · En un teléfono, lo que sólo se hace en una computadora lo dice en vez de ofrecer el botón.
// =============================================================================

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/app/_ui';
import { BotonIntegracion, VueltaDeGoogle } from '@/app/_components/ConectarIntegracion';
import { useExtensionInstalada } from '@/app/video-generator/extension-instalada';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { EXTENSION_EN_TIENDA, EXTENSION_URL_TIENDA } from '@/lib/extension-tienda';
import { SETUP, TEXTO_SALTO, resumenSetup, type EstadoSetup, type ItemSetup, type PasoSetup, type Salto } from '@/lib/setup-negocio';

// Las dos piezas grandes se cargan cuando se abren: el onboarding no las trae en su primer cuadro.
const TusCuentasIA = dynamic(() => import('@/app/integraciones/TusCuentasIA').then((m) => m.TusCuentasIA), { ssr: false, loading: () => null });
const ConectarMedio = dynamic(() => import('@/app/automations/ConectarMedio').then((m) => m.ConectarMedio), { ssr: false, loading: () => null });

/** ¿Este navegador es de un teléfono? Para decir «hazlo en tu computadora» en vez de ofrecer un botón que no sirve ahí. */
function useEsTelefono(): boolean {
  const [es, setEs] = useState(false);
  useEffect(() => { setEs(/Android|iPhone|iPod|Mobile/i.test(navigator.userAgent)); }, []);
  return es;
}

type Accion = (cuerpo: Record<string, unknown>) => Promise<void>;

export function TarjetaSetup({ setup, ocupado, onAccion }: { setup: EstadoSetup; ocupado: boolean; onAccion: Accion }) {
  const ws = useWs();
  const telefono = useEsTelefono();
  const [abierto, setAbierto] = useState<'ia' | 'whatsapp' | null>(null);
  const mirar = useCallback((avisar = false) => onAccion({ action: 'setup', ...(avisar ? { avisar: true } : {}) }), [onAccion]);

  // La extensión que ve ESTE navegador: se le dice al servidor una vez por versión, y se vuelve a mirar.
  const extension = useExtensionInstalada();
  const avisada = useRef<string | null>(null);
  const pideExtension = setup.items.some((i) => i.paso === 'extension' && i.estado !== 'hecho');
  useEffect(() => {
    if (typeof extension !== 'string' || !pideExtension || avisada.current === extension) return;
    avisada.current = extension;
    void onAccion({ action: 'setup-extension', version: extension });
  }, [extension, pideExtension, onAccion]);

  // Al volver a la pestaña (instaló la app o la extensión afuera), se vuelve a mirar.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') void mirar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [mirar]);

  const saltar = (paso: PasoSetup, salto: Salto | null) => onAccion({ action: 'setup-saltar', paso, salto });
  const linkExtension = EXTENSION_EN_TIENDA ? EXTENSION_URL_TIENDA : conWs('/extension/instalar', ws);

  const boton = (i: ItemSetup) => {
    const def = SETUP[i.paso];
    if (telefono && def.soloComputadora) return <span className="arr-setup__nota">Hazlo desde tu computadora.</span>;
    switch (i.paso) {
      case 'desktop':
      case 'ia':
        return <button type="button" className="arr-link arr-link--principal" disabled={ocupado} onClick={() => setAbierto('ia')}>{def.boton}</button>;
      case 'extension':
        return <a className="arr-link arr-link--principal" href={linkExtension} target="_blank" rel="noopener noreferrer">{def.boton}</a>;
      case 'meta':
        return <BotonIntegracion servicio="meta" className="arr-link arr-link--principal" onConectado={() => void mirar()}>{def.boton}</BotonIntegracion>;
      case 'calendario':
        return <BotonIntegracion servicio="google" className="arr-link arr-link--principal" onConectado={() => void mirar()}>{def.boton}</BotonIntegracion>;
      case 'whatsapp':
        return <button type="button" className="arr-link arr-link--principal" disabled={ocupado} onClick={() => setAbierto('whatsapp')}>{def.boton}</button>;
    }
  };

  return (
    <div className="arr-tarjeta arr-setup" data-setup="">
      {/* La vuelta del login de Google a esta pantalla: con un «ok», se vuelve a mirar. */}
      <VueltaDeGoogle onOk={() => void mirar()} />
      <span className="arr-tarjeta__rotulo">{resumenSetup(setup)}</span>
      <ul className="arr-setup__lista">
        {setup.items.map((i) => {
          const def = SETUP[i.paso];
          const listo = i.estado === 'hecho' || i.estado === 'saltado';
          return (
            <li key={i.paso} className={`arr-setup__fila${listo ? ' arr-setup__fila--lista' : ''}`} data-paso={i.paso} data-estado={i.estado}>
              <span className="arr-setup__marca" aria-hidden>{listo ? '✓' : i.estado === 'no_pude' ? '!' : ''}</span>
              <span className="arr-setup__texto">
                <b>{def.titulo}</b>
                <span className="arr-setup__detalle">{i.detalle ?? def.para}</span>
              </span>
              {!listo && (
                <span className="arr-setup__acciones">
                  {boton(i)}
                  {i.salto && <button type="button" className="arr-setup__saltar" disabled={ocupado} onClick={() => void saltar(i.paso, i.salto)}>{TEXTO_SALTO[i.salto]}</button>}
                </span>
              )}
              {i.estado === 'saltado' && <button type="button" className="arr-setup__saltar" disabled={ocupado} onClick={() => void saltar(i.paso, null)}>Conectarlo igual</button>}
            </li>
          );
        })}
      </ul>
      <div className="arr-links">
        <button type="button" className="arr-link" disabled={ocupado} onClick={() => void mirar(true)}>Ya está, seguir</button>
      </div>
      {abierto === 'ia' && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { setAbierto(null); void mirar(); }} ancho={640}>
          <TusCuentasIA sinCabecera />
        </Modal>
      )}
      {abierto === 'whatsapp' && <ConectarMedio medio="whatsapp" onCerrar={() => { setAbierto(null); void mirar(); }} onConectado={() => void mirar()} />}
    </div>
  );
}

/** Los estilos de la tarjeta, para el bloque de estilos del onboarding (la misma familia que `.arr-tarjeta`). */
export const CSS_SETUP = `
.arr-setup__lista { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.arr-setup__fila {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; background: var(--surface);
  border: 1px solid var(--border); flex-wrap: wrap;
}
.arr-setup__marca {
  flex: none; display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%;
  border: 1px solid var(--border-strong); color: var(--on-primary); font-size: 12px; font-weight: 700;
}
.arr-setup__fila--lista .arr-setup__marca { background: var(--ok, var(--primary)); border-color: var(--ok, var(--primary)); }
.arr-setup__fila[data-estado="no_pude"] .arr-setup__marca { background: var(--warn); border-color: var(--warn); }
.arr-setup__texto { flex: 1 1 160px; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: var(--fs-sm); color: var(--ink); }
.arr-setup__detalle { color: var(--dim); font-size: var(--fs-meta); overflow-wrap: anywhere; }
.arr-setup__acciones { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.arr-setup__saltar {
  border: 0; background: none; padding: 4px 2px; color: var(--dim); font: inherit; font-size: var(--fs-meta);
  text-decoration: underline; cursor: pointer;
}
.arr-setup__nota { color: var(--dim); font-size: var(--fs-meta); }
`;
