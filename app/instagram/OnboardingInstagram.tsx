'use client';

// =============================================================================
// OnboardingInstagram — las etapas de la tab (Zernio → Conectar → Contexto → Ensayo)
// =============================================================================
// Con el WizardShell embebido (misma pieza que el onboarding global, pero SIN
// tapar el sidebar: de una tab siempre se puede salir a otra). El estado vive en
// app_settings vía lib/tab-onboarding-state.ts ('instagram').
//
// El orden Conectar-primero es la excepción prevista de la skill tab-onboarding:
// lo de acá BLOQUEA de verdad — sin la decisión de Zernio tomada no hay API con
// la que hablar, y sin cuenta conectada el inbox y el compositor no tienen nada
// que mostrar. Los dos primeros pasos se derivan de señales REALES (estado vivo,
// no recordado): `zernio` de la key BYOK o de la fila en zernio_workspace,
// `conectar` de los facts de la cuenta (el username que devuelve Zernio), nunca
// de una credencial guardada ni de un flag.

import { useCallback, useEffect, useState } from 'react';
import { WizardShell } from '../_components/WizardShell';
import { Button, Spinner } from '@/app/_ui';
import { Icon } from '../_components/icons';
import { servicioMetodo } from '@/lib/metodo-catalogo';
import { InstagramApp } from './InstagramApp';
import type { EstadoConexionIg } from './ig-datos';
import {
  conectarInstagramAction, ensayoDmAction, estadoConexionAction, guardarZernioKeyAction,
  marcarPasoIgAction, usarCuentaPlataformaAction,
} from './actions';

const MONO = "'Geist Mono', monospace";

const PASOS = ['zernio', 'conectar', 'contexto', 'ensayo'] as const;
type Paso = (typeof PASOS)[number];

// El tutorial de «cómo consigo mi API key» sale del catálogo (una cosa, un
// lugar): el mismo que muestra la card de Zernio en /integraciones.
const TUTORIAL_ZERNIO = servicioMetodo('zernio')?.tutorial ?? null;

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

