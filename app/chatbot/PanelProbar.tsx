'use client';

// =============================================================================
// PanelProbar — «Probar» de UN canal: el teléfono de WhatsApp o la bandeja tipo Gmail
// =============================================================================
// Pedido de Martín (08/10/2026, punto 10), textual: «El botón de probar se rompe, aparece detrás
// de la sidebar y se ve horrible. No tiene la animación de entrada de los mensajes y tampoco puedo
// interactuar, para probarlo de verdad... Y tampoco veo la opción de probarlo realmente, con el
// número o email del usuario... Y para cerrar, un botón de CERRAR, no un "editar"... Y no hace
// falta que ocupe toda la pantalla. Mira como lo hace Manychat».
//
// Molde de ManyChat («Preview»): un teléfono AL LADO del lienzo, que sigue editable; ✕ para cerrar
// y ↻ para reiniciar; una caja para contestar como el contacto; «In messengers» manda la prueba a
// la app de verdad.
//
// Lo que sigue valiendo de la primera tanda, cada cosa con su porqué:
//   · NO REEMPLAZA AL LIENZO. Antes «Probar» desmontaba el editor (se perdía lo no publicado).
//   · RECORRE EL FLUJO LOCAL con lib/simulador-grafo.ts —la misma navegación que el motor—: en una
//     condición quien prueba elige la rama; una espera se dice y se sigue; una acción se nombra y
//     no se ejecuta.
//   · ESCRIBIR COMO EL LEAD PAUSA LA SALIDA y corre «Si responde» (sólo en WhatsApp: una respuesta
//     del lead es un WhatsApp). El server clasifica contra los casos locales (`clasificarEscenario`)
//     y un «MaKo contesta» se redacta con el redactor del motor.
//   · EL DESTINO DE LA PRUEBA REAL es el de QUIEN PRUEBA (su fila de `usuarios`), o vacío, y NO se
//     guarda. ⚠️ Antes venía con el contacto de reportes del NEGOCIO: el super admin probando el
//     flujo de un cliente le mandaba la prueba al cliente (revisión del 08/10/2026, lienzo-3).
//   · UNA TARJETA SALE DE VERDAD UNA VEZ POR PRUEBA (`debeSalirDeVerdad`): un «Ir a» que vuelve
//     sobre un mensaje ya mandado no lo reenvía (datos-4). El server además topea por destino.
//   · LLENA EL RECTÁNGULO QUE LE DA SU PADRE (`muelles`, lib/lienzo-grafo.ts), segunda tanda.
//
// ── TERCERA TANDA (09/10/2026): UN CANAL POR VEZ ─────────────────────────────────────
// Pedido de Martín, punto 14, textual: «Y al darle probar debería ser un desplegable para probar
// WhatsApp o Email. No que dentro me salga la interfaz de WhatsApp y a su vez me aparezca un campo
// de Email, es contraintuitivo... Si selecciono Email, claro que el diseño que debe aparecer es el
// de Gmail. Por defecto, siempre comienza la animación de prueba de recibiendo la automatización y
// claro un botón para probar con un número o email, dependiendo...». Decisión 14 del diseño.
//   · `canal` LO ELIGE EL DESPLEGABLE de «Probar» (SecuenciaPerfil, parte B) y el panel muestra
//     SÓLO ese canal. El recorrido es el mismo (las condiciones, las esperas y los hilos corren
//     igual: el reloj es uno), pero un mensaje del OTRO canal ni se dibuja ni sale. Filtrar acá y
//     no en el simulador es a propósito: el simulador recorre el flujo, el panel elige qué mirar.
//   · WHATSAPP = EL TELÉFONO de siempre (ChatHilo), con la caja para contestar como el lead.
//   · EMAIL = UNA BANDEJA TIPO GMAIL (`BandejaGmail`): la lista de lo que llega —remitente, asunto,
//     vista previa y cuándo llega— y al abrir uno, el mail con el MISMO render que sale
//     (`renderEmailHtml` con `paramsDeVista`, las reglas del envío; el remitente es el de
//     /api/email/dominio). Sin caja para contestar: una respuesta del lead es un WhatsApp.
//   · ARRANCA SOLO: abrir «Probar» y ver llegar los mensajes ES la prueba.
//   · ABAJO, UN BOTÓN PARA PROBARLO DE VERDAD, con TU número o TU email según el canal: vuelve a
//     arrancar el recorrido y cada mensaje que aparece sale de verdad por el envío que ya existía
//     (lib/prueba-paso.ts). Se fueron los dos interruptores a la vez («A mi WhatsApp» y «A mi
//     email» en la misma fila): con un canal por vez, un interruptor del otro no tiene sentido.
//     ↻ vuelve a la prueba sin envío.
//
// ⚠️ EL TEXTO DE ESTA PIEZA ES CORTO A PROPÓSITO (AGENTS.md, «el texto que se DIBUJA»): una
// píldora son 1-4 palabras. El porqué de cada cosa vive acá, no en la pantalla.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { Button } from '@/app/_ui';
import { useTitulosAcciones } from '@/app/_components/EditorAccionMako';
import { renderEmailHtml } from '@/lib/email-html';
import { paramsDeVista, nombreDelRemitente } from './EditorEmailGmail';
import type { AudioSetting, PasoSecuenciaDto, SecuenciaDto } from './ChatAgentApp';
import type { EdicionLocal } from './SecuenciaPerfil';
import { raizRespuesta } from '@/lib/flujo-grafo';
import {
  flujoParaProbar, firmaFlujo, iniciar, siguiente, elegir, pausarPorRespuesta, entrarEnRespuesta,
  escenarioParaRedactar, textoDeEjemplo, correoDeEjemplo, debeSalirDeVerdad, burbujaDeArchivo,
  type EstadoSim, type NombresSim, type OpcionRama, type MensajePrueba,
} from '@/lib/simulador-grafo';

