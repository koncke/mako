'use client';

// =============================================================================
// ServicioConfigForm — BYOK embebido en los modales de /integraciones
// =============================================================================
// TODA la lista de credenciales del servicio junta (no wizard de a un paso): una
// fila por campo, con su estado y sus acciones como ÍCONOS en la misma línea
// (Reconfigurar · Probar conexión · Quitar). Abajo, "Probar conexión" + "Guardar"
// y el tutorial desplegable.
// Reusa la infra de /metodo:
//   · GET  /api/integraciones/credencial?servicio=<key>  → catálogo + estado
//   · POST { action:'guardar'|'borrar'|'verificar', ... } → mismas reglas que /metodo
// El estado (configurado / máscara / ilegible) manda el placeholder y los íconos;
// solo se envían los campos TIPEADOS, así "vacío" nunca pisa una credencial guardada.
// OJO: no existe el concepto "configurada en el servidor" — TODO campo es editable.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../_components/icons';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// El "ojito" muestra el secreto un rato y lo vuelve a tapar solo: que una
// credencial no quede a la vista en una pantalla compartida o grabada.
const OCULTAR_MS = 30_000;

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

// Los inputs usan .mako-field (app/globals.css), el campo minimalista del
// onboarding: relleno suave, sin borde duro y anillo sutil al foco. Es EL estilo
// de campo de MaKo — no se reinventa acá con estilos en línea.
const btnGhost: CSSProperties = {
  padding: '9px 15px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)',
  color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const btnPrimary: CSSProperties = {
  padding: '9px 15px', borderRadius: 10, border: 'none', background: 'var(--primary)',
  color: '#fff', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
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

// Estado de un campo, en UNA palabra (la máscara ••••xxxx se ve en la fila, no acá).
// `origen` NO cambia lo que se muestra: una credencial configurada se ve igual
// venga de donde venga.
function estadoDe(c: Campo, tipeado: boolean): { texto: string; color: string } {
  if (tipeado) return { texto: 'listo para guardar', color: 'var(--primary)' };
  if (c.ilegible) return { texto: 'ilegible', color: 'var(--warn)' };
  if (c.configurado) return { texto: 'guardada', color: 'var(--good)' };
  if (c.opcional) return { texto: 'vacío · opcional', color: 'var(--faint)' };
  return { texto: 'pendiente', color: 'var(--warn)' };
}

// Acción de fila: ícono + tooltip. Sin texto — el `title` explica qué hace.
function IconBtn({ name, title, onClick, disabled, tone = 'dim' }: {
  name: string; title: string; onClick: () => void; disabled?: boolean; tone?: 'dim' | 'bad' | 'primary';
}) {
  const color = tone === 'bad' ? 'var(--bad)' : tone === 'primary' ? 'var(--primary)' : 'var(--dim)';
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      style={{
        flex: 'none', width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, padding: 0,
      }}>
      <Icon name={name} size={16} />
    </button>
  );
}

// ¿Cómo consigo esto? — colapsado por defecto, siempre a mano.
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
  // "Reconfigurar" sobre una credencial ya guardada → habilita su input.
  const [editando, setEditando] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [saved, setSaved] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [probeMsg, setProbeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tutAbierto, setTutAbierto] = useState(false);
  // Texto plano de las credenciales que el admin pidió ver. Nunca viene en la
  // carga del modal: se pide de a una (action 'revelar') y queda auditado.
  const [revelado, setRevelado] = useState<Record<string, string>>({});
  const [revelando, setRevelando] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const aplicar = (s: Servicio) => {
    setServicio(s);
    onEstado?.(calcConectada(s.campos));
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

  // Al cambiar de servicio (o cerrar el modal) no quedan timers vivos ni se
  // arrastra a la vista el secreto que se reveló en el anterior.
  useEffect(() => {
    cargar();
    const t = timers.current;
    return () => {
      for (const env of Object.keys(t)) { clearTimeout(t[env]); delete t[env]; }
      setRevelado({});
    };
    // `cargar` se re-crea en cada render: incluirla recargaría en loop. El
    // servicio es lo único que debe disparar la recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicioKey]);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  const ocultar = (env: string) => {
    clearTimeout(timers.current[env]);
    delete timers.current[env];
    setRevelado((r) => { const nr = { ...r }; delete nr[env]; return nr; });
  };

  const revelar = async (env: string) => {
    setRevelando(env); setProbeMsg(null);
    try {
      const j = await fetch('/api/integraciones/credencial', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revelar', env }),
      }).then((r) => r.json());
      if (j.ok && typeof j.valor === 'string') {
        setRevelado((r) => ({ ...r, [env]: j.valor as string }));
        timers.current[env] = setTimeout(() => ocultar(env), OCULTAR_MS);
      } else setProbeMsg({ ok: false, text: j.error ?? 'No se pudo mostrar la credencial.' });
    } catch { setProbeMsg({ ok: false, text: 'No se pudo mostrar la credencial. Probá de nuevo.' }); }
    finally { setRevelando(null); }
  };


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
        setEditando({});
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
      if (j.ok) { setValores((v) => { const nv = { ...v }; delete nv[env]; return nv; }); setEditando((e) => { const ne = { ...e }; delete ne[env]; return ne; }); cargar(); }
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

  const campos = servicio.campos;
  const hayTipeado = Object.keys(tipeados(campos, valores)).length > 0;

  const resultado = probeMsg && (
    <div style={{ fontSize: 12.5, fontWeight: 500, color: probeMsg.ok ? 'var(--good)' : 'var(--bad)', lineHeight: 1.45 }}>
      {probeMsg.ok ? '✓' : '✗'} {probeMsg.text}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── La lista COMPLETA de credenciales del servicio, una fila por campo ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {campos.map((c) => {
          const tipeado = !!(valores[c.env] ?? '').trim();
          const st = estadoDe(c, tipeado);
          // `guardada` = configurada y legible, sin importar de dónde salga hoy.
          const guardada = c.configurado && !c.ilegible;
          const editar = editando[c.env] ?? !guardada;
          // Solo hay fila que borrar si la credencial vive en la base.
          const enBase = c.origen === 'panel' || c.ilegible;
          return (
            <div key={c.env}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                <span style={{ flex: 'none', marginLeft: 'auto', fontFamily: MONO, fontSize: 10.5, color: st.color, whiteSpace: 'nowrap' }}>{st.texto}</span>
              </div>

              {/* Campo + acciones, TODO en la misma línea */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {guardada && !editar ? (
                  <div style={{ ...caja, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '13px 15px', borderRadius: 13 }}>
                    <span style={{ flex: 'none', width: 7, height: 7, borderRadius: 999, background: 'var(--good)' }} />
                    {/* Revelada: se muestra ENTERA (para eso se pidió) y copiable;
                        tapada: solo los últimos 4 en una línea. */}
                    <span style={{
                      flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 13,
                      ...(revelado[c.env]
                        ? { color: 'var(--ink)', wordBreak: 'break-all', whiteSpace: 'normal', userSelect: 'all' as const }
                        : { color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                    }}>{revelado[c.env] ?? `••••${c.mask}`}</span>
                  </div>
                ) : (
                  <input
                    className="mako-field"
                    style={{ flex: 1, minWidth: 0 }}
                    type={c.secreto ? 'password' : 'text'}
                    value={valores[c.env] ?? ''}
                    placeholder={c.configurado ? `••••${c.mask} — guardada` : (c.placeholder ?? '')}
                    autoComplete="off"
                    onChange={(e) => setValores((v) => ({ ...v, [c.env]: e.target.value }))}
                  />
                )}
                {guardada && !editar && (
                  revelado[c.env]
                    ? <IconBtn name="eye-off" title="Ocultar" tone="primary" onClick={() => ocultar(c.env)} />
                    : <IconBtn name="eye" title="Ver la credencial (se oculta sola)" disabled={revelando === c.env} onClick={() => revelar(c.env)} />
                )}
                {guardada && (
                  editar
                    ? <IconBtn name="x" title="Cancelar y dejar la guardada"
                        onClick={() => { setEditando((e) => ({ ...e, [c.env]: false })); setValores((v) => { const nv = { ...v }; delete nv[c.env]; return nv; }); }} />
                    : <IconBtn name="pen" title="Reconfigurar — pegar una credencial nueva" tone="primary"
                        onClick={() => { ocultar(c.env); setEditando((e) => ({ ...e, [c.env]: true })); }} />
                )}
                <IconBtn name="plug" title={probando ? 'Probando conexión…' : 'Probar conexión'} disabled={probando} onClick={probar} />
                {enBase && (
                  <IconBtn name="trash" title="Quitar credencial" tone="bad" disabled={quitando === c.env} onClick={() => quitar(c.env)} />
                )}
              </div>

              {c.nota && <p style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.45, margin: '7px 0 0' }}>{c.nota}</p>}
              {c.ilegible && <div style={{ fontSize: 12, color: 'var(--warn)', marginTop: 6, lineHeight: 1.45 }}>Guardada pero ilegible (rotó la clave de cifrado) — volvé a pegarla.</div>}
            </div>
          );
        })}
      </div>

      {/* ── Acciones del servicio ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <button type="button" style={{ ...btnGhost, opacity: probando ? 0.6 : 1, cursor: probando ? 'default' : 'pointer' }} disabled={probando} onClick={probar}>
          {probando ? 'Probando…' : 'Probar conexión'}
        </button>
        <button type="button" style={{ ...btnPrimary, opacity: hayTipeado && !guardando ? 1 : 0.45, cursor: hayTipeado && !guardando ? 'pointer' : 'default' }} disabled={!hayTipeado || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        {saved && <span style={{ fontSize: 12.5, color: 'var(--good)', fontWeight: 600 }}>Guardado ✓</span>}
      </div>

      {resultado}
      <TutorialDesplegable tutorial={servicio.tutorial} abierto={tutAbierto} onToggle={() => setTutAbierto((o) => !o)} />
    </div>
  );
}
