'use client';

// =============================================================================
// ServicioConfigForm — BYOK embebido en los modales de /integraciones
// =============================================================================
// Wizard de UNA pregunta por pantalla: por paso, un solo campo (su label como
// pregunta, la nota del catálogo como ayuda y UN input), con el tutorial
// desplegable SIEMPRE a mano. El último paso es el resumen: qué quedó cargado /
// pendiente, "Probar conexión" y "Guardar". Si el servicio ya está completo,
// abre en resumen compacto (Probar / Reconfigurar) en vez de arrancar de cero.
// Reusa la infra de /metodo:
//   · GET  /api/integraciones/credencial?servicio=<key>  → catálogo + estado
//   · POST { action:'guardar'|'borrar'|'verificar', ... } → mismas reglas que /metodo
// El estado (configurado / origen / máscara) manda el placeholder y los botones;
// solo se envían los campos TIPEADOS, así "vacío" nunca pisa una credencial guardada.

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type OrigenCampo = 'servidor' | 'panel' | null;
type Campo = {
  env: string;
  label: string;
  placeholder: string | null;
  secreto: boolean;
  opcional: boolean;
  nota: string | null;
  host: boolean;
  configurado: boolean;
  origen: OrigenCampo;
  mask: string;
  ilegible: boolean;
};
type Tutorial = { pasos: string[]; url?: string; urlLabel?: string };
type Servicio = {
  key: string;
  nombre: string;
  categoria: string;
  paraQue: string;
  soloServidor: boolean;
  tutorial: Tutorial;
  campos: Campo[];
};

const input: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--ink)', fontFamily: MONO, fontSize: 13.5, outline: 'none',
};
const btnGhost: CSSProperties = {
  padding: '9px 15px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const btnPrimary: CSSProperties = {
  padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--primary)',
  color: '#fff', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const btnLink: CSSProperties = {
  background: 'none', border: 'none', padding: 0, fontFamily: SANS, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const titulo: CSSProperties = { fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.3, margin: 0 };
const ayuda: CSSProperties = { fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5, margin: '7px 0 0' };
const paso: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.08em', color: 'var(--faint)' };
const caja: CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12 };

function calcConectada(campos: Campo[]): boolean {
  const requeridos = campos.filter((c) => !c.opcional);
  return requeridos.length ? requeridos.every((c) => c.configurado) : campos.some((c) => c.configurado);
}

// Solo los campos con valor tipeado (input vacío sobre una guardada = "no la cambies").
function tipeados(campos: Campo[], valores: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of campos) {
    const v = (valores[c.env] ?? '').trim();
    if (v) out[c.env] = v;
  }
  return out;
}

// El label del catálogo, como pregunta: "Access token" → "Pegá tu access token".
// Respeta las siglas del label ("ID de cuenta publicitaria", "URL base", "API key").
function enMinuscula(label: string): string {
  const primera = label.split(' ')[0] ?? '';
  if (primera.length > 1 && primera.slice(1) !== primera.slice(1).toLowerCase()) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}
const preguntaDe = (c: Campo) => `Pegá tu ${enMinuscula(c.label)}`;

// Estado de un campo para las listas de resumen. `origen` NO cambia lo que se
// muestra: una credencial configurada se ve igual venga de donde venga.
function estadoDe(c: Campo, tipeado: boolean): { texto: string; color: string } {
  if (tipeado) return { texto: 'listo para guardar', color: 'var(--primary)' };
  if (c.ilegible) return { texto: 'ilegible', color: 'var(--warn)' };
  if (c.configurado) return { texto: `••••${c.mask}`, color: 'var(--good)' };
  if (c.opcional) return { texto: 'vacío · opcional', color: 'var(--faint)' };
  return { texto: 'pendiente', color: 'var(--warn)' };
}

