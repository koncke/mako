'use client';

// =============================================================================
// OnboardingCarousels — las 3 etapas de la tab (Conectar → Contexto → Ensayo)
// =============================================================================
// WizardShell embebido (misma pieza que el onboarding de Instagram, SIN tapar el
// sidebar). El estado vive en app_settings vía lib/tab-onboarding-state.ts
// ('carousels', keys con prefijo carousels_ para no colisionar con los pasos
// compartidos de otras tabs).
//
// Conectar acá NO bloquea (a diferencia de /instagram): escribir guiones no
// necesita la cuenta — la cuenta recién hace falta al PUBLICAR, que vive en
// /instagram. Por eso el paso es un aviso suave con link, y el wizard deja
// avanzar siempre. El ensayo ES la primera pieza generada.

import { useCallback, useState } from 'react';
import { WizardShell } from '../_components/WizardShell';
import { Button } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { Icon } from '../_components/icons';
import type { PiezaCarrusel } from '@/lib/ig-writer';
import { CarouselsApp } from './CarouselsApp';
import { generarCarruselAction, marcarPasoCarouselsAction } from './actions';

const MONO = "'Geist Mono', monospace";

const PASOS = ['conectar', 'contexto', 'ensayo'] as const;
type Paso = (typeof PASOS)[number];

const PEDIDO_MUESTRA =
  'Un carrusel sobre el error más común que cometen tus clientes antes de trabajar contigo, que cierre pidiendo un comentario con palabra clave.';

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

