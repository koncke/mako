// =============================================================================
// La guía de cada pestaña: los tipos de su catálogo (PURO; 29/10/2026)
// =============================================================================
// Martín (29/10/2026): «que Mako le pueda ir señalizando diferentes lugares… cada vez que un usuario entra por primera vez a una
// tab, Mako le puede preguntar, hey, ¿quieres que te ayude a aprender a utilizar esta pestaña?… que no sea un tutorial predefinido
// con pasos… que la pestaña se ponga un poco opaca por detrás». El plan: docs/mako-iniciativa/guia.md.
//
// Cada tab declara SU catálogo al lado de su pantalla (app/second-brain/guia-ops-center.ts…): las partes que se pueden señalar
// (ANCLAS, el `data-recorrido` de siempre) y de 2 a 4 OBJETIVOS cortos («Conectar tu IA»), de 1 a 3 pasos cada uno. No hay
// «Siguiente» ni «2 de 7»: se avanza USANDO lo señalado. Puro, sin React: lo leen la pantalla, el server y los tests.
// =============================================================================

import type { Buscar } from '@/app/automations/recorrido-automations';

export type Ancla = {
  /** El `data-recorrido` (y lo que nombraría el modelo). Con el prefijo de su tab (`sb-`), o `mk-` si es de todo chat. NO SE RENOMBRA. */
  id: string;
  /** Cómo se llama en pantalla: «Nuevo chat» (24 o menos). */
  nombre: string;
  /** Qué se hace ahí, de tú: la frase por defecto al lado del ancla (60 o menos). */
  para: string;
  /** Otra ancla que la hace aparecer (un menú, un modo): se señala sola primero, y no cuenta en los 3 pasos. */
  antes?: string;
  /** La respuesta rápida de «Dónde está…», sin IA: «¿Dónde están mis reportes?». */
  pregunta?: string;
  /** Sólo si no se puede marcar a mano: dónde encontrarla (selectores escritos por el CÓDIGO, con dónde viven). */
  donde?: readonly Buscar[];
  /** Vive adentro del chat dueño (la caja, el «Instalar MaKo»): se busca sólo ahí, la primera visible. */
  enElChat?: true;
  /** En un lienzo con `overflow: hidden`: nunca `scrollIntoView` (corrió un lienzo 330 px). */
  sinScroll?: true;
  /** Un canvas o un iframe: se señala el panel entero. */
  dibujo?: true;
  /** No existe en una ventana angosta. */
  movil?: false;
};

/** Cómo se da por hecho un paso: tocando su ancla (lo de siempre) o cuando aparece otra (la descarga → «Ya lo instalé»). */
export type HechoPaso = 'toque' | { aparece: string };

export type PasoGuia = { ancla: string; frase?: string; hecho?: HechoPaso };

/** Lo que la tab ya sabe de la persona y su pantalla: decide qué objetivo se ofrece y cuál va primero, sin IA. */
export type HechosGuia = Readonly<Record<string, boolean | number | string | null | undefined>>;

export type RolGuia = 'admin' | 'miembro';

export type ObjetivoGuia = {
  id: string;
  /** «Conectar tu IA» (24 o menos): lo que se lee en el botón. */
  titulo: string;
  pasos: readonly PasoGuia[];
  /** Si se ofrece con estos hechos (sin esto, siempre). El primero que se ofrece es el recomendado. */
  si?: (h: HechosGuia) => boolean;
  roles?: readonly RolGuia[];
};

export type GuiaDeTab = {
  /** La key de la tab en app/_components/nav.ts («mako» es el Ops Center): la marca de la primera vez es `guia-<key>`. */
  key: string;
  /** Cómo se llama la pestaña: «Ops Center». */
  nombre: string;
  href: string;
  /** Exige la computadora (el Video Editor): en una ventana angosta no pregunta. */
  soloComputadora?: true;
  anclas: readonly Ancla[];
  objetivos: readonly ObjetivoGuia[];
};
