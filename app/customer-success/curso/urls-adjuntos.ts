// =============================================================================
// urls-adjuntos — las URLs con las que el EQUIPO ve los adjuntos de la lección (UNA caché, no dos)
// =============================================================================
// Las URLs firmadas de los adjuntos (imágenes, PDF, archivos) de la descripción de una clase Y de las
// consignas de sus tareas (viven 60 minutos: `VIDA_EQUIPO_SEG`, lib/curso-adjuntos.ts). Una caché del
// MÓDULO, no del componente: así se pueden pedir ANTES de abrir la clase (`precargarUrlsDeAdjuntos`, al
// pasar el cursor por su tarjeta) y la lección las encuentra listas.
//
// ⚠️ UNA SOLA PIEZA PARA LA DESCRIPCIÓN Y LA TAREA (revisión final del 08/10/2026). Hasta acá había DOS:
//    la de la lección (./LeccionEditable.tsx, con esta caché del módulo) y una copia con estado propio en
//    ./TareaEditor.tsx. El cursor encima de una tarjeta adelantaba las URLs de la consigna de la tarea a la
//    caché de la lección, y el editor de la tarea las volvía a pedir al abrirse: una action más en la fila
//    de la apertura, que es justo lo que el item 18 del audio («está tardando mucho en cargar una clase»,
//    10:40) vino a sacar.
// ⚠️ LAS SERVER ACTIONS SE ENCOLAN (AGENTS.md): al abrir una clase, las URLs de las imágenes iban en fila
//    detrás de cualquier otra action de la lección. Adelantadas al hover salen antes del clic, y cada id se
//    pide UNA vez aunque lo pidan dos piezas a la vez (`PEDIDOS`).
//
// Sin 'use client' y sin JSX: lo importan sólo componentes del navegador (la lección y la tarea).

import { useCallback, useEffect, useState } from 'react';
import { idDeRef, refsEnHtml } from '@/app/_ui/HtmlSeguro';
import { urlsAdjuntosAction } from './adjuntos-actions';

const URLS = new Map<string, { url: string; vence: number }>();
const PEDIDOS = new Map<string, Promise<void>>();
/** Menos que los 60 minutos de la firma: una URL que vence a mitad de lectura deja una imagen rota. */
const VIDA_CACHE_MS = 45 * 60 * 1000;
const oyentes = new Set<() => void>();

function pedirUrls(ids: readonly string[]): Promise<void> {
  const ahora = Date.now();
  const faltan = [...new Set(ids)].filter((id) => !PEDIDOS.has(id) && !((URLS.get(id)?.vence ?? 0) > ahora));
  if (!faltan.length) return Promise.all(ids.map((id) => PEDIDOS.get(id)).filter(Boolean)).then(() => {});
  const p = urlsAdjuntosAction(faltan)
    .then((r) => {
      if (!r.ok) return;
      for (const [id, url] of Object.entries(r.urls)) URLS.set(id, { url, vence: Date.now() + VIDA_CACHE_MS });
      for (const f of [...oyentes]) f();
    })
    .catch(() => { /* sin URL la imagen no se dibuja y el chip queda sin link: no se cae nada */ })
    .finally(() => { for (const id of faltan) PEDIDOS.delete(id); });
  for (const id of faltan) PEDIDOS.set(id, p);
  return p;
}

/** Adelanta las URLs de los adjuntos que nombran estos HTML (la descripción y las consignas). */
export function precargarUrlsDeAdjuntos(htmls: readonly string[]): void {
  const ids = htmls.flatMap((h) => refsEnHtml(h));
  if (ids.length) void pedirUrls(ids);
}

/**
 * `ref → URL` para dibujar los adjuntos de `html`; pide los que falten y repinta cuando llegan.
 *
 * ⚠️ LA FUNCIÓN CAMBIA DE IDENTIDAD CUANDO LLEGAN URLS (`version`), y es a propósito: el editor rico
 *    (app/_ui/EditorRico.tsx) redibuja sus imágenes SÓLO cuando cambia `urlDeAdjunto` — sus imágenes son
 *    nodos de ProseMirror, no hijos de React. Con una función fija (`useCallback(…, [])`, como quedó en la
 *    integración del 08/10/2026) una imagen cuya URL llegaba DESPUÉS de montar el editor —abrir una clase
 *    por link, o sin pasar el cursor por su tarjeta— quedaba en blanco hasta que alguien la tocara. Medido
 *    en el banco de la lección (Chrome headless, la action de las URLs con 1,2 s de demora): con la función
 *    fija, la imagen seguía sin `src` y marcada pendiente a los 3,5 s; con `version`, `src` puesto.
 */
export function useUrlsDeAdjuntos(html: string) {
  const [version, repintar] = useState(0);
  useEffect(() => {
    const f = () => repintar((n) => n + 1);
    oyentes.add(f);
    return () => { oyentes.delete(f); };
  }, []);
  useEffect(() => { const ids = refsEnHtml(html); if (ids.length) void pedirUrls(ids); }, [html]);
  // `version` se nombra adentro: es la dependencia (lo que cambia es la caché del módulo, no algo del cierre).
  return useCallback((ref: string) => (version >= 0 ? URLS.get(idDeRef(ref) ?? '')?.url ?? null : null), [version]);
}
