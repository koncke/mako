// =============================================================================
// Lo que necesita una persona para generar en AI Avatar, paso a paso (módulo PURO)
// =============================================================================
// 29/10/2026, el Cerebro con la decisión de Martín («haz que AI-Avatar esté disponible para todos»): «lo que necesita un
// cliente para generar (la extensión, su cuenta de Google Flow y sus créditos) lo dice la pantalla clara y paso a paso, ANTES
// de que apriete Generar. Si falta algo, lo dice; que no falle callado».
//
// Nada de esto es del plan: es de la PERSONA. MaKo genera con la cuenta de Google Flow de quien genera, por la extensión de
// MaKo en su Chrome (memoria «puente-flow-extension»): sin la extensión, sin conectarla al negocio, sin Flow abierto con su
// cuenta o sin una foto de su cara, «Generar» no puede salir bien, y lo honesto es decirlo antes y en ese orden.
//
// Los pasos son los mismos del popup de la extensión (instalar → conectar → abrir Google Flow), que es la única pantalla que
// sabe cuál de los tres falta en ESE navegador; acá se nombran con lo que se ve desde MaKo: el estado del puente que guarda el
// servidor (`flow_puentes`: estado, último latido, versión) y, en la computadora, si la extensión está en ESTE Chrome
// (`data-mako-puente`, app/video-generator/extension-instalada.tsx).
//
// ⚠️ `detalle` del puente NO se muestra (app/video-generator/puente-avisos.tsx dice por qué: es texto libre del navegador).
// SIN `server-only` y sin 'use client': lo usan app/ai-avatar/Estudio.tsx y app/m/ai-avatar/EstudioM.tsx.

import type { EstadoPuente } from '../flow-cola';
import { lineaDeVersion } from '../extension-tienda';
import { MOTOR_INTERFAZ_DESDE } from '../flow-interfaz';

/** Lo que el servidor sabe del puente del negocio (actions.ts → `puenteParaAvatar`). */
export type PuenteVisto = {
  estado: EstadoPuente;
  /** ¿Latió hace poco? Un puente «listo» que no late es una computadora cerrada o un Chrome sin la pestaña de Flow. */
  vivo: boolean;
  /** ¿La extensión es la que genera por la interfaz de Flow (≥ 0.69)? Una vieja no sabe poner la cara. */
  actualizada: boolean;
};

export type IdPaso = 'extension' | 'conectar' | 'actualizar' | 'flow' | 'foto';

export type PasoRequisito = {
  id: IdPaso;
  /** Lo que hay que hacer, en una línea. */
  titulo: string;
  hecho: boolean;
  /** Por qué o cómo, en una línea corta. */
  ayuda: string;
  enlace?: { texto: string; href: string };
};

/** Dónde están los pasos para instalar y actualizar la extensión (la misma página que usa el Video Generator). */
export const RUTA_INSTALAR = '/extension/instalar';

/** Lo que cuesta, dicho antes de apretar: el look es gratis; el video gasta créditos de la cuenta de Flow de la persona. */
export const CREDITOS = 'El avatar no gasta créditos. Cada toma del video gasta créditos de tu cuenta de Google Flow (hasta 15 por toma).';

/**
 * Los pasos, en orden, con cuáles están hechos. `para: 'video'` no pide la foto (el avatar ya la tiene puesta).
 * `instalada` es lo que ve ESTE navegador: la versión si la extensión está, `false` si no, `null` si no se sabe (el teléfono,
 * o la página que todavía no miró).
 */
export function requisitosAvatar(p: {
  puente: PuenteVisto;
  instalada: string | false | null;
  enTelefono: boolean;
  fotos: number;
  para: 'avatar' | 'video';
}): { pasos: PasoRequisito[]; listo: boolean; falta: PasoRequisito | null } {
  const { puente } = p;
  const conectada = puente.estado !== 'sin_conectar';
  const enLaCompu = p.enTelefono ? 'En tu computadora: ' : '';
  const pasos: PasoRequisito[] = [
    {
      id: 'extension',
      titulo: `${enLaCompu}instala la extensión de MaKo en Google Chrome`,
      // Conectada en otro Chrome también cuenta: el que genera es ESE.
      hecho: conectada || (typeof p.instalada === 'string' && p.instalada.length > 0),
      ayuda: 'Con ella MaKo genera con tu propia cuenta de Google Flow.',
      enlace: { texto: 'Cómo instalarla', href: RUTA_INSTALAR },
    },
    {
      id: 'conectar',
      titulo: 'Conéctala a tu negocio: ícono de MaKo → «Conectar»',
      hecho: conectada,
      ayuda: 'Con MaKo abierto en este negocio, en el mismo Chrome.',
    },
  ];
  if (conectada && !puente.actualizada) {
    pasos.push({
      id: 'actualizar',
      titulo: 'Actualiza la extensión de MaKo',
      hecho: false,
      ayuda: lineaDeVersion(MOTOR_INTERFAZ_DESDE, 'La que tienes no sabe poner tu cara en el avatar.'),
      enlace: { texto: 'Cómo actualizarla', href: RUTA_INSTALAR },
    });
  }
  pasos.push({
    id: 'flow',
    titulo: 'Abre Google Flow con tu cuenta, desde el ícono de MaKo',
    hecho: puente.estado === 'listo' && puente.vivo,
    ayuda: puente.estado === 'marcada'
      ? 'Google pausó tu sesión de Flow: vuelve a abrirla desde el ícono de MaKo.'
      : puente.estado === 'listo' && !puente.vivo
        ? 'Tu computadora dejó de responder: deja Chrome abierto con Google Flow.'
        : 'Necesitas una cuenta de Google con acceso a Flow; ahí se generan tus imágenes y videos.',
  });
  if (p.para === 'avatar') {
    pasos.push({
      id: 'foto',
      titulo: 'Pon una foto de tu cara en «Personaje»',
      hecho: p.fotos > 0,
      ayuda: 'MaKo la usa para que el avatar tenga tu cara.',
    });
  }
  const falta = pasos.find((x) => !x.hecho) ?? null;
  return { pasos, listo: !falta, falta };
}
