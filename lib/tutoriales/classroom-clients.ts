// El tutorial de Classroom › Clients (/classroom/clients: app/customer-success/ClientesApp.tsx, adentro de ClientsShell). Cuadra con
// el guion de su video (C:/dev/tutoriales-video/guiones.json, id `classroom-clients`): la sub-tab de Classroom (`que-es`: el link de
// ClientsShell, que lleva la ruta y, si hay, el `?producto=`) y un paso por cada frase con marca, en su orden, con la marca que fija
// el manifiesto (lib/tutoriales/marcas.ts); el `sub` es la frase.
// · La ficha de un cliente y las vistas quedaron en el guion como texto, sin marca (18/11): «Cargar un cliente» (ChecklistClientes.tsx,
//   la lista «Configura tu cartera») se ve sólo mientras no hay ningún cliente, y sin clientes no hay tarjeta. El único paso marcado
//   es el cierre.
// · El cierre lleva `clic`: «Cargar un cliente» no se apaga. En el teléfono, sin medir: sin `rutaMovil`.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CLASSROOM_CLIENTS: TutorialPestana = {
  pestana: 'classroom-clients',
  nombre: 'Clients',
  ruta: '/classroom/clients',
  intro: 'Vender es la mitad; la otra mitad es entregar bien.',
  pasos: [
    {
      sel: '[data-recorrido="tour-classroom-clients-cargar"]',
      titulo: 'Cargar un cliente',
      texto: 'Tus clientes de antes de MaKo, para seguir su entrega aquí.',
      sub: 'Para sumar a tus clientes de antes, toca aquí, en Cargar un cliente.',
      lado: 'abajo',
      haz: 'Haz clic en Cargar un cliente',
      clic: true,
      // En el kanban (sin la checklist ni la tabla) el lugar es «⋯ › Nuevo cliente» de cada etapa: el motor abre el de la primera
      // (20/11, la verificación de classroom-clients-5). Con la marca a la vista, esto no corre.
      antes: 'button[aria-label^="Opciones de la etapa"]',
    },
  ],
};
