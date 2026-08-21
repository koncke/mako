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

  // Una hora, fija. El dueño la bajó de 10 min a 60 el 12/8 después de verla
  // andando: seis mensajes por hora del mismo tema entierran el resto de los
  // avisos de MaKo en el mismo grupo. Lo que hace que funcione no es la
  // frecuencia, es que NO SE DETIENE — por eso el techo se testea igual.
  const cadencia = Number(/CADENCIA_MIN = (\d+)/.exec(src)?.[1] ?? '0');
  assert.ok(cadencia > 0, 'se perdió la cadencia');
  assert.ok(cadencia <= 60,
    `la insistencia bajó a cada ${cadencia} min: con la cuenta suspendida eso ya es silencio`);
});

test('Una cuenta publicitaria compartida se avisa UNA vez, no una por workspace', () => {
  const src = sinComentarios(leer('../lib/alerta-critica.ts'));
  // Al dueño le llegó dos veces en dos grupos: `Cliente de Prueba` tiene su
  // propia copia de las credenciales de Meta y apunta a la MISMA cuenta. Una
  // cuenta suspendida es UN problema.
  assert.ok(src.includes("credWs('META_AD_ACCOUNT_ID'"),
    'dejó de mirar de qué cuenta publicitaria se trata: vuelve a avisar una vez por workspace');
  assert.ok(/cuentasYaAvisadas/.test(src), 'se perdió el registro de cuentas ya avisadas de la corrida');

  // ⚠️ Y NO se resuelve excluyendo el workspace de prueba: un guard negativo se
  // queda viejo con el próximo cliente al que se le copien credenciales.
  assert.ok(!/!==\s*3\b|ws\s*===\s*3\b|OWNER_WS\s*!==/.test(src),
    'apareció un guard por número de workspace: el criterio es la cuenta, no quién es el cliente');

  // El corte va DESPUÉS de cerrar los resueltos: si no, un workspace que ya
  // venía insistiendo nunca podría decir «ya está» y quedaría colgado.
  const iCierre = src.indexOf("'meta-cuenta-recuperada'");
  const iCorte = src.indexOf('cuentaTomada');
  assert.ok(iCierre > 0 && iCorte > iCierre,
    'el corte por cuenta compartida quedó antes del cierre: la insistencia de ese workspace no se apaga nunca');
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

test('Y solo insiste lo que Meta CONFIRMÓ: no poder leer no es estar caída', () => {
  // El 21/8/2026 un cliente recibió cuatro mensajes diciéndole que su cuenta no
  // entregaba. Estaba Activa. El incidente decía «No se pudo leer el estado de
  // Meta» —un error nuestro de lectura— y entraba como severidad rojo, así que
  // la persecución no lo distinguía de una cuenta suspendida de verdad.
  const src = sinComentarios(leer('../lib/alerta-critica.ts'));
  assert.ok(/i\.confirmado\s*&&/.test(src),
    'esCritico dejó de exigir que el estado esté CONFIRMADO: vuelve a perseguir por un error de lectura');
  assert.ok(/select\([^)]*confirmado/.test(src),
    'el incidente se lee sin la columna confirmado: el guard queda siempre en undefined');

  // ⚠️ En POSITIVO. Descartar el statusLabel que hoy sabemos que salió mal
  // protege ESTE caso y deja pasar todos los que todavía no pasaron.
  assert.ok(!/No se pudo leer/.test(src),
    'apareció un guard contra el texto del error: el próximo error de lectura dirá otra cosa y entra igual');

  // Y lo que reconcilia tiene que ESCRIBIR el campo, o todo lo de arriba lee un default.
  const hist = sinComentarios(leer('../lib/meta-health-history.ts'));
  assert.ok(/confirmado: p\.confirmado/.test(hist), 'reconciliarIncidentes dejó de persistir `confirmado`');
  assert.ok(/severidad: 'ambar'[\s\S]{0,400}?confirmado: false/.test(hist),
    'el error de lectura volvió a registrarse como rojo confirmado');
});

test('El mensaje no afirma lo que Meta no confirmó', async () => {
  const { textoAlerta, causaDe } = await import('../lib/alerta-critica-texto');

  // 1. La ranura del titular solo acepta un ESTADO. Con un incidente sin
  //    confirmar salía, textual: «Tu cuenta publicitaria está *NO SE PUDO LEER
  //    EL ESTADO DE META*» — la gramática de la frase le prestaba autoridad a un
  //    mensaje de error.
  const sinConfirmar = {
    statusLabel: 'No se pudo leer el estado de Meta',
    disableReason: null,
    entregaFrenada: false,
    confirmado: false,
  };
  const c = causaDe(sinConfirmar);
  assert.ok(!/está \*NO SE PUDO/.test(c.titular),
    'el titular volvió a meter el mensaje de error en la ranura del estado');
  assert.match(c.titular, /no puede leer el estado/i, 'el titular tiene que decir que el problema es la LECTURA');

  // 2. Las afirmaciones sobre leads cuelgan de entrega_frenada, TODAS. La regla
  //    estaba escrita en el módulo y aplicada a una sola de las cuatro.
  const t = textoAlerta(sinConfirmar, 205, 3, 'https://x/integraciones');
  assert.ok(!/SIN ENTREGAR/.test(t), 'el contador sigue afirmando que la cuenta no entrega');
  assert.ok(!/sin recibir un solo lead/.test(t), 'sigue afirmando que no entran leads sin que Meta lo confirme');
  assert.ok(!/leads perdido/.test(t), 'la escalada de las 6 h sigue afirmando leads perdidos');

  const primero = textoAlerta(sinConfirmar, 20, 0, 'https://x/integraciones');
  assert.ok(!/No entra \*ningún\* lead nuevo/.test(primero),
    'el primer mensaje sigue afirmando que no entra ningún lead');

  // 3. Y cuando Meta SÍ lo confirma, se sigue diciendo con todas las letras: el
  //    arreglo no puede haber apagado la alerta que este módulo vino a hacer.
  const frenada = { statusLabel: 'Saldo impago', disableReason: null, entregaFrenada: true, confirmado: true };
  const tf = textoAlerta(frenada, 205, 3, 'https://x/integraciones');
  assert.match(tf, /SIN ENTREGAR/, 'se perdió el contador de la cuenta realmente frenada');
  assert.match(tf, /sin recibir un solo lead/, 'se perdió la consecuencia de la cuenta realmente frenada');
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
