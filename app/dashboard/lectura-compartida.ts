// =============================================================================
// lectura-compartida — el CONTRATO de lo que el Dashboard LEE: a qué ruta va cada pedido y con qué cuerpo
// =============================================================================
// Martín, 11/10/2026, punto 9: «Agrega el botón de "Compartir"… que se pueda crear un link de acceso a
// esos graficos». Quien abre ese link no tiene sesión: todo lo que la pantalla LEE (los datos de un
// gráfico, los de un bloque, los valores de una lista) va a `/api/compartido/graficos` en vez de a
// `/api/graficos`, con el token del link, el id de la HOJA y el id de lo que se pide.
//
// Es un módulo PURO (sin React, sin 'use client') a propósito, por dos lectores:
//   · la pantalla (./EditorInforme.tsx los datos y los bloques; ./BarraControles.tsx los valores de una
//     lista), que arma sus pedidos SÓLO con `pedidoDeLectura`;
//   · el endpoint del link (app/api/compartido/graficos, del paquete «Compartir»), que puede importar
//     estos TIPOS en vez de copiarlos: el que encola y el que ejecuta comparten un contrato (AGENTS.md).
//
// ⚠️ EL SERVER DEL LINK NO CREE NADA DE LO QUE DESCRIBE AL COMPONENTE. Reconstruye cada consulta desde el
//    componente GUARDADO (hojaId + id del componente, o + id del control) y del cliente acepta sólo el
//    estado de la VISTA: `desde`, `hasta`, `filtros`, `agrupar`. Lo demás (`grafico`, `bloque`, `campo`,
//    `fuentes`) viaja porque el cuerpo es el MISMO que el de /api/graficos, no para que se use.
// ⚠️ EL DETALLE DE UN NÚMERO NO ESTÁ ACÁ: en un informe compartido no se ofrece (son listas de personas
//    con nombre y teléfono; el endpoint público lo contesta 403). Guardar tampoco: no es una lectura.
// ⚠️ SIN COMPARTIR, EL CUERPO ES EXACTAMENTE EL DE SIEMPRE: `puedePedir` (lib/graficos-plantillas.ts)
//    mira el cuerpo entero, y un campo de más podría cambiarle la respuesta al closer.

import type { PedidoBloqueHoja, PedidoGrafico } from './exportar';

/** La ruta de lectura de quien tiene sesión (el admin, el closer). */
export const RUTA_LECTURA = '/api/graficos';
/** La de quien abre un link compartido: sin sesión, con el token del link. */
export const RUTA_LECTURA_COMPARTIDA = '/api/compartido/graficos';

/** Lo que la pantalla sabe del link por el que se entró. */
export type Compartido = { token: string };

/** Los datos de los gráficos de una hoja: uno por componente, con su id. */
export type LecturaDatos = { accion: 'datos'; hojaId: string; pedidos: ReadonlyArray<{ id: string; pedido: PedidoGrafico }> };
/** Los datos de los bloques de MaKo de una hoja. */
export type LecturaBloques = { accion: 'bloques'; hojaId: string; pedidos: ReadonlyArray<{ id: string; pedido: PedidoBloqueHoja }> };
/**
 * Los valores de una lista (las casillas de un control). El control vive en la hoja (`controlId`) o en
 * la cabecera de un gráfico (`componenteId` + `controlId`).
 */
export type LecturaValores = {
  accion: 'valores'; hojaId: string; controlId: string; componenteId?: string;
  campo: string; desde: string; hasta: string; fuentes?: readonly string[];
};
export type Lectura = LecturaDatos | LecturaBloques | LecturaValores;

/**
 * A dónde va una lectura y con qué cuerpo. Sin `compartido`, el cuerpo de siempre de /api/graficos; con
 * él, el mismo más `token`, `hojaId` y el id de cada cosa que se pide.
 */
export function pedidoDeLectura(l: Lectura, compartido?: Compartido | null): { ruta: string; cuerpo: Record<string, unknown> } {
  const fuentes = l.accion === 'valores' && l.fuentes && l.fuentes.length ? { fuentes: [...l.fuentes] } : {};
  if (!compartido) {
    if (l.accion === 'valores') return { ruta: RUTA_LECTURA, cuerpo: { accion: 'valores', campo: l.campo, desde: l.desde, hasta: l.hasta, ...fuentes } };
    return { ruta: RUTA_LECTURA, cuerpo: { accion: l.accion, pedidos: l.pedidos.map((p) => p.pedido) } };
  }
  const base = { token: compartido.token, hojaId: l.hojaId };
  if (l.accion === 'valores') {
    return {
      ruta: RUTA_LECTURA_COMPARTIDA,
      cuerpo: {
        accion: 'valores', ...base, controlId: l.controlId, ...(l.componenteId ? { componenteId: l.componenteId } : {}),
        campo: l.campo, desde: l.desde, hasta: l.hasta, ...fuentes,
      },
    };
  }
  // El id del componente va en CADA pedido (el de un bloque ya lo traía: es el mismo).
  return { ruta: RUTA_LECTURA_COMPARTIDA, cuerpo: { accion: l.accion, ...base, pedidos: l.pedidos.map((p) => ({ ...p.pedido, id: p.id })) } };
}
