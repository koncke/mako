// EL IDA Y VUELTA ENTRE LA APP Y EL ONBOARDING (20/11/2026, el Cerebro, en producción después de «Reiniciar onboarding» en el ws 3):
// al tocar «Entrar a MaKo», cientos de pedidos alternando /second-brain?rebote=<nuevo>&_rsc y /onboarding?rebote=<SIEMPRE el mismo,
// viejo>&_rsc, la pantalla en blanco, ~5 minutos. EL DIAGNÓSTICO OBVIO (EL SERVIDOR) ERA EL EQUIVOCADO: el servidor contestaba bien.
// Era el Router Cache del navegador: un prefetch de /second-brain hecho con el onboarding pendiente («a /onboarding?rebote=<viejo>»),
// que router.push reusaba; y /onboarding miraba el rebote por FRESCURA y no reconocía el viejo. Esto fija:
//   · del onboarding a la app, navegación ENTERA; en /onboarding, ningún prefetch de la app (5);
//   · un `?rebote=` PRESENTE corta, viejo o nuevo, en las dos puntas, con TODAS las combinaciones de lo que cada una lee (1 y 2);
//   · y, como red, la guarda que lee estricto (3).
// Roto a propósito el 20/11 (cada uno cae): la guarda que trata «no pude leer» como «sin terminar» (1), la guarda sin mirar el rebote
// (1), /onboarding que devuelve siempre (1), el rebote por frescura (2), la guarda sin `conRebote` (3), /onboarding sin `conRebote` (3),
// `mandarAlOnboarding` con la lectura tolerante (3), «Entrar a MaKo» con router.push (5), el Link prefetcheando en el onboarding (5), y
// /second-brain que redirige al hilo con `?chat=` ya puesto (4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PARAM_REBOTE, conRebote, guardiaMandaAlOnboarding, marcaDeRebote, onboardingDevuelveALaApp, vieneRebotado } from '../lib/rebote-onboarding';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

type Pedido = { ruta: '/second-brain' | '/onboarding'; rebote: string | null };
type Final = 'la app' | 'el onboarding' | 'ya está listo' | 'BUCLE';

/**
 * Las dos puntas, como deciden en el servidor (la guarda de la app y la página de /onboarding). `cacheDeLaApp`: el Router Cache del
 * navegador guardó un «/second-brain → /onboarding?rebote=<viejo>» (el prefetch del 20/11): cada ida a la app sale de ahí.
 */
function recorrer(inicio: Pedido, guarda: { lectura: 'ok' | 'fallo'; terminado: boolean }, onboardingLoVeTerminado: boolean, ahora: number, cacheDeLaApp: string | null = null): { saltos: number; final: Final } {
  let p = inicio;
  for (let saltos = 0; saltos <= 10; saltos++) {
    if (p.ruta === '/second-brain') {
      if (cacheDeLaApp) { p = { ruta: '/onboarding', rebote: cacheDeLaApp }; continue; }
      if (!guardiaMandaAlOnboarding({ ...guarda, rebotado: vieneRebotado(p.rebote) })) return { saltos, final: 'la app' };
      p = { ruta: '/onboarding', rebote: marcaDeRebote(ahora) };
    } else {
      if (!onboardingLoVeTerminado) return { saltos, final: 'el onboarding' };
      if (!onboardingDevuelveALaApp({ rebotado: vieneRebotado(p.rebote) })) return { saltos, final: 'ya está listo' };
      p = { ruta: '/second-brain', rebote: marcaDeRebote(ahora) };
    }
  }
  return { saltos: 11, final: 'BUCLE' };
}

