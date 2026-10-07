'use client';

// =============================================================================
// CanalMaKoPanel — los dos WhatsApp del super admin: el de MaKo y el tuyo
// =============================================================================
// MAKO: la línea desde la que MaKo habla en los grupos y manda los avisos. Se conecta por QR
// y se fija como voz sola. «Cambiar número» vincula un número NUEVO sin desconectar el que
// está hablando, y «Pasar MaKo a este número» lo deja admin en los grupos antes de mudarse.
//
// TU NÚMERO: tu WhatsApp personal, como línea de tu negocio (la ves en /whatsapp). No es de
// MaKo: es para atender a tus clientes. El porqué de cada parte, en lib/mako-canal.ts.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { EVENTO_VOZ_CAMBIO } from '../_components/AlertaVozMaKo';

const MONO = "'Geist Mono', monospace";
type Estado = 'desconectado' | 'conectando' | 'conectado' | 'sin_confirmar' | 'error';
type Linea = { estado: Estado; numero: string | null; perfil: string | null };
/** `esVozActiva: null` = no se pudo leer cuál es la voz. No es «no». */
type Info = Linea & { esVozActiva: boolean | null };
type Personal = { estado: string; numero: string | null; perfil: string | null; linea: string | null };
type Paso = { jid: string; nombre: string; listo: boolean; motivo?: string };
type Mudanza = { ok: boolean; error?: string; numero?: string; pasos?: Paso[] };
type Flash = { txt: string; error?: boolean };

const btn: CSSProperties = { padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };
const rotulo: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' };
const COLOR: Record<string, string> = { conectado: 'var(--good)', conectando: 'var(--warn)', sin_confirmar: 'var(--warn)', desconectado: 'var(--faint)', error: 'var(--bad)' };
const LABEL: Record<string, string> = { conectado: 'Conectado', conectando: 'Esperando escaneo…', sin_confirmar: 'Sin confirmar', desconectado: 'Desconectado', error: 'Error' };

