'use client';

// =============================================================================
// EditorMensajeWhatsApp — UN editor para todo lo que sale por WhatsApp
// =============================================================================
// Pedido de Martín (08/10/2026, punto 8): «El editable del audio también está horrible, todos
// los botones amontonados... Te pedí que todo lo que tenga que ver con WhatsApp tenga un mismo
// editable, ya sea audio, texto, archivos, lo que sea... con la interfaz tipo WhatsApp que ya
// creamos... Que se grabe audio desde el costado, que se pueda adjuntar archivos, emojis etc...»
//
// Tercera tanda (09/10/2026, decisiones 1 y 2): UNA columna siempre (la `fila` se leía rota: la prop
// `disposicion` queda en el tipo SIN EFECTO) y sin «Revisar antes de enviar» (el dato `revisar` lo
// sigue leyendo el motor; `mostrarRevisar` y `revisarHeredado` quedan en el tipo sin efecto).
//
// ── CUARTA TANDA, PUNTO 15: VARIOS MENSAJES POR TARJETA ─────────────────────────────────────────
//   · ES UN CHAT DE WHATSAPP DE VERDAD: la barra es un BORRADOR (modo `enviar` del composer: Enter y
//     la flecha mandan). «Enviar» suma la burbuja y vacía la barra. Lo que hay en el chat ES el
//     mensaje: la lista de partes (`partes`, lib/mensaje-partes.ts), que sale en orden.
//   · CADA BURBUJA TIENE SU ✏️ (la vuelve a la barra; «Enviar» la devuelve a SU lugar) y una papelera
//     VISIBLE, roja, con «Deshacer» 5 s (el toast de la casa, app/_ui/Toast).
//   · UN ADJUNTO VA COMO EN WHATSAPP: elegirlo lo deja arriba de la barra (el chip) y lo escrito es su
//     pie; «Enviar» lo suma.
//   · «{ }» va EN la barra, al lado del clip (la ranura `trasClip` de ComposerWhatsApp).
//
// ── SEXTA TANDA (09/10/2026, «FEEDBACK DE WHATSAPP») ──────────────────────────────────────────────
//   · 1 y 8, EL AUDIO QUE NO SE ESCUCHABA: era el ancho del reproductor en la burbuja (AudioPlay.tsx).
//   · 2, EL NÚMERO VA EN LA CABECERA, al lado del logo y en lugar de la palabra «WhatsApp», y es de
//     CADA MENSAJE (`linea` del paso, lib/mensaje-partes.ts `lineaDelPaso`): `CabeceraWhatsApp`, que
//     dibuja la cabecera del panel (FlujoLienzo, `tituloEditor`). Sin «Toda la automatización».
//   · 3, EL ✦ DE MaKo AL LADO DEL NÚMERO abre el panel que ayuda a escribir (MakoRedacta.tsx). El panel
//     se abre ACÁ, en el lugar del chat: lo que propone se aplica con las mismas funciones que la barra.
//     «MaKo lo adapta a cada persona» (`tipo: 'ia'`) pasó a ser una casilla de ese panel.
//   · 4, LOS BOTONES PEGADOS A LA BURBUJA: el tope de ancho lo pone la fila, no un 78% de una caja que
//     se ajusta a la burbuja (BurbujaHilo `maxAncho`).
//   · 5, LAS PALOMITAS: cada burbuja lleva la hora y el ✓✓ (`Ticks`), como en WhatsApp.
//   · 6, GRABAR SIN EL BOTÓN DE MaKo: mientras se graba se lee el guion SÓLO si MaKo propuso uno (en el
//     panel, «Grabar con este guion»). Sin propuesta, no aparece nada.
//   · 7, LA GRABACIÓN NUEVA (✓ termina, se escucha, ➤ manda): la sesión de voz de ComposerWhatsApp.
//   · 9, EDITAR UN AUDIO abre la MISMA barra de escuchar (borrar, escuchar, seguir grabando, dejarlo),
//     no el recuadro con el nombre y una ✕ (`audioPendiente` del composer).
//   · 11, LA PAUSA ENTRE MENSAJES: entre dos burbujas, la pastilla «1 s» se toca y se elige
//     (`pausa_s` de la parte; topes en lib/mensaje-partes.ts).
//   · 10, EL «{ }» ES EL ÁRBOL DE LA CASA (`ArbolDeDatos`, app/_components/SelectorDatos.tsx), con lo
//     que el motor resuelve por este camino (`datosDelLead`). Sin «Tu negocio».
//
// ⚠️ VARIAS PARTES SÓLO DONDE EL MOTOR LAS MANDA: el WhatsApp NO oficial (`permiteAudio ||
//    permiteAdjuntos`). En el oficial sale UNA plantilla, en el recordatorio de la reunión UN texto y en
//    «MaKo en WhatsApp» UN aviso al grupo: ahí va UN mensaje, con la MISMA interfaz (la burbuja con ✏️ y
//    🗑, la barra vacía y la ➤: `enviarUnico`). Hasta el 10/10/2026 la barra ERA el mensaje (modo
//    `editar`) y el texto se veía dos veces, en la burbuja y en la barra.
// ⚠️ LO ESCRITO SIN ENVIAR NO SE PIERDE AL TOCAR OTRA TARJETA: el borrador de la barra vive en un
//    mapa del módulo por tarjeta (como el borrador de un chat). No viaja a la secuencia. Salvo en el de
//    UN mensaje, que no tiene identidad propia en «MaKo en WhatsApp» (ver `recordarBarra`).
// ⚠️ NADA DE ACÁ PUBLICA. `onChange` es un cambio LOCAL (sólo «Publicar» publica). Lo único que este
//    editor escribe en el server es la BIBLIOTECA (un audio o un archivo nuevo), que no cambia ninguna
//    secuencia. Lo fija tests/editor-mensaje-whatsapp.test.ts.
// ⚠️ LO QUE TERMINA DESPUÉS DE UN `await` SE APLICA SÓLO AL MISMO PASO (`mismoPaso`): subir un video
//    tarda, y el lienzo puede reusar este editor para otro nodo.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { AudioSetting, PasoSecuenciaDto } from './ChatAgentApp';
import { BurbujaHilo } from '../whatsapp/_shared/BurbujaHilo';
import { Ticks } from '../whatsapp/_shared/Ticks';
import { ComposerWhatsApp, PopoverWA, IconVideo, iconComposer, type ComposerHandle, type OpcionMenuWA, type ChipComposer } from '../whatsapp/_shared/ComposerWhatsApp';
import { IconClip, IconDoc, IconMic } from '../whatsapp/_shared/composer-icons';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { ArbolDeDatos } from '@/app/_components/SelectorDatos';
import { subirConProgreso } from '../customer-success/curso/subir-video';
import { SalidaWhatsApp } from './SalidaWhatsApp';
import { MakoRedacta } from './MakoRedacta';
import { Dropdown } from '../components/Dropdown';
import { SvcIcon } from '@/app/_components/ServicioVisual';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { useWs } from '@/app/_ui/Link';
import { Spinner, Toast, useToast } from '@/app/_ui';
import { aplicarVariables, esVariableConocida } from '@/lib/template-vars';
import { datosOfrecidos, type GrupoDatos } from '@/lib/variables-aviso';
import { cambiosDePaso } from '@/lib/guion-audio';
import {
  partesDe, formaGuardada, esUnTexto, TOPE_PARTES, pausaVisible, pausasPosibles, lineaDelPaso, type ParteMensaje,
} from '@/lib/mensaje-partes';
import {
  ACEPTA_FOTO_VIDEO, ACEPTA_DOCUMENTO, validarArchivoWA, archivoConTipoWA, tituloDeArchivo, pesoLegible,
  tipoEnvioDeMime, type AdjuntoDto,
} from '@/lib/setting-adjuntos-reglas';

export type VariableEditor = { key: string; label: string; ejemplo?: string };

