// EL CORREO QUE PROMETE «SIGAMOS EN TU COMPUTADORA» (20/11/2026, la llamada con Leila, 00:36:45: la pantalla dice «Abre MaKo en tu
// computadora con el link que te mandamos a tu correo», y nadie lo mandaba). Ahora sale al cerrar el onboarding en el teléfono (y, si
// no, al mostrarse la pantalla), una vez por persona, con el link al chat del reto (la llegada con «Hola de nuevo» primero).
// Roto a propósito el 20/11 (cada uno cae): mandándolo mirando como administrador (2), sin la marca de «ya se mandó» (2), el cierre
// sin mandarlo (3), la pantalla sin mandarlo (3), y el reinicio sin borrar la marca (4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAVE_CORREO_PC, RUTA_DEL_CORREO_PC, correoSeguirEnPc } from '../lib/onboarding-v2/correo-pc';
import { SETTINGS_QUE_SE_BORRAN } from '../lib/reiniciar-onboarding';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el correo: corto, de tú, con el link solo en su renglón, al chat del reto', () => {
  const link = 'https://hola-mako.com/second-brain?reto=1&ws=11';
  const c = correoSeguirEnPc('Leila', link);
  assert.equal(c.asunto, 'Sigue tu onboarding en la computadora');
  assert.ok(c.cuerpo.startsWith('Hola, Leila:'));
  assert.ok(c.cuerpo.split('\n').includes(link), 'el link, solo en su renglón (que se pueda tocar)');
  assert.match(c.cuerpo, /reto de 7 días/);
  assert.doesNotMatch(`${c.asunto} ${c.preheader} ${c.cuerpo}`, /\b(podés|tenés|abrí|seguí|contestá|bienvenid[oa])\b/i, 'de tú y neutro');
  assert.ok(correoSeguirEnPc('', link).cuerpo.startsWith('Hola:'), 'sin nombre, sin la coma colgando');
  assert.equal(RUTA_DEL_CORREO_PC, '/second-brain?reto=1');
});

test('2. se manda una vez, sólo a la persona en SU cuenta, sólo con el V2; nunca tira', () => {
  const f = sinComentarios(leer('lib/seguir-en-pc-correo.ts'));
  assert.match(f, /if \(p\.mirando\) return \{ enviado: false, motivo: 'mirando como administrador' \};/);
  assert.match(f, /if \(!veOnboardingV2\(\{ email: p\.email, ws: p\.ws \}\)\) return/);
  assert.match(f, /try \{ ya = await getSettingEstricto\(CLAVE_CORREO_PC\); \} catch \{ return/, '«no pude leer» no manda');
  assert.match(f, /if \(ya && \(JSON\.parse\(ya\) as \{ a\?: string \}\)\.a === p\.email\) return \{ enviado: false, motivo: 'ya se mandó' \};/);
  assert.match(f, /idempotencyKey: `seguir-en-pc-\$\{p\.ws\}-\$\{p\.email\}`/);
  const iEnvio = f.indexOf('await avisarDePlataforma(');
  const iMarca = f.indexOf('await setSetting(CLAVE_CORREO_PC,');
  assert.ok(iEnvio > 0 && iMarca > iEnvio, 'la marca va DESPUÉS de que salió (si no salió, se reintenta)');
  assert.match(f, /linkApp\(RUTA_DEL_CORREO_PC, p\.ws\)/, 'el link lleva el negocio');
  // No va en lib/seguir-en-pc.ts: ése lo importa el layout raíz.
  assert.doesNotMatch(sinComentarios(leer('lib/seguir-en-pc.ts')), /invitaciones|avisarDePlataforma/);
});

test('3. sale al cerrar el onboarding en el teléfono, y si no, al mostrarse «Sigamos en tu computadora»', () => {
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  assert.match(ruta, /const r = await cerrarArranque\(\);\n\s*if \(await esTelefono\(\)\.catch\(\(\) => false\)\) await mandarCorreoSeguirEnPc\(\);/);
  const pagina = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.match(pagina, /await mandarCorreoSeguirEnPc\(\);\n\s*return <SeguirEnPc /);
  // Y la pantalla lo sigue prometiendo (ahora es verdad).
  assert.match(leer('app/onboarding/SeguirEnPc.tsx'), /Te mandamos el link a/);
});

test('4. «Reiniciar onboarding» borra la marca: con el onboarding de nuevo, el correo vuelve a salir', () => {
  assert.ok((SETTINGS_QUE_SE_BORRAN as readonly string[]).includes(CLAVE_CORREO_PC));
});
