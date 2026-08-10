'use client';

// =============================================================================
// TutorialAgente — los cuatro pasos para conectar Claude Code con MaKo
// =============================================================================
// Vivía adentro de app/integraciones/IntegracionesBoard.tsx y se mudó acá porque ahora
// lo usan DOS pantallas: /integraciones y el botón «Conectar a Claude» de
// /second-brain. Se EXTRAJO, no se copió: el tutorial son tres pasos encadenados
// —acuñar el token, instalar la skill, pedírselo al agente— y una segunda copia se
// queda vieja el día que uno de los tres cambie. Es literalmente el caso que AGENTS.md
// documenta con el contrato del `detalle`.
//
// ERAN CUATRO. El de «activá el reporte de sesiones» pedía bajar un archivo, ponerlo
// en su carpeta, fusionar un JSON en settings.json y correr un comando de prueba —
// cuatro gestos manuales para algo que la skill puede hacer sola, porque corre EN el
// proyecto del usuario. El pedido del dueño fue textual: «¿no puede estar directamente
// dentro de la skill? en lugar de que los usuarios tengan que hacer todo eso». Ahora
// vive en el §0.a de la skill y se instala en la primera corrida.
//
// Y la skill NO se muestra acá. Se copia y se pega: mostrar 11.000 caracteres de
// markdown en un <pre> dentro del tutorial no ayuda a nadie a instalarla.
//
// Y hay una razón más fuerte todavía para no copiarlo: el paso 1 tiene la pantalla del
// CONSENTIMIENTO. Duplicarla es duplicar un texto legal versionado.
// =============================================================================

import { useState, useMemo, type CSSProperties, type ReactNode } from 'react';
import { AGENTE_SKILL_PATH } from '@/lib/agente-skill';
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
type Copiable = 'token' | 'instruccion';

