// El tutorial del CRM (/crm; en el teléfono /m/crm): día 3 del reto. Guion: docs/reto-7-dias/tutoriales-por-pestana.md §3.
// Ganado: la columna del tablero (`data-colkey` en la computadora, `data-kb-col` en el teléfono: el selector nombra las dos).
// «Ver info» va en TODAS las tarjetas y el paso toma la primera. Las reuniones aparecen sólo si hay alguna por delante; si no, el
// motor saltea el paso. Buscar y Más acciones son de la barra del tablero de la computadora (app/crm/CrmToolbar.tsx).
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
      sel: '[data-colkey="ganado"], [data-kb-col="ganado"]',
      titulo: 'Lo que hay en juego',
      texto: 'Cada etapa suma lo que podría entrar: todavía no es una venta. Ganado suma lo vendido.',
      sub: 'Arriba de cada etapa ves cuánto podría entrar. En Ganado, lo que ya vendiste.',
      lado: 'izquierda',
    },
    {
      sel: conMarca(MARCA.crmVerInfo),
      titulo: 'Ver info',
      texto: 'La ficha rápida del lead. Con «Mover a…» lo pasas de etapa.',
      sub: 'Para cambiar a alguien de etapa sin arrastrar, toca Ver info y Mover a.',
      lado: 'derecha',
    },
    {
      // En el teléfono la lista está a la vista (app/m/crm/TableroCrm.tsx); la marca no le entra: dos tests fijan su texto.
      sel: `${conMarca(MARCA.crmReuniones)}, .m-crm-arriba .crm-reus`,
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
