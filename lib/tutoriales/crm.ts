// El tutorial del CRM (/crm; en el teléfono /m/crm): día 3 del reto. Cuadra con el guion de su video (public/tutoriales/manifiesto.json,
// key `crm`): un paso por cosa nombrada, en su orden, y el `sub` es la frase del guion.
// · Las etapas y Ganado: las columnas del tablero (`data-colkey` en la computadora, `data-kb-col` en el teléfono: el selector nombra las dos).
// · «Ver info» va en TODAS las tarjetas y el paso toma la primera. «Mover a…» vive ADENTRO de la ficha rápida: su paso la abre antes
//   (`antes`: Ver info), y el de las reuniones la cierra antes (la ✕ de la ficha en la computadora, la del sheet en el teléfono).
// · Las reuniones aparecen sólo si hay alguna por delante (si no, el motor saltea el paso). En el teléfono la lista está a la vista
//   (app/m/crm/TableroCrm.tsx) y no lleva marca: dos tests fijan el texto de <ReunionesParaPreparar>; se la busca por clase.
// · Buscar y Más acciones son de la barra del tablero de la computadora (app/crm/CrmToolbar.tsx).
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CRM: TutorialPestana = {
  pestana: 'crm',
  nombre: 'CRM',
  ruta: '/crm',
  rutaMovil: '/m/crm',
  intro: 'Cada columna es un paso de tu venta. Tu trabajo es que cada lead llegue a Ganado.',
  pasos: [
    {
      sel: '[data-colkey], [data-kb-col]',
      titulo: 'Tus etapas',
      texto: 'Cada columna es un paso de tu venta, del primer mensaje a la venta.',
      sub: 'Cada columna es un paso de tu venta. Tu trabajo es que cada lead llegue a Ganado.',
      lado: 'derecha',
    },
    {
      sel: '[data-colkey="ganado"], [data-kb-col="ganado"]',
      titulo: 'Lo que hay en juego',
      texto: 'Cada etapa suma lo que podría entrar: todavía no es una venta. Ganado suma lo vendido.',
      sub: 'Arriba de cada etapa ves cuánto podría entrar. En Ganado, lo que ya vendiste.',
      lado: 'izquierda',
    },
    {
      sel: conMarca(MARCA.crmVerInfo),
      titulo: 'Ver info',
      texto: 'La ficha rápida del lead, sin salir del tablero.',
      sub: 'Para cambiar a alguien de etapa sin arrastrar, toca Ver info',
      lado: 'derecha',
    },
    {
      sel: conMarca(MARCA.crmMoverA),
      antes: conMarca(MARCA.crmVerInfo),
      titulo: 'Mover a…',
      texto: 'Eliges la etapa y el lead pasa ahí.',
      sub: 'y Mover a.',
      lado: 'abajo',
    },
    {
      sel: `${conMarca(MARCA.crmReuniones)}, .m-crm-arriba .crm-reus`,
      antes: 'button.tk-x, .m-sheet__cerrar',
      titulo: 'Tus reuniones',
      texto: 'Tócalo y ves las que vienen, en orden.',
      sub: 'Las reuniones de los próximos días esperan en este número.',
      lado: 'abajo',
    },
    {
      sel: conMarca('crm-buscar'),
      titulo: 'Buscar',
      texto: 'Por nombre, email o teléfono. Para uno puntual, #412.',
      sub: '¿Buscas a alguien? Escribe su nombre, o su número con numeral adelante.',
      lado: 'abajo',
      soloComputadora: true,
    },
    {
      sel: conMarca('crm-mas'),
      titulo: 'Importa tu lista',
      texto: 'Aquí eliges «Importar leads». También editas las etapas.',
      sub: 'Y si ya tienes una lista, impórtala entera desde Más acciones.',
      lado: 'abajo',
      haz: 'Haz clic en Más acciones',
      clic: true,
      soloComputadora: true,
    },
  ],
};
