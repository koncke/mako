// El tutorial del CRM (/crm; en el teléfono /m/crm): día 3 del reto. Cuadra con el guion de su video (public/tutoriales/manifiesto.json,
// key `crm`): un paso por cosa nombrada, en su orden, y el `sub` es la frase del guion.
// · Las etapas y Ganado: las columnas del tablero (`data-colkey` en la computadora, `data-kb-col` en el teléfono: el selector nombra las dos).
// · «Ver info» va en TODAS las tarjetas y el paso toma la primera. «Mover a…» vive ADENTRO de la ficha rápida: su paso la abre antes
//   (`antes`: Ver info), y el de las reuniones la cierra antes (la ✕ de la ficha en la computadora, la del sheet en el teléfono).
// · Las reuniones aparecen sólo si hay alguna por delante (si no, el motor saltea el paso). En el teléfono la lista está a la vista
//   (app/m/crm/TableroCrm.tsx) y no lleva marca: dos tests fijan el texto de <ReunionesParaPreparar>; se la busca por clase.
// · Buscar y Más acciones son de la barra del tablero de la computadora (app/crm/CrmToolbar.tsx).
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CRM: TutorialPestana = {
  pestana: 'crm',
  nombre: 'CRM',
  ruta: '/crm',
  rutaMovil: '/m/crm',
  intro: '¿Cuánto dinero podría entrarte con los leads que ya tienes?',
  pasos: [
    {
      sel: '[data-recorrido="tour-crm-ver-info"]',
      titulo: 'Ver info',
      texto: 'La ficha rápida del lead, sin salir del tablero.',
      sub: 'Toca aquí, en Ver info, para abrir la ficha rápida del lead.',
      lado: 'derecha',
    },
    {
      sel: '[data-recorrido="tour-crm-mover-a"]',
      titulo: 'Mover a…',
      texto: 'Eliges la etapa y el lead pasa ahí.',
      sub: 'Toca aquí, en Mover a, y elige su etapa nueva sin arrastrar nada.',
      lado: 'abajo',
      antes: '[data-recorrido="tour-crm-ver-info"]',
    },
    {
      sel: '[data-recorrido="tour-crm-reuniones"]',
      titulo: 'Tus reuniones',
      texto: 'Tócalo y ves las que vienen, en orden.',
      sub: 'Toca aquí, en el botón del calendario, junto a Filtrar, para ver tus próximas reuniones.',
      lado: 'abajo',
      antes: 'button.tk-x, .m-sheet__cerrar',
    },
    {
      sel: '[data-recorrido="crm-mas"]',
      titulo: 'Importa tu lista',
      texto: 'Aquí eliges «Importar leads». También editas las etapas.',
      sub: 'Carga tu lista entera: toca aquí, en Más acciones.',
      lado: 'abajo',
      haz: 'Haz clic en Más acciones',
      clic: true,
      soloComputadora: true,
    },
  ],
};
