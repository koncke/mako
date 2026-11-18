// El tutorial de Agency Dashboard (/agency) para quien todavía no es agencia: la landing (app/agency/LandingAgency.tsx). Cuadra con el
// guion de su video (C:/dev/tutoriales-video/guiones.json, id `agency`): el paso de `que-es` y un paso por cada frase con marca, en su
// orden, con la marca que fija el manifiesto (lib/tutoriales/marcas.ts); el `sub` es la frase.
// · El menú de la foto (donde vive «Agency Dashboard») está cerrado al entrar: el primer paso marca el título de la landing.
// · «Así de simple» y «¿Partner o Agency?» marcan su sección entera (el título y sus tarjetas).
// · «Sumarme como Agency» (el cierre, con `clic`: el botón no se apaga) existe sólo con MaKo Pro activo; en MaKo Essential y en su prueba
//   el botón dice «Pásate a MaKo Pro» y el motor saltea el paso. La marca va en la fila del botón de arriba (`.ag-acciones`), no en el
//   botón: tests/agency.test.ts fija el texto exacto de su línea. NO SE PUDO MEDIR con Valentina (Essential): se midió dibujando la
//   landing como la ve un negocio con Pro.
// · Ya agencia, /agency abre su dashboard y estos pasos no están: el motor los saltea. En el teléfono (/m/agency), sin medir.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_AGENCY: TutorialPestana = {
  pestana: 'agency',
  nombre: 'Agency Dashboard',
  ruta: '/agency',
  intro: 'Si tienes una agencia, entra a la cuenta de cada cliente con un clic.',
  pasos: [
    {
      sel: '[data-recorrido="tour-agency-asi-de-simple"]',
      titulo: 'Así de simple',
      texto: 'Abres la cuenta con su nombre y su email, o desde un lead de tu CRM, y eliges quién la paga.',
      sub: 'Mira aquí, Así de simple: abres cada cuenta desde un lead, y la pagas tú o tu cliente.',
      lado: 'arriba',
    },
    {
      sel: '[data-recorrido="tour-agency-partner-o-agency"]',
      titulo: '¿Partner o Agency?',
      texto: 'Partner gana dinero recomendando MaKo; Agency usa MaKo para atender a sus clientes.',
      sub: 'Mira aquí, ¿Partner o Agency?: ahí ves en qué se diferencian.',
      lado: 'arriba',
    },
    {
      sel: '[data-recorrido="tour-agency-sumarme"]',
      titulo: 'Sumarme como Agency',
      texto: 'Tres preguntas y tienes tu Agency Dashboard. A tus clientes no les mandamos promociones.',
      sub: 'Con MaKo Pro activo, toca aquí, en Sumarme como Agency: a tus clientes no les mandamos promociones ni otros planes.',
      lado: 'abajo',
      haz: 'Haz clic en Sumarme como Agency',
      clic: true,
    },
  ],
};
