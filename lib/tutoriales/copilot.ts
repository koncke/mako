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
  intro: 'El CoPilot hace de tu equipo de marketing: mira lo que publicas y lo que inviertes, y te dice qué hacer.',
  pasos: [
    {
      sel: '.cop-ent__barra',
      titulo: 'Tres preguntas',
      texto: 'Una por pantalla, y en dos minutos el CoPilot ya sabe por dónde vendes.',
      sub: 'Antes, tres preguntas cortas, una por pantalla.',
      lado: 'abajo',
    },
    {
      sel: '.cop-ent__ops',
      titulo: 'Por dónde vendes',
      texto: 'Anuncios, Instagram o YouTube. Puedes marcar más de uno.',
      sub: 'Marca por dónde vendes. Puede ser más de uno. Con el tiempo que tengas para crear, MaKo calcula cuánto publicar en cada red.',
      lado: 'abajo',
    },
    {
      sel: 'button.cop-ent__seguir',
      titulo: 'Seguir',
      texto: 'Después analiza tu oferta, tu web, tus anuncios, Instagram y YouTube. Lo que te toca va directo a tu Plan.',
      sub: 'Después analiza tu oferta, tu web, tus anuncios, Instagram y YouTube. Lo que te toca va directo a tu Plan, y el piloto no lanza un anuncio sin tu OK. Toca Seguir y arranca.',
      lado: 'arriba',
      // Sin `clic`: «Seguir» está apagado hasta que se marca un canal, y con el velo sólo se puede tocar lo marcado.
    },
  ],
};