const avisarCambioDeVoz = () => window.dispatchEvent(new Event(EVENTO_VOZ_CAMBIO));
const dataUrl = (b64: string) => (b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`);

async function post(body: Record<string, unknown>, ms = 60_000): Promise<Record<string, unknown>> {
  const r = await fetch('/api/admin/mako-canal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  return (await r.json()) as Record<string, unknown>;
}

function Giro() {
  return (
    <>
      <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
      <span style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--accent-soft)', borderRadius: '50%', display: 'inline-block', flex: 'none', animation: 'mako-spin .8s linear infinite' }} />
    </>
  );
}

function Fila({ estado, numero, perfil, etiqueta }: { estado: string; numero: string | null; perfil: string | null; etiqueta?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR[estado] ?? 'var(--faint)', flex: 'none' }} />
      <span style={{ fontWeight: 600, fontSize: 14.5, flex: 'none' }}>{etiqueta ?? LABEL[estado] ?? estado}</span>
      {numero && <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {perfil ? `${perfil} · ` : ''}+{numero}</span>}
    </div>
  );
}

function Qr({ src, pie }: { src: string; pie: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="QR" style={{ width: 240, height: 240, borderRadius: 12, border: '1px solid var(--border)' }} />
      <div style={{ fontSize: 12.5, color: 'var(--dim)', textAlign: 'center', lineHeight: 1.5 }}>{pie}</div>
    </div>
  );
}

export function CanalMaKoPanel({ onCambio }: { onCambio?: () => void } = {}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const autoVozRef = useRef(false);
  // El número NUEVO de MaKo, mientras se vincula y se pasa.
  const [nuevo, setNuevo] = useState<Linea | null>(null);
  const [qrNuevo, setQrNuevo] = useState<string | null>(null);
  const [pasando, setPasando] = useState(false);
  const [mudanza, setMudanza] = useState<Mudanza | null>(null);
  // Tu número.
  const [personal, setPersonal] = useState<Personal | null>(null);
  const [qrPersonal, setQrPersonal] = useState<string | null>(null);
  const [flashPersonal, setFlashPersonal] = useState<Flash | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/admin/mako-canal')).json();
      if (j.ok) {
        setInfo({ estado: j.estado, numero: j.numero, perfil: j.perfil, esVozActiva: j.esVozActiva });
        setNuevo(j.nuevo ?? null);
        setPersonal(j.personal ?? null);
      }
    } catch { /* noop */ }
    onCambio?.();
  }, [onCambio]);
  const sondear = useCallback(async (parte: 'canal' | 'nuevo' | 'personal') => {
    try {
      const j = await (await fetch(`/api/admin/mako-canal?parte=${parte}`)).json();
      if (!j.ok) return;
      if (parte === 'canal') setInfo({ estado: j.estado, numero: j.numero, perfil: j.perfil, esVozActiva: j.esVozActiva });
      if (parte === 'nuevo') setNuevo(j.nuevo ?? null);
      if (parte === 'personal') setPersonal(j.personal ?? null);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  // Con un QR en pantalla se sondea SÓLO la parte que se está escaneando.
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(() => { sondear('canal'); }, 3000);
    return () => clearInterval(t);
  }, [qr, sondear]);
  useEffect(() => {
    if (!qrNuevo) return;
    const t = setInterval(() => { sondear('nuevo'); }, 3000);
    return () => clearInterval(t);
  }, [qrNuevo, sondear]);
  useEffect(() => {
    if (!qrPersonal) return;
    const t = setInterval(() => { sondear('personal'); }, 3000);
    return () => clearInterval(t);
  }, [qrPersonal, sondear]);

  useEffect(() => {
    if (info?.estado === 'conectado' && qr) {
      setQr(null); setFlash({ txt: '¡Conectado! 🎉' }); setTimeout(() => setFlash(null), 3000);
      avisarCambioDeVoz();
      onCambio?.();
    }
  }, [info?.estado, qr, onCambio]);
  useEffect(() => { if (nuevo?.estado === 'conectado' && qrNuevo) setQrNuevo(null); }, [nuevo?.estado, qrNuevo]);
  useEffect(() => {
    if (personal?.estado === 'conectado' && qrPersonal) {
      setQrPersonal(null); setFlashPersonal({ txt: '¡Conectado! 🎉' }); setTimeout(() => setFlashPersonal(null), 3000);
    }
  }, [personal?.estado, qrPersonal]);

  // El WhatsApp conectado ES el canal de MaKo: se fija como voz automáticamente (y queda admin
  // en todos los grupos), sin toggle manual.
  // ⚠️ Solo con `esVozActiva === false`, nunca con `null`: «no pude leer cuál es la voz» no
  // autoriza a escribirla (segunda revisión del 11/09/2026).
  useEffect(() => {
    if (info?.estado === 'conectado' && info.esVozActiva === false && !autoVozRef.current) {
      autoVozRef.current = true;
      post({ action: 'usar' }).then(() => { avisarCambioDeVoz(); return cargar(); }).catch(() => {});
    }
    if (info?.estado !== 'conectado') autoVozRef.current = false;
  }, [info?.estado, info?.esVozActiva, cargar]);

  const conectar = async () => {
    setBusy(true); setFlash(null);
    try {
      const j = await post({ action: 'conectar' });
      const b64 = (j.qr as { base64?: string } | undefined)?.base64;
      if (j.ok && b64) { setQr(dataUrl(b64)); await sondear('canal'); }
      else setFlash({ txt: (j.error as string) || 'No se pudo generar el QR', error: true });
    } catch {
      // Una respuesta que no es JSON (un timeout de la plataforma) tiraba acá y el
      // botón volvía a su lugar sin decir nada: el «le di y no pasó nada».
      setFlash({ txt: 'El servidor no respondió. Reintenta en unos segundos.', error: true });
    } finally { setBusy(false); }
  };
  // «Volver a comprobar» dice qué pasó: un botón que vuelve al mismo estado sin ninguna señal se
  // lee como roto (segunda revisión del 11/09/2026).
  const comprobar = async () => {
    setComprobando(true); setFlash(null);
    const antes = info?.estado;
    try {
      const j = await (await fetch('/api/admin/mako-canal?parte=canal')).json();
      if (!j.ok) setFlash({ txt: 'No pude consultar el servidor.', error: true });
      else {
        setInfo({ estado: j.estado, numero: j.numero, perfil: j.perfil, esVozActiva: j.esVozActiva });
        if (j.estado === antes) setFlash({ txt: `Sigue sin confirmar · ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`, error: true });
      }
    } catch {
      setFlash({ txt: 'No pude consultar el servidor.', error: true });
    } finally { setComprobando(false); onCambio?.(); }
  };
  const desconectar = async () => {
    setBusy(true);
    try { await post({ action: 'desconectar' }); setQr(null); await cargar(); }
    catch { setFlash({ txt: 'El servidor no respondió.', error: true }); }
    finally { setBusy(false); }
  };

  // ── Cambiar el número de MaKo ──
  const vincularNuevo = async () => {
    setBusy(true); setFlash(null); setMudanza(null);
    try {
      const j = await post({ action: 'nuevo-numero' });
      const b64 = (j.qr as { base64?: string } | undefined)?.base64;
      if (j.ok && b64) setQrNuevo(dataUrl(b64));
      else if (!j.ok) setFlash({ txt: (j.error as string) || 'No se pudo generar el QR', error: true });
      await sondear('nuevo');
    } catch {
      setFlash({ txt: 'El servidor no respondió. Reintenta en unos segundos.', error: true });
    } finally { setBusy(false); }
  };
  const descartarNuevo = async () => {
    setBusy(true);
    try { await post({ action: 'descartar-nuevo' }); setQrNuevo(null); setMudanza(null); setNuevo(null); }
    catch { setFlash({ txt: 'El servidor no respondió.', error: true }); }
    finally { setBusy(false); }
  };
  const pasar = async (forzar = false) => {
    setPasando(true); setMudanza(null); setFlash(null);
    try {
      // La ruta tiene 300 s: el corte del navegador va un poco después, o un timeout de acá
      // diría «falló» sobre una mudanza que el server sigue haciendo.
      const j = (await post({ action: 'pasar', forzar }, 305_000)) as Mudanza;
      setMudanza(j);
      if (j.ok) { avisarCambioDeVoz(); await cargar(); }
    } catch {
      setMudanza({ ok: false, error: 'El servidor no respondió. Recarga para ver cómo quedó.' });
    } finally { setPasando(false); }
  };

  // ── Tu número ──
  const vincularPersonal = async () => {
    setBusy(true); setFlashPersonal(null);
    try {
      const j = await post({ action: 'personal' });
      const b64 = (j.qr as { base64?: string } | undefined)?.base64;
      if (j.ok && b64) { setQrPersonal(dataUrl(b64)); await sondear('personal'); }
      else setFlashPersonal({ txt: (j.error as string) || 'No se pudo generar el QR', error: true });
    } catch {
      setFlashPersonal({ txt: 'El servidor no respondió. Reintenta en unos segundos.', error: true });
    } finally { setBusy(false); }
  };

  if (info === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
        <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
        <span style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--accent-soft)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
      </div>
    );
  }
  const estado = info.estado;
  // Con un QR en pantalla, un sondeo que no contestó no cambia nada: se sigue esperando el
  // escaneo, y «Regenerar QR» tiene que seguir a mano.
  const sinConfirmar = estado === 'sin_confirmar' && !qr;
  const nuevoListo = nuevo?.estado === 'conectado';
  const cambiando = !!qrNuevo || !!nuevo || (!!mudanza && !mudanza.ok);
  const fallaron = (mudanza?.pasos ?? []).filter((p) => !p.listo);
  const personalConectado = personal?.estado === 'conectado';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── MaKo ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={rotulo}>MaKo</span>
        <Fila estado={qr && estado === 'sin_confirmar' ? 'conectando' : estado} numero={info.numero} perfil={info.perfil} />

        {/* «No pude comprobarlo» no es una caída, pero tampoco una garantía: no se afirma que la
            línea esté bien ni se ofrece reconectarla a ciegas, porque re-escanear la tumba. */}
        {sinConfirmar && (
          <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
            No pude comprobar la línea en este momento. No sé si está caída: no la reconectes a ciegas; vuelve a comprobar en un minuto.
          </div>
        )}

        {qr && <Qr src={qr} pie={<>WhatsApp del teléfono <b>de MaKo</b> → <b>Dispositivos vinculados</b> → <b>Vincular</b> y escanea.</>} />}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {sinConfirmar && <button style={{ ...btnGhost, opacity: comprobando ? 0.5 : 1 }} disabled={comprobando} onClick={comprobar}>{comprobando ? 'Comprobando…' : 'Volver a comprobar'}</button>}
          {estado !== 'conectado' && !sinConfirmar && <button style={{ ...btn, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={conectar}>{busy ? 'Generando…' : qr ? 'Regenerar QR' : 'Conectar por QR'}</button>}
          {estado === 'conectado' && !cambiando && <button style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={vincularNuevo}>Cambiar número</button>}
          {estado === 'conectado' && !cambiando && <button style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={desconectar}>Desconectar</button>}
          {flash && <span style={{ fontSize: 13, fontWeight: 600, color: flash.error ? 'var(--bad)' : 'var(--good)' }}>{flash.txt}</span>}
        </div>

        {/* El número nuevo: se vincula sin tocar el que está hablando. */}
        {cambiando && !mudanza?.ok && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
            {qrNuevo && !nuevoListo && <Qr src={qrNuevo} pie={<>Escanéalo con el WhatsApp del <b>número nuevo</b> de MaKo.</>} />}
            {nuevo && (qrNuevo ? nuevoListo : true) && <Fila estado={nuevo.estado} numero={nuevo.numero} perfil={nuevo.perfil} etiqueta={nuevoListo ? 'Número nuevo' : undefined} />}

            {pasando ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--dim)' }}>
                <Giro /> Sumándolo a tus grupos… tarda ~1 minuto.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {nuevoListo && !fallaron.length && <button style={btn} onClick={() => pasar(false)}>Pasar MaKo a este número</button>}
                {!nuevoListo && !qrNuevo && <button style={{ ...btn, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={vincularNuevo}>{busy ? 'Generando…' : 'Mostrar QR'}</button>}
                {qrNuevo && !nuevoListo && <button style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={vincularNuevo}>Regenerar QR</button>}
                <button style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={descartarNuevo}>{nuevo ? 'Descartar' : 'Cancelar'}</button>
              </div>
            )}
            {nuevoListo && !pasando && !mudanza && <div style={{ fontSize: 12, color: 'var(--faint)' }}>Lo sumo como admin a tus grupos.</div>}

            {mudanza && !mudanza.ok && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bad)' }}>{mudanza.error}</div>
                {(mudanza.pasos ?? []).map((p) => (
                  <div key={p.jid} style={{ fontSize: 12.5, lineHeight: 1.4, color: p.listo ? 'var(--dim)' : 'var(--ink)' }}>
                    {p.listo ? '✓' : '✗'} {p.nombre}{p.motivo ? <span style={{ color: 'var(--dim)' }}> — {p.motivo}</span> : null}
                  </div>
                ))}
                {!pasando && (
                  <>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button style={btn} onClick={() => pasar(false)}>Reintentar</button>
                      {nuevoListo && <button style={btnGhost} onClick={() => pasar(true)}>Pasar igual</button>}
                    </div>
                    {nuevoListo && <div style={{ fontSize: 12, color: 'var(--ink)' }}>Pasando igual, MaKo no habla donde falló hasta que lo sumes.</div>}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {mudanza?.ok && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--good)' }}>
            MaKo ya habla desde +{mudanza.numero} ✓
          </div>
        )}

        <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>Usa un número <b>exclusivo</b> para MaKo (no tu personal).</div>
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      {/* ── Tu número ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={rotulo}>Tu número</span>
        {personal === null ? (
          <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>No pude leer tu línea.</div>
        ) : (
          <Fila estado={personal.estado} numero={personal.numero} perfil={personal.perfil} etiqueta={!personal.linea ? 'Sin vincular' : undefined} />
        )}
        {qrPersonal && <Qr src={qrPersonal} pie={<>Escanéalo con <b>tu WhatsApp personal</b>.</>} />}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {personal !== null && !personalConectado && (
            <button style={{ ...btn, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={vincularPersonal}>{qrPersonal ? 'Regenerar QR' : 'Vincular por QR'}</button>
          )}
          {flashPersonal && <span style={{ fontSize: 13, fontWeight: 600, color: flashPersonal.error ? 'var(--bad)' : 'var(--good)' }}>{flashPersonal.txt}</span>}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>Para tus clientes. Lo ves en WhatsApp.</div>
      </div>
    </div>
  );
}
