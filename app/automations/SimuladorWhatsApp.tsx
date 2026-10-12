'use client';

// =============================================================================
// SimuladorWhatsApp — la tab /automations: la lista de automatizaciones flotando sobre el lienzo
// =============================================================================
// El nombre es de cuando esto era un chat simulado (réplica de PlantillasView de SuperAdmin). Hoy
// es la pantalla entera: el lienzo de la automatización elegida de borde a borde, la lista
// flotando a la izquierda y, al tocar «Probar», el panel del canal elegido acoplado a la derecha
// (PanelProbar). El editor de la secuencia (SecuenciaPerfil) queda SIEMPRE montado.
//
// ── TERCERA TANDA (09/10/2026): «Probar» por canal, los tres puntos y «Nueva» al instante ──
//   · «PROBAR» ES DE UN CANAL (decisión 14): el desplegable lo dibuja SecuenciaPerfil y llama
//     `onProbar(canal)`; acá se guarda el canal y se monta PanelProbar con él. Otro canal es otro
//     panel (va en la `key`).
//   · LOS TRES PUNTOS DE CADA FILA (decisión 6, pedido literal: «en la sidebar donde están todas
//     las secuencias pon los típicos 3 puntos para poder hacer estas acciones, como activarla,
//     eliminarla, etc...»): el menú de la casa (`Dropdown` con «⋯», el de las columnas del CRM) con
//     Activar/Pausar, Duplicar y Eliminar. Eliminar ARCHIVA (se recupera desde la base) y pregunta
//     con la confirmación de la casa, una frase pegada al botón. El «⋯» tiene su PROPIA columna
//     (no tapa el nombre): para que el nombre siga entrando en dos renglones (tope 40), el punto
//     de estado pasó a ser una marca sobre el emoji, y la fila ganó los píxeles que el menú ocupa.
//   · «NUEVA» (decisión 7, pedido literal: «si le paso el cursor debería tener una animación... Y
//     al apretarlo... Mejor si se crea automáticamente la tarjeta en la sidebar y se abre el
//     lienzo, y que el loader en todo caso esté al entrar al lienzo»): una animación al pasar el
//     cursor (el ＋ gira, como el logo de la marca) y al tocarla la fila aparece YA, elegida, con el
//     lienzo abierto y un loader adentro. La fila la pone ChatAgentApp (`crearNueva`, con
//     `listaConCreando`); cuando el server contesta, la fila toma su id real y la selección la
//     sigue (por su clave, `claveCreando`). Si falla, la fila se va y vuelve la que estaba elegida.
//
// ── QUINTA TANDA (09/10/2026): el filtro del Plan ──
//   · EL FILTRO (punto 4): un botón chico, sólo el embudo, al lado del buscador (que gana el lugar),
//     y el desplegable del Plan por secciones —Emojis, Estado, Canal— con varias marcadas y «Quitar
//     filtros» sutil abajo del todo (`FiltroLista`). Quién pasa y qué ofrece cada sección lo decide
//     lib/chatbot-lista-filtro.ts, con el canal DERIVADO de los pasos.
//
// ── 11/10/2026: «MaKo EN WHATSAPP» SON AUTOMATIZACIONES, IGUALES A LAS DEMÁS ──
//   · Martín, textual: «Te pedí que la parte de WhatsApp de MaKo sea exactamente igual y siguen muchas
//     cosas diferentes... debe ser IDENTICO». Cada mensaje es una fila de `nutricion_secuencias` con el CRON
//     «Evento de MaKo» (`aviso_mako`, lib/disparadores.ts), con el MISMO `ItemLista`, el MISMO «⋯», las MISMAS
//     acciones y la MISMA selección: abren el MISMO lienzo (`SecuenciaPerfil`).
//   · ⛔ SE FUERON los Mensajes de MaKo de antes (quinta y novena tanda): las filas que venían del endpoint
//     de Configuraciones › Notificaciones (`avisos`), su lienzo propio (`MensajeMakoLienzo`, el editor de
//     /mensajes), su «⋯» recortado (`opcionesDeMensaje`), su «Eliminar» que los ocultaba y el alta de un
//     mensaje propio. El diseño, en docs/diseno-mako-en-whatsapp-unificado.md.
//
// ── UNDÉCIMA TANDA (11/10/2026): UNA SOLA LISTA, EL MENÚ ANTES DEL BUSCADOR Y «RENOMBRAR» ──
//   · Punto 9, textual: «Te pido que en la sidebar elimines la separación con "MaKo en WhatsApp" que sea todo
//     una misma sidebar para todo, sin dividir, para eso ya tenemos filtros. Y arriba también elimina la
//     palabra "Chatbot"... Y que los botones de "Configuraciones" y "Tutorial" estén en otro botón desplegable
//     al inicio de la barra de busqueda». → Una lista en el orden del server, sin rótulos ni «＋ Nuevo mensaje»
//     (se fueron `partirLista`, `ROTULO_CHATBOT` y el reexport de `ROTULO_MENSAJES_MAKO`); las de MaKo las separa
//     el filtro que ya existía («Al WhatsApp de MaKo», lib/chatbot-lista-filtro.ts). El menú (`menu`) llega como
//     NODO desde la tab, delante del buscador.
//   · Punto 5, textual: «Quiero que en los 3 puntos exista la opción de renombrar.» → `opcionesDeFila` la trae
//     segunda; se edita EN la fila (Enter o salir guardan, Escape cancela, sin cambio no escribe), optimista y con
//     vuelta atrás, por la puerta de siempre (`action: 'nombre'`, que contesta 404 si no tocó ninguna fila).
//
// ── DUODÉCIMA TANDA (12/10/2026): SE MONTA TAMBIÉN VACÍA, Y EL AVISO DE PROBAR ES DE ACÁ ──
//   · Con cero automatizaciones la tab ya no dibuja un cartel: monta esto, con la lista («＋ Nueva automatización»,
//     el menú) y la cuadrícula vacía. «Ninguna coincide» sale sólo con un filtro o una búsqueda.
//   · «Enviado · revisa tu WhatsApp» lo pide PanelProbar (`onEnviado`) y el <Toast> vive en la raíz, fuera de la capa
//     de Probar: ver `avisoEnviado`.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Dropdown } from '../components/Dropdown';
import { Confirm } from '@/app/_ui/Confirm';
import { Toast, useToast } from '@/app/_ui/Toast';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { SecuenciaPerfil, type EdicionLocal } from './SecuenciaPerfil';
import { PanelProbar, type CanalProbar } from './PanelProbar';
import { FiltroLista, LADO_FILTRO } from './FiltroLista';
import { disparadoresDeSecuencia, type SecuenciaConDisparadores } from './EditorDisparadores';
import { copiaDeFlujo, textoDeCopia, type PasoCopiado } from '@/lib/flujo-copia';
import type { ProductoOpcion } from './ChatAgentApp';
import type { AudioSetting, SecuenciaDto, Opcion } from './ChatAgentApp';
import { TOPE_NOMBRE_SECUENCIA, nombreParaGuardar, type Objetivo } from '@/lib/setting-estrategia';
import { muelles as calcularMuelles, MUELLE } from '@/lib/lienzo-grafo';
import { enviosDePasos, pasaFiltroLista, type FilaFiltrable } from '@/lib/chatbot-lista-filtro';

export const EMOJI_OBJETIVO: Record<Objetivo, string> = { agendar: '📅', preparar: '🎯', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };

/**
 * EL ANCHO DE LA LISTA, Y SU HUECO AL BORDE. Son UNA constante porque los usan dos cosas: la
 * caja de la lista y el corrimiento de lo que flota sobre el lienzo. Con dos números, el título
 * vuelve a nacer debajo del buscador en cuanto alguien toque uno. El panel de «Probar» usa el
 * mismo hueco del lado derecho.
 *
 * Desde la segunda tanda viven en `MUELLE` (lib/lienzo-grafo.ts): los lee también `muelles`, la
 * única función que decide dónde va cada cosa que flota (la lista, «Probar» y el editor).
 */
export const LISTA_ANCHO = MUELLE.listaAncho;
const LISTA_HUECO = MUELLE.hueco;

