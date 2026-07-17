'use client';

// =============================================================================
// OnboardingPM — el arranque de la capa Project Manager
// =============================================================================
// Es OTRO producto que el 'completo', así que es otro flujo — no un caso raro
// del wizard de 4 pasos. Acá no hay nada que conectar ni histórico que extraer:
// son 3 preguntas y adentro. Por eso puede ser lo que el wizard completo NO
// puede: UNA pregunta por pantalla (WizardShell fullscreen), que es el patrón
// del resto de la app (CrearTareaModal, PriorizarWizard, DebateModal…).
//
// Dos pantallas: a la derecha la pregunta; a la izquierda el ESCENARIO — lo que
// MaKo ya sabe del negocio, que se va llenando con cada respuesta. Es a propósito
// que no sea un carrusel de features: mostrarle SUS palabras pesa más que un
// video de marketing, y además le prueba que lo que escribe se usa para algo.
//
// El último paso presenta al Perro Guardián y lo suelta en /plan.

import { useState, type CSSProperties } from 'react';
import { WizardShell, wizardInput } from '../_components/WizardShell';
import { GuardianIcon } from '../plan/board/GuardianIcon';

const MONO = "'Geist Mono', monospace";

export type BriefCampo = { key: string; label: string; type: 'text' | 'number' | 'textarea'; placeholder?: string; grupo: string };

const textareaStyle: CSSProperties = { ...wizardInput, textAlign: 'left', minHeight: 104, resize: 'vertical', lineHeight: 1.55, paddingTop: 12 };

async function post(url: string, body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string }> {
  try {
    return await (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function OnboardingPM({ brief, answersIniciales, nombreUsuario, onSaltear }: {
  brief: BriefCampo[];
  answersIniciales: Record<string, string>;
  nombreUsuario: string;
  onSaltear: () => Promise<void>;
}) {
  // idx recorre: [intro] + una por campo del brief + [cierre del guardián].
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(answersIniciales);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = brief.length + 2;
  const enIntro = idx === 0;
  const enCierre = idx === total - 1;
  const campo = enIntro || enCierre ? null : brief[idx - 1];

  const set = (k: string, v: string) => setAnswers((a) => ({ ...a, [k]: v }));
  const valor = campo ? (answers[campo.key] ?? '') : '';

  // Solo la primera pregunta es obligatoria: si no sabe a qué se dedica, MaKo no
  // tiene con qué priorizar. Las otras dos suman pero no bloquean.
  const puedeAvanzar = enIntro || enCierre || campo?.key !== brief[0]?.key || valor.trim().length > 1;

  // Guarda al avanzar (patrón del OnboardingForm: no perder lo escrito si cierra
  // el navegador). Mergea server-side, así que Atrás no pisa nada.
  const guardarYAvanzar = async () => {
    setError(null);
    if (campo) {
      setPending(true);
      const j = await post('/api/onboarding', { action: 'brief', brief: { [campo.key]: valor } });
      setPending(false);
      if (!j.ok) { setError(j.error ?? 'No se pudo guardar.'); return; }
    }
    setIdx((i) => i + 1);
  };

  const finalizar = async () => {
    setPending(true);
    setError(null);
    // El brief cierra el paso 'negocio'; 'plan' se cierra al entrar al board.
    const a = await post('/api/onboarding', { action: 'paso', step: 'negocio', done: true });
    if (!a.ok) { setPending(false); setError(a.error ?? 'No se pudo guardar.'); return; }
    await post('/api/onboarding', { action: 'paso', step: 'plan', done: true });
    window.location.href = '/plan';
  };

  return (
    <WizardShell
      fullscreen
      bloqueante
      titulo={enCierre ? 'Todo listo' : `Bienvenido${nombreUsuario ? `, ${nombreUsuario.split(' ')[0]}` : ''}`}
      total={total}
      idx={idx}
      pregunta={enIntro ? 'Antes de arrancar, contame de tu negocio'
        : enCierre ? 'Tu plan lo cuida el Perro Guardián'
        : (campo?.label ?? '')}
      sub={enIntro ? 'Son tres preguntas. Con eso MaKo prioriza tu plan con criterio de TU negocio, en vez de darte consejos genéricos.'
        : enCierre ? 'De acá en adelante vos cargás lo que hay para hacer y él decide qué mueve la aguja.'
        : undefined}
      error={error}
      puedeAvanzar={puedeAvanzar}
      enUltimo={enCierre}
      confirmLabel="Crear mi primer proyecto →"
      siguienteLabel={enIntro ? 'Empecemos →' : 'Siguiente →'}
      pending={pending}
      atrasLabel="Atrás"
      hideAtras={enIntro}
      onAtras={() => setIdx((i) => Math.max(0, i - 1))}
      onSiguiente={guardarYAvanzar}
      onConfirmar={finalizar}
      onClose={() => { /* bloqueante: no cierra */ }}
      extraFooter={enIntro ? (
        <button type="button" onClick={onSaltear}
          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--faint)', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>
          Completar después
        </button>
      ) : undefined}
      escenario={<Escenario brief={brief} answers={answers} enCierre={enCierre} />}
    >
      {enIntro && <IntroPM />}
      {enCierre && <CierrePM />}
      {campo && (campo.type === 'textarea'
        ? <textarea style={textareaStyle} value={valor} placeholder={campo.placeholder} autoFocus
            onChange={(e) => set(campo.key, e.target.value)} />
        : <input style={wizardInput} value={valor} placeholder={campo.placeholder} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && puedeAvanzar && !pending) guardarYAvanzar(); }}
            onChange={(e) => set(campo.key, e.target.value)} />)}
    </WizardShell>
  );
}

