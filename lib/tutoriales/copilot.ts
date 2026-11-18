// El tutorial de Marketing CoPilot (/ads-manager/copiloto; en el teléfono /m/ads). Guion: docs/reto-7-dias/tutoriales-por-pestana.md §8.
// La entrada «¿Por dónde vendes?» (app/ads-manager/copiloto/Entrada.tsx): sus clases `cop-ent__*` son globales (su <style>), las mismas en el teléfono.
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
      texto: 'Por dónde vendes, tus anuncios y tu tiempo para crear.',
      sub: 'Antes, tres preguntas cortas, una por pantalla.',
      lado: 'abajo',
    },
    {
      sel: '.cop-ent__ops',
      titulo: '¿Por dónde vendes?',
      texto: 'Marca todos los que uses. Con Anuncios, te pregunta también cuánto inviertes.',
      sub: 'Marca por dónde vendes. Puede ser más de uno.',
      lado: 'abajo',
    },
    {
      sel: 'button.cop-ent__seguir',
      titulo: 'Seguir',
      texto: 'Al final conectas las redes que elegiste, en la misma entrada.',
      sub: 'Con el tiempo que tengas para crear, Máko calcula cuánto publicar en cada red. Después analiza tu oferta, tu web, tus anuncios, Instagram y YouTube. Lo que te toca va directo a tu Plan, y el piloto no lanza un anuncio sin tu OK. Toca Seguir y arranca.',
      lado: 'arriba',
    },
  ],
};