test('1. con CUALQUIER combinación de lo que lee cada punta, nunca más de una vuelta', () => {
  const ahora = Date.parse('2026-11-20T20:18:00Z');
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
  assert.deepEqual(recorrer({ ruta: '/second-brain', rebote: null }, { lectura: 'fallo', terminado: false }, true, ahora), { saltos: 0, final: 'la app' }, 'no pudo leer: deja pasar');
  assert.deepEqual(recorrer({ ruta: '/second-brain', rebote: null }, { lectura: 'ok', terminado: false }, true, ahora), { saltos: 1, final: 'ya está listo' }, 'no coinciden: un toque');
  // Las DOS puntas cortan solas: lo que llega rebotado de /onboarding entra a la app aunque la guarda no coincida.
  assert.deepEqual(recorrer({ ruta: '/second-brain', rebote: marcaDeRebote(ahora) }, { lectura: 'ok', terminado: false }, true, ahora), { saltos: 0, final: 'la app' }, 'viene rebotado de /onboarding: no vuelve');
  // Lo de siempre, igual: sin terminar va al onboarding; terminado entra; un link viejo a /onboarding devuelve a la app.
  assert.deepEqual(recorrer({ ruta: '/second-brain', rebote: null }, { lectura: 'ok', terminado: false }, false, ahora), { saltos: 1, final: 'el onboarding' });
  assert.deepEqual(recorrer({ ruta: '/second-brain', rebote: null }, { lectura: 'ok', terminado: true }, true, ahora), { saltos: 0, final: 'la app' });
  assert.deepEqual(recorrer({ ruta: '/onboarding', rebote: null }, { lectura: 'ok', terminado: true }, true, ahora), { saltos: 1, final: 'la app' });
});

test('2. EL CASO DEL 20/11: el Router Cache sirve un redirect con un rebote VIEJO, y un rebote presente corta, viejo o nuevo', () => {
  const ahora = Date.parse('2026-11-20T20:18:00Z');
  const viejo = '1795205793';
  // Con el servidor contestando bien (la guarda ve «terminado»), el caché manda igual a /onboarding?rebote=<viejo>: ahí se corta.
  assert.deepEqual(recorrer({ ruta: '/second-brain', rebote: null }, { lectura: 'ok', terminado: true }, true, ahora, `${viejo}`), { saltos: 1, final: 'ya está listo' });
  // Viejo, nuevo o de cualquier hora: si está, cuenta (nada de comparar la hora).
  for (const v of [viejo, marcaDeRebote(ahora), marcaDeRebote(ahora - 3_600_000), marcaDeRebote(ahora + 60_000), '1']) assert.equal(vieneRebotado(v), true, v);
  for (const v of ['', 'hola', undefined, null, '12345678901234']) assert.equal(vieneRebotado(v as string | undefined), false, String(v));
  assert.equal(vieneRebotado([viejo, 'x']), true);
  assert.equal(conRebote('/onboarding', ahora), `/onboarding?${PARAM_REBOTE}=${marcaDeRebote(ahora)}`);
  assert.equal(conRebote('/second-brain?tab=x#y', ahora), `/second-brain?tab=x&${PARAM_REBOTE}=${marcaDeRebote(ahora)}#y`);
  assert.doesNotMatch(sinComentarios(leer('lib/rebote-onboarding.ts')), /Date\.now|ahoraMs \/ 1000 -|SEGUNDOS_REBOTE/, 'el corte no mira la hora');
});

test('3. las guardas: leen ESTRICTO (la red), miran el rebote y lo ponen; /onboarding no devuelve a quien viene rebotado', () => {
  const estado = sinComentarios(leer('lib/onboarding-state.ts'));
  const mandar = estado.slice(estado.indexOf('export async function mandarAlOnboarding'));
  assert.match(mandar, /try \{ estado = await getEstadoOnboardingEstricto\(\); \} catch/, 'estricto: «no pude leer» no es «no terminó»');
  assert.doesNotMatch(mandar.slice(0, mandar.indexOf('return manda;')), /getEstadoOnboarding\(\)/, 'nunca la lectura tolerante');
  assert.match(mandar, /vieneRebotado\(\(await pedidoActual\(\)\.catch\(\(\) => null\)\)\?\.query\[PARAM_REBOTE\]\)/);
  assert.match(mandar, /guardiaMandaAlOnboarding\(\{ lectura: estado \? 'ok' : 'fallo', terminado: estado\?\.status === 'done', rebotado: rebote \}\)/);

  assert.match(sinComentarios(leer('lib/tab-access.ts')), /if \(await mandarAlOnboarding\(\)\) redirect\(await rutaConWs\(conRebote\('\/onboarding', Date\.now\(\)\)\)\);/);
  assert.match(sinComentarios(leer('app/inicio/page.tsx')), /if \(!opera && \(await mandarAlOnboarding\(\)\)\) redirect\(await rutaConWs\(conRebote\('\/onboarding', Date\.now\(\)\)\)\);/);
  assert.match(sinComentarios(leer('lib/movil-guard.ts')), /\(await mandarAlOnboarding\(\)\)\) redirect\(await rutaConWs\(RUTA_CONFIGURAR_MOVIL\)\);/);
  for (const r of ['lib/tab-access.ts', 'app/inicio/page.tsx', 'lib/movil-guard.ts']) {
    assert.doesNotMatch(sinComentarios(leer(r)), /onboardingPendiente\(\)\)\) redirect|onboardingPendiente\(\)\) redirect/, `${r}: redirige con la lectura tolerante`);
  }

  const pagina = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.match(pagina, /if \(!onboardingDevuelveALaApp\(\{ rebotado: vieneRebotado\(rebote\) \}\)\) \{[\s\S]*?return <OnboardingYaListo href=\{await rutaConWs\(destinoDeTabVieja\(tab\)\)\} \/>;/);
  assert.match(pagina, /redirect\(await rutaConWs\(conRebote\(destinoDeTabVieja\(tab\), Date\.now\(\)\)\)\);\n\}/);
  assert.match(pagina, /<a className="mk-btn mk-btn--md mk-btn--primary" href=\{href\} data-onboarding-ya-listo="">Entrar a MaKo<\/a>/, 'un toque, con navegación completa');
});

