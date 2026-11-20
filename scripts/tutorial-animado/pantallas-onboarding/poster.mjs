// =============================================================================
// LA PORTADA DE UN VIDEO, ELEGIDA: el play cae sobre un espacio vacío (20/11/2026)
// =============================================================================
// El Cerebro: «en la portada del video de WhatsApp, el botón de play tapa "es por donde MaKo". Elige como portada un cuadro donde el
// play caiga sobre un espacio vacío… Lo mismo con cualquier portada nueva». El reproductor del chat (app/_ui/tutorial/VideoDelMomento.tsx)
// pone el play en el CENTRO de la portada. `hacer.mjs <id> web` arma la portada solo (el medio del primer cuadro de texto), y ahí el
// centro suele ser el texto. Este script la cambia por el cuadro elegido, en el 720p que sirve la app. Después de un `hacer.mjs … web`,
// se vuelve a correr.
//   node pantallas-onboarding/poster.mjs                → las portadas elegidas de abajo
// =============================================================================
import { execFileSync } from 'node:child_process';

const PUBLICO = 'C:/dev/tutoriales-video/public-tutoriales';
// [video, segundo]: el cuadro con el centro libre.
const ELEGIDAS = [
  ['onboarding-bienvenida-whatsapp', 7.5], // «Manda el mensaje que ya va escrito»: el centro es el fondo del chat, vacío
];
for (const [id, t] of ELEGIDAS) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', `${PUBLICO}/${id}.mp4`, '-frames:v', '1', '-q:v', '4', `${PUBLICO}/${id}.jpg`], { stdio: 'inherit' });
  console.log(`portada: ${id}.jpg, del segundo ${t}`);
}
