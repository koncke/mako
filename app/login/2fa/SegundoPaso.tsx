'use client';

// =============================================================================
// SegundoPaso — elegir el método, probarlo y entrar (o activar el primero)
// =============================================================================
// Todo pasa por /api/auth/2fa, que se autentica con el paso intermedio y nada más.
// Dos caminos:
//   · ENTRAR: el método más fuerte que la persona tenga sale primero (llave de acceso
//     > app > WhatsApp > correo) y los demás quedan a un clic.
//   · ACTIVAR EL PRIMERO: sólo si no tiene ninguno (el super admin la primera vez).
//     Al confirmarlo entra y se le muestran sus códigos de recuperación UNA vez.
//
// El código por WhatsApp o correo se manda con un botón y no al abrir: recargar la
// pantalla no puede mandar un mensaje.

import { useEffect, useState, type CSSProperties } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { descargarCodigos } from './descargar-codigos';
import { CampoCodigo } from './CampoCodigo';

type Metodo = 'passkey' | 'totp' | 'whatsapp' | 'email' | 'recuperacion';
type Estado = {
  factores: { totp: boolean; passkey: boolean; whatsapp: string | null; email: string | null; recuperacion: boolean };
  hayQueEnrolar: boolean;
  passkeysDisponibles: boolean;
  /** ¿Es un teléfono? La huella se ofrece sólo ahí, y sólo después de entrar (14/10/2026). */
  esTelefono: boolean;
  /** Por dónde puede salir un código hoy (vacío en la tanda 1). */
  canales: ('whatsapp' | 'email')[];
};
type Respuesta = { ok: boolean; error?: string; next?: string; codigos?: string[]; destino?: string; [k: string]: unknown };

const ORDEN: Metodo[] = ['passkey', 'totp', 'whatsapp', 'email'];
const TITULO: Record<Metodo, string> = {
  passkey: 'Llave de acceso',
  totp: 'App de autenticación',
  whatsapp: 'Código por WhatsApp',
  email: 'Código por correo',
  recuperacion: 'Código de recuperación',
};

const btn: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '12px', borderRadius: '11px', border: 'none', background: '#2F6FED', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box' };
const btnSec: CSSProperties = { ...btn, background: '#fff', color: '#14161B', border: '1px solid rgba(0,0,0,.18)' };
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: '#2F6FED', fontSize: '13px', cursor: 'pointer' };
const campo: CSSProperties = { width: '100%', padding: '12px', borderRadius: '11px', border: '1px solid rgba(0,0,0,.18)', background: '#fff', color: '#14161B', fontSize: '18px', letterSpacing: '4px', textAlign: 'center', boxSizing: 'border-box', outline: 'none' };
const campoTexto: CSSProperties = { ...campo, fontSize: '15px', letterSpacing: 'normal', textAlign: 'left' };
const titulo: CSSProperties = { fontWeight: 700, fontSize: '17px', color: '#14161B', marginBottom: '4px' };
const sub: CSSProperties = { fontSize: '13px', color: '#5B6472', marginBottom: '14px' };
const errorBox: CSSProperties = { marginBottom: '12px', fontSize: '13px', color: '#b91c1c', background: '#fdecec', border: '1px solid #f5c2c2', borderRadius: '10px', padding: '10px 12px' };

