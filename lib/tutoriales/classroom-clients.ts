// El tutorial de Classroom › Clients (/classroom/clients: app/customer-success/ClientesApp.tsx, adentro de ClientsShell). Cuadra con
// el guion de su video (C:/dev/tutoriales-video/guiones.json, id `classroom-clients`): la sub-tab de Classroom (`que-es`: el link de
// ClientsShell, que lleva la ruta y, si hay, el `?producto=`) y un paso por cada frase con marca, en su orden, con la marca que fija
// el manifiesto (lib/tutoriales/marcas.ts); el `sub` es la frase.
// · «Un cliente» es la PRIMERA tarjeta del tablero (KanbanEntrega.tsx, la de arriba de la primera columna con alguien); el selector
//   de vistas es el de la barra (SelectorVista, con su marca); «Cargar un cliente» es el de la lista «Configura tu cartera»
//   (ChecklistClientes.tsx).
// · NUNCA ESTÁN LOS DOS A LA VEZ: «Cargar un cliente» se ve sólo mientras no hay ningún cliente (`cs_clientes`), y sin clientes no hay
//   tarjeta. Un negocio nuevo ve el selector y «Cargar un cliente» (el motor saltea la tarjeta); con clientes, la tarjeta y el
//   selector (saltea el cierre). Medido en los dos estados dibujados.
// · El cierre lleva `clic`: «Cargar un cliente» no se apaga. En el teléfono, sin medir: sin `rutaMovil`.
import { MARCA, conMarca } from './marcas';
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CLASSROOM_CLIENTS: TutorialPestana = {
  pestana: 'classroom-clients',
  nombre: 'Clients',
  ruta: '/classroom/clients',
  intro: 'Vender es la mitad; la otra mitad es entregar bien.',
  pasos: [
    {
      sel: '.cls-tab[href^="/classroom/clients"]',
      titulo: 'Clients',
      texto: 'Cada lead que ganaste en el CRM, en la etapa de tu servicio en que va.',
      sub: 'Clients, en Classroom, te muestra en qué etapa de tu servicio va cada lead que ganaste en el CRM.',
      lado: 'abajo',
    },
    {
      sel: conMarca(MARCA.classroomClientsCliente),
      titulo: 'Su ficha',
      texto: 'Sus tareas, sus pagos, su curso y sus llamadas, en un solo lugar.',
      sub: 'Toca aquí, en un cliente, y abre su ficha: sus tareas, sus pagos, su curso y sus llamadas.',
      lado: 'derecha',
    },
    {
      sel: conMarca(MARCA.classroomClientsVistas),
      titulo: 'Cómo los ves',
      texto: 'Kanban, Lista, Miembros o Avance del curso.',
      sub: 'Toca aquí, en Lista, Miembros o Avance, para cambiar la vista del Kanban.',
      lado: 'abajo',
    },
    {
      sel: conMarca(MARCA.classroomClientsCargar),
      titulo: 'Cargar un cliente',
      texto: 'Tus clientes de antes de MaKo, para seguir su entrega aquí.',
      sub: 'Para sumar a tus clientes de antes, toca aquí, en Cargar un cliente.',
      lado: 'abajo',
      haz: 'Haz clic en Cargar un cliente',
      clic: true,
    },
  ],
};
