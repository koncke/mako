// El tutorial de la API (/api-mako: app/api-mako/ApiMako.tsx y, en la vista Tokens, app/api-mako/Tokens.tsx). Cuadra con el guion de
// su video (C:/dev/tutoriales-video/guiones.json, id `api`): el paso de `que-es` y un paso por cada frase con marca, en su orden, con la
// marca que fija el manifiesto (lib/tutoriales/marcas.ts); el `sub` es la frase.
// · El menú de la foto (donde vive «API») está cerrado al entrar: el primer paso marca el título de la pantalla (`.gh-titulo-app`,
//   github.css es global). Las pestañas Documentación y Tokens llevan su marca.
// · Sin ningún token la tab abre en «Tokens» (app/api-mako/page.tsx), con «Generar nuevo token» a la vista: así entra un negocio nuevo.
//   La marca va en el primero (el de la barra de la lista; el del cuadro vacío y el «(clásico)» no la llevan). Las dos «toca» de las
//   pestañas pausan el video hasta el toque, así que al llegar al cierre se está en Tokens; con tokens la tab abre en Documentación y
//   el cierre espera a ese toque.
// · El cierre lleva `clic`: es un link, no se apaga. En el teléfono (/m/api-mako), sin medir: sin `rutaMovil`.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_API: TutorialPestana = {
  pestana: 'api',
  nombre: 'API',
  ruta: '/api-mako',
  intro: 'Si usas n8n, Zapier o Make, ponlos a trabajar con tu negocio.',
  pasos: [
    {
      sel: '[data-recorrido="tour-api-documentacion"]',
      titulo: 'Documentación',
      texto: 'Cada cosa que se le puede pedir a MaKo, con ejemplos en cURL, JavaScript y Python.',
      sub: 'Toca aquí, en Documentación, y encuentra lo que se puede pedir, con ejemplos.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="tour-api-tokens"]',
      titulo: 'Tokens',
      texto: 'Cada token es una llave con nombre, vencimiento y las áreas que puede tocar.',
      sub: 'Toca aquí, en Tokens: cada uno es una llave con nombre, vencimiento y áreas.',
      lado: 'abajo',
    },
    {
      sel: '[data-recorrido="tour-api-generar"]',
      titulo: 'Generar nuevo token',
      texto: 'Recién generado se ve una sola vez: cópialo ahí y pégalo en tu herramienta.',
      sub: 'Toca aquí, en Generar nuevo token, y cópialo apenas aparece: con él, tus herramientas trabajan solas con tu negocio.',
      lado: 'izquierda',
      haz: 'Haz clic en Generar nuevo token',
      clic: true,
    },
  ],
};
