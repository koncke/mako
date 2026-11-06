// =============================================================================
// carruseles-biblioteca — llenar la biblioteca de carruseles de ejemplo de Image, desde la PC (4/11/2026)
// =============================================================================
// Pedido de Martín (por el Cerebro): que el explorador de carruseles arranque con una base real de ejemplos. La nube no
// llega a Apify ni a la base, así que la lectura corre acá, en la PC, con el .env.local del clon (PRODUCCIÓN).
//
// De dónde: Instagram directo, con la MISMA lectura de Spy (el actor `apify~instagram-scraper` y `piezasDeApify`) y la
// clave de Spy del negocio de la PLATAFORMA (`APIFY_INSTAGRAM_TOKEN` de `wsSuperAdmin`). Nunca de topcarousels.com.
// Lo puro (qué leer, cuánto puede costar, qué se guarda): lib/carruseles/biblioteca.ts. La base: lib/carruseles/biblioteca-servidor.ts.
//
// ⚠️ EN SECO POR DEFECTO. `leer` sin `--de-verdad` dice qué leería y cuánto podría gastar, y no gasta ni escribe nada.
// ⚠️ ANTES DE GASTAR mira dos cosas y frena sin romper nada si falta una: que la 0392 esté aplicada (sin sus tablas no hay
//    dónde guardar) y cuánto crédito del mes le queda a la clave de Apify. Esa clave es la de Spy (un plan gratis de US$5 al
//    mes): se deja libre la reserva de Spy (`RESERVA_CREDITO_USD`) y el techo de la corrida es el menor entre lo pedido y lo
//    que queda. Cada corrida de Apify lleva además su propio techo (`maxTotalChargeUsd`).
// ⚠️ CUANDO PARA, DICE POR QUÉ, CON EL NÚMERO (6/11/2026). «Al techo» a secas no distingue «no hay crédito» (lo destraba
//    cargar crédito) de «llegué al tope que me pediste» (lo destraba `--techo-usd`) de «se terminaron las tandas» (nada que
//    hacer). El porqué sale de `motivoDelTecho` + `porQueParo` (lib/carruseles/biblioteca.ts) y se dice también EN SECO.
// ⚠️ NUNCA IMPRIME UNA CLAVE: dice cuántas claves de Spy hay, su número, el nombre que les puso la persona y su crédito.
// ⚠️ VARIAS CLAVES (5/11/2026, Martín: «Dame la opción de tener varias claves de apify»): se cuenta el crédito libre de TODAS
//    (la reserva de Spy sale del total), cada corrida va con la primera que tenga crédito y, si una se agota a mitad, sigue con
//    la siguiente (lib/spy-claves.ts). Un error que no es de crédito no salta de clave: se dice.
//
// Uso (desde la raíz del clon):
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts <comando> [opciones]
//
// Comandos:
//   estado                       Lo que hay (tablas, cuentas, temas, publicaciones) y el crédito de Apify. No gasta ni escribe.
//   leer [opciones]              En seco: el plan y su costo máximo. Con --de-verdad: lee y guarda.
//        --techo-usd 2           Lo más que puede gastar la corrida (por defecto 2).
//        --max-carruseles 300    Cuántos carruseles guardar como mucho (por defecto 300).
//        --por-cuenta 40 --por-tema 30   Cuántas publicaciones pedir a cada fuente (un tema devuelve 15 a 30: medido el 4/11).
//        El plan en seco dice lo ESPERADO con lo medido en la primera carga; `--max-carruseles` es un techo, no una promesa.
//        --solo @cuenta | --solo '#tema'   Sólo esa fuente (aunque se haya leído hace poco). El # va entre comillas: en la
//                                         consola, una palabra que empieza con # es un comentario.
//        --solo-temas | --solo-cuentas
//   buscar [--techo-usd 0.5]     Busca en Instagram, por su nombre, a los referentes del Ops Center que no están en la lista
//                                y muestra los candidatos. No escribe nada: el bueno se suma con `sumar`.
//   verificar @a [@b …] [--referente id | --nombre "Nombre"]   Lee esos perfiles (unos US$0,003 cada uno) y dice si son de
//                                quien se cree: nombre, verificada, seguidores y publicaciones. No escribe nada.
//   reclasificar [--de-verdad]   Vuelve a clasificar lo guardado con su texto (el tipo, el cierre, si parece contenido y,
//                                con la 0404, el CTA «Comenta X palabra»). GRATIS: no le pide nada a Apify. Sólo llena lo
//                                que falta. En seco por defecto: dice cuántos piden una palabra y muestra unos de cada lado.
//   laminas [--de-verdad] [--techo-usd 1] [--max 400]   (6/11/2026, 0404) Las imágenes de cada lámina de los carruseles que
//                                no las tienen: lee cada publicación POR SU LINK (de a 40, ~US$0,0027 cada una: la receta de
//                                docs/hallazgos-carruseles.md) y las baja a nuestro bucket. En seco dice cuántas, cuánto, en
//                                cuántas tandas y, si no entran todas, POR QUÉ (crédito, tu tope, o nada que leer).
//   sumar @usuario --nombre "Nombre" [--referente id]   Suma una cuenta a la lista (confírmala antes con `verificar`).
//   sacar @usuario --motivo "Lo pidió"                  Saca a un creador: sus carruseles dejan de verse en todos lados.
//   tema '#hashtag' --nombre "Nombre"                   Suma un tema (el # entre comillas, o sin el #).
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)

const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);

type Args = { comando: string; posicional: string | null; posicionales: string[]; op: Map<string, string | true> };
function leerArgs(argv: string[]): Args {
  const op = new Map<string, string | true>();
  let comando = 'estado';
  let posicional: string | null = null;
  const posicionales: string[] = [];
  const xs = argv.slice(2);
  for (let i = 0; i < xs.length; i += 1) {
    const a = xs[i];
    if (a.startsWith('--')) {
      const sig = xs[i + 1];
      if (sig != null && !sig.startsWith('--')) { op.set(a.slice(2), sig); i += 1; } else op.set(a.slice(2), true);
    } else if (comando === 'estado' && i === 0) comando = a;
    else { posicionales.push(a); if (posicional == null) posicional = a; }
  }
  return { comando, posicional, posicionales, op };
}
const args = leerArgs(process.argv);
const num = (k: string, def: number): number => {
  const v = args.op.get(k);
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
};
const txt = (k: string): string | null => { const v = args.op.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };

