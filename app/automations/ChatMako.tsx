'use client';
// =============================================================================
// ChatMako — el chat con MaKo de UNA automatización, y la caja «Pídeselo a MaKo» del modal
// =============================================================================
// Duodécima tanda (12/10/2026, docs/diseno-duodecima-tanda.md §2.5, §2.6 y §3.4). Martín, textual: «tiene que tener
// un chat donde guarda el registro... como hoy lo hace Claude que te saltan una pregunta con tres opciones» y «que se
// guarde un registro tipo chat de las cosas que vos le fuiste pidiendo desde el primer pedido hasta el último».
//
// DECIMOTERCERA TANDA (12/10/2026, el pedido literal en el último hito de app/admin/dev/chatbot/bitacora.ts):
//   · PUNTO 6, «el chat con MaKo... exactamente igual en diseño al de WhatsApp... Solo cambiale unos colores»: el chat
//     ES el hilo de WhatsApp de la casa (`ChatHilo`, app/whatsapp/_shared/ChatHilo.tsx: la cinta de color, la cabecera,
//     el hilo con sus burbujas `BurbujaHilo`, el «escribiendo…» y la barra `ComposerWhatsApp` con el emoji, el
//     micrófono y la ➤). Cambian los colores (el dorado de MaKo en la cinta, las burbujas propias y la ➤) y lo que es
//     de MaKo: la pregunta con sus botones debajo de la burbuja (como los botones de respuesta de WhatsApp), los avisos
//     y las fases. Sin clip: MaKo no recibe archivos. La nota de voz se transcribe y viaja como texto.
//   · PUNTO 2, «al enviar no ocurre nada... Me debe crear automáticamente la nueva automatización en la sidebar, y
//     llevarme a ese lienzo... Que dentro aparezca un loader»: la barra del modal ya NO trabaja adentro del modal. Manda
//     el pedido a la tab (`onPedido`), que crea la fila YA (`crearNueva`, la de «Lienzo en blanco») y abre su lienzo
//     con este chat abierto y el pedido puesto (`pedidoInicial`). El chat lo manda solo, como CREAR sobre esa fila
//     (vacía y pausada: la ruta lo exige), y la tab tapa el lienzo mientras tanto (`onTrabajando`).
//   · PUNTO 1, «no se ve el placeholder, y tiene scroll... no aparece más la animación»: ⚠️ el diagnóstico obvio («se
//     borró la animación») era el equivocado. `useEjemploQueSeEscribe` seguía andando; lo que se rompía era el ALTO del
//     campo. La pila de modales pinta el modal con `display: none` en su PRIMER render (`decidirVisible` da false hasta
//     que el efecto lo mete en la pila, app/_components/pila-modales.ts), y el efecto del hijo corre ANTES: medía
//     `scrollHeight = 0`, le ponía `height: 0px` y no volvía a medir hasta que cambiara el texto. El campo quedaba en el
//     relleno, con el ejemplo escribiéndose fuera de la vista y la barra de scroll. Ahora la barra es `ComposerWhatsApp`,
//     que mide con el borde y tiene `minHeight`: un alto de 0 no lo colapsa.
//   · PUNTO 4: el logo de MaKo (`MakoLogo`, el del ✦ de la cabecera de una automatización), no la estrella de texto.
//   · PUNTO 7: lo que propone «MaKo te ayuda a escribirlo» en una tarjeta entra a ESTE hilo (lo guarda la ruta del ✦,
//     app/api/chat-agent/redactar/route.ts) con una línea que dice en qué tarjeta se apretó (`tarjeta`). Si el chat
//     está abierto, lo suma al momento (`useEscucharChatMako`, ./chat-mako-eventos.ts).
//
// CADA TURNO VUELVE A MANDAR EL PEDIDO ORIGINAL con las respuestas acumuladas (§3.4): una pregunta termina el stream,
// y la respuesta (un botón, «Elige tú» o «Otra cosa» con su texto) es OTRO POST. Lo que manda cada botón es puro y con
// test (`respuestaMako`, lib/flujo-ia-cliente.ts); qué ronda quedó abierta en un chat guardado, también
// (`rondaAbierta`). El lector del stream es ./stream-ia.ts.
//
// NO decide qué hacer con el resultado: crear ya lo GUARDÓ pausado; editar es un borrador local que el padre aplica con
// UNA foto de deshacer, y el CRON que eligió la persona lo guarda el padre por `action: 'disparadores'`.
//
// ⚠️ NADA INVENTADO: los botones de una pregunta son los rótulos del catálogo TAL CUAL (los arma el server), y el
// valor que viaja es el del catálogo. Acá no se escribe ninguna opción.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/app/_ui';
import { LinkIntegracion } from '@/app/_components/ConectarIntegracion';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { avisarCambioEtiquetas } from '@/app/_components/etiquetas-cliente';
import { transcribirNota } from '@/app/_components/useDictar';
import { ChatHilo, type HiloMsg } from '@/app/whatsapp/_shared/ChatHilo';
import { BurbujaHilo } from '@/app/whatsapp/_shared/BurbujaHilo';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { CajaPedido, ChipCaja, CSS_CAJA_PEDIDO, CSS_TOKENS_CASA, TITULO_CAJA } from '@/app/landing-generator/CajaPedido';
import { Ico } from '@/app/landing-generator/Ico';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { sanearChat, type MensajeChatMako, type PreguntaMako, type RespuestaMako } from '@/lib/automatizacion-chat';
import { ordenarAvisos, rondaAbierta, respuestaMako, textoDeCreada, ELIGE_TU, OTRA_COSA, type EleccionMako, type RondaMako } from '@/lib/flujo-ia-cliente';
import type { PasoGrafo } from '@/lib/flujo-grafo';
import { useStreamIA, RUTA_IA, TOPE_CLIENTE_MS, TEXTO_FASE, ORDEN_FASES, type EstadoIA, type ListoStreamIA } from './stream-ia';
import { EJEMPLOS, PLACEHOLDER_QUIETO, ACCEPT_ARCHIVO_FLUJO, pedidoConArchivo, type ListoCrearIA } from './CrearConIA';
import { leerArchivoParaPedido } from './archivo-pedido-cliente';
import { copiaPegada, rotuloFlujoPegado } from '@/lib/flujo-copia';
import { resumenDePegado } from './copia-flujo-cliente';
import { useEscucharChatMako } from './chat-mako-eventos';

