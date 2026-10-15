'use client';
// =============================================================================
// CrearConIA — lo que comparten las piezas de «Pídeselo a MaKo» (los ejemplos, el título, el placeholder que se
// escribe solo y la forma del resultado)
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 11): «Quiero que implementes la
// funcionalidad de crear un secuencia con IA, mediante un "prompt", y que ahí se vayan
// creando...». Decisión 14 de docs/chatbot-flujo-ramas-diseno.md.
//
// ⛔ LA CAJA SE FUE (duodécima tanda, 12/10/2026, docs/diseno-duodecima-tanda.md §2.5). Era el componente
// `CrearConIA` en tres formas (la caja de la galería, la del lienzo vacío y la barra «Pídele un cambio»); ahora es UN
// chat por automatización, app/automations/ChatMako.tsx (modo 'galeria' | 'editar'), con el hilo yo/MaKo, las
// preguntas con botones y el composer. El lector del stream salió a app/automations/stream-ia.ts. Martín, textual:
// «tiene que tener un chat donde guarda el registro... como hoy lo hace Claude que te saltan una pregunta con tres
// opciones». El modo 'crear' (la caja del lienzo vacío, que desde la décima tanda no se dibujaba) se fue con ella: si
// vuelve, es el chat en modo galería con `secuenciaId`.
//
// Lo que queda acá lo importan otros (y lo fijan sus tests): `EJEMPLOS` y `useEjemploQueSeEscribe` (también el AI Step,
// app/automations/EditorPasoIA.tsx), `TITULO_GALERIA_IA` y la forma del resultado, `ListoCrearIA`.
//
// DECIMOTERCERA TANDA (12/10/2026): ChatMako.tsx ya no tiene modo galería. El modal «Nueva automatización» monta
// `BarraPideselo` (la barra de WhatsApp con el logo de MaKo y el ejemplo que se escribe), que sólo PIDE: la fila nace YA
// y MaKo trabaja en su lienzo, con el chat de esa fila (`ChatMako`, que con el lienzo vacío CREA sobre ella).
//
// DECIMOCUARTA TANDA (12/10/2026): `BarraPideselo` es la caja del Landing Generator (app/web-generator/CajaPedido.tsx),
// que escribe `EJEMPLOS` con `useEjemploQueSeEscribe`. Sin «Nace pausada».
//
// DECIMOQUINTA TANDA (12/10/2026): el ejemplo ya no para PARA SIEMPRE al primer toque: para mientras la caja tiene el
// foco y vuelve si se sale sin escribir (punto 6, lo decide CajaPedido). Y el «+» de la caja sube un archivo o una
// imagen para que MaKo arme el flujo de eso (punto 7): `pedidoConArchivo` arma el pedido y `ACCEPT_ARCHIVO_FLUJO` dice
// qué se puede subir.
//
// TERCERA TANDA (09/10/2026, «Por otro lado», puntos 2 a 6, y la decisión 17 del diseño), lo que sigue valiendo en el
// chat: el input minimalista con el micrófono del Plan (`BotonDictar`), el placeholder que escribe y borra ejemplos
// genéricos y para del todo al primer toque, y la creación que oscurece el resto (en el lienzo) con Cancelar.
// =============================================================================

import { useEffect, useState } from 'react';
import { EXT_POR_FAMILIA } from '@/lib/formatos-archivo';
import type { ListoIA } from '@/lib/flujo-ia';
import type { ExtrasEdicionIA } from '@/lib/automatizacion-chat';
import type { PasoGrafo } from '@/lib/flujo-grafo';

/**
 * Lo que recibe `onListo`.
 *   · `disparador` (crear): el valor del desplegable del CRON que quedó puesto, para dibujarlo sin
 *     recargar.
 *   · `base` (editar): el borrador que se MANDÓ. El padre lo compara con el lienzo de ahora antes de
 *     aplicar (`edicionVigente`, lib/flujo-ia-cliente.ts): si se tocó en el medio, no lo pisa.
 *   · Lo de editar de la duodécima tanda (§3.5, `ExtrasEdicionIA`): `cambiadas`, `quitadas`, `resumen`, y
 *     `disparadores` (el CRON que eligió la persona: quien monta lo guarda YA por `action: 'disparadores'`). La
 *     `pregunta` la dibuja el chat.
 */
export type ListoCrearIA = Pick<ListoIA, 'secuenciaId' | 'pasos' | 'nombre' | 'orden' | 'avisos' | 'etiquetasNuevas' | 'disparador'>
  & Partial<ExtrasEdicionIA>
  & { modo: 'crear' | 'editar'; base?: readonly PasoGrafo[] };

// ── El placeholder que se escribe solo ──────────────────────────────────────────

/**
 * Los ejemplos del placeholder: GENÉRICOS a propósito (punto 5). Lo que hace un negocio cualquiera, sin
 * el nombre de una etapa, un producto ni un cliente — un nombre de etapa de un cliente en la pantalla de
 * otro se lee como un dato (AGENTS.md: un ejemplo de UI es ficticio por regla).
 */
export const EJEMPLOS = [
  'Confirmar la reunión un día antes y avisarme si no contesta',
  'Recuperar a quien dejó sus datos y no agendó',
  'Dar la bienvenida por WhatsApp a cada lead nuevo',
  'Volver a escribirle a quien no vino a la llamada',
  'Etiquetar a quien responde que le interesa',
] as const;

/** El título del chat en el modal «Nueva automatización» (décima tanda, punto 6). */
export const TITULO_GALERIA_IA = 'Pídeselo a MaKo';