/**
 * El tamaño que pide «Probar»: ancho y bajo (decisión 11 de la segunda tanda). La cuenta vive en
 * `muelles` (lib/lienzo-grafo.ts); esto es sólo el pedido.
 */
export const PANEL_PROBAR_ANCHO = 560;
export const PANEL_PROBAR_ALTO = 400;

/** Qué se prueba: lo elige el desplegable de «Probar» (decisión 14 de la tercera tanda). */
export type CanalProbar = 'whatsapp' | 'email';

const API = '/api/chat-agent/simulador';
const ESCRIBIENDO_MS = 600;
const ENTRE_MS = 350;
const PILDORA_MS = 300;

type Adjunto = { id: number; url: string | null; mime: string; nombre: string | null };
type Turno = { de: 'lead' | 'negocio'; texto: string };

/** Un mail que llegó a la bandeja de «Probar», con las variables del lead de ejemplo ya puestas. */
export type CorreoRecibido = {
  id: string; asunto: string; vistaPrevia: string; cuerpo: string;
  /** El minuto virtual en que llega (el reloj del hilo: una espera de un día = 1440). */
  minuto: number;
  leido: boolean;
};

/**
 * Cuándo llega, como lo dice una bandeja: «Ahora» el del minuto 0 y «+2 h» / «+1 d» los que van
 * después de una espera. Es relativo a propósito: la prueba no tiene un reloj de verdad.
 */
export function cuandoLlega(minuto: number): string {
  const m = Math.max(0, Math.round(Number(minuto) || 0));
  if (m === 0) return 'Ahora';
  if (m < 60) return `+${m} min`;
  if (m < 1440) return `+${Math.round(m / 60)} h`;
  return `+${Math.round(m / 1440)} d`;
}

/**
 * Quién manda el mail, para la bandeja: el nombre del remitente del workspace con la MISMA regla
 * que el envío (`nombreDelRemitente`, el editor de email) y su dirección. Sin remitente leído, el
 * nombre del negocio y sin dirección: no se inventa un mail.
 */
export function remitenteVisible(remitente: string, negocio: string): { nombre: string; mail: string } {
  const mail = (/<\s*([^>]+?)\s*>/.exec(remitente)?.[1] ?? (/^[^\s<>@]+@[^\s<>@]+$/.test(remitente.trim()) ? remitente.trim() : '')).trim();
  const nombre = nombreDelRemitente(remitente) || negocio.trim() || mail || 'Tu negocio';
  return { nombre, mail };
}

/** La vista previa de una fila: el preheader, o el principio del cuerpo sin las marcas. */
export function vistaDeFila(c: Pick<CorreoRecibido, 'vistaPrevia' | 'cuerpo'>): string {
  return c.vistaPrevia.trim() || c.cuerpo.replace(/[*_~]/g, '').replace(/\s+/g, ' ').trim();
}

