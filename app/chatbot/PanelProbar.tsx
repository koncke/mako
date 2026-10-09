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
//     el teléfono y el email de QUIEN PRUEBA (su perfil), o vacío, y NO se guarda. ⚠️ Antes venía
//     con el contacto de reportes del NEGOCIO: el super admin probando el flujo de un cliente le
//     mandaba la prueba al cliente (revisión adversarial del 08/10/2026, lienzo-3).
//   · UNA TARJETA SALE DE VERDAD UNA VEZ POR PRUEBA (`debeSalirDeVerdad`). El teléfono la dibuja
//     cada vez que el recorrido pasa por ella, pero un «Ir a» que vuelve sobre un mensaje ya
//     mandado no lo reenvía: el simulador no espera las esperas, y ese bucle eran ~21 WhatsApp
//     iguales en segundos por la línea NO oficial (datos-4). El server además topea por destino.
//
// ── SEGUNDA TANDA (08/10/2026, noche): ANCHO Y BAJO, Y CON VARIOS CAMINOS ──────────────
// Pedido de Martín, punto 8: «El "Probar" debe ser más ancho también, no tan largo, sino, se
// rompe el diseño». Decisión 11 del diseño: arriba a la derecha, ~560 × ~400, con el editor del
// nodo en la franja de abajo. Lo que cambió acá:
//   · LLENA EL RECTÁNGULO QUE LE DA SU PADRE (`width/height: 100%`). Dónde va y cuánto mide lo
//     decide UNA función pura del lienzo (`muelles`, lib/lienzo-grafo.ts), no este componente:
//     con tres componentes eligiendo su lugar, el editor y «Probar» se pisaban.
//   · LA CABECERA EN UN RENGLÓN (Probar · Cambió ↻ · ↻ · ✕ Cerrar) y LOS DOS INTERRUPTORES EN
//     UNA FILA: con ~400 de alto, cada renglón apilado es chat que no se ve.
//   · UN EMAIL SE VE COMO UN MAIL (`CorreoDePrueba`: ✉️ asunto, la vista previa en gris y el
//     cuerpo recortado), no como una burbuja de WhatsApp.
//   · VARIOS CAMINOS A LA VEZ: el recorrido corre el hilo de reloj más bajo
//     (lib/simulador-grafo.ts), así que el email del día 0 sale antes que el WhatsApp del día 1.
//
// ⚠️ EL TEXTO DE ESTA PIEZA ES CORTO A PROPÓSITO (AGENTS.md, «el texto que se DIBUJA»): una
// píldora son 1-4 palabras. El porqué de cada cosa vive acá, no en la pantalla.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { Switch } from '@/app/_ui';
import { TextoMarcas } from '@/app/_components/TextoMarcas';
import { useTitulosAcciones } from '@/app/_components/EditorAccionMako';
import type { AudioSetting, PasoSecuenciaDto, SecuenciaDto } from './ChatAgentApp';
import type { EdicionLocal } from './SecuenciaPerfil';
import { raizRespuesta } from '@/lib/flujo-grafo';
import {
  flujoParaProbar, firmaFlujo, iniciar, siguiente, elegir, pausarPorRespuesta, entrarEnRespuesta,
  escenarioParaRedactar, textoDeEjemplo, correoDeEjemplo, debeSalirDeVerdad, burbujaDeArchivo,
  type EstadoSim, type NombresSim, type OpcionRama, type MensajePrueba,
} from '@/lib/simulador-grafo';

/**
 * El tamaño que pide «Probar»: ancho y bajo (decisión 11). Lo usa quien lo monta para elegir el
 * rectángulo y correr lo que flota; el componente llena lo que le den. Con el rectángulo de
 * `muelles` (lib/lienzo-grafo.ts), la cuenta vive allá y esto es sólo el pedido.
 */
