'use client';

// =============================================================================
// SeguridadPanel — los métodos del segundo paso, de a uno por fila
// =============================================================================
// Cada método es una fila: si está activo dice cuál es y se puede quitar; si no, se
// activa ahí mismo (el formulario se abre debajo de la fila). Al super admin no se le
// deja quitar el último: lo decide el server (lib/mfa.ts → quitarFactor), la pantalla
// sólo muestra lo que contesta.

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import Link from '@/app/_ui/Link';
import { Pagina } from '@/app/_ui';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { descargarCodigos } from '@/app/login/2fa/descargar-codigos';

type Estado = {
  obligatorio: boolean;
  cuenta: string;
  passkeysDisponibles: boolean;
  /** Por dónde puede salir un código hoy (vacío en la tanda 1). */
  canales: ('whatsapp' | 'email')[];
  totp: boolean;
  whatsapp: string | null;
  email: string | null;
  passkeys: { id: number; nombre: string | null; created_at: string; usado_at: string | null }[];
  codigosRestantes: number;
  dispositivos: { id: number; nombre: string | null; created_at: string; usado_at: string | null; expira_at: string }[];
};
type Abierto = 'totp' | 'whatsapp' | 'email' | 'passkey' | null;

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '6px 20px' };
const fila: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border)' };
const nombreFila: CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--ink)' };
const detalle: CSSProperties = { fontSize: 13, color: 'var(--dim)' };
const btn: CSSProperties = { padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'var(--on-accent, #fff)', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnSec: CSSProperties = { padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, cursor: 'pointer' };
const input: CSSProperties = { padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, outline: 'none', minWidth: 0 };
const titulo: CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '26px 0 10px' };

async function pedir(body: Record<string, unknown>) {
  const r = await fetch('/api/perfil/seguridad', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: 'No se pudo conectar.' }))) as { ok: boolean; error?: string; [k: string]: unknown };
}

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '—');