/** Los colores de MaKo sobre el hilo de WhatsApp (punto 6: «Solo cambiale unos colores»). */
export const COLORES_MAKO = {
  cinta: 'var(--mako)', burbuja: 'var(--mako-bg)', borde: 'var(--mako-border)', enviar: 'var(--mako)',
  fondo: 'color-mix(in srgb, var(--mako-bg) 35%, var(--surface-2))',
} as const;

export type ChatMakoProps = {
  /** La automatización de este chat (su hilo vive en `automatizacion.chat:<id>`). */
  secuenciaId: number;
  /** El borrador LOCAL del lienzo (puede tener cambios sin publicar). VACÍO = MaKo CREA sobre esta fila. */
  pasos: readonly PasoGrafo[];
  /**
   * Cuántas tarjetas tiene lo PUBLICADO. Con alguna, MaKo no crea aunque el borrador esté vacío: crear escribe encima en
   * el server, que contesta 409 (no se pisa un flujo publicado: puede tener leads adentro). Edita sobre el borrador vacío,
   * y lo que arma queda en el borrador hasta Publicar.
   */
  publicadas?: number;
  /** `false` = no lo aplicó (editar sobre un lienzo que cambió): el pedido vuelve a la barra. */
  onListo: (r: ListoCrearIA) => boolean | void;
  /** El ✕ del chat. */
  onCerrar?: () => void;
  /** Mientras MaKo trabaja: quien monta tapa el lienzo (y deja el chat encima de la capa). */
  onTrabajando?: (trabajando: boolean) => void;
  deshabilitado?: boolean;
  /** El hilo con el que arranca (lo usan las pruebas; el lienzo lo trae por GET). */
  inicial?: readonly MensajeChatMako[];
  /**
   * EL PEDIDO CON EL QUE NACIÓ (punto 2): el de «Pídeselo a MaKo» del modal. Se manda SOLO al montar, una vez; quien
   * monta se entera por `onPedidoInicialUsado` y no lo vuelve a pasar.
   */
  pedidoInicial?: string | null;
  onPedidoInicialUsado?: () => void;
};

/** Lo que dice el campo en el lienzo, y con una pregunta abierta (la respuesta escrita es «Otra cosa»). */
export const PLACEHOLDER_EDITAR = 'Pídele un cambio';
export const PLACEHOLDER_OTRA = 'Escribe tu respuesta';
/** El lienzo cambió mientras MaKo trabajaba: el resultado no se aplica (`edicionVigente`). */
export const NO_APLICADO = 'Cambiaste el flujo: pídelo de nuevo';
/** Debajo del nombre, como en WhatsApp. */
export const ESTADO_EN_LINEA = 'en línea';
export const ESTADO_ESCRIBIENDO = 'escribiendo…';
/** La línea del hilo que dice de qué tarjeta salió un pedido del ✦ (punto 7). */
export const ROTULO_TARJETA = 'MaKo te ayuda en';
/** Lo que se lee con el hilo vacío. */
export const VACIO_EDITAR = 'Pídele lo que quieras cambiar';
export const VACIO_CREAR = 'Cuéntale qué tiene que pasar';

let cuenta = 0;
/** Un id de mensaje (≤ 80, `sanearMensaje`): único en la pestaña y entre pestañas. */
const nuevoId = (de: 'yo' | 'mako') => `${de}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${(cuenta++).toString(36)}`;

/**
 * LO QUE DICE MaKo AL TERMINAR UNA EDICIÓN: el resumen del server («Cambié 3 · saqué 1 · agregué 2», armado por
 * código) y, si no vino (un server de antes), uno por código con lo que se sabe. Corto.
 */
export function textoDeListo(l: Pick<ListoStreamIA, 'resumen' | 'disparadores' | 'orden'>): string {
  const r = l.resumen?.trim();
  if (r) return r;
  if (l.disparadores?.length) return 'Cambié qué la dispara';
  const n = l.orden.length;
  if (n) return n === 1 ? 'Agregué 1 tarjeta' : `Agregué ${n} tarjetas`;
  return 'Listo';
}

/** El hilo guardado y lo de esta pantalla, sin repetir ids (gana lo guardado, en su orden). */
export function juntarHilo(guardados: readonly MensajeChatMako[], locales: readonly MensajeChatMako[]): MensajeChatMako[] {
  const ids = new Set(guardados.map((m) => m.id));
  return [...guardados, ...locales.filter((m) => !ids.has(m.id))];
}

/**
 * EL HILO COMO LO DIBUJA EL CHAT DE WHATSAPP (`ChatHilo`): cada mensaje en su lado, y ANTES de un pedido que salió del
 * ✦ de una tarjeta, la línea de sistema que lo dice («MaKo te ayuda en «WHATSAPP: Hola…»», punto 7). Pura.
 */
export function hiloDeChat(mensajes: readonly MensajeChatMako[]): HiloMsg[] {
  return mensajes.flatMap((m): HiloMsg[] => [
    ...(m.de === 'yo' && m.tarjeta ? [{ id: `${m.id}:tarjeta`, fromMe: false, tipo: 'sistema', texto: `${ROTULO_TARJETA} «${m.tarjeta}»` }] : []),
    { id: m.id, fromMe: m.de === 'yo', texto: m.texto, fecha: m.at, autor: m.de === 'mako' ? 'MaKo' : null },
  ]);
}

