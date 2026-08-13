// =============================================================================
// La alerta que no se calla: que exista, que insista, y que sepa parar
// =============================================================================
// El 12/8 la cuenta de Meta del dueño estaba con ENTREGA FRENADA y por WhatsApp
// no llegó nada. La causa no era sutil: los cuatro avisos de Meta del catálogo
// NUNCA tuvieron un call-site. El primer test de acá es exactamente ese grep,
// para que un aviso no pueda volver a existir solo como texto.
//
// Y no fue la primera vez: en service_incidents hay un episodio del 16/7 que
// estuvo DOS DÍAS frenado y otro del 29/7 de cuatro horas. Ninguno avisó.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

/** Saca comentarios, para poder afirmar sobre el CÓDIGO y no sobre su prosa. */
const sinComentarios = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Todo el código de lib/ y app/, para buscar call-sites de verdad. */
function fuenteCompleta(): string {
  const raiz = new URL('../', import.meta.url);
  const out: string[] = [];
  const rec = (dir: URL, prof = 0) => {
    if (prof > 6) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git' || e.name === 'docs') continue;
      const hijo = new URL(`${e.name}${e.isDirectory() ? '/' : ''}`, dir);
      if (e.isDirectory()) rec(hijo, prof + 1);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(readFileSync(hijo, 'utf8'));
    }
  };
  rec(new URL('lib/', raiz));
  rec(new URL('app/', raiz));
  return out.join('\n');
}

test('Un aviso CRÍTICO del catálogo tiene que tener quién lo emita', () => {
  // La regla: si `yaImplementado: 'si'` y es rojo, su id aparece en algún lado
  // fuera del catálogo. Sin esto, «implementado» es una promesa del catálogo
  // sobre sí mismo — que es lo que pasó con los cuatro avisos de Meta.
  const catalogo = leer('../lib/avisos-catalogo.ts');
  const src = fuenteCompleta().replace(catalogo, '');

  const filas = [...catalogo.matchAll(/id: '([a-z0-9-]+)'[\s\S]{0,200}?semaforo: '(\w+)'[\s\S]{0,120}?yaImplementado: '(\w+)'/g)];
  assert.ok(filas.length > 20, `no se pudieron leer las filas del catálogo (${filas.length})`);

  const huerfanos = filas
    .filter(([, , semaforo, impl]) => semaforo === 'rojo' && impl === 'si')
    .map(([, id]) => id)
    .filter((id) => !src.includes(`'${id}'`));

  assert.deepEqual(huerfanos, [],
    `estos avisos se declaran implementados y nadie los emite: ${huerfanos.join(', ')}`);
});

