'use client';

// =============================================================================
// VozAIStep — «Tu voz» de un AI Step que contesta en audio, y clonarla ahí mismo (AI Step v2, décima tanda)
// =============================================================================
// Pedido de Martín (11/10/2026, FEEDBACK AI STEP 1): «Agrega la opción de responder con audios... Y si la
// persona aún no clonó su voz, que se lo permita clonar con el proceso allí mismo. O si quiere agregar una
// nueva voz». El diseño, en docs/diseno-ai-step-v2.md §5.
//
//   · El desplegable: «Tu voz» (el clon de `video.voz`) + las otras voces + «＋ Clonar tu voz» / «＋ Otra voz».
//     Se guarda 'propia' (se resuelve al clon VIGENTE al mandar: re-clonar no deja tarjetas viejas) o el
//     voiceId de otra.
//   · Clonar es un modal SOBRE el panel con la ruta que ya existe (/api/onboarding/voz): subir o grabar las
//     muestras, el tilde de autorización (sin él no se clona: la regla de voz-cliente) y, para otra voz, su
//     nombre y SÓLO sus muestras (`destino: 'otra'`). Sin key de ElevenLabs lo dice, con su link, sin salir.
//   · «Escuchar» dice un texto de prueba con la misma partición y el mismo tope que el motor (la ruta
//     /api/automations/ai-step/voz). Gasta caracteres del cliente: sólo cuando la persona aprieta.
//
// ⚠️ ESTE ARCHIVO NO GUARDA LA TARJETA: la voz elegida sube por `onVoz` (el editor la pone en el caso).

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Button, Checkbox } from '@/app/_ui';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { inpLienzo } from '@/app/_components/Lienzo';
import { useVoiceRecorder } from '@/app/whatsapp/_shared/VoiceRecorder';
import Link from '@/app/_ui/Link';

const SANS = "'Geist', sans-serif";
const CLONAR_PROPIA = '__clonar_propia';
const OTRA_VOZ = '__otra_voz';

type Voces = { propia: { nombre: string } | null; otras: Array<{ voiceId: string; nombre: string }>; hayKey: boolean };

/** Las voces del negocio (GET /api/automations/ai-step/voz). null = leyendo; 'error' = no se pudo leer. */
function useVoces(): [Voces | null | 'error', () => void] {
  const [v, setV] = useState<Voces | null | 'error'>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const j = await (await fetch('/api/automations/ai-step/voz', { cache: 'no-store' })).json();
        if (vivo) setV(j?.ok ? { propia: j.propia ?? null, otras: Array.isArray(j.otras) ? j.otras : [], hayKey: j.hayKey === true } : 'error');
      } catch { if (vivo) setV('error'); }
    })();
    return () => { vivo = false; };
  }, [n]);
  return [v, () => setN((x) => x + 1)];
}

