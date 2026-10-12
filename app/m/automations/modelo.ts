// =============================================================================
// /m/automations — lo que se LEE de una automatización: sus tarjetas en orden y su disparador
// =============================================================================
// Puro (sólo módulos puros de lib/) y sin React: lo usa ./datos.ts en el server y lo ejecuta el
// test (tests/m-automations.test.ts). La pantalla de cliente NO lo importa: recibe lo ya leído.
//
// ⚠️ LAS TARJETAS SE LEEN DESDE EL GRAFO, NUNCA POR EL ORDEN DEL ARRAY. El lienzo inserta tarjetas en el
//    medio (el array no es el orden) y una condición abre ramas: `pasos[0]`/`slice` contaba una tarjeta
//    suelta o la rama de abajo antes que la de arriba. Se recorre desde donde arranca la SALIDA
//    (`raicesSalida`, el CRON y sus flechas en paralelo) siguiendo cada puerto en el orden en que el
//    lienzo los dibuja (`puertosDe`), y después lo que cuelga de «Si responde» / AI Step
//    (`raicesRespuesta`). Una tarjeta suelta no se lista: no corre.
// ⚠️ LOS NOMBRES SON LOS DEL LIENZO: `tituloDeTarjeta` («WHATSAPP», «DELAY», «CONDITION», pedido de
//    Martín: los títulos de las tarjetas en inglés) y lo que dice, de `nombreDeTarjeta` (la misma frase
//    con la que los errores de Publicar nombran una tarjeta). El AI Step, por su objetivo (`resumenPasoIA`).
// =============================================================================

import {
  esPasoIA, indicePorId, puertosDe, raicesRespuesta, raicesSalida,
  claseDe, type NombresParaTexto, type PasoGrafo,
} from '@/lib/flujo-grafo';
import {
  TITULO, borradorAlAbrir, frenoDelFlujo, nombreDeTarjeta, nombreEtiqueta, resumenPasoIA, tituloDeTarjeta,
} from '@/lib/flujo-conversacion';
import { textoDelDisparador, vistasPorDisparador, TEXTO_SIN_ELEGIR, type NombresDisparo, type SecuenciaConDisparo } from '@/lib/disparadores';
import { abrirFlujo, type EstrategiaLegada } from '@/lib/flujo-legado';
import type { PasoM } from './reglas';

// ── Las tarjetas, en orden de lectura ─────────────────────────────────────────────────────────

/**
 * Los ids de las tarjetas que CORREN, en el orden en que se leen: la salida primero (en profundidad,
 * cada rama entera antes de la siguiente, como se apilan en el lienzo) y después lo de «Si responde».
 * Cada tarjeta una vez (un ciclo que vuelve al principio no la repite). Sin el CRON (`inicio`): lo que
 * lo dispara ya está en la fila.
 */
export function idsEnLectura(pasos: readonly PasoGrafo[]): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  const recorrer = (raiz: string) => {
    const pila = [raiz];
    while (pila.length) {
      const id = pila.pop() as string;
      if (vistos.has(id)) continue;
      const i = indicePorId(pasos, id);
      if (i < 0) continue;
      vistos.add(id);
      if (claseDe(pasos[i]) !== 'inicio') out.push(id);
      const hijos = puertosDe(pasos, i).map((pt) => pt.destino).filter((d): d is string => !!d);
      // Al revés en la pila: sale primero el puerto de ARRIBA.
      for (let k = hijos.length - 1; k >= 0; k--) pila.push(hijos[k]);
    }
  };
  for (const r of raicesSalida(pasos)) recorrer(r);
  for (const r of raicesRespuesta(pasos)) recorrer(r);
  return out;
}

/** El ícono de cada título del lienzo, del set de la casa (app/_components/icons.tsx). */
const ICONO_DE_TITULO: Readonly<Record<string, string>> = {
  [TITULO.whatsapp]: 'whatsapp',
  [TITULO.email]: 'email',
  [TITULO.instagram]: 'instagram',
  // Messenger no tiene ícono propio en el set: el globo de chats.
  [TITULO.messenger]: 'chats',
  // Una espera es un reloj (se sumó a icons.tsx el 11/10/2026; antes iba la pausa).
  [TITULO.esperar]: 'reloj',
  [TITULO.condicion]: 'funnel',
  [TITULO.paso_ia]: 'ia',
  [TITULO.etiqueta]: 'tag',
  [TITULO.accion]: 'config',
  [TITULO.mako]: 'mako',
  [TITULO.ir_a]: 'regenerar',
  [TITULO.cron]: 'rayo',
};