const iconBtn: CSSProperties = {
  width: 30, height: 30, flex: 'none', borderRadius: 9, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
const cerrarBtn: CSSProperties = {
  ...iconBtn, width: 'auto', padding: '0 11px', gap: 5, color: 'var(--ink)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
};
const inpReal: CSSProperties = {
  flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border-strong)',
  background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13, fontFamily: "'Geist', sans-serif", outline: 'none',
};
const caja: CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden',
};
const recorte: CSSProperties = { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

/**
 * Lo que un estilo en línea no puede: el hover de la fila, la entrada de un mail nuevo y el pulso
 * de «recibiendo». Con `prefers-reduced-motion`, nada se mueve. Sin backticks acá adentro: es un
 * template literal y uno lo cerraría a la mitad.
 */
const CSS = `
.pp-fila{background:transparent;transition:background .14s ease}
.pp-fila:hover{background:var(--surface-2)}
.pp-entra{animation:pp-entra .32s cubic-bezier(.2,.8,.2,1) both}
@keyframes pp-entra{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.pp-pulso{animation:pp-pulso 1.1s ease-in-out infinite}
@keyframes pp-pulso{0%,100%{opacity:.45}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){.pp-entra,.pp-pulso{animation:none}}
`;

/** El sobre de Gmail: la única tinta de marca de la bandeja (el resto, tokens de la casa). */
function SobreGmail() {
  return (
    <svg width="18" height="14" viewBox="0 0 24 18" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M2 18h4V8.2L0 3.6V16a2 2 0 0 0 2 2Z" fill="#4285F4" />
      <path d="M18 18h4a2 2 0 0 0 2-2V3.6l-6 4.6V18Z" fill="#34A853" />
      <path d="M18 1.2v7l6-4.6V2.4c0-2-2.3-3.2-3.9-2L18 1.2Z" fill="#FBBC04" />
      <path d="M6 8.2v-7L12 5.8l6-4.6v7L12 12.8 6 8.2Z" fill="#EA4335" />
      <path d="M0 2.4v1.2l6 4.6v-7L3.9.4C2.3-.8 0 .4 0 2.4Z" fill="#C5221F" />
    </svg>
  );
}

function Inicial({ nombre }: { nombre: string }) {
  return (
    <span aria-hidden style={{ width: 32, height: 32, borderRadius: '50%', flex: 'none', background: 'var(--primary)', color: 'var(--on-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
      {(nombre.trim()[0] ?? '·').toUpperCase()}
    </span>
  );
}

/**
 * La bandeja de «Probar» por email, tipo Gmail. Sin estado propio: lo que llegó, cuál está
 * abierto y si está llegando uno lo decide el panel. Lo nuevo va ARRIBA, como en una bandeja.
 */
export function BandejaGmail({ correos, abierto, recibiendo, terminado, remitente, negocio, onAbrir, onVolver }: {
  correos: readonly CorreoRecibido[];
  abierto: string | null;
  /** Está por llegar uno: la fila que late arriba (el «escribiendo…» de una bandeja). */
  recibiendo: boolean;
  /** La prueba terminó: recién ahí «Sin correos» es un hecho y no un parpadeo. */
  terminado: boolean;
  remitente: string;
  negocio: string;
  onAbrir: (id: string) => void;
  onVolver: () => void;
}) {
  const de = remitenteVisible(remitente, negocio);
  const correo = abierto ? correos.find((c) => c.id === abierto) ?? null : null;
  if (correo) return <CorreoAbierto correo={correo} de={de} remitente={remitente} negocio={negocio} onVolver={onVolver} />;
  const sinLeer = correos.filter((c) => !c.leido).length;
  return (
    <div role="region" aria-label="Recibidos" style={caja}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
        <SobreGmail />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Recibidos</span>
        {sinLeer > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary)' }}>{sinLeer}</span>}
      </div>
      <div className="mk-scroll-y" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {recibiendo && (
          <div aria-label="Llegando" className="pp-pulso" style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)' }} />
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ width: '38%', height: 9, borderRadius: 5, background: 'var(--surface-2)' }} />
              <span style={{ width: '72%', height: 9, borderRadius: 5, background: 'var(--surface-2)' }} />
            </span>
          </div>
        )}
        {[...correos].reverse().map((c) => (
          <button key={c.id} type="button" onClick={() => onAbrir(c.id)} className="pp-fila pp-entra" data-leido={c.leido ? '' : undefined}
            style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'flex-start', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>
            <Inicial nombre={de.nombre} />
            <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ ...recorte, flex: 1, fontSize: 13.5, fontWeight: c.leido ? 500 : 700 }}>{de.nombre}</span>
                <span style={{ flex: 'none', fontSize: 12, fontWeight: c.leido ? 400 : 700, color: c.leido ? 'var(--faint)' : 'var(--ink)' }}>{cuandoLlega(c.minuto)}</span>
              </span>
              <span style={{ ...recorte, fontSize: 13, fontWeight: c.leido ? 400 : 700 }}>{c.asunto || 'Sin asunto'}</span>
              <span style={{ ...recorte, fontSize: 12.5, color: 'var(--faint)' }}>{vistaDeFila(c) || 'Sin escribir'}</span>
            </span>
          </button>
        ))}
        {terminado && !recibiendo && correos.length === 0 && (
          <div style={{ padding: 18, color: 'var(--faint)', fontSize: 13 }}>Sin correos</div>
        )}
      </div>
    </div>
  );
}