test('4. /second-brain no redirige al chat «Onboarding» si el pedido ya elige chat: el destino trae `?chat=`, y anotarlo puede fallar', () => {
  const p = sinComentarios(leer('app/second-brain/page.tsx'));
  assert.match(p, /const eligeChat = !!\(q\.chat \|\| q\.reto\);/);
  // (Entre las dos, `alReto`: la primera vez va al reto, sin llevar al chat «Onboarding»; tests/hola-de-nuevo-primero.test.ts.)
  assert.match(p, /const hiloNuevo = eligeChat \? null : await hiloParaQuienYaTermino\(\)\.catch\(\(\) => null\);\n\s*if \(hiloNuevo && !alReto\) redirect\(await rutaConWs\(rutaDelHilo\(hiloNuevo\)\)\);/);
});

test('5. el cliente: del onboarding a la app, navegación ENTERA; en /onboarding, ningún prefetch de la app', () => {
  const v2 = sinComentarios(leer('app/onboarding/ChatArranqueV2.tsx'));
  const entrar = v2.slice(v2.indexOf('const entrar = useCallback'), v2.indexOf('}, [entrando, ws]);'));
  assert.match(entrar, /window\.location\.assign\(conWs\(RUTA_AL_RETO, ws\)\);/);
  assert.doesNotMatch(entrar, /router\.(push|replace)/, '«Entrar a MaKo» con el Router Cache');
  assert.doesNotMatch(v2, /router\.push\(/, 'ningún salto del V2 a la app con router.push');
  // El de antes entra con router.push A PROPÓSITO (el plan que se sigue armando es un fetch en vuelo: una carga entera lo cortaba).
  // Lo cubren las otras dos capas: sin prefetch en /onboarding, y el rebote presente que corta.
  assert.match(sinComentarios(leer('app/onboarding/ChatArranque.tsx')), /router\.push\(destino\);\n\s*\}, \[vista\.modo, router\]\);/);

  const link = sinComentarios(leer('app/_ui/Link.tsx'));
  assert.match(link, /return <NextLink href=\{destino\} \{\.\.\.rest\} \{\.\.\.\(enElOnboarding\(ruta\) \? \{ prefetch: false \} : \{\}\)\} \/>;/, 'el prefetch: false va DESPUÉS de rest (gana)');
  assert.match(link, /prefetch: \(href: string, opts\?: Parameters<typeof router\.prefetch>\[1\]\) => \{ if \(!enElOnboarding\(window\.location\.pathname\)\) router\.prefetch/);
  // Y los otros saltos a la app ya son enteros: «Tu onboarding ya está listo» (<a href>) y «Sí, reiniciar» (location.assign).
  assert.match(sinComentarios(leer('app/_components/ReiniciarOnboarding.tsx')), /window\.location\.assign\(conWs\('\/onboarding', ws\)\)/);
});
