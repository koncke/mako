'use client';

// =============================================================================
// Adjuntos que se LEEN: la caja adjunta en toda pantalla, aunque su motor no reciba archivos (27/10/2026, ticket #16)
// =============================================================================
// Leila (ws11): «No me deja adjuntar un documento ni por arrastrar, ni por adjuntar». Martín: «revisa que todos los chats
// acepten todos los formatos». Muchas pantallas no le pasaban `adjuntos` a la caja (el «+» no ofrecía «Documento») y casi
// ninguna tomaba lo arrastrado. Con esto, la caja (app/_chat/CajaChat.tsx) adjunta SOLA donde la pantalla no tiene
// adjuntos propios: al mandar, cada archivo se sube y se LEE (app/api/chat/leer-archivo → `archivoATexto`: Word, Excel,
// PowerPoint, PDF, texto, imágenes y audio) y lo leído sale CON el mensaje, como un texto pegado con su nombre (el hilo lo
// dibuja como documento). Así MaKo lee el contenido en todos los chats sin tocar el motor de ninguno.
// ⚠️ SE MANDA CON EL `onMandar` DE LA PANTALLA, en el render siguiente (el molde de ./nota-que-se-manda.ts): primero se le
//    pone el texto con lo leído (`onTexto`) y recién cuando la caja lo recibe de vuelta se manda.
// ⚠️ SI UNO NO SE PUEDE LEER, NO SALE NADA: queda marcado en rojo con el porqué, y lo escrito sigue en el campo.
// ⚠️ POR CONVERSACIÓN (28/10/2026, la verificación de 05d7c3187): una pantalla con varias conversaciones y UNA caja (Soporte: un
//    ticket, otro, la conversación nueva) pasa `conversacion`. Lo adjuntado es de la conversación donde se adjuntó (con una lista,
//    el .pptx del ticket 7 aparecía en el 8 cerrado y salía con el próximo mensaje del 9), y lo que se estaba leyendo cuando se
//    cambió de conversación NO sale en la otra: queda en la suya, para mandarlo al volver (salía como respuesta al ticket 9).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import type { AdjuntosDeCaja } from '@/app/admin/operaciones/AdjuntosCaja';
import type { AdjuntoCaja } from '@/app/admin/operaciones/useCentro';
import { ACCEPT_CHAT, porQueNoSeAdjunta, textoDelArchivo } from '@/lib/chat-formatos';
import { conPegadosHasta, conPegados } from '@/lib/chat-pegado';
import { listaParaMandar } from './nota-que-se-manda';

export const RUTA_LEER = '/api/chat/leer-archivo';
/** Los que entran en un mensaje (cada uno se lee por separado). */
export const MAX_ADJUNTOS_LEIDOS = 5;

async function pedir(cuerpo: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await fetch(RUTA_LEER, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!j?.ok) throw new Error(typeof j?.error === 'string' ? j.error : 'No se pudo leer.');
  return j;
}

