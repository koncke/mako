// =============================================================================
// LA PORTADA DE UN VIDEO, ELEGIDA: el play cae sobre un espacio vacío (20/11/2026)
// =============================================================================
// El Cerebro: «en la portada del video de WhatsApp, el botón de play tapa "es por donde MaKo". Elige como portada un cuadro donde el
// play caiga sobre un espacio vacío… o corre el play. Lo mismo con cualquier portada nueva». El reproductor del chat
// (app/_ui/tutorial/VideoDelMomento.tsx) pone el play en el CENTRO de la portada, salvo que el manifiesto diga otra esquina (`play`).
// `hacer.mjs <id> web` arma la portada solo (el medio del primer cuadro de texto) y la línea del manifiesto sin `play`: después de un
// `hacer.mjs … web`, este script se vuelve a correr.
//   node pantallas-onboarding/poster.mjs
// =============================================================================
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const PUBLICO = 'C:/dev/tutoriales-video/public-tutoriales';
const MANIFIESTO_PUB = `${PUBLICO}/manifiesto.json`;
const MANIFIESTO = 'C:/Users/marti/OneDrive/Escritorio/MaKo-VSL/tutoriales/manifiesto.json';
// [video, segundo, dónde va el play si no es el centro]
const ELEGIDAS = [
  // «Manda el mensaje que ya va escrito»: el centro es el fondo del chat, vacío.
  ['onboarding-bienvenida-whatsapp', 7.5, null],
  // En la bienvenida (OA-17) TODOS los cuadros tienen en el centro la cabeza del personaje o el texto: el gancho («¡Hola! Soy
  // Martín…») con el play abajo a la derecha, donde no hay nada.
  ['onboarding-bienvenida', 1.6, 'abajo-derecha'],
];
const man = JSON.parse(readFileSync(MANIFIESTO_PUB, 'utf8'));
for (const [id, t, play] of ELEGIDAS) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', `${PUBLICO}/${id}.mp4`, '-frames:v', '1', '-q:v', '4', `${PUBLICO}/${id}.jpg`], { stdio: 'inherit' });
  const v = man.videos.find((x) => x.key === id);
  if (v) { if (play) v.play = play; else delete v.play; }
  console.log(`portada: ${id}.jpg, del segundo ${t}${play ? `, play ${play}` : ''}`);
}
writeFileSync(MANIFIESTO_PUB, JSON.stringify(man, null, 1));
copyFileSync(MANIFIESTO_PUB, MANIFIESTO);
