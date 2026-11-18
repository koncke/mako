// El tutorial de Marketing CoPilot (/ads-manager/copiloto; en el teléfono /m/ads). Cuadra con el guion de su video
// (public/tutoriales/manifiesto.json, key `copilot`). La entrada «¿Por dónde vendes?» (app/ads-manager/copiloto/Entrada.tsx): sus
// clases `cop-ent__*` son globales (su <style>), las mismas en el teléfono. Lo que el guion cuenta DESPUÉS de esta pantalla (el tiempo
// para crear, el análisis, el Plan y el OK de los anuncios) no tiene un control a la vista al entrar: va en el `sub` del paso que le
// sigue, sin paso propio.
import type { TutorialPestana } from './tipos';

export const TUTORIAL_COPILOT: TutorialPestana = {
  pestana: 'copilot',
  nombre: 'Marketing CoPilot',
  ruta: '/ads-manager/copiloto',
  rutaMovil: '/m/ads',
  intro: 'Deja de adivinar cuánto publicar y en qué red.',
  pasos: [
    {
      sel: '.cop-ent__ops',
      titulo: 'Por dónde vendes',
      texto: 'Anuncios, Instagram o YouTube. Puedes marcar más de uno.',
      sub: 'Mira aquí, ¿Por dónde vendes?: marca dónde publicas o inviertes.',
      lado: 'abajo',
    },
    {
      sel: 'button.cop-ent__seguir',
      titulo: 'Seguir',
      texto: 'Después analiza tu oferta, tu web, tus anuncios, Instagram y YouTube. Lo que te toca va directo a tu Plan.',
      sub: 'Haz clic aquí, en Seguir, y responde las otras dos, una por pantalla.',
      lado: 'arriba',
    },
  ],
};
