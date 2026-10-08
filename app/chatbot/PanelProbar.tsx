'use client';

// =============================================================================
// PanelProbar — el teléfono de «Probar», acoplado a la derecha del lienzo
// =============================================================================
// Pedido de Martín (08/10/2026, punto 10), textual: «El botón de probar se rompe, aparece detrás
// de la sidebar y se ve horrible. No tiene la animación de entrada de los mensajes y tampoco puedo
// interactuar, para probarlo de verdad... Y tampoco veo la opción de probarlo realmente, con el
// número o email del usuario... Y para cerrar, un botón de CERRAR, no un "editar"... Y no hace
// falta que ocupe toda la pantalla. Mira como lo hace Manychat».
//
// Molde de ManyChat («Preview»): un teléfono de ~300 px AL LADO del lienzo, que sigue editable;
// ✕ para cerrar y ↻ para reiniciar; una caja para contestar como el contacto; «In messengers»
// manda la prueba a la app de verdad.
//
// Lo que cambió respecto del simulador viejo, cada cosa con su porqué:
//   · NO REEMPLAZA AL LIENZO. Antes «Probar» desmontaba el editor (se perdía lo no publicado) y
//     el chat quedaba debajo de la lista de secuencias, con «Editar» como única salida.
//   · RECORRE EL FLUJO LOCAL con lib/simulador-grafo.ts —la misma navegación que el motor—, no
//     un setter libre: en una condición quien prueba elige la rama; una espera se dice y se
//     sigue; una acción se nombra y no se ejecuta.
//   · ESCRIBIR COMO EL LEAD PAUSA LA SALIDA y corre «Si responde»: el server clasifica contra
//     los casos locales (`clasificarEscenario`, el del motor) y un «MaKo contesta» se redacta con
//     el redactor del motor. Sin «Si responde», MaKo no contesta: lo mismo que va a pasar.
//   · ↻ REINICIA TODO. Antes un cierre dejaba el chat en `readOnly` y ↻ no lo destrababa.
//   · «A MI WHATSAPP / A MI EMAIL»: prendido, cada mensaje que aparece sale DE VERDAD al destino
//     escrito, por la línea de la secuencia (lib/prueba-paso.ts). El destino viene precargado con
//     el contacto del negocio y NO se guarda: ése es el destino de los reportes.
//
// ⚠️ EL TEXTO DE ESTA PIEZA ES CORTO A PROPÓSITO (AGENTS.md, «el texto que se DIBUJA»): una
// píldora son 1-4 palabras. El porqué de cada cosa vive acá, no en la pantalla.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { Switch } from '@/app/_ui';
import { useTitulosAcciones } from '@/app/_components/EditorAccionMako';
import type { AudioSetting, PasoSecuenciaDto, SecuenciaDto } from './ChatAgentApp';
import type { EdicionLocal } from './SecuenciaPerfil';
import { raizRespuesta } from '@/lib/flujo-grafo';
import {
  flujoParaProbar, firmaFlujo, iniciar, siguiente, elegir, pausarPorRespuesta, entrarEnRespuesta,
  escenarioParaRedactar, textoDeEjemplo,
  type EstadoSim, type NombresSim, type OpcionRama, type MensajePrueba,
} from '@/lib/simulador-grafo';

/** El ancho del teléfono. Lo usa quien lo monta para correr lo que flota (`insetDer`). */
export const PANEL_PROBAR_ANCHO = 360;

const API = '/api/chat-agent/simulador';
const ESCRIBIENDO_MS = 600;
const ENTRE_MS = 350;
const PILDORA_MS = 300;

type Adjunto = { id: number; url: string | null; mime: string; nombre: string | null };
type Turno = { de: 'lead' | 'negocio'; texto: string };

const iconBtn: CSSProperties = {
  width: 30, height: 30, flex: 'none', borderRadius: 9, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
const inpReal: CSSProperties = {
  flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-strong)',
  background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 12.5, fontFamily: "'Geist', sans-serif", outline: 'none',
};

