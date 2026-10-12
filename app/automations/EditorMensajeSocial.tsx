'use client';

// =============================================================================
// EditorMensajeSocial — el editor de las tarjetas INSTAGRAM y MESSENGER
// =============================================================================
// Pedido de Martín (09/10/2026, sexta tanda, CRON 5), textual: «crear el "+" de Instagram, con su
// diseño personalizado, así como hicimos el de WhatsApp y Email. Que tenga sus colores y que la
// interfaz editable y "probar" se parezcan a Instagram. Aquí puedes copiar muchas funcionalidades de
// lo que ya hicimos con WhatsApp, ya que Instagram permite casi lo mismo que WhatsApp como chat. Copia
// la logica, que se envie un mensaje y se pueda editar luego...». Y CRON 7: lo mismo para Messenger.
//
// LA LÓGICA ES LA DEL EDITOR DE WHATSAPP (app/automations/EditorMensajeWhatsApp.tsx), con sus mismas
// piezas puras: la barra es un BORRADOR, «Enviar» suma la burbuja y vacía la barra; cada burbuja tiene
// su ✏️ (vuelve a la barra y «Enviar» la devuelve a SU lugar) y su papelera roja con «Deshacer» 5 s; el
// mensaje es la lista de partes (`partes`, lib/mensaje-partes.ts) que el motor manda en orden.
//
// LO QUE NO TIENE, a propósito (lib/canal-social.ts):
//   · NOTA DE VOZ: Instagram rechaza el OGG/Opus y el MP3 de la biblioteca de WhatsApp.
//   · «✦ MaKo»: el motor reescribe un texto sólo por el WhatsApp no oficial.
//   · Un archivo de cualquier tipo: Instagram toma foto, video o PDF (`problemaDeAdjunto`).
//
// ARRIBA, LA CUENTA DESDE LA QUE SALE (como el número de salida del de WhatsApp), con «Conectar» si
// no hay ninguna (POST /api/zernio). ⚠️ NADA DE ACÁ PUBLICA: `onChange` es un cambio LOCAL; lo único
// que escribe en el server es la biblioteca de archivos (un archivo nuevo), igual que el de WhatsApp.

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { PasoSecuenciaDto } from './ChatAgentApp';
import { useWs } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { PopoverWA, MenuWA, type OpcionMenuWA } from '../whatsapp/_shared/ComposerWhatsApp';
import { IconClip, IconDoc } from '../whatsapp/_shared/composer-icons';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { ArbolDeDatos } from '@/app/_components/SelectorDatos';
import { CampoConDatos, type CampoConDatosHandle } from '@/app/_components/CampoConDatos';
import { subirConProgreso } from '../customer-success/curso/subir-video';
import { partesDeLaBarra, enviarALista, mismoPaso, datosDelLead } from './EditorMensajeWhatsApp';
import { aplicarVariables } from '@/lib/template-vars';
import { cambiosDePaso } from '@/lib/guion-audio';
import { partesDe, formaGuardada, esUnTexto, TOPE_PARTES, type ParteMensaje } from '@/lib/mensaje-partes';
import { validarArchivoWA, archivoConTipoWA, tituloDeArchivo, pesoLegible, type AdjuntoDto } from '@/lib/setting-adjuntos-reglas';
import { IDENTIDAD_SOCIAL, NOMBRE_CANAL, problemaDeAdjunto, plataformaDe, TOPE_TEXTO_SOCIAL, type CanalSocial } from '@/lib/canal-social';
import { BurbujaSocial, ArchivoSocial, CabeceraSocial, LogoSocial } from './social-ui';
// «Conectar» AHÍ MISMO (décima tanda, GENERAL 6): el OAuth de Zernio en una ventana emergente y el sondeo de la
// cuenta, en el modal de la tab (antes se abría una pestaña nueva y el editor no se enteraba de la vuelta).
import { ConectarMedio, useAlConectarMedio } from './ConectarMedio';

