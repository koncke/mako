'use client';

// =============================================================================
// TutorialAgente — los cuatro pasos para conectar Claude Code con MaKo
// =============================================================================
// Vivía adentro de app/integraciones/IntegracionesBoard.tsx y se mudó acá porque ahora
// lo usan DOS pantallas: /integraciones y el botón «Conectar a Claude» de
// /second-brain. Se EXTRAJO, no se copió: el tutorial son cuatro pasos encadenados
// —acuñar el token, instalar la skill, activar el hook, pedírselo al agente— y una
// segunda copia se queda vieja el día que uno de los cuatro cambie. Es literalmente el
// caso que AGENTS.md documenta con el contrato del `detalle`.
//
// Y hay una razón más fuerte todavía para no copiarlo: el paso 1 tiene la pantalla del
// CONSENTIMIENTO. Duplicarla es duplicar un texto legal versionado.
// =============================================================================

import { useState, useMemo, type CSSProperties, type ReactNode } from 'react';
import { agenteSkillMarkdown, AGENTE_SKILL_PATH } from '@/lib/agente-skill';
import { AGENTE_HOOK_PATH, AGENTE_HOOK_SETTINGS } from '@/lib/agente-plugin';
import { TEXTO_CONSENTIMIENTO } from '@/lib/agente-consentimiento-texto';