/** Lo que queda en el campo cuando la animación ya paró. */
export const PLACEHOLDER_QUIETO = 'Escribe o dicta qué tiene que pasar';

/**
 * El ritmo. El mecanismo es el del onboarding (app/onboarding/Bienvenida.tsx, `Maquina`: escribe, se
 * queda, borra, sigue con la próxima, con un jitter para que no suene a metrónomo), pero más rápido:
 * allá se escribe el final de una frase de 3 palabras y acá un pedido entero de 8 a 10.
 */
const MS_LETRA = 60;
const MS_BORRAR = 28;
const MS_JITTER = 40;
const MS_QUIETA = 1900;

/**
 * El ejemplo que se escribe y se borra. Arranca con el primero COMPLETO (el HTML del server y el del
 * cliente coinciden). Con `activo` en false se QUEDA donde está; si vuelve a true, sigue desde ahí. Quién lo
 * apaga lo decide quien lo usa: la caja de «¿Qué vas a crear hoy?» mientras tiene el foco o algo escrito
 * (decimoquinta tanda, punto 6: «si le doy click y me salgo o al final no escribo nada, debería seguir esa
 * animación», `seMueveElEjemplo` de CajaPedido.tsx); el AI Step, al primer toque. Con
 * `prefers-reduced-motion` no se mueve nunca.
 */
// Exportado (AI Step v2, décima tanda): el «¿Qué tiene que lograr?» del AI Step escribe sus propios ejemplos
// con el MISMO mecanismo (app/automations/EditorPasoIA.tsx). `ejemplos` ausente = los de crear una automatización.
export function useEjemploQueSeEscribe(activo: boolean, ejemplos: readonly string[] = EJEMPLOS): string {
  const [i, setI] = useState(0);
  const [largo, setLargo] = useState<number>(ejemplos[0].length);
  const [borrando, setBorrando] = useState(false);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setQuieto(true);
    } catch { /* sin matchMedia */ }
  }, []);

  useEffect(() => {
    if (!activo || quieto) return;
    const frase = ejemplos[i % ejemplos.length];
    // El largo se mide contra la frase ACTUAL: si la lista cambia (la caja del Landing Generator
    // cambia de ejemplos al pasar de Landing a Presentación), el de la frase vieja puede quedar más
    // largo que la nueva y no llegaba nunca a «igual»: seguía escribiendo para siempre.
    const n = Math.min(largo, frase.length);
    if (!borrando && n === frase.length) {
      const t = setTimeout(() => setBorrando(true), MS_QUIETA);
      return () => clearTimeout(t);
    }
    if (borrando && n === 0) {
      const t = setTimeout(() => { setBorrando(false); setI((x) => (x + 1) % ejemplos.length); }, 280);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLargo((l) => Math.min(l, frase.length) + (borrando ? -1 : 1)), (borrando ? MS_BORRAR : MS_LETRA) + Math.random() * MS_JITTER);
    return () => clearTimeout(t);
  }, [activo, quieto, i, largo, borrando, ejemplos]);

  return ejemplos[i % ejemplos.length].slice(0, largo);
}

// ── Un archivo o una imagen como pedido (decimoquinta tanda, punto 7) ────────────────────────────

/**
 * Lo que entra al pedido de MaKo: el tope de la ruta (app/api/chat-agent/secuencias/ia/route.ts, `slice(0, 2000)`) y
 * del prompt (`userDeCrear`, lib/flujo-ia.ts). Un pedido más largo se corta ahí sin avisar: se recorta ACÁ, a la vista.
 */
export const TOPE_PEDIDO_MAKO = 2_000;

/** El pedido cuando sólo se subió el archivo, sin escribir nada. */
export const PEDIDO_SOLO_ARCHIVO = 'Arma la automatización con lo que dice este archivo.';

/**
 * Qué se puede subir con «Subir archivo o imagen»: documentos, planillas, presentaciones y capturas (las familias de
 * lib/formatos-archivo.ts que se leen como texto o por visión). Sin audio ni video: para hablarle a MaKo está el
 * micrófono de la caja.
 */
export const ACCEPT_ARCHIVO_FLUJO = (['texto', 'docx', 'pdf', 'xlsx', 'pptx', 'opendocument', 'imagen'] as const)
  .flatMap((f) => EXT_POR_FAMILIA[f].map((e) => `.${e}`)).join(',');

/**
 * EL PEDIDO CON UN ARCHIVO: lo escrito (o `PEDIDO_SOLO_ARCHIVO`) y, abajo, lo que dice el archivo, todo dentro de
 * `TOPE_PEDIDO_MAKO`. Lo escrito manda: va primero y entero (hasta un tercio del tope); el archivo llena el resto y, si
 * no entra, termina en «…». Pura y exportada para el test.
 */
export function pedidoConArchivo(escrito: string, archivo: { nombre: string; texto: string }, tope = TOPE_PEDIDO_MAKO): string {
  const pedido = (escrito.trim() || PEDIDO_SOLO_ARCHIVO).slice(0, Math.floor(tope / 3));
  const cabeza = `${pedido}\n\nEl archivo «${archivo.nombre.trim().slice(0, 80) || 'sin nombre'}»:\n`;
  const lugar = Math.max(0, tope - cabeza.length);
  const texto = archivo.texto.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return cabeza + (texto.length > lugar ? `${texto.slice(0, Math.max(0, lugar - 1))}…` : texto);
}