/** Sube y lee UNO. El texto, o tira con el porqué. */
async function leerUno(file: File): Promise<string> {
  const subir = await pedir({ accion: 'subir-url', nombre: file.name, mime: file.type, tamano: file.size });
  const put = await fetch(String(subir.signedUrl), { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
  if (!put.ok) throw new Error(`No pude subir «${file.name}». Prueba de nuevo.`);
  const leido = await pedir({ accion: 'leer', path: subir.path, nombre: file.name, mime: file.type });
  return String(leido.texto ?? '');
}

export type AdjuntosQueSeLeen = {
  /** Lo que la caja le pasa al «+», a las miniaturas, a pegar y a soltar. Sin `activo`, undefined. */
  adjuntos: AdjuntosDeCaja | undefined;
  /** Mandar: sin archivos, el `onMandar` de la pantalla; con archivos, los lee y después lo manda. */
  mandar: () => void;
  /** Leyendo los archivos: la caja gira y no se escribe encima. */
  leyendo: boolean;
  /** Lo leído ya está en el campo y sale en el dibujo siguiente: todavía no le llegó a la pantalla. */
  entregando: boolean;
  /** Por qué no salió (un archivo que no se pudo leer o no se toma). */
  error: string | null;
  /** Lo que salió recortado por el tope de la pantalla (`tope`): se dice, no se corta callado. */
  aviso: string | null;
};

const SIN_ITEMS: AdjuntoCaja[] = [];
/**
 * Lo que la caja lee de las pantallas que dicen su `conversacion`, GUARDADO FUERA de la caja (28/10/2026, la verificación de
 * 1d586a686): la caja se desmonta (el Ops Center no la dibuja en un chat sin caja, como el Runner o uno de la nube; el teléfono
 * cierra la hoja) y lo adjuntado en esa conversación tiene que estar al volver. Sin `conversacion` (una sola), vive en la caja.
 */
const GUARDADO = new Map<string, AdjuntoCaja[]>();

export function useAdjuntosQueSeLeen({ activo, texto, onTexto, onMandar, onError, tope, conversacion = '' }: {
  activo: boolean;
  /** Cuántos caracteres lee el motor de la pantalla (el Video y el Image Editor, 2.000): lo leído entra hasta ahí, con aviso. */
  tope?: number;
  texto: string;
  onTexto: (t: string) => void;
  onMandar: () => void;
  onError?: (m: string) => void;
  /** De qué conversación es lo que se adjunta, en una pantalla con varias y una caja (Soporte). Sin esto, una sola. */
  conversacion?: string;
}): AdjuntosQueSeLeen {
  const [locales, setLocales] = useState<AdjuntoCaja[]>([]);
  const [, redibujar] = useState(0);
  const items = conversacion ? GUARDADO.get(conversacion) ?? SIN_ITEMS : locales;
  const ponerItems = (c: string, f: (ya: AdjuntoCaja[]) => AdjuntoCaja[]) => {
    if (!c) { setLocales(f); return; }
    GUARDADO.set(c, f(GUARDADO.get(c) ?? []));
    redibujar((n) => n + 1);
  };
  /** Las conversaciones cuyo mensaje se está leyendo: cada una el suyo (la verificación de d2f690673: con una por vez, Enter en el
   *  ticket 9 mientras se leía el 7 no hacía nada y no decía nada). */
  const [leyendoEn, setLeyendoEn] = useState<readonly string[]>([]);
  const leyendo = leyendoEn.includes(conversacion);
  const dejarDeLeer = (c: string) => setLeyendoEn((xs) => xs.filter((x) => x !== c));
  const actual = useRef(conversacion);
  actual.current = conversacion;
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Lo que se dijo de otra conversación no queda debajo de ésta.
  const [vista, setVista] = useState(conversacion);
  if (vista !== conversacion) { setVista(conversacion); setError(null); setAviso(null); }
  const [pendiente, setPendiente] = useState<string | null>(null);
  const mandarPantalla = useRef(onMandar);
  useEffect(() => { mandarPantalla.current = onMandar; });
  const decir = (m: string) => { setError(m); onError?.(m); };
  // Las miniaturas de las imágenes son `blob:` locales: las de la caja se sueltan al irse (lo guardado por conversación se queda,
  // para volver). Y una lectura que termina con la caja desmontada no escribe ni manda nada (`vivo`).
  const vivo = useRef(true);
  const propios = useRef(locales);
  propios.current = locales;
  // `vivo` vuelve a true al montar: el modo estricto de React monta, desmonta y vuelve a montar.
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; for (const x of propios.current) if (x.url) URL.revokeObjectURL(x.url); };
  }, []);

  // Lo leído ya está en la caja: se manda por el camino de siempre de la pantalla.
  useEffect(() => {
    if (pendiente == null || !listaParaMandar(pendiente, texto)) return;
    setPendiente(null);
    mandarPantalla.current();
  }, [pendiente, texto]);

  const sumar = (archivos: File[]) => {
    setError(null);
    setAviso(null);
    const nuevos: AdjuntoCaja[] = [];
    for (const f of archivos) {
      const no = porQueNoSeAdjunta(f.name, f.type, f.size);
      if (no) { decir(no); continue; }
      const imagen = f.type.startsWith('image/');
      nuevos.push({ id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`, file: f, tipo: imagen ? 'image' : 'document', url: imagen ? URL.createObjectURL(f) : '' });
    }
    if (!nuevos.length) return;
    ponerItems(conversacion, (ya) => {
      const todos = [...ya, ...nuevos];
      if (todos.length > MAX_ADJUNTOS_LEIDOS) decir(`Van hasta ${MAX_ADJUNTOS_LEIDOS} archivos por mensaje.`);
      return todos.slice(0, MAX_ADJUNTOS_LEIDOS);
    });
  };

  const mandar = () => {
    if (!items.length) { onMandar(); return; }
    if (leyendo) return;
    const de = conversacion;
    const lista = items;
    const marcar = (id: string, estado: AdjuntoCaja['estado']) => ponerItems(de, (ya) => ya.map((x) => (x.id === id ? { ...x, estado } : x)));
    setError(null);
    setAviso(null);
    setLeyendoEn((xs) => [...xs, de]);
    void (async () => {
      const leidos: string[] = [];
      for (const it of lista) {
        marcar(it.id, 'leyendo');
        try {
          leidos.push(textoDelArchivo(it.file.name, await leerUno(it.file)));
          marcar(it.id, undefined);
        } catch (e) {
          marcar(it.id, 'error');
          if (vivo.current && actual.current === de) decir(e instanceof Error ? e.message : `No pude leer «${it.file.name}».`);
          dejarDeLeer(de);
          return;
        }
      }
      // Con el tope del motor de la pantalla, lo leído entra hasta ahí con su marca de cierre, y se DICE (la revisión del 27/10).
      const { mensaje: nuevo, afuera } = tope ? conPegadosHasta(texto, leidos, tope) : { mensaje: conPegados(texto, leidos), afuera: 0 };
      // Se cambió de conversación mientras se leía: no sale en la otra (iría al ticket equivocado). Queda en la suya, leído de
      // nuevo al mandarlo desde ahí.
      if (vivo.current && actual.current !== de) { dejarDeLeer(de); return; }
      // La caja se fue mientras leía: no se manda nada. Con `conversacion`, lo adjuntado sigue guardado para volver. SIN ella vivía
      // en la caja y se iba con ella (la verificación de 5ddf1672a, el Ops Center del cliente al abrir Tickets): lo leído queda en
      // el campo de la pantalla, que vive afuera, y sale con el próximo Enter.
      if (!vivo.current) {
        dejarDeLeer(de);
        if (!de) onTexto(nuevo);
        return;
      }
      if (afuera) setAviso(`Este chat lee hasta ${tope!.toLocaleString('es')} caracteres: lo adjuntado no entró entero (quedaron afuera ${afuera.toLocaleString('es')}).`);
      for (const x of lista) if (x.url) URL.revokeObjectURL(x.url);
      ponerItems(de, (ya) => ya.filter((x) => !lista.some((y) => y.id === x.id)));
      dejarDeLeer(de);
      setPendiente(nuevo);
      onTexto(nuevo);
    })();
  };

  return {
    adjuntos: activo ? {
      items, puede: !leyendo, accept: ACCEPT_CHAT, onSumar: sumar,
      onQuitar: (id) => ponerItems(conversacion, (ya) => ya.filter((x) => { if (x.id === id && x.url) URL.revokeObjectURL(x.url); return x.id !== id; })),
    } : undefined,
    mandar: activo ? mandar : onMandar,
    leyendo,
    // Leído y todavía sin entregar a la pantalla (sale en el dibujo siguiente): para quien espera ESE mensaje (Soporte).
    entregando: pendiente != null,
    error,
    aviso,
  };
}