function IntroPM() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 2px' }}>
      <GuardianIcon size={68} />
    </div>
  );
}

function CierrePM() {
  const puntos: Array<[string, string]> = [
    ['Vos cargás, él prioriza', 'No elegís la prioridad a mano: compara cada tarea contra todo el resto y le pone un puntaje con su razón.'],
    ['Un solo objetivo a la vez', 'El proyecto más importante manda. Las tareas de los demás no se cuelan en Alta, salvo una emergencia de verdad.'],
    ['Te lo discute', 'Si creés que se equivocó, se lo debatís. Te va a pedir argumentos — y tiene la última palabra.'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11, textAlign: 'left' }}>
      {puntos.map(([t, d]) => (
        <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--good)', fontSize: 15, lineHeight: 1.4, flex: 'none' }}>✓</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{t}</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 2, lineHeight: 1.5 }}>{d}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// El panel izquierdo: lo que MaKo ya sabe. Arranca vacío y se llena con cada
// respuesta — la prueba visible de que lo que escribe no cae en un pozo.
function Escenario({ brief, answers, enCierre }: { brief: BriefCampo[]; answers: Record<string, string>; enCierre: boolean }) {
  const contestadas = brief.filter((c) => (answers[c.key] ?? '').trim());
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 22, minHeight: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <GuardianIcon size={20} />
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          {contestadas.length === 0 ? 'Todavía no sé nada de tu negocio' : 'Lo que ya sé de tu negocio'}
        </span>
      </div>

      {contestadas.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, margin: '10px 0 0' }}>
          Cuanto más concreto seas, mejor voy a priorizar. Un &ldquo;quiero crecer&rdquo; me sirve poco;
          un &ldquo;cerrar 10 clientes sin sumar gente&rdquo; me deja decidir qué tarea mueve la aguja
          y cuál es ruido.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
          {contestadas.map((c) => (
            <div key={c.key}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{answers[c.key]}</div>
            </div>
          ))}
        </div>
      )}

      {enCierre && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--primary)', lineHeight: 1.5 }}>
          Con esto ya puedo priorizar. Creá tu primer proyecto y lo ordenamos juntos.
        </div>
      )}
    </div>
  );
}
