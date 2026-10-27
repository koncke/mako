// «ACTUALIZA LA EXTENSIÓN DE MAKO» EN TODA LA APP (27/10/2026). Leila (Fathom 876470842-07) estaba en la 0.70 con la 0.74
// vigente: el aviso de extensión vieja vivía sólo en las pantallas de video y ella usa el CRM. Ahora va en la esquina de
// avisos del layout, para cualquier pantalla con sesión, y lleva al instructivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

test('el layout lo monta en la esquina de avisos, con sesión', () => {
  const layout = leer('app/layout.tsx');
  assert.match(layout, /import \{ AvisoExtensionVieja \} from '\.\/_components\/AvisoExtensionVieja';/);
  const esquina = layout.slice(layout.indexOf('<EsquinaAvisos>'), layout.indexOf('</EsquinaAvisos>'));
  assert.match(esquina, /\{sesion && <AvisoExtensionVieja \/>\}/, 'el aviso de extensión vieja no está en la esquina de la app');
});

test('sólo si está instalada y va atrás (la misma pregunta del video), y lleva al instructivo', () => {
  const aviso = leer('app/_components/AvisoExtensionVieja.tsx');
  assert.match(aviso, /const vieja = useExtensionVieja\(instalada\);/, 'otra comparación de versiones: la de la casa vive en un solo lugar');
  assert.match(aviso, /if \(fuera \|\| typeof instalada !== 'string' \|\| !vieja\) return null;/, 'sin extensión, o al día, igual avisa');
  assert.match(aviso, /<Link href="\/extension\/instalar"/);
  // Donde ya está el aviso grande (video) o el instructivo mismo, no se repite.
  assert.match(aviso, /pathname\.startsWith\('\/video-generator'\) \|\| pathname\.startsWith\('\/extension'\)/);
});
