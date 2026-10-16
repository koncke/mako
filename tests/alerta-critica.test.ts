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
  // (16/10/2026: por el EVENTO de la plataforma, con los HECHOS del incidente; el texto y el techo son de la automatización
  // de SuperAdmin, abajo. Hasta ese día, `emitirAviso` directo y sin techo: el «18ª vez» del grupo de Mauricio. Rotura:
  // volver a `emitirAviso(` → 39 / 1, cae éste.)
  // (Y por `emitirEventoDePlataforma`, que dice cuántas tarjetas LLEGARON: la marca la arma `marcaTrasEmitir`, abajo.)
  assert.match(src, /emitirEventoDePlataforma\('meta-cuenta-frenada', \{\s*ws,\s*datos: datosCuentaFrenada\(/, 'dejó de emitir el evento');
  assert.match(src, /const marca = marcaTrasEmitir\(estado, inc\.status_label, res, new Date\(\)\.toISOString\(\)\);\s*if \(marca\) \{\s*await setSetting\(key, JSON\.stringify\(marca\)\)/, 'la marca dejó de salir de `marcaTrasEmitir`');
  assert.ok(!/emitirAviso\(/.test(src), 'volvió el envío directo, sin automatización');

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

// ── DESDE EL 16/10/2026 EL TEXTO ES EL DE LA AUTOMATIZACIÓN DE SUPERADMIN (docs/inventario-nada-por-detras.md, lote 1) ──
// Las reglas que estos tests cuidaban sobre `textoAlerta` (que se borró: era el camino por detrás) siguen, ahora sobre la
// fila: lo que sale es la tarjeta de su estado con los datos del incidente (`datosCuentaFrenada`), por el MISMO runner.
// Probado rompiéndolo (16/10/2026, scratchpad romper-b2b3.mjs, base 40 de 40 junto con tests/dato-evento.test.ts y
// tests/aviso-evento.test.ts): los números van en cada test.

/** Corre la plantilla con los datos de un incidente, paso por paso como el runner: el texto que sale, o null si no sale nada. */
async function loQueSale(i: { statusLabel: string | null; disableReason: string | null; entregaFrenada: boolean; confirmado?: boolean }, minAbierto: number, veces: number): Promise<string | null> {
  const { plantillaPorId, pasosDePlantilla } = await import('../lib/plantillas-automatizaciones');
  const { pasosDelEvento } = await import('../lib/aviso-evento');
  const { decidir } = await import('../lib/flujo-pasos');
  const { hechosDelEvento } = await import('../lib/dato-evento');
  const { datosCuentaFrenada } = await import('../lib/alerta-critica-texto');
  const { textoConDatos } = await import('../lib/variables-del-lead');
  const { normalizar } = await import('../lib/flujo-grafo');
  const t = pasosDelEvento(normalizar(pasosDePlantilla(plantillaPorId('mako-meta-cuenta-frenada')!)), 'meta_cuenta_frenada');
  assert.equal(t.problema, null, `la plantilla no corre: ${t.problema}`);
  const datos = { ...datosCuentaFrenada(i, minAbierto, veces), link_integraciones: 'https://x/integraciones' };
  const hechos = hechosDelEvento(datos, Date.now());
  const ahora = new Date();
  let paso = 0;
  for (let vuelta = 0; vuelta < 60; vuelta++) {
    const d = decidir(t.pasos, { paso, desde: ahora, respondioAt: null, ahora, hechos });
    if (d.que === 'terminar') return null;
    if (d.que === 'ejecutar') {
      const p = d.paso as { tipo: string; texto?: string; partes?: Array<{ cuerpo?: string }> };
      return textoConDatos(String(p.partes?.[0]?.cuerpo ?? p.texto ?? ''), datos);
    }
    if (d.que !== 'saltar') throw new Error('la fila esperó: no tiene DELAY');
    paso = d.siguiente;
  }
  throw new Error('la fila dio más vueltas que pasos');
}

// Roturas, 39 / 1 cada una, cae éste: la tarjeta de «Saldo impago» sin su «qué hacer»; «Anuncios: sin entregar» fijo en la
// tarjeta; el motivo de Meta pasado aunque repita el estado; «sin entregar» sin que Meta lo confirme.
test('la alerta dice la CAUSA de cada estado, y lo que Meta no confirmó no lo afirma', async () => {
  // Pedido del dueño (12/8): «que diga "tu cuenta publicitaria está SUSPENDIDA por falta de pago", no simplemente que
  // está frenada». No es estilo: con el síntoma no se sabe qué hacer, con la causa sí.
  const impago = await loQueSale({ statusLabel: 'Saldo impago', disableReason: 'Saldo impago', entregaFrenada: true, confirmado: true }, 35, 0);
  assert.match(impago!, /^🚨 Tu cuenta publicitaria está \*SUSPENDIDA POR FALTA DE PAGO\*\n/);
  assert.match(impago!, /\n✅ Paga el saldo que debes en el Business Manager de Meta\.\n/, 'urge sin decir qué hacer, que es sólo ansiedad');
  assert.match(impago!, /\n📉 Anuncios: sin entregar\n🕐 Hace 35 min que está así\.\n/);
  assert.match(impago!, /\n👉 https:\/\/x\/integraciones\n\n— MaKo$/);
  assert.ok(!/Motivo de Meta/.test(impago!), 'repite el mismo dato dos veces');
  // «Sin entregar» es un HECHO que Meta confirma (`entrega_frenada`): sin él, no se afirma.
  const gracia = await loQueSale({ statusLabel: 'En período de gracia', disableReason: 'Riesgo de pago', entregaFrenada: false, confirmado: true }, 400, 1);
  assert.match(gracia!, /EN PERÍODO DE GRACIA/);
  assert.match(gracia!, /📉 Anuncios: entregando/);
  assert.ok(!/sin entregar/.test(gracia!), 'afirma que no entrega sin que Meta lo confirme');
  assert.match(gracia!, /⚠️ Motivo de Meta: Riesgo de pago/);
  assert.match(gracia!, /Hace 6 h 40 min que está así/);
  // Un estado sin causa conocida: lo dice tal cual y NO inventa qué hacer.
  const otro = await loQueSale({ statusLabel: 'Cerrada (cualquiera)', disableReason: null, entregaFrenada: true, confirmado: true }, 20, 0);
  assert.match(otro!, /^🚨 \*Tu cuenta publicitaria tiene un problema\*\n📋 Estado en Meta: Cerrada \(cualquiera\)\n/);
  assert.ok(!/✅/.test(otro!), 'inventó qué hacer para un estado que no conoce');
});

// Rotura: el techo en ≤ 30 → 38 / 2, caen éste y el 6 de tests/dato-evento.test.ts.
test('⚠️ EL TECHO: avisa hasta la 3ª vez y después la fila no manda nada (el «18ª vez» del grupo de Mauricio)', async () => {
  const inc = { statusLabel: 'Saldo impago', disableReason: null, entregaFrenada: true, confirmado: true };
  for (const veces of [0, 1, 2]) assert.ok(await loQueSale(inc, 60 * (veces + 1), veces), `el aviso ${veces + 1} no salió`);
  for (const veces of [3, 17, 20]) assert.equal(await loQueSale(inc, 60 * (veces + 1), veces), null, `el aviso ${veces + 1} salió`);
});

// Rotura: un estado de la fila que Meta no tiene («Clausurada») → 39 / 1, cae éste.
test('los estados de la fila son los de Meta: ninguno inventado, y las opciones de la CONDITION son las mismas', async () => {
  // Las salidas de la CONDITION son valores de ACCOUNT_STATUS (lib/meta-health.ts). Si allá renombran un estado, su
  // salida no se elige nunca y cae al «Si no» SIN dejar rastro: un titular genérico que suena exacto es peor.
  const health = leer('../lib/meta-health.ts');
  const bloque = health.slice(health.indexOf('const ACCOUNT_STATUS'), health.indexOf('export function accountStatusLabel'));
  const estados = [...bloque.matchAll(/^\s*\d+:\s*'([^']+)'/gm)].map((m) => m[1]);
  assert.ok(estados.length > 5, `no se pudo leer ACCOUNT_STATUS (${estados.length})`);
  const { ESTADOS_CUENTA_META } = await import('../lib/variables-aviso');
  assert.deepEqual([...ESTADOS_CUENTA_META].sort(), estados.filter((e) => !/^Activa/.test(e)).sort(),
    'las opciones de «Estado de la cuenta es» no son los estados de Meta');
  const { plantillaPorId, pasosDePlantilla } = await import('../lib/plantillas-automatizaciones');
  const pasos = pasosDePlantilla(plantillaPorId('mako-meta-cuenta-frenada')!) as unknown as Array<{ id: string; ramas?: Array<{ filas: Array<{ valor?: unknown }> }> }>;
  const deLaFila = pasos.find((p) => p.id === 'mf_estado')!.ramas!.map((r) => String(r.filas[0].valor));
  const huerfanos = deLaFila.filter((e) => !estados.includes(e));
  assert.deepEqual(huerfanos, [], `estos estados ya no existen en ACCOUNT_STATUS y su salida nunca se elige: ${huerfanos.join(', ')}`);
  // Los que no son «Activa» y no tienen salida propia caen al «Si no» (sin qué hacer). No es un error, pero tiene que verse.
  assert.deepEqual(estados.filter((e) => !/^Activa/.test(e) && !deLaFila.includes(e)), ['Cerrada (cualquiera)'],
    'cambió la lista de estados sin explicación: sumalos a la fila o actualizá este test a sabiendas');
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

// ── LA REVISIÓN DE B3 (16/10/2026): qué cuenta como un aviso, por estado, y el «ya está» ──────────────────────────────
// Probado rompiéndolo (scratchpad romper-b3r.mjs, con tests/dato-evento.test.ts y tests/aviso-evento.test.ts: base 43 de 43).
// Roturas, 42 / 1 cada una, cae éste: `marcaTrasEmitir` sumando sin mirar lo que llegó; `vecesDelEstado` sin mirar el estado.
test('⚠️ el techo cuenta los avisos que LLEGARON, de cada estado; sin poder emitir no se escribe nada', async () => {
  const { vecesDelEstado, marcaTrasEmitir } = await import('../lib/alerta-critica-texto');
  const T = '2026-10-16T12:00:00.000Z';
  // Sin poder emitir (no se leyeron las automatizaciones): nada, y el próximo tick reintenta.
  assert.equal(marcaTrasEmitir(null, 'Saldo impago', { ok: false }, T), null);
  // Emitido y llegó: suma. Emitido sin llegar (sin automatización, sin grupo, la línea caída): anota la hora y NO gasta el techo.
  assert.deepEqual(marcaTrasEmitir(null, 'Saldo impago', { ok: true, llegaron: 1 }, T), { ultimaIso: T, veces: 1, estado: 'Saldo impago' });
  assert.deepEqual(marcaTrasEmitir({ ultimaIso: 'x', veces: 2, estado: 'Saldo impago' }, 'Saldo impago', { ok: true, llegaron: 0 }, T), { ultimaIso: T, veces: 2, estado: 'Saldo impago' });
  assert.deepEqual(marcaTrasEmitir({ ultimaIso: 'x', veces: 2, estado: 'Saldo impago' }, 'Saldo impago', { ok: true }, T), { ultimaIso: T, veces: 2, estado: 'Saldo impago' }, 'sin `llegaron`, cero');
  // Un estado NUEVO vuelve a contar (el empeoramiento se avisa); una marca de antes, sin estado, es el mismo estado: el
  // incidente que ya pasó el techo (Mauricio, 25 avisos el 16/10) no vuelve a salir.
  assert.equal(vecesDelEstado({ ultimaIso: 'x', veces: 3, estado: 'En período de gracia' }, 'Pendiente de cierre'), 0);
  assert.deepEqual(marcaTrasEmitir({ ultimaIso: 'x', veces: 3, estado: 'En período de gracia' }, 'Pendiente de cierre', { ok: true, llegaron: 1 }, T), { ultimaIso: T, veces: 1, estado: 'Pendiente de cierre' });
  assert.equal(vecesDelEstado({ ultimaIso: 'x', veces: 25 }, 'Saldo impago'), 25);
  assert.equal(vecesDelEstado(null, 'Saldo impago'), 0);
  // Y el cron le pasa al evento el número del ESTADO de ahora.
  const src = sinComentarios(leer('../lib/alerta-critica.ts'));
  assert.match(src, /const veces = vecesDelEstado\(estado, inc\.status_label\);/);
});

// Rotura: sin poder emitir, borrar la marca igual → 42 / 1, cae éste.
test('⚠️ el «ya está» sale ANTES de borrar la marca, y sólo si llegó alguna alerta', () => {
  const src = sinComentarios(leer('../lib/alerta-critica.ts'));
  const cierre = src.slice(src.indexOf('if (!marca) continue;'), src.indexOf('out.resueltos += 1;'));
  const iEmite = cierre.indexOf("emitirEventoDePlataforma('meta-cuenta-recuperada'");
  assert.ok(iEmite > 0 && iEmite < cierre.indexOf("setSetting(key, '')"), 'la marca se borra antes de decir «ya está»: sin poder emitir, se pierde');
  assert.match(cierre, /if \(!r\.ok\) \{ out\.errores \+= 1; continue; \}/, 'sin poder emitir, la marca tiene que quedar');
  assert.match(cierre, /if \(c\.service === 'meta' && llegaronAlertas\) \{/, '«ya está» de algo que nunca llegó');
});