export type EditorMensajeSocialProps = {
  paso: PasoSecuenciaDto;
  canal: CanalSocial;
  /** Cambio LOCAL: nunca publica (sólo «Publicar» publica). */
  onChange: (patch: Partial<PasoSecuenciaDto>) => void;
  negocio?: string;
  /** La biblioteca de archivos, si el lienzo ya la tiene. Sin esto, el editor la pide sola. */
  adjuntos?: AdjuntoDto[];
  onAdjuntoNuevo?: (a: AdjuntoDto) => void;
  deshabilitado?: boolean;
  onError?: (m: string) => void;
};

/** Lo que dice la cuenta de salida (POST /api/zernio). `null` = todavía no llegó. */
type Cuenta = { estado: 'ok'; cuentas: Array<{ id: string; usuario: string; nombre: string }> } | { estado: 'sin_zernio' } | { estado: 'error'; error: string };

/** El borrador de la barra por tarjeta (como el de WhatsApp): tocar otra no lo tira. */
const borradores = new Map<string, string>();
/** La cuenta se pide UNA vez por pestaña, negocio y plataforma (10 min). */
const cacheCuenta = new Map<string, { t: number; v: Cuenta }>();
const cacheBiblioteca = new Map<string, { t: number; lista: AdjuntoDto[] }>();
const CACHE_MS = 10 * 60_000;

const accionBurbuja: CSSProperties = { width: 28, height: 28, flex: 'none', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 };
const iconoBarra: CSSProperties = { flex: 'none', width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 };

function IconLapiz() {
  return <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" /><path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth={1.8} /></svg>;
}
function IconEnviar() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 21 3l-8.5 18-2.2-7.3L3 11.5Z" fill="currentColor" /></svg>;
}