async function pedir(body: Record<string, unknown>): Promise<Respuesta> {
  const r = await fetch('/api/auth/2fa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (r.status === 401) { window.location.href = '/login?error=mfa-vencido'; return { ok: false }; }
  return (await r.json().catch(() => ({ ok: false, error: 'No se pudo conectar.' }))) as Respuesta;
}

export function SegundoPaso({ cuenta }: { cuenta: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [metodo, setMetodo] = useState<Metodo | null>(null);
  const [enrolando, setEnrolando] = useState<Metodo | null>(null);
  const [codigo, setCodigo] = useState('');
  const [destino, setDestino] = useState('');
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const [qr, setQr] = useState<{ qr: string; secreto: string; uri?: string } | null>(null);
  const [recordar, setRecordar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigos, setCodigos] = useState<{ lista: string[]; next: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  // Después de entrar, en el teléfono: «¿la próxima vez con la huella?». Guarda adónde ir después.
  const [ofertaHuella, setOfertaHuella] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/2fa').then(async (r) => {
      if (r.status === 401) { window.location.href = '/login?error=mfa-vencido'; return; }
      const j = (await r.json()) as Estado & { ok: boolean };
      if (!j.ok) return;
      setEstado(j);
      const disponibles = ORDEN.filter((m) => (m === 'passkey' ? j.factores.passkey && j.passkeysDisponibles : !!j.factores[m]));
      setMetodo(disponibles[0] ?? (j.factores.recuperacion ? 'recuperacion' : null));
    }).catch(() => setError('No se pudo conectar.'));
  }, []);

  /**
   * Va a la app, salvo que haya que ofrecer la huella: decisión de Martín (14/10/2026), «es
   * justamente un método rápido de entrar con el celu». Sólo en el teléfono, sólo si todavía no
   * tiene una llave, y sólo DESPUÉS de haber entrado (la sesión ya está puesta: la llave se crea
   * por /api/perfil/seguridad). Si dijo «Ahora no» en este teléfono, no se insiste.
   */
  const terminar = (next: string) => {
    let yaDijoQueNo = false;
    try { yaDijoQueNo = localStorage.getItem('mako.huella.ahora-no') === '1'; } catch { /* sin storage: se ofrece */ }
    if (estado?.esTelefono && estado.passkeysDisponibles && !estado.factores.passkey && !yaDijoQueNo) {
      setOfertaHuella(next);
      return;
    }
    window.location.href = next;
  };

  /** Termina: con códigos nuevos, primero se muestran; si no, entra. */
  const salir = (j: Respuesta) => {
    const next = j.next || '/inicio';
    if (j.codigos?.length) { setCodigos({ lista: j.codigos, next }); return; }
    terminar(next);
  };

  const correr = async (fn: () => Promise<void>) => {
    setOcupado(true); setError(null);
    try { await fn(); } catch (e) {
      // Cancelar el diálogo del navegador no es un error que haya que contar.
      const nombre = e instanceof Error ? e.name : '';
      setError(nombre === 'NotAllowedError' ? 'Se canceló. Vuelve a probar.' : 'No se pudo. Vuelve a probar.');
    } finally { setOcupado(false); }
  };

  const cambiar = (m: Metodo | null, enrolar = false) => {
    setError(null); setCodigo(''); setEnviadoA(null); setQr(null); setDestino('');
    if (enrolar) setEnrolando(m); else setMetodo(m);
  };

  // ── Entrar ─────────────────────────────────────────────────────────────────
  const enviar = (canal: 'whatsapp' | 'email') => correr(async () => {
    const j = await pedir({ accion: 'enviar', canal });
    if (!j.ok) { setError(j.error ?? 'No se pudo mandar.'); return; }
    setEnviadoA(String(j.destino ?? ''));
  });
  const verificar = (m: Metodo) => correr(async () => {
    const j = await pedir({ accion: 'verificar', metodo: m, codigo, recordar });
    if (!j.ok) { setError(j.error ?? 'No coincide.'); return; }
    salir(j);
  });
  const usarPasskey = () => correr(async () => {
    const o = await pedir({ accion: 'passkey-opciones' });
    if (!o.ok) { setError(o.error ?? 'No se pudo.'); return; }
    const respuesta = await startAuthentication({ optionsJSON: o.opciones as Parameters<typeof startAuthentication>[0]['optionsJSON'] });
    const j = await pedir({ accion: 'passkey-verificar', respuesta, recordar });
    if (!j.ok) { setError(j.error ?? 'No se pudo.'); return; }
    salir(j);
  });

  // ── Activar el primero ─────────────────────────────────────────────────────
  const iniciarTotp = () => correr(async () => {
    const j = await pedir({ accion: 'enrolar-totp-iniciar' });
    if (!j.ok) { setError(j.error ?? 'No se pudo.'); return; }
    setQr({ qr: String(j.qr), secreto: String(j.secreto), uri: typeof j.uri === 'string' ? j.uri : undefined });
  });
  const confirmarTotp = () => correr(async () => {
    const j = await pedir({ accion: 'enrolar-totp-confirmar', codigo, recordar });
    if (!j.ok) { setError(j.error ?? 'No coincide.'); return; }
    salir(j);
  });
  /** La huella, ya adentro: la crea /api/perfil/seguridad con la sesión que se acaba de poner. */
  const activarHuella = (next: string) => correr(async () => {
    const seg = async (body: Record<string, unknown>) => {
      const r = await fetch('/api/perfil/seguridad', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return (await r.json().catch(() => ({ ok: false, error: 'No se pudo conectar.' }))) as Respuesta;
    };
    const o = await seg({ accion: 'passkey-opciones' });
    if (!o.ok) { setError(o.error ?? 'No se pudo.'); return; }
    const respuesta = await startRegistration({ optionsJSON: o.opciones as Parameters<typeof startRegistration>[0]['optionsJSON'] });
    const j = await seg({ accion: 'passkey-verificar', respuesta, nombre: 'Celular' });
    if (!j.ok) { setError(j.error ?? 'No se pudo.'); return; }
    window.location.href = next;
  });
  const enviarEnrolar = (canal: 'whatsapp' | 'email') => correr(async () => {
    const j = await pedir({ accion: 'enrolar-codigo-enviar', canal, destino });
    if (!j.ok) { setError(j.error ?? 'No se pudo mandar.'); return; }
    setEnviadoA(String(j.destino ?? ''));
  });
  const confirmarEnrolar = (canal: 'whatsapp' | 'email') => correr(async () => {
    const j = await pedir({ accion: 'enrolar-codigo-confirmar', canal, codigo, recordar });
    if (!j.ok) { setError(j.error ?? 'No coincide.'); return; }
    salir(j);
  });

  // ── Pantallas ──────────────────────────────────────────────────────────────
  if (codigos) {
    return (
      <div>
        <div style={titulo}>Guarda estos códigos</div>
        <div style={sub}>Cada uno sirve una vez si pierdes tu método.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontFamily: "'Geist Mono', monospace", fontSize: '14px', background: '#fff', border: '1px solid rgba(0,0,0,.12)', borderRadius: '11px', padding: '12px', marginBottom: '12px' }}>
          {codigos.lista.map((c) => <div key={c}>{c}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <button type="button" style={btnSec} onClick={() => descargarCodigos(codigos.lista, cuenta)}>Descargar</button>
          <button type="button" style={btnSec} onClick={() => { void navigator.clipboard?.writeText(codigos.lista.join('\n')); setCopiado(true); }}>
            {copiado ? 'Copiados' : 'Copiar'}
          </button>
        </div>
        <button type="button" style={btn} onClick={() => terminar(codigos.next)}>Ya los guardé</button>
      </div>
    );
  }

  if (ofertaHuella) {
    const despues = ofertaHuella;
    return (
      <div>
        <div style={titulo}>Entra más rápido</div>
        <div style={sub}>La próxima vez, con tu huella o Face ID.</div>
        {error && <div style={errorBox}>{error}</div>}
        <button type="button" style={{ ...btn, marginBottom: '8px' }} disabled={ocupado} onClick={() => activarHuella(despues)}>Activar</button>
        <button type="button" style={btnSec} disabled={ocupado} onClick={() => {
          try { localStorage.setItem('mako.huella.ahora-no', '1'); } catch { /* sin storage: se vuelve a ofrecer */ }
          window.location.href = despues;
        }}>Ahora no</button>
      </div>
    );
  }

  if (!estado) return error ? <div style={errorBox}>{error}</div> : <div style={{ height: '120px' }} aria-busy="true" />;

  const recordarCasilla = (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#5B6472', margin: '12px 0 4px', cursor: 'pointer' }}>
      <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
      Recordar este dispositivo 30 días
    </label>
  );
  // El campo detecta el código copiado y, con 6 dígitos, avanza solo (CampoCodigo, pedido de Martín
  // del 14/10/2026). Los botones de abajo quedan igual, por si alguien prefiere apretar.
  const campoCodigo = (onEnter: () => void, largo: 6 | 11 = 6) => (
    <CampoCodigo
      valor={codigo} onCambio={setCodigo} onCompleto={onEnter} ocupado={ocupado} error={error} largo={largo}
      estilo={largo === 6 ? campo : { ...campo, fontSize: '16px', letterSpacing: '2px' }}
    />
  );

  // ── Activar el primero ─────────────────────────────────────────────────────
  if (estado.hayQueEnrolar) {
    // ⛔ La huella NO es un primer método (decisión de Martín, 14/10/2026): se ofrece en el
    // teléfono después de entrar. Con un solo método para elegir, no hay nada que elegir.
    const opciones: { m: Metodo; txt: string }[] = [
      { m: 'totp', txt: 'App de autenticación' },
      ...(estado.canales.includes('whatsapp') ? [{ m: 'whatsapp' as Metodo, txt: 'WhatsApp' }] : []),
      ...(estado.canales.includes('email') ? [{ m: 'email' as Metodo, txt: 'Otro correo' }] : []),
    ];
    const elegido = enrolando ?? (opciones.length === 1 ? opciones[0].m : null);
    if (!elegido) {
      return (
        <div>
          <div style={titulo}>Activa un segundo paso</div>
          <div style={sub}>Tu cuenta lo pide para entrar.</div>
          {error && <div style={errorBox}>{error}</div>}
          <div style={{ display: 'grid', gap: '8px' }}>
            {opciones.map((o) => (
              <button key={o.m} type="button" style={btnSec} onClick={() => cambiar(o.m, true)}>{o.txt}</button>
            ))}
          </div>
        </div>
      );
    }
    const volver = opciones.length > 1
      ? <div style={{ marginTop: '14px', textAlign: 'center' }}><button type="button" style={link} onClick={() => cambiar(null, true)}>Otro método</button></div>
      : null;
    if (elegido === 'totp') {
      return (
        <div>
          <div style={titulo}>App de autenticación</div>
          <div style={sub}>{qr ? 'Escanea el código y escribe el número que muestra.' : 'Google Authenticator, Authy o la que uses.'}</div>
          {error && <div style={errorBox}>{error}</div>}
          {!qr ? (
            <button type="button" style={btn} disabled={ocupado} onClick={iniciarTotp}>Mostrar el código QR</button>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado en el server */}
              <img src={qr.qr} alt="Código QR" width={180} height={180} style={{ display: 'block', margin: '0 auto 8px', borderRadius: '8px' }} />
              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: '#5B6472', textAlign: 'center', wordBreak: 'break-all', marginBottom: '12px' }}>{qr.secreto}</div>
              {/* En el celular no hay QR que escanear: el link otpauth abre la app con la cuenta cargada. */}
              {estado.esTelefono && qr.uri && <a href={qr.uri} style={{ ...btnSec, display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: '12px' }}>Abrir en la app</a>}
              {campoCodigo(confirmarTotp)}
              {recordarCasilla}
              <button type="button" style={{ ...btn, marginTop: '10px' }} disabled={ocupado || codigo.length !== 6} onClick={confirmarTotp}>Activar</button>
            </>
          )}
          {volver}
        </div>
      );
    }
    const canal = elegido === 'whatsapp' ? 'whatsapp' : 'email';
    return (
      <div>
        <div style={titulo}>{canal === 'whatsapp' ? 'WhatsApp' : 'Otro correo'}</div>
        <div style={sub}>{enviadoA ? `Te mandamos un código a ${enviadoA}.` : canal === 'whatsapp' ? 'Tu número con código de país.' : 'Uno distinto del de Google.'}</div>
        {error && <div style={errorBox}>{error}</div>}
        {!enviadoA ? (
          <>
            <input
              value={destino} autoFocus onChange={(e) => setDestino(e.target.value)}
              inputMode={canal === 'whatsapp' ? 'tel' : 'email'} placeholder={canal === 'whatsapp' ? '+54 9 11 2345 6789' : 'nombre@correo.com'}
              onKeyDown={(e) => { if (e.key === 'Enter' && destino) enviarEnrolar(canal); }}
              style={campoTexto}
            />
            <button type="button" style={{ ...btn, marginTop: '10px' }} disabled={ocupado || !destino.trim()} onClick={() => enviarEnrolar(canal)}>Mandar código</button>
          </>
        ) : (
          <>
            {campoCodigo(() => confirmarEnrolar(canal))}
            {recordarCasilla}
            <button type="button" style={{ ...btn, marginTop: '10px' }} disabled={ocupado || codigo.length !== 6} onClick={() => confirmarEnrolar(canal)}>Activar</button>
          </>
        )}
        {volver}
      </div>
    );
  }

  // ── Entrar ─────────────────────────────────────────────────────────────────
  const otros: Metodo[] = [
    ...ORDEN.filter((m) => m !== metodo && (m === 'passkey' ? estado.factores.passkey && estado.passkeysDisponibles : !!estado.factores[m])),
    ...(metodo !== 'recuperacion' && estado.factores.recuperacion ? ['recuperacion' as Metodo] : []),
  ];

  if (!metodo) {
    return <div style={errorBox}>No hay un método que se pueda usar aquí. Entra desde hola-mako.com.</div>;
  }

  return (
    <div>
      <div style={titulo}>{TITULO[metodo]}</div>
      <div style={sub}>
        {metodo === 'passkey' ? 'Usa la huella, Face ID o el PIN de este dispositivo.'
          : metodo === 'totp' ? 'Escribe el número que muestra tu app.'
          : metodo === 'recuperacion' ? 'Uno de los que guardaste al activar.'
          : enviadoA ? `Te mandamos un código a ${enviadoA}.`
          : `Lo mandamos a ${metodo === 'whatsapp' ? estado.factores.whatsapp : estado.factores.email}.`}
      </div>
      {error && <div style={errorBox}>{error}</div>}

      {metodo === 'passkey' ? (
        <>
          {recordarCasilla}
          <button type="button" style={{ ...btn, marginTop: '10px' }} disabled={ocupado} onClick={usarPasskey}>Usar llave de acceso</button>
        </>
      ) : (metodo === 'whatsapp' || metodo === 'email') && !enviadoA ? (
        <button type="button" style={btn} disabled={ocupado} onClick={() => enviar(metodo)}>Mandar código</button>
      ) : (
        <>
          {campoCodigo(() => verificar(metodo), metodo === 'recuperacion' ? 11 : 6)}
          {recordarCasilla}
          <button
            type="button" style={{ ...btn, marginTop: '10px' }}
            disabled={ocupado || (metodo === 'recuperacion' ? codigo.trim().length < 10 : codigo.length !== 6)}
            onClick={() => verificar(metodo)}
          >
            Entrar
          </button>
          {(metodo === 'whatsapp' || metodo === 'email') && (
            <div style={{ marginTop: '10px', textAlign: 'center' }}>
              <button type="button" style={link} disabled={ocupado} onClick={() => enviar(metodo)}>Reenviar</button>
            </div>
          )}
        </>
      )}

      {otros.length > 0 && (
        <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,.08)', display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center' }}>
          {otros.map((m) => <button key={m} type="button" style={link} onClick={() => cambiar(m)}>{TITULO[m]}</button>)}
        </div>
      )}
    </div>
  );
}
