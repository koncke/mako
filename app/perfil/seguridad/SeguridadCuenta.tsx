'use client';

// =============================================================================
// Seguridad — Settings › Seguridad (15/10/2026; en el molde de LINEAR desde el 25/10/2026)
// =============================================================================
// 25/10/2026 (Martín: «rediseño completo… sin textos de sobra»): el molde es Security & Access de Linear
// (docs/settings/referencia.md). Cada forma de entrar es una fila con su estado a la derecha y su punto («Activada ●»),
// el estado general sólo aparece si FALTA algo, y los detalles perdieron sus párrafos: lo que se puede hacer es una fila con
// su botón. La estructura de abajo (lista → detalle por `?ver=`, lo que borra sólo en el detalle) sigue siendo la de Google.
//
// El molde es myaccount.google.com/security (relevado el 15/10/2026; reglas.ts lo describe):
//   · arriba la tarjeta de estado, con el escudo verde o ámbar y a dónde ir si falta algo;
//   · «Cómo entras a MaKo» y «Tus dispositivos», como listas agrupadas: la fila ENTERA abre su detalle;
//   · cada detalle es su propia vista (`?ver=app`, `?ver=dispositivo-12`), con «← Seguridad» arriba, y
//     adentro viven activar, quitar, olvidar y generar. En la lista no hay ningún botón suelto.
// Reemplaza al SeguridadPanel de antes (una fila por método con tachos y formularios pegados abajo), que
// Martín marcó: «Esto se ve horrible».
//
// Lo hace /api/perfil/seguridad con la sesión completa, como antes: esta pantalla sólo muestra lo que
// contesta. Al super admin no se le deja quitar el último método: lo decide el server (lib/mfa.ts).
//
// ⚠️ El `?ver=` lo lee el SERVER (page.tsx) y llega como prop: el estado de acá (lo leído, los códigos
// recién generados) sobrevive al ir y volver entre la lista y un detalle, porque el componente es el
// mismo y sólo cambia la prop.

import { useCallback, useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { useConfirm } from '@/app/_ui';
import { CuerpoGrupo, FilaAjustes, GrupoAjustes, PuntoEstado, TituloAjustes } from '@/app/_ui/Ajustes';
import Link from '@/app/_ui/Link';
import { descargarCodigos } from '@/app/login/2fa/descargar-codigos';
import { CampoCodigo } from '@/app/login/2fa/CampoCodigo';
import {
  VER_DISPOSITIVOS, cantidadMetodos, detalleDeUrl, estadoGeneral, fechaCorta, filasDeAcceso, filasDeDispositivos, type EstadoSeguridad,
} from './reglas';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

const BASE = '/perfil/seguridad';
const VOLVER = { href: BASE, label: 'Seguridad' };
type Respuesta = { ok: boolean; error?: string; [k: string]: unknown };

async function pedir(body: Record<string, unknown>): Promise<Respuesta> {
  const r = await fetch('/api/perfil/seguridad', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: 'No se pudo conectar.' }))) as Respuesta;
}

const estiloCodigo = { height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 18, letterSpacing: 4, width: 170, outline: 'none' } as const;

