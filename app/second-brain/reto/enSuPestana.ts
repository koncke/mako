'use client';
// =============================================================================
// EL VIDEO DE UNA PESTAÑA, EN LA PESTAÑA DE VERDAD (20/11/2026, verificación de la auditoría: D1-02, V1 y V3)
// =============================================================================
// Lo acordado (memoria, 17/11: «Muéstrame {pestaña}» lleva a la pestaña real con su tutorial; la maqueta, guionMuestra y tab-tour):
// la pantalla marca la pestaña en la barra; al tocarla, se abre la pestaña y corre SU video con sus marcas (el motor sigue al
// navegar); al terminar, «Vuelve cuando quieras» marca el Ops Center y la fila del reto. Antes el video corría en la esquina del
// chat del reto, y sus marcas (las de la pestaña) no estaban en esa pantalla: el motor las salteaba todas.
//   · Sólo con la pestaña a la vista en la barra (y una ruta fija, no «/crm/[id]»): si no, la marca esperaría para siempre. En ese
//     caso devuelve false y quien llama reproduce el video ahí mismo.
//   · Nunca encima de otra marca (el motor ocupado).
// =============================================================================
import { mostrarTutorial, senalAhora, senalarDondeTocar } from '@/app/_ui/tutorial/store';
import { enEnsayo, marcarVistoEnEnsayo } from '@/app/_ui/tutorial/desde-cero';
import { anotarVisto } from '@/app/_ui/Recorrido';
import type { TutorialPestana } from '@/lib/tutoriales';

/** La fila de la pestaña en la barra (app/_components/Sidebar.tsx: cada fila es un link a su ruta). */
export const selDeLaBarra = (ruta: string): string => `aside[data-sidebar] a[href^="${ruta.split('?')[0]}"]`;

/**
 * DÓNDE SE TOCA PARA ABRIR LA PESTAÑA. Una ruta con consulta no es una fila de la barra (segunda verificación de V1): la Ticketera vive
 * en `/second-brain?ticketera=tickets`, y cortar la consulta marcaba la fila del OPS CENTER; al tocarla, el tutorial de la Ticketera
 * corría sobre el Ops Center y la Ticketera no se abría nunca. Se abre con su botón del Ops Center (`sb-ticketera`). Otra ruta con
 * consulta sin su botón: null (quien llama pasa el video ahí mismo).
 */
const BOTON_DE_LA_CONSULTA: Readonly<Record<string, string>> = { ticketera: '[data-recorrido="sb-ticketera"]' };
export function dondeSeAbre(t: TutorialPestana): string | null {
  if (!t.ruta.includes('?')) return selDeLaBarra(t.ruta);
  return BOTON_DE_LA_CONSULTA[t.pestana] ?? null;
}

/**
 * El tutorial de esa pestaña queda VISTO (segunda verificación de OD-06): su video ya lo pasó «Muéstrame…» (o el catálogo). Si no,
 * al omitirlo o al dejar «Vuelve cuando quieras», el motor quedaba libre y el tutorial de la pestaña volvía a correr solo, el mismo video;
 * y otra vez la próxima vez que se entraba. En el ensayo «desde cero», en el navegador.
 */
export function anotarTutorialVisto(t: TutorialPestana): void {
  const id = `tutorial-${t.pestana}`;
  if (enEnsayo()) marcarVistoEnEnsayo(id); else anotarVisto(id);
}

function seVe(sel: string): boolean {
  const el = document.querySelector(sel);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/** «Vuelve cuando quieras» (la maqueta, guionMuestra: «Tu reto de 7 días te espera en el Ops Center»): el Ops Center y la fila del reto. */
export const VOLVER_AL_RETO = [
  { sel: selDeLaBarra('/second-brain'), titulo: 'Vuelve cuando quieras', texto: 'Tu reto de 7 días te espera en el Ops Center.', haz: 'Haz clic en Ops Center', lado: 'derecha' as const },
  { sel: '[data-recorrido="sb-reto-chat"]', titulo: 'Tu reto de 7 días', texto: 'Sigue donde lo dejaste.', haz: 'Haz clic en Reto de 7 días', lado: 'derecha' as const },
];

function volverAlReto(i = 0): void {
  const m = VOLVER_AL_RETO[i];
  if (!m || senalAhora()) return;
  // Con «Lo hago después»: volver es una invitación, no una obligación.
  senalarDondeTocar(m, () => { if (i + 1 < VOLVER_AL_RETO.length) window.setTimeout(() => volverAlReto(i + 1), 350); }, { alOmitir: () => {} });
}

/**
 * Marca la pestaña en la barra y, al tocarla, corre su video con sus marcas en la pestaña. `texto`: lo que dice la marca de la barra
 * («Aquí ordenas tus ventas en el CRM.»). `alTerminar`: al terminar o cerrar el video (antes de «Vuelve cuando quieras»).
 * Devuelve false si no se puede (la pestaña no está en la barra, o el motor está ocupado): quien llama decide qué hacer.
 */
export function mostrarEnSuPestana(t: TutorialPestana, o: { texto: string; alTerminar?: () => void; volver?: boolean }): boolean {
  if (typeof document === 'undefined' || senalAhora() || t.ruta.includes('[')) return false;
  const sel = dondeSeAbre(t);
  if (!sel || !seVe(sel)) return false;
  senalarDondeTocar({ sel, titulo: t.nombre, texto: o.texto, haz: `Haz clic en ${t.nombre}`, lado: 'derecha' }, () => {
    anotarTutorialVisto(t);
    mostrarTutorial(t, { video: t.pestana, directo: true, alTerminar: () => {
      o.alTerminar?.();
      // En el acto (el motor ya soltó el video: `terminar` limpia y recién después avisa): si no, el tutorial de la pestaña, que la
      // primera vez se abre solo (MotorTutorial → PrimeraVez), encontraba el motor libre y volvía a correr encima.
      if (o.volver !== false) volverAlReto();
    } });
  });
  return true;
}