test('La entrega frenada INSISTE, y la insistencia no se apoya en el dedup', () => {
  // Sin comentarios: el módulo EXPLICA por qué no usa dedup, así que buscarlo
  // sobre el texto crudo se dispara contra su propia explicación.
  const src = sinComentarios(leer('../lib/alerta-critica.ts'));
  // El motor de avisos está hecho para NO repetirse. Acá hace falta lo contrario:
  // si alguien "arregla" esto agregando dedupTtlMin, la alerta se calla sola.
  assert.ok(!/dedupTtlMin/.test(src),
    'la alerta crítica volvió a usar dedupTtlMin: eso es exactamente lo que la silencia');
  assert.ok(src.includes('emitirAviso('),
    'dejó de emitir por el choke point');

  // La cadencia nunca puede aflojar más allá de la media hora: el pedido del
  // dueño fue «frecuencia MUY alta hasta que se solucione».
  const cadencias = [...src.matchAll(/cadaMin:\s*(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(cadencias.length >= 2, 'se perdió la tabla de cadencia');
  assert.ok(Math.max(...cadencias) <= 30,
    `la insistencia bajó a cada ${Math.max(...cadencias)} min: con la entrega frenada eso es silencio`);
  assert.ok(Math.min(...cadencias) <= 10, 'la primera hora dejó de ser agresiva');
});

test('Insistir sin saber parar es peor: al resolverse, avisa y limpia', () => {
  const src = leer('../lib/alerta-critica.ts');
  assert.ok(src.includes("'meta-cuenta-recuperada'"),
    'MaKo persigue veinte veces y después se calla sin decir que se resolvió');
  // Y el estado se limpia, o el próximo incidente arranca con el contador viejo.
  assert.ok(/setSetting\(key, ''\)/.test(src), 'no se limpia la marca de insistencia al cerrar');
});

test('Solo insiste lo que cuesta plata AHORA', () => {
  const src = leer('../lib/alerta-critica.ts');
  assert.ok(/entrega_frenada \|\| .*severidad === 'rojo'/.test(src),
    'el filtro de qué es crítico cambió: si todo insiste, la insistencia deja de significar algo');
});

test('El mensaje dice la CAUSA, no el síntoma', async () => {
  const { textoAlerta } = await import('../lib/alerta-critica-texto');
  // Pedido del dueño: «que diga "tu cuenta publicitaria está SUSPENDIDA por
  // falta de pago", no simplemente que está frenada». No es estilo: con el
  // síntoma no se sabe qué hacer, con la causa sí.
  const real = { statusLabel: 'Saldo impago', disableReason: 'Saldo impago', entregaFrenada: true };
  const t = textoAlerta(real, 35, 0, 'https://x/integraciones');
  assert.match(t, /SUSPENDIDA POR FALTA DE PAGO/, 'el titular volvió a describir el síntoma');
  assert.match(t, /QUÉ HACER:[\s\S]*Business Manager/, 'el mensaje urge sin decir qué hacer, que es solo ansiedad');
  // Y el motivo no se repite cuando es igual al estado.
  assert.ok(!/Motivo de Meta: \*Saldo impago\*/.test(t), 'repite el mismo dato dos veces');
});

test('El catálogo de causas no se puede quedar viejo', async () => {
  // Las claves de CAUSA son valores de ACCOUNT_STATUS (lib/meta-health.ts). Si
  // allá renombran un estado, acá el titular cae al genérico SIN dejar rastro —
  // y un titular genérico que suena exacto es peor que uno que se ve genérico.
  const { ESTADOS_CON_CAUSA } = await import('../lib/alerta-critica-texto');
  const health = leer('../lib/meta-health.ts');
  const bloque = health.slice(health.indexOf('const ACCOUNT_STATUS'), health.indexOf('export function accountStatusLabel'));
  const estados = [...bloque.matchAll(/^\s*\d+:\s*'([^']+)'/gm)].map((m) => m[1]);
  assert.ok(estados.length > 5, `no se pudo leer ACCOUNT_STATUS (${estados.length})`);

  const huerfanos = ESTADOS_CON_CAUSA.filter((e) => !estados.includes(e));
  assert.deepEqual(huerfanos, [],
    `estos estados ya no existen en ACCOUNT_STATUS y su titular nunca se va a usar: ${huerfanos.join(', ')}`);

  // Los estados que NO son «Activa» y no tienen causa: se avisan sin decir qué
  // hacer. No es un error —el default es honesto— pero tiene que verse.
  const sinCausa = estados.filter((e) => !/^Activa/.test(e) && !ESTADOS_CON_CAUSA.includes(e));
  assert.deepEqual(sinCausa, ['Cerrada (cualquiera)'],
    `cambió la lista de estados sin explicación: ${sinCausa.join(', ')}. Sumalos a CAUSA o actualizá este test a sabiendas.`);
});

test('El cron mira seguido, no una vez por hora', () => {
  const vercel = JSON.parse(leer('../vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  const cron = vercel.crons.find((c) => c.path === '/api/cron/alerta-critica');
  assert.ok(cron, 'el cron de la alerta crítica no está registrado en vercel.json');
  assert.match(cron!.schedule, /^\*\/(\d+) \* \* \* \*$/,
    `la alerta crítica corre con schedule «${cron!.schedule}»: tiene que ser cada N minutos`);
  const cada = Number(/^\*\/(\d+)/.exec(cron!.schedule)![1]);
  assert.ok(cada <= 15, `corre cada ${cada} min: demasiado lento para una cuenta frenada`);

  // Y REFRESCA el estado: antes la detección vivía solo en el cron horario, así
  // que entre que la cuenta se frenaba y quedaba registrada pasaba una hora.
  const route = leer('../app/api/cron/alerta-critica/route.ts');
  assert.ok(route.includes('registrarEstadoMeta('),
    'el cron dejó de refrescar el estado de Meta: volvería a detectar recién una hora después');
});