export function EditorMensajeSocial({ paso, canal, onChange, negocio, adjuntos, onAdjuntoNuevo, deshabilitado, onError }: EditorMensajeSocialProps) {
  const ws = useWs();
  const ident = IDENTIDAD_SOCIAL[canal];
  const nombreCanal = NOMBRE_CANAL[canal];
  const clavePaso = `${paso.id ?? ''}|${paso.orden}`;
  const claveBorrador = `${ws ?? ''}|${canal}|${clavePaso}`;
  const [barra, setBarra] = useState(() => borradores.get(claveBorrador) ?? '');
  const [adjunto, setAdjunto] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<'datos' | 'clip' | null>(null);
  const [btnDatos, setBtnDatos] = useState<HTMLButtonElement | null>(null);
  const [btnClip, setBtnClip] = useState<HTMLButtonElement | null>(null);
  const [subida, setSubida] = useState<{ nombre: string; pct: number; cancelar: () => void } | null>(null);
  const [bibLocal, setBibLocal] = useState<AdjuntoDto[] | null>(() => cacheBiblioteca.get(String(ws ?? ''))?.lista ?? null);
  const [cuenta, setCuenta] = useState<Cuenta | null>(() => cacheCuenta.get(`${ws ?? ''}|${canal}`)?.v ?? null);
  /** El modal de «Conectar» abierto (ConectarMedio). */
  const [conectando, setConectando] = useState(false);
  /** Sube cuando algo se conectó (acá o en otra pantalla de la tab): la cuenta se vuelve a pedir. */
  const [vueltaCuenta, setVueltaCuenta] = useState(0);
  useAlConectarMedio(() => { cacheCuenta.delete(`${ws ?? ''}|${canal}`); setVueltaCuenta((v) => v + 1); });
  const { toast, show, clear } = useToast();
  const area = useRef<HTMLTextAreaElement | null>(null);
  /** Los `{{datos}}` azules y clickeables de la barra (undécima tanda, punto 7). */
  const campoDatos = useRef<CampoConDatosHandle | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const pasoVivo = useRef(paso);
  useEffect(() => { pasoVivo.current = paso; }, [paso]);
  const cancelarSubida = useRef<(() => void) | null>(null);
  useEffect(() => () => { cancelarSubida.current?.(); }, []);

  // El lienzo reusa este editor para otro nodo: lo del anterior no se queda dibujado acá.
  const [claveVista, setClaveVista] = useState(clavePaso);
  if (claveVista !== clavePaso) {
    setClaveVista(clavePaso);
    setError(null); setAbierto(null); setAdjunto(null); setEditando(null);
    setBarra(borradores.get(claveBorrador) ?? '');
  }

  // ── La cuenta de salida ──
  useEffect(() => {
    const clave = `${ws ?? ''}|${canal}`;
    const c = cacheCuenta.get(clave);
    if (c && Date.now() - c.t < CACHE_MS) return;
    let vivo = true;
    fetch('/api/zernio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'estado', plataforma: plataformaDe(canal) }), signal: AbortSignal.timeout(65_000) })
      .then((r) => r.json())
      .then((j: { ok?: boolean; configurado?: boolean; cuentas?: Array<{ id: string; usuario: string; nombre: string }>; error?: string }) => {
        const v: Cuenta = !j?.ok ? { estado: 'error', error: j?.error ?? 'Zernio no contestó' } : j.configurado === false ? { estado: 'sin_zernio' } : { estado: 'ok', cuentas: j.cuentas ?? [] };
        if (v.estado !== 'error') cacheCuenta.set(clave, { t: Date.now(), v });
        if (vivo) setCuenta(v);
      })
      .catch(() => { if (vivo) setCuenta({ estado: 'error', error: 'Sin conexión' }); });
    return () => { vivo = false; };
  }, [ws, canal, vueltaCuenta]);

  // (Acá vivía `conectar`: pedía la URL del OAuth y la abría en una pestaña nueva con `noopener`, sin forma de
  // saber cuándo volvía. Desde la décima tanda lo hace el modal de la tab, ConectarMedio.)

  // ── La biblioteca de archivos (la misma del WhatsApp) ──
  const biblioteca = adjuntos ?? bibLocal;
  useEffect(() => {
    if (adjuntos) return;
    const clave = String(ws ?? '');
    const c = cacheBiblioteca.get(clave);
    if (c && Date.now() - c.t < CACHE_MS) return;
    let vivo = true;
    fetch('/api/chat-agent/adjuntos', { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
      .then((r) => r.json())
      .then((j: { ok?: boolean; adjuntos?: AdjuntoDto[] }) => {
        const lista = j?.ok && Array.isArray(j.adjuntos) ? j.adjuntos : [];
        if (j?.ok) cacheBiblioteca.set(clave, { t: Date.now(), lista });
        if (vivo) setBibLocal(lista);
      })
      .catch(() => { if (vivo) setBibLocal((b) => b ?? []); });
    return () => { vivo = false; };
  }, [adjuntos, ws]);
  const archivoDe = (id: number) => (biblioteca ?? []).find((a) => a.id === id) ?? null;
  const elegibles = (biblioteca ?? []).filter((a) => !problemaDeAdjunto(canal, a.media_mime));

  const avisar = (m: string) => { setError(m); onError?.(m); };
  const escribir = (v: string) => {
    setBarra(v);
    if (v) borradores.set(claveBorrador, v); else borradores.delete(claveBorrador);
  };
  const limpiarBarra = () => { escribir(''); setAdjunto(null); setEditando(null); };

  // ── El mensaje es la lista de partes (como en WhatsApp) ──
  const partes = partesDe(paso);
  const aplicarPartes = (lista: readonly ParteMensaje[]) => {
    const antes = pasoVivo.current;
    const f = formaGuardada(lista);
    const despues: PasoSecuenciaDto = {
      ...antes, tipo: f.tipo, cuerpo: f.cuerpo, audio_id: f.audio_id, media_id: f.media_id, partes: f.partes,
      ...(esUnTexto(lista) ? {} : { variantes: [] }),
    };
    onChange(cambiosDePaso(antes, despues));
  };

  const enviar = () => {
    const nuevas = partesDeLaBarra(barra, adjunto != null ? { tipo: 'media', media_id: adjunto } : null);
    if (!nuevas.length) return;
    if (barra.length > TOPE_TEXTO_SOCIAL) { avisar(`Hasta ${TOPE_TEXTO_SOCIAL} caracteres`); return; }
    const sig = enviarALista(partesDe(pasoVivo.current), nuevas, editando);
    if (sig.length > TOPE_PARTES) { avisar(`Hasta ${TOPE_PARTES} mensajes`); return; }
    setError(null);
    aplicarPartes(sig);
    limpiarBarra();
  };

  const editar = (i: number) => {
    const p = partes[i];
    if (!p) return;
    if ((barra.trim() || adjunto != null) && editando !== i) { avisar('Primero envía lo escrito'); return; }
    setError(null);
    setEditando(i);
    if (p.tipo === 'texto') { setAdjunto(null); escribir(p.cuerpo); }
    else if (p.tipo === 'media') { setAdjunto(p.media_id); escribir(p.cuerpo ?? ''); }
    area.current?.focus();
  };

  const borrar = (i: number) => {
    const antes = partesDe(pasoVivo.current);
    if (!antes[i]) return;
    const deQuien = pasoVivo.current;
    aplicarPartes(antes.filter((_, j) => j !== i));
    if (editando === i) limpiarBarra();
    else if (editando != null && editando > i) setEditando(editando - 1);
    show('Mensaje borrado', () => { if (mismoPaso(pasoVivo.current, deQuien)) aplicarPartes(antes); });
  };

  const onTecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviar(); }
  };

  const insertar = (t: string) => {
    const el = area.current;
    const ini = el ? el.selectionStart : barra.length;
    const fin = el ? el.selectionEnd : barra.length;
    escribir(barra.slice(0, ini) + t + barra.slice(fin));
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(ini + t.length, ini + t.length); } });
  };

  // ── Subir un archivo: directo al bucket y registrado en la biblioteca (el camino del de WhatsApp) ──
  async function subirArchivo(f: File) {
    setError(null);
    const v = validarArchivoWA({ nombre: f.name, tipo: f.type, tamano: f.size });
    if (!v.ok) { avisar(v.error); return; }
    const problema = problemaDeAdjunto(canal, v.mime);
    if (problema) { avisar(problema); return; }
    const deQuien = pasoVivo.current;
    const post = async (body: object) => {
      const r = await fetch('/api/chat-agent/adjuntos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(65_000) });
      return r.json().catch(() => null) as Promise<{ ok?: boolean; error?: string; path?: string; signedUrl?: string; apikey?: string | null; adjunto?: AdjuntoDto } | null>;
    };
    try {
      const firma = await post({ action: 'subir', nombre: f.name, mime: v.mime, tamano: f.size });
      if (!firma?.ok || !firma.signedUrl || !firma.path) { avisar(firma?.error || 'No se pudo preparar la subida.'); return; }
      const s = subirConProgreso(firma.signedUrl, archivoConTipoWA(f, v.mime), firma.apikey ?? null, (pct) => setSubida((x) => (x ? { ...x, pct } : x)), 'JPG, PNG, MP4 o PDF');
      cancelarSubida.current = s.cancelar;
      setSubida({ nombre: f.name, pct: 0, cancelar: s.cancelar });
      await s.promesa;
      const reg = await post({ action: 'registrar', path: firma.path, nombre: f.name, titulo: tituloDeArchivo(f.name) });
      if (!reg?.ok || !reg.adjunto) { avisar(reg?.error || 'No se pudo guardar el archivo.'); return; }
      const adj = reg.adjunto;
      const lista = [adj, ...(biblioteca ?? []).filter((a) => a.id !== adj.id)];
      cacheBiblioteca.set(String(ws ?? ''), { t: Date.now(), lista });
      setBibLocal(lista);
      onAdjuntoNuevo?.(adj);
      if (mismoPaso(pasoVivo.current, deQuien)) setAdjunto(adj.id);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo subir el archivo.');
    } finally {
      cancelarSubida.current = null;
      setSubida(null);
    }
  }

  const conNegocio = (t: string) => aplicarVariables(t, negocio?.trim() ? { negocio: negocio.trim() } : {});
  const ocupado = !!deshabilitado || !!subida;
  // EL «{ }» DE LA CASA (el árbol, como en WhatsApp y el email), con lo que el motor resuelve POR ESTE
  // CANAL: `enviarPasoSocial` (lib/nutricion.ts) recibe lo que arma `datosParaElLead`, el catálogo
  // entero, como el WhatsApp no oficial (integración de la segunda pasada).
  const datos = datosDelLead(true);

  const burbujaDe = (p: ParteMensaje): ReactNode => {
    if (p.tipo === 'media') {
      const adj = archivoDe(p.media_id);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <ArchivoSocial canal={canal} url={adj?.url ?? null} mime={adj?.media_mime ?? null} nombre={adj?.nombre_archivo ?? adj?.titulo ?? (biblioteca === null ? 'Cargando…' : 'Archivo')} />
          {p.cuerpo?.trim() && <BurbujaSocial canal={canal}>{conNegocio(p.cuerpo)}</BurbujaSocial>}
        </div>
      );
    }
    if (p.tipo === 'audio') return <span style={{ fontSize: 12.5, color: 'var(--warn)' }}>Nota de voz: no sale por {nombreCanal}</span>;
    return <BurbujaSocial canal={canal}>{conNegocio(p.cuerpo)}</BurbujaSocial>;
  };

  // ── La cuenta, arriba (como el número de salida del WhatsApp) ──
  const usuario = cuenta?.estado === 'ok' ? cuenta.cuentas[0] : null;
  const filaCuenta = (
    <CabeceraSocial canal={canal}
      nombre={usuario ? `@${usuario.usuario}` : cuenta === null ? 'Cargando…' : cuenta.estado === 'sin_zernio' ? 'Sin Zernio' : cuenta.estado === 'error' ? cuenta.error : `Sin cuenta de ${nombreCanal}`}
      detalle={usuario && usuario.nombre !== usuario.usuario ? usuario.nombre : undefined}
      derecha={(
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {cuenta?.estado === 'ok' && !usuario && (
            <button type="button" onClick={() => setConectando(true)} disabled={conectando || ocupado} aria-haspopup="dialog"
              style={{ height: 28, padding: '0 12px', borderRadius: 14, border: 'none', background: ident.burbuja, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Conectar
            </button>
          )}
          <LogoSocial canal={canal} size={22} />
        </span>
      )} />
  );

  const vista = partes.length ? partes.map((p, i) => (
    <div key={i} data-parte={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, alignSelf: 'stretch', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
        <button type="button" disabled={ocupado} onClick={() => editar(i)} title="Editar" aria-label={`Editar el mensaje ${i + 1}`}
          style={{ ...accionBurbuja, ...(editando === i ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}) }}><IconLapiz /></button>
        <button type="button" disabled={ocupado} onClick={() => borrar(i)} title="Borrar" aria-label={`Borrar el mensaje ${i + 1}`}
          style={{ ...accionBurbuja, color: 'var(--bad)', borderColor: 'var(--bad)' }}><IconoBorrar size={16} /></button>
      </div>
      <div style={{ minWidth: 0, display: 'flex', justifyContent: 'flex-end', borderRadius: 20, outline: editando === i ? '2px solid var(--primary)' : 'none', outlineOffset: 2 }}>
        {burbujaDe(p)}
      </div>
    </div>
  )) : <span style={{ color: 'var(--faint)', fontSize: 13 }}>Sin escribir</span>;

  const adj = adjunto != null ? archivoDe(adjunto) : null;
  const chip = subida
    ? { titulo: subida.nombre, detalle: `Subiendo ${subida.pct}%`, quitar: subida.cancelar }
    : adjunto != null ? { titulo: adj?.titulo ?? 'Archivo', detalle: pesoLegible(adj?.tamano), quitar: () => setAdjunto(null) } : null;

  const menuClip: OpcionMenuWA[] = [
    { key: 'subir', label: 'Subir foto, video o PDF', icono: <IconClip />, onElegir: () => inputArchivo.current?.click() },
    {
      key: 'archivos', label: 'Archivos guardados', icono: <IconDoc size={18} />, vacio: biblioteca === null ? 'Cargando…' : 'Sin archivos todavía.',
      submenu: elegibles.map((a) => ({ key: `f${a.id}`, label: a.titulo, icono: <IconDoc size={18} />, detalle: pesoLegible(a.tamano), onElegir: () => setAdjunto(a.id) })),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, minWidth: 0, border: `1px solid ${ident.borde}`, borderRadius: 16, overflow: 'hidden', background: 'var(--surface)' }}>
      {filaCuenta}
      <div data-chat style={{ flex: '1 1 auto', minHeight: 110, padding: 12, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--surface)' }}>
        {/* `marginTop: auto` y no `justify-content: flex-end`: con flex-end y scroll, lo que desborda por arriba no se alcanza. */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>{vista}</div>
      </div>
      {editando != null && (
        <div style={{ flex: 'none', padding: '6px 12px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <IconLapiz /> <span style={{ flex: 1 }}>Editando</span>
          <button type="button" onClick={limpiarBarra} aria-label="Cancelar edición" title="Cancelar" style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
        </div>
      )}
      {error && <div role="alert" style={{ flex: 'none', padding: '6px 12px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--bad)' }}>{error}</div>}
      {chip && (
        <div style={{ flex: 'none', margin: '0 10px 6px', padding: '6px 10px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
          <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: 'var(--ink)' }}>{chip.titulo}</span>
          {chip.detalle && <span style={{ flex: 'none', color: 'var(--dim)' }}>{chip.detalle}</span>}
          <button type="button" onClick={chip.quitar} aria-label="Quitar archivo" title="Quitar" style={{ flex: 'none', background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
        </div>
      )}
      {/* LA BARRA, como la de un DM: una píldora con el clip, «{ }» y la flecha del color de la app. */}
      <div data-barra style={{ flex: 'none', display: 'flex', alignItems: 'flex-end', gap: 4, margin: '0 10px 10px', padding: '4px 6px', borderRadius: 22, border: '1px solid var(--border-strong)', background: 'var(--surface)' }}>
        <button type="button" ref={setBtnClip} disabled={ocupado} title="Adjuntar" aria-label="Adjuntar" aria-expanded={abierto === 'clip'}
          onClick={() => setAbierto((a) => (a === 'clip' ? null : 'clip'))} style={iconoBarra}><IconClip /></button>
        <button type="button" ref={setBtnDatos} disabled={ocupado} title="Insertar un dato" aria-label="Insertar un dato" aria-expanded={abierto === 'datos'}
          onClick={() => { if (abierto !== 'datos' && campoDatos.current?.abrirDatoEnCursor()) return; setAbierto((a) => (a === 'datos' ? null : 'datos')); }}
          style={{ ...iconoBarra, fontSize: 13, fontWeight: 600, fontFamily: "'Geist Mono', monospace", color: abierto === 'datos' ? 'var(--primary)' : 'var(--dim)' }}>{'{ }'}</button>
        <CampoConDatos ref={campoDatos} datos={datos} onValor={escribir} estiloCaja={{ flex: 1, minWidth: 0 }}>
        <textarea ref={area} value={barra} rows={1} disabled={ocupado} aria-label={`Mensaje de ${nombreCanal}`}
          placeholder={adjunto != null ? 'Agrega un texto (opcional)' : 'Mensaje…'}
          onChange={(e) => escribir(e.target.value)} onKeyDown={onTecla}
          style={{ flex: 1, minWidth: 0, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 14, lineHeight: 1.4, padding: '7px 4px', maxHeight: 120, fieldSizing: 'content' } as CSSProperties} />
        </CampoConDatos>
        <button type="button" onClick={enviar} disabled={ocupado || (!barra.trim() && adjunto == null)} title="Enviar" aria-label="Enviar"
          style={{ ...iconoBarra, color: canal === 'instagram' ? '#5B51D8' : '#0084FF', opacity: (!barra.trim() && adjunto == null) ? 0.4 : 1 }}><IconEnviar /></button>
      </div>

      <input ref={inputArchivo} type="file" accept="image/jpeg,image/png,video/mp4,application/pdf,.jpg,.jpeg,.png,.mp4,.pdf" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) void subirArchivo(f); }} />

      {abierto === 'datos' && (
        <PopoverWA ancla={btnDatos} etiqueta="Datos" onCerrar={() => setAbierto(null)}>
          <ArbolDeDatos grupos={datos} onElegir={(k) => { insertar(`{{${k}}}`); setAbierto(null); }} />
        </PopoverWA>
      )}
      {abierto === 'clip' && (
        <PopoverWA ancla={btnClip} etiqueta="Adjuntar" onCerrar={() => setAbierto(null)}>
          <MenuWA alElegir={() => setAbierto(null)} opciones={menuClip} />
        </PopoverWA>
      )}
      <Toast state={toast} onClose={clear} />
      {conectando && <ConectarMedio medio={canal} onCerrar={() => setConectando(false)} onConectado={() => setConectando(false)} />}
    </div>
  );
}
