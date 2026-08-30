/**
 * La ficha de este curso, FUERA del componente.
 *
 * ⚠️ Vive acá y no en el `.tsx` porque aquél empieza con `'use client'`, y un `import` de
 *    un VALOR desde un componente cliente NO trae el objeto cuando quien importa está en
 *    el grafo del SERVER: trae una referencia de cliente. `catalogo.ts` lo hacía así, con
 *    lo cual dos de las 94 entradas de `CURSOS_TODOS` llegaban sin `titulo` y el build de
 *    producción murió con «Failed to collect configuration for /compartido/[token]:
 *    Cannot read properties of undefined (reading 'lastIndexOf')» — sin nombrar ni el
 *    archivo ni el curso.
 *
 * ⚠️ Y NO SE VE EN LOCAL: `tsx` ignora la directiva `'use client'`, así que importar el
 *    catálogo con `tsx` devuelve los 94 cursos con título y cualquier verificación local
 *    da verde. Lo caza el build, o no lo caza nadie.
 *
 * Es «`'use client'` es una frontera de DATOS, no solo de interactividad» (AGENTS.md) por
 * el lado que menos se mira: no lo que VIAJA de más al navegador, sino lo que NO LLEGA al
 * server.
 */
import type { Curso } from './curso';

export const CURSO_BRANDING: Curso = {
  slug: 'branding-mako',
  categoria: 'Marca y material',
  titulo: 'Branding MaKo',
  cardDesc: 'Todo el material de marca en un solo lugar: los gráficos de las landings, las animaciones de los VSL, los íconos de las apps y los videos. Cada pieza se descarga.',
  eyebrow: 'Material de marca',
  subtitulo: 'Los gráficos, animaciones, íconos y videos que fuimos produciendo. Todo descargable, y con la opción de compartir por link.',
  volumen: '179 piezas',
  recursos: [],
  clases: [],
};

