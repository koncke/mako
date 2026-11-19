// Las server actions del personaje en cubos, FALSAS, para manejar la pantalla de verdad (app/ai-avatar/cubos/EstudioCubos.tsx)
// en Chromium sin `next dev` (scripts/avatar-cubos/vista.mjs). Contestan como las de verdad (./actions.ts) pero sin servidor:
// «Crear video» devuelve un proyecto con la voz y los tiempos del ejemplo de la galería, así el MP4 que arma la pantalla se
// puede comparar cuadro por cuadro con el de la galería.
import { FORMATOS_CUBOS, formatoCubos, normalizarGuion } from '../../lib/ai-avatar/cubos-formatos';
import { normalizarPersonaje } from '../../lib/ai-avatar/cubos-personaje';
import type { Tiempos } from '../../lib/ai-avatar/cubos-tiempos';

type W = Window & { __TIEMPOS_EJEMPLO?: Record<string, Tiempos> };
const tiemposDe = (id: string): Tiempos => (window as W).__TIEMPOS_EJEMPLO![id];

export async function inicioCubosAction() {
  return { ok: true as const, proyectos: [], voces: [{ id: 'mako-david', nombre: 'David' }, { id: 'mako-fernando', nombre: 'Fernando' }], clon: null, marca: 'MaKo', fotos: [] as { id: string; url: string }[], costos: { guion: 2, foto: 2 } };
}
export async function guionCubosAction(i: { formato: string }) {
  const f = formatoCubos(i.formato) ?? FORMATOS_CUBOS[0];
  return { ok: true as const, frases: f.ejemplo.escenas.map((e) => e.texto), datos: f.ejemplo.datos };
}
export async function personajeDesdeFotoAction() {
  return { ok: true as const, personaje: normalizarPersonaje({ piel: 'media', pelo: 'negro', peinado: 'corto', ropa: 'azul', ojos: 'oscuros', anteojos: true, barba: true }) };
}
export async function crearVideoCubosAction(i: { formato: string; frases: string[]; personaje: unknown }) {
  const f = formatoCubos(i.formato)!;
  const g = normalizarGuion(i.frases);
  if (!g.ok) return g;
  const proyecto = {
    id: 'p' + Date.now(), creado: Date.now(), formato: f.id, escenas: g.escenas, datos: f.ejemplo.datos, personaje: normalizarPersonaje(i.personaje),
    voz: { tipo: 'mako' as const, nombre: 'David' }, audio: 'falso.mp3', tiempos: tiemposDe(f.id), url: `/__vista/voz-${f.id}.mp3`,
  };
  return { ok: true as const, proyecto, mt: 10 };
}
export async function cambiarCubosAction(i: { id: string }) {
  return { ok: false as const, error: `cambiar ${i.id}: no hace falta en la prueba` };
}
export async function borrarCubosAction() { return { ok: true as const }; }
