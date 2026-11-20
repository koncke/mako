// EL IDA Y VUELTA ENTRE LA APP Y EL ONBOARDING (20/11/2026, el Cerebro, en producción después de «Reiniciar onboarding» en el ws 3):
// al tocar «Entrar a MaKo», más de 1000 pedidos en segundos alternando /second-brain?_rsc y /onboarding?_rsc, la pantalla en blanco,
// ~7 minutos. La guarda de la app lo vio sin terminar (leía tolerante: un error de lectura es «pending») y /onboarding, terminado.
// Esto recorre las dos puntas con TODAS las combinaciones de lo que cada una lee, y cae si alguna vuelve más de una vez
// (lib/rebote-onboarding.ts). Y fija que las guardas usan eso.
// Roto a propósito el 20/11 (cada uno cae): la guarda que trata «no pude leer» como «sin terminar» (1), la guarda sin mirar el rebote
// (1), /onboarding que devuelve siempre (1), la guarda sin `conRebote` (3), /onboarding sin `conRebote` (3), `mandarAlOnboarding`
// con la lectura tolerante (3), y /second-brain que redirige al hilo con `?chat=` ya puesto (4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PARAM_REBOTE, SEGUNDOS_REBOTE, conRebote, guardiaMandaAlOnboarding, marcaDeRebote, onboardingDevuelveALaApp, reboteReciente,
} from '../lib/rebote-onboarding';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

type Pedido = { ruta: '/second-brain' | '/onboarding'; rebote: string | null };
type Final = 'la app' | 'el onboarding' | 'ya está listo' | 'BUCLE';

/** Las dos puntas, como deciden en el servidor: la guarda de la app (`guardOnboarding`) y la página de /onboarding. */
function recorrer(inicio: Pedido, guarda: { lectura: 'ok' | 'fallo'; terminado: boolean }, onboardingLoVeTerminado: boolean, ahora: number): { saltos: number; final: Final } {
  let p = inicio;
  for (let saltos = 0; saltos <= 10; saltos++) {
    if (p.ruta === '/second-brain') {
      if (!guardiaMandaAlOnboarding({ ...guarda, reboteReciente: reboteReciente(p.rebote, ahora) })) return { saltos, final: 'la app' };
      p = { ruta: '/onboarding', rebote: marcaDeRebote(ahora) };
    } else {
      if (!onboardingLoVeTerminado) return { saltos, final: 'el onboarding' };
      if (!onboardingDevuelveALaApp({ reboteReciente: reboteReciente(p.rebote, ahora) })) return { saltos, final: 'ya está listo' };
      p = { ruta: '/second-brain', rebote: marcaDeRebote(ahora) };
    }
  }
  return { saltos: 11, final: 'BUCLE' };
}

test('1. con CUALQUIER combinación de lo que lee cada punta, nunca más de una vuelta (el bucle del 20/11, por construcción)', () => {
  const ahora = Date.parse('2026-11-20T18:43:00Z');
  for (const ruta of ['/second-brain', '/onboarding'] as const) {
    for (const lectura of ['ok', 'fallo'] as const) {
      for (const terminado of [true, false]) {
        for (const onb of [true, false]) {
          const r = recorrer({ ruta, rebote: null }, { lectura, terminado }, onb, ahora);
          assert.notEqual(r.final, 'BUCLE', `${ruta}, la guarda ${lectura}/${terminado ? 'terminado' : 'sin terminar'}, /onboarding ${onb ? 'terminado' : 'sin terminar'}`);
          assert.ok(r.saltos <= 2, `${ruta}: ${r.saltos} saltos`);
        }
      }
    }
  }
  // El caso del 20/11: la guarda lo ve sin terminar (o no puede leer) y /onboarding terminado.
  assert.deepEqual(recorrer({ ruta: '/second-brain', rebote: null }, { lectura: 'fallo', terminado: false }, true, ahora), { saltos: 0, final: 'la app' }, 'no pudo leer: deja pasar');
  assert.deepEqual(recorrer({ ruta: '/second-brain', rebote: null }, { lectura: 'ok', terminado: false }, true, ahora), { saltos: 1, final: 'ya está listo' }, 'no coinciden: un toque');
  // Las DOS puntas cortan solas: lo que llega rebotado de /onboarding (que lo vio terminado) entra a la app aunque la guarda no coincida.
  assert.deepEqual(recorrer({ ruta: '/second-brain', rebote: marcaDeRebote(ahora) }, { lectura: 'ok', terminado: false }, true, ahora), { saltos: 0, final: 'la app' }, 'viene rebotado de /onboarding: no vuelve');
  // Lo de siempre, igual: sin terminar va al onboarding; terminado entra; un link viejo a /onboarding devuelve a la app.
  assert.deepEqual(recorrer({ ruta: '/second-brain', rebote: null }, { lectura: 'ok', terminado: false }, false, ahora), { saltos: 1, final: 'el onboarding' });
  assert.deepEqual(recorrer({ ruta: '/second-brain', rebote: null }, { lectura: 'ok', terminado: true }, true, ahora), { saltos: 0, final: 'la app' });
  assert.deepEqual(recorrer({ ruta: '/onboarding', rebote: null }, { lectura: 'ok', terminado: true }, true, ahora), { saltos: 1, final: 'la app' });
});

