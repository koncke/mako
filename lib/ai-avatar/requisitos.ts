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
import { alcanzaElSaldo } from '../mako-tokens-reglas';

/**
 * Con qué se genera. **Son dos caminos de verdad distintos, no una opción de calidad.**
 *
 * - `flow`: la cuenta de Google Flow de la persona, por la extensión de MaKo en SU Chrome. Paga ella, con sus
 *   créditos de Flow. Es lo que existía.
 * - `mako`: la API de generación que paga MaKo, medida en MaKo Tokens. Martín, 7/11: «no quiero que sólo
 *   dependamos de Flow, **muchos clientes no tienen Flow**… quiero poder ofrecerles otra API».
 *
 * ⚠️ Lo que cambia NO es sólo quién paga: cambia TODO lo que hay que tener antes de apretar. Por `mako` no hace
 * falta extensión, ni conectarla, ni una cuenta de Google, ni dejar Chrome abierto — y listarle esos cuatro
 * pasos a alguien que eligió `mako` es mandarlo a instalar algo que no va a usar. Por eso la rama se decide
 * acá, en el mismo lugar donde se arman los pasos, y no en la pantalla.
 */
export type Motor = 'flow' | 'mako';

/** El motor que se usa si nadie eligió. `flow` para no cambiarle el camino a nadie que ya estaba generando. */
export const MOTOR_POR_DEFECTO: Motor = 'flow';

/** Lo que el servidor sabe del puente del negocio (actions.ts → `puenteParaAvatar`). */
export type PuenteVisto = {
  estado: EstadoPuente;
  /** ¿Latió hace poco? Un puente «listo» que no late es una computadora cerrada o un Chrome sin la pestaña de Flow. */
  vivo: boolean;
  /** ¿La extensión es la que genera por la interfaz de Flow (≥ 0.69)? Una vieja no sabe poner la cara. */
  actualizada: boolean;
};

export type IdPaso = 'extension' | 'conectar' | 'actualizar' | 'flow' | 'foto' | 'saldo';

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

