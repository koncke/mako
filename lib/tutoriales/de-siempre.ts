// =============================================================================
// Los tutoriales que la app YA tenía, en el formato nuevo (18/11/2026)
// =============================================================================
// Martín (18/11): «Hay algunas que por ejemplo ya tienen tutorial, pero deberíamos rehacerlo con lo que estamos haciendo hoy en
// día para que quede similar». Son los recorridos de las pantallas de ADENTRO de una pestaña (editar la ficha de un lead, una hoja
// del Dashboard, una clase del curso, el lienzo de una automatización), con el motor viejo (app/_ui/Recorrido.tsx, `PasoRecorrido`).
// Los de la ENTRADA de cada pestaña (el de Automations, el de la ficha de Spy, la guía del Ops Center, del CRM y del Calendario) los
// reemplazan los tutoriales nuevos de su pestaña (lib/tutoriales/<pestaña>.ts).
//
// NO SE COPIAN: se leen de sus archivos y se pasan al formato nuevo, así hay UNA fuente mientras el motor viejo siga vivo. Sus
// marcas son las de siempre (`data-recorrido`, puestas a mano en sus componentes) salvo las de Automations, que su recorrido pone
// recién al abrirse (`marcar`): ahí el paso usa el selector con el que las encuentra (`DONDE`, el primero que no depende del texto).
// Les falta el `sub` (lo que dice Martín en el video): sale con sus guiones.
// =============================================================================

import type { PasoRecorrido } from '@/lib/recorridos';
import { PASOS_FICHA_EDICION } from '@/app/crm/lead-view/ficha/recorrido-ficha';
import { PASOS_DASHBOARD, PASOS_DASHBOARD_EDICION } from '@/app/dashboard/recorridos-dashboard';
import { PASOS_RECORRIDO, PASOS_RECORRIDO_LECCION } from '@/app/customer-success/curso/recorridos-curso';
import { DONDE, PASOS_DEL_LIENZO } from '@/app/automations/recorrido-automations';
import { conMarca } from './marcas';
import type { PasoTutorial, TutorialPestana } from './tipos';

/** Un paso del motor viejo en el formato nuevo. `donde`: los selectores con que lo encuentra (sólo Automations). */
export function desdeRecorrido(p: PasoRecorrido, donde?: Readonly<Record<string, readonly { css: string; texto?: string; futuro?: true }[]>>): PasoTutorial {
  const buscar = donde?.[p.objetivo]?.find((b) => !b.texto && !b.futuro);
  return { sel: buscar ? buscar.css : conMarca(p.objetivo), titulo: p.titulo, texto: p.texto, ...(p.lado ? { lado: p.lado } : {}) };
}

export const TUTORIAL_CRM_FICHA: TutorialPestana = {
  pestana: 'crm-ficha', nombre: 'CRM › Ficha del lead', ruta: '/crm/[id]', estado: 'editando la ficha (Editar)',
  intro: 'La ficha de cada lead la armas tú: qué bloques ver y en qué orden.',
  pasos: PASOS_FICHA_EDICION.map((p) => desdeRecorrido(p)),
};

export const TUTORIAL_DASHBOARD_HOJA: TutorialPestana = {
  pestana: 'dashboard-hoja', nombre: 'Dashboard › Una hoja', ruta: '/dashboard', estado: 'mirando una hoja con gráficos',
  intro: 'Cada hoja es una pregunta de tu negocio, respondida con tus números.',
  pasos: PASOS_DASHBOARD.map((p) => desdeRecorrido(p)),
};

export const TUTORIAL_DASHBOARD_EDICION: TutorialPestana = {
  pestana: 'dashboard-edicion', nombre: 'Dashboard › Editar una hoja', ruta: '/dashboard', estado: 'editando una hoja (Editar)',
  intro: 'Editar es armar la hoja a tu gusto: gráficos, filtros y estilo.',
  pasos: PASOS_DASHBOARD_EDICION.map((p) => desdeRecorrido(p)),
};

export const TUTORIAL_CLASSROOM_CURSO: TutorialPestana = {
  pestana: 'classroom-curso', nombre: 'Classroom › Editar el curso', ruta: '/classroom', estado: 'editando el curso (fuera de una clase)',
  intro: 'Tu curso se edita en el mismo lugar donde lo ven tus alumnos.',
  pasos: PASOS_RECORRIDO.map((p) => desdeRecorrido(p)),
};

export const TUTORIAL_CLASSROOM_CLASE: TutorialPestana = {
  pestana: 'classroom-clase', nombre: 'Classroom › Una clase', ruta: '/classroom', estado: 'adentro de una clase, editándola',
  intro: 'Cada clase tiene su video, su texto y la tarea del alumno.',
  pasos: PASOS_RECORRIDO_LECCION.map((p) => desdeRecorrido(p)),
};

// En el lienzo, el recorrido viejo encuentra varias cosas por su TEXTO (`DONDE`). El ＋ tiene `data-mas-puerto` (alcanza sin el texto)
// pero CONDITION, AI Step y «Publicar» sólo se reconocen por el
// texto (el nodo `[data-nodo]` de app/_components/Lienzo.tsx no dice su tipo; a «Publicar» de SecuenciaPerfil no se le puede sumar un
// atributo: tests/lienzo-sexta-tanda.test.ts topea el largo de esa cabecera). Quedan afuera hasta que tengan una marca fija.
const SIN_MARCA_FIJA = ['au-condicion', 'au-ai-step', 'au-publicar'];
const FIJOS: Record<string, string> = { 'au-mas': 'button[data-mas-puerto]' };

export const TUTORIAL_AUTOMATIONS_LIENZO: TutorialPestana = {
  pestana: 'automations-lienzo', nombre: 'Automations › El lienzo', ruta: '/automations', estado: 'con una automatización abierta',
  intro: 'Cada automatización es un camino: lo que la dispara y lo que pasa después.',
  pasos: PASOS_DEL_LIENZO.filter((p) => !SIN_MARCA_FIJA.includes(p.objetivo))
    .map((p) => (FIJOS[p.objetivo] ? { ...desdeRecorrido(p), sel: FIJOS[p.objetivo] } : desdeRecorrido(p, DONDE))),
};

/** Los de adentro, en el orden de las pestañas del reto. */
export const TUTORIALES_DE_ADENTRO: readonly TutorialPestana[] = [
  TUTORIAL_CRM_FICHA,
  TUTORIAL_AUTOMATIONS_LIENZO,
  TUTORIAL_DASHBOARD_HOJA,
  TUTORIAL_DASHBOARD_EDICION,
  TUTORIAL_CLASSROOM_CURSO,
  TUTORIAL_CLASSROOM_CLASE,
];