export function SeguridadPanel() {
  const [e, setE] = useState<Estado | null>(null);
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [destino, setDestino] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const [qr, setQr] = useState<{ qr: string; secreto: string } | null>(null);
  const [codigos, setCodigos] = useState<string[] | null>(null);

  const cargar = useCallback(() => {
    fetch('/api/perfil/seguridad').then((r) => r.json()).then((j) => { if (j.ok) setE(j as Estado); }).catch(() => {});
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const abrir = (a: Abierto) => { setAbierto(a); setError(null); setDestino(''); setCodigo(''); setEnviadoA(null); setQr(null); };

  const correr = async (fn: () => Promise<{ ok: boolean; error?: string; [k: string]: unknown } | void>) => {
    setOcupado(true); setError(null);
    try {
      const j = await fn();
      if (j && !j.ok) { setError(j.error ?? 'No se pudo.'); return; }
      if (j && Array.isArray(j.codigos)) setCodigos(j.codigos as string[]);
    } catch (err) {
      setError(err instanceof Error && err.name === 'NotAllowedError' ? 'Se canceló.' : 'No se pudo.');
    } finally { setOcupado(false); }
  };

  /** Terminó de activar: cierra el formulario y relee. */
  const listo = async (j: { ok: boolean; error?: string; [k: string]: unknown }) => {
    if (j.ok) { abrir(null); cargar(); }
    return j;
  };

  if (!e) return <Pagina><div style={{ ...detalle, padding: 24 }}>Cargando…</div></Pagina>;

  const activos = (e.totp ? 1 : 0) + e.passkeys.length + (e.whatsapp ? 1 : 0) + (e.email ? 1 : 0);

  const formCodigo = (canal: 'whatsapp' | 'email') => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 0 14px' }}>
      {!enviadoA ? (
        <>
          <input
            style={{ ...input, flex: 1 }} value={destino} autoFocus onChange={(ev) => setDestino(ev.target.value)}
            placeholder={canal === 'whatsapp' ? '+54 9 11 2345 6789' : 'Un correo distinto del de Google'}
            inputMode={canal === 'whatsapp' ? 'tel' : 'email'}
          />
          <button type="button" style={btn} disabled={ocupado || !destino.trim()} onClick={() => correr(() => pedir({ accion: 'codigo-enviar', canal, destino }).then((j) => { if (j.ok) setEnviadoA(String(j.destino)); return j; }))}>Mandar código</button>
        </>
      ) : (
        <>
          <input style={{ ...input, width: 130, letterSpacing: 3 }} value={codigo} autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" onChange={(ev) => setCodigo(ev.target.value.replace(/\D/g, ''))} />
          <button type="button" style={btn} disabled={ocupado || codigo.length !== 6} onClick={() => correr(() => pedir({ accion: 'codigo-confirmar', canal, codigo }).then(listo))}>Activar</button>
          <span style={{ ...detalle, alignSelf: 'center' }}>Enviado a {enviadoA}</span>
        </>
      )}
    </div>
  );

  const quitar = (factor: string, passkeyId?: number) =>
    correr(() => pedir({ accion: 'quitar', factor, passkeyId }).then(listo));

  const filaMetodo = (key: Exclude<Abierto, null>, nombre: string, activo: string | null, extra?: ReactNode) => (
    <>
      <div style={fila}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={nombreFila}>{nombre}</div>
          <div style={detalle}>{activo ?? 'Sin activar'}</div>
        </div>
        {activo && key !== 'passkey'
          ? <BotonBorrar onClick={() => quitar(key)} disabled={ocupado} title={`Quitar ${nombre}`} />
          : abierto === key
            ? <button type="button" style={btnSec} onClick={() => abrir(null)}>Cancelar</button>
            : (key !== 'passkey' || e.passkeysDisponibles) && <button type="button" style={btnSec} onClick={() => abrir(key)}>{key === 'passkey' && activo ? 'Agregar otra' : 'Activar'}</button>}
      </div>
      {extra}
    </>
  );

  return (
    <Pagina>
      <Link href="/perfil" style={{ fontSize: 13, color: 'var(--dim)', textDecoration: 'none' }}>← Perfil</Link>
      <h1 style={{ fontWeight: 600, fontSize: 34, letterSpacing: '-0.02em', margin: '10px 0 6px', color: 'var(--ink)' }}>Segundo paso</h1>
      <p style={{ ...detalle, margin: '0 0 6px', fontSize: 14 }}>
        {e.obligatorio ? 'Obligatorio para tu cuenta.' : activos ? 'Activo.' : 'Recomendado: protege tu cuenta si te roban el correo.'}
      </p>
      {error && <div style={{ margin: '12px 0', fontSize: 13, color: 'var(--bad)', background: 'var(--bad-soft, #fdecec)', borderRadius: 10, padding: '10px 12px' }}>{error}</div>}

      {codigos && (
        <div style={{ ...card, padding: 18, margin: '16px 0' }}>
          <div style={nombreFila}>Guarda estos códigos</div>
          <div style={{ ...detalle, marginBottom: 10 }}>Cada uno sirve una vez. No se vuelven a mostrar.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, fontFamily: "'Geist Mono', monospace", fontSize: 14, marginBottom: 12 }}>
            {codigos.map((c) => <div key={c}>{c}</div>)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btnSec} onClick={() => descargarCodigos(codigos, e.cuenta)}>Descargar</button>
            <button type="button" style={btnSec} onClick={() => { void navigator.clipboard?.writeText(codigos.join('\n')); }}>Copiar</button>
            <button type="button" style={btn} onClick={() => setCodigos(null)}>Ya los guardé</button>
          </div>
        </div>
      )}

      <div style={titulo}>Métodos</div>
      <div style={card}>
        {filaMetodo('totp', 'App de autenticación', e.totp ? 'Activa' : null, abierto === 'totp' && (
          <div style={{ padding: '0 0 14px' }}>
            {!qr ? (
              <button type="button" style={btn} disabled={ocupado} onClick={() => correr(() => pedir({ accion: 'totp-iniciar' }).then((j) => { if (j.ok) setQr({ qr: String(j.qr), secreto: String(j.secreto) }); return j; }))}>Mostrar el código QR</button>
            ) : (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado en el server */}
                <img src={qr.qr} alt="Código QR" width={150} height={150} style={{ borderRadius: 8, background: '#fff' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  <div style={{ ...detalle, fontFamily: "'Geist Mono', monospace", fontSize: 11, wordBreak: 'break-all' }}>{qr.secreto}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...input, width: 130, letterSpacing: 3 }} value={codigo} autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" onChange={(ev) => setCodigo(ev.target.value.replace(/\D/g, ''))} />
                    <button type="button" style={btn} disabled={ocupado || codigo.length !== 6} onClick={() => correr(() => pedir({ accion: 'totp-confirmar', codigo }).then(listo))}>Activar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {/* La huella se activa sólo desde el celular (decisión de Martín, 14/10/2026); en la compu se
            listan las que hay, para poder quitarlas. */}
        {filaMetodo('passkey', 'Huella o Face ID', e.passkeys.length ? `${e.passkeys.length} llave${e.passkeys.length > 1 ? 's' : ''}` : (e.passkeysDisponibles ? null : 'Se activa desde el celular'), (
          <>
            {e.passkeys.map((p) => (
              <div key={p.id} style={{ ...fila, paddingLeft: 14 }}>
                <div style={{ flex: 1, ...detalle }}>{p.nombre || 'Llave'} · creada {fecha(p.created_at)}</div>
                <BotonBorrar onClick={() => quitar('passkey', p.id)} disabled={ocupado} title="Quitar esta llave" />
              </div>
            ))}
            {abierto === 'passkey' && (
              <div style={{ padding: '12px 0 14px' }}>
                <button type="button" style={btn} disabled={ocupado} onClick={() => correr(async () => {
                  const o = await pedir({ accion: 'passkey-opciones' });
                  if (!o.ok) return o;
                  const respuesta = await startRegistration({ optionsJSON: o.opciones as Parameters<typeof startRegistration>[0]['optionsJSON'] });
                  return listo(await pedir({ accion: 'passkey-verificar', respuesta, nombre: navigator.platform || '' }));
                })}>Crear llave en este dispositivo</button>
              </div>
            )}
          </>
        ))}
        {/* Un canal que hoy no manda códigos no se ofrece (tanda 1: ninguno). Si ya estuviera
            activo, se sigue mostrando para poder quitarlo. */}
        {(e.canales.includes('whatsapp') || e.whatsapp) && filaMetodo('whatsapp', 'WhatsApp', e.whatsapp, abierto === 'whatsapp' && formCodigo('whatsapp'))}
        {(e.canales.includes('email') || e.email) && (
          <div style={{ marginBottom: -1 }}>
            {filaMetodo('email', 'Correo de respaldo', e.email, abierto === 'email' && formCodigo('email'))}
          </div>
        )}
      </div>

      <div style={titulo}>Códigos de recuperación</div>
      <div style={{ ...card, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, ...detalle }}>{activos ? `Te quedan ${e.codigosRestantes}.` : 'Se crean al activar un método.'}</div>
        {activos > 0 && (
          <button type="button" style={btnSec} disabled={ocupado} onClick={() => correr(() => pedir({ accion: 'codigos-generar' }).then((j) => { cargar(); return j; }))}>Generar nuevos</button>
        )}
      </div>

      <div style={titulo}>Dispositivos recordados</div>
      <div style={card}>
        {e.dispositivos.length === 0 ? (
          <div style={{ ...detalle, padding: '14px 0' }}>Ninguno.</div>
        ) : (
          <>
            {e.dispositivos.map((d) => (
              <div key={d.id} style={fila}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={nombreFila}>{d.nombre || 'Dispositivo'}</div>
                  <div style={detalle}>Último uso {fecha(d.usado_at ?? d.created_at)} · vence {fecha(d.expira_at)}</div>
                </div>
                <BotonBorrar onClick={() => correr(() => pedir({ accion: 'dispositivo-revocar', id: d.id }).then(listo))} disabled={ocupado} title="Olvidar este dispositivo" />
              </div>
            ))}
            <div style={{ padding: '12px 0' }}>
              <button type="button" style={btnSec} disabled={ocupado} onClick={() => correr(() => pedir({ accion: 'dispositivo-revocar', id: 'todos' }).then(listo))}>Olvidar todos</button>
            </div>
          </>
        )}
      </div>
    </Pagina>
  );
}