/**
 * EL «{ }» DE UN MENSAJE AL LEAD (sexta tanda, WhatsApp 10: «Faltan datos... Siempre recuerda los
 * desplegables tipo arbol y con los íconos al lado... Y esto para todos los lugares donde usamos el
 * botón de {}, siempre lo mismo en todos lados»): el árbol del catálogo (`datosOfrecidos`), con lo que
 * el MOTOR resuelve por ESE camino (AGENTS.md: «La previsualización de un editor no puede resolver un
 * token que el motor NO resuelve»):
 *   · `todos` — el WhatsApp no oficial y el email: el motor pasa el texto por `datosParaElLead`
 *     (lib/nutricion.ts), que resuelve el catálogo entero.
 *   · sin `todos` — la vía OFICIAL (la plantilla de Meta registra sus parámetros con
 *     `valoresVariablesLead`) e Instagram / Messenger (`enviarPasoSocial` recibe lo mismo): sólo los
 *     datos del lead de siempre (`esVariableConocida`). El resto saldría CRUDO al lead.
 * Pura y exportada para el test.
 */
export function datosDelLead(todos: boolean): GrupoDatos[] {
  const arbol = datosOfrecidos({ destino: 'lead', conLead: true });
  if (todos) return arbol;
  return arbol
    .map((g) => ({ ...g, items: g.items.filter((v) => esVariableConocida(v.key)) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Las variables PROPIAS de quien monta (el recordatorio de la reunión: `nombre`, `cuando`, `hora`… las
 * resuelve SU emisor, lib/recordatorio-lead.ts, no el motor), como UNA rama del mismo árbol. Así el
 * «{ }» se ve igual en todos lados y ofrece lo que ese mensaje puede resolver, ni más ni menos.
 * Pura y exportada para el test.
 */
export function arbolDeVariables(vars: readonly VariableEditor[]): GrupoDatos[] {
  if (!vars.length) return [];
  return [{
    key: 'lead', titulo: 'Datos', icono: 'perfil',
    items: vars.map((v) => ({ key: v.key, label: v.label, ejemplo: v.ejemplo ?? `{{${v.key}}}`, alcance: 'siempre' as const, grupo: 'lead' as const, fuente: 'nombre' as const })),
  }];
}

export type EditorMensajeWhatsAppProps = {
  /** El mensaje (un nodo `mensaje` del flujo). */
  paso: PasoSecuenciaDto;
  /** Cambio LOCAL: nunca publica. Publicar es del lienzo (sólo «Publicar» publica). */
  onChange: (patch: Partial<PasoSecuenciaDto>) => void;
  /** La biblioteca de audios del workspace («Audios guardados» del clip). */
  audios: AudioSetting[];
  /** Un audio grabado desde aquí se suma a la biblioteca del padre. */
  onAudioNuevo?: (a: AudioSetting) => void;
  /**
   * Las variables PROPIAS de quien monta (el recordatorio de la reunión), como una lista: el «{ }» las
   * dibuja como una rama del árbol (`arbolDeVariables`). Con esto, se usan ÉSTAS y no las del motor.
   */
  variables?: VariableEditor[];
  /**
   * QUÉ DATOS USA EL ✦ AL ESCRIBIR (10/10/2026): 'recordatorio' = los del recordatorio de la reunión, un solo
   * mensaje y sin «adaptarlo a cada persona» (su emisor manda el texto tal cual). Ausente = los del motor.
   */
  redactaCon?: 'recordatorio';
  /**
   * El árbol del «{ }» ya armado (`datosOfrecidos`, lib/variables-aviso.ts): el mensaje de MaKo al
   * GRUPO (destino «equipo»). Gana sobre `variables`. Sin los dos: lo que el motor resuelve para un
   * mensaje al lead (`datosDelLead`).
   */
  datos?: GrupoDatos[];
  /** ✦ MaKo (el panel que ayuda a escribir y «adaptarlo a cada persona»). Sólo por el no oficial. */
  permiteIA?: boolean;
  /** Abre la guía de voz la primera vez que se prende «adaptarlo a cada persona». */
  onModoIA?: (on: boolean) => void;
  /** Mic y «Audios guardados». false en el recordatorio y en el oficial. */
  permiteAudio?: boolean;
  /** Clip: fotos, videos, documentos. */
  permiteAdjuntos?: boolean;
  /**
   * SIN EFECTO desde la tercera tanda (09/10/2026, decisión 2): «Revisar antes de enviar» salió de
   * la pantalla. Quedan en el tipo para que quien las pasa siga compilando.
   */
  mostrarRevisar?: boolean;
  revisarHeredado?: boolean;
  /** Nombre del negocio, para la burbuja de vista previa. */
  negocio?: string;
  placeholder?: string;
  /** La biblioteca de ARCHIVOS, si el padre ya la tiene. Sin esto, el editor la pide solo. */
  adjuntos?: AdjuntoDto[];
  /** Un archivo subido desde aquí, para el padre que lleva la biblioteca. */
  onAdjuntoNuevo?: (a: AdjuntoDto) => void;
  /** Lo de la estrategia que MaKo usa para escribir (✦ MaKo). */
  paraGuion?: { objetivo?: string | null; gancho?: string | null; preguntas?: string[] };
  /** El disparador de la automatización, en palabras («Cuando agenda…»): lo lee MaKo. */
  disparador?: string;
  /** Mientras el lienzo guarda: apaga los botones. */
  deshabilitado?: boolean;
  /** Además de la línea de error del editor. */
  onError?: (m: string) => void;
  /** SIN EFECTO desde la tercera tanda (decisión 1): el editor es UNA columna siempre. */
  disposicion?: 'columna' | 'fila';
  /**
   * SIN EFECTO desde la sexta tanda (WhatsApp 2): el número va en la CABECERA del panel y es de cada
   * mensaje (`CabeceraWhatsApp`). Queda en el tipo para que quien lo pasa siga compilando.
   */
  linea?: { actual: string | null; onElegir: (linea: string | null) => void | Promise<void> };
  /**
   * SIN EFECTO desde la sexta tanda: el ✦ de MaKo va siempre en la cabecera (`CabeceraWhatsApp`) y el
   * panel se abre acá. Queda en el tipo para que quien lo pasa siga compilando.
   */
  makoEnCabecera?: boolean;
  /** Quién firma las burbujas («MaKo» en «MaKo en WhatsApp»). Default: el negocio. */
  autor?: string;
};

/**
 * ¿Se ofrece «✦ MaKo»? Por el no oficial (`permiteIA`, lo decide quien monta), siempre: el panel ayuda a
 * escribir cualquier mensaje. Lo que sólo vale para UN texto es «adaptarlo a cada persona» (`adaptable`).
 * `varias` queda en la firma: la cabecera del panel la llama así.
 */
export function makoPosible(_paso: PasoSecuenciaDto, permiteIA: boolean | undefined, _varias: boolean): boolean {
  void _paso; void _varias;
  return !!permiteIA;
}

/** ¿Se puede prender «adaptarlo a cada persona»? MaKo reescribe UN texto: con un audio o varias partes, no. */
export function adaptable(paso: PasoSecuenciaDto, varias: boolean): boolean {
  if (!varias) return true;
  const lista = partesDe(paso);
  return lista.length === 0 || esUnTexto(lista);
}

// ── El panel de MaKo, abierto por tarjeta ────────────────────────────────────────────────────────
// El ✦ vive en la CABECERA del panel (la dibuja el lienzo) y el panel se abre ADENTRO de este editor:
// un estado del módulo por tarjeta los conecta sin que el lienzo sepa nada de MaKo.

const panelesAbiertos = new Set<string>();
const oyentesPanel = new Set<() => void>();
const avisarPanel = () => { for (const f of oyentesPanel) f(); };
const suscribirPanel = (f: () => void) => { oyentesPanel.add(f); return () => { oyentesPanel.delete(f); }; };

/** La clave de una tarjeta en una pestaña: la del borrador de la barra. */
export const claveDeTarjeta = (ws: number | string | null | undefined, paso: Pick<PasoSecuenciaDto, 'id' | 'orden'>): string =>
  `${ws ?? ''}|${paso.id ?? ''}|${paso.orden}`;

export function alternarPanelMako(clave: string, abierto?: boolean): void {
  const sig = abierto ?? !panelesAbiertos.has(clave);
  if (sig) panelesAbiertos.add(clave); else panelesAbiertos.delete(clave);
  avisarPanel();
}

function usePanelMako(clave: string): boolean {
  // La misma lectura en el server: el estado sólo lo prende un clic, así que al hidratar está vacío
  // (y un test que dibuja en el server puede abrirlo).
  const leer = () => panelesAbiertos.has(clave);
  return useSyncExternalStore(suscribirPanel, leer, leer);
}

/** El ✦ de MaKo: abre (o cierra) el panel que ayuda a escribir ESTE mensaje. */
export function BotonMakoWhatsApp({ clave, adaptando, deshabilitado }: { clave: string; adaptando?: boolean; deshabilitado?: boolean }) {
  const abierto = usePanelMako(clave);
  const on = abierto || !!adaptando;
  return (
    <button type="button" data-no-pan disabled={deshabilitado} aria-pressed={abierto}
      title={adaptando ? 'MaKo lo adapta a cada persona' : 'Que MaKo te ayude a escribirlo'} aria-label="Que MaKo te ayude a escribirlo"
      onClick={() => alternarPanelMako(clave)}
      style={{ ...chip, padding: '0 8px', ...(on ? { background: 'var(--mako-bg)', border: '1px solid var(--mako-border)', color: 'var(--mako-ink)' } : {}) }}>
      <MakoLogo size={16} animate={false} />
    </button>
  );
}

/**
 * LA CABECERA DEL PANEL DE UN WHATSAPP (WhatsApp 2 y 3): el logo, el número POR EL QUE SALE ESTE
 * mensaje en lugar de la palabra «WhatsApp», y el ✦ de MaKo al lado. La monta el lienzo
 * (FlujoLienzo, `tituloEditor`) para las tarjetas de WhatsApp no oficial.
 *
 * El número es del PASO (`linea`); sin elegir, el de la automatización (`lineaAutomatizacion`), que
 * es el que el motor usa entonces (`lineaDelPaso(paso) ?? sec.instance_name`). Elegir uno lo fija en
 * esta tarjeta: «si más adelante en la automatización quiero enviar otro mensaje por otro de mis
 * números… se debería poder».
 */
export function CabeceraWhatsApp({ paso, lineaAutomatizacion, onLinea, deshabilitado, conMako = true }: {
  paso: PasoSecuenciaDto;
  lineaAutomatizacion: string | null;
  /** Guarda la línea de ESTA tarjeta (un cambio local del paso, como cualquier otro). */
  onLinea: (linea: string) => void;
  deshabilitado?: boolean;
  /** El ✦ de MaKo (lo decide la misma regla que el editor: `permiteIA`). */
  conMako?: boolean;
}) {
  const ws = useWs();
  const actual = lineaDelPaso(paso) ?? lineaAutomatizacion;
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
      <SvcIcon k="whatsapp" size={13} box={24} radius={6} />
      <div style={{ flex: '0 1 auto', minWidth: 0 }}>
        <SalidaWhatsApp actual={actual} explicita onElegir={(l) => { if (l) onLinea(l); }} deshabilitado={deshabilitado} ancho={210} />
      </div>
      {conMako && <BotonMakoWhatsApp clave={claveDeTarjeta(ws, paso)} adaptando={paso.tipo === 'ia'} deshabilitado={deshabilitado} />}
    </div>
  );
}

/** La cabecera del panel de «MaKo en WhatsApp» (MaKo en WhatsApp 1: «El título debe ser ese»). */
export function CabeceraMakoEnWhatsApp() {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
      <MakoLogo size={22} animate={false} />
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>MaKo en WhatsApp</div>
    </div>
  );
}

/** La ruta de audios corta a los 120 s (transcribe al guardar). */
const ESPERA_AUDIO_MS = 125_000;

const fmtDur = (s: number | null | undefined) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}` : '');

/** ¿Es el mismo mensaje? Lo que termina después de un `await` sólo se aplica si sigue siéndolo. */
export const mismoPaso = (a: Pick<PasoSecuenciaDto, 'id' | 'orden'>, b: Pick<PasoSecuenciaDto, 'id' | 'orden'>): boolean =>
  (a.id ?? null) === (b.id ?? null) && a.orden === b.orden;

/**
 * El placeholder dice qué se está escribiendo: no hay rótulos (pedido de Martín, punto 5). `adjunto`
 * es lo que espera arriba de la barra: con un archivo, lo escrito es su pie.
 */
export function placeholderDe(tipo: PasoSecuenciaDto['tipo'], propio?: string, adjunto?: 'audio' | 'media' | null): string {
  if (adjunto === 'media') return 'Agrega un texto (opcional)';
  if (adjunto === 'audio') return 'Texto después del audio';
  if (tipo === 'ia') return 'Qué tiene que lograr';
  return propio ?? 'Escribe un mensaje';
}

/** Un adjunto elegido que todavía no se envió (el chip arriba de la barra). */
type Pendiente = { tipo: 'audio'; audio_id: number } | { tipo: 'media'; media_id: number };

/**
 * Lo que la barra MANDA: el adjunto (con lo escrito como su pie) o el texto. Un audio con texto son
 * DOS partes: WhatsApp no tiene pie de audio, y así le llegan al lead. Pura y exportada para el test.
 */
export function partesDeLaBarra(texto: string, adjunto: Pendiente | null): ParteMensaje[] {
  const t = texto.trim() ? texto : '';
  if (adjunto?.tipo === 'media') return [t ? { tipo: 'media', media_id: adjunto.media_id, cuerpo: t } : { tipo: 'media', media_id: adjunto.media_id }];
  if (adjunto?.tipo === 'audio') return [{ tipo: 'audio', audio_id: adjunto.audio_id }, ...(t ? [{ tipo: 'texto' as const, cuerpo: t }] : [])];
  return t ? [{ tipo: 'texto', cuerpo: t }] : [];
}

/**
 * La lista después de «Enviar»: lo de la barra se suma al final o, si se estaba editando una burbuja,
 * va a SU lugar (con la pausa que tenía antes de ella). Pura y exportada para el test.
 */
export function enviarALista(lista: readonly ParteMensaje[], nuevas: readonly ParteMensaje[], editando: number | null): ParteMensaje[] {
  if (editando != null && editando >= 0 && editando < lista.length) {
    const pausa = lista[editando]?.pausa_s;
    const primera = nuevas[0] && pausa != null ? [{ ...nuevas[0], pausa_s: pausa }, ...nuevas.slice(1)] : nuevas;
    return [...lista.slice(0, editando), ...primera, ...lista.slice(editando + 1)];
  }
  return [...lista, ...nuevas];
}

/**
 * «Enviar» con UN solo mensaje (el recordatorio, «MaKo en WhatsApp», la vía oficial): lo de la barra pasa
 * a ser EL mensaje. Editándolo (✏️), lo reemplaza; sin editar y con un mensaje ya escrito, no entra
 * (`'lleno'`: va uno solo, y pisarlo en silencio perdería el que estaba); una barra vacía no manda nada.
 * Pura y exportada para el test.
 */
export function enviarUnico(actual: string, barra: string, editando: boolean): { cuerpo: string } | 'vacio' | 'lleno' {
  if (!barra.trim()) return 'vacio';
  if (!editando && actual.trim()) return 'lleno';
  return { cuerpo: barra };
}

/**
 * Lo que propuso MaKo, sobre la lista: «reemplazar» deja sólo sus textos; «agregar» los suma al final.
 * Con el tope de partes. Pura y exportada para el test.
 */
export function propuestaALista(lista: readonly ParteMensaje[], textos: readonly string[], modo: 'reemplazar' | 'agregar'): ParteMensaje[] {
  const nuevas: ParteMensaje[] = textos.filter((t) => t.trim()).map((t) => ({ tipo: 'texto', cuerpo: t.trim() }));
  return (modo === 'reemplazar' ? nuevas : [...lista, ...nuevas]).slice(0, TOPE_PARTES);
}

/** El borrador de la barra por tarjeta: tocar otra no lo tira (no viaja a la secuencia). */
const borradores = new Map<string, string>();
/** El guion que propuso MaKo para grabar, por tarjeta (WhatsApp 6: sólo si propuso uno). */
const guionesDeMaKo = new Map<string, string>();

// La biblioteca de archivos se pide UNA vez por pestaña y cliente (10 min): el editor se monta
// cada vez que se toca un nodo, y diez nodos no son diez pedidos.
const CACHE_MS = 10 * 60_000;
const cacheBiblioteca = new Map<string, { t: number; lista: AdjuntoDto[] }>();

const chip: CSSProperties = { height: 28, padding: '0 10px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 };
const cajaPopover: CSSProperties = { width: 280, maxHeight: 340, overflowY: 'auto', padding: 10, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, boxShadow: '0 12px 34px rgba(18,21,27,.18)', fontFamily: "'Geist', sans-serif", display: 'flex', flexDirection: 'column', gap: 8 };
const accionBurbuja: CSSProperties = { width: 28, height: 28, flex: 'none', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 };

function IconLapiz() {
  return <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" /><path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth={1.8} /></svg>;
}
function IconReloj() {
  return <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth={2} /><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></svg>;
}

/**
 * El alto mínimo del chat: una burbuja de dos renglones y su aire. En un panel de alto fijo el chat
 * se queda con TODO lo que sobra (flex), y por debajo de esto el panel scrollea antes de aplastarlo.
 */
export const ALTO_MIN_CHAT = 110;

/** Lo que dice la pastilla de la pausa entre dos mensajes (WhatsApp 11). Pura (test). */
export const rotuloPausa = (s: number): string => `${Number.isInteger(s) ? s : s.toFixed(1)} s`;

/** La hora de las burbujas: la de cuando se abrió el editor, como en un chat. */
function horaDeAhora(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function EditorMensajeWhatsApp({
  paso, onChange, audios, onAudioNuevo, variables, datos, permiteIA, onModoIA, permiteAudio = true, permiteAdjuntos = true,
  negocio, placeholder, adjuntos, onAdjuntoNuevo, paraGuion, disparador, deshabilitado, onError, autor, redactaCon,
}: EditorMensajeWhatsAppProps) {
  const ws = useWs();
  // ¿Varias partes? Sólo por el no oficial (ver la cabecera): el oficial, el recordatorio y el aviso
  // al grupo mandan uno.
  const varias = permiteAudio || permiteAdjuntos;
  const clavePaso = `${paso.id ?? ''}|${paso.orden}`;
  const claveBorrador = claveDeTarjeta(ws, paso);
  /**
   * ⚠️ LA BARRA DE UN SOLO MENSAJE NO SE RECUERDA POR TARJETA (restos de versiones anteriores,
   * 10/10/2026). Desde que el editor de un texto también es «enviar» (ver `enviarUnico`), su barra es
   * un borrador como el de varias partes. Pero «MaKo en WhatsApp» (`EditorMensajeGrupo`) se monta con un
   * paso SIN identidad propia (`mako-grupo`, orden 1): recordada en `borradores`, lo que se tipeó en la
   * barra de un mensaje aparecía en la del siguiente, y su ➤ lo mandaba ahí. Cada montaje es de UN
   * mensaje (todos los que lo montan le ponen `key`), así que vive en el estado del componente.
   */
  const recordarBarra = varias;
  const [barra, setBarra] = useState(() => (recordarBarra ? borradores.get(claveBorrador) ?? '' : ''));
  const [adjunto, setAdjunto] = useState<Pendiente | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [fase, setFase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guionMaKo, setGuionMaKo] = useState<string | null>(() => guionesDeMaKo.get(claveBorrador) ?? null);
  const [subida, setSubida] = useState<{ nombre: string; pct: number; cancelar: () => void } | null>(null);
  const [bibLocal, setBibLocal] = useState<AdjuntoDto[] | null>(() => cacheBiblioteca.get(String(ws ?? ''))?.lista ?? null);
  const [audiosAca, setAudiosAca] = useState<AudioSetting[]>([]);
  const [abierto, setAbierto] = useState<'datos' | 'variantes' | null>(null);
  const [btnDatos, setBtnDatos] = useState<HTMLButtonElement | null>(null);
  const [btnVariantes, setBtnVariantes] = useState<HTMLButtonElement | null>(null);
  const [hora] = useState(horaDeAhora);
  const { toast, show, clear } = useToast();
  const composer = useRef<ComposerHandle>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputDoc = useRef<HTMLInputElement>(null);
  const pasoVivo = useRef(paso);
  useEffect(() => { pasoVivo.current = paso; }, [paso]);
  const cancelarSubida = useRef<(() => void) | null>(null);
  useEffect(() => () => { cancelarSubida.current?.(); }, []);
  const panelMako = usePanelMako(claveBorrador) && !!permiteIA;

  // El lienzo puede reusar este editor para otro nodo: lo que era del anterior (el guion de MaKo, el
  // error, la barra) no se queda dibujado en éste.
  const [claveVista, setClaveVista] = useState(clavePaso);
  if (claveVista !== clavePaso) {
    setClaveVista(clavePaso);
    setError(null); setAbierto(null); setAdjunto(null); setEditando(null);
    setGuionMaKo(guionesDeMaKo.get(claveBorrador) ?? null);
    setBarra(recordarBarra ? borradores.get(claveBorrador) ?? '' : '');
  }

  const biblioteca = adjuntos ?? bibLocal;
  useEffect(() => {
    if (adjuntos || !permiteAdjuntos) return;
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
  }, [adjuntos, permiteAdjuntos, ws]);

  const avisar = (m: string) => { setError(m); onError?.(m); };
  const escribir = (v: string) => {
    setBarra(v);
    if (!recordarBarra) return;
    if (v) borradores.set(claveBorrador, v); else borradores.delete(claveBorrador);
  };
  const limpiarBarra = () => { escribir(''); setAdjunto(null); setEditando(null); };
  const ponerGuion = (g: string | null) => {
    setGuionMaKo(g);
    if (g) guionesDeMaKo.set(claveBorrador, g); else guionesDeMaKo.delete(claveBorrador);
  };

  const todosLosAudios = useMemo(() => {
    const vistos = new Set(audios.map((a) => a.id));
    return [...audiosAca.filter((a) => !vistos.has(a.id)), ...audios];
  }, [audios, audiosAca]);
  const audioDe = (id: number) => todosLosAudios.find((a) => a.id === id) ?? null;
  const archivoDe = (id: number) => (biblioteca ?? []).find((a) => a.id === id) ?? null;

  // ── EL MENSAJE ES LA LISTA DE PARTES ──────────────────────────────────────────────────────────
  const partes = varias ? partesDe(paso) : [];
  const esIA = paso.tipo === 'ia';

  /**
   * Le pasa al lienzo la lista nueva en su forma GUARDADA (`formaGuardada`). Las variantes («↻ N»)
   * son de UN texto: con cualquier otra cosa se sueltan EXPLÍCITAS (`[]`).
   */
  const aplicarPartes = (lista: readonly ParteMensaje[]) => {
    const antes = pasoVivo.current;
    const f = formaGuardada(lista, antes.tipo === 'ia');
    const despues: PasoSecuenciaDto = {
      ...antes, tipo: f.tipo, cuerpo: f.cuerpo, audio_id: f.audio_id, media_id: f.media_id, partes: f.partes,
      ...(esUnTexto(lista) ? {} : { variantes: [] }),
    };
    onChange(cambiosDePaso(antes, despues));
  };

  /** «Enviar»: lo de la barra se suma (o vuelve a su lugar, si se editaba) y la barra se vacía. */
  const enviar = () => {
    const nuevas = partesDeLaBarra(barra, adjunto);
    if (!nuevas.length) return;
    const lista = partesDe(pasoVivo.current);
    // «Adaptarlo a cada persona» reescribe UN texto: una segunda parte lo apagaría sin decirlo.
    if (pasoVivo.current.tipo === 'ia' && editando == null && lista.length >= 1) { avisar('Adaptado a cada persona va un solo mensaje'); return; }
    const sig = enviarALista(lista, nuevas, editando);
    if (sig.length > TOPE_PARTES) { avisar(`Hasta ${TOPE_PARTES} mensajes`); return; }
    setError(null);
    aplicarPartes(sig);
    limpiarBarra();
  };

  /** ✏️: la burbuja vuelve a la barra. Un audio abre la barra de escucharlo (WhatsApp 9). */
  const editar = (i: number) => {
    const p = partes[i];
    if (!p) return;
    if ((barra.trim() || adjunto) && editando !== i) { avisar('Primero envía lo escrito'); return; }
    setError(null);
    setEditando(i);
    if (p.tipo === 'texto') { setAdjunto(null); escribir(p.cuerpo); }
    else if (p.tipo === 'media') { setAdjunto({ tipo: 'media', media_id: p.media_id }); escribir(p.cuerpo ?? ''); }
    else { setAdjunto(null); escribir(''); }
    composer.current?.enfocar();
  };

  /** 🗑: se va en el acto, con «Deshacer» 5 s. */
  const borrar = (i: number) => {
    const antes = partesDe(pasoVivo.current);
    if (!antes[i]) return;
    const deQuien = pasoVivo.current;
    aplicarPartes(antes.filter((_, j) => j !== i));
    if (editando === i) limpiarBarra();
    else if (editando != null && editando > i) setEditando(editando - 1);
    show('Mensaje borrado', () => { if (mismoPaso(pasoVivo.current, deQuien)) aplicarPartes(antes); });
  };

  // ── UN SOLO MENSAJE (el recordatorio, «MaKo en WhatsApp», la vía oficial): la MISMA interfaz ────
  // (MaKo en WhatsApp 2: «El editable de MaKo en WhatsApp debe ser lo mismo que el editable de
  // WhatsApp. La misma interfaz»). La burbuja con ✏️ y 🗑, y la barra VACÍA: ✏️ sube el texto a la barra
  // y la ➤ lo devuelve. Hasta el 10/10/2026 la barra era el mensaje mismo (`modo="editar"`) y el texto se
  // dibujaba DOS veces, en la burbuja y abajo (la captura de Martín del recordatorio, en su ws9).
  /** ➤ con un solo mensaje (`enviarUnico`, la regla pura de abajo). */
  const enviarElUnico = () => {
    const r = enviarUnico(pasoVivo.current.cuerpo ?? '', barra, editando != null);
    if (r === 'vacio') return;
    if (r === 'lleno') { avisar('Va un solo mensaje'); return; }
    setError(null);
    onChange({ cuerpo: r.cuerpo });
    limpiarBarra();
  };
  /** ✏️ con un solo mensaje: el texto sube a la barra. */
  const editarElUnico = () => {
    if (barra.trim() && editando == null) { avisar('Primero envía lo escrito'); return; }
    setError(null);
    setEditando(0);
    escribir(pasoVivo.current.cuerpo ?? '');
    composer.current?.enfocar();
  };
  /** 🗑 con un solo mensaje: queda sin escribir, con «Deshacer» 5 s. */
  const borrarElUnico = () => {
    const antes = pasoVivo.current.cuerpo ?? '';
    if (!antes) return;
    const deQuien = pasoVivo.current;
    onChange({ cuerpo: '' });
    if (editando != null) limpiarBarra();
    show('Mensaje borrado', () => { if (mismoPaso(pasoVivo.current, deQuien)) onChange({ cuerpo: antes }); });
  };

  /** La pausa antes de la parte `i` (WhatsApp 11). */
  const ponerPausa = (i: number, s: number) => {
    const lista = partesDe(pasoVivo.current);
    if (!lista[i] || i < 1) return;
    aplicarPartes(lista.map((x, k) => (k === i ? { ...x, pausa_s: s } : x)));
  };

  // ── El audio: grabar, ESCUCHAR y mandarlo con la ➤ (la sesión de voz del composer) ─────────────
  /** Lo que la ➤ verde mandó (ya escuchado): se pasa a MP3, se guarda en la biblioteca y entra al chat. */
  async function usarAudio(blob: Blob, secs: number) {
    if (fase) return;
    const deQuien = pasoVivo.current;
    const dondeIba = editando;
    setError(null);
    try {
      setFase('Convirtiendo…');
      const { blobToMp3 } = await import('../whatsapp/audio');
      const mp3 = await blobToMp3(blob);
      const buf = new Uint8Array(await mp3.arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode(...buf.subarray(i, i + 8192));
      setFase('Guardando…');
      const r = await fetch('/api/chat-agent/audios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: `Mensaje ${deQuien.orden}`, base64: btoa(bin), mime: 'audio/mpeg', duracionS: secs }),
        signal: AbortSignal.timeout(ESPERA_AUDIO_MS),
      });
      const j = await r.json().catch(() => null) as { ok?: boolean; audio?: AudioSetting; error?: string } | null;
      if (!j?.ok || !j.audio) { avisar(j?.error || 'No se pudo guardar el audio.'); return; }
      const audio = j.audio;
      setAudiosAca((xs) => [audio, ...xs]);
      onAudioNuevo?.(audio);
      if (!mismoPaso(pasoVivo.current, deQuien)) return;
      // Como en WhatsApp: la nota de voz SALE con la flecha (se suma al chat). Si se estaba editando una
      // burbuja (un audio al que se le grabó algo más), la reemplaza.
      const nueva: ParteMensaje = { tipo: 'audio', audio_id: audio.id };
      const sig = enviarALista(partesDe(pasoVivo.current), [nueva], dondeIba);
      if (sig.length > TOPE_PARTES) { avisar(`Hasta ${TOPE_PARTES} mensajes`); return; }
      aplicarPartes(sig);
      if (dondeIba != null) limpiarBarra();
      ponerGuion(null);
    } catch (e) {
      avisar(e instanceof Error && e.name === 'TimeoutError' ? 'Tardó demasiado. Prueba de nuevo.' : 'No se pudo procesar el audio.');
    } finally { setFase(null); }
  }

  // MIENTRAS SE GRABA, SÓLO EL GUION QUE PROPUSO MaKo (WhatsApp 6: «solo si sugirió algo, sino, que no
  // aparezca nada»). Ni el botón de pedirlo (el ✦ de la cabecera lo hace) ni el texto del mensaje.
  const mientrasGraba: ReactNode = guionMaKo ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '9px 11px', borderRadius: 10, background: 'var(--mako-bg)', border: '1px solid var(--mako-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--mako-ink)' }}>
        ✦ Para leer
        <button type="button" onClick={() => ponerGuion(null)} aria-label="Quitar el guion" title="Quitar"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 13, padding: 0 }}>✕</button>
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>{guionMaKo}</div>
    </div>
  ) : null;

  // ── El archivo: subir directo al bucket y registrarlo; queda arriba de la barra ──────────────
  async function subirArchivo(f: File) {
    setError(null);
    const v = validarArchivoWA({ nombre: f.name, tipo: f.type, tamano: f.size });
    if (!v.ok) { avisar(v.error); return; }
    const deQuien = pasoVivo.current;
    const post = async (body: object) => {
      const r = await fetch('/api/chat-agent/adjuntos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(65_000) });
      return r.json().catch(() => null) as Promise<{ ok?: boolean; error?: string; path?: string; signedUrl?: string; apikey?: string | null; adjunto?: AdjuntoDto } | null>;
    };
    try {
      const firma = await post({ action: 'subir', nombre: f.name, mime: v.mime, tamano: f.size });
      if (!firma?.ok || !firma.signedUrl || !firma.path) { avisar(firma?.error || 'No se pudo preparar la subida.'); return; }
      const s = subirConProgreso(firma.signedUrl, archivoConTipoWA(f, v.mime), firma.apikey ?? null,
        (pct) => setSubida((x) => (x ? { ...x, pct } : x)), 'JPG, PNG, MP4, PDF u Office');
      cancelarSubida.current = s.cancelar;
      setSubida({ nombre: f.name, pct: 0, cancelar: s.cancelar });
      await s.promesa;
      const reg = await post({ action: 'registrar', path: firma.path, nombre: f.name, titulo: tituloDeArchivo(f.name) });
      if (!reg?.ok || !reg.adjunto) { avisar(reg?.error || 'No se pudo guardar el archivo.'); return; }
      const adj = reg.adjunto;
      const clave = String(ws ?? '');
      const lista = [adj, ...(biblioteca ?? []).filter((a) => a.id !== adj.id)];
      cacheBiblioteca.set(clave, { t: Date.now(), lista });
      setBibLocal(lista);
      onAdjuntoNuevo?.(adj);
      if (mismoPaso(pasoVivo.current, deQuien)) setAdjunto({ tipo: 'media', media_id: adj.id });
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo subir el archivo.');
    } finally {
      cancelarSubida.current = null;
      setSubida(null);
    }
  }

  // ── El chip arriba del campo: lo que se sube, o el adjunto que espera «Enviar» ────────────────
  let chipActual: ChipComposer | null = null;
  const audioSinUrl = editando != null && partes[editando]?.tipo === 'audio'
    ? audioDe((partes[editando] as Extract<ParteMensaje, { tipo: 'audio' }>).audio_id)
    : undefined;
  if (subida) {
    chipActual = { icono: 'doc', titulo: subida.nombre, detalle: `Subiendo ${subida.pct}%`, onQuitar: subida.cancelar, tituloQuitar: 'Cancelar subida' };
  } else if (audioSinUrl !== undefined && !audioSinUrl?.url) {
    // Editando un audio que no se puede escuchar (no está en la biblioteca, o sin URL): el nombre, sin barra.
    chipActual = { icono: 'audio', titulo: audioSinUrl?.titulo ?? 'Nota de voz', detalle: 'No disponible' };
  } else if (adjunto?.tipo === 'audio') {
    const a = audioDe(adjunto.audio_id);
    chipActual = { icono: 'audio', titulo: a?.titulo ?? 'Nota de voz', detalle: fmtDur(a?.duracion_s), onQuitar: () => setAdjunto(null), tituloQuitar: 'Quitar audio' };
  } else if (adjunto?.tipo === 'media') {
    const adj = archivoDe(adjunto.media_id);
    const t = tipoEnvioDeMime(adj?.media_mime);
    chipActual = {
      imagen: t === 'image' ? adj?.url ?? null : null,
      icono: t === 'video' ? 'video' : 'doc',
      titulo: adj?.titulo ?? (biblioteca === null ? 'Cargando…' : 'Archivo'),
      detalle: pesoLegible(adj?.tamano),
      onQuitar: () => setAdjunto(null), tituloQuitar: 'Quitar archivo',
    };
  }

  // EDITAR UN AUDIO (WhatsApp 9): la barra de escucharlo, no un chip. 🗑 lo borra (con deshacer),
  // ➤ lo deja como está, 🎤 le graba algo más al final (lo nuevo reemplaza a esta burbuja).
  const editandoAudio = editando != null && partes[editando]?.tipo === 'audio' ? partes[editando] as Extract<ParteMensaje, { tipo: 'audio' }> : null;
  const audioEditado = editandoAudio ? audioDe(editandoAudio.audio_id) : null;
  const audioPendiente = editandoAudio && audioEditado?.url
    ? { url: audioEditado.url, secs: audioEditado.duracion_s, seguir: permiteAudio, rotuloUsar: 'Dejar este audio', onDescartar: () => { const i = editando!; limpiarBarra(); borrar(i); }, onUsar: limpiarBarra }
    : null;

  // ── El clip ──────────────────────────────────────────────────────────────────────────────
  const menuClip: OpcionMenuWA[] = [];
  if (permiteAdjuntos) {
    menuClip.push({ key: 'foto', label: 'Foto o video', icono: <IconVideo size={18} />, onElegir: () => inputFoto.current?.click() });
    menuClip.push({ key: 'doc', label: 'Documento', icono: <IconDoc size={18} />, onElegir: () => inputDoc.current?.click() });
  }
  if (permiteAudio) {
    menuClip.push({
      key: 'audios', label: 'Audios guardados', icono: <IconMic />, vacio: 'Sin audios todavía.',
      submenu: todosLosAudios.map((a) => ({ key: `a${a.id}`, label: a.titulo, icono: <IconMic />, detalle: fmtDur(a.duracion_s), onElegir: () => setAdjunto({ tipo: 'audio', audio_id: a.id }) })),
    });
  }
  if (permiteAdjuntos) {
    menuClip.push({
      key: 'archivos', label: 'Archivos guardados', icono: <IconClip />, vacio: biblioteca === null ? 'Cargando…' : 'Sin archivos todavía.',
      submenu: (biblioteca ?? []).map((a) => ({
        key: `f${a.id}`, label: a.titulo, detalle: pesoLegible(a.tamano), onElegir: () => setAdjunto({ tipo: 'media', media_id: a.id }),
        // El ícono por TIPO de archivo (general 10): el nombre lo puso el negocio, el tipo es estándar.
        icono: tipoEnvioDeMime(a.media_mime) === 'video' || tipoEnvioDeMime(a.media_mime) === 'image' ? <IconVideo size={18} /> : <IconDoc size={18} />,
      })),
    });
  }

  // ── Las burbujas como llegan ─────────────────────────────────────────────────────────────
  // `{{negocio}}` se resuelve con la MISMA función que el motor (`aplicarVariables`).
  const conNegocio = (t: string) => aplicarVariables(t, negocio?.trim() ? { negocio: negocio.trim() } : {});
  const sinEscribir = <span style={{ color: 'var(--faint)', fontSize: 13 }}>Sin escribir</span>;
  // LAS PALOMITAS (WhatsApp 5): la hora y el ✓✓ azul de un mensaje leído, como en WhatsApp.
  // Firmado por otro («MaKo» en «MaKo en WhatsApp»): llega al grupo como un mensaje de MaKo, a la
  // izquierda y con su nombre, como lo ve el equipo.
  const saliente = !autor;
  const pieBurbuja = { hora, pie: saliente ? <Ticks status="read" /> : undefined, autor, saliente };
  const burbujaDe = (p: ParteMensaje): ReactNode => {
    if (p.tipo === 'audio') {
      const a = audioDe(p.audio_id);
      // Sin la transcripción (punto 15: «elimina la transcripción de los audios, es innecesario»).
      return <BurbujaHilo maxAncho="100%" {...pieBurbuja} contenido={{ audio: a ? { url: a.url, titulo: a.titulo, transcript: null, duracion_s: a.duracion_s } : { url: null, titulo: 'audio' } }} />;
    }
    if (p.tipo === 'media') {
      const adj = archivoDe(p.media_id);
      const t = tipoEnvioDeMime(adj?.media_mime);
      return (
        <BurbujaHilo maxAncho="100%" {...pieBurbuja} contenido={{
          media: adj
            ? { url: adj.url, mime: adj.media_mime, nombre: t === 'document' ? (adj.nombre_archivo ?? adj.titulo) : null }
            : { url: null, mime: '', nombre: biblioteca === null ? 'Cargando' : 'archivo' },
          texto: conNegocio(p.cuerpo ?? ''),
        }} />
      );
    }
    return <BurbujaHilo maxAncho="100%" {...pieBurbuja} contenido={{ texto: conNegocio(p.cuerpo), ia: esIA }} />;
  };

  // EL «{ }»: el árbol que ESTE mensaje puede resolver (ver `datosDelLead`). El que viene armado gana;
  // las variables propias (el recordatorio) van como una rama; sin nada, lo del motor por este camino
  // (`varias` = el no oficial: el oficial manda una plantilla con los datos del lead de siempre).
  const grupos = useMemo(
    () => datos ?? (variables ? arbolDeVariables(variables) : datosDelLead(varias)),
    [datos, variables, varias],
  );
  // «↻ N» sólo en UN mensaje de texto: las variantes son otras formas de decir ESE texto (costuras-1).
  const unTexto = varias ? esUnTexto(partes) : (!paso.tipo || paso.tipo === 'texto' || paso.tipo === 'ia');
  const variantes = unTexto ? (paso.variantes ?? []) : [];
  const ocupado = !!deshabilitado || !!fase || !!subida;

  const pastillaPausa = (i: number) => {
    const s = pausaVisible(partes[i], i);
    if (s == null) return null;
    const posibles = pausasPosibles(partes, i);
    return (
      <div key={`pausa-${i}`} data-pausa={i} style={{ alignSelf: 'center', margin: '-2px 0' }}>
        <Dropdown value={String(s)} search={false} disabled={ocupado} ariaLabel={`Espera antes del mensaje ${i + 1}`}
          botonLabel={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconReloj /> {rotuloPausa(s)}</span>}
          buttonStyle={{ padding: '2px 9px', fontSize: 11.5, borderRadius: 999, minHeight: 0, background: 'var(--surface)', color: 'var(--dim)' }}
          options={posibles.map((x) => ({ value: String(x), label: rotuloPausa(x), icono: 'cronometro' }))}
          onChange={(v) => { const n = Number(v); if (n > 0) ponerPausa(i, n); }} />
      </div>
    );
  };

  /**
   * UNA BURBUJA CON SUS BOTONES. LOS BOTONES PEGADOS A LA BURBUJA (WhatsApp 4): la fila se acomoda del
   * lado de la burbuja y la burbuja no lleva un tope propio — lo pone la fila (`maxWidth` del
   * envoltorio). Firmado por otro («MaKo»), la burbuja llega a la IZQUIERDA y los botones van a su
   * derecha (`row-reverse`): el espejo de la de salida.
   */
  const filaDeBurbuja = (i: number, burbuja: ReactNode, alEditar: () => void, alBorrar: () => void, conVariantes: boolean) => (
    <div key={`p-${i}`} data-parte={i} style={{ display: 'flex', flexDirection: saliente ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'flex-end', gap: 6, alignSelf: 'stretch', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
        {conVariantes && variantes.length > 0 && (
          <button type="button" ref={setBtnVariantes} disabled={ocupado} title="Otras formas de decirlo" aria-expanded={abierto === 'variantes'}
            onClick={() => setAbierto((a) => (a === 'variantes' ? null : 'variantes'))} style={{ ...chip, height: 28 }}>↻ {variantes.length}</button>
        )}
        <button type="button" disabled={ocupado} onClick={alEditar} title="Editar" aria-label={`Editar el mensaje ${i + 1}`}
          style={{ ...accionBurbuja, ...(editando === i ? { border: '1px solid var(--primary)', color: 'var(--primary)' } : {}) }}><IconLapiz /></button>
        {/* El tacho de la casa (app/_ui/BotonBorrar.tsx, general 9): rojo siempre. */}
        <button type="button" disabled={ocupado} onClick={alBorrar} title="Borrar" aria-label={`Borrar el mensaje ${i + 1}`}
          style={{ ...accionBurbuja, color: 'var(--bad)', border: '1px solid var(--bad)' }}><IconoBorrar size={16} /></button>
      </div>
      <div style={{ flex: '0 1 auto', minWidth: 0, maxWidth: 'calc(100% - 70px)', display: 'flex', justifyContent: saliente ? 'flex-end' : 'flex-start', borderRadius: 16, outline: editando === i ? '2px solid var(--primary)' : 'none', outlineOffset: 2 }}>
        {burbuja}
      </div>
    </div>
  );
  const vista: ReactNode = varias ? (
    partes.length ? partes.flatMap((p, i) => [
      pastillaPausa(i),
      filaDeBurbuja(i, burbujaDe(p), () => editar(i), () => borrar(i), unTexto),
    ]) : sinEscribir
  ) : (paso.cuerpo ?? '').trim() ? (
    filaDeBurbuja(0, <BurbujaHilo maxAncho="100%" {...pieBurbuja} contenido={{ texto: conNegocio(paso.cuerpo ?? ''), ia: esIA }} />, editarElUnico, borrarElUnico, true)
  ) : sinEscribir;

  // «{ }» EN LA BARRA, AL LADO DEL CLIP (la ranura `trasClip` de ComposerWhatsApp). Sin datos que
  // ofrecer no hay botón: un «{ }» que abre un árbol vacío se lee roto (como `SelectorDatos`).
  const botonDatos = grupos.length === 0 ? null : (
    <button type="button" ref={setBtnDatos} disabled={ocupado} title="Insertar un dato" aria-label="Insertar un dato" aria-expanded={abierto === 'datos'}
      onClick={() => setAbierto((a) => (a === 'datos' ? null : 'datos'))}
      style={{ ...iconComposer, width: 38, height: 38, fontSize: 13.5, fontWeight: 600, fontFamily: "'Geist Mono', monospace", color: abierto === 'datos' ? 'var(--primary)' : 'var(--dim)', opacity: ocupado ? 0.5 : 1 }}>{'{ }'}</button>
  );

  const faseNodo = fase ? (
    <div style={{ flex: 'none', padding: '7px 12px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 7 }}>
      <Spinner size={12} /> {fase}
    </div>
  ) : null;
  const editandoNodo = editando != null && !editandoAudio ? (
    <div style={{ flex: 'none', padding: '6px 12px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
      <IconLapiz /> <span style={{ flex: 1 }}>Editando</span>
      <button type="button" onClick={limpiarBarra} aria-label="Cancelar edición" title="Cancelar"
        style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>
    </div>
  ) : null;
  const errorNodo = error ? <div role="alert" style={{ flex: 'none', padding: '6px 12px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--bad)' }}>{error}</div> : null;
  const composerNodo = varias ? (
    <ComposerWhatsApp
      ref={composer}
      modo="enviar"
      valor={barra}
      onValor={escribir}
      onEnviar={enviar}
      placeholder={placeholderDe(paso.tipo, placeholder, adjunto?.tipo ?? null)}
      ocupado={ocupado}
      menuClip={menuClip.length ? menuClip : undefined}
      onAudio={permiteAudio ? (blob, secs) => usarAudio(blob, secs) : undefined}
      onErrorAudio={avisar}
      mientrasGraba={mientrasGraba}
      audioPendiente={audioPendiente}
      chip={chipActual}
      maxAlto={168}
      trasClip={botonDatos}
    />
  ) : (
    // UN SOLO MENSAJE: también `enviar` (ver `enviarElUnico`). La barra NO es el mensaje: arranca
    // vacía y lo enviado no se queda escrito, como en la de varias partes.
    <ComposerWhatsApp
      ref={composer}
      modo="enviar"
      valor={barra}
      onValor={escribir}
      onEnviar={enviarElUnico}
      placeholder={placeholderDe(paso.tipo, placeholder)}
      ocupado={ocupado}
      maxAlto={168}
      trasClip={botonDatos}
    />
  );

  // ── ✦ MaKo: lo que propone se aplica con las MISMAS funciones que la barra ─────────────────────
  const usarPropuesta = (textos: string[], modo: 'reemplazar' | 'agregar') => {
    if (!textos.length) return;
    if (!varias) {
      const unido = textos.join('\n\n');
      onChange({ cuerpo: modo === 'reemplazar' ? unido : [paso.cuerpo ?? '', unido].filter((t) => t.trim()).join('\n\n') });
    } else {
      aplicarPartes(propuestaALista(partesDe(pasoVivo.current), textos, modo));
    }
    alternarPanelMako(claveBorrador, false);
  };
  const usarGuion = (g: string) => {
    ponerGuion(g);
    alternarPanelMako(claveBorrador, false);
    // Arranca a grabar en el MISMO clic (el permiso del micrófono necesita el gesto de la persona).
    composer.current?.grabar();
  };
  const textoActual = (varias ? partes.flatMap((p) => (p.tipo === 'texto' ? [p.cuerpo] : p.tipo === 'media' && p.cuerpo ? [p.cuerpo] : [])) : [paso.cuerpo ?? '']).join('\n\n');
  const puedeAdaptar = !!permiteIA && adaptable(paso, varias);

  // LA FILA DE ARRIBA: las variantes de un solo mensaje SIN texto (con texto, el «↻ N» va al lado de su
  // burbuja, como en el de varias partes). El número y el ✦ van en la cabecera.
  const conVariantes = !varias && variantes.length > 0 && !(paso.cuerpo ?? '').trim();
  const arriba = conVariantes ? (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 8, minWidth: 0 }}>
      <button type="button" ref={setBtnVariantes} disabled={ocupado} title="Otras formas de decirlo" aria-expanded={abierto === 'variantes'}
        onClick={() => setAbierto((a) => (a === 'variantes' ? null : 'variantes'))} style={chip}>↻ {variantes.length}</button>
    </div>
  ) : null;

  // ── UNA columna, como un teléfono: arriba la fila, el chat (llena y scrollea), la barra abajo ──
  // Con el panel de MaKo abierto, el panel ocupa el lugar del chat y la barra; la barra queda MONTADA
  // (escondida): «Grabar con este guion» arranca la grabación desde el mismo clic.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, minWidth: 0 }}>
      {panelMako && (
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: 12, borderRadius: 14, border: '1px solid var(--mako-border)', background: 'var(--surface)' }}>
          <MakoRedacta
            contexto={{ actual: textoActual, disparador, objetivo: paraGuion?.objetivo ?? null, gancho: paraGuion?.gancho ?? null }}
            permiteAudio={permiteAudio}
            datos={redactaCon ?? 'motor'}
            adaptar={puedeAdaptar && !redactaCon ? { activo: esIA, onCambiar: (on) => { onChange({ tipo: on ? 'ia' : 'texto' }); onModoIA?.(on); } } : null}
            onUsar={usarPropuesta} onGuion={usarGuion}
            onCerrar={() => alternarPanelMako(claveBorrador, false)}
            deshabilitado={ocupado}
          />
        </div>
      )}
      <div style={{ display: panelMako ? 'none' : 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, minWidth: 0 }}>
        {arriba}
        <div data-chat style={{ flex: '1 1 auto', minHeight: ALTO_MIN_CHAT, padding: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderBottom: 'none', borderRadius: '14px 14px 0 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* `marginTop: auto` y no `justify-content: flex-end`: con flex-end y scroll, lo que desborda
              por ARRIBA no se puede alcanzar. Así las burbujas quedan abajo, como en un chat. */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: saliente ? 'flex-end' : 'flex-start', gap: 6 }}>
            {vista}
          </div>
        </div>
        <div data-barra style={{ flex: 'none', border: '1px solid var(--border)', borderRadius: '0 0 14px 14px', overflow: 'hidden', background: 'var(--surface)' }}>
          {faseNodo}
          {editandoNodo}
          {errorNodo}
          {composerNodo}
        </div>
      </div>

      <input ref={inputFoto} type="file" accept={ACEPTA_FOTO_VIDEO} style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) void subirArchivo(f); }} />
      <input ref={inputDoc} type="file" accept={ACEPTA_DOCUMENTO} style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (f) void subirArchivo(f); }} />

      {/* EL ÁRBOL DE LA CASA (app/_components/SelectorDatos.tsx), adentro del popover del composer. El
          dato entra como TEXTO PLANO `{{clave}}` donde está el cursor. */}
      {abierto === 'datos' && grupos.length > 0 && (
        <PopoverWA ancla={btnDatos} etiqueta="Datos" onCerrar={() => setAbierto(null)}>
          <ArbolDeDatos grupos={grupos} onElegir={(k) => { composer.current?.insertar(`{{${k}}}`, { enfocar: true }); setAbierto(null); }} />
        </PopoverWA>
      )}
      {abierto === 'variantes' && (
        <PopoverWA ancla={btnVariantes} etiqueta="Otras formas de decirlo" onCerrar={() => setAbierto(null)}>
          <div style={cajaPopover}>
            {variantes.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <textarea value={v} rows={3} aria-label={`Versión ${i + 2}`}
                  onChange={(e) => onChange({ variantes: variantes.map((x, j) => (j === i ? e.target.value : x)) })}
                  style={{ flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13, lineHeight: 1.45, resize: 'vertical', outline: 'none' }} />
                <button type="button" title="Quitar esta versión" aria-label="Quitar esta versión"
                  onClick={() => { const resto = variantes.filter((_, j) => j !== i); onChange({ variantes: resto }); if (!resto.length) setAbierto(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 13, padding: '5px 2px' }}>✕</button>
              </div>
            ))}
          </div>
        </PopoverWA>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

/**
 * «MaKo en WhatsApp» (MaKo en WhatsApp 2: «El editable de MaKo en WhatsApp debe ser lo mismo que el
 * editable de WhatsApp. La misma interfaz»): el MISMO editor, con el mensaje que MaKo le manda al
 * GRUPO del negocio. Es UN texto (el aviso al grupo es un mensaje): la barra es el mensaje, con
 * emojis y «{ }», sin audio ni archivos, y la burbuja la firma MaKo.
 *
 * Lo montan la tarjeta MAKO del lienzo (FlujoLienzo, `EditorMako`) y el lienzo de los Mensajes de MaKo
 * (las «Notificaciones», app/agencia/FlujoAviso.tsx, MaKo en WhatsApp 3: «tienen una interfaz vieja,
 * elimina eso»), con el árbol del «{ }» para el EQUIPO (`datos`).
 */
export function EditorMensajeGrupo({ texto, onTexto, variables, datos, deshabilitado, placeholder = 'Mensaje para tu equipo' }: {
  texto: string;
  /** El texto nuevo, en cada tecla (tipear no entra a la pila de deshacer del lienzo). */
  onTexto: (v: string) => void;
  /** Una lista plana (una rama). Mejor `datos`. */
  variables?: VariableEditor[];
  /** El árbol de lo que ESTE aviso puede resolver (`datosOfrecidos({ destino: 'equipo', … })`). */
  datos?: GrupoDatos[];
  deshabilitado?: boolean;
  placeholder?: string;
}) {
  const paso = useMemo<PasoSecuenciaDto>(() => ({
    orden: 1, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: texto, template_wa: null, tipo: 'texto', id: 'mako-grupo',
  }), [texto]);
  return (
    <EditorMensajeWhatsApp
      paso={paso} audios={[]} variables={variables} datos={datos} autor="MaKo"
      permiteAudio={false} permiteAdjuntos={false} permiteIA={false}
      deshabilitado={deshabilitado} placeholder={placeholder}
      onChange={(patch) => { if (typeof patch.cuerpo === 'string') onTexto(patch.cuerpo); }}
    />
  );
}
