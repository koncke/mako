'use client';

// =============================================================================
// ServicioConfigForm — BYOK embebido en los modales de /integraciones
// =============================================================================
// Pegar + guardar + "Probar conexión" de las credenciales de UN servicio, sin
// salir del modal del board. Reusa la infra de /metodo:
//   · GET  /api/integraciones/credencial?servicio=<key>  → catálogo + estado
//   · POST { action:'guardar'|'borrar'|'verificar', ... } → mismas reglas que /metodo
// El estado (configurado / origen / máscara) manda el placeholder y los botones;
// solo se envían los campos TIPEADOS, así "vacío" nunca pisa una credencial guardada.

import { useEffect, useState, type CSSProperties } from 'react';

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

export default function ServicioConfigForm({ servicioKey, onEstado }: {
  servicioKey: string;
  onEstado?: (conectada: boolean) => void;
}) {
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [saved, setSaved] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [probeMsg, setProbeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tutAbierto, setTutAbierto] = useState(false);

  const aplicar = (s: Servicio) => { setServicio(s); onEstado?.(calcConectada(s.campos)); };

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
        aplicar(j.servicio as Servicio);
        setValores((v) => { const nv = { ...v }; for (const env of Object.keys(vals)) delete nv[env]; return nv; });
        flash();
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
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
        <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginBottom: 8 }}>{errorCarga ?? 'No se pudo cargar la configuración.'}</div>
        <button type="button" style={btnGhost} onClick={() => { setCargando(true); cargar(); }}>Reintentar</button>
      </div>
    );
  }

  const soloLectura = servicio.soloServidor;
  const hayTipeado = Object.keys(tipeados(servicio.campos, valores)).length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Campos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {servicio.campos.map((c) => {
          const enServidor = c.origen === 'servidor';
          const enPanel = c.configurado && c.origen === 'panel';
          const bloqueado = soloLectura || enServidor;
          const placeholder = enServidor ? 'Configurada en el servidor'
            : enPanel ? `••••${c.mask} — guardada`
            : (c.placeholder ?? '');
          return (
            <div key={c.env}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 7 }}>
                <span>{c.label}{c.opcional && <span style={{ fontWeight: 400, color: 'var(--faint)' }}> · opcional</span>}</span>
                {enServidor && (
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: 'var(--dim)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 6 }}>
                    Configurada en el servidor (Vercel)
                  </span>
                )}
              </label>
              <input
                style={{ ...input, ...(bloqueado ? { background: 'var(--surface-2)', color: 'var(--faint)', cursor: 'not-allowed' } : null) }}
                type={c.secreto ? 'password' : 'text'}
                value={valores[c.env] ?? ''}
                placeholder={placeholder}
                disabled={bloqueado}
                autoComplete="off"
                onChange={(e) => setValores((v) => ({ ...v, [c.env]: e.target.value }))}
              />
              {c.ilegible && <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 5 }}>Guardada pero ilegible (rotó la clave de cifrado) — volvé a pegarla.</div>}
              {c.nota && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 5, lineHeight: 1.45 }}>{c.nota}</div>}
              {(enPanel || c.ilegible) && !soloLectura && (
                <button type="button" onClick={() => quitar(c.env)} disabled={quitando === c.env}
                  style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, fontFamily: SANS, fontSize: 12, fontWeight: 600, color: 'var(--bad)', cursor: quitando === c.env ? 'default' : 'pointer', opacity: quitando === c.env ? 0.6 : 1 }}>
                  {quitando === c.env ? 'Quitando…' : 'Quitar credencial'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Botonera (los soloServidor no editan) */}
      {!soloLectura && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <button type="button" style={{ ...btnGhost, opacity: probando ? 0.6 : 1, cursor: probando ? 'default' : 'pointer' }} disabled={probando} onClick={probar}>
            {probando ? 'Probando…' : 'Probar conexión'}
          </button>
          <button type="button" style={{ ...btnPrimary, opacity: hayTipeado && !guardando ? 1 : 0.45, cursor: hayTipeado && !guardando ? 'pointer' : 'default' }} disabled={!hayTipeado || guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          {saved && <span style={{ fontSize: 12.5, color: 'var(--good)', fontWeight: 600 }}>Guardado ✓</span>}
        </div>
      )}

      {probeMsg && (
        <div style={{ fontSize: 12.5, fontWeight: 500, color: probeMsg.ok ? 'var(--good)' : 'var(--bad)', lineHeight: 1.45 }}>{probeMsg.text}</div>
      )}

      {/* ¿Cómo consigo esto? — tutorial paso a paso */}
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <button type="button" onClick={() => setTutAbierto((o) => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--ink)', textAlign: 'left' }}>
          ¿Cómo consigo esto?
          <span style={{ color: 'var(--faint)', fontSize: 11 }}>{tutAbierto ? '▲' : '▼'}</span>
        </button>
        {tutAbierto && (
          <div style={{ padding: '2px 14px 14px' }}>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {servicio.tutorial.pasos.map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <span style={{ flex: 'none', width: 20, height: 20, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 10.5, color: 'var(--dim)' }}>{i + 1}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>{p}</span>
                </li>
              ))}
            </ol>
            {servicio.tutorial.url && (
              <a href={servicio.tutorial.url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 11, fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                {servicio.tutorial.urlLabel ?? servicio.tutorial.url} ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