export const PANEL_PROBAR_ANCHO = 560;
export const PANEL_PROBAR_ALTO = 400;

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
const cerrarBtn: CSSProperties = {
  ...iconBtn, width: 'auto', padding: '0 11px', gap: 5, color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
};
const inpReal: CSSProperties = {
  flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border-strong)',
  background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 12.5, fontFamily: "'Geist', sans-serif", outline: 'none',
};
/**
 * Un interruptor con su destino al lado. Las dos van en UNA fila; en un panel angosto la segunda
 * baja (`flex-wrap`), nunca se aplastan los rótulos.
 */
const filaReal: CSSProperties = { flex: '1 1 240px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 };

/** Lo que sale de un email del flujo, para dibujarlo como un mail. */
export type CorreoVisto = { asunto: string; vistaPrevia: string; cuerpo: string };

/**
 * Un mensaje del teléfono de «Probar». Un email del flujo viaja con `tipo: 'email'` y su `correo`
 * (lo que `CorreoDePrueba` dibuja) ADENTRO del mensaje, no en un mapa aparte: así sobrevive a ↻ y
 * al orden del hilo sin una segunda fuente que mantener.
 */
export type MsgProbar = HiloMsg & { correo?: CorreoVisto };

/**
 * Cómo se dibuja a mano un mensaje del hilo de «Probar»: un email, como un MAIL; todo lo demás,
 * `null` (la burbuja de siempre). Es lo que `ChatHilo` recibe por `renderMensaje`.
 */
export function dibujarMensajeProbar(m: HiloMsg): ReactNode | null {
  const c = m.tipo === 'email' ? (m as MsgProbar).correo : undefined;
  return c ? <CorreoDePrueba {...c} /> : null;
}

/**
 * Un email del flujo tal como se ve en la bandeja: ✉️ el asunto, la vista previa en gris (el
 * preheader) y el cuerpo recortado. NO es una burbuja de WhatsApp: «Probar» muestra cómo llega
 * cada cosa, y un email que se ve como un WhatsApp no prueba nada (decisión 11).
 *
 * El cuerpo se recorta con `line-clamp` y no cortando el texto: un corte a mano puede partir una
 * marca (`*negrita*`) y dejar el asterisco a la vista. Las marcas se pintan como en el envío.
 */
export function CorreoDePrueba({ asunto, vistaPrevia, cuerpo }: CorreoVisto) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div aria-label="Email" style={{
        width: 'min(420px, 92%)', minWidth: 0, boxSizing: 'border-box', padding: '10px 13px',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: '0 1px 2px rgba(18,21,27,.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
          <span aria-hidden style={{ flex: 'none', fontSize: 13 }}>✉️</span>
          <span style={{ minWidth: 0, flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {asunto || 'Sin asunto'}
          </span>
        </div>
        {vistaPrevia && (
          <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vistaPrevia}</div>
        )}
        <div style={{
          marginTop: 7, paddingTop: 7, borderTop: '1px solid var(--border)', fontSize: 13, lineHeight: 1.45, color: 'var(--dim)',
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {cuerpo.trim() ? <TextoMarcas texto={cuerpo} /> : 'Sin escribir'}
        </div>
      </div>
    </div>
  );
}

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

  const [mensajes, setMensajes] = useState<MsgProbar[]>([]);
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

  // El destino precargado: el de QUIEN PRUEBA, no el del negocio (sólo admin, que es el único
  // que manda). Lo que ya se escribió a mano no se pisa.
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
  const msgsRef = useRef<MsgProbar[]>([]);
  const run = useRef(0);
  const timers = useRef<number[]>([]);
  const seq = useRef(0);
  const colaReal = useRef<Promise<void>>(Promise.resolve());
  const yaSalioUno = useRef(false);
  /** Las tarjetas que ya salieron DE VERDAD en esta prueba (`debeSalirDeVerdad`). ↻ lo vacía. */
  const enviadosReal = useRef(new Set<string>());
  /** Cuántas veces escribió el lead en esta prueba: en «Si responde» cada turno sale de nuevo. */
  const turnoLead = useRef(0);
  /** El «no se reenvía» se dice UNA vez por prueba: en un bucle serían veinte píldoras. */
  const dijoRepetido = useRef(false);
  const ctx = useRef({ nombres, negocio, audios, adjuntos, realWa, realEmail, telefono, email, secuenciaId: secuencia.id });
  useEffect(() => {
    ctx.current = { nombres, negocio, audios, adjuntos, realWa, realEmail, telefono, email, secuenciaId: secuencia.id };
  });

  const firma = () => ctx.current.negocio || 'Tu negocio';
  const nuevoId = (pre: string) => `${pre}-${++seq.current}`;
  const poner = (m: MsgProbar) => { msgsRef.current = [...msgsRef.current, m]; setMensajes(msgsRef.current); };
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

  /**
   * Manda DE VERDAD lo que apareció, en orden, si el interruptor de ese canal está prendido y
   * esa tarjeta todavía no salió en esta prueba. El interruptor se mira PRIMERO: una tarjeta que
   * pasó con el interruptor apagado no cuenta como mandada.
   */
  const mandarReal = (m: MensajePrueba, nodo: string, enRespuesta: boolean) => {
    const c = ctx.current;
    const vaWa = m.canal === 'whatsapp' && c.realWa;
    const vaEmail = m.canal === 'email' && c.realEmail;
    if (!vaWa && !vaEmail) return;
    if (!debeSalirDeVerdad(enviadosReal.current, nodo, enRespuesta, turnoLead.current)) {
      if (!dijoRepetido.current) { dijoRepetido.current = true; sistema('Ya salió · no se reenvía'); }
      return;
    }
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
  const mostrarPaso = (p: PasoSecuenciaDto, nodo: string, redactado?: string, enRespuesta = false) => {
    const c = ctx.current;
    const ahora = new Date().toISOString();
    if (p.canal === 'email') {
      const correo = correoDeEjemplo(p, c.negocio);
      // `tipo: 'email'` + su `correo`: `dibujarMensajeProbar` lo dibuja como un mail. `autor` y
      // `texto` son el respaldo para un hilo que todavía no acepte `renderMensaje` (ver arriba).
      poner({ id: nuevoId('em'), fromMe: false, tipo: 'email', correo, autor: `✉️ ${correo.asunto || 'Sin asunto'}`, texto: correo.cuerpo, fecha: ahora });
      mandarReal({ canal: 'email', tipo: 'texto', texto: correo.cuerpo, asunto: correo.asunto }, nodo, enRespuesta);
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
      if (p.audio_id) mandarReal({ canal: 'whatsapp', tipo: 'audio', audio_id: p.audio_id, texto: pie }, nodo, enRespuesta);
      return;
    }
    if (p.tipo === 'media') {
      const adj = c.adjuntos.find((x) => x.id === p.media_id) ?? null;
      const caption = textoDeEjemplo(p.cuerpo, c.negocio);
      // El documento con SU nombre y el caption aparte, como le llega al lead (costuras-8).
      poner({ id: nuevoId('md'), fromMe: false, autor: firma(), ...burbujaDeArchivo(adj, caption), fecha: ahora });
      if (p.media_id) mandarReal({ canal: 'whatsapp', tipo: 'media', media_id: p.media_id, texto: caption }, nodo, enRespuesta);
      return;
    }
    const texto = redactado ?? textoDeEjemplo(p.cuerpo, c.negocio);
    // En la salida, un «Lo adapta MaKo» muestra el texto BASE: a cada lead le llega otro.
    const marca = p.tipo === 'ia' && !enRespuesta ? ' · ✦' : '';
    poner({ id: nuevoId('tx'), fromMe: false, autor: `${firma()}${marca}`, texto: texto.trim() || 'Sin escribir', fecha: ahora });
    if (texto.trim()) mandarReal({ canal: 'whatsapp', tipo: 'texto', texto }, nodo, enRespuesta);
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
            if (j.ok && typeof j.respuesta === 'string') mostrarPaso(paso, evento.nodo, j.respuesta, true);
            else sistema(`⚠ ${j.error ?? 'MaKo no pudo responder'}`, 'bad');
            luego(ENTRE_MS, avanzar);
          });
          return;
        }
        luego(ESCRIBIENDO_MS, () => { setTyping(null); mostrarPaso(paso, evento.nodo, undefined, evento.enRespuesta); luego(ENTRE_MS, avanzar); });
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
    enviadosReal.current = new Set();
    turnoLead.current = 0;
    dijoRepetido.current = false;
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
    // Un turno nuevo del lead: lo que «Si responde» conteste ahora sale de verdad otra vez.
    turnoLead.current += 1;
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

  // LLENA EL RECTÁNGULO DEL PADRE (`width/height: 100%`): el lugar y el tamaño los decide quien lo
  // monta (`muelles`). Un padre que lo ancla arriba Y abajo sin dar alto lo dimensiona con el
  // ancla: ahí un `height: 100%` lo estiraría más allá del borde de abajo.
  const raiz: CSSProperties = {
    display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8, padding: 10,
    width: '100%', height: '100%',
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
    boxShadow: '0 8px 28px rgba(18,21,27,.12)', boxSizing: 'border-box', ...style,
  };
  if (style?.top != null && style?.bottom != null && style.height == null) delete raiz.height;

  return (
    <section aria-label="Probar" style={raiz}>
      {/* La cabecera, en UN renglón: el nombre, «Cambió» si el flujo se editó, ↻ y ✕ Cerrar. */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 0', whiteSpace: 'nowrap' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>Probar</span>
        {cambio && (
          <button type="button" onClick={reiniciar} title="Reiniciar con lo último"
            style={{ flex: 'none', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--warn)', cursor: 'pointer' }}>
            Cambió · ↻
          </button>
        )}
        <button type="button" onClick={reiniciar} title="Reiniciar" aria-label="Reiniciar" style={iconBtn}>↻</button>
        <button type="button" onClick={() => { cortar(); onCerrar(); }} title="Cerrar" aria-label="Cerrar" style={cerrarBtn}>✕ Cerrar</button>
      </div>

      {/* «In messengers»: sólo el admin manda de verdad. El destino es de esta prueba. Los dos
          interruptores en UNA fila (`filaReal`): en un panel bajo, cada renglón apilado es chat
          que no se ve. */}
      {rolAdmin && (
        <div style={{ flex: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 0, padding: '0 2px' }}>
          <div style={filaReal}>
            <span style={{ flex: 'none' }}><Switch checked={realWa} onChange={setRealWa} label="A mi WhatsApp" /></span>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" aria-label="Tu WhatsApp" placeholder="Tu número" style={inpReal} />
          </div>
          <div style={filaReal}>
            <span style={{ flex: 'none' }}><Switch checked={realEmail} onChange={setRealEmail} label="A mi email" /></span>
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
            renderMensaje={dibujarMensajeProbar}
            draftKey={`probar-${secuencia.id}`}
            placeholder="Responde como el lead…"
            onEnviarTexto={enviarTexto} onEnviarArchivo={enviarArchivo}
            /* Vacío a propósito: arranca solo y en 150 ms ya está el «escribiendo…». Un «Sin
               mensajes» que aparece y se va se lee como un parpadeo. */
            vacio={<></>}
            /* Una condición: quien prueba elige por dónde sigue (molde de ManyChat), adentro del
               chat y arriba de la barra, como las respuestas rápidas. */
            encimaDelComposer={opciones ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {opciones.map((o) => (
                  <button key={o.puerto} type="button" onClick={() => elegirRama(o)} title={o.texto}
                    style={{ maxWidth: '100%', padding: '6px 11px', borderRadius: 999, border: `1px solid ${o.puerto === 'si_no' ? 'var(--border-strong)' : 'var(--primary)'}`, background: 'var(--surface)', color: o.puerto === 'si_no' ? 'var(--dim)' : 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {o.texto}
                  </button>
                ))}
              </div>
            ) : undefined}
          />
        </div>
      </div>

    </section>
  );
}
