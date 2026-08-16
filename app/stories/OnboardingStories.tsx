'use client';

// El Link de la casa, no un <a> crudo: preserva el ?ws= de la pestaña.
import Link from '@/app/_ui/Link';

// =============================================================================
// OnboardingStories — las 3 etapas de la tab (Conectar → Contexto → Ensayo)
// =============================================================================
// Con el WizardShell embebido (sin tapar el sidebar: de una tab siempre se
// puede salir a otra). El estado vive en app_settings vía
// lib/tab-onboarding-state.ts ('stories').
//
// Acá el orden de la skill se respeta tal cual (nada bloquea de verdad):
//   · Conectar NO bloquea — escribir el guion de un día de stories no necesita
//     la cuenta de Instagram; publicarlo sí, y eso pasa en /instagram. Se
//     muestra el estado vivo con un aviso suave y el link, sin frenar.
//   · Contexto no pide nada nuevo: muestra lo que la app ya sabe del negocio
//     (lo que ya se sabe no se pregunta) y dice qué falta y dónde se completa.
//   · Ensayo = generar la primera secuencia de muestra. El paso lo cierra el
//     server dentro de generarSecuenciaAction (la primera pieza ES el ensayo).

import { useCallback, useState } from 'react';
import { WizardShell } from '../_components/WizardShell';
import { Button, ButtonLink } from '@/app/_ui';
import { Icon } from '../_components/icons';
import { Dropdown } from '../components/Dropdown';
import { StoriesApp } from './StoriesApp';
import { Storyboard } from './Storyboard';
import { OBJETIVOS_STORIES, type ObjetivoStories } from './objetivos';
import { generarSecuenciaAction, marcarContextoStoriesAction } from './actions';
import type { PiezaStory } from '@/lib/ig-writer';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const PASOS = ['conectar', 'contexto', 'ensayo'] as const;
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