/**
 * El tope del nombre de una automatización. Medido el 08/10/2026: los seis vigentes miden de 31
 * a 39 caracteres, y en dos renglones de la lista entran ~44. Lo hacen cumplir los escritores del
 * nombre (el server, el título del lienzo y «Renombrar» de la lista); la lista lo usa para el `title` de lo
 * que no entre. Es el de la lib (`TOPE_NOMBRE_SECUENCIA`) desde la undécima tanda: un solo número.
 */
export const TOPE_NOMBRE = TOPE_NOMBRE_SECUENCIA;

// (Acá vivía `ID_RECORDATORIO`, el ítem del recordatorio de la reunión en la lista, que no era una fila de
// `nutricion_secuencias`. Desde el 10/10/2026 el recordatorio ES una automatización —con su CRON, «Agendó una
// reunión»— y sale en la lista como cualquiera: lib/recordatorio-automatizacion.ts.)

// ── «Nueva» al instante (decisión 7) ──────────────────────────────────────────
// Viven ACÁ y no en ChatAgentApp porque los usan los dos y ChatAgentApp ya importa este archivo:
// al revés sería un ciclo.

/** El nombre de la fila mientras el server la crea: el mismo que le pone `crearSecuenciaVacia`. */
export const NOMBRE_CREANDO = 'Nueva automatización';

/**
 * La CLAVE de la fila que se está creando: dice qué fila es aunque su id cambie (nace con un id
 * negativo y toma el real cuando el server contesta). Ninguna clave de verdad empieza así.
 */
export const claveCreando = (temporal: number): string => `creando:${temporal}`;
export const esFilaCreando = (j: Pick<SecuenciaDto, 'clave'>): boolean => j.clave.startsWith('creando:');

/**
 * La fila que aparece YA al tocar «Nueva». Es una automatización vacía y pausada, como la que
 * crea el server (`crearSecuenciaVacia`: etapa y disparador 'manual', sin pasos): así, cuando el
 * server contesta, la fila no cambia de cara, sólo de id.
 */
export function filaCreando(temporal: number): SecuenciaDto {
  return {
    id: temporal, clave: claveCreando(temporal), nombre: NOMBRE_CREANDO, etapa: 'manual', trigger_tipo: 'manual',
    activa: false, pasos: [], inscriptos: 0, enviados: 0, estrategia: null,
    metricas: {} as SecuenciaDto['metricas'],
  };
}

/** Una creación en vuelo: el id temporal y, cuando el server contesta, el real. */
export type Creando = { temporal: number; id: number | null };

/**
 * La lista con la fila que se está creando AL FINAL (donde el server pone la nueva: ordena por id).
 * Se CALCULA, no se escribe en la lista: un `load()` que llegue en el medio (otra pantalla que
 * recarga) la borraría. Con el id real ya contestado, la fila tiene ese id; y cuando la fila de
 * verdad llega en la lista, ésta se va sola (mismo id): no hay un tercer paso que olvidar.
 */
export function listaConCreando(lista: readonly SecuenciaDto[], creando: Creando | null): SecuenciaDto[] {
  if (!creando) return [...lista];
  if (creando.id != null && lista.some((j) => j.id === creando.id)) return [...lista];
  return [...lista, { ...filaCreando(creando.temporal), id: creando.id ?? creando.temporal }];
}

/**
 * Los íconos del «⋯» de una fila (sexta tanda, punto 10: «en los desplegables de los 3 puntos en la
 * sidebar... pon íconos en todos los desplegable»), por NOMBRE del set de la casa (app/_ui/iconos-menu.tsx):
 * el mismo dibujo que el resto de los menús, y la papelera es la de la casa, roja siempre (`'borrar'`,
 * punto 9: «que siempre el ícono de borrar sea rojo»). Hasta la segunda pasada eran SVG propios en
 * `data:`, con la papelera en un rojo copiado a mano.
 */
export const ICONOS_FILA = {
  activar: 'activar', pausar: 'pausar', renombrar: 'renombrar', duplicar: 'duplicar', copiar: 'copiar', descartar: 'restaurar', eliminar: 'borrar',
} as const satisfies Record<string, NombreIconoMenu>;

/**
 * Lo que ofrece el «⋯» de una fila. Activar o Pausar según cómo esté. Cada una con su ícono.
 * Una fila de «MaKo en WhatsApp» lleva ÉSTA, tal cual (11/10/2026: «Los 3 puntos de "MaKo en WhatsApp" no
 * tienen los botones de duplicar o copiar»): es una automatización más.
 *
 * `conCambios` (décima tanda, general 5, 11/10/2026: «en los 3 puntitos de la sidebar, a los que tienen cambios
 * sin guardar, que aparezca la opción "Descartar cambios"»): la fila tiene algo sin publicar (`sinPublicarDe`, el
 * mismo punto ámbar del nombre). Sólo ahí aparece «Descartar cambios», antes de «Eliminar». Reemplaza al botón
 * «Volver a lo publicado» que había al lado de «Activar».
 *
 * «RENOMBRAR» (undécima tanda, punto 5: «Quiero que en los 3 puntos exista la opción de renombrar»): segunda, en
 * todas las filas. No pide nada al elegirla: la fila pasa a ser un campo (`accionFila` → `renombrando`).
 */
export function opcionesDeFila(activa: boolean, conCambios = false): Array<{ value: 'activa' | 'renombrar' | 'duplicar' | 'copiar' | 'descartar' | 'eliminar'; label: string; icono: NombreIconoMenu }> {
  return [
    { value: 'activa', label: activa ? 'Pausar' : 'Activar', icono: activa ? ICONOS_FILA.pausar : ICONOS_FILA.activar },
    { value: 'renombrar', label: 'Renombrar', icono: ICONOS_FILA.renombrar },
    { value: 'duplicar', label: 'Duplicar', icono: ICONOS_FILA.duplicar },
    // «COPIAR FLUJO» (10/10/2026: «que esté en los 3 puntos de cada flujo en la sidebar... por si un usuario
    // de MaKo le quiere compartir un flujo que creó a otro»). Va al portapapeles (lib/flujo-copia.ts).
    { value: 'copiar', label: 'Copiar flujo', icono: ICONOS_FILA.copiar },
    ...(conCambios ? [{ value: 'descartar' as const, label: 'Descartar cambios', icono: ICONOS_FILA.descartar }] : []),
    { value: 'eliminar', label: 'Eliminar', icono: ICONOS_FILA.eliminar },
  ];
}

// ⛔ ACÁ VIVÍA `opcionesDeMensaje` (novena tanda): el «⋯» RECORTADO de un Mensaje de MaKo, sin Duplicar ni
// Copiar flujo, porque una copia de un mensaje de fábrica no salía por el mismo evento. Se fue el 11/10/2026:
// un mensaje de «MaKo en WhatsApp» es una automatización con el CRON del evento, y su copia (Duplicar, que
// conserva la lista de CRON: lib/secuencia-duplicar.ts) sale igual que el original.

/** El botón «⋯» de una fila: el MISMO en todas (también las de «MaKo en WhatsApp»). */
const ESTILO_BOTON_MENU: CSSProperties = { width: 28, height: 28, padding: 0, justifyContent: 'center', border: '1px solid transparent', background: 'transparent', color: 'var(--dim)', fontSize: 16, lineHeight: 1 };

// El emoji que se eligió en el título (tercera tanda, decisión 8: `nutricion_secuencias.emoji`) y, sin
// uno elegido, el del objetivo, como el chrome del lienzo. El objetivo puede ser uno del catálogo O uno
// que escribió el dueño: para esos no hay emoji propio y cae al genérico.
export const emojiSecuencia = (j: Pick<SecuenciaDto, 'emoji' | 'estrategia'>): string =>
  j.emoji || (j.estrategia ? (EMOJI_OBJETIVO[j.estrategia.objetivo as Objetivo] ?? '🎯') : '⚑');


// ⚠️ ACÁ VIVÍAN `opcionesDeFiltro` Y `QUITAR_FILTRO` (cuarta tanda, punto 13): un Dropdown de un
// valor —estado o un emoji— con «Quitar filtro» como el PRIMER renglón. La quinta tanda (punto 4) lo
// reemplazó por el desplegable del Plan, con varias marcadas por sección y «Quitar filtros» sutil
// abajo del todo: `FiltroLista` + lib/chatbot-lista-filtro.ts.

/**
 * La fila del filtro de una automatización: lo que se VE (el emoji, el punto de estado) y lo que
 * sus pasos mandan, derivado (`enviosDePasos`). Exportada para que el test la ejecute.
 */