export function OnboardingCarousels({ igConectada, perfilCargado }: { igConectada: boolean; perfilCargado: boolean }) {
  // Estado de CLIENTE y no router.refresh(): refrescar re-corre el guard del
  // server y devuelve el mismo wizard — «Lo configuro después» y la ✕ tienen
  // que llevar a la tab de verdad (mismo porqué que OnboardingInstagram).
  const [salir, setSalir] = useState(false);

  const [paso, setPaso] = useState<Paso>('conectar');
  const [error, setError] = useState<string | null>(null);
  const [busyPaso, setBusyPaso] = useState(false);

  // ── Ensayo ──
  const [pedido, setPedido] = useState(PEDIDO_MUESTRA);
  const [pieza, setPieza] = useState<PiezaCarrusel | null>(null);
  const [busyEnsayo, setBusyEnsayo] = useState(false);

  const generarMuestra = useCallback(async () => {
    setBusyEnsayo(true);
    setError(null);
    const r = await generarCarruselAction(pedido, 'educativo');
    setBusyEnsayo(false);
    if (!r.ok) { setError(r.error); return; }
    setPieza(r.pieza);
  }, [pedido]);

  if (salir) return <CarouselsApp igConectada={igConectada} perfilCargado={perfilCargado} piezaInicial={pieza} />;

  const idx = PASOS.indexOf(paso);
  const puedeAvanzar = paso === 'ensayo' ? Boolean(pieza) : true;

  const avanzar = async () => {
    setError(null);
    if (paso === 'conectar') { setPaso('contexto'); return; }
    if (paso === 'contexto') {
      setBusyPaso(true);
      const r = await marcarPasoCarouselsAction('carousels_contexto');
      setBusyPaso(false);
      if (!r.ok) { setError(r.error); return; }
      setPaso('ensayo');
    }
  };

  const confirmar = async () => {
    setError(null);
    setBusyPaso(true);
    const r = await marcarPasoCarouselsAction('carousels_ensayo');
    setBusyPaso(false);
    if (!r.ok) { setError(r.error); return; }
    setSalir(true);
  };

  const pregunta = paso === 'conectar'
    ? 'Tu cuenta de Instagram'
    : paso === 'contexto'
      ? 'Contexto del negocio'
      : 'Tu primer carrusel';

  const sub = paso === 'conectar'
    ? 'Para escribir carruseles no hace falta la cuenta conectada — solo para publicarlos.'
    : paso === 'contexto'
      ? undefined
      : 'Describe una pieza y mira cómo MaKo la escribe slide a slide con los datos de tu negocio.';

  return (
    <WizardShell
      titulo="Carousels · Configuración"
      pasos={PASOS}
      pasoActual={paso}
      pregunta={pregunta}
      sub={sub}
      error={error}
      puedeAvanzar={puedeAvanzar}
      enUltimo={paso === 'ensayo'}
      confirmLabel="Terminar configuración"
      pending={busyPaso}
      atrasLabel={idx === 0 ? 'Salir' : 'Atrás'}
      onAtras={() => (idx === 0 ? setSalir(true) : setPaso(PASOS[idx - 1]))}
      onSiguiente={() => void avanzar()}
      onConfirmar={() => void confirmar()}
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
      {paso === 'conectar' && (
        <>
          {igConectada ? (
            // La recompensa es el estado real, no un tilde suelto.
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
              <Icon name="check" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14.5 }}>Cuenta de Instagram conectada</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>Los borradores que envíes a publicación se completan y programan en Instagram.</div>
              </div>
            </div>
          ) : (
            // Aviso SUAVE, sin bloquear: la conexión vive en /instagram y este
            // wizard no la duplica (una sola puerta de entrada para el canal).
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
              <Icon name="instagram" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14.5 }}>Sin cuenta de Instagram conectada</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                  Puedes escribir igual. Para publicar,{' '}
                  <Link href="/instagram" style={{ color: 'var(--primary-strong)', fontWeight: 600 }}>conéctala en Instagram →</Link>
                </div>
              </div>
            </div>
          )}
          <Contexto eyebrow="Por qué no es obligatorio">
            Esta tab escribe el guion del carrusel: portada-gancho, texto por slide, notas de
            diseño y caption. Todo eso se produce sin la cuenta. La conexión recién importa
            al enviar la pieza a publicación, y ese paso vive en la tab Instagram — donde se
            conecta una sola vez para todas las tabs de contenido.
          </Contexto>
        </>
      )}

      {paso === 'contexto' && (
        perfilCargado ? (
          <Contexto eyebrow="Esto ya lo tengo de ti">
            Para escribir, MaKo usa el contexto que ya cargaste en la app: el perfil del
            negocio, tu oferta, tu cliente ideal y tu funnel — la palabra clave del CTA
            empuja hacia la entrada real de tu embudo. No hay nada nuevo que pedir aquí: si
            ese contexto cambia, se actualiza en el onboarding del negocio y esta tab lo
            toma sola.
          </Contexto>
        ) : (
          <Contexto eyebrow="Falta el perfil del negocio">
            MaKo puede escribir igual, pero sin tu marca, tu oferta y tu cliente ideal las
            piezas salen genéricas. Ese contexto se carga una sola vez en el{' '}
            <Link href="/onboarding" style={{ color: 'var(--primary-strong)', fontWeight: 600 }}>onboarding del negocio →</Link>{' '}
            y todas las tabs de contenido lo toman de ahí.
          </Contexto>
        )
      )}

      {paso === 'ensayo' && (
        <>
          <textarea
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '12px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 14, outline: 'none', resize: 'vertical' }}
            aria-label="Qué carrusel quieres de muestra"
          />
          <Button variant="secondary" onClick={() => void generarMuestra()} loading={busyEnsayo} style={{ alignSelf: 'center' }}>
            Generar carrusel de muestra
          </Button>
          {pieza && (
            <div style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px', background: 'var(--surface)' }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 7 }}>
                Portada · {pieza.slides.length} slides
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, fontWeight: 600 }}>{pieza.slides[0]?.texto}</div>
              {pieza.slides[0]?.visual && (
                <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 5 }}>{pieza.slides[0].visual}</div>
              )}
            </div>
          )}
          <Contexto eyebrow="Qué sigue después">
            Al terminar entras a la tab completa: ahí editas el texto de cada slide, ajustas
            la caption y envías la pieza a publicación como borrador — la media se completa
            y se programa en Instagram. La pieza de muestra te espera lista para seguir.
          </Contexto>
        </>
      )}
    </WizardShell>
  );
}