/** La hora del mensaje, como la pone WhatsApp. */
const horaDe = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

/** ¿La tecla nace en un campo de texto? (la lista y su buscador siguen andando mientras MaKo trabaja). */
const esCampo = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

export function ChatMako(p: ChatMakoProps) {
  const crea = p.pasos.length === 0 && !(p.publicadas ?? 0);
  const [mensajes, setMensajes] = useState<MensajeChatMako[]>(() => [...(p.inicial ?? [])]);
  /** La ronda que espera respuesta (la pregunta de ahora, el pedido original y lo ya contestado). */
  const [ronda, setRonda] = useState<RondaMako | null>(() => rondaAbierta(p.inicial ?? []));
  const [error, setError] = useState<{ texto: string; link?: string } | null>(null);
  /** Lo que vuelve a la barra cuando un pedido que no nació en ella no salió (`ChatHilo.ponerBorrador`). */
  const [devolver, setDevolver] = useState<{ texto: string; vez: number } | null>(null);
  const { estado, trabajando, enviar, cancelar } = useStreamIA();
  const [ahora, setAhora] = useState(() => Date.now());
  const raizRef = useRef<HTMLDivElement | null>(null);
  /** Turnos hechos en esta pantalla: si ya hubo uno, el GET no pisa la ronda de acá. */
  const turnos = useRef(0);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  /**
   * ⚠️ EL `onListo` DE AHORA, NO EL DEL CLIC (revisión, 09/10/2026). El turno cierra sobre las props del render en que
   * se hizo clic: llamar a `p.onListo` al terminar llamaba al del padre de hace un minuto, con SU `pasos` de entonces,
   * y la comparación con el lienzo de ahora daba siempre igual. El ref se actualiza en cada render.
   */
  const onListoRef = useRef(p.onListo);
  useEffect(() => { onListoRef.current = p.onListo; });

  // El reloj de lo que lleva (progreso real, no decorativo). Corre sólo mientras trabaja.
  useEffect(() => {
    if (!trabajando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [trabajando]);
  // Quien monta tapa el lienzo mientras MaKo trabaja (y lo destapa si el chat se desmonta en el medio).
  const onTrabajandoRef = useRef(p.onTrabajando);
  useEffect(() => { onTrabajandoRef.current = p.onTrabajando; });
  useEffect(() => { onTrabajandoRef.current?.(trabajando); }, [trabajando]);
  useEffect(() => () => { onTrabajandoRef.current?.(false); }, []);

  // EL CHAT GUARDADO: GET ?secuenciaId=. Si falla, el hilo arranca vacío y nada se bloquea. Una fila que acaba de nacer
  // con un pedido (`pedidoInicial`) no tiene chat todavía: no se pide (la ruta escribe el turno mientras tanto).
  const secId = p.secuenciaId;
  const conPedido = !!p.pedidoInicial?.trim();
  useEffect(() => {
    if (conPedido) return;
    let sigue = true;
    void (async () => {
      try {
        const r = await fetch(`${RUTA_IA}?secuenciaId=${secId}`, { cache: 'no-store' });
        const j = await r.json().catch(() => null) as { ok?: boolean; mensajes?: unknown } | null;
        if (!sigue || !r.ok || !j?.ok) return;
        const guardados = sanearChat({ v: 1, mensajes: j.mensajes }).mensajes;
        if (!guardados.length) return;
        setMensajes((locales) => juntarHilo(guardados, locales));
        if (!turnos.current) setRonda(rondaAbierta(guardados));
      } catch { /* sin chat guardado: arranca vacío */ }
    })();
    return () => { sigue = false; };
    // Una vez por automatización (el pedido inicial sólo decide la primera).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secId]);

  // LO QUE ENTRÓ POR EL ✦ DE UNA TARJETA (punto 7) mientras el chat está montado: al hilo, sin repetir.
  useEscucharChatMako(secId, useCallback((ms: MensajeChatMako[]) => setMensajes((locales) => juntarHilo(locales, ms)), []));

  /**
   * ⚠️ MIENTRAS TRABAJA, EL TECLADO NO LLEGA AL LIENZO (tercera tanda, punto 6). La capa de quien monta se traga los
   * clics, pero un atajo vive en `document` (el deshacer del lienzo, Suprimir sobre una tarjeta): se corta en CAPTURA
   * lo que no nace en el chat ni en un campo de texto. Escape cancela, igual que el botón, y sólo cuando el botón está
   * (en «Revisando el flujo» el server ya no mira la señal).
   */
  const fase = estado.t === 'trabajando' ? estado.fase : null;
  useEffect(() => {
    if (!trabajando) return;
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fase !== 'revision') { e.preventDefault(); e.stopImmediatePropagation(); cancelar(); return; }
      if (raizRef.current && e.target instanceof Node && raizRef.current.contains(e.target)) return;
      if (esCampo(e.target)) return;
      // Sin `preventDefault`: los atajos del NAVEGADOR siguen andando; lo que se corta es que lleguen a los de la app.
      e.stopImmediatePropagation();
    };
    document.addEventListener('keydown', alTeclado, true);
    return () => document.removeEventListener('keydown', alTeclado, true);
  }, [trabajando, fase, cancelar]);

  /**
   * UN TURNO: lo que dijo la persona entra al hilo YA y sale el POST con el pedido ORIGINAL de la ronda y las
   * respuestas acumuladas. Cancelar o un error lo sacan del hilo; lo escrito vuelve a la barra (lo devuelve el hilo de
   * WhatsApp con `{ error }`, o `devolver` si no nació en la barra). El próximo ➤ es reintentar.
   *   · `origen: 'barra'` — lo escribió en la barra (ChatHilo lo devuelve solo);
   *   · `origen: 'afuera'` — el pedido con que nació la fila, o una nota de voz transcrita (lo devuelve `devolver`);
   *   · `origen: 'boton'` — una opción de una pregunta (la pregunta sigue viva: se vuelve a tocar).
   */
  const turno = async (dicho: string, respuesta: RespuestaMako | null, origen: 'barra' | 'afuera' | 'boton'): Promise<true | { error: string | null }> => {
    if (trabajando || p.deshabilitado) return origen === 'barra' ? { error: null } : true;
    const yo: MensajeChatMako = {
      id: nuevoId('yo'), de: 'yo', texto: dicho, at: new Date().toISOString(), via: 'app', ...(respuesta ? { respuesta } : {}),
    };
    const enCurso = respuesta && ronda
      ? { pedido: ronda.pedido, respuestas: [...ronda.respuestas, respuesta] }
      : { pedido: dicho, respuestas: [] as RespuestaMako[] };
    turnos.current += 1;
    setMensajes((ms) => [...ms, yo]); setError(null); setAhora(Date.now());
    // Con el lienzo VACÍO, MaKo CREA sobre esta fila (la ruta exige que siga vacía y pausada); con tarjetas, EDITA el
    // borrador que se manda (vuelve en `onListo` como `base`).
    const modo = crea ? 'crear' : 'editar';
    const base = modo === 'editar' ? p.pasos : undefined;
    const fin = await enviar({
      pedido: enCurso.pedido, modo, respuestas: enCurso.respuestas, secuenciaId: p.secuenciaId,
      ...(base ? { pasos: base } : {}),
      // El hilo de ANTES del turno. La ruta guarda el turno y busca ahí la pregunta que se contesta: el rótulo del «yo» y
      // el «Elige tú» del CRON (`respuestaDelCron`). Con el turno al final, `turnoDelUsuario` creía que ya estaba.
      historial: mensajes,
    });
    if (!vivo.current) return true;
    const deshacer = (e: { texto: string; link?: string } | null): true | { error: string | null } => {
      setMensajes((ms) => ms.filter((m) => m.id !== yo.id));
      setError(e);
      if (origen === 'barra') return { error: null };
      if (origen === 'afuera') setDevolver((d) => ({ texto: dicho, vez: (d?.vez ?? 0) + 1 }));
      return true;
    };
    // Cancelar no es un error: lo escrito vuelve a la barra.
    if (fin.t === 'cancelado') return deshacer(null);
    if (fin.t === 'error') return deshacer({ texto: fin.error, ...(fin.link ? { link: fin.link } : {}) });
    if (fin.t === 'pregunta') {
      setMensajes((ms) => [...ms, fin.mensaje]);
      setRonda({ ...enCurso, pregunta: fin.pregunta });
      return true;
    }
    const l = fin.listo;
    // ⚠️ LAS ETIQUETAS QUE CREÓ EL SERVER (revisión, 09/10/2026): `crearEtiqueta` corre en la ruta, no pasa por
    // `crearEtiquetaCliente`, y las listas de la pestaña ya estaban pedidas. Va ANTES de `onListo`: las tarjetas nuevas
    // se dibujan con la lista nueva.
    if (l.etiquetasNuevas.length) avisarCambioEtiquetas();
    const aplicado = onListoRef.current({
      modo: l.modo, secuenciaId: l.secuenciaId, pasos: l.pasos, nombre: l.nombre, orden: l.orden,
      avisos: l.avisos, etiquetasNuevas: l.etiquetasNuevas, disparador: l.disparador ?? null, base,
      ...(l.resumen !== undefined ? { resumen: l.resumen } : {}),
      ...(l.cambiadas ? { cambiadas: l.cambiadas } : {}),
      ...(l.quitadas ? { quitadas: l.quitadas } : {}),
      ...(l.disparadores !== undefined ? { disparadores: l.disparadores } : {}),
      ...(l.pregunta ? { pregunta: l.pregunta } : {}),
    });
    if (!vivo.current) return true;
    // Si el padre no lo aplicó (el lienzo cambió en el medio), el pedido vuelve a la barra.
    if (aplicado === false) return deshacer({ texto: NO_APLICADO });
    // «¿Cambio qué la dispara?» (§2.6): una ronda NUEVA sobre el mismo pedido (su respuesta no vuelve a editar).
    setRonda(l.pregunta ? { pedido: enCurso.pedido, respuestas: [], pregunta: l.pregunta } : null);
    const avisos = ordenarAvisos(l.avisos ?? []);
    setMensajes((ms) => [...ms, {
      id: nuevoId('mako'), de: 'mako', texto: l.modo === 'crear' ? textoDeCreada(l.nombre) : textoDeListo(l), at: new Date().toISOString(), via: 'app',
      ...(avisos.length ? { avisos } : {}), ...(l.pregunta ? { pregunta: l.pregunta } : {}),
    }]);
    return true;
  };

  // EL PEDIDO CON EL QUE NACIÓ LA FILA (punto 2), una vez por pedido. En un `setTimeout` y no en el cuerpo del
  // efecto: en desarrollo React desmonta y vuelve a montar los efectos, y el desmonte de `useStreamIA` cortaba el
  // pedido recién salido.
  const pedidoUsado = useRef<string | null>(null);
  const turnoRef = useRef(turno);
  useEffect(() => { turnoRef.current = turno; });
  const avisoUsado = useRef(p.onPedidoInicialUsado);
  useEffect(() => { avisoUsado.current = p.onPedidoInicialUsado; });
  const pedidoInicial = p.pedidoInicial?.trim() || null;
  useEffect(() => {
    if (!pedidoInicial || pedidoUsado.current === pedidoInicial) return;
    const h = setTimeout(() => {
      if (pedidoUsado.current === pedidoInicial) return;
      pedidoUsado.current = pedidoInicial;
      avisoUsado.current?.();
      void turnoRef.current(pedidoInicial, null, 'afuera');
    }, 0);
    return () => clearTimeout(h);
  }, [pedidoInicial]);

  /** ➤ (o Enter): con una pregunta abierta, lo escrito ES «Otra cosa»; si no, un pedido nuevo. */
  const enviarTexto = async (texto: string, origen: 'barra' | 'afuera'): Promise<true | { error: string | null }> => {
    const t = texto.trim();
    if (!t) return true;
    if (ronda) { const r = respuestaMako(ronda.pregunta, { texto: t }); return turno(r.texto, r.respuesta, origen); }
    return turno(t, null, origen);
  };
  /** La nota de voz (✓ termina, ➤ manda): se transcribe y viaja como lo escrito. */
  const enviarAudio = async (blob: Blob): Promise<boolean> => {
    setError(null);
    const r = await transcribirNota(blob);
    if (!vivo.current) return true;
    if (!r.ok) { setError({ texto: r.error }); return true; }
    if (!r.texto.trim()) { setError({ texto: 'No se entendió el audio' }); return true; }
    await enviarTexto(r.texto, 'afuera');
    return true;
  };
  const elegir = (e: EleccionMako) => {
    if (!ronda) return;
    const r = respuestaMako(ronda.pregunta, e);
    void turno(r.texto, r.respuesta, 'boton');
  };

  const preguntaViva = !trabajando && ronda ? ronda.pregunta : null;
  const ultimoMako = mensajes.reduce((k, m, i) => (m.de === 'mako' ? i : k), -1);
  const porId = useMemo(() => new Map(mensajes.map((m, i) => [m.id, { m, i }] as const)), [mensajes]);
  const hilo = useMemo(() => hiloDeChat(mensajes), [mensajes]);
  const segundos = estado.t === 'trabajando' ? Math.max(0, Math.round((ahora - estado.desde) / 1000)) : 0;
  const placeholder = ronda ? PLACEHOLDER_OTRA : crea ? PLACEHOLDER_QUIETO : PLACEHOLDER_EDITAR;

  const cabecera = (
    <div data-cabecera-mako="" style={S.cabecera}>
      <MakoLogo size={30} animate={false} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.nombre}>MaKo</div>
        <div style={{ ...S.estado, color: trabajando ? 'var(--mako-ink)' : 'var(--faint)' }}>{trabajando ? ESTADO_ESCRIBIENDO : ESTADO_EN_LINEA}</div>
      </div>
      {p.onCerrar && (
        <button type="button" className="chm-x" onClick={p.onCerrar} aria-label="Cerrar el chat" title="Cerrar">✕</button>
      )}
    </div>
  );

  const encima = estado.t === 'trabajando'
    ? <FasesIA estado={estado} segundos={segundos} onCancelar={cancelar} />
    : error ? <p data-error-mako="" style={S.error} role="alert"><TextoConLink texto={error.texto} link={error.link} /></p> : null;

  return (
    <div ref={raizRef} data-chat-mako="editar" style={S.raiz}>
      <style>{CSS}</style>
      <ChatHilo
        mensajes={hilo}
        header={cabecera}
        accent={COLORES_MAKO.cinta}
        accentBubble={COLORES_MAKO.burbuja}
        fondoHilo={COLORES_MAKO.fondo}
        acentoEnviar={COLORES_MAKO.enviar}
        onEnviarTexto={(t) => enviarTexto(t, 'barra')}
        onEnviarAudio={(b) => enviarAudio(b)}
        placeholder={placeholder}
        typing={trabajando ? { lado: 'left', autor: 'MaKo' } : null}
        draftKey={`mako-chat:${secId}`}
        animarNuevos
        ponerBorrador={devolver}
        encimaDelComposer={encima}
        vacio={<div style={S.vacio}>{crea ? VACIO_CREAR : VACIO_EDITAR}</div>}
        renderMensaje={(h) => {
          const x = porId.get(String(h.id));
          if (!x) return null;
          const viva = x.i === mensajes.length - 1 && preguntaViva && x.m.pregunta?.id === preguntaViva.id ? preguntaViva : null;
          return <Mensaje m={x.m} viva={viva} ultimo={x.i === ultimoMako} onElegir={elegir}
            deshabilitado={trabajando || !!p.deshabilitado} />;
        }}
      />
    </div>
  );
}

/**
 * Un mensaje del hilo, con la burbuja de WhatsApp. El de MaKo lleva debajo sus avisos y, si es la pregunta VIVA (la
 * última, sin contestar), sus botones; las de antes, sólo el texto.
 */
function Mensaje({ m, viva, ultimo, onElegir, deshabilitado }: {
  m: MensajeChatMako; viva: PreguntaMako | null; ultimo: boolean; onElegir: (e: EleccionMako) => void; deshabilitado: boolean;
}) {
  if (m.de === 'yo') {
    return (
      <div data-mensaje="yo" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <BurbujaHilo saliente fondo={COLORES_MAKO.burbuja} borde={COLORES_MAKO.borde} contenido={{ texto: m.texto }} hora={horaDe(m.at)} />
      </div>
    );
  }
  const preguntaAparte = m.pregunta && m.pregunta.texto.trim() !== m.texto.trim() ? m.pregunta.texto : null;
  const texto = [m.texto, preguntaAparte].filter((t) => t && t.trim()).join('\n\n');
  return (
    <div data-mensaje="mako" style={S.filaMako}>
      <BurbujaHilo saliente={false} autor="MaKo" maxAncho="92%" contenido={{ texto }} hora={horaDe(m.at)} />
      {m.avisos?.length ? (
        <ul data-avisos-mako="" style={{ ...S.avisos, ...(ultimo ? null : { opacity: 0.75 }) }}>
          {m.avisos.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      ) : null}
      {viva && <TarjetaPregunta pregunta={viva} onElegir={onElegir} deshabilitado={deshabilitado} />}
    </div>
  );
}

/**
 * LA PREGUNTA COMO LOS BOTONES DE RESPUESTA DE WHATSAPP (§2.4, el molde de Claude): de 2 a 4 botones con los rótulos
 * del catálogo TAL CUAL, más «Otra cosa» (enfoca la barra: lo que se escriba es la respuesta) y «Elige tú» (`valor:
 * null`: MaKo elige sola). Exportada: la dibuja el test.
 */
export function TarjetaPregunta({ pregunta, onElegir, onOtraCosa, deshabilitado }: {
  pregunta: PreguntaMako; onElegir: (e: EleccionMako) => void; onOtraCosa?: () => void; deshabilitado?: boolean;
}) {
  // «Otra cosa»: la barra de abajo (la del hilo), con el foco. Sin quien la enfoque, la busca en el chat.
  const otraCosa = (e: { currentTarget: HTMLElement }) => {
    if (onOtraCosa) { onOtraCosa(); return; }
    e.currentTarget.closest('[data-chat-mako]')?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
  };
  return (
    <div data-pregunta-mako={pregunta.sobre} style={S.opciones} role="group" aria-label={pregunta.texto}>
      {pregunta.opciones.map((o) => (
        <button key={o.valor} type="button" className="chm-op" data-opcion={o.valor} title={o.detalle}
          disabled={deshabilitado} onClick={() => onElegir({ valor: o.valor })}>{o.label}</button>
      ))}
      <button type="button" className="chm-op chm-op--suave" data-otra-cosa="" disabled={deshabilitado} onClick={otraCosa}>{OTRA_COSA}</button>
      <button type="button" className="chm-op chm-op--suave" data-elige-tu="" disabled={deshabilitado} onClick={() => onElegir({ eligeTu: true })}>{ELIGE_TU}</button>
    </div>
  );
}

/** Las fases REALES del server, lo que lleva y Cancelar (menos en «Revisando el flujo»), arriba de la barra. */
function FasesIA({ estado, segundos, onCancelar }: {
  estado: Extract<EstadoIA, { t: 'trabajando' }>; segundos: number; onCancelar: () => void;
}) {
  const actual = estado.fase ? ORDEN_FASES.indexOf(estado.fase) : -1;
  return (
    <div style={S.fases} role="status" aria-live="polite" data-crear-ia-fases="">
      <span aria-hidden style={S.puntos}>
        {ORDEN_FASES.map((f, i) => (
          <span key={f} style={{ ...S.punto, background: i < actual ? 'var(--good)' : i === actual ? 'var(--mako)' : 'var(--border)' }} />
        ))}
      </span>
      <span style={S.rotulo}>{estado.fase ? TEXTO_FASE[estado.fase] : GRAMATICA.analizando.rotulo}</span>
      {estado.fase === 'revision' && estado.reparadas ? <span style={S.dim}>· {estado.reparadas} {estado.reparadas === 1 ? 'arreglo' : 'arreglos'}</span> : null}
      {/* ⚠️ EL TOPE SALE DEL TOPE REAL (revisión, 09/10/2026): «75 s · hasta 1 min» se lee como colgado y la persona
          cancela un pedido que iba a terminar. */}
      <span style={{ ...S.dim, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{segundos} s · hasta {Math.round(TOPE_CLIENTE_MS / 60_000)} min</span>
      {/* ⚠️ SIN «Cancelar» EN «Revisando el flujo» (revisión, 09/10/2026): el server mira la señal una sola vez, antes de
          esa fase, y después crea las etiquetas y guarda igual. */}
      {estado.fase !== 'revision' && <Button variant="tertiary" size="sm" onClick={onCancelar}>Cancelar</Button>}
    </div>
  );
}

/**
 * El error, con la palabra «Integraciones» convertida en el lugar donde se arregla (si lo hay). Un link que nombra una
 * integración (`/integraciones?abrir=gemini`) abre SU modal acá (`LinkIntegracion`, 14/10/2026: «para una integración
 * jamás se debe salir de la tab»); cualquier otro sigue siendo un link.
 */
function TextoConLink({ texto, link }: { texto: string; link?: string }) {
  if (!link) return <>{texto}</>;
  const i = texto.indexOf('Integraciones');
  if (i < 0) return <>{texto} <LinkIntegracion href={link} style={S.link}>Abrir</LinkIntegracion></>;
  return <>{texto.slice(0, i)}<LinkIntegracion href={link} style={S.link}>Integraciones</LinkIntegracion>{texto.slice(i + 'Integraciones'.length)}</>;
}

// ── «Pídeselo a MaKo»: la caja del modal «Nueva automatización» ─────────────────────────────────────

/** El «+» de la caja (decimoquinta tanda, punto 7): subir un archivo o una imagen, y pegar un flujo. */
export const MAS_ARCHIVO = 'archivo';
export const MAS_PEGAR = 'pegar';

/**
 * EL «+» DE LA CAJA (decimoquinta tanda, punto 7). Martín, textual: «en el botón de "+" en esa sección, no tiene sentido
 * las opciones de lienzo en blanco y plantilla, si para eso ya tenemos eso abajo, ahí se debería poder cargar archivos o
 * imagenes para que la IA lo interprete y cree flujo a raiz de eso... Y también ahí una opción para pegar el flujo que
 * copié o me pasaron con el botón de "Copiar flujo"». «Pegar un flujo» sólo si quien monta puede crearlo (`onFlujo`).
 * Pura y exportada para el test.
 */
export function accionesMas(conPegar: boolean): DropdownOption[] {
  return [
    { value: MAS_ARCHIVO, label: 'Subir archivo o imagen', icono: 'subir' },
    ...(conPegar ? [{ value: MAS_PEGAR, label: 'Pegar un flujo', icono: 'copiar' as const }] : []),
  ];
}

/** Lo que dice la caja cuando lo pegado no es un flujo (o el token no existe). */
export const NO_ES_FLUJO = 'No encontré ese flujo.';
/** «Pegar un flujo» sin un flujo en el portapapeles. */
export const SIN_FLUJO_COPIADO = 'No hay un flujo copiado.';
/** «Pegar un flujo» sin permiso para leer el portapapeles. */
export const PEGALO_A_MANO = 'Pega el flujo en la caja (Ctrl+V).';
/** El placeholder con un archivo adjunto (el ejemplo no se mueve: el pedido ya es el archivo). */
export const PLACEHOLDER_ARCHIVO = 'Qué hacer con el archivo (opcional)';

/** El archivo de la caja: leyéndose, leído (con su texto) o que no se pudo leer. */
type ArchivoCaja = { nombre: string; imagen: boolean } & ({ estado: 'leyendo' } | { estado: 'listo'; texto: string } | { estado: 'error' });

/**
 * LA CAJA DE «PÍDESELO A MaKo» (décima tanda, punto 6; decimotercera, puntos 1, 2 y 4; decimocuarta, puntos 1 y 2;
 * DECIMOQUINTA, puntos 1, 6, 7 y 8). Martín, 12/10/2026, con la captura de la caja «¿Qué vas a crear hoy?» del Landing
 * Generator: «Vuelve a crear el modal de "pideselo a MaKo" y que se vea exactamente igual que en la captura... Ya lo
 * tenemos en landing generator, copialo» y «elimina el texto de "Nace pausada"». ES ESA CAJA (`CajaPedido`,
 * app/landing-generator/CajaPedido.tsx), no una copia: el título «¿Qué vas a crear hoy?» (decimoquinta, punto 1), la
 * tarjeta blanca, el ejemplo que se escribe solo (`EJEMPLOS`: para mientras la caja tiene el foco y vuelve si se sale
 * sin escribir, punto 6), el «+» azul, el micrófono de la casa (dicta en el campo; se lee antes de mandar) y el ↑.
 *
 * El «+» (decimoquinta, punto 7, `accionesMas`):
 *   · «Subir archivo o imagen»: lo lee el server con el lector de la casa (`archivoATexto`; una imagen, por visión) y
 *     queda como chip arriba del campo. Al enviar, va al pedido con lo escrito (`pedidoConArchivo`, ./CrearConIA.tsx).
 *   · «Pegar un flujo»: lee el portapapeles. Lo mismo que pegar con Ctrl+V en el campo.
 * UN FLUJO PEGADO (decimoquinta, punto 8: «en lugar de ver el token debería decir "Flujo copiado: NOMBRE DEL FLUJO"»):
 * un token o el texto entero de una copia SALE del campo (`copiaPegada`) y en su lugar se lee «Flujo copiado: <nombre>»
 * (el nombre lo da el server: `resumenDePegado`). El ↑ lo crea en ESTE negocio (`onFlujo`, «Pegar lo copiado»).
 *
 * ⚠️ SIN EL CHIP «Plan | Express» de la landing: acá no hay un modo que elegir (MaKo pregunta lo que le falta en el chat
 * de la fila, con botones). Un chip que no cambia nada sería inventado.
 *
 * NO trabaja acá: manda el pedido a quien monta (`onPedido`), que cierra el modal, crea la fila YA y abre su lienzo con el
 * chat (decimotercera, punto 2).
 */
export function BarraPideselo({ onPedido, onFlujo, deshabilitado, inicial }: {
  onPedido: (pedido: string) => void;
  /** Crear la automatización de un flujo pegado (el token o el texto entero). Sin esto, ni «Pegar un flujo» ni el chip. */
  onFlujo?: (copia: string) => void;
  deshabilitado?: boolean;
  /** Lo escrito que vuelve (la fila no se pudo crear): con algo escrito, el ejemplo no se mueve. */
  inicial?: string | null;
}) {
  const [texto, setTexto] = useState(inicial ?? '');
  const [error, setError] = useState<string | null>(null);
  /** El flujo pegado: lo que va al server y su nombre (null mientras el server contesta). */
  const [flujo, setFlujo] = useState<{ copia: string; nombre: string | null } | null>(null);
  const [archivo, setArchivo] = useState<ArchivoCaja | null>(null);
  const vezFlujo = useRef(0);
  const subida = useRef<AbortController | null>(null);
  const elegirArchivo = useRef<HTMLInputElement>(null);
  useEffect(() => () => subida.current?.abort(), []);

  const quitarArchivo = () => { subida.current?.abort(); subida.current = null; setArchivo(null); };
  const ponerFlujo = (copia: string) => {
    const vez = ++vezFlujo.current;
    quitarArchivo();
    setError(null);
    setFlujo({ copia, nombre: null });
    void resumenDePegado(copia).then((r) => {
      if (vezFlujo.current !== vez) return;
      if (!r) { setFlujo(null); setError(NO_ES_FLUJO); return; }
      setFlujo({ copia, nombre: r.nombre });
    });
  };
  const quitarFlujo = () => { vezFlujo.current++; setFlujo(null); };
  /** Lo escrito o pegado en el campo: un flujo de MaKo sale del texto y queda como «Flujo copiado: …». */
  const alEscribir = (v: string) => {
    const pegado = onFlujo ? copiaPegada(v) : null;
    if (pegado) { setTexto(pegado.resto); ponerFlujo(pegado.copia); return; }
    setTexto(v);
  };
  const pegarDelPortapapeles = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) { setError(PEGALO_A_MANO); return; }
    navigator.clipboard.readText().then((t) => {
      const pegado = copiaPegada(t);
      if (!pegado) { setError(SIN_FLUJO_COPIADO); return; }
      ponerFlujo(pegado.copia);
    }).catch(() => setError(PEGALO_A_MANO));
  };
  const subir = (file: File) => {
    quitarFlujo();
    quitarArchivo();
    setError(null);
    const base = { nombre: file.name, imagen: file.type.startsWith('image/') };
    const ac = new AbortController();
    subida.current = ac;
    setArchivo({ ...base, estado: 'leyendo' });
    void leerArchivoParaPedido(file, ac.signal).then((r) => {
      if (ac.signal.aborted) return;
      if (!r.ok) { setArchivo({ ...base, estado: 'error' }); setError(r.error); return; }
      setArchivo({ ...base, estado: 'listo', texto: r.texto });
    });
  };
  const alMas = (v: string) => {
    if (v === MAS_ARCHIVO) elegirArchivo.current?.click();
    else if (v === MAS_PEGAR) pegarDelPortapapeles();
  };
  /** ¿Se puede mandar? Un flujo con nombre, un archivo leído, o algo escrito (y nada leyéndose). */
  const listo = flujo ? !!flujo.nombre : archivo ? archivo.estado === 'listo' : !!texto.trim();
  const mandar = () => {
    if (deshabilitado || !listo) return;
    setError(null);
    if (flujo) { onFlujo?.(flujo.copia); return; }
    if (archivo?.estado === 'listo') { onPedido(pedidoConArchivo(texto, { nombre: archivo.nombre, texto: archivo.texto })); return; }
    onPedido(texto.trim());
  };
  return (
    <div className="gp cp-casa" data-chat-mako="galeria" data-crear-ia-caja="galeria">
      <style>{CSS_TOKENS_CASA + CSS_CAJA_PEDIDO}</style>
      <CajaPedido titulo={{ texto: TITULO_CAJA, nivel: 2 }} valor={texto} onValor={alEscribir} onEnviar={mandar} listo={listo}
        ejemplos={EJEMPLOS} animar={!archivo} placeholderQuieto={archivo ? PLACEHOLDER_ARCHIVO : PLACEHOLDER_QUIETO}
        etiqueta="Qué tiene que hacer la automatización" deshabilitado={deshabilitado} onError={setError}
        adjunto={archivo ? (
          <ChipCaja icono={archivo.imagen ? 'imagen' : 'archivo'} texto={archivo.nombre} error={archivo.estado === 'error'}
            detalle={archivo.estado === 'leyendo' ? 'Leyendo…' : null} onQuitar={quitarArchivo} etiquetaQuitar="Quitar el archivo" />
        ) : null}
        enLugarDelCampo={flujo ? (
          <ChipCaja icono="flujo" texto={rotuloFlujoPegado(flujo.nombre ?? '…')} onQuitar={quitarFlujo} etiquetaQuitar="Quitar el flujo" />
        ) : null}
        antes={(
          <Dropdown value="" resetAfterSelect sinFlecha search={false} ariaLabel="Agregar" disabled={deshabilitado}
            botonLabel={<Ico n="mas" t={16} />} options={accionesMas(!!onFlujo)} onChange={alMas} menuMinAncho={240}
            buttonStyle={BOTON_MAS} />
        )} />
      <input ref={elegirArchivo} type="file" accept={ACCEPT_ARCHIVO_FLUJO} hidden tabIndex={-1} aria-hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f); }} />
      {error && <p role="alert" style={{ ...S.error, margin: '-6px 0 0', maxWidth: 720, width: '100%' }}>{error}</p>}
    </div>
  );
}

