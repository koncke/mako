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
  /** Por qué no salió (un archivo que no se pudo leer o no se toma). */
  error: string | null;
  /** Lo que salió recortado por el tope de la pantalla (`tope`): se dice, no se corta callado. */
  aviso: string | null;
};

const SIN_ITEMS: AdjuntoCaja[] = [];

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
  const [porConversacion, setPorConversacion] = useState<Record<string, AdjuntoCaja[]>>({});
  const items = porConversacion[conversacion] ?? SIN_ITEMS;
  const ponerItems = (c: string, f: (ya: AdjuntoCaja[]) => AdjuntoCaja[]) => setPorConversacion((m) => ({ ...m, [c]: f(m[c] ?? []) }));
  /** La conversación cuyo mensaje se está leyendo (una por vez). */
  const [leyendoEn, setLeyendoEn] = useState<string | null>(null);
  const leyendo = leyendoEn === conversacion;
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
  // Las miniaturas de las imágenes son `blob:` locales: se sueltan al irse (las de todas las conversaciones).
  const todos = useRef(porConversacion);
  todos.current = porConversacion;
  useEffect(() => () => { for (const xs of Object.values(todos.current)) for (const x of xs) if (x.url) URL.revokeObjectURL(x.url); }, []);

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
    if (leyendoEn != null) return;
    const de = conversacion;
    const lista = items;
    const marcar = (id: string, estado: AdjuntoCaja['estado']) => ponerItems(de, (ya) => ya.map((x) => (x.id === id ? { ...x, estado } : x)));
    setError(null);
    setAviso(null);
    setLeyendoEn(de);
    void (async () => {
      const leidos: string[] = [];
      for (const it of lista) {
        marcar(it.id, 'leyendo');
        try {
          leidos.push(textoDelArchivo(it.file.name, await leerUno(it.file)));
          marcar(it.id, undefined);
        } catch (e) {
          marcar(it.id, 'error');
          if (actual.current === de) decir(e instanceof Error ? e.message : `No pude leer «${it.file.name}».`);
          setLeyendoEn(null);
          return;
        }
      }
      // Se cambió de conversación mientras se leía: no sale en la otra (iría al ticket equivocado). Queda en la suya, leído de
      // nuevo al mandarlo desde ahí.
      if (actual.current !== de) { setLeyendoEn(null); return; }
      // Con el tope del motor de la pantalla, lo leído entra hasta ahí con su marca de cierre, y se DICE (la revisión del 27/10).
      const { mensaje: nuevo, afuera } = tope ? conPegadosHasta(texto, leidos, tope) : { mensaje: conPegados(texto, leidos), afuera: 0 };
      if (afuera) setAviso(`Este chat lee hasta ${tope!.toLocaleString('es')} caracteres: lo adjuntado no entró entero (quedaron afuera ${afuera.toLocaleString('es')}).`);
      for (const x of lista) if (x.url) URL.revokeObjectURL(x.url);
      ponerItems(de, (ya) => ya.filter((x) => !lista.some((y) => y.id === x.id)));
      setLeyendoEn(null);
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
    error,
    aviso,
  };
}