export const filaDeSecuencia = (j: Pick<SecuenciaDto, 'activa' | 'emoji' | 'estrategia' | 'pasos'>): FilaFiltrable => ({
  activa: j.activa, emoji: emojiSecuencia(j), envios: enviosDePasos(j.pasos),
});
/**
 * ¿LA FILA MARCA «SIN PUBLICAR»? (restos de versiones anteriores, grupo «lista», 10/10/2026). En
 * Configuraciones › Notificaciones la fila de un mensaje de MaKo en WhatsApp con borrador llevaba un
 * punto ámbar (PlantillasView), y el detalle (`TemplateDetalleModal`) sacó su «¿Publicar los cambios?»
 * de salida CONTANDO con esa marca: al mudarse la lista acá, la marca no vino y lo sin publicar quedó
 * sin rastro. Va también en las automatizaciones, que guardan su borrador (mig 0240): es la misma
 * pregunta —¿todavía sale lo de antes?—. Para la automatización abierta cuenta además lo que el lienzo
 * tiene sin publicar AHORA (`abierta`, el `onSinPublicar` del lienzo), que todavía puede no estar
 * guardado. `null`/ausente = no hay borrador (o no se pudo leer: no se afirma nada).
 */
export const sinPublicarDe = (x: { borrador?: unknown }, abierta = false): boolean => abierta || x.borrador != null;

// ⛔ ACÁ VIVÍAN `ROTULO_CHATBOT`, el reexport de `ROTULO_MENSAJES_MAKO` y `partirLista`: las DOS divisiones de la
// lista (sexta tanda, punto 3), «Chatbot» y, desde el 11/10/2026, «MaKo en WhatsApp» (las filas del CRON «Evento
// de MaKo»). Se fueron en la undécima tanda, punto 9: «que sea todo una misma sidebar para todo, sin dividir, para
// eso ya tenemos filtros. Y arriba también elimina la palabra "Chatbot"». Las de MaKo se ven con el filtro
// «Al WhatsApp de MaKo» (lib/chatbot-lista-filtro.ts), que deja pasar también una con una tarjeta MaKo.

const API_SECUENCIAS = '/api/chat-agent/secuencias';