const B = await imp('lib/carruseles/biblioteca.ts');
const C = await imp('lib/carruseles/clasificar.ts');
const S = await imp('lib/carruseles/biblioteca-servidor.ts');
const { wsSuperAdmin } = await imp('lib/workspace.ts');
const { piezasDeApify } = await imp('lib/instagram-perfil.ts');
const { clavesApifyDeSpy } = await imp('lib/instagram-perfil-server.ts');
const { conLaPrimeraConCredito, resumenDeCredito, rotuloDeClave } = await imp('lib/spy-claves.ts');
const { APIFY_ACTOR_PUBLICACIONES, creditoDeApify, creditoTotal, entradaDePublicaciones, esFaltaDeCredito } = await imp('lib/spy-todo-reglas.ts');
const { getSupabaseServer } = await imp('lib/supabase.ts');

const API = 'https://api.apify.com/v2';
const usd = (n: number) => `US$${n.toFixed(2)}`;

type Clave = { token: string; slot: number; nombre: string | null; huella: string };
type Credito = { usado: number; tope: number };

/** Las claves de Spy de la plataforma, en orden, con su nombre. Nunca se imprimen: sólo su número y su nombre. */
async function claves(): Promise<Clave[]> {
  try { return await clavesApifyDeSpy(await wsSuperAdmin(), { conNombres: true }); } catch { return []; }
}

