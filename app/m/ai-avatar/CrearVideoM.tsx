'use client';

// =============================================================================
// CrearVideoM — «Create video» de AI Avatar en el teléfono: avatar → guion → generar → las tomas
// =============================================================================
// Los tres pasos de escritorio (CrearVideo en app/ai-avatar/AiAvatarCliente.tsx), uno por pantalla, como HeyGen en
// el teléfono: la grilla de retratos con «Siguiente» abajo; el guion con el avatar chico arriba, los guiones de
// ejemplo como chips y «Generar video» con su consecuencia; y las tomas, que se van llenando.
// «Editar y exportar» abre el Video Editor con el anuncio adentro (`?desde=anuncio:<id>`, el link de escritorio): en el
// teléfono esa URL es el editor del teléfono (app/m/video-editor/[proyecto]), que lo importa igual.
// ⚠️ Una toma se paga: el lazo (app/ai-avatar/filmar.ts) va en serie, sin reintento, y para en la primera que no
//    sale. «Volver a intentar» lo aprieta la persona.
// =============================================================================

import { useRef, useState } from 'react';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import type { InicioOut } from '@/app/ai-avatar/actions';
import { crearVideoAction } from '@/app/ai-avatar/actions';
import { filmarTomas, type TomaAvatar } from '@/app/ai-avatar/filmar';
import { rutaEditarEnEditor } from '@/app/video-editor/desde/desde';
import { avisarPuente } from '@/app/video-generator/avisar-puente';
import { PLANTILLAS_AVATAR } from '@/lib/ai-avatar/plantillas';
import { ComputadoraM, PieFijoM, SeccionM, VacioM, useConexion } from '@/app/m/_ui';
import { CampoM, ErrorLineaM } from '../_creacion/escritor';
import { ChipM, ChipsM } from './piezas';

type Inicio = Extract<InicioOut, { ok: true }>;