test('2. el rebote vale lo que tarda un ida y vuelta: una URL vieja con `?rebote=` es una URL más', () => {
  const ahora = Date.parse('2026-11-20T18:43:00Z');
  assert.equal(reboteReciente(marcaDeRebote(ahora), ahora), true);
  assert.equal(reboteReciente(marcaDeRebote(ahora - (SEGUNDOS_REBOTE + 1) * 1000), ahora), false);
  assert.equal(reboteReciente(marcaDeRebote(ahora + 60_000), ahora), false, 'del futuro, no');
  assert.equal(reboteReciente('1', ahora), false);
  assert.equal(reboteReciente('hola', ahora), false);
  assert.equal(reboteReciente(undefined, ahora), false);
  assert.equal(reboteReciente([marcaDeRebote(ahora), 'x'], ahora), true);
  // Con la ruta de siempre al caer viejo: /onboarding con un rebote de hace un minuto devuelve a la app.
  assert.deepEqual(recorrer({ ruta: '/onboarding', rebote: marcaDeRebote(ahora - 60_000) }, { lectura: 'ok', terminado: true }, true, ahora), { saltos: 1, final: 'la app' });
  assert.equal(conRebote('/onboarding', ahora), `/onboarding?${PARAM_REBOTE}=${marcaDeRebote(ahora)}`);
  assert.equal(conRebote('/second-brain?tab=x#y', ahora), `/second-brain?tab=x&${PARAM_REBOTE}=${marcaDeRebote(ahora)}#y`);
});

test('3. las guardas: leen ESTRICTO, miran el rebote y lo ponen; /onboarding no devuelve a quien acaba de rebotar', () => {
  const estado = sinComentarios(leer('lib/onboarding-state.ts'));
  const mandar = estado.slice(estado.indexOf('export async function mandarAlOnboarding'));
  assert.match(mandar, /try \{ estado = await getEstadoOnboardingEstricto\(\); \} catch/, 'estricto: «no pude leer» no es «no terminó»');
  assert.doesNotMatch(mandar.slice(0, mandar.indexOf('return manda;')), /getEstadoOnboarding\(\)/, 'nunca la lectura tolerante');
  assert.match(mandar, /reboteReciente\(\(await pedidoActual\(\)\.catch\(\(\) => null\)\)\?\.query\[PARAM_REBOTE\], Date\.now\(\)\)/);
  assert.match(mandar, /guardiaMandaAlOnboarding\(\{ lectura: estado \? 'ok' : 'fallo', terminado: estado\?\.status === 'done', reboteReciente: rebote \}\)/);

  assert.match(sinComentarios(leer('lib/tab-access.ts')), /if \(await mandarAlOnboarding\(\)\) redirect\(await rutaConWs\(conRebote\('\/onboarding', Date\.now\(\)\)\)\);/);
  assert.match(sinComentarios(leer('app/inicio/page.tsx')), /if \(!opera && \(await mandarAlOnboarding\(\)\)\) redirect\(await rutaConWs\(conRebote\('\/onboarding', Date\.now\(\)\)\)\);/);
  assert.match(sinComentarios(leer('lib/movil-guard.ts')), /\(await mandarAlOnboarding\(\)\)\) redirect\(await rutaConWs\(RUTA_CONFIGURAR_MOVIL\)\);/);
  for (const r of ['lib/tab-access.ts', 'app/inicio/page.tsx', 'lib/movil-guard.ts']) {
    assert.doesNotMatch(sinComentarios(leer(r)), /onboardingPendiente\(\)\)\) redirect|onboardingPendiente\(\)\) redirect/, `${r}: redirige con la lectura tolerante`);
  }

  const pagina = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.match(pagina, /if \(!onboardingDevuelveALaApp\(\{ reboteReciente: reboteReciente\(rebote, Date\.now\(\)\) \}\)\) \{[\s\S]*?return <OnboardingYaListo href=\{await rutaConWs\(destinoDeTabVieja\(tab\)\)\} \/>;/);
  assert.match(pagina, /redirect\(await rutaConWs\(conRebote\(destinoDeTabVieja\(tab\), Date\.now\(\)\)\)\);\n\}/);
  assert.match(pagina, /<a className="mk-btn mk-btn--md mk-btn--primary" href=\{href\} data-onboarding-ya-listo="">Entrar a MaKo<\/a>/, 'un toque, con navegación completa');
});

test('4. /second-brain no redirige al chat «Onboarding» si el pedido ya elige chat: el destino trae `?chat=`, y anotarlo puede fallar', () => {
  const p = sinComentarios(leer('app/second-brain/page.tsx'));
  assert.match(p, /const eligeChat = !!\(q\.chat \|\| q\.reto\);\n\s*const hiloNuevo = eligeChat \? null : await hiloParaQuienYaTermino\(\)\.catch\(\(\) => null\);\n\s*if \(hiloNuevo\) redirect\(await rutaConWs\(rutaDelHilo\(hiloNuevo\)\)\);/);
});