export function VozAIStep({ voz, onVoz, deshabilitado, textoPrueba }: {
  /** La voz del caso: 'propia', un voiceId, o null (todavía sin elegir). */
  voz: string | null;
  onVoz: (v: string) => void;
  deshabilitado: boolean;
  /** Lo que dice «Escuchar»: la guía del caso o una frase de prueba. */
  textoPrueba: string;
}) {
  const [voces, releer] = useVoces();
  const [clonar, setClonar] = useState<null | 'propia' | 'otra'>(null);
  const [escuchando, setEscuchando] = useState<'cargando' | 'sonando' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const v = voces && voces !== 'error' ? voces : null;
  const opciones: DropdownOption[] = [
    ...(v?.propia ? [{ value: 'propia', label: 'Tu voz', sub: v.propia.nombre, avatar: null }] : []),
    ...(v?.otras ?? []).map((o) => ({ value: o.voiceId, label: o.nombre, avatar: null })),
    { value: CLONAR_PROPIA, label: v?.propia ? 'Volver a clonar tu voz' : 'Clonar tu voz', crear: true },
    { value: OTRA_VOZ, label: 'Otra voz', crear: true },
  ];
  const nombreActual = voz === 'propia' ? (v?.propia ? 'Tu voz' : null) : (v?.otras.find((o) => o.voiceId === voz)?.nombre ?? null);
  // «Tu voz» sin clon todavía: se dice y se ofrece clonarla (no es «una voz que ya no está»).
  const sinClon = voz === 'propia' && v != null && !v.propia;
  const perdida = voz != null && voz !== 'propia' && v != null && !nombreActual;

  const escuchar = async () => {
    if (!voz || escuchando) return;
    setErr(null); setEscuchando('cargando');
    try {
      const r = await fetch('/api/automations/ai-step/voz', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ voz, texto: textoPrueba }) });
      const j = await r.json();
      if (!j?.ok) { setErr(j?.error ?? 'No se pudo generar.'); setEscuchando(null); return; }
      const a = new Audio(`data:audio/mpeg;base64,${j.audio}`);
      audioRef.current = a;
      a.onended = () => setEscuchando(null);
      setEscuchando('sonando');
      await a.play().catch(() => setEscuchando(null));
    } catch { setErr('No se pudo generar.'); setEscuchando(null); }
  };
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Dropdown value={voz && nombreActual ? voz : ''} options={opciones} width="100%" disabled={deshabilitado || voces === null}
            botonLabel={voces === null ? 'Leyendo tus voces…' : nombreActual ?? (sinClon ? 'Falta clonar tu voz' : perdida ? 'Esa voz ya no está' : 'Elige la voz')}
            ariaLabel="Con qué voz contesta"
            onChange={(x) => {
              if (x === CLONAR_PROPIA) { setClonar('propia'); return; }
              if (x === OTRA_VOZ) { setClonar('otra'); return; }
              onVoz(x);
            }} />
        </div>
        <Button size="sm" variant="secondary" disabled={deshabilitado || !voz || !nombreActual || !textoPrueba.trim() || escuchando === 'cargando'} onClick={() => { void escuchar(); }}>
          {escuchando === 'cargando' ? 'Generando…' : escuchando === 'sonando' ? 'Sonando' : 'Escuchar'}
        </Button>
      </div>
      {voces === 'error' && <span style={{ fontSize: 12, color: 'var(--warn)' }}>No pude leer tus voces.</span>}
      {perdida && <span style={{ fontSize: 12, color: 'var(--warn)' }}>Elige otra voz: ésa ya no está.</span>}
      {sinClon && (
        <span style={{ fontSize: 12, color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Todavía no clonaste tu voz.
          <button type="button" disabled={deshabilitado} onClick={() => setClonar('propia')}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>Clonarla</button>
        </span>
      )}
      {err && <span style={{ fontSize: 12, color: 'var(--bad)' }}>{err}</span>}
      {clonar && typeof document !== 'undefined' && createPortal(
        <ModalClonar destino={clonar} hayKey={v?.hayKey ?? true}
          onCerrar={() => setClonar(null)}
          onListo={(nueva) => { setClonar(null); releer(); onVoz(nueva); }} />,
        document.body,
      )}
    </div>
  );
}

/**
 * CLONAR AHÍ MISMO: subir o grabar las muestras, autorizar y clonar, por /api/onboarding/voz. Para «otra
 * voz», su nombre y SÓLO las muestras que se subieron en este modal (`destino: 'otra'`, `muestras`).
 */