/** Lo que cuesta, por motor. Con `mako` la plata es OTRA y decirle «créditos de Google Flow» sería mentirle. */
export const avisoDeCosto = (motor: Motor = MOTOR_POR_DEFECTO): string =>
  motor === 'mako'
    ? 'El avatar no gasta nada. Cada toma del video gasta MaKo Tokens de tu plan, y te decimos cuántos antes de generar.'
    : CREDITOS;

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
  /** Con qué se genera. Si no se dice, `flow`: el camino que ya existía. */
  motor?: Motor;
  /** Sólo para `mako`: los MaKo Tokens que hay. `null` = no se pudo leer, y eso NO alcanza (falla cerrado). */
  saldoMt?: number | null;
  /** Sólo para `mako`: lo que va a costar esta generación, en MT. */
  cuestaMt?: number;
}): { pasos: PasoRequisito[]; listo: boolean; falta: PasoRequisito | null } {
  const motor = p.motor ?? MOTOR_POR_DEFECTO;

  // ── La rama de MaKo: ni extensión, ni cuenta de Google, ni Chrome abierto ──────────────────────────────
  // ⚠️ Se sale ACÁ, antes de armar un solo paso del puente. Si esto fuera un filtro al final, el día que
  // alguien agregue un paso de Flow arriba se le va a colar a quien eligió MaKo — y la pantalla le va a pedir
  // que instale una extensión que no necesita, que es exactamente el aviso que hace desconfiar de todos los
  // demás (el mismo problema que el comentario de `generarTomaAction` sobre avisos que se contradicen).
  if (motor === 'mako') {
    const pasos: PasoRequisito[] = [];
    if (p.para === 'avatar') {
      pasos.push({
        id: 'foto',
        titulo: 'Pon una foto de tu cara en «Personaje»',
        hecho: p.fotos > 0,
        // ⚠️ El texto dice «foto», no «imagen», a propósito: medido el 7/11, una imagen GENERADA como
        // referencia da una cara que no es la de la persona, y eso no lo arregla ningún prompt.
        ayuda: 'Una foto de verdad, no una imagen hecha con IA: de ahí sale tu cara en el video.',
      });
    }
    const cuesta = p.cuestaMt ?? 0;
    const v = alcanzaElSaldo(p.saldoMt ?? null, cuesta);
    pasos.push({
      id: 'saldo',
      titulo: cuesta > 0 ? `Ten ${cuesta} MaKo Tokens disponibles` : 'Ten MaKo Tokens disponibles',
      hecho: v.alcanza,
      // El motivo sale del medidor para que la pantalla y el server digan LO MISMO: si acá dijera una cosa y
      // el server frenara por otra, la persona ve un paso en verde y un error al apretar.
      ayuda: v.alcanza
        ? 'Los descontamos recién cuando la toma sale bien.'
        : v.motivo,
    });
    const falta = pasos.find((x) => !x.hecho) ?? null;
    return { pasos, listo: !falta, falta };
  }

  const { puente } = p;
  const conectada = puente.estado !== 'sin_conectar';
  // ⚠️ Cada título es una oración entera: se lee solo (la lista desplegada) y después de «Antes de generar:». Antes empezaba
  // en minúscula («instala la extensión…», así en la lista) y en el teléfono decía «Antes de generar: En tu computadora:
  // instala…», con dos «:» seguidos (medido en producción el 10/11/2026).
  const instala = p.enTelefono ? 'En tu computadora, instala' : 'Instala';
  const pasos: PasoRequisito[] = [
    {
      id: 'extension',
      titulo: `${instala} la extensión de MaKo en Google Chrome`,
      // Conectada en otro Chrome también cuenta: el que genera es ESE.
      hecho: conectada || (typeof p.instalada === 'string' && p.instalada.length > 0),
      ayuda: 'Con ella MaKo genera con tu propia cuenta de Google Flow.',
      enlace: { texto: 'Cómo instalarla', href: RUTA_INSTALAR },
    },
    {
      id: 'conectar',
      titulo: 'Conéctala a tu negocio desde el ícono de MaKo → «Conectar»',
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

/**
 * El resumen de una línea, para cuando la lista va PLEGADA.
 *
 * ⚠️ POR QUÉ SE PLIEGA, con el número que lo justifica. Medido en producción el 7/11 a 1024 × 820: el bloque
 * pegado al pie (la tarjeta de «Antes de generar» + la barra de crear) mide **452 px de 820**, o sea el 55 %
 * de la pantalla, y 240 de esos son esta tarjeta. Con 33 presets para mirar, a la persona le quedan ~370 px.
 * Y la tarjeta está desplegada TODO el tiempo que falte un paso, que es justo cuando la persona está
 * explorando — no cuando ya sabe qué quiere.
 *
 * Lo que no se puede perder al plegarla es **cuánto falta y qué sigue**: ésas son las dos cosas por las que
 * alguien la miraría. Van en la línea. El resto se abre con un toque.
 *
 * El plural importa: «Te falta 2 de 4» está mal escrito y lo lee un cliente.
 */
export function resumenDeRequisitos(pasos: readonly PasoRequisito[]): {
  /** La línea de la cabecera plegada. */
  linea: string;
  faltan: number;
  total: number;
  /** El primer paso sin hacer: lo que sigue. `null` si no falta ninguno. */
  siguiente: PasoRequisito | null;
} {
  const total = pasos.length;
  const pendientes = pasos.filter((x) => !x.hecho);
  const faltan = pendientes.length;
  const siguiente = pendientes[0] ?? null;
  if (faltan === 0) return { linea: 'Ya está todo listo', faltan: 0, total, siguiente: null };
  const cuenta = faltan === 1 ? `Te falta ${faltan} de ${total}` : `Te faltan ${faltan} de ${total}`;
  // Cada título es una oración entera, con mayúscula: va después del «·», que separa.
  return { linea: siguiente ? `${cuenta} · ${siguiente.titulo}` : cuenta, faltan, total, siguiente };
}
