// El tutorial de Classroom › Leaderboards (/classroom/leaderboards: app/_comunidad/Ranking.tsx). Cuadra con el guion de su video
// (C:/dev/tutoriales-video/guiones.json, id `classroom-leaderboards`): la sub-tab de Classroom (`que-es`: el link de ClientsShell, que lleva la
// ruta y, si hay, el `?producto=`) y un paso por cada frase con marca, en su orden, con la marca que fija el manifiesto
// (lib/tutoriales/marcas.ts); el `sub` es la frase.
// · LA COMUNIDAD ES SÓLO DE MaKo Pro (lib/comunidad-solo-pro.ts): con MaKo Essential, y en su prueba, la pantalla es el candado
//   (CartelSoloPro) y el motor saltea todo menos la sub-tab. Se midió dibujando la comunidad como la ve un negocio con Pro.
// · La marca del ranking va en la primera tabla («Últimos 7 días»). «Nombres de los niveles» (el cierre, con `clic`: no se apaga) lo
//   ve sólo quien configura la comunidad (el admin del negocio).
// · En el teléfono (/m/comunidad), sin medir: sin `rutaMovil`.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_CLASSROOM_LEADERBOARDS: TutorialPestana = {
  pestana: 'classroom-leaderboards',
  nombre: 'Leaderboards',
  ruta: '/classroom/leaderboards',
  intro: 'Un alumno que suma puntos vuelve más seguido.',
  pasos: [
    {
      sel: '[data-recorrido="tour-classroom-leaderboards-niveles"]',
      titulo: 'Los niveles',
      texto: 'Cada like es un punto. Con los puntos el alumno sube de nivel, y un nivel puede abrirle una parte del curso.',
      sub: 'Mira aquí, los niveles: cada like le suma un punto al alumno, y con los puntos sube de nivel.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="tour-classroom-leaderboards-ranking"]',
      titulo: 'Quién más sumó',
      texto: 'En los últimos 7 días, en los últimos 30 y en total.',
      sub: 'Toca aquí, en Últimos 7 días, Últimos 30 días o Total, para ver quién más sumó.',
      lado: 'arriba',
    },
    {
      sel: '[data-recorrido="tour-classroom-leaderboards-nombres"]',
      titulo: 'Nombres de los niveles',
      texto: 'Ponle a cada nivel un nombre de tu programa.',
      sub: 'Ponle nombre propio a cada nivel: toca aquí, en Nombres de los niveles.',
      lado: 'abajo',
      haz: 'Haz clic en Nombres de los niveles',
      clic: true,
    },
  ],
};