/** El «+» de la caja (`.gp-cc-mas` de CajaPedido) con el desplegable de la casa: 34 redondo, el azul de Gamma. */
const BOTON_MAS: CSSProperties = {
  width: 34, height: 34, padding: 0, border: 0, borderRadius: 9999, justifyContent: 'center',
  background: 'var(--gp-azul-50)', color: 'var(--gp-azul-600)',
};

// ⚠️ EL HOVER VA EN LA CLASE, NUNCA EN EL `style` (docs/hallazgos-chatbot.md, parte «horario»: un `border` en línea
// anula el `:hover` de la clase). Sólo tokens que existen en claro y en oscuro (app/globals.css).
const CSS = `
.chm-op{font:inherit;font-size:13.5px;font-weight:600;line-height:1.3;text-align:center;padding:8px 12px;border-radius:10px;border:1px solid var(--mako-border);background:var(--surface);color:var(--mako-ink);cursor:pointer;transition:border-color .14s ease,background .14s ease}
.chm-op:hover:not(:disabled),.chm-op:focus-visible{border-color:var(--mako);background:var(--mako-bg);outline:none}
.chm-op:disabled{cursor:default;opacity:.55}
.chm-op--suave{font-weight:500;color:var(--dim);border-color:var(--border)}
.chm-x{flex:none;border:none;background:none;color:var(--dim);font-size:14px;cursor:pointer;padding:4px 6px;border-radius:6px}
.chm-x:hover{color:var(--ink);background:var(--surface-2)}
@media (prefers-reduced-motion: reduce){.chm-op{transition:none}}
`;

