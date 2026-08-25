'use client';

// =============================================================================
// MetodoWizard — conexión guiada de integraciones, un servicio por pantalla:
// tutorial paso a paso para conseguir cada token, probar conexión y guardar.
// El catálogo (campos + tutoriales) vive en lib/metodo-catalogo.ts; el estado
// real (configurado / origen / máscara) sale de GET /api/metodo.
// =============================================================================

import Link from '@/app/_ui/Link';
import { useEffect, useState, type CSSProperties } from 'react';
import { MakoLogo } from '../_components/MakoBrand';
import type { ServicioMetodo } from '@/lib/metodo-catalogo';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// mismas constantes de estilo que OnboardingForm (hermano visual de esta vista)
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 };
const input: CSSProperties = { width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none' };
const btnDark: CSSProperties = { padding: '12px 22px', borderRadius: 12, border: 'none', background: '#14161B', color: '#F3F5F8', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '12px 18px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 14, cursor: 'pointer' };

// ── estado que devuelve GET /api/metodo ──────────────────────────────────────
type OrigenCampo = 'servidor' | 'panel' | null;
type CampoEstado = { env: string; configurado: boolean; origen: OrigenCampo; mask: string; ilegible: boolean };
type ServicioEstado = { key: string; conectada: boolean; campos: CampoEstado[] };

function Chip({ texto, tono }: { texto: string; tono: 'good' | 'warn' }) {
  const tonos: Record<typeof tono, CSSProperties> = {
    good: { background: 'var(--good-bg)', color: 'var(--good)' },
    warn: { background: 'var(--warn-bg)', color: 'var(--warn)' },
  };
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: SANS, ...tonos[tono] }}>{texto}</span>;
}

/**
 * ⚠️ EL CATALOGO LLEGA POR PROPS, no se importa acá.
 *
 * Este archivo es `'use client'` y hacía `import { SERVICIOS_METODO }`: eso metía
 * lib/metodo-catalogo.ts ENTERO en el bundle del navegador — 145 KB con los
 * tutoriales de las 20 integraciones, los nombres de todas las envs y el copy
 * interno de la agencia, incluida la entrada de GitHub, que es una credencial de
 * plataforma. `import type` no arrastra nada: se borra en compilación.
 *
 * Y hay una segunda razón, que es la que importa de verdad: recibiéndolo por props,
 * la página puede pasarlo YA FILTRADO con `serviciosPara()`. Importado acá, el
 * cliente se llevaba el catálogo completo aunque la pantalla no lo pintara.
 */