function ModalClonar({ destino, hayKey, onCerrar, onListo }: {
  destino: 'propia' | 'otra'; hayKey: boolean; onCerrar: () => void; onListo: (voz: string) => void;
}) {
  const [subidas, setSubidas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [autorizo, setAutorizo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [busy, setBusy] = useState<null | 'subiendo' | 'clonando'>(null);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // El `onCerrar` de identidad FIJA (AGENTS.md: un `<Modal>` con una flecha nueva por render pierde el foco).
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; });
  const ocupadoRef = useRef(false);
  useEffect(() => { ocupadoRef.current = busy != null; }, [busy]);
  const cerrar = useCallback(() => { if (!ocupadoRef.current) cerrarRef.current(); }, []);

  /** Sube archivos (multipart a la ruta de siempre) y anota los ids NUEVOS: los de esta tanda. */
  const subir = async (archivos: File[]) => {
    if (!archivos.length) return;
    setErr(null); setBusy('subiendo');
    try {
      const antes = await (await fetch('/api/onboarding/voz', { cache: 'no-store' })).json();
      const ya = new Set<string>((antes?.muestras ?? []).map((m: { id: string }) => m.id));
      const fd = new FormData();
      for (const f of archivos) fd.append('file', f);
      const r = await fetch('/api/onboarding/voz', { method: 'POST', body: fd });
      const j = await r.json();
      if (!j?.ok) { setErr(j?.error ?? 'No se pudo subir.'); return; }
      const nuevas = (j.muestras ?? []).filter((m: { id: string }) => !ya.has(m.id)) as Array<{ id: string; nombre: string }>;
      setSubidas((s) => [...s, ...nuevas]);
      if (Array.isArray(j.avisos) && j.avisos.length) setErr(j.avisos.join(' '));
    } catch { setErr('No se pudo subir.'); } finally { setBusy(null); }
  };
  const grabador = useVoiceRecorder(async (blob) => {
    const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
    await subir([new File([blob], `grabacion-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' })]);
  }, (m) => setErr(m));

  const clonarVoz = async () => {
    setErr(null); setBusy('clonando');
    try {
      const r = await fetch('/api/onboarding/voz', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(destino === 'otra'
          ? { action: 'clonar', autorizo, destino: 'otra', nombre: nombre.trim(), muestras: subidas.map((m) => m.id) }
          : { action: 'clonar', autorizo }),
      });
      const j = await r.json();
      if (!j?.ok) { setErr(j?.error ?? 'No se pudo clonar.'); return; }
      onListo(destino === 'otra' ? String(j.voiceId ?? '') : 'propia');
    } catch { setErr('No se pudo clonar.'); } finally { setBusy(null); }
  };

  const listo = autorizo && subidas.length > 0 && (destino === 'propia' || nombre.trim().length > 0) && busy == null;
  const fila: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)' };
  return (
    <Modal titulo={destino === 'otra' ? 'Otra voz' : 'Clonar tu voz'} onCerrar={cerrar} ancho={520}
      pie={(
        <>
          <Button variant="tertiary" onClick={cerrar} disabled={busy != null}>Cancelar</Button>
          <Button onClick={() => { void clonarVoz(); }} disabled={!listo || !hayKey}>{busy === 'clonando' ? 'Clonando…' : 'Clonar'}</Button>
        </>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: SANS }}>
        {!hayKey && (
          <div style={{ fontSize: 13, color: 'var(--warn)', lineHeight: 1.5 }}>
            Falta conectar ElevenLabs. <Link href="/integraciones?servicio=elevenlabs" target="_blank">Conectar ElevenLabs</Link>
          </div>
        )}
        {destino === 'otra' && (
          <input value={nombre} maxLength={60} placeholder="Nombre de la voz" aria-label="Nombre de la voz"
            onChange={(e) => setNombre(e.target.value)} style={inpLienzo} />
        )}
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>1 a 3 audios de esa persona hablando, 30 a 90 s cada uno. Hasta 4 MB por archivo.</div>
        <div style={fila}>
          <Button size="sm" variant="secondary" disabled={busy != null || grabador.recording} onClick={() => inputRef.current?.click()}>Subir audio</Button>
          {grabador.recording
            ? <Button size="sm" onClick={() => grabador.stop(false)}>Parar ({grabador.secs} s)</Button>
            : <Button size="sm" variant="secondary" disabled={busy != null} onClick={() => { void grabador.start(); }}>Grabar</Button>}
          <input ref={inputRef} type="file" accept="audio/*" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; void subir(fs); }} />
          {busy === 'subiendo' && <span style={{ fontSize: 12, color: 'var(--dim)' }}>Subiendo…</span>}
        </div>
        {subidas.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink)' }}>
            {subidas.map((m) => <li key={m.id}>{m.nombre}</li>)}
          </ul>
        )}
        <Checkbox checked={autorizo} onChange={setAutorizo}
          label={destino === 'otra' ? 'Esa persona me autorizó a clonar su voz' : 'Autorizo clonar mi voz'} />
        {err && <div style={{ fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
      </div>
    </Modal>
  );
}