const S: Record<string, CSSProperties> = {
  // El chat llena la caja que le da quien monta (un alto DEFINIDO: `ChatHilo` mide con `height: 100%`).
  raiz: { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', minHeight: 0, boxShadow: '0 12px 34px rgba(18,21,27,.18)', borderRadius: 16 },
  cabecera: { display: 'flex', alignItems: 'center', gap: 10, margin: '-4px -6px' },
  nombre: { fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 },
  estado: { fontSize: 12, lineHeight: 1.3 },
  filaMako: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, minWidth: 0 },
  avisos: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12.5, color: 'var(--warn)', maxWidth: '92%' },
  opciones: { display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: '92%' },
  vacio: { margin: 'auto', color: 'var(--faint)', fontSize: 13.5, textAlign: 'center' },
  fases: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingBottom: 8, fontSize: 13 },
  puntos: { display: 'inline-flex', gap: 4, flex: 'none' },
  punto: { width: 7, height: 7, borderRadius: 999 },
  rotulo: { fontWeight: 600, color: 'var(--mako-ink)' },
  dim: { fontSize: 12.5, color: 'var(--faint)' },
  error: { margin: '0 0 8px', fontSize: 13, lineHeight: 1.4, color: 'var(--bad)' },
  link: { color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' },
};