export function SeguridadCuenta({ ver }: { ver: string | null }) {
  const [e, setE] = useState<EstadoSeguridad | null>(null);
  const [sinLeer, setSinLeer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [codigos, setCodigos] = useState<string[] | null>(null);
  // Los formularios de cada detalle: viven acá para que un error del server no los vacíe.
  const [qr, setQr] = useState<{ qr: string; secreto: string; uri?: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [destino, setDestino] = useState('');
  const [enviadoA, setEnviadoA] = useState<string | null>(null);
  const [nuevaPass, setNuevaPass] = useState('');
  const [verPass, setVerPass] = useState(false);
  const { confirm, confirmNode } = useConfirm();

  const cargar = useCallback(() => {
    fetch('/api/perfil/seguridad').then((r) => r.json())
      .then((j) => { if (j.ok) { setE(j as EstadoSeguridad); setSinLeer(false); } else setSinLeer(true); })
      .catch(() => setSinLeer(true));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const detalle = detalleDeUrl(ver);
  // Cambiar de vista limpia los formularios a medio llenar y el error de la anterior.
  useEffect(() => {
    setError(null); setQr(null); setCodigo(''); setDestino(''); setEnviadoA(null); setNuevaPass(''); setVerPass(false);
  }, [detalle]);

  const correr = async (fn: () => Promise<Respuesta | void>) => {
    setOcupado(true); setError(null);
    try {
      const j = await fn();
      if (j && !j.ok) { setError(j.error ?? 'No se pudo.'); return false; }
      if (j && Array.isArray(j.codigos)) setCodigos(j.codigos as string[]);
      return true;
    } catch (err) {
      setError(err instanceof Error && err.name === 'NotAllowedError' ? 'Se canceló.' : 'No se pudo.');
      return false;
    } finally { setOcupado(false); }
  };
  /** Terminó algo que cambia el estado: relee. */
  const yRelee = (j: Respuesta) => { if (j.ok) cargar(); return j; };

  if (!e) {
    return (
      <>
        <TituloAjustes titulo="Seguridad" />
        <GrupoAjustes><FilaAjustes titulo={sinLeer ? 'No se pudo leer tu seguridad. Recarga la página.' : 'Cargando…'} /></GrupoAjustes>
      </>
    );
  }

  const avisoError = error && <div className="aj-error" role="alert">{error}<ReportarASoporte /></div>;
  // Los códigos recién creados se muestran en la vista que sea: no se vuelven a ver nunca.
  const tarjetaCodigos = codigos && (
    <GrupoAjustes titulo="Guarda estos códigos" descripcion="No se vuelven a mostrar.">
      <CuerpoGrupo>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px 16px', fontFamily: "'Geist Mono', monospace", fontSize: 15, color: 'var(--ink)', margin: '4px 0 6px' }}>
          {codigos.map((c) => <div key={c}>{c}</div>)}
        </div>
        <div className="aj-acciones">
          <button type="button" className="aj-boton" data-variante="borde" onClick={() => descargarCodigos(codigos, e.cuenta)}>Descargar</button>
          <button type="button" className="aj-boton" data-variante="borde" onClick={() => { void navigator.clipboard?.writeText(codigos.join('\n')); }}>Copiar</button>
          <button type="button" className="aj-boton" onClick={() => setCodigos(null)}>Ya los guardé</button>
        </div>
      </CuerpoGrupo>
    </GrupoAjustes>
  );
  /** El estado de una fila a la derecha, con su punto (Linear). */
  const estado = (texto: string, tono: 'good' | 'off' | 'warn') => <>{texto}<PuntoEstado tono={tono} /></>;

  // ── La vista general ──────────────────────────────────────────────────────
  if (!detalle) {
    const g = estadoGeneral(e);
    const dispositivos = filasDeDispositivos(e);
    return (
      <>
        <TituloAjustes titulo="Seguridad" />
        {tarjetaCodigos}
        {/* El estado general, sólo si FALTA algo: una cuenta protegida no necesita un cartel que lo diga. */}
        {!g.protegida && (
          <GrupoAjustes>
            <FilaAjustes icono="escudo" titulo={g.titulo} detalle={g.detalle}
              fin={g.ir ? <Link href={`${BASE}?ver=${g.ir}`} className="aj-boton">Resolver</Link> : undefined} />
          </GrupoAjustes>
        )}

        <GrupoAjustes titulo="Cómo entras">
          {filasDeAcceso(e).map((f) => (
            <FilaAjustes key={f.clave} icono={f.icono} titulo={f.titulo} valor={estado(f.valor.texto, f.valor.tono)} href={`${BASE}?ver=${f.clave}`} />
          ))}
        </GrupoAjustes>

        {/* Los que recordaste al entrar (no te piden el código por 30 días). «Olvidar todos» vive en su detalle. */}
        <GrupoAjustes titulo="Dispositivos recordados"
          accion={dispositivos.length > 1 && <Link href={`${BASE}?ver=${VER_DISPOSITIVOS}`} className="aj-boton" data-variante="texto">Ver todos</Link>}>
          {dispositivos.length === 0
            ? <FilaAjustes titulo="Ninguno todavía" />
            : dispositivos.map((d) => <FilaAjustes key={d.id} icono={d.icono} titulo={d.titulo} detalle={d.detalle} href={`${BASE}?ver=dispositivo-${d.id}`} />)}
        </GrupoAjustes>
        {avisoError}
        {confirmNode}
      </>
    );
  }

  // ── Todos los dispositivos (donde vive «Olvidar todos», como el «Revoke all» de Linear) ──
  if (detalle === VER_DISPOSITIVOS) {
    const dispositivos = filasDeDispositivos(e);
    return (
      <>
        <TituloAjustes titulo="Dispositivos recordados" volver={VOLVER} />
        {avisoError}
        <GrupoAjustes titulo={dispositivos.length === 1 ? '1 dispositivo' : `${dispositivos.length} dispositivos`}
          accion={dispositivos.length > 0 && (
            <button type="button" className="aj-boton" data-variante="texto" style={{ color: 'var(--bad)' }} disabled={ocupado}
              onClick={async () => {
                if (!(await confirm('La próxima vez que entres desde cualquiera de ellos, MaKo te va a pedir el código.', { title: '¿Olvidar todos los dispositivos?', confirmLabel: 'Olvidar todos' }))) return;
                void correr(() => pedir({ accion: 'dispositivo-revocar', id: 'todos' }).then(yRelee));
              }}>Olvidar todos</button>
          )}>
          {dispositivos.length === 0
            ? <FilaAjustes titulo="Ninguno todavía" />
            : dispositivos.map((d) => <FilaAjustes key={d.id} icono={d.icono} titulo={d.titulo} detalle={d.detalle} href={`${BASE}?ver=dispositivo-${d.id}`} />)}
        </GrupoAjustes>
        {confirmNode}
      </>
    );
  }

  // ── Un dispositivo ────────────────────────────────────────────────────────
  if (detalle.startsWith('dispositivo-')) {
    const id = Number(detalle.slice('dispositivo-'.length));
    const d = filasDeDispositivos(e).find((x) => x.id === id);
    const crudo = e.dispositivos.find((x) => x.id === id);
    if (!d || !crudo) {
      return (
        <>
          <TituloAjustes titulo="Dispositivo" volver={VOLVER} />
          <GrupoAjustes><FilaAjustes titulo="Este dispositivo ya no está recordado." /></GrupoAjustes>
        </>
      );
    }
    return (
      <>
        <TituloAjustes titulo={d.titulo} volver={VOLVER} />
        {avisoError}
        <GrupoAjustes>
          <FilaAjustes titulo="Recordado desde" valor={fechaCorta(crudo.created_at)} />
          <FilaAjustes titulo="Último uso" valor={crudo.usado_at ? fechaCorta(crudo.usado_at) : 'Sin usar todavía'} />
          <FilaAjustes titulo="No pide el código hasta" valor={fechaCorta(crudo.expira_at)} />
          <FilaAjustes titulo="Olvidar este dispositivo" peligro fin={(
            <button type="button" className="aj-boton" data-variante="peligro" disabled={ocupado}
              onClick={async () => {
                if (!(await confirm('La próxima vez que entres desde ahí, MaKo te va a pedir el código.', { title: `¿Olvidar ${d.titulo}?`, confirmLabel: 'Olvidar' }))) return;
                if (await correr(() => pedir({ accion: 'dispositivo-revocar', id }).then(yRelee))) history.back();
              }}>Olvidar</button>
          )} />
        </GrupoAjustes>
        {confirmNode}
      </>
    );
  }

  const quitar = async (factor: string, nombre: string, passkeyId?: number) => {
    if (!(await confirm('Vas a poder volver a activarlo cuando quieras.', { title: `¿Quitar ${nombre}?`, confirmLabel: 'Quitar' }))) return;
    void correr(() => pedir({ accion: 'quitar', factor, passkeyId }).then(yRelee));
  };
  const botonQuitar = (factor: string, nombre: string) => (
    <button type="button" className="aj-boton" data-variante="texto" style={{ color: 'var(--bad)' }} disabled={ocupado} onClick={() => void quitar(factor, nombre)}>Quitar</button>
  );

  // ── Verificación en 2 pasos (la app) ───────────────────────────────────────
  if (detalle === 'app') {
    const plazo = e.obligatorioDesde && Date.parse(e.obligatorioDesde) > Date.now()
      ? ` desde el ${new Date(e.obligatorioDesde).toLocaleString('es', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '';
    const otros = filasDeAcceso(e).filter((f) => f.clave !== 'app' && f.clave !== 'contrasena');
    return (
      <>
        {/* La única línea: si tu cuenta la exige (y desde cuándo). Lo que es, lo dice el nombre. */}
        <TituloAjustes titulo="Verificación en 2 pasos" volver={VOLVER} bajada={e.obligatorio ? `Tu cuenta la exige${plazo}.` : undefined} />
        {tarjetaCodigos}
        {avisoError}
        <GrupoAjustes>
          {e.totp ? (
            <FilaAjustes icono="escudo" titulo="App de autenticación" detalle="Un código nuevo cada 30 segundos" valor={estado('Activada', 'good')} fin={botonQuitar('totp', 'la app de autenticación')} />
          ) : !qr ? (
            <FilaAjustes icono="escudo" titulo="App de autenticación" detalle="Google Authenticator, Microsoft Authenticator…" fin={(
              <button type="button" className="aj-boton" disabled={ocupado}
                onClick={() => void correr(() => pedir({ accion: 'totp-iniciar' }).then((j) => { if (j.ok) setQr({ qr: String(j.qr), secreto: String(j.secreto), uri: typeof j.uri === 'string' ? j.uri : undefined }); return j; }))}>Configurar</button>
            )} />
          ) : (
            <CuerpoGrupo>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado en el server */}
                <img src={qr.qr} alt="Código QR" width={168} height={168} style={{ borderRadius: 12, background: '#fff', border: '1px solid var(--border)', flex: 'none' }} />
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <p className="aj-texto" style={{ marginBottom: 6 }}>1. Escanéalo con la app.{e.esTelefono ? ' O ábrela desde aquí:' : ' ¿No puedes? Escribe esta clave:'}</p>
                  {e.esTelefono && qr.uri
                    ? <a href={qr.uri} className="aj-boton" data-variante="borde" style={{ marginBottom: 14 }}>Abrir en la app</a>
                    : <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: 'var(--ink)', wordBreak: 'break-all', marginBottom: 14 }}>{qr.secreto}</div>}
                  <label className="aj-rotulo">2. Escribe el código que te muestra</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <CampoCodigo valor={codigo} onCambio={setCodigo} ocupado={ocupado} error={error} estilo={estiloCodigo}
                      onCompleto={() => void correr(() => pedir({ accion: 'totp-confirmar', codigo }).then(yRelee))} />
                    <button type="button" className="aj-boton" disabled={ocupado || codigo.length !== 6}
                      onClick={() => void correr(() => pedir({ accion: 'totp-confirmar', codigo }).then(yRelee))}>Activar</button>
                  </div>
                </div>
              </div>
            </CuerpoGrupo>
          )}
        </GrupoAjustes>
        <GrupoAjustes titulo="Otras formas">
          {otros.map((f) => <FilaAjustes key={f.clave} icono={f.icono} titulo={f.titulo} valor={estado(f.valor.texto, f.valor.tono)} href={`${BASE}?ver=${f.clave}`} />)}
        </GrupoAjustes>
        {confirmNode}
      </>
    );
  }

  // ── Llaves de acceso ──────────────────────────────────────────────────────
  if (detalle === 'llaves') {
    return (
      <>
        <TituloAjustes titulo="Llaves de acceso" volver={VOLVER} />
        {avisoError}
        <GrupoAjustes titulo={e.passkeys.length === 1 ? '1 llave' : `${e.passkeys.length} llaves`}>
          {e.passkeys.length === 0
            ? <FilaAjustes titulo="Todavía no tienes ninguna" />
            : e.passkeys.map((p) => (
              <FilaAjustes key={p.id} icono="llave" titulo={p.nombre || 'Llave'}
                detalle={`Creada el ${fechaCorta(p.created_at)}${p.usado_at ? ` · último uso el ${fechaCorta(p.usado_at)}` : ''}`}
                fin={<button type="button" className="aj-boton" data-variante="texto" style={{ color: 'var(--bad)' }} disabled={ocupado} onClick={() => void quitar('passkey', 'esta llave', p.id)}>Quitar</button>} />
            ))}
          {e.passkeysDisponibles ? (
            <FilaAjustes titulo="Huella o Face ID de este celular" fin={(
              <button type="button" className="aj-boton" disabled={ocupado} onClick={() => void correr(async () => {
                const o = await pedir({ accion: 'passkey-opciones' });
                if (!o.ok) return o;
                const respuesta = await startRegistration({ optionsJSON: o.opciones as Parameters<typeof startRegistration>[0]['optionsJSON'] });
                return yRelee(await pedir({ accion: 'passkey-verificar', respuesta, nombre: navigator.platform || '' }));
              })}>Crear una llave</button>
            )} />
          ) : (
            // La huella se activa sólo desde el celular (decisión de Martín, 14/10/2026); en la computadora
            // se listan las que hay, para poder quitarlas.
            <FilaAjustes icono="celular" titulo="Se crean desde MaKo en tu celular" />
          )}
        </GrupoAjustes>
        {confirmNode}
      </>
    );
  }

  // ── Contraseña ────────────────────────────────────────────────────────────
  if (detalle === 'contrasena') {
    const guardar = () => void correr(() => pedir({ accion: 'contrasena-guardar', nueva: nuevaPass, codigo }).then((j) => {
      if (j.ok) { setNuevaPass(''); setCodigo(''); cargar(); }
      return j;
    }));
    return (
      <>
        <TituloAjustes titulo="Contraseña" volver={VOLVER} />
        {avisoError}
        <GrupoAjustes>
          <FilaAjustes icono="candado" titulo="Contraseña" detalle="Para entrar con tu correo, sin Google"
            valor={e.contrasena ? estado('Creada', 'good') : e.contrasena === false ? estado('Falta crearla', 'warn') : estado('No se pudo leer', 'off')} />
          {!e.totp ? (
            <FilaAjustes titulo="Primero activa la verificación en 2 pasos" fin={<Link href={`${BASE}?ver=app`} className="aj-boton">Activar</Link>} />
          ) : (
            <CuerpoGrupo>
              <form onSubmit={(ev) => { ev.preventDefault(); if (nuevaPass && codigo.length === 6) guardar(); }} style={{ maxWidth: 400 }}>
                {/* El correo, oculto: el gestor de contraseñas la guarda con la cuenta correcta. */}
                <input type="email" autoComplete="username" value={e.cuenta} readOnly hidden />
                <label className="aj-rotulo" htmlFor="pass-nueva">{e.contrasena ? 'Contraseña nueva' : 'Tu contraseña'}</label>
                <input id="pass-nueva" className="aj-campo" type={verPass ? 'text' : 'password'} autoComplete="new-password" value={nuevaPass} onChange={(ev) => setNuevaPass(ev.target.value)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0 18px', fontSize: 13, color: 'var(--dim)' }}>
                  <span>12 caracteres o más.</span>
                  <button type="button" className="aj-volver" style={{ margin: 0, color: 'var(--primary)' }} onClick={() => setVerPass((v) => !v)}>{verPass ? 'Ocultar' : 'Mostrar'}</button>
                </div>
                <label className="aj-rotulo">El código de tu app de autenticación</label>
                <CampoCodigo valor={codigo} onCambio={setCodigo} ocupado={ocupado} error={error} estilo={estiloCodigo}
                  onCompleto={() => { if (nuevaPass) guardar(); }} />
                <div className="aj-acciones">
                  <button type="submit" className="aj-boton" disabled={ocupado || !nuevaPass || codigo.length !== 6}>{e.contrasena ? 'Cambiar la contraseña' : 'Crear la contraseña'}</button>
                </div>
              </form>
            </CuerpoGrupo>
          )}
        </GrupoAjustes>
      </>
    );
  }

  // ── Códigos de recuperación ───────────────────────────────────────────────
  if (detalle === 'codigos') {
    return (
      <>
        {/* Una línea, porque es lo que hay que saber de ellos. */}
        <TituloAjustes titulo="Códigos de recuperación" volver={VOLVER} bajada="Cada uno te deja entrar una vez si pierdes el celular." />
        {tarjetaCodigos}
        {avisoError}
        <GrupoAjustes>
          {cantidadMetodos(e) === 0 ? (
            <FilaAjustes titulo="Se crean al activar la verificación en 2 pasos" fin={<Link href={`${BASE}?ver=app`} className="aj-boton">Activar</Link>} />
          ) : (
            <>
              <FilaAjustes icono="numero" titulo="Te quedan" valor={estado(`${e.codigosRestantes} de 10`, e.codigosRestantes > 2 ? 'good' : 'warn')} />
              <FilaAjustes titulo="Generar códigos nuevos" detalle="Los de ahora dejan de servir" fin={(
                <button type="button" className="aj-boton" data-variante="borde" disabled={ocupado} onClick={async () => {
                  if (!(await confirm('Los códigos que tienes ahora dejan de servir.', { title: '¿Generar códigos nuevos?', confirmLabel: 'Generar', danger: false }))) return;
                  void correr(() => pedir({ accion: 'codigos-generar' }).then(yRelee));
                }}>Generar</button>
              )} />
            </>
          )}
        </GrupoAjustes>
        {confirmNode}
      </>
    );
  }

  // ── WhatsApp o correo de respaldo ─────────────────────────────────────────
  const canal = detalle; // 'whatsapp' | 'email'
  const activo = canal === 'whatsapp' ? e.whatsapp : e.email;
  const nombre = canal === 'whatsapp' ? 'Código por WhatsApp' : 'Correo de respaldo';
  return (
    <>
      <TituloAjustes titulo={nombre} volver={VOLVER} />
      {tarjetaCodigos}
      {avisoError}
      <GrupoAjustes>
        {activo ? (
          <FilaAjustes icono={canal === 'whatsapp' ? 'whatsapp' : 'email'} titulo={activo} valor={estado('Activado', 'good')}
            fin={botonQuitar(canal, canal === 'whatsapp' ? 'el código por WhatsApp' : 'el correo de respaldo')} />
        ) : !enviadoA ? (
          <CuerpoGrupo>
            <form style={{ maxWidth: 400 }} onSubmit={(ev) => {
              ev.preventDefault();
              void correr(() => pedir({ accion: 'codigo-enviar', canal, destino }).then((j) => { if (j.ok) setEnviadoA(String(j.destino)); return j; }));
            }}>
              <label className="aj-rotulo" htmlFor="canal-destino">{canal === 'whatsapp' ? 'Tu WhatsApp' : 'El correo'}</label>
              <input id="canal-destino" className="aj-campo" value={destino} autoFocus onChange={(ev) => setDestino(ev.target.value)}
                placeholder={canal === 'whatsapp' ? '+54 9 11 2345 6789' : 'Uno distinto del de Google'} inputMode={canal === 'whatsapp' ? 'tel' : 'email'} />
              <div className="aj-acciones">
                <button type="submit" className="aj-boton" disabled={ocupado || !destino.trim()}>Mandar el código</button>
              </div>
            </form>
          </CuerpoGrupo>
        ) : (
          <CuerpoGrupo>
            <p className="aj-texto">Te lo mandamos a {enviadoA}.</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <CampoCodigo valor={codigo} onCambio={setCodigo} ocupado={ocupado} error={error} estilo={estiloCodigo}
                onCompleto={() => void correr(() => pedir({ accion: 'codigo-confirmar', canal, codigo }).then(yRelee))} />
              <button type="button" className="aj-boton" disabled={ocupado || codigo.length !== 6}
                onClick={() => void correr(() => pedir({ accion: 'codigo-confirmar', canal, codigo }).then(yRelee))}>Activar</button>
            </div>
          </CuerpoGrupo>
        )}
      </GrupoAjustes>
      {confirmNode}
    </>
  );
}
