// La pantalla del personaje en cubos montada SOLA en una página (scripts/avatar-cubos/vista.mjs la empaqueta con esbuild y
// cambia ./actions por ./acciones-falsas.ts). Es el componente de verdad, con su CSS: lo que se ve acá es lo que ve la persona.
import { createRoot } from 'react-dom/client';
import { EstudioCubos } from '../../app/ai-avatar/cubos/EstudioCubos';

createRoot(document.getElementById('raiz')!).render(
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
    <EstudioCubos alVolver={() => {}} />
  </div>,
);