async function apify(token: string, ruta: string, cuerpo?: unknown): Promise<{ status: number; cuerpo: unknown }> {
  const r = await fetch(`${API}${ruta}`, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  let j: unknown = null;
  try { j = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, cuerpo: j };
}

async function credito(token: string): Promise<Credito | null> {
  const r = await apify(token, '/users/me/limits').catch(() => null);
  return r && r.status === 200 ? creditoDeApify(r.cuerpo) : null;
}

/** El crédito de cada clave y el total (la reserva de Spy sale del total). `total` null = de ninguna se pudo leer. */
async function creditos(ks: Clave[]): Promise<{ por: Array<Credito | null>; total: Credito | null }> {
  const por = await Promise.all(ks.map((k) => credito(k.token)));
  return { por, total: creditoTotal(por) };
}

/** Las que pueden pagar una corrida: con crédito libre, o sin saber (se prueban; si contestan «sin crédito», se pasa a la otra). */
const conCredito = (ks: Clave[], por: Array<Credito | null>): Clave[] => ks.filter((_, i) => !por[i] || (por[i] as Credito).tope - (por[i] as Credito).usado > 0);

/** Un renglón por clave y el total, sin ninguna clave. */
function imprimirCredito(ks: Clave[], por: Array<Credito | null>): void {
  const r = resumenDeCredito(ks, por);
  for (const x of r.porClave) console.log(`    · ${x.rotulo}: ${x.texto}${x.sinCredito ? '  ⚠ sin crédito' : ''}`);
  if (r.total) console.log(`  Libre en total: ${r.total}`);
}

/** Sin claves, o sin poder leer el crédito de ninguna: no se gasta a ciegas. */
async function clavesParaGastar(): Promise<{ ks: Clave[]; por: Array<Credito | null>; total: Credito }> {
  const ks = await claves();
  if (!ks.length) { console.log('✖ El negocio de la plataforma no tiene la clave de Spy (Apify). No se gastó nada.'); process.exit(2); }
  const { por, total } = await creditos(ks);
  if (!total) { console.log('✖ No pude leer el crédito del mes de Apify de ninguna clave: no se gasta a ciegas. No se gastó nada.'); process.exit(2); }
  return { ks, por, total };
}

/** ¿Están las tablas de la 0392? Sin ellas no se gasta: no habría dónde guardar. */
async function hayTablas(): Promise<boolean> {
  try { return (await S.cuentasDeBiblioteca()) !== null && (await S.temasDeBiblioteca()) !== null; } catch (e) {
    console.log(`✖ No pude leer la base: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

/** ¿Está la columna de la 0393 (`parece_contenido`)? Sin ella, la lectura no la manda: PostgREST rechazaría la fila ENTERA. */
let columnaContenido: boolean | null = null;
async function hayColumnaContenido(): Promise<boolean> {
  if (columnaContenido != null) return columnaContenido;
  const r = await getSupabaseServer().from(S.T_PIEZAS).select('parece_contenido').limit(1);
  columnaContenido = !r.error;
  if (r.error && !/parece_contenido|42703|PGRST204/i.test(`${r.error.code} ${r.error.message}`)) {
    console.log(`  (No pude saber si está la 0393: ${r.error.message}. Se lee sin la señal de contenido.)`);
  }
  return columnaContenido;
}

/** ¿Están las columnas de la 0404 (`laminas_imagenes`, `cta`)? Sin ellas no se mandan: PostgREST rechazaría la fila ENTERA. */
let columnas0404: boolean | null = null;
async function hayColumnas0404(): Promise<boolean> {
  if (columnas0404 != null) return columnas0404;
  const r = await getSupabaseServer().from(S.T_PIEZAS).select('laminas_imagenes, cta, cta_via').limit(1);
  columnas0404 = !r.error;
  if (r.error && !/laminas_imagenes|cta|42703|PGRST204/i.test(`${r.error.code} ${r.error.message}`)) {
    console.log(`  (No pude saber si está la 0404: ${r.error.message}. Se lee sin láminas ni CTA.)`);
  }
  return columnas0404;
}

async function estado() {
  const tablas = await hayTablas();
  console.log(tablas ? '✔ La biblioteca está creada (0392 aplicada).' : '✖ Falta aplicar la migración 0392: no hay dónde guardar la biblioteca.');
  // La 0391 (medio y láminas en spy_piezas) es de Spy, no de la biblioteca: ésta los guarda en sus propias columnas.
  console.log('  (No depende de la 0391: la biblioteca guarda si es carrusel y sus láminas en sus propias columnas.)');
  if (tablas) {
    const b = await S.bibliotecaParaEditar();
    const lista = b.cuentas.filter((c: { estado: string }) => c.estado === 'activa');
    console.log(`  Lista: ${lista.length} cuentas · ${b.cuentas.length - lista.length} fuera · ${b.porTema} creadores que llegaron por un tema`);
    console.log(`  Temas: ${b.temas.filter((t: { activo: boolean }) => t.activo).length} prendidos de ${b.temas.length}${b.temas.length ? '' : ' (se siembran los de arranque con la primera `leer --de-verdad`)'}`);
    const db = getSupabaseServer();
    const carr = await db.from(S.T_PIEZAS).select('id', { count: 'exact', head: true }).eq('medio', 'carrusel');
    const sinTipo = await db.from(S.T_PIEZAS).select('id', { count: 'exact', head: true }).eq('medio', 'carrusel').is('formato', null);
    console.log(`  Carruseles guardados: ${carr.count ?? '?'} · sin tipo: ${sinTipo.count ?? '?'} (\`reclasificar\` los mira de nuevo, gratis)`);
    if (await hayColumnaContenido()) {
      const personal = await db.from(S.T_PIEZAS).select('id', { count: 'exact', head: true }).eq('medio', 'carrusel').eq('parece_contenido', false);
      console.log(`  Parecen personales (van después en el orden): ${personal.count ?? '?'}`);
    } else console.log('  (Falta la 0393: la señal «parece contenido» se calcula al mostrar, del texto que queda.)');
    const dudosas = b.cuentas.filter((c: { estado: string; fuente: string; leida_en: string | null; piezas: number }) => c.estado === 'activa' && c.fuente === 'lista' && c.leida_en && B.cuentaDudosa(c.piezas));
    for (const c of dudosas) console.log(`  ⚠ @${c.instagram} trajo ${c.piezas} publicación(es): puede no ser su cuenta. \`verificar @${c.instagram} --nombre "${c.nombre}"\``);
  }
  const ks = await claves();
  console.log(`  Claves de Spy de la plataforma: ${ks.length ? ks.length : 'ninguna (conéctala en Integraciones → Apify del negocio de la plataforma)'}`);
  if (ks.length) {
    const { por, total } = await creditos(ks);
    imprimirCredito(ks, por);
    console.log(total ? `  Libre para la biblioteca: ${usd(Math.max(0, total.tope - total.usado - B.RESERVA_CREDITO_USD))} (se deja ${usd(B.RESERVA_CREDITO_USD)} para Spy)` : '  ✖ No pude leer el crédito de Apify de ninguna clave.');
  }
}

async function sembrarTemas(deVerdad: boolean): Promise<void> {
  const temas = await S.temasDeBiblioteca();
  if (temas && temas.length) return;
  console.log(`  Temas de arranque${deVerdad ? '' : ' (se sembrarían)'}: ${B.TEMAS_INICIALES.map((t: { hashtag: string }) => `#${t.hashtag}`).join(' ')}`);
  if (!deVerdad) return;
  for (const t of B.TEMAS_INICIALES) {
    const r = await S.cambiarBiblioteca({ que: 'tema', accion: 'sumar', valor: t.hashtag, nombre: t.nombre }, 'script');
    if (!r.ok) console.log(`  ✖ #${t.hashtag}: ${r.error}`);
  }
}

async function leer() {
  const deVerdad = args.op.get('de-verdad') === true;
  const techoPedido = num('techo-usd', B.TECHO_USD_POR_DEFECTO);
  const maxCarruseles = Math.round(num('max-carruseles', B.CARRUSELES_POR_DEFECTO));
  console.log(deVerdad ? '▶ Lectura DE VERDAD (gasta y guarda).' : '▶ En seco: no gasta ni escribe. Para leer, agrega --de-verdad.');

  if (!(await hayTablas())) {
    console.log('✖ Falta aplicar la migración 0392 (supabase/migrations/0392_carruseles_biblioteca.sql): sin sus tablas no hay dónde guardar. No se gastó nada.');
    process.exit(2);
  }
  await sembrarTemas(deVerdad);

  const { ks, por: por0, total: c0 } = await clavesParaGastar();
  const techo = B.techoConCredito(techoPedido, c0, B.RESERVA_CREDITO_USD) as number;
  console.log(`  ${ks.length > 1 ? `${ks.length} claves de Spy` : 'Clave de Spy'}:`);
  imprimirCredito(ks, por0);
  console.log(`  Usado en total ${usd(c0.usado)} de ${usd(c0.tope)}; se deja ${usd(B.RESERVA_CREDITO_USD)} para Spy → esta corrida puede gastar hasta ${usd(techo)} (pediste ${usd(techoPedido)}).`);
  const pagan = conCredito(ks, por0);

  const cuentas = (await S.cuentasDeBiblioteca()) ?? [];
  const temas = (await S.temasDeBiblioteca()) ?? (deVerdad ? [] : B.TEMAS_INICIALES.map((t: { hashtag: string; nombre: string }, i: number) => ({ id: -(i + 1), ...t, activo: true, leido_en: null })));
  const temasPlan = temas.length ? temas : B.TEMAS_INICIALES.map((t: { hashtag: string; nombre: string }, i: number) => ({ id: -(i + 1), ...t, activo: true, leido_en: null }));
  const plan = B.planDeLectura(cuentas, temasPlan, {
    techoUsd: techo, porCuenta: num('por-cuenta', B.PUBLICACIONES_POR_CUENTA), porTema: num('por-tema', B.PUBLICACIONES_POR_TEMA),
    solo: txt('solo'), soloTemas: args.op.get('solo-temas') === true, soloCuentas: args.op.get('solo-cuentas') === true,
  });
  if (!plan.lecturas.length) {
    console.log(techo < B.techoDeCorrida(1) ? '✖ No alcanza el crédito para una sola corrida. No se gastó nada.' : '  Nada que leer ahora (todo leído hace menos de una semana, o sin fuentes).');
    if (plan.alDia.length) console.log(`  Al día: ${plan.alDia.join(' ')}`);
    return;
  }
  const esperado = B.esperadoDelPlan(plan.lecturas);
  console.log(`  Plan: ${plan.lecturas.length} corridas. Como mucho ${usd(plan.totalUsd)}; lo probable, unos ${usd(esperado.usdProbable)} (Apify cobra lo que llega).`);
  console.log(`  Lo esperado, con lo medido el ${B.MEDIDO_CARRUSELES.fecha} (unos ${B.MEDIDO_CARRUSELES.porTema} carruseles por tema y ${B.MEDIDO_CARRUSELES.porCuenta} por cuenta): alrededor de ${Math.min(esperado.carruseles, maxCarruseles)} carruseles. El ${maxCarruseles} de --max-carruseles es un techo, no lo que va a entrar.`);
  for (const l of plan.lecturas) console.log(`    · ${l.fuente.tipo === 'cuenta' ? `@${l.fuente.instagram}` : `#${l.fuente.hashtag}`}: ${l.cuantas} publicaciones, techo ${usd(l.techoUsd)}`);
  if (plan.quedanFuera.length) console.log(`  No entran en el techo (la próxima vez): ${plan.quedanFuera.join(' ')}`);
  if (plan.alDia.length) console.log(`  Al día (leídas hace menos de una semana): ${plan.alDia.join(' ')}`);
  if (!deVerdad) return;

  const db = getSupabaseServer();
  const conContenido = await hayColumnaContenido();
  if (!conContenido) console.log('  (Falta la 0393: se guarda sin la señal «parece contenido»; la pantalla la calcula del texto.)');
  const con0404 = await hayColumnas0404();
  if (!con0404) console.log('  (Falta la 0404: se guarda sin las láminas ni el CTA; la tarjeta muestra la portada sola.)');
  let conLaminas = 0;
  let conPortada = 0;
  let llegaronTodas = 0;
  const fuera = new Set<string>(cuentas.filter((c: { estado: string }) => c.estado === 'excluida').map((c: { instagram: string }) => c.instagram));
  let guardados = 0;
  const porFormato = new Map<string, number>();
  for (const l of plan.lecturas) {
    if (guardados >= maxCarruseles) { console.log(`  Llegó a ${maxCarruseles} carruseles: corta acá.`); break; }
    const rotulo = l.fuente.tipo === 'cuenta' ? `@${l.fuente.instagram}` : `#${l.fuente.hashtag}`;
    const entrada = l.fuente.tipo === 'cuenta'
      ? entradaDePublicaciones(l.fuente.instagram, { cuantas: l.cuantas, desde: null })
      : B.entradaDeTema(l.fuente.hashtag, l.cuantas);
    const q = new URLSearchParams({ maxItems: String(l.cuantas), maxTotalChargeUsd: String(l.techoUsd), timeout: '280' });
    // La primera clave con crédito; si una se agota a mitad, sigue con la siguiente (lib/spy-claves.ts). Otro error no salta.
    const r = await conLaPrimeraConCredito(pagan, (k: Clave) => apify(k.token, `/acts/${APIFY_ACTOR_PUBLICACIONES}/run-sync-get-dataset-items?${q}`, entrada).catch((e) => ({ status: 0, cuerpo: String(e) })));
    if (!r) { console.log(`  ✖ ${rotulo}: ninguna clave tiene crédito. Corta acá; lo guardado queda.`); break; }
    if (r.saltadas) console.log(`  (${r.saltadas} clave(s) sin crédito: sigue con la ${rotuloDeClave(r.clave)})`);
    if (r.status < 200 || r.status >= 300 || !Array.isArray(r.cuerpo)) {
      if (esFaltaDeCredito(r.status, r.cuerpo)) { console.log(`  ✖ ${rotulo}: Apify dice que no queda crédito en ninguna clave. Corta acá; lo guardado queda.`); break; }
      console.log(`  ✖ ${rotulo}: Apify contestó HTTP ${r.status} con la ${rotuloDeClave(r.clave)}. Sigue con la próxima.`);
      continue;
    }
    const items = r.cuerpo as Array<Record<string, unknown>>;
    // De quién es cada publicación: en una cuenta, de ella; en un tema, de su dueño (cada una de alguien distinto).
    const creadorDe = new Map<string, { instagram: string; nombre: string }>();
    for (const it of items) {
      const ref = typeof it.shortCode === 'string' ? it.shortCode : '';
      const cr = l.fuente.tipo === 'cuenta' ? { instagram: l.fuente.instagram, nombre: l.fuente.nombre } : B.creadorDelItem(it);
      if (ref && cr) creadorDe.set(ref, cr);
    }
    // El texto alternativo de la portada (lo que Instagram escribe para las personas ciegas): dice el tipo y si es de
    // personas. Se lee si vino; NO se guarda (sólo lo que se deduce de él).
    const altDe = new Map<string, string>();
    for (const it of items) { const ref = typeof it.shortCode === 'string' ? it.shortCode : ''; const alt = C.altDelItem(it); if (ref && alt) altDe.set(ref, alt); }
    conPortada += altDe.size;
    llegaronTodas += items.length;
    if (l.fuente.tipo === 'cuenta' && B.cuentaDudosa(items.length)) {
      console.log(`  ⚠ @${l.fuente.instagram} trajo ${items.length} de ${l.cuantas} publicaciones: puede no ser su cuenta, o es privada. Confírmala: \`verificar @${l.fuente.instagram} --nombre "${l.fuente.nombre}"\`.`);
    }
    const piezas = piezasDeApify(items)
      .map((p: { ref: string }) => ({ ...p, creador: creadorDe.get(p.ref)?.instagram ?? '', alt: altDe.get(p.ref) ?? null }));
    const filas: Array<Record<string, unknown> & { creador: string; ref: string }> = B.filasDeLectura(piezas, {
      tema: l.fuente.tipo === 'tema' ? l.fuente.id : null, fuera, tope: l.fuente.tipo === 'tema' ? maxCarruseles - guardados : undefined,
    });
    if (!filas.length) { console.log(`  · ${rotulo}: ${items.length} publicaciones, ningún carrusel nuevo para guardar.`); await marcarLeida(l); continue; }
    // Los creadores que llegaron por un tema se anotan (fuente 'tema'); los que ya estaban no se tocan.
    const nuevos = [...new Set(filas.map((f) => f.creador))]
      .map((ig) => ({ instagram: ig, nombre: (creadorDe.get(filas.find((f) => f.creador === ig)?.ref ?? '')?.nombre ?? ig).slice(0, 120), fuente: 'tema', cambiada_por: 'script' }));
    if (l.fuente.tipo === 'tema' && nuevos.length) {
      const ins = await db.from(S.T_CUENTAS).upsert(nuevos, { onConflict: 'instagram', ignoreDuplicates: true });
      if (ins.error) { console.log(`  ✖ ${rotulo}: no pude anotar a sus creadores (${ins.error.message}). Sigue con la próxima.`); continue; }
    }
    const ids = await db.from(S.T_CUENTAS).select('id, instagram, estado').in('instagram', nuevos.map((n) => n.instagram));
    if (ids.error) { console.log(`  ✖ ${rotulo}: no pude leer a sus creadores (${ids.error.message}).`); continue; }
    const idDe = new Map<string, number>();
    for (const c of (ids.data ?? []) as Array<{ id: number; instagram: string; estado: string }>) if (c.estado === 'activa') idDe.set(c.instagram, c.id);
    const conId = filas.filter((f: { creador: string }) => idDe.has(f.creador));
    // La miniatura se BAJA a nuestro bucket (la del CDN de Instagram vence y da 403 desde otro dominio).
    const conFoto = await (await imp('lib/spy-miniaturas.ts')).guardarMiniaturas(conId.map((f: Record<string, unknown>) => ({ ...f, canal: 'instagram' })));
    // Las láminas (0404): se bajan a nuestro bucket; si no bajaron todas, no se guardan (la próxima `laminas` las completa).
    for (const f of conFoto as Array<Record<string, unknown>>) {
      const urls = Array.isArray(f.laminas_imagenes) ? (f.laminas_imagenes as string[]) : [];
      f.laminas_imagenes = con0404 && urls.length ? await S.bajarLaminas(String(f.ref), urls) : null;
      if (f.laminas_imagenes) conLaminas += 1;
    }
    const aGuardar = conFoto.map(({ canal: _c, creador, alt: _a, parece_contenido, laminas_imagenes, cta, cta_via, ...f }: Record<string, unknown>) => ({
      ...f, ...(conContenido ? { parece_contenido } : {}), ...(con0404 ? { cta, cta_via, ...(laminas_imagenes ? { laminas_imagenes } : {}) } : {}),
      cuenta_id: idDe.get(String(creador)),
    }));
    const up = await db.from(S.T_PIEZAS).upsert(aGuardar, { onConflict: 'ref' });
    if (up.error) { console.log(`  ✖ ${rotulo}: no pude guardar (${up.error.message}). Sigue con la próxima.`); continue; }
    const carruseles = aGuardar.filter((f: { medio?: unknown }) => f.medio === 'carrusel');
    guardados += carruseles.length;
    for (const f of carruseles) porFormato.set(String(f.formato ?? 'sin tipo'), (porFormato.get(String(f.formato ?? 'sin tipo')) ?? 0) + 1);
    console.log(`  ✔ ${rotulo}: ${items.length} publicaciones → ${carruseles.length} carruseles guardados${aGuardar.length > carruseles.length ? ` (y ${aGuardar.length - carruseles.length} imágenes, para el outlier de la cuenta)` : ''}.`);
    await marcarLeida(l);
  }
  const { por: por1, total: c1 } = await creditos(ks);
  console.log(`  ${conPortada} de ${llegaronTodas} publicaciones traían el texto de la portada${llegaronTodas && !conPortada ? ' (el actor no lo mandó: el tipo sale sólo del pie)' : ''}.`);
  console.log(`▶ Listo: ${guardados} carruseles guardados (${conLaminas} con sus láminas en nuestro bucket). Por tipo: ${[...porFormato].map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}.`);
  if (c1) {
    console.log(`  Crédito de Apify: usado en total ${usd(c1.usado)} de ${usd(c1.tope)} (esta corrida, unos ${usd(Math.max(0, c1.usado - c0.usado))}).`);
    imprimirCredito(ks, por1);
  }
}

async function marcarLeida(l: { fuente: { tipo: string; id: number } }) {
  const db = getSupabaseServer();
  const ahora = new Date().toISOString();
  const r = l.fuente.tipo === 'cuenta'
    ? await db.from(S.T_CUENTAS).update({ leida_en: ahora }).eq('id', l.fuente.id)
    : await db.from(S.T_TEMAS).update({ leido_en: ahora }).eq('id', l.fuente.id);
  if (r.error) console.log(`  (no pude anotar cuándo se leyó: ${r.error.message})`);
}

async function buscar() {
  if (!(await hayTablas())) { console.log('✖ Falta aplicar la migración 0392. No se gastó nada.'); process.exit(2); }
  const { ks, por: por0, total: c0 } = await clavesParaGastar();
  const techo = B.techoConCredito(num('techo-usd', 0.5), c0, B.RESERVA_CREDITO_USD) as number;
  const pagan = conCredito(ks, por0);
  const { ASESORES } = await imp('lib/asesores/catalogo.ts');
  const { pedirBusquedaApify, perfilesDeBusqueda } = await imp('lib/instagram-buscar-apify.ts');
  const { APIFY_TOPE_USD } = await imp('lib/instagram-perfil.ts');
  const faltan = B.referentesSinCuenta(ASESORES, (await S.cuentasDeBiblioteca()) ?? []);
  const alcanza = Math.floor(techo / APIFY_TOPE_USD);
  console.log(`  ${faltan.length} referentes sin cuenta en la lista; alcanza para buscar ${Math.min(alcanza, faltan.length)} (techo ${usd(techo)}).`);
  for (const r of faltan.slice(0, alcanza)) {
    // La primera clave con crédito (varias claves, 5/11/2026); un «sin crédito» pasa a la siguiente.
    const pedida = await conLaPrimeraConCredito(pagan, (k: Clave) => pedirBusquedaApify(r.completo, k.token));
    const xs = pedida ? perfilesDeBusqueda(r.completo, pedida) : [];
    // La búsqueda de Instagram trae cuentas que se parecen (medido el 4/11: para «Alex Hormozi», @damaristradesww y
    // @hormoziw). Se ordenan por cuánto se parecen al nombre y se dice; ninguna se da por buena sin `verificar`.
    const orden = [...xs].map((p: { usuario: string; nombre?: string | null }) => ({ p, n: B.parecidoConNombre(p, r.completo) }))
      .sort((a, b) => b.n - a.n).slice(0, 5);
    const rotulo = (n: number) => (n === 2 ? 'el nombre coincide' : n === 1 ? 'el @ lo nombra' : 'no se parece');
    console.log(`  · ${r.completo} (${r.id}): ${orden.length ? orden.map(({ p, n }) => `@${p.usuario}${p.nombre ? ` «${p.nombre}»` : ''} (${rotulo(n)})`).join(' · ') : 'sin candidatos'}`);
  }
  console.log('  Ninguno se suma solo. Confirma el que parezca con `verificar @usuario --referente <id>` (lee el perfil: nombre,');
  console.log('  verificada, seguidores), o carga el @ que te pase Martín en la pantalla («Cuentas» → «Editar la biblioteca»).');
}

/** Lee perfiles y dice si son de quien se cree. No escribe nada. Unos US$0,003 por perfil. */
async function verificar() {
  const usuarios = [...new Set(args.posicionales.map((x) => B.cuentaDeInstagram(x)).filter(Boolean) as string[])].slice(0, 20);
  if (!usuarios.length) { console.log('Uso: verificar @usuario [@otro …] [--referente id | --nombre "Nombre"]'); process.exit(1); }
  const { ks, por: por0, total: c0 } = await clavesParaGastar();
  const pagan = conCredito(ks, por0);
  const { APIFY_ACTOR_PERFIL, APIFY_TOPE_USD, leerPerfilDeApify } = await imp('lib/instagram-perfil.ts');
  const techo = Math.min(APIFY_TOPE_USD * usuarios.length, B.techoConCredito(1, c0, B.RESERVA_CREDITO_USD) as number);
  if (techo <= 0) { console.log('✖ No alcanza el crédito libre del mes (se deja la reserva de Spy). No se gastó nada.'); process.exit(2); }
  let completo: string | null = txt('nombre');
  const ref = txt('referente');
  if (ref) {
    const { ASESORES } = await imp('lib/asesores/catalogo.ts');
    const a = (ASESORES as Array<{ id: string; completo: string }>).find((x) => x.id === ref);
    if (!a) { console.log(`✖ No conozco el referente «${ref}».`); process.exit(1); }
    completo = a.completo;
  }
  const r = await conLaPrimeraConCredito(pagan, (k: Clave) => apify(k.token, `/acts/${APIFY_ACTOR_PERFIL}/run-sync-get-dataset-items?maxItems=${usuarios.length}&maxTotalChargeUsd=${techo}&timeout=120`, { usernames: usuarios }));
  if (!r) { console.log('✖ Ninguna clave tiene crédito. No se gastó nada.'); process.exit(2); }
  if (r.status < 200 || r.status >= 300) { console.log(`✖ Apify contestó HTTP ${r.status} con la ${rotuloDeClave(r.clave)}.`); process.exit(1); }
  const items = Array.isArray(r.cuerpo) ? (r.cuerpo as Array<Record<string, unknown>>) : [];
  for (const u of usuarios) {
    const l = leerPerfilDeApify(u, items);
    if (!l.ok) { console.log(`  ✖ @${u}: no existe o no se pudo leer (${l.detalle}).`); continue; }
    const crudo = items.find((x) => String(x.username ?? '').toLowerCase() === u);
    const verificada = crudo && typeof crudo.verified === 'boolean' ? crudo.verified : null;
    const v = B.confianzaDeCuenta({ ...l.perfil, verificada }, completo);
    const marca = v.nivel === 'confirmada' ? '✔ confirmada' : v.nivel === 'dudosa' ? '? dudosa' : '✖ no parece';
    console.log(`  ${marca} — @${u}${l.perfil.nombre ? ` «${l.perfil.nombre}»` : ''}: ${v.motivos.join(' · ') || 'sin datos'}`);
  }
  if (!completo) console.log('  (Sin --referente ni --nombre no se compara el nombre: sólo si es grande y publica.)');
}

/** Vuelve a clasificar lo guardado con su texto (GRATIS: no pide nada a Apify). Sólo llena lo que falta. */
async function reclasificar() {
  const deVerdad = args.op.get('de-verdad') === true;
  if (!(await hayTablas())) { console.log('✖ Falta aplicar la migración 0392.'); process.exit(2); }
  const conContenido = await hayColumnaContenido();
  const { leerPorPaginas } = await imp('lib/supabase-paginado.ts');
  const db = getSupabaseServer();
  const con0404 = await hayColumnas0404();
  if (!con0404) console.log('  (Falta la 0404: el CTA no se guarda; la pantalla lo calcula del texto mientras el texto exista.)');
  const cols = `id, medio, texto, formato, cierre${conContenido ? ', parece_contenido' : ''}${con0404 ? ', cta' : ''}`;
  const filas: Array<Record<string, unknown>> = [];
  await leerPorPaginas(db, S.T_PIEZAS, cols, (p: Array<Record<string, unknown>>) => { filas.push(...p); });
  const carruseles = filas.filter((f) => f.medio === 'carrusel');
  const antes = carruseles.filter((f) => !f.formato).length;
  const cambios = filas.map((f) => ({ id: f.id as number, medio: f.medio, c: B.reclasificacion(f) })).filter((x) => x.c);
  const despues = carruseles.filter((f) => !f.formato && !cambios.find((x) => x.id === f.id)?.c?.formato).length;
  const personales = cambios.filter((x) => x.medio === 'carrusel' && x.c.parece_contenido === false).length;
  console.log(`${deVerdad ? '▶ Reclasificando DE VERDAD.' : '▶ En seco: no escribe. Para guardar, agrega --de-verdad.'}`);
  console.log(`  Carruseles sin tipo: ${antes} → ${despues} (de ${carruseles.length}). Con un cierre nuevo: ${cambios.filter((x) => x.c.cierre).length}. Parecen personales: ${personales}${conContenido ? '' : ' (sin la 0393 no se guarda: la pantalla lo calcula igual)'}.`);
  const sinTexto = carruseles.filter((f) => !f.formato && !String(f.texto ?? '').trim()).length;
  if (sinTexto) console.log(`  ${sinTexto} sin tipo ya no tienen texto (vence a los 30 días): sólo la portada los clasificaría, en la próxima lectura.`);
  // Para mirar a ojo por qué el resto no dice su tipo (el gancho de unos cuantos que siguen sin tipo).
  const siguen = carruseles.filter((f) => !f.formato && f.texto && !cambios.find((x) => x.id === f.id)?.c?.formato).slice(0, 15);
  if (siguen.length) console.log('  Siguen sin tipo (su primera línea):');
  for (const f of siguen) console.log(`    · ${String(f.texto).split(/\n+/).find((x) => x.trim())?.trim().slice(0, 90)}`);
  // El CTA (6/11/2026): cuántos piden «Comenta X palabra», y unos de cada lado para mirar a ojo que la regla acierta.
  const { ctaDeTexto } = await imp('lib/carruseles/cta.ts');
  const conTexto = carruseles.filter((f) => String(f.texto ?? '').trim());
  const piden = conTexto.filter((f) => ctaDeTexto(f.texto));
  console.log(`  CTA «Comenta X palabra»: ${piden.length} de ${conTexto.length} carruseles con texto${con0404 ? ` (nuevos para guardar: ${cambios.filter((x) => x.c.cta).length})` : ''}.`);
  console.log('  Piden una palabra (la palabra y el final del pie):');
  for (const f of piden.slice(0, 20)) {
    const c = ctaDeTexto(f.texto);
    console.log(`    ✔ «${c.palabra}» (${c.via}) — …${String(f.texto).replace(/\s+/g, ' ').slice(-90)}`);
  }
  const conComenta = conTexto.filter((f) => !ctaDeTexto(f.texto) && /coment|comment|dm\b|mensaje/i.test(String(f.texto)));
  console.log(`  NO cuentan aunque mencionan comentar o un mensaje (${conComenta.length}; mirar que ninguno pida una palabra):`);
  for (const f of conComenta.slice(0, 20)) {
    const t = String(f.texto).replace(/\s+/g, ' ');
    const i = t.search(/coment|comment|dm\b|mensaje/i);
    console.log(`    ✖ …${t.slice(Math.max(0, i - 40), i + 70)}`);
  }
  if (!deVerdad) return;
  let hechas = 0;
  for (const x of cambios) {
    const cambio = Object.fromEntries(Object.entries(x.c).filter(([k]) => (conContenido || k !== 'parece_contenido') && (con0404 || (k !== 'cta' && k !== 'cta_via'))));
    if (!Object.keys(cambio).length) continue;
    const r = await db.from(S.T_PIEZAS).update(cambio).eq('id', x.id);
    if (r.error) { console.log(`  ✖ ${x.id}: ${r.error.message}`); continue; }
    hechas += 1;
  }
  console.log(`▶ Listo: ${hechas} publicaciones actualizadas.`);
}

/**
 * Las láminas de los carruseles guardados que no las tienen (6/11/2026, 0404). Cada publicación se pide POR SU LINK (la receta de
 * docs/hallazgos-carruseles.md, «Traer un carrusel puntual: por su link»), de a 40 por corrida de Apify, y sus imágenes se bajan
 * a nuestro bucket. Con la clave de Spy de la plataforma y los dos techos de siempre (el pedido y el crédito libre del mes).
 */
async function laminas() {
  const deVerdad = args.op.get('de-verdad') === true;
  const techoPedido = num('techo-usd', 1);
  const max = Math.round(num('max', 400));
  console.log(deVerdad ? '▶ Láminas DE VERDAD (gasta y guarda).' : '▶ En seco: no gasta ni escribe. Para leer, agrega --de-verdad.');
  if (!(await hayTablas())) { console.log('✖ Falta aplicar la migración 0392.'); process.exit(2); }
  if (!(await hayColumnas0404())) { console.log('✖ Falta aplicar la migración 0404 (supabase/migrations/0404_carruseles_laminas_cta.sql). No se gastó nada.'); process.exit(2); }
  const { leerPorPaginas } = await imp('lib/supabase-paginado.ts');
  const { entradaDeUnaPublicacion } = await imp('lib/spy-todo-reglas.ts');
  const db = getSupabaseServer();
  const filas: Array<{ id: number; ref: string; url: string | null; laminas: number | null; texto: string | null; cta: string | null }> = [];
  await leerPorPaginas(db, S.T_PIEZAS, 'id, ref, url, laminas, texto, cta, medio, laminas_imagenes, dejo_de_verse_en', (p: Array<Record<string, unknown>>) => {
    for (const f of p) if (f.medio === 'carrusel' && !f.dejo_de_verse_en && !(Array.isArray(f.laminas_imagenes) && f.laminas_imagenes.length)) filas.push(f as never);
  });
  const conLink = filas.filter((f) => typeof f.url === 'string' && /^https:\/\/(?:www\.)?instagram\.com\//.test(f.url)).slice(0, max);
  const porLeer = conLink.length;
  // Lo probable, al precio MEDIDO por link (US$0,0027: el de lista subestima la factura). El techo de cada tanda es otra cosa.
  const probable = Math.round(porLeer * B.USD_POR_LINK_MEDIDO * 100) / 100;
  console.log(`  Carruseles sin sus láminas: ${filas.length} (con link: ${conLink.length}). Esta corrida: ${porLeer} (--max ${max}). Lo probable: ${usd(probable)}.`);
  if (!porLeer) return;
  const { ks, por: por0, total: c0 } = await clavesParaGastar();
  // El techo Y DE DÓNDE SALE (6/11/2026): un techo de cero porque no hay crédito y un techo chico porque el crédito no llega a
  // lo pedido no se ven iguales. El número solo es `B.techoConCredito`, que es lo que usa `leer`.
  const tope = B.motivoDelTecho(techoPedido, c0, B.RESERVA_CREDITO_USD) as { techo: number | null; motivo: string; porque: string };
  const techo = tope.techo ?? 0;
  imprimirCredito(ks, por0);
  console.log(`  Puede gastar hasta ${usd(techo)} — ${tope.porque}.`);
  // El plan de tandas, también en seco: cuántos links entran en el techo y cuántos NO (antes esto sólo se sabía al cortar).
  const plan = B.planDeTandas(porLeer, { techoUsd: techo }) as {
    tandas: Array<{ desde: number; cuantos: number; techoUsd: number }>; probableUsd: number; quedanFuera: number; corte: string;
  };
  // `usd` redondea a centavos, y el precio por link vive en diezmilésimos: ahí va con sus cuatro decimales o dice «US$0.00».
  console.log(`  Plan: ${plan.tandas.length} tanda(s) de hasta ${B.LINKS_POR_TANDA} links → ${porLeer - plan.quedanFuera} de ${porLeer}. Lo probable, ${usd(plan.probableUsd)} (US$${B.USD_POR_LINK_MEDIDO.toFixed(4)} por link, medido).`);
  if (plan.quedanFuera) console.log(`  ⚠ ${B.porQueParo({ ...plan, motivo: tope.motivo, porque: tope.porque, techo: tope.techo })}`);
  if (!deVerdad) return;
  if (!plan.tandas.length) { console.log('  No se gastó nada.'); return; }
  const pagan = conCredito(ks, por0);
  let guardadas = 0;
  let sinImagenes = 0;
  let cortoApify = false;
  let pedidos = 0;   // cuántos links ya se pidieron
  let cobrado = 0;   // lo que Apify cobró, contado por lo que LLEGÓ (no por el techo de la tanda, que lleva margen)
  let nTanda = 0;
  let corte = 'todo';
  const { piezasDeApify: piezas } = await imp('lib/instagram-perfil.ts');
  while (pedidos < conLink.length) {
    // La MISMA regla del plan, pero con lo que Apify ya cobró de verdad: así el margen de cada tanda no gasta de más.
    const tanda = B.siguienteTanda(conLink.length - pedidos, Math.round((techo - cobrado) * 100) / 100) as { cuantos: number; techoUsd: number } | null;
    if (!tanda) { corte = techo <= 0 ? 'sin-techo' : 'techo'; break; }
    const links = conLink.slice(pedidos, pedidos + tanda.cuantos);
    pedidos += links.length;
    nTanda += 1;
    const entrada = { ...entradaDeUnaPublicacion(links[0].url as string), directUrls: links.map((f) => f.url), resultsLimit: 1 };
    const q = new URLSearchParams({ maxItems: String(links.length), maxTotalChargeUsd: String(tanda.techoUsd), timeout: '280' });
    const r = await conLaPrimeraConCredito(pagan, (k: Clave) => apify(k.token, `/acts/${APIFY_ACTOR_PUBLICACIONES}/run-sync-get-dataset-items?${q}`, entrada).catch((e) => ({ status: 0, cuerpo: String(e) })));
    if (!r || r.status < 200 || r.status >= 300 || !Array.isArray(r.cuerpo)) {
      if (r && esFaltaDeCredito(r.status, r.cuerpo)) {
        console.log(`  ✖ Apify dice que no queda crédito en ninguna clave (iba por la tanda ${nTanda}, ${conLink.length - pedidos + links.length} links sin leer). Corta acá; lo guardado queda.`);
        cortoApify = true;
        break;
      }
      console.log(`  ✖ Tanda ${nTanda}: Apify contestó HTTP ${r?.status ?? '—'}. Sigue con la próxima.`);
      continue;
    }
    cobrado = Math.round((cobrado + r.cuerpo.length * B.USD_POR_LINK_MEDIDO) * 100) / 100;
    const porRef = new Map((piezas(r.cuerpo) as Array<{ ref: string; imagenes?: string[]; laminas?: number | null }>).map((p) => [p.ref, p]));
    for (const f of links) {
      const p = porRef.get(f.ref);
      if (!p?.imagenes?.length) { sinImagenes += 1; continue; }
      const nuestras = await S.bajarLaminas(f.ref, p.imagenes);
      if (!nuestras) { sinImagenes += 1; continue; }
      const cambio: Record<string, unknown> = { laminas_imagenes: nuestras };
      if (f.laminas == null && nuestras.length >= 2) cambio.laminas = Math.min(20, nuestras.length);
      const u = await db.from(S.T_PIEZAS).update(cambio).eq('id', f.id);
      if (u.error) { console.log(`  ✖ ${f.ref}: ${u.error.message}`); continue; }
      guardadas += 1;
    }
    console.log(`  ✔ Tanda ${nTanda}: ${links.length} links → ${guardadas} con sus láminas hasta acá (Apify cobró ${usd(cobrado)} de ${usd(techo)}).`);
  }
  const { total: c1 } = await creditos(ks);
  const gastado = c1 ? Math.max(0, Math.round((c1.usado - c0.usado) * 100) / 100) : null;
  console.log(`▶ Listo: ${guardadas} carruseles con sus láminas; ${sinImagenes} sin imágenes (borrados, privados o el actor no las dio).`);
  // Por qué no siguió, con el número: nunca un «al techo» mudo. Si Apify cortó antes que el techo, lo dice eso y no el techo.
  if (cortoApify) console.log('  Paró porque Apify dijo que no queda crédito en ninguna clave: cargá crédito y volvé a correrlo.');
  else console.log(`  ${B.porQueParo({ corte, motivo: tope.motivo, porque: tope.porque, techo: tope.techo, quedanFuera: conLink.length - pedidos, gastado })}`);
  if (c1) console.log(`  Crédito de Apify: usado ${usd(c1.usado)} de ${usd(c1.tope)}.`);
}

async function cambio(pedido: Record<string, unknown>) {
  const r = await S.cambiarBiblioteca(pedido, 'script');
  console.log(r.ok ? `✔ ${r.ya ?? 'Hecho.'}` : `✖ ${r.error}`);
  if (!r.ok) process.exit(1);
}

switch (args.comando) {
  case 'estado': await estado(); break;
  case 'leer': await leer(); break;
  case 'buscar': await buscar(); break;
  case 'verificar': await verificar(); break;
  case 'reclasificar': await reclasificar(); break;
  case 'laminas': await laminas(); break;
  case 'sumar':
    if (!args.posicional) { console.log('Falta el @usuario.'); process.exit(1); }
    await cambio({ que: 'cuenta', accion: 'sumar', valor: args.posicional, nombre: txt('nombre') ?? args.posicional.replace(/^@/, ''), referente: txt('referente') });
    break;
  case 'sacar':
    if (!args.posicional || !txt('motivo')) { console.log('Uso: sacar @usuario --motivo "Lo pidió"'); process.exit(1); }
    await cambio({ que: 'cuenta', accion: 'sacar', valor: args.posicional, motivo: txt('motivo') });
    break;
  case 'tema':
    if (!args.posicional) { console.log('Falta el #hashtag.'); process.exit(1); }
    await cambio({ que: 'tema', accion: 'sumar', valor: args.posicional, nombre: txt('nombre') ?? args.posicional.replace(/^#/, '') });
    break;
  default:
    console.log(`No conozco «${args.comando}». Comandos: estado, leer, buscar, verificar, reclasificar, laminas, sumar, sacar, tema (ver la cabecera del script).`);
    process.exit(1);
}