export function CrearVideoM({ inicio, avatarInicial, guionInicial }: { inicio: Inicio; avatarInicial?: string; guionInicial: string }) {
  const { enLinea } = useConexion();
  const inicialValido = !!avatarInicial && inicio.avatares.some((a) => a.id === avatarInicial);
  const [avatarId, setAvatarId] = useState(inicialValido ? avatarInicial! : '');
  const [guion, setGuion] = useState(guionInicial);
  const [paso, setPaso] = useState<'avatar' | 'guion' | 'generando'>(inicialValido ? 'guion' : 'avatar');
  const [planId, setPlanId] = useState('');
  const [tomas, setTomas] = useState<TomaAvatar[]>([]);
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const corriendo = useRef(false);

  const avatar = inicio.avatares.find((a) => a.id === avatarId) ?? null;

  const filmar = async (plan: string, lista: number[]) => {
    if (corriendo.current) return;
    corriendo.current = true;
    try {
      await filmarTomas(plan, lista, (t) => setTomas((xs) => xs.map((x) => (x.n === t.n ? t : x))));
    } finally {
      corriendo.current = false;
    }
  };

  const generar = async () => {
    if (enviando) return;
    setAviso(''); setEnviando(true);
    try {
      const r = await crearVideoAction({ avatarId, guion });
      if (!r.ok) { setAviso(r.error); return; }
      setPlanId(r.planId);
      setTomas(r.tomas.map((n) => ({ n, fase: 'esperando' })));
      setPaso('generando');
      avisarPuente();
      void filmar(r.planId, r.tomas);
    } catch {
      setAviso('No se pudo armar el video. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setEnviando(false);
    }
  };

  // ── Paso 1: el avatar ────────────────────────────────────────────────────
  if (paso === 'avatar') {
    if (inicio.avatares.length === 0) {
      return <VacioM frase="Primero crea tu avatar." accion={{ rotulo: 'Crear un look', href: '/m/ai-avatar/avatares' }} />;
    }
    return (
      <>
        <SeccionM titulo="Elige tu avatar">
          <div className="m-ai-avatar-grilla">
            {inicio.avatares.map((a) => (
              <button key={a.id} type="button" className="m-ai-avatar-retrato" aria-pressed={avatarId === a.id}
                onClick={() => setAvatarId(a.id)} aria-label={a.lugar || 'Avatar'}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" loading="lazy" />
                {avatarId === a.id && <span className="m-ai-avatar-retrato__tilde" aria-hidden><Icon name="check" size={16} /></span>}
                <span className="m-ai-avatar-retrato__pie">{a.lugar || (a.origen === 'anuncio' ? 'De un anuncio' : 'Look')}</span>
              </button>
            ))}
          </div>
        </SeccionM>
        <PieFijoM>
          <Button variant="primary" size="lg" full disabled={!avatar} onClick={() => setPaso('guion')}>Siguiente</Button>
        </PieFijoM>
      </>
    );
  }

  // ── Paso 2: el guion ─────────────────────────────────────────────────────
  if (paso === 'guion') {
    const palabras = guion.trim() ? guion.trim().split(/\s+/).length : 0;
    return (
      <>
        <div className="m-ai-avatar-elegido">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatar && <img src={avatar.url} alt="" />}
          <div>
            <p className="m-ai-avatar-elegido__lugar">{avatar?.lugar || 'Tu avatar'}</p>
            <button type="button" className="m-ai-avatar-link" onClick={() => setPaso('avatar')}>Cambiar avatar</button>
          </div>
        </div>
        <SeccionM titulo="¿Qué va a decir?">
          <CampoM valor={guion} onCambio={setGuion} etiqueta="El guion" placeholder="El guion, tal cual lo dirías" filas={7} deshabilitado={enviando} />
          <ChipsM etiqueta="Guiones de ejemplo">
            {PLANTILLAS_AVATAR.slice(0, 4).map((p) => <ChipM key={p.id} activo={false} onClick={() => setGuion(p.guion)}>{p.nombre}</ChipM>)}
          </ChipsM>
          <p className="m-ai-avatar-nota">{palabras} palabras · Voz de Flow{inicio.acento ? `, acento ${inicio.acento}` : ''}</p>
        </SeccionM>
        {!inicio.puente.puede && <ComputadoraM que={inicio.puente.motivo} />}
        {aviso && <ErrorLineaM>{aviso}</ErrorLineaM>}
        <PieFijoM consecuencia="Cada toma gasta créditos de tu cuenta de Flow.">
          <Button variant="primary" size="lg" full loading={enviando}
            disabled={!guion.trim() || !avatar || !inicio.puente.puede || !enLinea} onClick={() => void generar()}>
            Generar video
          </Button>
        </PieFijoM>
      </>
    );
  }

  // ── Paso 3: las tomas ────────────────────────────────────────────────────
  const listas = tomas.filter((t) => t.fase === 'listo').length;
  const parada = tomas.find((t) => t.fase === 'error');
  const terminado = tomas.length > 0 && listas === tomas.length;
  return (
    <>
      <SeccionM titulo={terminado ? 'Tu video está listo' : `Tomas · ${listas} de ${tomas.length}`}>
        {parada && <ErrorLineaM>{`Toma ${parada.n}: ${parada.detalle ?? 'no salió'}`}</ErrorLineaM>}
        <div className="m-ai-avatar-grilla">
          {tomas.map((t) => (
            <div key={t.n} className="m-ai-avatar-toma">
              {t.fase === 'listo' && t.url
                ? <video src={t.url} controls playsInline preload="metadata" />
                : (
                  <div className="m-ai-avatar-toma__vacia">
                    {t.fase === 'filmando' || t.fase === 'a_ciegas'
                      ? <span className="mk-spin" aria-label="Filmando" />
                      : <span>{t.fase === 'error' ? 'No salió' : 'En espera'}</span>}
                  </div>
                )}
              <span className="m-ai-avatar-toma__n">Toma {t.n}{t.fase === 'a_ciegas' && t.detalle ? ` · ${t.detalle}` : ''}</span>
            </div>
          ))}
        </div>
      </SeccionM>
      <PieFijoM consecuencia={!terminado && !parada ? 'Deja esta pantalla abierta mientras se filma.' : undefined}>
        {terminado && planId && (
          <ButtonLink variant="primary" size="lg" full href={rutaEditarEnEditor(`anuncio:${planId}`)}>
            Editar y exportar
          </ButtonLink>
        )}
        {parada && planId && (
          <Button variant="secondary" size="lg" full disabled={!enLinea} onClick={() => {
            setTomas((xs) => xs.map((x) => (x.fase === 'error' ? { ...x, fase: 'esperando', detalle: undefined } : x)));
            void filmar(planId, tomas.filter((x) => x.fase !== 'listo').map((x) => x.n));
          }}>
            Volver a intentar
          </Button>
        )}
        {(terminado || parada) && (
          <Button variant="tertiary" size="lg" full onClick={() => { setPaso('avatar'); setTomas([]); setPlanId(''); }}>
            Crear otro
          </Button>
        )}
      </PieFijoM>
    </>
  );
}