/** Las tarjetas en LECTURA: título del lienzo, lo que dicen y su ícono. */
export function pasosEnLectura(pasos: readonly PasoGrafo[], nombres?: NombresParaTexto): PasoM[] {
  return idsEnLectura(pasos).map((id) => {
    const p = pasos[indicePorId(pasos, id)];
    const titulo = tituloDeTarjeta(p);
    let linea: string | null = null;
    if (esPasoIA(p)) {
      // Undécima tanda: UN AI Step por objetivo. La línea es lo que dibuja la tarjeta de escritorio en su primer
      // renglón: «→ objetivo», o «Falta el objetivo» si no lo tiene (`resumenPasoIA`, la misma lectura).
      const r = resumenPasoIA(p);
      linea = r.objetivo ? `→ ${r.objetivo}` : 'Falta el objetivo';
    } else {
      // `nombreDeTarjeta` = «TÍTULO: lo que dice» (o el título solo, si no dice nada).
      const nombre = nombreDeTarjeta(pasos, id, nombres);
      if (nombre.startsWith(`${titulo}: `)) linea = nombre.slice(titulo.length + 2);
    }
    return { id, titulo, linea, icono: ICONO_DE_TITULO[titulo] ?? 'chatbot' };
  });
}

// ── Lo que abre el lienzo de escritorio ───────────────────────────────────────────────────────

type PasoConOrden = PasoGrafo & { orden?: number | null };

/**
 * LO PUBLICADO como lo abre el lienzo (app/automations/SecuenciaPerfil.tsx, `inicial`): ordenado por
 * `orden` y por `abrirFlujo` (una lista de antes convertida, sin «Ir a», un AI Step de antes partido en
 * una tarjeta por caso). `limpiarEstrategia` = publicar ESO, en escritorio, además limpia la estrategia.
 */
export function publicadoAlAbrir<P extends PasoConOrden>(
  pasos: readonly P[], est: EstrategiaLegada,
  op: { idDeClave: (clave: string) => number | null; nombreDeSecuencia: (id: number) => string | null },
): { pasos: P[]; limpiarEstrategia: boolean } {
  const ordenados = [...pasos].sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
  const r = abrirFlujo(ordenados, est, op);
  return { pasos: r.pasos, limpiarEstrategia: r.limpiarEstrategia };
}

/** EL BORRADOR como lo abre el lienzo: `borradorAlAbrir` de lib/flujo-conversacion.ts, la MISMA que llama
 *  SecuenciaPerfil.tsx (hasta el 11/10/2026 era una copia de su cadena). Se re-exporta para el test. */
export { borradorAlAbrir };

/** Lo que frena Publicar, con la MISMA función del lienzo. null = se puede publicar. */
export function frenoDePublicar(pasos: readonly PasoGrafo[]): string | null {
  return frenoDelFlujo(pasos)?.error ?? null;
}

// ── El disparador, en una línea ───────────────────────────────────────────────────────────────

/**
 * LO QUE DICE UN CRON y lo que hace falta para decirlo: viven en lib/disparadores.ts
 * (`textoDelDisparador`, `NombresDisparo`), la MISMA función que llama el lienzo de escritorio
 * (`useTextoDisparador`). Hasta el 11/10/2026 esto era una copia línea por línea del hook; se
 * re-exporta para que el server de esta pantalla y el test sigan importando de acá.
 */
export { textoDelDisparador, type NombresDisparo };

/**
 * La línea de la fila: lo que dice el PRIMER CRON (el de la tarjeta del lienzo) y «· +N» si tiene más.
 * Los CRON salen de `vistasPorDisparador`, la misma lista que el motor recorre al inscribir.
 */
export function lineaDelDisparador(sec: SecuenciaConDisparo, n: NombresDisparo): string {
  const vistas = vistasPorDisparador(sec);
  if (!vistas.length) return TEXTO_SIN_ELEGIR;
  const primero = textoDelDisparador(vistas[0].disparador, n);
  return vistas.length > 1 ? `${primero} · +${vistas.length - 1}` : primero;
}

/**
 * La tarjeta CRON en lectura: la primera del lienzo, con UNA fila por disparador (como la dibuja
 * FlujoLienzo). Va arriba de las tarjetas de la salida; el «· +N» de la fila se abre acá.
 */
export function cronEnLectura(sec: SecuenciaConDisparo, n: NombresDisparo): PasoM[] {
  return vistasPorDisparador(sec).map((v) => ({
    id: `cron:${v.disparador.id}`, titulo: TITULO.cron, linea: textoDelDisparador(v.disparador, n), icono: ICONO_DE_TITULO[TITULO.cron],
  }));
}

/** Los nombres que una CONDITION y una TAG necesitan para decir lo que dicen (como el lienzo). */
export function nombresParaTarjetas(n: NombresDisparo): NombresParaTexto {
  const todas = n.productos.flatMap((pr) => [...pr.etapas, ...pr.etapasEntrega]);
  return {
    etiqueta: (id) => nombreEtiqueta(n.etiquetas, id),
    etapa: (key, funnelId) => {
      const delKanban = funnelId != null ? n.productos.find((pr) => pr.funnelId === funnelId)?.etapas : null;
      return (delKanban ?? todas).find((e) => e.value === key)?.label ?? n.etiquetaEtapa(key);
    },
  };
}