export function MetodoWizard({ servicios: SERVICIOS_METODO }: { servicios: ServicioMetodo[] }) {
  const [estado, setEstado] = useState<Record<string, ServicioEstado>>({});
  const [cargando, setCargando] = useState(true);
  const [step, setStep] = useState(0);
  const [fin, setFin] = useState(false);
  // lo tipeado por env var (input vacío sobre una guardada = "no la cambies")
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [probeMsg, setProbeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  // apertura manual del tutorial por servicio (default: abierto si NO está conectado)
  const [tutOverride, setTutOverride] = useState<Record<string, boolean>>({});

  const aplicar = (lista: unknown) => {
    if (!Array.isArray(lista)) return;
    setEstado(Object.fromEntries((lista as ServicioEstado[]).map((s) => [s.key, s])));
  };

  const cargar = () => {
    setErrorCarga(null);
    fetch('/api/metodo')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) aplicar(j.servicios);
        else setErrorCarga(j.error === 'solo admin' ? 'Necesitás ser admin para configurar las integraciones.' : (j.error ?? 'No se pudo cargar el estado.'));
      })
      .catch(() => setErrorCarga('No se pudo cargar. Revisá tu conexión y probá de nuevo.'))
      .finally(() => setCargando(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, []);

  const total = SERVICIOS_METODO.length;
  const stepSafe = Math.min(step, total - 1);
  const servicio = SERVICIOS_METODO[stepSafe];
  const est: ServicioEstado | undefined = estado[servicio.key];
  const conectadas = SERVICIOS_METODO.filter((s) => estado[s.key]?.conectada).length;

  const campoEstado = (env: string): CampoEstado | undefined => est?.campos.find((c) => c.env === env);

  const chipEstado = est?.conectada
    ? { texto: 'Conectada', tono: 'good' as const }
    : { texto: 'Falta conectar', tono: 'warn' as const };

  const tutAbierto = tutOverride[servicio.key] ?? !est?.conectada;

  // solo los campos con valor tipeado (así "vacío" nunca pisa una guardada)
  const tipeados = (s: ServicioMetodo): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const c of s.campos) {
      const v = (valores[c.env] ?? '').trim();
      if (v) out[c.env] = v;
    }
    return out;
  };
  const hayTipeado = Object.keys(tipeados(servicio)).length > 0;

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };
  const irA = (n: number) => { setProbeMsg(null); setStep(n); };

  const probar = async () => {
    setProbando(true); setProbeMsg(null);
    try {
      const j = await fetch('/api/metodo/verificar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicio: servicio.key, valores: tipeados(servicio) }),
      }).then((r) => r.json());
      setProbeMsg(j.ok ? { ok: true, text: j.detalle ?? 'Conexión OK.' } : { ok: false, text: j.error ?? 'No se pudo verificar.' });
    } catch (e) { setProbeMsg({ ok: false, text: String(e) }); }
    finally { setProbando(false); }
  };

  const guardar = async () => {
    const vals = tipeados(servicio);
    if (!Object.keys(vals).length) return;
    setGuardando(true);
    try {
      const j = await fetch('/api/metodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guardar', servicio: servicio.key, valores: vals }),
      }).then((r) => r.json());
      if (j.ok) {
        aplicar(j.servicios);
        setValores((v) => { const nv = { ...v }; for (const env of Object.keys(vals)) delete nv[env]; return nv; });
        setProbeMsg(null);
        flash();
      } else {
        setProbeMsg({ ok: false, text: j.error ?? 'No se pudo guardar.' });
      }
    } catch (e) { setProbeMsg({ ok: false, text: String(e) }); }
    finally { setGuardando(false); }
  };

  // Desconecta una credencial guardada desde el panel (borra la fila cifrada).
  const quitar = async (env: string) => {
    setQuitando(env); setProbeMsg(null);
    try {
      const j = await fetch('/api/metodo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'borrar', env }),
      }).then((r) => r.json());
      if (j.ok) { aplicar(j.servicios); setValores((v) => { const nv = { ...v }; delete nv[env]; return nv; }); }
      else setProbeMsg({ ok: false, text: j.error ?? 'No se pudo quitar.' });
    } catch (e) { setProbeMsg({ ok: false, text: String(e) }); }
    finally { setQuitando(null); }
  };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 60px', minHeight: '100vh', position: 'relative' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <MakoLogo size={36} />
        <h1 style={{ fontWeight: 600, fontSize: 42, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Método</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && <span style={{ fontSize: 13, color: 'var(--good)', fontWeight: 600 }}>Guardado ✓</span>}
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>{conectadas} de {total} conectadas</span>
        </div>
      </header>

      {cargando ? (
        <div style={{ ...card, maxWidth: 760, color: 'var(--faint)', fontFamily: MONO, fontSize: 13, marginTop: 18 }}>Cargando…</div>
      ) : errorCarga ? (
        <div style={{ ...card, maxWidth: 560, margin: '40px auto 0', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--bad)', fontWeight: 600, marginBottom: 4 }}>{errorCarga}</div>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 16 }}>Si tu sesión venció, entrá de nuevo.</div>
          <button type="button" style={btnGhost} onClick={() => { setCargando(true); cargar(); }}>Reintentar</button>
        </div>
      ) : fin ? (
        // ── Pantalla final: resumen + siguientes pasos ──
        <div style={{ maxWidth: 560, margin: '0 auto', minHeight: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 18px' }}>Conectadas {conectadas} de {total}</h2>
          <div style={{ ...card, padding: '14px 20px' }}>
            {SERVICIOS_METODO.map((s) => {
              const con = !!estado[s.key]?.conectada;
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: con ? 'var(--good)' : 'var(--border-strong)', flex: 'none' }} />
                  <span style={{ fontSize: 14, color: 'var(--ink)' }}>{s.nombre}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: con ? 'var(--good)' : 'var(--faint)' }}>{con ? 'conectada' : 'pendiente'}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' }}>
            <Link href="/onboarding" style={{ ...btnDark, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Completar el perfil del negocio →</Link>
            <Link href="/inicio" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Volver al inicio</Link>
          </div>
        </div>
      ) : (
        // ── Wizard: un servicio por pantalla ──
        <div style={{ maxWidth: 560, margin: '0 auto', minHeight: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 10 }}>
            {SERVICIOS_METODO.map((s, i) => {
              const con = !!estado[s.key]?.conectada;
              return <span key={s.key} style={{ width: i === stepSafe ? 22 : 7, height: 7, borderRadius: 999, background: con ? 'var(--good)' : i === stepSafe ? 'var(--primary)' : 'var(--border-strong)', transition: 'all .2s' }} />;
            })}
          </div>
          <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 20 }}>Paso {stepSafe + 1} de {total}</div>

          <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 10px' }}>{servicio.nombre}</h2>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', background: 'var(--surface-2)', padding: '4px 10px', borderRadius: 999 }}>{servicio.categoria}</span>
            <Chip texto={chipEstado.texto} tono={chipEstado.tono} />
          </div>
          <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--dim)', margin: '0 0 8px' }}>{servicio.paraQue}</p>

          {/* tutorial: cómo conseguir el token */}
          <div style={{ ...card, padding: 0, overflow: 'hidden', marginTop: 12 }}>
            <button type="button" onClick={() => setTutOverride((t) => ({ ...t, [servicio.key]: !tutAbierto }))} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}>
              Cómo conseguir el token
              <span style={{ color: 'var(--faint)', fontSize: 11 }}>{tutAbierto ? '▲' : '▼'}</span>
            </button>
            {tutAbierto && (
              <div style={{ padding: '2px 18px 16px' }}>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {servicio.tutorial.pasos.map((p, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ flex: 'none', width: 22, height: 22, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11, color: 'var(--dim)' }}>{i + 1}</span>
                      <span style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>{p}</span>
                    </li>
                  ))}
                </ol>
                {servicio.tutorial.url && (
                  <a href={servicio.tutorial.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                    {servicio.tutorial.urlLabel ?? servicio.tutorial.url} ↗
                  </a>
                )}
              </div>
            )}
          </div>

          {/* campos + botonera (los soloServidor muestran solo estado y tutorial) */}
          {!servicio.soloServidor && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 22 }}>
                {servicio.campos.map((c) => {
                  const ce = campoEstado(c.env);
                  // Todo campo es editable: la base manda sobre el entorno del
                  // server. `origen` solo dice si hay fila que se pueda quitar.
                  const guardada = !!ce?.configurado;
                  const enBase = ce?.origen === 'panel' || !!ce?.ilegible;
                  const placeholder = guardada ? `••••${ce?.mask ?? ''} — guardada` : c.placeholder;
                  return (
                    <div key={c.env}>
                      <label style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                        {c.label}{c.opcional && <span style={{ fontWeight: 400, color: 'var(--faint)' }}> · opcional</span>}
                      </label>
                      <input
                        style={input}
                        type={c.secreto ? 'password' : 'text'}
                        value={valores[c.env] ?? ''}
                        placeholder={placeholder}
                        autoComplete="off"
                        onChange={(e) => setValores((v) => ({ ...v, [c.env]: e.target.value }))}
                      />
                      {ce?.ilegible && <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 6 }}>Guardada con una clave vieja — volvé a pegarla.</div>}
                      {enBase && (
                        <button type="button" onClick={() => quitar(c.env)} disabled={quitando === c.env}
                          style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, fontFamily: SANS, fontSize: 12, fontWeight: 600, color: 'var(--bad)', cursor: quitando === c.env ? 'default' : 'pointer', opacity: quitando === c.env ? 0.6 : 1 }}>
                          {quitando === c.env ? 'Quitando…' : 'Quitar credencial'}
                        </button>
                      )}
                      {c.nota && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>{c.nota}</div>}
                    </div>
                  );
                })}
              </div>

              {/* BYOK: tranquilidad de privacidad al pedir una llave */}
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginTop: 18, padding: '11px 13px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 15, lineHeight: 1.3 }}>🔒</span>
                <span style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
                  <b style={{ color: 'var(--ink)' }}>Tus llaves son tuyas (BYOK).</b> Se guardan <b>cifradas</b> en tu cuenta —nadie más las ve, ni el resto de los clientes— y todo el consumo corre contra <b>tu propio proveedor</b>. Podés quitarlas cuando quieras.
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' }}>
                <button type="button" style={{ ...btnGhost, opacity: probando ? 0.6 : 1, cursor: probando ? 'default' : 'pointer' }} disabled={probando} onClick={probar}>{probando ? 'Probando…' : 'Probar conexión'}</button>
                <button type="button" style={{ ...btnDark, opacity: hayTipeado && !guardando ? 1 : 0.4, cursor: hayTipeado && !guardando ? 'pointer' : 'default' }} disabled={!hayTipeado || guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </>
          )}
          {probeMsg && (
            <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 500, color: probeMsg.ok ? 'var(--good)' : 'var(--bad)', marginTop: 12 }}>{probeMsg.text}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 26 }}>
            <button style={{ ...btnGhost, opacity: stepSafe === 0 ? 0.4 : 1, cursor: stepSafe === 0 ? 'default' : 'pointer' }} disabled={stepSafe === 0} onClick={() => irA(stepSafe - 1)}>← Anterior</button>
            {stepSafe < total - 1
              ? <button style={btnDark} onClick={() => irA(stepSafe + 1)}>Siguiente →</button>
              : <button style={btnDark} onClick={() => { setProbeMsg(null); setFin(true); }}>Terminar</button>}
          </div>
        </div>
      )}
    </main>
  );
}
