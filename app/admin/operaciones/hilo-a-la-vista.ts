// =============================================================================
// LO QUE DIBUJA EL HILO DE UN CHAT DEL CENTRO, Y QUÉ TURNOS ESPERAN (20/11/2026, la auditoría de los chats: admin-1 a 5)
// =============================================================================
// El hilo de Operaciones (Conversacion.tsx en la computadora, app/m/operaciones/ChatsMovil.tsx en el teléfono) bajaba con
// `lineas.length`, y `lineas` es el historial ENTERO: pedidos, derivados y turnos que no son para Martín, que el hilo no dibuja
// (`lineasDeConversacion`). Un pedido nuevo de la bitácora lo bajaba de golpe sin nada nuevo a la vista (admin-1), y una decisión o
// el cierre de un trabajo no cambiaban la cuenta (admin-2, admin-3). Desde acá, la CLAVE de la última línea DIBUJADA (con su cierre)
// es lo que le dice al panel que hay algo nuevo (app/_chat/useBajarAlUltimo.ts); lo que crece lo sigue el panel.
// Y los turnos que un chat escribe entre dos sondeos llegaban juntos (admin-5): salen de a uno, con sus puntitos, por la cola de
// salida compartida (app/_chat/useColaDeSalida.ts, en ./useTurnosDeAUno.ts). Lo que ya estaba al abrir, de una vez.
// Puro: lo prueba tests/chats-bajan-movil-admin.test.ts.
// =============================================================================
import { lineasDeConversacion, type LineaChat } from '@/lib/centro-chats';
import { idDeLinea } from '@/lib/centro-mensajes';
import type { FilaDeCola } from '@/app/_chat/useColaDeSalida';

/** El id de una línea del hilo. Una pregunta no tiene id de mensaje: su tipo y su instante. */
export const idDeFila = (l: LineaChat): string => idDeLinea(l) ?? `${l.tipo}:${l.instante}`;

/**
 * La clave de la ÚLTIMA línea que el hilo dibuja: su id y, si es un trabajo, si ya trae su cierre (el cierre llega a la misma línea,
 * admin-3). `extra`: lo que se dibuja después de la última línea (los puntitos, el bloque de lo que espera a Martín en el teléfono).
 */
export function claveDelHilo(lineas: readonly LineaChat[], extra: readonly (string | number | boolean | null | undefined)[] = []): string {
  const dibujadas = lineasDeConversacion(lineas);
  const u = dibujadas[dibujadas.length - 1];
  const base = u ? `${idDeFila(u)}${u.tipo === 'trabajo' && u.trabajo.cierre ? ':cierre' : ''}` : '';
  return [base, ...extra.map((x) => String(x ?? ''))].join('|');
}

/** Las filas de la cola: lo que el hilo dibuja, en orden. Lo que escribe el chat (sus turnos) es «mako» y sale de a uno; lo de Martín, ya. */
export function filasDeLaCola(lineas: readonly LineaChat[]): FilaDeCola[] {
  return lineasDeConversacion(lineas).map((l) => ({
    id: idDeFila(l),
    de: l.tipo === 'turno' && l.turno.rol !== 'yo' ? 'mako' : 'yo',
    texto: l.tipo === 'turno' ? l.turno.texto : '',
  }));
}

/**
 * Lo que se le pasa al hilo: todo, menos lo que todavía espera en la cola (lo dibujable que no es de la `historia` ni `salio`). Sin
 * nada esperando, las MISMAS líneas: el hilo está memorizado y un arreglo nuevo lo redibujaría con cada tecla.
 */
export function lineasALaVista(lineas: readonly LineaChat[], historia: ReadonlySet<string>, salieron: ReadonlySet<string>): readonly LineaChat[] {
  const dibujadas = new Set(lineasDeConversacion(lineas).map(idDeFila));
  const out = lineas.filter((l) => { const id = idDeFila(l); return !dibujadas.has(id) || historia.has(id) || salieron.has(id); });
  return out.length === lineas.length ? lineas : out;
}