export function TutorialAgente({ tokenInicial, appUrl }: { tokenInicial: string | null; appUrl: string }) {
  /**
   * LA URL QUE VA ADENTRO DE LA SKILL, con red propia.
   *
   * `appUrl` viene del servidor y ya se entregó vacía una vez —una env var con un
   * nombre inventado—, y el costo lo pagó el cliente: instalaba la skill y lo primero
   * que le pedía Claude era la URL de la API. Este componente corre en el NAVEGADOR,
   * así que tiene a mano el dato incontestable: el origen desde el que se está mirando
   * la app. Si el servidor no mandó nada, se usa ése.
   *
   * ⚠️ Y EN LOCALHOST GANA EL ORIGEN, aunque el servidor haya mandado algo. `APP_BASE_URL`
   * cae al dominio de producción cuando no hay env (que es el caso en `.env.local`), así
   * que probando en local la skill salía apuntando a producción mientras el hook
   * —que sí lee el origin del request— apuntaba a localhost. El par quedaba hablándole a
   * dos servidores distintos, que es la clase de incoherencia que se descubre debuggeando
   * otra cosa. En cualquier otro host manda `appUrl`: desde un preview de Vercel la skill
   * tiene que apuntar a producción, que es donde viven los datos del cliente.
   */
  const origen = typeof window !== 'undefined' ? window.location.origin : '';
  const enLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$)/.test(origen);
  const base = ((enLocal ? origen : appUrl) || origen).replace(/\/+$/, '');
  const [token, setToken] = useState<string | null>(tokenInicial);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<Copiable | null>(null);
  const [verTrato, setVerTrato] = useState(false);

  /** La instrucción que el usuario le pega a Claude. Es TODO lo que hace falta: la URL
   *  de donde bajarla, cómo autenticarse y dónde va. Tres líneas en vez de once mil
   *  caracteres. */
  const instruccion = useMemo(() => [
    'Instalá la skill de MaKo:',
    `curl -H "Authorization: Bearer ${token ?? ''}" ${base}/api/agente/skill -o SKILL.md`,
    `Guardá ese archivo en ${AGENTE_SKILL_PATH} (creá la carpeta si no existe) y confirmame cuando esté.`,
  ].join(String.fromCharCode(10)), [base, token]);

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
      if (j?.ok) { setToken(j.token as string); setVerTrato(false); return; }
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
        Instalá esta skill (3 pasos, sin API key) y <strong style={{ color: 'var(--ink)' }}>Claude arranca sabiendo de tu
        negocio</strong>: tu oferta, tu cliente ideal, tus razones de compra y cómo suena tu marca. No se lo
        tenés que volver a contar en cada chat. Además <strong style={{ color: 'var(--ink)' }}>mira tu plan</strong> antes de
        proponerte nada, y cuando encuentra algo para anotar <strong style={{ color: 'var(--ink)' }}>te deja un borrador</strong> —
        nunca crea una tarea solo: la revisás vos y la prioriza el Perro Guardián.
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
        {paso(2, 'Pegale esta instrucción a Claude', (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* ⚠️ ASÍ SE INSTALA UNA SKILL: se le dice a Claude DÓNDE ESTÁ y la baja él.
                Este paso pasó por tres versiones peores, y las tres compartían la misma
                causa — que no existía una URL de donde bajarla, así que la app la
                entregaba por el único canal que le quedaba, el portapapeles:
                  1. «Creá el archivo y pegá la skill adentro» (11.000 caracteres a mano).
                  2. Lo mismo, con dos ubicaciones posibles detrás de un desplegable.
                  3. Un botón que bajaba el .md y el usuario tenía que ubicarlo.
                Ninguna otra skill se instala así. Con `/api/agente/skill` sirviendo el
                archivo, el paso vuelve a ser lo normal: una instrucción y listo.

                La instrucción incluye el token porque es lo que autentica la descarga —
                y va en un header, no en la URL: una credencial en la query queda en los
                logs, en el historial y en el Referer. */}
            <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
              Copiá esto y pegáselo a Claude. Baja la skill solo y queda instalada.
            </div>

            <pre style={{
              margin: 0, padding: '11px 13px', borderRadius: 10, overflowX: 'auto',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              fontFamily: MONO, fontSize: 11.5, lineHeight: 1.6, color: 'var(--ink)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>{listo ? instruccion : 'Generá el token primero: viene adentro de la instrucción.'}</pre>

            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={listo ? btnPrimario : { ...btnPrimario, opacity: 0.45, cursor: 'not-allowed' }}
                disabled={!listo}
                onClick={() => copiar('instruccion', instruccion)}
              >
                {copiado === 'instruccion' ? '¡Copiada!' : 'Copiar la instrucción'}
              </button>
            </div>
          </div>
        ))}

        {/* PASO 3 — el hook. Es un paso aparte del 2 a propósito: la skill la lee el
            modelo y el hook lo corre el runtime, y si se presentan como una sola cosa
            el usuario asume que instalando la skill ya reporta. No reporta. */}
        {/* El reporte de sesiones YA NO es un paso. Eran cuatro gestos —bajar un
            archivo, ponerlo en su carpeta, fusionar un JSON en settings.json y correr
            un comando de prueba— y el pedido del dueño fue directo: «¿no puede estar
            directamente dentro de la skill? en lugar de que los usuarios tengan que
            hacer todo eso». Puede: la skill corre EN el proyecto del usuario y tiene
            acceso a los archivos, así que se instala el hook sola la primera vez
            (§0.a). Un agente que sabe escribir código sabe crear dos archivos. */}

        {/* PASO 3 — usarlo */}
        {paso(3, 'Pedíselo a Claude', (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>
            <div>Escribile, por ejemplo:</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Los ejemplos son de NEGOCIO, no de código. Los de antes («mirá mi plan
                  antes de arrancar con esto») venían de cuando la integración era solo
                  para el tablero del dueño, y le decían a un cliente que esto es una
                  herramienta de programación. */}
              <span style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13 }}>“Escribime 5 anuncios para mi oferta, con mis razones de compra.”</span>
              <span style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)', fontSize: 13 }}>“Mirá mi plan y decime qué debería hacer esta semana.”</span>
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