async function pedir(url: string, method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<Record<string, unknown> & { ok?: boolean; error?: string }> {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
}

/**
 * Lo que un estilo en línea no puede: el hover de la fila y del «⋯», y la animación de «Nueva».
 * Con `prefers-reduced-motion` el ＋ no gira. Sin backticks acá adentro: es un template literal.
 *
 * ⚠️ El fondo de la fila y de «Nueva» va en la CLASE y no en el `style`: un estilo en línea le
 * gana a cualquier `:hover` (AGENTS.md, los 129 botones del CRM).
 */
const CSS_LISTA = `
.chb-fila{background:transparent;border-color:transparent;transition:background .14s ease}
.chb-fila:hover{background:var(--surface-2)}
.chb-fila.is-on{background:var(--surface-2);border-color:var(--border-strong)}
.chb-fila .chb-menu{opacity:0;transition:opacity .14s ease}
.chb-fila:hover .chb-menu,.chb-fila:focus-within .chb-menu,.chb-fila.is-on .chb-menu{opacity:1}
@media (hover: none){.chb-fila .chb-menu{opacity:1}}
.chb-nueva{background:transparent;color:var(--dim);border:1px dashed var(--border-strong);opacity:.85;transition:border-color .16s ease,color .16s ease,background .16s ease,opacity .16s ease}
.chb-nueva:hover,.chb-nueva:focus-visible{opacity:1;color:var(--primary);border-color:var(--primary);background:var(--primary-bg)}
.chb-nueva__mas{background:var(--surface-2);border:1px dashed var(--border-strong);color:var(--faint);transition:transform .24s cubic-bezier(.34,1.36,.64,1),color .16s ease,border-color .16s ease,background .16s ease}
.chb-nueva:hover .chb-nueva__mas,.chb-nueva:focus-visible .chb-nueva__mas{transform:rotate(90deg) scale(1.06);color:var(--primary);border-color:var(--primary);border-style:solid;background:var(--surface)}
.chb-nueva:active .chb-nueva__mas{transform:rotate(90deg) scale(.92)}
@media (prefers-reduced-motion: reduce){.chb-nueva__mas{transition:none}.chb-nueva:hover .chb-nueva__mas,.chb-nueva:focus-visible .chb-nueva__mas,.chb-nueva:active .chb-nueva__mas{transform:none}}
`;

/** La caja del lienzo: de borde a borde, estirando con flex (la del recordatorio, la automatización o un mensaje). */
const ESTILO_LIENZO: CSSProperties = { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' };
/** La cuadrícula de puntos del lienzo sin tarjetas: la del «Creando…» y la de la lista vacía (duodécima tanda). */
const CUADRICULA: CSSProperties = { backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '22px 22px' };
// (Acá iba `ROTULO_GRUPO`, el estilo de los rótulos «Chatbot» y «MaKo en WhatsApp». Se fue con ellos: punto 9.)

/**
 * Un pedido de abrir el LIENZO de una automatización desde afuera (el link del aviso,
 * `/automations?sec=<id>`). Es un objeto y no un número a propósito: cada pedido es uno NUEVO, así
 * que el mismo id dos veces seguidas (dos avisos de la misma secuencia) vuelve a abrirla.
 *
 * `mako: true` (duodécima tanda, §3.6): abre con el CHAT DE MaKo abierto — la recién creada con «Pídeselo a MaKo» y el
 * link `?sec=<id>&mako=1`. Llega al lienzo como `makoAlAbrir`.
 * `pedido` (decimotercera tanda, punto 2): la fila acaba de nacer VACÍA desde «Pídeselo a MaKo» del modal, y el chat
 * manda ese pedido solo (MaKo CREA sobre ella). Llega al lienzo como `pedidoAlAbrir`.
 */
export type AbrirSecuencia = { id: number; mako?: true; pedido?: string };
// (Acá vivía `AbrirAviso`, el pedido de abrir un Mensaje de MaKo desde el link de Notificaciones,
// `/automations?aviso=<id>`. Se fue el 11/10/2026 con esos mensajes: un mensaje de MaKo se abre con `?sec=`.)

export function SimuladorWhatsApp({ secuencias, objetivos, etiquetaEtapa, negocio, rolAdmin, audios, canalCaido, onAudioNuevo, onNueva, errorNueva, onReload, productos, disparadores, menu, tz, abrir, handoffs, onElegida }: {
  // (Acá iban `arranque` y `onArranqueUsado`: la recién creada con un tipo de CRON elegido en «¿Qué la dispara?» del
  // modal abría su CRON en ese tipo. Se fueron con esos botones en la décima tanda: «eso ya lo hacemos dentro en el CRON».)
  /**
   * LA QUE SE ESTÁ VIENDO, para que la URL la diga (décima tanda, NUEVA AUTOMATIZACIÓN 9: «cada automatización nueva,
   * debe tener una URL que se pueda abrir»). `/automations?sec=<id>` ya la abría (el deep link); faltaba escribirla al
   * elegir: si sólo se lee, el link que se copia no es la que se está viendo. Quien monta hace el `router.replace`.
   */
  onElegida?: (id: number) => void;
  // (Acá iban `avisos`, `abrirAviso`, `onAvisosCambio` y `onOcultosCambio`: los Mensajes de MaKo de antes,
  // que venían de otro endpoint. Se fueron el 11/10/2026: son filas de `secuencias` con el CRON del evento.)
  /** Las respuestas sin caso pendientes: la tarjeta «Si responde» las cuenta en «Otra cosa». */
  handoffs?: ReadonlyArray<{ secuenciaId: number | null }>;
  productos: ProductoOpcion[];
  disparadores: Opcion[];
  secuencias: SecuenciaDto[];
  objetivos: Opcion[];
  etiquetaEtapa: (key: string) => string;
  negocio: string;
  /** El WhatsApp del negocio está caído: prender una secuencia no va a enviar nada. */
  canalCaido: boolean;
  rolAdmin: boolean;
  audios: AudioSetting[];
  onAudioNuevo: (a: AudioSetting) => void;
  /**
   * «Nueva»: abre la galería (en blanco o desde una plantilla). Se llama SIEMPRE por `nueva`, la puerta que
   * pregunta por lo no publicado ANTES de crear. (Hasta la undécima tanda llevaba una sección: «＋ Nuevo
   * mensaje» la abría en «MaKo en WhatsApp». Se fue con ese botón, punto 9.)
   */
  onNueva: () => void;
  /** Por qué no se pudo crear la última («＋ Nueva»): se dibuja pegado al botón. */
  errorNueva?: string | null;
  onReload: () => void;
  // ⚠️ ACÁ VIVÍAN `pie` (el de «N etapas sin secuencia · Armar una») y `pedidoIA` (el pedido que «Armar
  // una» le dejaba a la caja de Crear con IA). Salieron el 10/10/2026 con el pie: era de una versión
  // anterior (ver el comentario del montaje en ChatAgentApp).
  /**
   * EL MENÚ DE LA TAB, ANTES DEL BUSCADOR (undécima tanda, punto 9: «que los botones de "Configuraciones" y
   * "Tutorial" estén en otro botón desplegable al inicio de la barra de busqueda»): Configuraciones del negocio
   * (el horario de oficina y los límites) y el recorrido. Son de la tab entera, no de una automatización. Lo arma
   * la tab (con los editores y las acciones) y llega como NODO: importado acá, las acciones arrastrarían
   * `server-only` a los tests que dibujan esta lista (los hace caer AL IMPORTAR). Hasta la undécima se llamaba
   * `horario` e iba en el renglón de «Chatbot».
   */
  menu?: ReactNode;
  /** La zona del negocio, para el texto del horario. */
  tz: string | null;
  /** Abrir esta automatización en su lienzo (el deep link `?sec=`). */
  abrir?: AbrirSecuencia | null;
}) {
  const [busq, setBusq] = useState('');
  /**
   * Lo marcado en el filtro (quinta tanda, punto 4): varios a la vez, como los guarda el Dropdown
   * con `varios` (`estado:activas`, `emoji:📅`, `canal:whatsapp`, `destino:mako`…). `[]` = sin filtro.
   */
  const [filtros, setFiltros] = useState<string[]>([]);
  const [elegida, setSelId] = useState<number | ''>('');
  // (Acá vivía `avisoSel`, el Mensaje de MaKo abierto APARTE de `elegida` (quinta tanda). Desde el 11/10/2026
  // un mensaje de MaKo es una automatización: se elige con la MISMA `elegida` y abre el MISMO lienzo.)
  /** La que estaba elegida antes de abrir una fila que se está creando: si falla, se vuelve. */
  const [volverA, setVolverA] = useState<number | ''>('');

  // LA FILA NUEVA TOMÓ SU ID REAL: la selección la sigue, por su clave (decisión 7). Se aplica AL
  // DIBUJAR y no en un efecto: un efecto pintaría primero «Elige una automatización».
  let elegidaViva = elegida;
  if (typeof elegida === 'number' && elegida < 0) {
    const fila = secuencias.find((j) => j.clave === claveCreando(elegida));
    if (fila && fila.id !== elegida) { elegidaViva = fila.id; setSelId(fila.id); }
  }
  /**
   * Lo elegido, si todavía está; si no (se eliminó, o la fila nueva no se pudo crear), la que estaba
   * antes y, si tampoco, la primera. Se CALCULA y no se escribe con un efecto: un efecto que
   * corrige el estado dibuja primero la pantalla vacía y después la corrige.
   */
  const existe = (id: number | ''): boolean => id !== '' && secuencias.some((j) => j.id === id);
  const selId = existe(elegidaViva) ? elegidaViva : existe(volverA) ? volverA : (secuencias[0]?.id ?? '');
  /**
   * LA URL DICE LA ELEGIDA (`onElegida`, ver la prop), pero recién DESPUÉS de la primera elección (un clic, el link del
   * aviso, la recién creada): la que se elige sola al abrir la tab —la primera de la lista— no se escribe, porque en
   * ese mismo render el deep link (`?sec=`) todavía no llegó y la pisaría. Desde ahí, todo cambio de la elegida
   * (también la fila nueva que toma su id real, o la que queda al eliminar) se escribe una vez.
   */
  const eligio = useRef(false);
  const escrita = useRef<number | null>(null);
  useEffect(() => {
    if (!eligio.current || typeof selId !== 'number' || selId <= 0 || selId === escrita.current) return;
    escrita.current = selId;
    onElegida?.(selId);
  }, [selId, onElegida]);
  /** El panel de «Probar» abierto, y de qué canal. El lienzo NO se desmonta: se prueba lo que se edita. */
  const [probando, setProbando] = useState<CanalProbar | null>(null);
  /** La que se pidió abrir con el chat de MaKo abierto (`abrir.mako`, duodécima tanda §3.6): su lienzo lo abre. */
  const [makoPara, setMakoPara] = useState<number | null>(null);
  /** El pedido con que nació (`abrir.pedido`, decimotercera tanda, punto 2): el chat de ESA fila lo manda solo. */
  const [pedidoPara, setPedidoPara] = useState<{ id: number; pedido: string } | null>(null);
  /**
   * EL AVISO DE QUE LA PRUEBA DE VERDAD SALIÓ («Enviado · revisa tu WhatsApp»), duodécima tanda, §2.8. Lo pide
   * PanelProbar (`onEnviado`) y se dibuja ACÁ, en la raíz y fuera de la capa de «Probar» (z 3): vivía adentro del
   * panel, debajo de la barra de MaKo y de Publicar, y se iba al cerrar Probar durante los ~14 s del primer envío.
   */
  const { toast: avisoEnviado, show: mostrarAviso, clear: cerrarAviso } = useToast();
  /** Lo que el lienzo tiene sin publicar (`onCambioLocal`): es lo que prueba el panel. */
  const [edicion, setEdicion] = useState<EdicionLocal | null>(null);
  const sel = typeof selId === 'number' ? secuencias.find((j) => j.id === selId) : undefined;
  const creandoSel = !!sel && esFilaCreando(sel);
  // La fila que se está creando nace PAUSADA: con «Activas» o un texto en el buscador no se vería,
  // y «aparece YA en la lista» es lo que se pidió. Se limpian AL DIBUJAR, sólo mientras está elegida.
  if (creandoSel && (filtros.length > 0 || busq)) { setFiltros([]); setBusq(''); }

  // ⚠️ EL BUSCADOR BUSCA POR NOMBRE, que es lo único que la lista muestra (pedido de Martín,
  // 08/10/2026, punto 3: «elimina el subtitulo, solo el título»). Buscar por un gancho que no se
  // ve devolvía filas que no dicen por qué coinciden.
  const q = busq.trim().toLowerCase();
  // Las filas del filtro: cada automatización, las de «MaKo en WhatsApp» incluidas (son automatizaciones).
  // El desplegable cuenta sobre TODAS; la lista dibuja las que pasan.
  const filasSec = useMemo(() => new Map(secuencias.map((j) => [j.id, filaDeSecuencia(j)] as const)), [secuencias]);
  const todasLasFilas: FilaFiltrable[] = [...filasSec.values()];
  // UNA lista, en el orden del server (undécima tanda, punto 9): lo que pasa el filtro y el buscador, sin divisiones.
  const lista = useMemo(
    () => secuencias.filter((j) => pasaFiltroLista(filasSec.get(j.id) ?? filaDeSecuencia(j), filtros) && (!q || j.nombre.toLowerCase().includes(q))),
    [secuencias, filasSec, q, filtros],
  );

  /**
   * Elegir OTRA automatización: cierra «Probar» y suelta la edición local de la anterior.
   *
   * ⚠️ TOCAR LA QUE YA ESTÁ ELEGIDA NO HACE NADA (revisión adversarial del 08/10/2026,
   * lienzo-5). Antes vaciaba `edicion` igual: el lienzo no se remonta (misma `key`) y su efecto no
   * vuelve a emitir hasta el próximo cambio, así que «Probar» caía a lo GUARDADO —el texto viejo,
   * sin «Cambió · ↻» y, con la prueba real prendida, mandándolo—. Un clic sin efecto visible no
   * puede cambiar qué se prueba.
   */
  const cambiarA = (id: number) => {
    setSelId(id); setProbando(null); setEdicion(null);
    // El chat abierto al entrar es de la que se pidió abrir así: elegir otra lo olvida (el pedido lo vuelve a poner).
    setMakoPara(null); setPedidoPara(null);
    // Desde acá la URL dice la elegida (`onElegida`, décima tanda): una elección de verdad, no la primera de la lista.
    eligio.current = true;
    // Abrir la fila que se está creando recuerda de dónde se vino (si el server falla, se vuelve).
    if (typeof id === 'number' && id < 0) setVolverA(selId);
  };
  /**
   * ⚠️ Y CON CAMBIOS SIN PUBLICAR, SE PREGUNTA ANTES (decisión 15). El lienzo se remonta por
   * automatización (`key={sel.id}`), así que cambiar de una a otra tiraba lo no publicado sin
   * aviso (medido, R1/R3). La pregunta es la de la casa (`Confirm`), con la consecuencia pegada al
   * botón; «Nueva secuencia» pasa por la misma puerta.
   */
  const [sinPublicar, setSinPublicar] = useState(false);
  const [pendiente, setPendiente] = useState<{ ir: number | 'nueva' } | null>(null);
  /** El descarte del borrador del lienzo abierto (lo deja SecuenciaPerfil): «Descartar cambios» lo BORRA, no lo guarda. */
  const descartarBorrador = useRef<(() => void) | null>(null);
  const elegir = (id: number) => {
    if (id === selId) return;
    if (sinPublicar) { setPendiente({ ir: id }); return; }
    cambiarA(id);
  };
  // ⚠️ La pregunta va ANTES de crear (revisión de la segunda tanda, 09/10/2026): el «Armar una» del pie
  // de antes creaba la fila primero y «Seguir editando» dejaba una vacía de más.
  const nueva = () => {
    if (sinPublicar) { setPendiente({ ir: 'nueva' }); return; }
    onNueva();
  };
  const descartar = () => {
    const p = pendiente;
    setPendiente(null);
    if (!p) return;
    // ANTES de irse: sin esto, el desmonte del lienzo GUARDABA lo descartado como borrador (revisión del
    // 10/10/2026, hallazgo #6). La lista se relee sola al desmontarse, después del borrado.
    descartarBorrador.current?.();
    setSinPublicar(false);
    if (p.ir === 'nueva') onNueva();
    else cambiarA(p.ir);
  };
  const recibirEdicion = useCallback((v: EdicionLocal) => setEdicion(v), []);

  // ── Los tres puntos de cada fila (decisión 6) ─────────────────────────────────
  // (Desde el 11/10/2026 son los MISMOS en todas las filas, también las de «MaKo en WhatsApp»: son automatizaciones.)
  /** La fila con una acción en vuelo: su «⋯» se apaga hasta que vuelva. */
  const [ocupada, setOcupada] = useState<number | null>(null);
  /** Por qué no se pudo: debajo de ESA fila, no en otro lado. */
  const [errFila, setErrFila] = useState<{ id: number; texto: string } | null>(null);

  /**
   * «RENOMBRAR» (undécima tanda, punto 5). La fila que se está renombrando (su nombre pasa a ser un campo) y los
   * nombres OPTIMISTAS: lo escrito se ve YA, y vuelve atrás si el server dice que no. Molde: el renombrar en el
   * lugar de una columna del CRM (app/crm/CrmBoard.tsx).
   */
  const [renombrando, setRenombrando] = useState<number | null>(null);
  const [nombresOptimistas, setNombresOptimistas] = useState<ReadonlyMap<number, string>>(() => new Map());
  // El optimista se va cuando la lista ya trae ese nombre (o la fila ya no está). Se calcula AL DIBUJAR, sin efecto:
  // un efecto pintaría un cuadro con el nombre de antes.
  const optimistasViejos = [...nombresOptimistas].filter(([id, n]) => {
    const j = secuencias.find((s) => s.id === id);
    return !j || j.nombre === n;
  });
  if (optimistasViejos.length) {
    setNombresOptimistas((m) => {
      const c = new Map(m);
      for (const [id, n] of optimistasViejos) if (c.get(id) === n) c.delete(id);
      return c;
    });
  }
  /** El nombre que se VE: el optimista mientras el server no lo trae. */
  const nombreDe = (j: Pick<SecuenciaDto, 'id' | 'nombre'>): string => nombresOptimistas.get(j.id) ?? j.nombre;
  /**
   * Guarda lo escrito en la fila. Sin cambio (o vacío) sólo cierra (`nombreParaGuardar`). Se compara con el que se
   * VE: con un renombre en vuelo, volver al de antes también es un cambio.
   */
  const guardarNombre = async (j: SecuenciaDto, escrito: string) => {
    setRenombrando(null);
    const previo = nombreDe(j);
    const n = nombreParaGuardar(previo, escrito);
    if (n == null) return;
    setErrFila(null);
    setNombresOptimistas((m) => new Map(m).set(j.id, n));
    const volver = () => setNombresOptimistas((m) => {
      if (m.get(j.id) !== n) return m;
      const c = new Map(m);
      c.delete(j.id);
      return c;
    });
    try {
      const r = await pedir(API_SECUENCIAS, 'POST', { action: 'nombre', secuenciaId: j.id, nombre: n });
      if (!r.ok) { volver(); setErrFila({ id: j.id, texto: r.error || 'No se pudo renombrar' }); return; }
      onReload();
    } catch {
      volver();
      setErrFila({ id: j.id, texto: 'Sin conexión' });
    }
  };
  const [aEliminar, setAEliminar] = useState<SecuenciaDto | null>(null);
  const [eliminando, setEliminando] = useState(false);
  /** La copia recién creada: se abre cuando llegue en la lista (si no hay nada sin publicar). */
  const [abrirCopia, setAbrirCopia] = useState<number | null>(null);
  if (abrirCopia != null && secuencias.some((j) => j.id === abrirCopia)) {
    setAbrirCopia(null);
    // Con cambios sin publicar NO se abre: preguntar por algo que nadie pidió se lee como un
    // error. La copia queda a la vista en la lista.
    if (!sinPublicar) cambiarA(abrirCopia);
  }

  /**
   * Activar/Pausar y Duplicar. Lo valida el server: Activar valida lo mismo que Publicar
   * (`setSecuenciaActiva`) y Duplicar pasa los pasos por `setSecuenciaPasos`
   * (lib/secuencia-duplicar.ts); lo que contesta mal queda pegado a la fila.
   */
  /** «Flujo copiado»: debajo de ESA fila, un momento. */
  const [copiada, setCopiada] = useState<number | null>(null);
  /**
   * COPIAR EL FLUJO ENTERO al portapapeles: lo que el lienzo abre (el borrador, si hay; si no, lo
   * publicado), dónde estaba cada tarjeta, sus CRON y el guion de cada audio (del otro lado el audio no
   * existe y queda como texto: decisión de Martín, «Pegar y marcar en rojo»).
   */
  const copiarFlujo = async (j: SecuenciaDto) => {
    const guiones: Record<string, string> = {};
    for (const a of audios) if (a.transcript?.trim()) guiones[String(a.id)] = a.transcript;
    const copia = copiaDeFlujo({
      nombre: j.nombre, emoji: j.emoji ?? null, pasos: ((j.borrador?.pasos ?? j.pasos) as unknown as PasoCopiado[]),
      posiciones: j.posiciones ?? null, disparadores: disparadoresDeSecuencia(j as SecuenciaConDisparadores), guiones,
    });
    try {
      await navigator.clipboard.writeText(textoDeCopia(copia));
      setCopiada(j.id);
      setTimeout(() => setCopiada((c) => (c === j.id ? null : c)), 2500);
    } catch {
      setErrFila({ id: j.id, texto: 'No se pudo copiar' });
    }
  };
  /**
   * «DESCARTAR CAMBIOS» DEL «⋯» (décima tanda, general 5). La ABIERTA vuelve a lo publicado en el lienzo y su
   * borrador se borra (`descartarBorrador`, lo deja SecuenciaPerfil: `descartarCambios`), con su foto: Ctrl+Z
   * lo devuelve, así que no se pregunta. Una CERRADA no tiene deshacer —su borrador vive sólo en el server—:
   * pasa por la confirmación de la casa (`aDescartar`) y se borra con la acción de siempre
   * (`descartar-borrador`, app/api/chat-agent/secuencias).
   */
  const [aDescartar, setADescartar] = useState<SecuenciaDto | null>(null);
  const [descartando, setDescartando] = useState(false);
  const descartarCerrada = async () => {
    const j = aDescartar;
    if (!j) return;
    setDescartando(true);
    try {
      const r = await pedir(API_SECUENCIAS, 'POST', { action: 'descartar-borrador', secuenciaId: j.id });
      if (!r.ok) { setErrFila({ id: j.id, texto: r.error || 'No se pudo descartar' }); return; }
      onReload();
    } catch {
      setErrFila({ id: j.id, texto: 'Sin conexión' });
    } finally {
      setDescartando(false); setADescartar(null);
    }
  };
  const accionFila = async (j: SecuenciaDto, accion: string) => {
    if (accion === 'eliminar') { setErrFila(null); setAEliminar(j); return; }
    // «Renombrar» no pide nada: la fila pasa a ser un campo (`guardarNombre` escribe al salir).
    if (accion === 'renombrar') { setErrFila(null); setRenombrando(j.id); return; }
    if (accion === 'copiar') { setErrFila(null); await copiarFlujo(j); return; }
    if (accion === 'descartar') {
      setErrFila(null);
      if (j.id === selId && descartarBorrador.current) { descartarBorrador.current(); setSinPublicar(false); return; }
      setADescartar(j);
      return;
    }
    if (accion !== 'activa' && accion !== 'duplicar') return;
    setErrFila(null); setOcupada(j.id);
    try {
      if (accion === 'activa') {
        const r = await pedir('/api/whatsapp/secuencias', 'PATCH', { id: j.id, activa: !j.activa });
        if (!r.ok) { setErrFila({ id: j.id, texto: r.error || 'No se pudo cambiar' }); return; }
      } else {
        const r = await pedir(API_SECUENCIAS, 'POST', { action: 'duplicar', secuenciaId: j.id });
        if (!r.ok || !(Number(r.secuenciaId) > 0)) { setErrFila({ id: j.id, texto: r.error || 'No se pudo duplicar' }); return; }
        // La copia nace pausada: con «Activas» no se vería.
        if (filtros.length) setFiltros([]);
        setAbrirCopia(Number(r.secuenciaId));
      }
      onReload();
    } catch {
      setErrFila({ id: j.id, texto: 'Sin conexión' });
    } finally {
      setOcupada(null);
    }
  };

  /** Eliminar = ARCHIVAR (`archivarSecuencias`): deja de enviar, sale de la lista, se recupera desde la base. */
  const eliminar = async () => {
    const j = aEliminar;
    if (!j) return;
    setEliminando(true);
    try {
      const r = await pedir(API_SECUENCIAS, 'POST', { action: 'archivar', ids: [j.id] });
      if (!r.ok) { setErrFila({ id: j.id, texto: r.error || 'No se pudo eliminar' }); return; }
      // Lo no publicado de la que se fue ya no tiene dónde publicarse: que no pregunte al cambiar.
      if (j.id === selId) setSinPublicar(false);
      onReload();
    } catch {
      setErrFila({ id: j.id, texto: 'Sin conexión' });
    } finally {
      setEliminando(false); setAEliminar(null);
    }
  };

  // (Acá vivían `accionMensaje` y `eliminarMensaje`, las acciones del «⋯» de un Mensaje de MaKo por el endpoint
  // de Notificaciones. Se fueron el 11/10/2026: una fila de «MaKo en WhatsApp» usa `accionFila` y `eliminar`.)

  /**
   * LOS MUELLES (decisión 11): dónde va «Probar», el editor apaisado y lo que cada cosa que flota
   * tiene que dejar libre. Lo decide UNA función pura (`muelles`, lib/lienzo-grafo.ts) con la caja
   * de esta tab: acá sólo se mide la caja y se reparte el resultado.
   */
  const raiz = useRef<HTMLDivElement | null>(null);
  const [caja, setCaja] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const medir = () => setCaja((c) => (c.w === el.clientWidth && c.h === el.clientHeight ? c : { w: el.clientWidth, h: el.clientHeight }));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * EL LINK DEL AVISO ABRE EL LIENZO (revisión adversarial del 08/10/2026, costuras-5). El aviso
   * de una charla que pasó a una persona dice «súmalo como «Su respuesta trata de…»» con
   * `/automations?sec=<id>`, y ese link abría el wizard de 9 pasos, donde «Si responde» no existe.
   * Se aplica AL DIBUJAR y no en un efecto: un efecto pintaría primero la primera de la lista y
   * después la del link. Es también la puerta por la que se abre la fila que se está creando.
   */
  const [abrirVisto, setAbrirVisto] = useState<AbrirSecuencia | null>(null);
  if (abrir && abrir !== abrirVisto && secuencias.some((j) => j.id === abrir.id)) {
    setAbrirVisto(abrir);
    elegir(abrir.id);
    // Con `mako: true`, ESA abre con el chat de MaKo abierto (va DESPUÉS de elegir: `cambiarA` lo limpia), y con
    // `pedido`, el chat lo manda solo.
    setMakoPara(abrir.mako ? abrir.id : null);
    setPedidoPara(abrir.pedido ? { id: abrir.id, pedido: abrir.pedido } : null);
  }

  // `editorAbierto: true`: lo que se reparte es el muelle que el editor ocupa CUANDO se abre (el
  // lienzo lo usa al tocar una tarjeta). «Probar» no depende de eso (ver `muelles`).
  const probarVisible = probando != null && !!sel && !creandoSel && caja.w > 0;
  const m = calcularMuelles(caja, { listaAbierta: true, probarAbierto: probarVisible, editorAbierto: true });

  /**
   * UNA FILA DE LA LISTA, la MISMA para todas (11/10/2026: «debe ser IDENTICO»): el `ItemLista`, el «⋯» de siempre
   * (`opcionesDeFila`, con Renombrar, Duplicar y Copiar flujo) y la selección de siempre.
   */
  const filaDeLista = (j: SecuenciaDto) => {
    const creando = esFilaCreando(j);
    return (
      <div key={creando ? j.clave : j.id}>
        <ItemLista on={j.id === selId} activa={j.activa} emoji={emojiSecuencia(j)} nombre={nombreDe(j)} creando={creando}
          sinPublicar={sinPublicarDe(j, j.id === selId && sinPublicar)}
          onClick={() => elegir(j.id)}
          editarNombre={renombrando === j.id && rolAdmin && !creando
            ? { onGuardar: (t) => void guardarNombre(j, t), onCancelar: () => setRenombrando(null) }
            : undefined}
          menu={rolAdmin && !creando ? (
            /* ⚠️ VA EL `Dropdown` DE LA CASA y no un menú propio: la lista scrollea
               (`overflowY: auto`) y un menú en flujo se recortaría contra su borde. Éste se
               dibuja por portal. Es el molde del «⋯» de las columnas del CRM. */
            // El menú abre hacia AFUERA de la lista (cuarta tanda, punto 13: «debería salir
            // para el otro lado, no tapar a la tarjeta de la secuencia»).
            <Dropdown value="" placeholder="⋯" align="afuera" resetAfterSelect sinFlecha search={false}
              ariaLabel={`Opciones de ${j.nombre}`} disabled={ocupada === j.id}
              buttonStyle={ESTILO_BOTON_MENU}
              options={opcionesDeFila(j.activa, sinPublicarDe(j, j.id === selId && sinPublicar))}
              onChange={(v) => void accionFila(j, v)} />
          ) : undefined} />
        {errFila?.id === j.id && <div role="alert" style={{ padding: '0 12px 8px 56px', fontSize: 12.5, color: 'var(--bad)' }}>{errFila.texto}</div>}
        {copiada === j.id && <div role="status" style={{ padding: '0 12px 8px 56px', fontSize: 12.5, color: 'var(--good)', fontWeight: 600 }}>Flujo copiado</div>}
      </div>
    );
  };

  /**
   * LA TAB ES EL LIENZO, Y LA LISTA SE LE APOYA ENCIMA.
   *
   * Martín, con la captura de /mensajes al lado: «fijate la sidebar que quiero que copies, es
   * como flotando, con bordes más redondos, con la barra de búsqueda… replicala tal cual… Y por
   * atrás debe pasar también la grilla». La cuadrícula NO se corta donde empieza la lista: el
   * lienzo ocupa el ancho entero y la lista es una tarjeta con su sombra encima (`position:
   * absolute`, no una columna del flex, que le quitaría ancho al lienzo).
   *
   * ⚠️ «PROBAR» YA NO REEMPLAZA AL LIENZO (punto 10, 08/10/2026). Era un modo 'chat' que
   * desmontaba el editor —se perdía lo no publicado— y dejaba el chat debajo de esta lista, con
   * «Editar» como única salida. Ahora es un panel acoplado a la DERECHA, como la lista a la
   * izquierda, y el lienzo le corre lo que flota con `insetDer`.
   */
  return (
    <div ref={raiz} style={{ flex: 1, minHeight: 0, position: 'relative', minWidth: 0, display: 'flex' }}>
      <style>{CSS_LISTA}</style>
      {/* EL LIENZO: debajo de todo y de borde a borde. Uno solo, el de la automatización elegida, también si le
          escribe al grupo de MaKo (11/10/2026: hasta acá un mensaje de MaKo abría el editor de /mensajes,
          `MensajeMakoLienzo`). */}
      <div style={ESTILO_LIENZO}>
        {!sel ? (
          /* SIN NINGUNA AUTOMATIZACIÓN, LA CUADRÍCULA VACÍA (duodécima tanda, decisión 11). Era «Elige una
             automatización» sobre un fondo liso, y antes la tab ni llegaba acá (el cartel «Todavía no hay
             automatizaciones»). Martín: «vos entrás en la tab por primera vez y tenés que ver el lienzo». Es la
             misma cuadrícula del «Creando…» de abajo, sin texto: la lista de al lado ya dice «＋ Nueva». */
          <div data-lienzo-vacio style={{ flex: 1, minHeight: 0, ...CUADRICULA }} />
        ) : creandoSel ? (
          /* «NUEVA» AL INSTANTE (decisión 7): el lienzo ya está abierto, con su cuadrícula, y lo
             que tarda —el server creando la fila— se ve ACÁ adentro. El lienzo de verdad se monta
             cuando la fila tiene su id real (no hay a dónde guardar antes). */
          <div aria-busy="true" style={{
            flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            paddingLeft: m.insets.izq, color: 'var(--dim)', fontSize: 13.5, ...CUADRICULA,
          }}>
            <span className="mk-spin" style={{ width: 18, height: 18 }} aria-hidden />
            {pedidoPara ? 'Creando tu automatización' : 'Creando…'}
          </div>
        ) : (
          /**
           * ⚠️ EL `key` ES OBLIGATORIO, y es un hallazgo de esta casa: «un `useState`
           * sembrado de props no se resiembra; si la vista deja de desmontarse, hay que
           * poner el key». Se cambia de secuencia SIN desmontar, así que sin esto el
           * nombre, el texto, el interruptor y el producto se quedarían con los de la
           * anterior.
           */
          <SecuenciaPerfil key={sel.id} secuencia={sel} objetivos={objetivos} etiquetaEtapa={etiquetaEtapa} rolAdmin={rolAdmin} audios={audios} negocio={negocio} canalCaido={canalCaido} tz={tz}
            insetIzq={m.insets.izq}
            insetDer={m.insets.der || undefined}
            muelles={m}
            onSinPublicar={setSinPublicar}
            descartarBorrador={descartarBorrador}
            handoffs={handoffs}
            onAudioNuevo={onAudioNuevo}
            productos={productos} disparadores={disparadores}
            secuencias={secuencias}
            onAbrirClave={(clave) => {
              // El «Sigue con» del lienzo tiene que LLEVAR: un nodo que nombra otra
              // secuencia y no la abre es la mitad inútil del encadenamiento.
              const otra = secuencias.find((j) => j.clave === clave);
              if (otra) elegir(otra.id);
            }}
            /* El canal lo elige el desplegable de «Probar» (SecuenciaPerfil, `onProbar(canal)`), y
               el panel se monta con ESE canal. Una sola forma: el tipo es `CanalProbar` en las dos
               puntas, así que no hay un «sin canal» que adivinar. */
            onProbar={(canal: CanalProbar) => setProbando(canal)}
            probarAbierto={probarVisible} onCerrarProbar={() => setProbando(null)}
            onCambioLocal={recibirEdicion}
            onAccionTodo={rolAdmin ? (a) => void accionFila(sel, a) : undefined}
            makoAlAbrir={makoPara === sel.id}
            pedidoAlAbrir={pedidoPara?.id === sel.id ? pedidoPara.pedido : null}
            onCambio={onReload} />
        )}
      </div>

      {/* LA LISTA, FLOTANDO.
          `aria-label` porque la app YA tiene un <aside>: el de la navegación global. Sin
          nombre los dos son «complementary» y no hay forma de distinguirlos —ni para un
          lector de pantalla ni para una verificación, que es como un arnés terminó
          clickeando los íconos del menú de la izquierda creyendo que eran secuencias.
          Y lleva su `overflowY` con la barra teñida de la casa: el scroll es del
          CONTENIDO —sus secuencias—, no de la navegación de la app, así que se ve. */}
      <aside aria-label="Tus automatizaciones" style={{
        position: 'absolute', left: LISTA_HUECO, top: LISTA_HUECO, bottom: LISTA_HUECO, width: LISTA_ANCHO, zIndex: 3,
        display: 'flex', flexDirection: 'column', minHeight: 0,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
        boxShadow: '0 8px 28px rgba(18,21,27,.12)', overflow: 'hidden',
      }}>
        {/* El buscador va SIEMPRE, como en el molde. Antes aparecía con más de seis
            secuencias, y un control que aparece solo es un control que nadie busca. */}
        <div style={{ flex: 'none', padding: '14px 14px 12px', borderBottom: '1px solid var(--border)' }}>
          {/* EL FILTRO VA AL LADO DEL BUSCADOR, en la misma fila (cuarta tanda, punto 13), y desde la
              quinta (punto 4) es CHICO —sólo el embudo, cuadrado y del alto del buscador— para que
              el buscador se lleve el lugar: «debería ser más chico, con el ícono de filtro como ya
              lo tenemos en otros lados, así la barra de busqueda tiene más espacio». Adentro, el
              desplegable del Plan por secciones (`FiltroLista`). */}
          {/* EL MENÚ (Configuraciones y Tutorial) VA ANTES DEL BUSCADOR (undécima tanda, punto 9), cuadrado y del
              alto del buscador, como el filtro del otro lado: el buscador se lleva lo que sobra. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {menu}
            <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar" aria-label="Buscar por nombre"
              style={{ flex: 1, minWidth: 0, height: LADO_FILTRO, boxSizing: 'border-box', padding: '0 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13.5, outline: 'none' }} />
            <FiltroLista filas={todasLasFilas} valores={filtros} onCambio={setFiltros} />
          </div>
        </div>
        <div className="mk-scroll-oscuro" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
          {/* (Acá iban el rótulo «Chatbot», con el horario a su derecha, y más abajo el rótulo «MaKo en WhatsApp»
              con su «＋ Nuevo mensaje». Se fueron en la undécima tanda, punto 9: una sola lista, sin dividir.) */}
          {rolAdmin && (
            <button type="button" onClick={() => nueva()} className="chb-nueva"
              style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', padding: '10px', borderRadius: 12, cursor: 'pointer', marginBottom: 6, fontFamily: 'inherit' }}>
              <span aria-hidden className="chb-nueva__mas" style={{ width: 36, height: 36, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>＋</span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Nueva automatización</span>
            </button>
          )}
          {rolAdmin && errorNueva && <div role="alert" style={{ padding: '0 12px 8px', fontSize: 12.5, color: 'var(--bad)' }}>{errorNueva}</div>}
          {/* Sólo con algo que filtre: con la lista VACÍA de verdad (un negocio nuevo, duodécima tanda) no hay nada
              que «no coincida», y «＋ Nueva automatización» de arriba ya dice qué hacer. */}
          {lista.length === 0 && (q !== '' || filtros.length > 0) && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13 }}>Ninguna coincide</div>}
          {/* UNA lista, en el orden del server, con la MISMA fila para todas (`filaDeLista`). */}
          {lista.map(filaDeLista)}
        </div>
        {/* (Acá iba el pie de la lista, «N etapas sin secuencia · Armar una». Salió el 10/10/2026: era
            de una versión anterior. Ver el comentario del montaje en ChatAgentApp.) */}
      </aside>

      {/* «PROBAR», EN SU MUELLE (decisión 11): ancho y bajo, arriba a la derecha y debajo del
          chrome; o de arriba a abajo a la derecha si la ventana es baja. El rectángulo sale de
          `muelles` y el panel lo LLENA (width/height 100 %): ni el ancho ni el alto se deciden
          adentro. Se remonta por automatización y por canal: otra secuencia u otro canal es otra
          prueba. */}
      {probarVisible && sel && m.probar && (
        <div data-muelle="probar" style={{ position: 'absolute', left: m.probar.left, top: m.probar.top, width: m.probar.width, height: m.probar.height, zIndex: 3, display: 'flex' }}>
          <PanelProbar
            key={`${sel.id}-${probando}`}
            canal={probando ?? 'whatsapp'}
            secuencia={sel} edicion={edicion} secuencias={secuencias} audios={audios} negocio={negocio} productos={productos}
            rolAdmin={rolAdmin} etiquetaEtapa={etiquetaEtapa} onCerrar={() => setProbando(null)}
            style={{ width: '100%', height: '100%' }}
            onEnviado={(t) => mostrarAviso(t, undefined, 'good')}
          />
        </div>
      )}

      {/* EL AVISO DE «PROBAR» (duodécima tanda, §2.8): en la raíz y FUERA de la capa de arriba (z 3). Así queda encima
          de la barra de MaKo (z 4) y de Publicar (57), y sigue aunque Probar se cierre: el mensaje ya salió. */}
      <Toast state={avisoEnviado} onClose={cerrarAviso} />

      {/* Lo no publicado se pregunta ANTES de perderlo (decisión 15). La consecuencia, pegada al
          botón: el texto que se dibuja es corto (AGENTS.md). */}
      {pendiente && (
        <Confirm
          message="Tienes cambios sin publicar"
          confirmLabel="Descartar cambios" cancelLabel="Seguir editando" tone="danger"
          onConfirm={descartar} onCancel={() => setPendiente(null)}
        />
      )}

      {/* Eliminar ARCHIVA: la confirmación de la casa, una frase pegada al botón. */}
      {aEliminar && (
        <Confirm
          message={`«${aEliminar.nombre}» deja de enviar y sale de la lista.`}
          confirmLabel="Eliminar automatización" cancelLabel="No eliminar" tone="danger" loading={eliminando}
          onConfirm={() => void eliminar()} onCancel={() => setAEliminar(null)}
        />
      )}

      {/* «Descartar cambios» de una CERRADA (décima tanda, general 5): sin deshacer, se pregunta. */}
      {aDescartar && (
        <Confirm
          message={`Vuelve a lo publicado de «${aDescartar.nombre}».`}
          confirmLabel="Descartar cambios" cancelLabel="No descartar" tone="danger" loading={descartando}
          onConfirm={() => void descartarCerrada()} onCancel={() => setADescartar(null)}
        />
      )}
    </div>
  );
}

/**
 * Una fila de la lista: el emoji (con el punto de estado encima), el NOMBRE ENTERO y su «⋯».
 *
 * ⚠️ SIN SUBTÍTULO (pedido de Martín, 08/10/2026, punto 3): «elimina el subtitulo, solo el
 * título. Y procura que se vea todo, con un máximo de caracteres para los títulos». El nombre va
 * en DOS renglones (`line-clamp`). Antes medía ~162 px (emoji 38 + punto 8 al costado). Con el
 * «⋯» de la tercera tanda (28 px) el punto se mudó ENCIMA del emoji y la fila se ajustó (emoji
 * de 36, relleno de 10 y 4): el nombre sigue midiendo ~162 px, o sea ~44 caracteres en dos
 * renglones, por encima del tope de 40. El «⋯» tiene su columna propia y no tapa el nombre;
 * aparece al pasar el cursor, con la fila elegida y siempre en una pantalla táctil.
 *
 * La fila es un <div> con DOS botones (abrir y el menú): un botón adentro de otro no es HTML.
 *
 * RENOMBRANDO (undécima tanda, punto 5: `editarNombre`): el mismo emoji y, en lugar del botón, un campo con el
 * nombre (`CampoNombre`); el «⋯» se esconde mientras tanto.
 */
function ItemLista({ on, activa, emoji, nombre, onClick, menu, creando, sinPublicar, editarNombre }: {
  on: boolean; activa: boolean; emoji: string; nombre: string; onClick: () => void;
  /** El «⋯» de la fila. Sin él (la que se está creando, quien no es admin), nada. */
  menu?: ReactNode;
  /** La fila que el server está creando: en vez del emoji, el giro. */
  creando?: boolean;
  /** Tiene cambios sin publicar (`sinPublicarDe`): un punto ámbar al final del nombre. */
  sinPublicar?: boolean;
  /** Se está renombrando: el nombre es un campo. Guardar recibe lo escrito; cancelar, nada. */
  editarNombre?: { onGuardar: (escrito: string) => void; onCancelar: () => void };
}) {
  // El emoji con el punto de estado: el MISMO en la fila y mientras se renombra.
  // El punto dice el estado sin una palabra: en una fila de 320 px, «pausada» se come el nombre. El rótulo
  // entero está en el lienzo.
  const circulo = (
    <span style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
      {creando ? <span className="mk-spin" style={{ width: 14, height: 14 }} aria-hidden /> : emoji}
      <span title={activa ? 'Activa' : 'Pausada'} style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: '50%', background: activa ? 'var(--good)' : 'var(--border-strong)', boxShadow: `0 0 0 2px ${on ? 'var(--surface-2)' : 'var(--surface)'}` }} />
    </span>
  );
  return (
    <div className={`chb-fila${on ? ' is-on' : ''}`}
      style={{ display: 'flex', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderStyle: 'solid', marginBottom: 2 }}>
      {editarNombre ? (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 10, alignItems: 'center', padding: '10px', opacity: activa ? 1 : 0.55 }}>
          {circulo}
          <CampoNombre nombre={nombre} onGuardar={editarNombre.onGuardar} onCancelar={editarNombre.onCancelar} />
        </div>
      ) : (
        <button type="button" onClick={onClick} title={nombre.length > TOPE_NOMBRE ? nombre : undefined} aria-current={on || undefined}
          style={{ flex: 1, minWidth: 0, textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', padding: '10px 4px 10px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', opacity: activa || creando ? 1 : 0.55 }}>
          {circulo}
          <span style={{ minWidth: 0, flex: 1, fontWeight: 600, fontSize: 13.5, lineHeight: 1.3, color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{nombre}</span>
          {/* El punto ámbar de PlantillasView: un ESTADO, que sobrevive a cambiar de fila y al reload. */}
          {sinPublicar && (
            <span data-sin-publicar role="img" aria-label="Sin publicar" title="Tiene cambios sin publicar: todavía sale lo de antes"
              style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', flex: 'none' }} />
          )}
        </button>
      )}
      {menu && !editarNombre && <span className="chb-menu" style={{ flex: 'none', marginRight: 4, display: 'inline-flex' }}>{menu}</span>}
    </div>
  );
}

/**
 * EL NOMBRE COMO CAMPO, en la fila (undécima tanda, punto 5). Enter o salir del campo GUARDAN; Escape cancela.
 * ⚠️ Uno solo de los tres: Enter cierra el campo y, al desmontarse con el foco adentro, el navegador puede disparar
 * además el blur (`hecho`). Y el Escape no sigue de largo: el lienzo de abajo también lo escucha.
 */
function CampoNombre({ nombre, onGuardar, onCancelar }: { nombre: string; onGuardar: (escrito: string) => void; onCancelar: () => void }) {
  const hecho = useRef(false);
  const una = (f: () => void) => { if (hecho.current) return; hecho.current = true; f(); };
  return (
    <input autoFocus defaultValue={nombre} maxLength={TOPE_NOMBRE_SECUENCIA} aria-label="Nombre de la automatización"
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => { const t = e.currentTarget.value; una(() => onGuardar(t)); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); const t = e.currentTarget.value; una(() => onGuardar(t)); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); una(onCancelar); }
      }}
      style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', height: 32, padding: '0 8px', borderRadius: 8, border: '1px solid var(--primary)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, outline: 'none' }} />
  );
}