export function OnboardingStories({
  igConectada, gruposListos, gruposFaltan,
}: { igConectada: boolean; gruposListos: string[]; gruposFaltan: string[] }) {
  // Estado de CLIENTE y no router.refresh(): refrescar re-corre el guard del
  // server y devuelve el mismo wizard — «Lo configuro después» y la ✕ tienen
  // que llevar a la tab de verdad (mismo porqué que OnboardingInstagram).
  const [salir, setSalir] = useState(false);
  const [paso, setPaso] = useState<Paso>('conectar');
  const [error, setError] = useState<string | null>(null);

  // Busy POR ACCIÓN (regla de la skill: un solo busy compartido pone
  // «Generando…» en el botón equivocado).
  const [busyPaso, setBusyPaso] = useState(false);
  const [busyEnsayo, setBusyEnsayo] = useState(false);

  // ── Ensayo ──
  const [objetivo, setObjetivo] = useState<ObjetivoStories>('conexion');
  const [pedido, setPedido] = useState('Una historia real de esta semana con un cliente: qué pasó y qué aprendí.');
  const [pieza, setPieza] = useState<PiezaStory | null>(null);

  const generarEnsayo = useCallback(async () => {
    setBusyEnsayo(true);
    setError(null);
    const r = await generarSecuenciaAction(objetivo, pedido);
    setBusyEnsayo(false);
    if (!r.ok) { setError(r.error); return; }
    setPieza(r.pieza);
  }, [objetivo, pedido]);

  if (salir) return <StoriesApp igConectada={igConectada} piezaInicial={pieza} />;

  const idx = PASOS.indexOf(paso);
  // Conectar no bloquea (aviso suave) y el contexto tampoco (el brief degrada
  // sin romper): lo único que exige algo es el ensayo — la primera secuencia.
  const puedeAvanzar = paso === 'ensayo' ? Boolean(pieza) : true;

  const avanzar = async () => {
    setError(null);
    if (paso === 'conectar') { setPaso('contexto'); return; }
    if (paso === 'contexto') {
      setBusyPaso(true);
      const r = await marcarContextoStoriesAction();
      setBusyPaso(false);
      if (!r.ok) { setError(r.error); return; }
      setPaso('ensayo');
    }
  };

  // `stories_ensayo` ya lo cerró el server al generar: confirmar solo sale.
  const confirmar = () => { setError(null); setSalir(true); };

  const pregunta = paso === 'conectar'
    ? 'Tu cuenta de Instagram'
    : paso === 'contexto'
      ? 'Contexto del negocio'
      : 'Tu primera secuencia';

  const sub = paso === 'conectar'
    ? 'Las secuencias se escriben sin la cuenta; se necesita solo para publicarlas.'
    : paso === 'contexto'
      ? undefined
      : 'Elige el objetivo del día, cuenta la idea y mira la secuencia que MaKo arma.';

  return (
    <WizardShell
      titulo="Stories · Configuración"
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
      onConfirmar={confirmar}
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
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>Los borradores que envíes a publicación ya tienen dónde salir.</div>
              </div>
            </div>
          ) : (
            <div style={{ alignSelf: 'center' }}>
              <ButtonLink href="/instagram" variant="secondary">
                Conectar en la tab Instagram
              </ButtonLink>
            </div>
          )}
          <Contexto eyebrow="Por qué este paso no bloquea">
            Esta tab escribe el guion del día: qué mostrar en cada frame, el texto en
            pantalla y la indicación de producción. Para eso no hace falta ninguna
            conexión. La cuenta de Instagram entra en juego recién al publicar los
            borradores, y eso se hace desde la tab Instagram — puedes conectarla ahora o
            cuando tengas la primera secuencia lista.
          </Contexto>
        </>
      )}

      {paso === 'contexto' && (
        <>
          {gruposListos.length > 0 ? (
            <Contexto eyebrow="Esto ya lo tengo de ti">
              Para aterrizar cada secuencia en tu negocio, MaKo usa lo que ya cargaste:
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {gruposListos.map((g) => <li key={g}>{g}</li>)}
              </ul>
              {gruposFaltan.length > 0 && (
                <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--border)' }}>
                  Falta: {gruposFaltan.join(', ')}. Se completa en el{' '}
                  <Link href="/onboarding" style={{ color: 'var(--primary-strong)', fontWeight: 600, textDecoration: 'none' }}>onboarding del negocio</Link>
                  {' '}— con esos huecos, las secuencias salen más genéricas.
                </div>
              )}
            </Contexto>
          ) : (
            <Contexto eyebrow="Todavía no sé nada de tu negocio">
              El perfil del negocio está vacío, así que las secuencias saldrían genéricas.
              Complétalo en el{' '}
              <Link href="/onboarding" style={{ color: 'var(--primary-strong)', fontWeight: 600, textDecoration: 'none' }}>onboarding del negocio</Link>
              {' '}(marca, oferta, cliente ideal) y esta tab lo toma sola. No hay nada
              nuevo que pedir aquí: lo que ya se sabe no se pregunta.
            </Contexto>
          )}
        </>
      )}

      {paso === 'ensayo' && (
        <>
          <Dropdown
            value={objetivo}
            onChange={(v) => setObjetivo(v as ObjetivoStories)}
            options={OBJETIVOS_STORIES.map((o) => ({ value: o.value, label: o.label, sub: o.hint }))}
            width="100%"
            ariaLabel="Objetivo del día de stories"
            disabled={busyEnsayo}
          />
          <textarea
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            rows={3}
            disabled={busyEnsayo}
            style={{ width: '100%', padding: '12px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none', resize: 'vertical' }}
            aria-label="La idea del día"
          />
          <Button
            variant="secondary"
            onClick={() => void generarEnsayo()}
            loading={busyEnsayo}
            disabled={!pedido.trim()}
            style={{ alignSelf: 'center' }}
          >
            {busyEnsayo ? 'MaKo está escribiendo…' : 'Generar secuencia de muestra'}
          </Button>
          {pieza && (
            <div style={{ textAlign: 'left', maxHeight: 340, overflowY: 'auto' }}>
              <Storyboard pieza={pieza} />
            </div>
          )}
          <Contexto eyebrow="Qué acabas de armar">
            Cada secuencia es un día completo de stories: una sola idea, el bloque se sube
            junto y cada frame cambia de formato. Desde la tab puedes mandarla a
            publicación: se crea un borrador por frame en la tab Instagram, donde subes la
            media y programas. Lo interactivo (encuestas, preguntas, sliders) se agrega a
            mano en la app de Instagram — la API no lo publica.
          </Contexto>
        </>
      )}
    </WizardShell>
  );
}