export function OnboardingInstagram({ conexionInicial }: { conexionInicial: EstadoConexionIg }) {
  // Estado de CLIENTE y no router.refresh(): refrescar re-corre el guard del
  // server y devuelve el mismo wizard — «Lo configuro después» y la ✕ tienen
  // que llevar a la tab de verdad (mismo porqué que OnboardingCanalWhatsApp).
  const [salir, setSalir] = useState(false);

  // Retomar donde quedó: con la decisión de Zernio ya tomada se arranca en
  // Conectar; sin ella, el primer paso es elegir la cuenta de Zernio.
  const [paso, setPaso] = useState<Paso>(conexionInicial.zernio?.resuelto ? 'conectar' : 'zernio');
  const [error, setError] = useState<string | null>(null);

  // ── Zernio ──
  const [conexion, setConexion] = useState<EstadoConexionIg>(conexionInicial);
  const [busyPlataforma, setBusyPlataforma] = useState(false);
  const [busyKey, setBusyKey] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const elegirPlataforma = useCallback(async () => {
    setBusyPlataforma(true);
    setError(null);
    const r = await usarCuentaPlataformaAction();
    setBusyPlataforma(false);
    if (!r.ok) { setError(r.error); return; }
    setConexion(r.estado);
    setPaso('conectar');
  }, []);

  const guardarKey = useCallback(async () => {
    setBusyKey(true);
    setError(null);
    const r = await guardarZernioKeyAction(apiKey);
    setBusyKey(false);
    if (!r.ok) { setError(r.error); return; }
    setApiKey('');
    setConexion(r.estado);
    setPaso('conectar');
  }, [apiKey]);

  // ── Conectar ──
  const [busyConectar, setBusyConectar] = useState(false);
  const [busyVerificar, setBusyVerificar] = useState(false);

  const verificar = useCallback(async () => {
    setBusyVerificar(true);
    setError(null);
    const r = await estadoConexionAction();
    setBusyVerificar(false);
    if (!r.ok) { setError(r.error); return; }
    setConexion(r.estado);
    if (r.estado.error) setError(r.estado.error);
  }, []);

  // Se verifica SIEMPRE al montar (no solo al volver del OAuth con ?conectado=1):
  // es la llamada que además cierra el paso `conectar` en el server cuando la
  // cuenta ya existe — sin esto, una cuenta conectada de antes dejaba el paso
  // sin marcar y «Contexto» rebotaba con «falta completar Tu cuenta…».
  useEffect(() => { void verificar(); }, [verificar]);

  const conectar = useCallback(async () => {
    setBusyConectar(true);
    setError(null);
    const r = await conectarInstagramAction();
    if (!r.ok) { setBusyConectar(false); setError(r.error); return; }
    // Redirección al OAuth de Zernio/Meta; al volver, ?conectado=1 dispara verificar().
    window.location.href = r.authUrl;
  }, []);

  // ── Contexto ──
  const [busyPaso, setBusyPaso] = useState(false);

  // ── Ensayo ──
  const [dmPrueba, setDmPrueba] = useState('Hola, vi tu contenido. ¿Cómo funciona lo que ofreces?');
  const [borrador, setBorrador] = useState<string | null>(null);
  const [busyEnsayo, setBusyEnsayo] = useState(false);

  const generarEnsayo = useCallback(async () => {
    setBusyEnsayo(true);
    setError(null);
    const r = await ensayoDmAction(dmPrueba);
    setBusyEnsayo(false);
    if (!r.ok) { setError(r.error); return; }
    setBorrador(r.respuesta);
  }, [dmPrueba]);

  if (salir) return <InstagramApp conexionInicial={conexion} />;

  const idx = PASOS.indexOf(paso);
  const zernioResuelto = Boolean(conexion.zernio?.resuelto);
  const puedeAvanzar =
    paso === 'zernio' ? zernioResuelto
    : paso === 'conectar' ? Boolean(conexion.cuenta)
    : paso === 'ensayo' ? Boolean(borrador)
    : true;

  const avanzar = async () => {
    setError(null);
    if (paso === 'zernio') { setPaso('conectar'); return; }
    if (paso === 'conectar') { setPaso('contexto'); return; }
    if (paso === 'contexto') {
      setBusyPaso(true);
      const r = await marcarPasoIgAction('contexto');
      setBusyPaso(false);
      if (!r.ok) { setError(r.error ?? 'No se pudo guardar el paso.'); return; }
      setPaso('ensayo');
    }
  };

  const confirmar = async () => {
    setError(null);
    setBusyPaso(true);
    const r = await marcarPasoIgAction('ensayo');
    setBusyPaso(false);
    if (!r.ok) { setError(r.error ?? 'No se pudo guardar el paso.'); return; }
    setSalir(true);
  };

  const pregunta = paso === 'zernio'
    ? 'Conexión con Zernio'
    : paso === 'conectar'
      ? 'Tu cuenta de Instagram'
      : paso === 'contexto'
        ? 'Contexto del negocio'
        : 'Ensayo de respuesta';

  const sub = paso === 'zernio'
    ? 'Elige la cuenta de Zernio con la que MaKo publica y responde en Instagram.'
    : paso === 'conectar'
      ? 'Conecta la cuenta desde la que publicas y respondes mensajes.'
      : paso === 'contexto'
        ? undefined
        : 'Escribe un mensaje como si fueras un cliente y mira el borrador que MaKo redactaría.';

  return (
    <WizardShell
      titulo="Instagram · Configuración"
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
      {paso === 'zernio' && (
        <>
          {zernioResuelto ? (
            // La recompensa es el estado real, no un tilde suelto.
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
              <Icon name="check" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14.5 }}>
                  {conexion.zernio?.resuelto === 'propia' ? 'Tu cuenta de Zernio' : 'Cuenta de Zernio de la plataforma'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>Conexión resuelta — continúa con tu cuenta de Instagram.</div>
              </div>
            </div>
          ) : (
            <>
              {/* Camino 1: la cuenta de la plataforma. El botón solo se habilita si
                  la plataforma TIENE la key (señal viva del server) — deshabilitado
                  con el estado honesto, nunca un botón que explota al clic. El que
                  decide es el server (la action re-chequea igual). */}
              <Button
                variant="primary"
                onClick={() => void elegirPlataforma()}
                loading={busyPlataforma}
                disabled={!conexion.zernio?.plataformaDisponible}
                style={{ alignSelf: 'center' }}
              >
                Usar la cuenta de la plataforma
              </Button>
              {!conexion.zernio?.plataformaDisponible && (
                <div style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center' }}>
                  La plataforma no tiene cuenta de Zernio configurada — conecta tu propia cuenta aquí abajo.
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--faint)', fontSize: 12 }}>
                <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                o conecta tu propia cuenta
                <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {/* Camino 2: BYOK. Se guarda por el sistema de credenciales (misma
                  fila que la card de Zernio en /integraciones). El guard contra la
                  key de plataforma vive en el server (guardarZernioKeyAction). */}
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && apiKey.trim() && !busyKey) void guardarKey(); }}
                placeholder="API key de tu cuenta de Zernio"
                autoComplete="off"
                spellCheck={false}
                aria-label="API key de tu cuenta de Zernio"
                style={{ width: '100%', padding: '12px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 14, outline: 'none' }}
              />
              <Button
                variant="secondary"
                onClick={() => void guardarKey()}
                loading={busyKey}
                disabled={!apiKey.trim()}
                style={{ alignSelf: 'center' }}
              >
                Guardar API key de Zernio
              </Button>
            </>
          )}
          <Contexto eyebrow="Por qué este paso">
            Zernio es la plataforma con la que MaKo publica en Instagram y lee tus mensajes.
            Puedes usar la cuenta que ya tiene la plataforma (un clic, sin costo extra para
            ti) o conectar tu propia cuenta de Zernio pegando su API key — con key propia,
            el consumo corre por tu cuenta. Sin este paso resuelto, el siguiente («Tu
            cuenta de Instagram») queda bloqueado: no hay API con la que conectarla.
            {!zernioResuelto && TUTORIAL_ZERNIO && (
              <>
                <ol style={{ margin: '9px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {TUTORIAL_ZERNIO.pasos.map((p, i) => <li key={i}>{p}</li>)}
                </ol>
                {TUTORIAL_ZERNIO.url && (
                  <a
                    href={TUTORIAL_ZERNIO.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-block', marginTop: 8, fontWeight: 600, color: 'var(--primary-strong)', textDecoration: 'none' }}
                  >
                    Abrir {TUTORIAL_ZERNIO.urlLabel ?? 'Zernio'} ↗
                  </a>
                )}
              </>
            )}
          </Contexto>
        </>
      )}

      {paso === 'conectar' && (
        <>
          {conexion.cuenta ? (
            // La recompensa es el dato real de la cuenta, no un tilde.
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
              <Icon name="check" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14.5 }}>@{conexion.cuenta.username}</div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                  {conexion.cuenta.displayName ? `${conexion.cuenta.displayName} · ` : ''}Cuenta conectada
                </div>
              </div>
            </div>
          ) : !zernioResuelto ? (
            // Bloqueado con la razón VISIBLE: sin la decisión de Zernio tomada no
            // hay API con la que conectar (el server lo rechaza igual — esto solo
            // evita ofrecer un botón que explota al clic).
            <div style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55 }}>
              Este paso está bloqueado: primero completa <b style={{ color: 'var(--ink)' }}>Conexión con Zernio</b> (el paso anterior).
            </div>
          ) : (
            <>
              <Button
                variant="primary"
                onClick={() => void conectar()}
                loading={busyConectar}
                style={{ alignSelf: 'center' }}
                icon={<Icon name="instagram" />}
              >
                Conectar cuenta de Instagram
              </Button>
              <Button variant="tertiary" onClick={() => void verificar()} loading={busyVerificar} style={{ alignSelf: 'center' }}>
                Verificar conexión
              </Button>
              {busyVerificar && <Spinner />}
            </>
          )}
          <Contexto eyebrow="Qué pasa al conectar">
            Se abre la autorización de Instagram (vía Zernio, la plataforma que usamos para
            publicar y leer mensajes). Autorizas la cuenta y vuelves aquí solo. El paso se
            cierra cuando la cuenta responde con sus datos reales — no alcanza con guardar
            una credencial.
            {!conexion.configurado && zernioResuelto && (
              <>
                {' '}Si el botón devuelve un error de configuración, la cuenta de Zernio
                del paso anterior dejó de estar disponible: vuelve atrás y resuélvelo.
              </>
            )}
          </Contexto>
        </>
      )}

      {paso === 'contexto' && (
        <Contexto eyebrow="Esto ya lo tengo de ti">
          Para responder DMs y proponer publicaciones, MaKo usa el contexto que ya cargaste
          en la app: el perfil del negocio, tu oferta, tu cliente ideal y tu forma de
          escribir. No hay nada nuevo que pedir en este canal — si ese contexto cambia, se
          actualiza en el onboarding del negocio y esta tab lo toma solo.
        </Contexto>
      )}

      {paso === 'ensayo' && (
        <>
          <textarea
            value={dmPrueba}
            onChange={(e) => setDmPrueba(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '12px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 14, outline: 'none', resize: 'vertical' }}
            aria-label="Mensaje de prueba del cliente"
          />
          <Button variant="secondary" onClick={() => void generarEnsayo()} loading={busyEnsayo} style={{ alignSelf: 'center' }}>
            Generar borrador de MaKo
          </Button>
          {borrador && (
            <div style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 15px', background: 'var(--surface)' }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 7 }}>
                Borrador de respuesta
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{borrador}</div>
            </div>
          )}
          <Contexto eyebrow="Cómo funciona en producción">
            Cuando llega un DM real, MaKo redacta un borrador como este y lo deja esperando
            en el inbox: una persona lo revisa, lo edita si hace falta y lo envía con un
            clic. La respuesta automática (enviar sin revisión) está apagada por defecto y
            se activa en la configuración de la tab.
          </Contexto>
        </>
      )}
    </WizardShell>
  );
}