/**
 * Un mail abierto: el asunto, quién lo manda y el cuerpo con el MISMO render que sale. El iframe
 * va en una caja ABSOLUTA: un `height: 100%` contra un alto que sale de `flex: 1` es cero en
 * Safari (AGENTS.md); contra una caja con `inset: 0`, el alto es definido en los dos motores.
 */
function CorreoAbierto({ correo, de, remitente, negocio, onVolver }: {
  correo: CorreoRecibido; de: { nombre: string; mail: string }; remitente: string; negocio: string; onVolver: () => void;
}) {
  // Las variables del lead de ejemplo ya vienen puestas (`correoDeEjemplo`); `paramsDeVista` pone el
  // resto con las reglas del envío (asunto vacío, preheader, firma del remitente).
  const html = useMemo(
    () => renderEmailHtml(paramsDeVista({ asunto: correo.asunto, preheader: correo.vistaPrevia, cuerpo: correo.cuerpo, negocio, remitente })),
    [correo.asunto, correo.vistaPrevia, correo.cuerpo, negocio, remitente],
  );
  return (
    <div role="region" aria-label="Correo abierto" style={caja}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>
        <button type="button" onClick={onVolver} aria-label="Volver a Recibidos" title="Volver" style={iconBtn}>←</button>
        <span style={{ ...recorte, flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{correo.asunto || 'Sin asunto'}</span>
      </div>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px' }}>
        <Inicial nombre={de.nombre} />
        <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span style={{ ...recorte, fontSize: 13 }}>
            <strong style={{ color: 'var(--ink)' }}>{de.nombre}</strong>
            {de.mail && <span style={{ color: 'var(--faint)' }}> &lt;{de.mail}&gt;</span>}
          </span>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>para mí</span>
        </span>
        <span style={{ flex: 'none', fontSize: 12, color: 'var(--faint)' }}>{cuandoLlega(correo.minuto)}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderTop: '1px solid var(--border)' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <iframe title={correo.asunto || 'Correo'} srcDoc={html} sandbox="allow-popups allow-popups-to-escape-sandbox"
            style={{ display: 'block', width: '100%', height: '100%', border: 'none', background: '#fff' }} />
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

export function PanelProbar({ secuencia, edicion, secuencias, audios, negocio, rolAdmin, etiquetaEtapa, canal, onCerrar, style }: {
  /** La automatización GUARDADA: su id, su línea y, si el lienzo todavía no mandó nada, sus pasos. */
  secuencia: SecuenciaDto;
  /** Lo que el lienzo tiene SIN publicar (`onCambioLocal`). Es lo que se prueba. */
  edicion: EdicionLocal | null;
  secuencias: ReadonlyArray<SecuenciaDto>;
  audios: AudioSetting[];
  negocio: string;
  rolAdmin: boolean;
  etiquetaEtapa: (key: string) => string;
  /** El canal que se prueba: el teléfono de WhatsApp o la bandeja de email. Uno solo. */
  canal: CanalProbar;
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
  // La bandeja (canal email).
  const [correos, setCorreos] = useState<CorreoRecibido[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [recibiendo, setRecibiendo] = useState(false);
  const [terminado, setTerminado] = useState(false);
  /** En la bandeja no hay hilo donde poner una píldora: va la última, en un renglón. */
  const [aviso, setAviso] = useState<{ texto: string; tono: 'ok' | 'bad' | null } | null>(null);
  const [remitente, setRemitente] = useState('');
  /** La prueba DE VERDAD de este recorrido, y su destino (precargado, NO se guarda). */
  const [real, setReal] = useState(false);
  const [destino, setDestino] = useState('');

  // Nombres que las píldoras necesitan: las etiquetas, los títulos de las acciones y los archivos
  // de la biblioteca. Se piden sólo si el flujo los usa.
  const usaAccion = flujoVivo.some((p) => p.accion != null && typeof p.accion === 'object');
  const titulosAccion = useTitulosAcciones(usaAccion);
  const usaEtiqueta = flujoVivo.some((p) => (p.ramas ?? []).some((r) => (r.filas ?? []).some((f) => f.campo === 'etiqueta')));
  const usaMedia = canal === 'whatsapp' && flujoVivo.some((p) => p.tipo === 'media');
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
    // A la defensiva: si la biblioteca no llega, la burbuja dice el nombre del archivo.
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

  // El remitente del workspace, para la bandeja: el MISMO que lee el editor de email. Sin él, la
  // fila dice el nombre del negocio (`remitenteVisible`).
  useEffect(() => {
    if (canal !== 'email') return;
    let vivo = true;
    // Con tope: la ruta le pregunta a Resend en vivo, y sin `signal` una conexión caída no vuelve nunca.
    void fetch('/api/email/dominio', { cache: 'no-store', signal: AbortSignal.timeout(20_000) }).then((r) => r.json()).then((j) => {
      if (vivo && j?.ok && typeof j.remitente === 'string') setRemitente(j.remitente);
    }).catch(() => { /* sin remitente */ });
    return () => { vivo = false; };
  }, [canal]);

  // El destino precargado: el de QUIEN PRUEBA, del canal de este panel (sólo admin, que es el
  // único que manda). Lo que ya se escribió a mano no se pisa.
  useEffect(() => {
    if (!rolAdmin) return;
    let vivo = true;
    void fetch(`${API}?destino=1`, { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (!vivo || !j?.ok) return;
      setDestino((d) => d || String((canal === 'email' ? j.email : j.telefono) ?? ''));
    }).catch(() => { /* se escribe a mano */ });
    return () => { vivo = false; };
  }, [rolAdmin, canal]);

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
  const correosRef = useRef<CorreoRecibido[]>([]);
  const run = useRef(0);
  const timers = useRef<number[]>([]);
  const seq = useRef(0);
  const colaReal = useRef<Promise<void>>(Promise.resolve());
  const yaSalioUno = useRef(false);
  /**
   * ¿Este recorrido sale de verdad? Es un ref además del estado: el botón lo prende y arranca el
   * recorrido EN EL MISMO handler, antes de que `ctx` se copie en el render siguiente.
   */
  const realRef = useRef(false);
  /** Las tarjetas que ya salieron DE VERDAD en esta prueba (`debeSalirDeVerdad`). ↻ lo vacía. */
  const enviadosReal = useRef(new Set<string>());
  /** Cuántas veces escribió el lead en esta prueba: en «Si responde» cada turno sale de nuevo. */
  const turnoLead = useRef(0);
  /** El «no se reenvía» se dice UNA vez por prueba: en un bucle serían veinte píldoras. */
  const dijoRepetido = useRef(false);
  const ctx = useRef({ nombres, negocio, audios, adjuntos, destino, canal, secuenciaId: secuencia.id });
  useEffect(() => {
    ctx.current = { nombres, negocio, audios, adjuntos, destino, canal, secuenciaId: secuencia.id };
  });

  const firma = () => ctx.current.negocio || 'Tu negocio';
  const nuevoId = (pre: string) => `${pre}-${++seq.current}`;
  const poner = (m: HiloMsg) => { msgsRef.current = [...msgsRef.current, m]; setMensajes(msgsRef.current); };
  const ponerCorreo = (c: CorreoRecibido) => { correosRef.current = [...correosRef.current, c]; setCorreos(correosRef.current); };
  /** Una píldora: en el teléfono, adentro del hilo; en la bandeja, el renglón de abajo. */
  const sistema = (texto: string, tono: 'ok' | 'bad' | null = null) => {
    if (ctx.current.canal === 'email') { setAviso({ texto, tono }); return; }
    poner({ id: nuevoId('sis'), fromMe: false, tipo: 'sistema', tono, texto, fecha: new Date().toISOString() });
  };
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
   * Manda DE VERDAD lo que apareció, en orden, si este recorrido es el de verdad, el mensaje es del
   * canal del panel y esa tarjeta todavía no salió en esta prueba. Lo que no sale de verdad se mira
   * PRIMERO: una tarjeta que pasó sin envío no cuenta como mandada.
   */
  const mandarReal = (m: MensajePrueba, nodo: string, enRespuesta: boolean) => {
    const c = ctx.current;
    const vaWa = realRef.current && c.canal === 'whatsapp' && m.canal === 'whatsapp';
    const vaEmail = realRef.current && c.canal === 'email' && m.canal === 'email';
    if (!vaWa && !vaEmail) return;
    if (!debeSalirDeVerdad(enviadosReal.current, nodo, enRespuesta, turnoLead.current)) {
      if (!dijoRepetido.current) { dijoRepetido.current = true; sistema('Ya salió · no se reenvía'); }
      return;
    }
    const destinoReal = vaEmail ? { telefono: null, email: c.destino } : { telefono: c.destino, email: null };
    const r0 = run.current;
    colaReal.current = colaReal.current.then(async () => {
      const primero = !yaSalioUno.current;
      yaSalioUno.current = true;
      const j = await postar({ action: 'enviar-real', secuenciaId: c.secuenciaId, destino: destinoReal, mensaje: m, primero });
      if (!j.ok) {
        if (primero) yaSalioUno.current = false;
        if (run.current === r0) sistema(`No salió · ${j.error ?? 'error'}`, 'bad');
      }
    });
  };

  /** Dibuja un mensaje del flujo como le llega al lead, y lo manda si el recorrido es de verdad. */
  const mostrarPaso = (p: PasoSecuenciaDto, nodo: string, redactado?: string, enRespuesta = false, minuto = 0) => {
    const c = ctx.current;
    const ahora = new Date().toISOString();
    if (p.canal === 'email') {
      // A la BANDEJA, con las variables del lead de ejemplo; lo que sale de verdad es lo que se ve.
      const correo = correoDeEjemplo(p, c.negocio);
      ponerCorreo({ id: nuevoId('em'), ...correo, minuto, leido: false });
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
        const delPaso: CanalProbar = paso.canal === 'email' ? 'email' : 'whatsapp';
        // UN CANAL POR VEZ: lo del otro canal ni se dibuja ni sale. El recorrido sigue igual (sus
        // esperas y sus condiciones son del flujo, no del canal).
        if (delPaso !== ctx.current.canal) { luego(0, avanzar); return; }
        const minuto = estado.ahora;
        if (delPaso === 'email') {
          setRecibiendo(true);
          luego(ESCRIBIENDO_MS, () => { setRecibiendo(false); mostrarPaso(paso, evento.nodo, undefined, evento.enRespuesta, minuto); luego(ENTRE_MS, avanzar); });
          return;
        }
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
        setTerminado(true);
        return;
    }
  }

  /** Arranca la prueba desde la primera tarjeta, con el flujo que se ve ahora. */
  const arrancarRefs = () => {
    flujoRef.current = flujoVivo;
    simRef.current = iniciar(flujoVivo);
    msgsRef.current = [];
    correosRef.current = [];
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
    // Sólo al montar: reiniciar es ↻, no cada tecla del lienzo. Otro canal es otro panel (`key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Vuelve a empezar. `deVerdad`: este recorrido sale al destino de abajo. ↻ es sin envío. */
  const reiniciar = (deVerdad = false) => {
    cortar();
    setMensajes([]); setTyping(null); setOpciones(null);
    setCorreos([]); setAbierto(null); setRecibiendo(false); setTerminado(false); setAviso(null);
    realRef.current = deVerdad; setReal(deVerdad);
    setFirmaProbada(firmaViva);
    arrancarRefs();
  };

  /** «Probar en mi WhatsApp / email»: el mismo recorrido, desde el principio y de verdad. */
  const probarDeVerdad = (e: FormEvent) => {
    e.preventDefault();
    if (!destino.trim()) return;
    reiniciar(true);
  };

  const elegirRama = (o: OpcionRama) => {
    setOpciones(null);
    simRef.current = elegir(simRef.current, o.puerto);
    sistema(`→ ${o.texto}`);
    luego(PILDORA_MS, avanzar);
  };

  const abrirCorreo = (id: string) => {
    setAbierto(id);
    correosRef.current = correosRef.current.map((c) => (c.id === id ? { ...c, leido: true } : c));
    setCorreos(correosRef.current);
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
  const esEmail = canal === 'email';

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

  /** Las ramas de una condición: quien prueba elige por dónde sigue (molde de ManyChat). */
  const ramas = opciones ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {opciones.map((o) => (
        <button key={o.puerto} type="button" onClick={() => elegirRama(o)} title={o.texto}
          style={{ maxWidth: '100%', padding: '6px 11px', borderRadius: 999, border: `1px solid ${o.puerto === 'si_no' ? 'var(--border-strong)' : 'var(--primary)'}`, background: 'var(--surface)', color: o.puerto === 'si_no' ? 'var(--dim)' : 'var(--primary)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {o.texto}
        </button>
      ))}
    </div>
  ) : undefined;

  return (
    <section aria-label="Probar" data-canal={canal} style={raiz}>
      <style>{CSS}</style>
      {/* La cabecera, en UN renglón: el nombre y el canal, «Cambió» si el flujo se editó, ↻ y ✕ Cerrar. */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 0', whiteSpace: 'nowrap' }}>
        <span style={{ flex: 'none', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Probar</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{esEmail ? 'Email' : 'WhatsApp'}</span>
        {cambio && (
          <button type="button" onClick={() => reiniciar()} title="Reiniciar con lo último"
            style={{ flex: 'none', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--warn)', cursor: 'pointer' }}>
            Cambió · ↻
          </button>
        )}
        <button type="button" onClick={() => reiniciar()} title="Reiniciar" aria-label="Reiniciar" style={iconBtn}>↻</button>
        <button type="button" onClick={() => { cortar(); onCerrar(); }} title="Cerrar" aria-label="Cerrar" style={cerrarBtn}>✕ Cerrar</button>
      </div>

      {/* El cuerpo va en una caja ABSOLUTA: `ChatHilo` se mide con `height: 100%`, y contra un
          alto que sale de `flex: 1` eso es CERO en Safari (AGENTS.md). Con `inset: 0` el alto
          es definido en los dos motores. */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {esEmail ? (
          <BandejaGmail correos={correos} abierto={abierto} recibiendo={recibiendo} terminado={terminado}
            remitente={remitente} negocio={negocio} onAbrir={abrirCorreo} onVolver={() => setAbierto(null)} />
        ) : (
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
              /* Una condición: adentro del chat y arriba de la barra, como las respuestas rápidas. */
              encimaDelComposer={ramas}
            />
          </div>
        )}
      </div>

      {/* En la bandeja no hay hilo: la última píldora y las ramas van en un renglón debajo. */}
      {esEmail && (ramas || aviso) && (
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 6, padding: '0 2px' }}>
          {aviso && <span role="status" style={{ fontSize: 12.5, color: aviso.tono === 'bad' ? 'var(--bad)' : 'var(--dim)', ...recorte }}>{aviso.texto}</span>}
          {ramas}
        </div>
      )}

      {/* PROBARLO DE VERDAD, con TU número o TU email según el canal. Sólo el admin manda. */}
      {rolAdmin && (real ? (
        <div role="status" style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 7, padding: '2px 2px 0', fontSize: 12.5, color: 'var(--dim)', ...recorte }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)', flex: 'none' }} />
          {esEmail ? 'Llega a tu email' : 'Llega a tu WhatsApp'}
        </div>
      ) : (
        <form onSubmit={probarDeVerdad} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={destino} onChange={(e) => setDestino(e.target.value)} inputMode={esEmail ? 'email' : 'tel'}
            aria-label={esEmail ? 'Tu email' : 'Tu WhatsApp'} placeholder={esEmail ? 'Tu email' : 'Tu número'} style={inpReal} />
          <Button type="submit" size="sm" disabled={!destino.trim()}>{esEmail ? 'Probar en mi email' : 'Probar en mi WhatsApp'}</Button>
        </form>
      ))}
    </section>
  );
}
