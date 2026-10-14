'use client';

// =============================================================================
// OnboardingAdsManager — los tres pasos de la tab (tarea #801)
// =============================================================================
// WizardShell embebido (no tapa el sidebar), con el molde de OnboardingCarousels.
// Los pasos NO se marcan con botones: los deriva la page al abrir
// (./onboarding-datos.ts). Acá se dibuja lo que ya está y se manda a arreglar lo que
// falta: la cuenta y la página se conectan con el modal de Meta de Integraciones, abierto ACÁ (14/10/2026, Martín:
// «para una integración jamás se debe salir de la tab»); la primera campaña se crea con el asistente de siempre, que
// este wizard deja abierto al terminar.
//
// «Lo configuro después», la ✕ y «Salir» llevan a la tab con estado de CLIENTE:
// un router.refresh() re-corre el guard del server y devuelve el mismo wizard.

import { useState } from 'react';
import { WizardShell } from '../_components/WizardShell';
import { Button } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { useConectarIntegracion } from '../_components/ConectarIntegracion';
import { Icon } from '../_components/icons';
import type { SenalRecon } from '@/lib/queries';
import { AVISO_FALTAN_PERMISOS_META } from '@/lib/meta-permisos';
import type { OnboardingAds } from './onboarding-datos';
import { CampanasBrowser } from './CampanasBrowser';

const MONO = "'Geist Mono', monospace";
const PASOS = ['cuenta', 'pagina', 'campana'] as const;
type Paso = (typeof PASOS)[number];

/** Caja de contexto del paso (molde de la skill: surface-2 + eyebrow mono). */
function Contexto({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', textAlign: 'left' }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 7 }}>
        {eyebrow}
      </div>
      <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

/** Lo que ya está: un renglón con su tilde. */
function Hecho({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px', background: 'var(--surface)', textAlign: 'left' }}>
      <span style={{ color: 'var(--good)', display: 'inline-flex' }}><Icon name="check" size={16} /></span>
      <span style={{ fontSize: 14, color: 'var(--ink)' }}>{children}</span>
    </div>
  );
}

/** El botón que lo arregla, centrado (regla de la skill): el modal de Meta, ahí mismo. Al conectar, la page vuelve a
 *  derivar los pasos (`router.refresh`). */
function IrAConectar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { abrir, modal } = useConectarIntegracion({ onConectado: () => router.refresh() });
  return (
    <div style={{ alignSelf: 'center' }}>
      <Button icon={<Icon name="plug" size={16} />} onClick={() => abrir('meta')}>{children}</Button>
      {modal}
    </div>
  );
}

export function OnboardingAdsManager({ datos, senales, desde, hasta, adInicial, hoyReal }: {
  datos: OnboardingAds;
  senales: SenalRecon[]; desde: string; hasta: string; adInicial: string | null; hoyReal: string;
}) {
  const [salir, setSalir] = useState(false);
  const [abrirNueva, setAbrirNueva] = useState(false);
  const [paso, setPaso] = useState<Paso>(datos.pasoInicial);

  if (salir) {
    // El mismo <main> que dibuja AdsManagerView: el wizard embebido ocupa su lugar.
    return (
      <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px' }}>
        <CampanasBrowser senales={senales} desde={desde} hasta={hasta} adInicial={adInicial} hoyReal={hoyReal} abrirNueva={abrirNueva} />
      </main>
    );
  }

  const idx = PASOS.indexOf(paso);
  const { cuenta, pagina } = datos;
  const puedeAvanzar = paso === 'cuenta' ? cuenta.ok : paso === 'pagina' ? pagina.ok : cuenta.ok && pagina.ok;
  const pregunta = paso === 'cuenta' ? 'Tu cuenta publicitaria' : paso === 'pagina' ? 'La página que firma tus anuncios' : 'Tu primera campaña en pausa';

  return (
    <WizardShell
      titulo="Ads Manager · Configuración"
      pasos={PASOS}
      pasoActual={paso}
      pregunta={pregunta}
      puedeAvanzar={puedeAvanzar}
      enUltimo={paso === 'campana'}
      confirmLabel="Crear mi primera campaña"
      atrasLabel={idx === 0 ? 'Salir' : 'Atrás'}
      onAtras={() => (idx === 0 ? setSalir(true) : setPaso(PASOS[idx - 1]))}
      onSiguiente={() => setPaso(PASOS[Math.min(idx + 1, PASOS.length - 1)])}
      onConfirmar={() => { setAbrirNueva(true); setSalir(true); }}
      onClose={() => setSalir(true)}
      fullscreen
      embebido
      extraFooter={
        <button
          onClick={() => setSalir(true)}
          style={{ border: 'none', background: 'transparent', color: 'var(--faint)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
        >
          Lo configuro después
        </button>
      }
    >
      {paso === 'cuenta' && (cuenta.ok ? (
        <>
          <Hecho>Cuenta {cuenta.accountId ?? 'conectada'} · {cuenta.moneda} · {cuenta.estado}</Hecho>
          <Contexto eyebrow="Ya está conectada">
            MaKo lee esta cuenta en vivo: el estado de cada campaña, su presupuesto y lo que
            gastó, cruzado con los leads y las ventas de tu CRM.
          </Contexto>
        </>
      ) : (
        <>
          <IrAConectar>Conectar Meta</IrAConectar>
          {cuenta.motivo === 'permisos' ? (
            <Contexto eyebrow="Faltan permisos de anuncios">{AVISO_FALTAN_PERMISOS_META}</Contexto>
          ) : cuenta.motivo === 'lectura' ? (
            <Contexto eyebrow="Meta no contestó">
              La cuenta está conectada pero no se pudo leer. Revisa la conexión en Integraciones.
              {cuenta.detalle ? <> Lo que dijo Meta: {cuenta.detalle}</> : null}
            </Contexto>
          ) : (
            <Contexto eyebrow="Por qué va primero">
              Esta tab es tu cuenta de Meta: sin ella no hay campañas que mostrar. Se conecta una
              sola vez en Integraciones, y al volver aquí MaKo la lee sola.
            </Contexto>
          )}
        </>
      ))}

      {paso === 'pagina' && (pagina.ok ? (
        <>
          <Hecho>{pagina.nombre ?? 'Tu página de Facebook'}{pagina.instagram ? ` · @${pagina.instagram}` : ''}</Hecho>
          <Contexto eyebrow="Con qué nombre salen tus anuncios">
            Cada anuncio sale con el nombre y la foto de esta página, y con su Instagram si tiene
            uno vinculado. En el asistente de cada campaña puedes elegir otra.
          </Contexto>
        </>
      ) : (
        <>
          <IrAConectar>Elegir la página</IrAConectar>
          <Contexto eyebrow="Con qué nombre salen tus anuncios">
            Meta publica cada anuncio a nombre de una página de Facebook. Se elige en
            Integraciones → Meta, entre las páginas de tu cuenta.
          </Contexto>
        </>
      ))}

      {paso === 'campana' && (
        <Contexto eyebrow="Se crea en pausa">
          El asistente de MaKo arma la campaña con tus creativos y la deja en pausa: nada se
          publica ni se cobra hasta que la actives desde la tabla.
        </Contexto>
      )}
    </WizardShell>
  );
}