// ¿Cómo consigo esto? — colapsado por defecto, presente en TODOS los pasos.
function TutorialDesplegable({ tutorial, abierto, onToggle }: { tutorial: Tutorial; abierto: boolean; onToggle: () => void }) {
  return (
    <div style={{ ...caja, overflow: 'hidden' }}>
      <button type="button" onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}>
        ¿Cómo consigo esto?
        <span style={{ color: 'var(--faint)', fontSize: 11 }}>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <div style={{ padding: '2px 14px 14px' }}>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {tutorial.pasos.map((p, i) => (
              <li key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <span style={{ flex: 'none', width: 20, height: 20, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 10.5, color: 'var(--dim)' }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>{p}</span>
              </li>
            ))}
          </ol>
          {tutorial.url && (
            <a href={tutorial.url} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 11, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
              {tutorial.urlLabel ?? tutorial.url} ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function ServicioConfigForm({ servicioKey, onEstado }: {
  servicioKey: string;
  onEstado?: (conectada: boolean) => void;
}) {
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  // "Cambiar" sobre una credencial ya guardada → habilita su input.
  const [editando, setEditando] = useState<Record<string, boolean>>({});
  const [pasoActual, setPasoActual] = useState(0);
  const [modo, setModo] = useState<'resumen' | 'wizard'>('wizard');
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [saved, setSaved] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [probeMsg, setProbeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tutAbierto, setTutAbierto] = useState(false);
  // Resumen vs wizard se decide UNA vez, con el primer estado que llega: recargar
  // después (guardar / quitar) no tiene que sacarte de donde estás parado.
  const modoDecidido = useRef(false);

  const aplicar = (s: Servicio) => {
    setServicio(s);
    const conectada = calcConectada(s.campos);
    onEstado?.(conectada);
    if (!modoDecidido.current) { modoDecidido.current = true; setModo(conectada ? 'resumen' : 'wizard'); }
  };

  const cargar = () => {
    setErrorCarga(null);
    fetch(`/api/integraciones/credencial?servicio=${encodeURIComponent(servicioKey)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.servicio) aplicar(j.servicio as Servicio);
        else setErrorCarga(j.error === 'solo admin' ? 'Necesitás ser admin para configurar esta integración.' : (j.error ?? 'No se pudo cargar el estado.'));
      })
      .catch(() => setErrorCarga('No se pudo cargar. Revisá tu conexión y probá de nuevo.'))
      .finally(() => setCargando(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [servicioKey]);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  const probar = async () => {
    if (!servicio) return;
    setProbando(true); setProbeMsg(null);
    try {
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verificar', servicio: servicio.key, valores: tipeados(servicio.campos, valores) }),
      }).then((r) => r.json());
      setProbeMsg(j.ok ? { ok: true, text: j.detalle ?? 'Conexión OK.' } : { ok: false, text: j.error ?? 'No se pudo verificar.' });
    } catch (e) { setProbeMsg({ ok: false, text: String(e) }); }
    finally { setProbando(false); }
  };

  const guardar = async () => {
    if (!servicio) return;
    const vals = tipeados(servicio.campos, valores);
    if (!Object.keys(vals).length) return;
    setGuardando(true); setProbeMsg(null);
    try {
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guardar', servicio: servicio.key, valores: vals }),
      }).then((r) => r.json());
      if (j.ok && j.servicio) {
        const s = j.servicio as Servicio;
        aplicar(s);
        setValores((v) => { const nv = { ...v }; for (const env of Object.keys(vals)) delete nv[env]; return nv; });
        setEditando({});
        flash();
        // Quedó completo → cerramos el wizard en el resumen compacto.
        if (calcConectada(s.campos)) setModo('resumen');
      } else {
        setProbeMsg({ ok: false, text: j.error ?? 'No se pudo guardar.' });
      }
    } catch (e) { setProbeMsg({ ok: false, text: String(e) }); }
    finally { setGuardando(false); }
  };

  const quitar = async (env: string) => {
    setQuitando(env); setProbeMsg(null);
    try {
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'borrar', env }),
      }).then((r) => r.json());
      if (j.ok) { setValores((v) => { const nv = { ...v }; delete nv[env]; return nv; }); cargar(); }
      else setProbeMsg({ ok: false, text: j.error ?? 'No se pudo quitar.' });
    } catch (e) { setProbeMsg({ ok: false, text: String(e) }); }
    finally { setQuitando(null); }
  };

  if (cargando) {
    return <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'var(--faint)', padding: '6px 0' }}>Cargando configuración…</div>;
  }
  if (errorCarga || !servicio) {
    return (
      <div style={{ ...caja, padding: '13px 15px' }}>
        <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 8 }}>{errorCarga ?? 'No se pudo cargar la configuración.'}</div>
        <button type="button" style={btnGhost} onClick={() => { setCargando(true); cargar(); }}>Reintentar</button>
      </div>
    );
  }

  const soloLectura = servicio.soloServidor;
  const campos = servicio.campos;
  const total = campos.length + 1; // + el resumen final
  const idx = Math.min(pasoActual, total - 1);
  const campo: Campo | undefined = campos[idx];
  const hayTipeado = Object.keys(tipeados(campos, valores)).length > 0;

  const irA = (n: number) => { setProbeMsg(null); setPasoActual(Math.max(0, Math.min(n, total - 1))); };

  const tutorial = <TutorialDesplegable tutorial={servicio.tutorial} abierto={tutAbierto} onToggle={() => setTutAbierto((o) => !o)} />;
  const resultado = probeMsg && (
    <div style={{ fontSize: 12.5, fontWeight: 500, color: probeMsg.ok ? 'var(--good)' : 'var(--bad)', lineHeight: 1.45 }}>
      {probeMsg.ok ? '✓' : '✗'} {probeMsg.text}
    </div>
  );
  const okFlash = saved && <span style={{ fontSize: 12.5, color: 'var(--good)', fontWeight: 600 }}>Guardado ✓</span>;
  const btnProbar = (
    <button type="button" style={{ ...btnGhost, opacity: probando ? 0.6 : 1, cursor: probando ? 'default' : 'pointer' }} disabled={probando} onClick={probar}>
      {probando ? 'Probando…' : 'Probar conexión'}
    </button>
  );
  const lista = (
    <div style={{ ...caja, padding: '3px 13px' }}>
      {campos.map((c, i) => {
        const st = estadoDe(c, !!(valores[c.env] ?? '').trim());
        return (
          <div key={c.env} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
            <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: st.color, whiteSpace: 'nowrap' }}>{st.texto}</span>
          </div>
        );
      })}
    </div>
  );

  // ── Ya configurado (o gestionado en el server): resumen compacto, sin wizard ──
  if (soloLectura || modo === 'resumen') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {lista}
        {!soloLectura && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            {btnProbar}
            <button type="button" style={btnGhost} onClick={() => { setProbeMsg(null); setPasoActual(0); setModo('wizard'); }}>Reconfigurar</button>
            {okFlash}
          </div>
        )}
        {resultado}
        {tutorial}
      </div>
    );
  }

  // ── Wizard: una pregunta por paso; el último es el resumen ───────────────────
  // `guardada` = configurada y legible, sin importar de dónde salga hoy: todo
  // campo es editable (la base manda sobre el entorno del server).
  const guardada = !!campo?.configurado;
  // Solo hay fila que borrar si la credencial vive en la base.
  const enBase = campo?.origen === 'panel' || !!campo?.ilegible;
  const editar = campo ? (editando[campo.env] ?? !guardada) : false;
  const mostrarOmitir = !!campo && campo.opcional && (!campo.configurado || campo.ilegible);
  const ayudaTexto = campo ? [campo.nota, campo.opcional ? 'Podés dejarlo vacío.' : null].filter(Boolean).join(' ') : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={paso}>{idx + 1} de {total}</span>
        {campo?.opcional && <span style={paso}>· opcional</span>}
        {okFlash && <span style={{ marginLeft: 'auto' }}>{okFlash}</span>}
      </div>

      {campo ? (
        <div>
          <h4 style={titulo}>{preguntaDe(campo)}</h4>
          {ayudaTexto && <p style={ayuda}>{ayudaTexto}</p>}

          <div style={{ marginTop: 12 }}>
            {guardada && !editar ? (
              <div style={{ ...caja, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                <span style={{ flex: 'none', width: 7, height: 7, borderRadius: 999, background: 'var(--good)' }} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 13, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>••••{campo.mask} — guardada</span>
                <button type="button" style={{ ...btnLink, flex: 'none', color: 'var(--primary)' }} onClick={() => setEditando((e) => ({ ...e, [campo.env]: true }))}>Cambiar</button>
              </div>
            ) : (
              <input
                style={input}
                type={campo.secreto ? 'password' : 'text'}
                value={valores[campo.env] ?? ''}
                placeholder={guardada ? `••••${campo.mask} — guardada` : (campo.placeholder ?? '')}
                autoComplete="off"
                onChange={(e) => setValores((v) => ({ ...v, [campo.env]: e.target.value }))}
              />
            )}

            {campo.ilegible && <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 6, lineHeight: 1.45 }}>Guardada pero ilegible (rotó la clave de cifrado) — volvé a pegarla.</div>}
            {enBase && (
              <button type="button" onClick={() => quitar(campo.env)} disabled={quitando === campo.env}
                style={{ ...btnLink, marginTop: 8, color: 'var(--bad)', cursor: quitando === campo.env ? 'default' : 'pointer', opacity: quitando === campo.env ? 0.6 : 1 }}>
                {quitando === campo.env ? 'Quitando…' : 'Quitar credencial'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <h4 style={titulo}>Revisá y guardá</h4>
          <div style={{ marginTop: 12 }}>{lista}</div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...btnGhost, opacity: idx === 0 ? 0.4 : 1, cursor: idx === 0 ? 'default' : 'pointer' }} disabled={idx === 0} onClick={() => irA(idx - 1)}>
          Atrás
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}>
          {mostrarOmitir && (
            <button type="button" style={{ ...btnLink, color: 'var(--faint)', padding: '9px 4px' }}
              onClick={() => { setValores((v) => { const nv = { ...v }; delete nv[campo.env]; return nv; }); irA(idx + 1); }}>
              Omitir
            </button>
          )}
          {campo ? (
            <button type="button" style={btnPrimary} onClick={() => irA(idx + 1)}>Siguiente</button>
          ) : (
            <>
              {btnProbar}
              <button type="button" style={{ ...btnPrimary, opacity: hayTipeado && !guardando ? 1 : 0.45, cursor: hayTipeado && !guardando ? 'pointer' : 'default' }} disabled={!hayTipeado || guardando} onClick={guardar}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>

      {resultado}
      {tutorial}
    </div>
  );
}