async function postar(body: Record<string, unknown>): Promise<Record<string, unknown> & { ok?: boolean; error?: string }> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch {
    return { ok: false, error: 'Sin conexión' };
  }
}

async function blobABase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode(...buf.subarray(i, i + CH));
  return btoa(bin);
}

const tipoDeMime = (mime: string): 'image' | 'video' | 'document' =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'document';

export function PanelProbar({ secuencia, edicion, secuencias, audios, negocio, rolAdmin, etiquetaEtapa, onCerrar, style }: {
  /** La automatización GUARDADA: su id, su línea y, si el lienzo todavía no mandó nada, sus pasos. */
  secuencia: SecuenciaDto;
  /** Lo que el lienzo tiene SIN publicar (`onCambioLocal`). Es lo que se prueba. */
  edicion: EdicionLocal | null;
  secuencias: ReadonlyArray<SecuenciaDto>;
  audios: AudioSetting[];
  negocio: string;
  rolAdmin: boolean;
  etiquetaEtapa: (key: string) => string;
  onCerrar: () => void;
  /** Dónde se acopla: lo decide quien monta. */
  style?: CSSProperties;
}) {
  const propia = edicion && edicion.secuenciaId === secuencia.id ? edicion : null;
  const pasosVivos = propia?.pasos ?? secuencia.pasos;
  const estVivo = propia ? propia.estrategia : secuencia.estrategia;
  /** El flujo que se ve AHORA en el lienzo, ya en tarjetas. */
  const flujoVivo = useMemo(() => flujoParaProbar(pasosVivos, estVivo, {
    idDeClave: (clave) => secuencias.find((s) => s.clave === clave)?.id ?? null,
  }).pasos, [pasosVivos, estVivo, secuencias]);
  const firmaViva = useMemo(() => firmaFlujo(flujoVivo), [flujoVivo]);
  /** La huella del flujo con el que arrancó esta prueba: si cambia, el panel lo dice. */
  const [firmaProbada, setFirmaProbada] = useState(firmaViva);

  const [mensajes, setMensajes] = useState<HiloMsg[]>([]);
  const [typing, setTyping] = useState<{ lado: 'left' | 'right'; autor?: string } | null>(null);
  const [opciones, setOpciones] = useState<OpcionRama[] | null>(null);
  /** Las pruebas de verdad. El destino se precarga y NO se guarda en ningún lado. */
  const [realWa, setRealWa] = useState(false);
  const [realEmail, setRealEmail] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  // Nombres que las píldoras necesitan: las etiquetas (E), los títulos de las acciones y los
  // archivos de la biblioteca (C). Se piden sólo si el flujo los usa.
  const usaAccion = flujoVivo.some((p) => p.accion != null && typeof p.accion === 'object');
  const titulosAccion = useTitulosAcciones(usaAccion);
  const usaEtiqueta = flujoVivo.some((p) => (p.ramas ?? []).some((r) => (r.filas ?? []).some((f) => f.campo === 'etiqueta')));
  const usaMedia = flujoVivo.some((p) => p.tipo === 'media');
  const [etiquetas, setEtiquetas] = useState<Map<number, string>>(new Map());
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);

  useEffect(() => {
    if (!usaEtiqueta) return;
    let vivo = true;
    void fetch('/api/crm/etiquetas', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (!vivo || !Array.isArray(j?.etiquetas)) return;
      setEtiquetas(new Map((j.etiquetas as Array<{ id: number; nombre: string }>).map((e) => [Number(e.id), String(e.nombre)])));
    }).catch(() => { /* la condición dice «una etiqueta» */ });
    return () => { vivo = false; };
  }, [usaEtiqueta]);

  useEffect(() => {
    if (!usaMedia) return;
    let vivo = true;
    // ⚠️ La forma la define la biblioteca de archivos (parte del composer). Se lee a la
    // defensiva: si no llega, la burbuja dice el nombre del archivo y no se rompe nada.
    void fetch('/api/chat-agent/adjuntos', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      const lista = (Array.isArray(j?.adjuntos) ? j.adjuntos : []) as Array<Record<string, unknown>>;
      if (!vivo) return;
      setAdjuntos(lista.map((a) => ({
        id: Number(a.id), url: typeof a.url === 'string' ? a.url : null,
        mime: String(a.media_mime ?? ''), nombre: typeof a.nombre_archivo === 'string' ? a.nombre_archivo : typeof a.titulo === 'string' ? a.titulo : null,
      })));
    }).catch(() => { /* sin biblioteca */ });
    return () => { vivo = false; };
  }, [usaMedia]);

  // El destino precargado: el contacto del negocio (sólo admin, que es el único que manda).
  useEffect(() => {
    if (!rolAdmin) return;
    let vivo = true;
    void fetch(`${API}?destino=1`, { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (!vivo || !j?.ok) return;
      setTelefono((t) => t || String(j.telefono ?? ''));
      setEmail((e) => e || String(j.email ?? ''));
    }).catch(() => { /* se escribe a mano */ });
    return () => { vivo = false; };
  }, [rolAdmin]);

  const nombres: NombresSim = useMemo(() => ({
    etiqueta: (id) => etiquetas.get(id) ?? null,
    etapa: (key) => etiquetaEtapa(key),
    secuencia: (id) => secuencias.find((s) => s.id === id)?.nombre ?? null,
    accion: (op) => titulosAccion?.get(op) ?? null,
  }), [etiquetas, etiquetaEtapa, secuencias, titulosAccion]);

  // ── El motor del panel ─────────────────────────────────────────────────────
  // Todo lo que leen los timers va por REF: un timer agendado en un render viejo tiene que ver
  // el estado de ahora. Lo que cambia con las props se copia a `ctx` después de cada render.
  const flujoRef = useRef(flujoVivo);
  const simRef = useRef<EstadoSim>(iniciar(flujoVivo));
  const msgsRef = useRef<HiloMsg[]>([]);
  const run = useRef(0);
  const timers = useRef<number[]>([]);
  const seq = useRef(0);
  const colaReal = useRef<Promise<void>>(Promise.resolve());
  const yaSalioUno = useRef(false);
  const ctx = useRef({ nombres, negocio, audios, adjuntos, realWa, realEmail, telefono, email, secuenciaId: secuencia.id });
  useEffect(() => {
    ctx.current = { nombres, negocio, audios, adjuntos, realWa, realEmail, telefono, email, secuenciaId: secuencia.id };
  });

  const firma = () => ctx.current.negocio || 'Tu negocio';
  const nuevoId = (pre: string) => `${pre}-${++seq.current}`;
  const poner = (m: HiloMsg) => { msgsRef.current = [...msgsRef.current, m]; setMensajes(msgsRef.current); };
  const sistema = (texto: string, tono: 'ok' | 'bad' | null = null) =>
    poner({ id: nuevoId('sis'), fromMe: false, tipo: 'sistema', tono, texto, fecha: new Date().toISOString() });
  const luego = (ms: number, fn: () => void) => {
    const r0 = run.current;
    timers.current.push(window.setTimeout(() => { if (run.current === r0) fn(); }, ms));
  };
  const cortar = () => { run.current += 1; timers.current.forEach(clearTimeout); timers.current = []; };

  /** La charla, para el redactor: lo que dijo el lead y lo que contestó el negocio. */
  const historial = (): Turno[] => msgsRef.current
    .filter((m) => m.tipo !== 'sistema')
    .map((m) => ({ de: m.fromMe ? 'lead' as const : 'negocio' as const, texto: m.texto || (m.tipo === 'audio' ? '(nota de voz)' : '(un archivo)') }));

  /** Manda DE VERDAD lo que apareció, en orden, si el interruptor de ese canal está prendido. */
  const mandarReal = (m: MensajePrueba) => {
    const c = ctx.current;
    const vaWa = m.canal === 'whatsapp' && c.realWa;
    const vaEmail = m.canal === 'email' && c.realEmail;
    if (!vaWa && !vaEmail) return;
    const destino = { telefono: c.telefono, email: c.email };
    const r0 = run.current;
    colaReal.current = colaReal.current.then(async () => {
      const primero = !yaSalioUno.current;
      yaSalioUno.current = true;
      const j = await postar({ action: 'enviar-real', secuenciaId: c.secuenciaId, destino, mensaje: m, primero });
      if (!j.ok) {
        if (primero) yaSalioUno.current = false;
        if (run.current === r0) sistema(`No salió · ${j.error ?? 'error'}`, 'bad');
      }
    });
  };

  /** Dibuja un mensaje del flujo como le llega al lead, y lo manda si hay prueba real. */
  const mostrarPaso = (p: PasoSecuenciaDto, redactado?: string, enRespuesta = false) => {
    const c = ctx.current;
    const ahora = new Date().toISOString();
    if (p.canal === 'email') {
      const asunto = textoDeEjemplo(p.asunto ?? '', c.negocio);
      const texto = textoDeEjemplo(p.cuerpo, c.negocio);
      poner({ id: nuevoId('em'), fromMe: false, autor: `✉️ ${asunto || 'Email'}`, texto, fecha: ahora });
      mandarReal({ canal: 'email', tipo: 'texto', texto, asunto });
      return;
    }
    if (p.tipo === 'audio') {
      const a = c.audios.find((x) => x.id === p.audio_id) ?? null;
      poner(a?.url
        ? { id: nuevoId('au'), fromMe: false, autor: firma(), tipo: 'audio', mediaUrl: a.url, texto: a.transcript ? `🎙 ${a.transcript}` : null, fecha: ahora }
        : { id: nuevoId('au'), fromMe: false, autor: firma(), texto: '🎙 Sin audio elegido', fecha: ahora });
      // El pie sale como SEGUNDO mensaje, que es como le llega al lead.
      const pie = textoDeEjemplo(p.cuerpo, c.negocio).trim();
      if (pie) poner({ id: nuevoId('pie'), fromMe: false, autor: firma(), texto: pie, fecha: ahora });
      if (p.audio_id) mandarReal({ canal: 'whatsapp', tipo: 'audio', audio_id: p.audio_id, texto: pie });
      return;
    }
    if (p.tipo === 'media') {
      const adj = c.adjuntos.find((x) => x.id === p.media_id) ?? null;
      const caption = textoDeEjemplo(p.cuerpo, c.negocio);
      poner({
        id: nuevoId('md'), fromMe: false, autor: firma(), tipo: adj ? tipoDeMime(adj.mime) : 'document',
        mediaUrl: adj?.url ?? null, mediaMime: adj?.mime ?? null, texto: caption || adj?.nombre || 'Archivo', fecha: ahora,
      });
      if (p.media_id) mandarReal({ canal: 'whatsapp', tipo: 'media', media_id: p.media_id, texto: caption });
      return;
    }
    const texto = redactado ?? textoDeEjemplo(p.cuerpo, c.negocio);
    // En la salida, un «Lo adapta MaKo» muestra el texto BASE: a cada lead le llega otro.
    const marca = p.tipo === 'ia' && !enRespuesta ? ' · ✦' : '';
    poner({ id: nuevoId('tx'), fromMe: false, autor: `${firma()}${marca}`, texto: texto.trim() || 'Sin escribir', fecha: ahora });
    if (texto.trim()) mandarReal({ canal: 'whatsapp', tipo: 'texto', texto });
  };

  /** Corre UN evento del flujo y agenda el que sigue. */
  function avanzar() {
    const { evento, estado } = siguiente(flujoRef.current, simRef.current, ctx.current.nombres);
    simRef.current = estado;
    if (!evento) return;
    switch (evento.t) {
      case 'mensaje': {
        const paso = evento.paso as PasoSecuenciaDto;
        setTyping({ lado: 'left', autor: firma() });
        // «MaKo contesta» en «Si responde»: lo redacta el redactor del motor con el caso LOCAL.
        if (evento.enRespuesta && paso.tipo === 'ia') {
          const r0 = run.current;
          void postar({
            action: 'responder', secuenciaId: ctx.current.secuenciaId, historial: historial(),
            escenario: escenarioParaRedactar(simRef.current, paso),
          }).then((j) => {
            if (run.current !== r0) return;
            setTyping(null);
            if (j.ok && typeof j.respuesta === 'string') mostrarPaso(paso, j.respuesta, true);
            else sistema(`⚠ ${j.error ?? 'MaKo no pudo responder'}`, 'bad');
            luego(ENTRE_MS, avanzar);
          });
          return;
        }
        luego(ESCRIBIENDO_MS, () => { setTyping(null); mostrarPaso(paso, undefined, evento.enRespuesta); luego(ENTRE_MS, avanzar); });
        return;
      }
      case 'espera':
      case 'accion':
      case 'salto':
        sistema(evento.texto);
        luego(PILDORA_MS, avanzar);
        return;
      case 'condicion':
        sistema('◇ Elige la rama');
        setOpciones(evento.opciones);
        return;
      case 'fin':
        sistema(evento.texto);
        return;
    }
  }

  /** Arranca la prueba desde la primera tarjeta, con el flujo que se ve ahora. */
  const arrancarRefs = () => {
    flujoRef.current = flujoVivo;
    simRef.current = iniciar(flujoVivo);
    msgsRef.current = [];
    yaSalioUno.current = false;
    luego(150, avanzar);
  };

  // Al abrir: arranca solo. Abrir «Probar» y ver llegar los mensajes ES la prueba.
  useEffect(() => {
    arrancarRefs();
    return () => cortar();
    // Sólo al montar: reiniciar es ↻, no cada tecla del lienzo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reiniciar = () => {
    cortar();
    setMensajes([]); setTyping(null); setOpciones(null);
    setFirmaProbada(firmaViva);
    arrancarRefs();
  };

  const elegirRama = (o: OpcionRama) => {
    setOpciones(null);
    simRef.current = elegir(simRef.current, o.puerto);
    sistema(`→ ${o.texto}`);
    luego(PILDORA_MS, avanzar);
  };

  /**
   * El lead escribió (o mandó un audio): la salida se PAUSA y corre «Si responde» con el caso
   * que elija el clasificador. Devuelve la transcripción, si era un audio.
   */
  const alResponder = async (cuerpo: { mensaje?: string; audioBase64?: string; audioMime?: string }): Promise<string | null> => {
    cortar();
    setTyping(null); setOpciones(null);
    const p = pausarPorRespuesta(simRef.current);
    simRef.current = p.estado;
    if (p.pausoLaSalida) sistema('⏸ Se pausa');
    if (!raizRespuesta(flujoRef.current)) { sistema('MaKo no contesta'); return null; }
    const r0 = run.current;
    setTyping({ lado: 'left', autor: firma() });
    const j = await postar({ action: 'clasificar', pasos: flujoRef.current, ...cuerpo });
    if (run.current !== r0) return null;
    setTyping(null);
    if (!j.ok) { sistema(`⚠ ${j.error ?? 'No se pudo clasificar'}`, 'bad'); return null; }
    const e = entrarEnRespuesta(flujoRef.current, simRef.current, typeof j.casoId === 'string' ? j.casoId : null);
    simRef.current = e.estado;
    sistema(`Si responde · ${e.caso?.titulo ?? 'Otra cosa'}`);
    luego(PILDORA_MS, avanzar);
    return typeof j.transcript === 'string' ? j.transcript : null;
  };

  async function enviarTexto(texto: string): Promise<boolean> {
    poner({ id: nuevoId('lead'), fromMe: true, texto, fecha: new Date().toISOString() });
    await alResponder({ mensaje: texto });
    return true;
  }

  async function enviarArchivo(blob: Blob, tipo: '' | 'audio', fileName: string, caption?: string): Promise<boolean> {
    const url = URL.createObjectURL(blob);
    if (tipo === 'audio') {
      const id = nuevoId('lead-audio');
      poner({ id, fromMe: true, tipo: 'audio', mediaUrl: url, fecha: new Date().toISOString() });
      const transcript = await alResponder({ audioBase64: await blobABase64(blob), audioMime: blob.type || 'audio/mpeg' });
      if (transcript) {
        msgsRef.current = msgsRef.current.map((m) => (m.id === id ? { ...m, texto: `🎙 ${transcript}` } : m));
        setMensajes(msgsRef.current);
      }
      return true;
    }
    const esImg = blob.type.startsWith('image/');
    poner({ id: nuevoId('lead-file'), fromMe: true, tipo: esImg ? 'image' : 'document', mediaUrl: url, texto: caption || fileName, fecha: new Date().toISOString() });
    await alResponder({ mensaje: `[el lead mandó un archivo: ${fileName}]${caption ? ` ${caption}` : ''}` });
    return true;
  }

  const cambio = firmaViva !== firmaProbada;

  return (
    <section aria-label="Probar" style={{
      display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8, padding: 10,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
      boxShadow: '0 8px 28px rgba(18,21,27,.12)', boxSizing: 'border-box', ...style,
    }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 0' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Probar</span>
        {cambio && (
          <button type="button" onClick={reiniciar} title="Reiniciar con lo último"
            style={{ flex: 'none', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--warn)', cursor: 'pointer' }}>
            Cambió · ↻
          </button>
        )}
        <button type="button" onClick={reiniciar} title="Reiniciar" aria-label="Reiniciar" style={iconBtn}>↻</button>
        <button type="button" onClick={() => { cortar(); onCerrar(); }} title="Cerrar" aria-label="Cerrar" style={iconBtn}>✕</button>
      </div>

      {/* «In messengers»: sólo el admin manda de verdad. El destino es de esta prueba. */}
      {rolAdmin && (
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 2, padding: '0 2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={realWa} onChange={setRealWa} label="A mi WhatsApp" />
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" aria-label="Tu WhatsApp" placeholder="Tu número" style={inpReal} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={realEmail} onChange={setRealEmail} label="A mi email" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" aria-label="Tu email" placeholder="Tu email" style={inpReal} />
          </div>
        </div>
      )}

      {/* El hilo va en una caja ABSOLUTA: `ChatHilo` se mide con `height: 100%`, y contra un
          alto que sale de `flex: 1` eso es CERO en Safari (AGENTS.md). Con `inset: 0` el alto
          es definido en los dos motores. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <ChatHilo
            accent="var(--wa)" accentBubble="var(--wa-bubble)"
            mensajes={mensajes} typing={typing} animarNuevos
            draftKey={`probar-${secuencia.id}`}
            placeholder="Responde como el lead…"
            onEnviarTexto={enviarTexto} onEnviarArchivo={enviarArchivo}
            /* Vacío a propósito: arranca solo y en 150 ms ya está el «escribiendo…». Un «Sin
               mensajes» que aparece y se va se lee como un parpadeo. */
            vacio={<></>}
          />
        </div>
      </div>

      {/* Una condición: quien prueba elige por dónde sigue (molde de ManyChat). */}
      {opciones && (
        <div style={{ flex: 'none', display: 'flex', flexWrap: 'wrap', gap: 6, padding: '2px 2px 0' }}>
          {opciones.map((o) => (
            <button key={o.puerto} type="button" onClick={() => elegirRama(o)} title={o.texto}
              style={{ maxWidth: '100%', padding: '6px 11px', borderRadius: 999, border: `1px solid ${o.puerto === 'si_no' ? 'var(--border-strong)' : 'var(--primary)'}`, background: 'var(--surface)', color: o.puerto === 'si_no' ? 'var(--dim)' : 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {o.texto}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