const MONO = "'Geist Mono', monospace";
const codeInline: CSSProperties = { fontFamily: MONO, fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', color: 'var(--dim)' };

export const CODE = {
  bg: 'var(--sidebar)',
  bd: 'var(--sidebar-2)',
  base: 'var(--on-sidebar)',
  com: 'var(--sidebar-text)',
  num: 'var(--accent-soft)',
  tag: '#7EE787',
  attr: '#9DBBF5',
  str: '#A5D6FF',
  kw: '#FF9492',
};

/** Cada cosa que el tutorial deja copiar. Está tipado a propósito: el botón dice
 *  «¡Copiado!» comparando contra este valor, así que un typo en la clave deja un botón
 *  que copia bien y nunca confirma — y eso se lee como que no funcionó. */
type Copiable = 'skill' | 'token' | 'ruta' | 'hookruta' | 'settings' | 'probar';

export function TutorialAgente({ tokenInicial, appUrl }: { tokenInicial: string | null; appUrl: string }) {
  const [token, setToken] = useState<string | null>(tokenInicial);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<Copiable | null>(null);
  const [verTrato, setVerTrato] = useState(false);
  const [verSkill, setVerSkill] = useState(false);

  const skill = useMemo(() => agenteSkillMarkdown(appUrl, token ?? ''), [appUrl, token]);
  const listo = !!token;

  // ⚠️ EL 409 NO ES UN ERROR: ES LA PUERTA. `/api/agente/token` responde
  // `necesitaConsentimiento` cuando el workspace todavía no aceptó el trato, y la única
  // forma de pasar es volver a postear con `acepto: true`. Antes esto caía al `setError`
  // y pintaba el texto crudo del 409 sin ninguna vía para aceptar, así que el botón
  // estaba roto para TODO workspace que no hubiera aceptado — o sea, todos. El endpoint
  // estaba bien; lo que faltaba era esta pantalla.
  const generar = async (acepto = false) => {
    setGenerando(true); setError(null);
    try {
      const r = await fetch('/api/agente/token', {
        method: 'POST',
        headers: acepto ? { 'content-type': 'application/json' } : undefined,
        body: acepto ? JSON.stringify({ acepto: true }) : undefined,
      });
      const j = await r.json();
      if (j?.ok) { setToken(j.token as string); setVerTrato(false); setVerSkill(true); return; }
      if (j?.necesitaConsentimiento) { setVerTrato(true); return; }
      setError(j?.error === 'sin workspace (entrá como un cliente)' ? 'Entra a un cliente para generar su token.' : (j?.error ?? 'No se pudo generar.'));
    } catch { setError('No se pudo generar. Revisa tu conexión.'); }
    finally { setGenerando(false); }
  };

  const copiar = async (que: Copiable, texto: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(que); setTimeout(() => setCopiado(null), 1800); }
    catch { setError('No pudimos copiarlo solos — seleccionalo y copialo a mano.'); }
  };

  const btnPrimario: CSSProperties = { padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' };
  const btnSecundario: CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' };

  const trato = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '15px 17px' }}>
      <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}>{TEXTO_CONSENTIMIENTO.titulo}</div>
      {TEXTO_CONSENTIMIENTO.que.map((t) => (
        <p key={t} style={{ margin: 0, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>{t}</p>
      ))}
      {/* Lo que NO se manda va aparte y con su marca: en un trato de datos, el límite es
          tan importante como el alcance, y enterrarlo en el mismo párrafo lo esconde. */}
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {TEXTO_CONSENTIMIENTO.no.map((t) => (
          <li key={t} style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>{t}</li>
        ))}
      </ul>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>{TEXTO_CONSENTIMIENTO.paraQue}</p>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.55 }}>{TEXTO_CONSENTIMIENTO.tuParte}</p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--faint)', lineHeight: 1.55 }}>
        {TEXTO_CONSENTIMIENTO.verlo} {TEXTO_CONSENTIMIENTO.trato}
      </p>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 2 }}>
        <button type="button" style={btnPrimario} onClick={() => void generar(true)} disabled={generando}>
          {generando ? 'Generando…' : 'Acepto y genero el token'}
        </button>
        <button type="button" style={btnSecundario} onClick={() => setVerTrato(false)} disabled={generando}>Ahora no</button>
      </div>
    </div>
  );

  const codeInline: CSSProperties = { fontFamily: MONO, fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px', color: 'var(--ink)' };

  const paso = (n: number, titulo: ReactNode, cuerpo: ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'start' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 999, background: 'var(--ink)', color: 'var(--surface)', fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>{n}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 7, lineHeight: 1.35 }}>{titulo}</div>
        {cuerpo}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55 }}>
        ¿Programás con <strong style={{ color: 'var(--ink)' }}>Claude Code</strong>? Instalá esta skill (4 pasos, sin API key) y tu agente
        va a <strong style={{ color: 'var(--ink)' }}>mirar tu plan</strong> antes de arrancar y a <strong style={{ color: 'var(--ink)' }}>proponerte tareas</strong>.
        Nunca las crea solo: deja un borrador que revisás vos y que prioriza el Perro Guardián.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
        {/* PASO 1 — token */}
        {paso(1, 'Generá tu token de conexión', listo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <code style={{ fontFamily: MONO, fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--dim)', userSelect: 'all', wordBreak: 'break-all', flex: '1 1 200px', minWidth: 0 }}>{token}</code>
              <button type="button" style={btnSecundario} onClick={() => copiar('token', token!)}>{copiado === 'token' ? '¡Copiado!' : 'Copiar'}</button>
              <button type="button" style={{ ...btnSecundario, color: 'var(--faint)' }} onClick={() => void generar(true)} disabled={generando} title="Genera uno nuevo e invalida el anterior">{generando ? 'Rotando…' : 'Rotar'}</button>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>Es una credencial: identifica tu espacio. No la subas a un repo público. Si la rotás, la anterior deja de funcionar.</span>
          </div>
        ) : (
          verTrato ? trato : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" style={btnPrimario} onClick={() => void generar()} disabled={generando}>{generando ? 'Generando…' : 'Generar token'}</button>
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>Un click. Queda guardado y se embebe en la skill del paso 2.</span>
          </div>)
        ))}

        {/* PASO 2 — instalar la skill */}
        {paso(2, 'Instalá la skill en tu proyecto', (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
              Creá el archivo <button type="button" onClick={() => copiar('ruta', AGENTE_SKILL_PATH)} style={{ ...codeInline, cursor: 'pointer' }} title="Copiar ruta">{copiado === 'ruta' ? '¡copiada!' : AGENTE_SKILL_PATH}</button> en tu proyecto y pegá la skill adentro.
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <button type="button" style={listo ? btnPrimario : { ...btnPrimario, opacity: 0.45, cursor: 'not-allowed' }} disabled={!listo} onClick={() => copiar('skill', skill)}>
                {copiado === 'skill' ? '¡Skill copiada!' : 'Copiar skill'}
              </button>
              <button type="button" style={btnSecundario} onClick={() => setVerSkill((v) => !v)}>{verSkill ? 'Ocultar' : 'Ver la skill'}</button>
            </div>
            {!listo && <span style={{ fontSize: 12, color: 'var(--faint)' }}>Generá el token primero: viene embebido en el archivo.</span>}
            {verSkill && (
              <pre style={{ margin: 0, minWidth: 0, background: CODE.bg, border: `1px solid ${CODE.bd}`, borderRadius: 12, padding: '12px 14px', maxHeight: 220, overflow: 'auto', fontFamily: MONO, fontSize: 10.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--dim)', userSelect: 'all' }}>{skill}</pre>
            )}
          </div>
        ))}

        {/* PASO 3 — el hook. Es un paso aparte del 2 a propósito: la skill la lee el
            modelo y el hook lo corre el runtime, y si se presentan como una sola cosa
            el usuario asume que instalando la skill ya reporta. No reporta. */}
        {paso(3, 'Activá el reporte de sesiones', (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
              Bajá el archivo y guardalo en <button type="button" onClick={() => copiar('hookruta', AGENTE_HOOK_PATH)} style={{ ...codeInline, cursor: 'pointer' }} title="Copiar ruta">{copiado === 'hookruta' ? '¡copiada!' : AGENTE_HOOK_PATH}</button>. Después sumá esto a tu <code style={codeInline}>.claude/settings.json</code>.
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <a href="/api/agente/hook" download style={{ ...btnPrimario, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Bajar el archivo</a>
              <button type="button" style={btnSecundario} onClick={() => copiar('settings', AGENTE_HOOK_SETTINGS)}>{copiado === 'settings' ? '¡Copiado!' : 'Copiar el settings'}</button>
            </div>
            <pre style={{ margin: 0, minWidth: 0, background: CODE.bg, border: `1px solid ${CODE.bd}`, borderRadius: 12, padding: '12px 14px', overflow: 'auto', fontFamily: MONO, fontSize: 10.5, lineHeight: 1.6, color: 'var(--dim)', userSelect: 'all' }}>{AGENTE_HOOK_SETTINGS}</pre>
            <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
              Para comprobar que quedó andando, corré <button type="button" onClick={() => copiar('probar', `node ${AGENTE_HOOK_PATH} probar`)} style={{ ...codeInline, cursor: 'pointer' }} title="Copiar comando">{copiado === 'probar' ? '¡copiado!' : `node ${AGENTE_HOOK_PATH} probar`}</button> en tu proyecto.
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>
              Se manda el resumen de la sesión y lo que escribiste vos —nunca lo que leyeron las herramientas—, y antes de salir se tapan claves, mails y teléfonos. Lo que escribiste se borra a los 90 días.
            </span>
          </div>
        ))}

        {/* PASO 4 — usarlo */}
        {paso(4, 'Pedíselo a tu agente', (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
            <div>Escribile, por ejemplo:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13 }}>“Mirá mi plan antes de arrancar con esto.”</span>
              <span style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13 }}>“Anotá esto en mi plan.”</span>
            </div>
            <div>Te devuelve un <strong style={{ color: 'var(--ink)' }}>link a un borrador</strong>. Lo abrís, respondés las preguntas y el Perro le pone la prioridad. Recién ahí entra al tablero.</div>
          </div>
        ))}
      </div>

      {error && <div style={{ fontSize: 12.5, color: 'var(--warn)', fontWeight: 500 }}>{error}</div>}
    </div>
  );
}
