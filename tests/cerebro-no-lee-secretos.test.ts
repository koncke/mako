// =============================================================================
// El Second Brain no puede alcanzar las credenciales del cliente (7/11/2026)
// =============================================================================
// EL PEDIDO: «el Second Brain tiene que tomar **absolutamente todos** los datos del cliente». La forma obvia
// de cumplirlo es recorrer `lib/tablas-de-inquilino.ts` —lo que ES de cada negocio— y leer todo.
//
// ⚠️ Esa lista incluye `credenciales`. Cumplir el pedido literal mete las claves API de un negocio en el
// prompt de un modelo, y `valor_enc` es AES-256-GCM que esta misma app descifra: «va cifrado» no protege.
//
// Medido el 7/11 recorriendo los imports del cerebro (3 saltos, 198 archivos): alcanza **46 de 187** tablas
// del cliente, el 25 %, y **ninguna** de las prohibidas. Este test es lo que lo mantiene así — y falla en el
// momento exacto en que alguien cablee la lectura completa sin filtrar.
//
// Correr: node --import tsx --test tests/cerebro-no-lee-secretos.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { NUNCA_LEE, TABLAS_PROHIBIDAS, puedeEntrarAlCerebro, porQueNoEntra } from '../lib/cerebro-nunca-lee';

const RAIZ = join(import.meta.dirname, '..');
const ENTRADA = 'lib/cerebro-grafo.ts';
const SALTOS = 3;

const leer = (p: string): string => { try { return readFileSync(join(RAIZ, p), 'utf8'); } catch { return ''; } };

/** Un `import` relativo o con `@/` a una ruta de archivo real del repo. */
function resolver(desde: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = normalize(join(dirname(desde), spec)).replace(/\\/g, '/');
  else return null;
  for (const cand of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(join(RAIZ, cand))) return cand;
  }
  return null;
}

/**
 * Las tablas que alcanza el cerebro, siguiendo sus imports.
 *
 * ⚠️ Contar `.from(` SÓLO en `cerebro-grafo.ts` da 2, y es falso: el cerebro delega en ~22 lectores que viven
 * en otros módulos. Medirlo así habría dado «no lee credenciales» por el motivo equivocado —porque no lee
 * casi nada— y el test no serviría el día que alguien agregue el lector.
 */
function tablasQueAlcanza(): { tablas: Set<string>; archivos: number } {
  const vistos = new Set<string>();
  const tablas = new Set<string>();
  let frontera = [ENTRADA];
  for (let salto = 0; salto < SALTOS; salto++) {
    const siguiente: string[] = [];
    for (const f of frontera) {
      if (vistos.has(f)) continue;
      vistos.add(f);
      const src = leer(f);
      for (const m of src.matchAll(/\.from\(['"]([a-z_0-9]+)['"]\)/g)) tablas.add(m[1]);
      for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const r = resolver(f, m[1]);
        if (r && !vistos.has(r)) siguiente.push(r);
      }
    }
    frontera = siguiente;
  }
  return { tablas, archivos: vistos.size };
}

test('el recorrido lee algo: si no, los otros tests pasan por vacíos', () => {
  // Un verde construido sobre cero archivos es el peor resultado posible acá: diría «no toca credenciales»
  // porque no tocó nada. Primero se comprueba el denominador.
  const { tablas, archivos } = tablasQueAlcanza();
  assert.ok(archivos > 50, `sólo recorrí ${archivos} archivos desde ${ENTRADA}: ¿se movió el punto de entrada?`);
  assert.ok(tablas.size > 20, `sólo encontré ${tablas.size} tablas: el recorrido no está siguiendo los imports`);
});

test('⚠️ el Second Brain NO alcanza ninguna tabla de credenciales', () => {
  const { tablas } = tablasQueAlcanza();
  const tocadas = TABLAS_PROHIBIDAS.filter((t) => tablas.has(t));
  assert.deepEqual(tocadas, [],
    `el cerebro alcanza ${tocadas.map((t) => `«${t}» (${porQueNoEntra(t)})`).join(' · ')}. ` +
    'Cumplir «absolutamente todos los datos» recorriendo tablas-de-inquilino.ts mete las claves del cliente en un prompt.');
});

test('la lista prohibida sigue siendo de AUTENTICACIÓN, no de «datos sensibles»', () => {
  // ⚠️ La distinción decide si una tabla nueva va o no. Los mensajes de WhatsApp, las llamadas grabadas y los
  // emails también son sensibles y SÍ pueden entrar: son el contenido del negocio, que es lo que el cerebro
  // tiene que conocer. Si alguien mete una de ésas acá, el cerebro se queda sin la mitad de su material.
  for (const t of ['grupo_mensajes', 'llamadas_grabadas', 'email_mensajes', 'leads', 'ig_mensajes']) {
    assert.equal(puedeEntrarAlCerebro(t), true,
      `«${t}» quedó prohibida: es contenido del negocio, no material de autenticación — el cerebro lo necesita`);
  }
  // Y las que sí: cada una con su porqué escrito.
  for (const t of TABLAS_PROHIBIDAS) {
    assert.equal(puedeEntrarAlCerebro(t), false);
    assert.ok((porQueNoEntra(t) ?? '').length > 40, `«${t}» está prohibida sin explicar por qué`);
  }
});

test('las prohibidas existen de verdad: una lista con un nombre viejo no protege nada', () => {
  // Si una tabla se renombra y acá queda el nombre viejo, el guard sigue en verde y ya no cuida nada.
  const inquilino = leer('lib/tablas-de-inquilino.ts');
  for (const t of TABLAS_PROHIBIDAS) {
    assert.ok(inquilino.includes(`'${t}'`),
      `«${t}» está en la lista prohibida y NO figura en tablas-de-inquilino.ts: o se renombró, o el nombre está mal`);
  }
});

test('`credenciales` sigue siendo una tabla del cliente, que es lo que hace peligroso el pedido', () => {
  // Si algún día deja de estar en tablas-de-inquilino.ts, el riesgo cambia y este archivo hay que releerlo.
  assert.ok(leer('lib/tablas-de-inquilino.ts').includes("'credenciales'"),
    'credenciales salió de tablas-de-inquilino.ts: revisar si esta guarda sigue haciendo falta');
  assert.ok('credenciales' in NUNCA_LEE);
});
