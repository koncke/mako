// =============================================================================
// El mensaje de "la IA no pudo" tiene que decir la VERDAD, y vivir en un solo lado
// =============================================================================
// Caso real: una clienta con TRES cuentas de Gemini conectadas vio «No hay IA para
// generar las razones. Conecta tu API key de Gemini (gratis) en Integraciones.» Las
// dos mitades de la frase eran falsas. Lo que falló no fue el análisis —dos de los
// cuatro call-sites YA distinguían «no hay key» de «hay key y falló»— sino que la
// corrección se aplicó a mano y quedó a mitad de camino.
//
// Por eso la guarda de abajo: mientras la frase se pueda escribir en cualquier
// archivo, en algún archivo va a quedar la versión que miente.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { FRASE_PROHIBIDA, mensajeIAFallo, resumirErrores } from '../lib/ia-mensajes';

test('sin ninguna IA conectada: pedir una key es la respuesta correcta', () => {
  const m = mensajeIAFallo({ hayIA: false, motivo: null, tema: 'generar las razones' });
  assert.match(m, /No hay ninguna IA conectada/);
  assert.match(m, /generar las razones/);
});

test('CON IA conectada NUNCA dice que no hay IA — es el bug que originó esto', () => {
  const casos = [
    { hayIA: true, motivo: 'Se quedó sin cuota / límite de uso alcanzado por ahora.', errores: ['gemini · cuenta 1: HTTP 429'] },
    { hayIA: true, motivo: 'La API key parece inválida o vencida.', errores: ['gemini: 401'] },
    { hayIA: true, motivo: null, errores: ['gemini · cuenta 2: HTTP 503 high demand'] },
    { hayIA: true, motivo: null, errores: [] },
  ];
  for (const c of casos) {
    const m = mensajeIAFallo({ ...c, tema: 'generar las razones' });
    assert.doesNotMatch(m, /No hay ninguna IA/, `dijo "no hay IA" con IA conectada: ${m}`);
    assert.doesNotMatch(m, new RegExp(FRASE_PROHIBIDA, 'i'), `mandó a pegar una key de Gemini: ${m}`);
  }
});

test('la salida propuesta coincide con la causa', () => {
  const cuota = mensajeIAFallo({ hayIA: true, motivo: 'Se quedó sin cuota / límite de uso alcanzado por ahora.', tema: 'x' });
  // A una cuota agotada la arregla esperar o sumar otra cuenta, NO pegar otra key igual.
  assert.match(cuota, /reinicie|otra cuenta|otra IA/i);
  const vencida = mensajeIAFallo({ hayIA: true, motivo: 'La API key parece inválida o vencida.', tema: 'x' });
  // A una key vencida NO la arregla esperar.
  assert.match(vencida, /Pegá una nueva/);
  assert.doesNotMatch(vencida, /reinicie/i);
});

test('el detalle dice QUÉ contestó cada cuenta (sin eso, la captura no sirve)', () => {
  const m = mensajeIAFallo({
    hayIA: true, motivo: null, tema: 'x',
    errores: ['gemini · cuenta 1: chatCheap(gemini · cuenta 1): HTTP 503 high demand', 'gemini · cuenta 2: HTTP 429 quota'],
  });
  assert.match(m, /cuenta 1/);
  assert.match(m, /cuenta 2/);
  assert.match(m, /503/);
});

test('resumirErrores no repite, corta y saca el prefijo redundante', () => {
  const r = resumirErrores(['gemini: chatCheap(gemini): HTTP 503', 'gemini: chatCheap(gemini): HTTP 503', 'groq: HTTP 413', 'mistral: x', 'openai: y']);
  assert.doesNotMatch(r, /chatCheap/);
  assert.equal(r.split(' · ').length, 3, `debería quedarse con 3: ${r}`);
  assert.match(r, /\+\d+ más/);
});

/** Todo el código de lib/ y app/ (sin tests), para buscar el literal de verdad. */
function fuentes(): Array<{ ruta: string; texto: string }> {
  const raiz = new URL('../', import.meta.url);
  const out: Array<{ ruta: string; texto: string }> = [];
  const rec = (dir: URL, rel: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
      const hijo = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, dir);
      if (e.isDirectory()) rec(hijo, `${rel}${e.name}/`);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        // CRLF normalizado: en Windows, si no, los cortes por '\n' no encuentran nada.
        out.push({ ruta: `${rel}${e.name}`, texto: readFileSync(hijo, 'utf8').replace(/\r\n/g, '\n') });
      }
    }
  };
  rec(new URL('lib/', raiz), 'lib/');
  rec(new URL('app/', raiz), 'app/');
  return out;
}

test('GUARDA: «Conecta tu API key de Gemini» solo puede vivir en lib/ia-mensajes.ts', () => {
  const culpables = fuentes()
    .filter((f) => f.ruta !== 'lib/ia-mensajes.ts')
    // Se busca en el CÓDIGO, no en los comentarios: esta misma frase se cita en
    // varios comentarios para explicar el bug, y eso está bien.
    .filter((f) => f.texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').includes(FRASE_PROHIBIDA))
    .map((f) => f.ruta);
  assert.deepEqual(culpables, [],
    `Estos archivos escriben el mensaje a mano y van a quedar viejos: ${culpables.join(', ')}. Usá errorDeCascada(errores, tema).`);
});

test('GUARDA: si el vacío de la cascada se convierte en un MENSAJE, hay que pedir erroresOut', () => {
  // El corte no es "mira el vacío" sino "le habla al usuario". Devolver '' y caer a
  // un default seguro (`return base`, `no_se`) es legítimo y no necesita el detalle:
  // nadie lee nada. Lo que no se puede es ESCRIBIR UN MOTIVO sin haberlo pedido —
  // ahí es donde sale una frase inventada, que es lo que pasó en `generarRazones`.
  const malos: string[] = [];
  for (const f of fuentes()) {
    const codigo = f.texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // Cada llamada a la cascada, desde `chatCheapCascade({` hasta su `})`.
    for (const m of codigo.matchAll(/chatCheapCascade\(\{[\s\S]*?\n\s*\}\)/g)) {
      const despues = codigo.slice(m.index + m[0].length, m.index + m[0].length + 400);
      const leElHabla = /if\s*\(!\s*\w+(\.trim\(\))?\s*\)[^\n]*\berror:/.test(despues);
      if (leElHabla && !m[0].includes('erroresOut')) malos.push(f.ruta);
    }
  }
  assert.deepEqual([...new Set(malos)], [],
    `Estos le explican al usuario por qué falló la IA sin haber pedido los errores: ${[...new Set(malos)].join(', ')}`);
});
