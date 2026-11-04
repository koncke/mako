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
// ⚠️ NUNCA IMPRIME UNA CLAVE: dice «clave de Spy: sí/no», nada más.
//
// Uso (desde la raíz del clon):
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/carruseles-biblioteca.mts <comando> [opciones]
//
// Comandos:
//   estado                       Lo que hay (tablas, cuentas, temas, publicaciones) y el crédito de Apify. No gasta ni escribe.
//   leer [opciones]              En seco: el plan y su costo máximo. Con --de-verdad: lee y guarda.
//        --techo-usd 2           Lo más que puede gastar la corrida (por defecto 2).
//        --max-carruseles 300    Cuántos carruseles guardar como mucho (por defecto 300).
//        --por-cuenta 40 --por-tema 80   Cuántas publicaciones pedir a cada fuente.
//        --solo @cuenta | --solo '#tema'   Sólo esa fuente (aunque se haya leído hace poco). El # va entre comillas: en la
//                                         consola, una palabra que empieza con # es un comentario.
//        --solo-temas | --solo-cuentas
//   buscar [--techo-usd 0.5]     Busca en Instagram, por su nombre, a los referentes del Ops Center que no están en la lista
//                                y muestra los candidatos. No escribe nada: el bueno se suma con `sumar`.
//   sumar @usuario --nombre "Nombre" [--referente id]   Suma una cuenta a la lista.
//   sacar @usuario --motivo "Lo pidió"                  Saca a un creador: sus carruseles dejan de verse en todos lados.
//   tema '#hashtag' --nombre "Nombre"                   Suma un tema (el # entre comillas, o sin el #).
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)

const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);

type Args = { comando: string; posicional: string | null; op: Map<string, string | true> };
function leerArgs(argv: string[]): Args {
  const op = new Map<string, string | true>();
  let comando = 'estado';
  let posicional: string | null = null;
  const xs = argv.slice(2);
  for (let i = 0; i < xs.length; i += 1) {
    const a = xs[i];
    if (a.startsWith('--')) {
      const sig = xs[i + 1];
      if (sig != null && !sig.startsWith('--')) { op.set(a.slice(2), sig); i += 1; } else op.set(a.slice(2), true);
    } else if (comando === 'estado' && i === 0) comando = a;
    else if (posicional == null) posicional = a;
  }
  return { comando, posicional, op };
}
const args = leerArgs(process.argv);
const num = (k: string, def: number): number => {
  const v = args.op.get(k);
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 ? n : def;
};
const txt = (k: string): string | null => { const v = args.op.get(k); return typeof v === 'string' && v.trim() ? v.trim() : null; };

const B = await imp('lib/carruseles/biblioteca.ts');
const S = await imp('lib/carruseles/biblioteca-servidor.ts');
const { wsSuperAdmin } = await imp('lib/workspace.ts');
const { credDelCliente } = await imp('lib/credenciales.ts');
const { APIFY_CLAVE_DE_SPY, piezasDeApify } = await imp('lib/instagram-perfil.ts');
const { APIFY_ACTOR_PUBLICACIONES, creditoDeApify, entradaDePublicaciones, esFaltaDeCredito } = await imp('lib/spy-todo-reglas.ts');
const { getSupabaseServer } = await imp('lib/supabase.ts');

const API = 'https://api.apify.com/v2';
const usd = (n: number) => `US$${n.toFixed(2)}`;

/** La clave de Spy de la plataforma. Nunca se imprime. */
async function clave(): Promise<string | null> {
  try { return await credDelCliente(APIFY_CLAVE_DE_SPY, await wsSuperAdmin()); } catch { return null; }
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

async function credito(token: string): Promise<{ usado: number; tope: number } | null> {
  const r = await apify(token, '/users/me/limits').catch(() => null);
  return r && r.status === 200 ? creditoDeApify(r.cuerpo) : null;
}

/** ¿Están las tablas de la 0392? Sin ellas no se gasta: no habría dónde guardar. */
async function hayTablas(): Promise<boolean> {
  try { return (await S.cuentasDeBiblioteca()) !== null && (await S.temasDeBiblioteca()) !== null; } catch (e) {
    console.log(`✖ No pude leer la base: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
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
    const carr = await getSupabaseServer().from(S.T_PIEZAS).select('id', { count: 'exact', head: true }).eq('medio', 'carrusel');
    console.log(`  Carruseles guardados: ${carr.count ?? '?'}`);
  }
  const token = await clave();
  console.log(`  Clave de Spy de la plataforma: ${token ? 'sí' : 'no (conéctala en Integraciones → Apify del negocio de la plataforma)'}`);
  if (token) {
    const c = await credito(token);
    console.log(c ? `  Crédito de Apify este mes: usado ${usd(c.usado)} de ${usd(c.tope)} · libre para la biblioteca ${usd(Math.max(0, c.tope - c.usado - B.RESERVA_CREDITO_USD))} (se deja ${usd(B.RESERVA_CREDITO_USD)} para Spy)` : '  ✖ No pude leer el crédito de Apify.');
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

  const token = await clave();
  if (!token) { console.log('✖ El negocio de la plataforma no tiene la clave de Spy (Apify). No se gastó nada.'); process.exit(2); }
  const c0 = await credito(token);
  if (!c0) { console.log('✖ No pude leer el crédito del mes de Apify: no se gasta a ciegas. No se gastó nada.'); process.exit(2); }
  const techo = B.techoConCredito(techoPedido, c0, B.RESERVA_CREDITO_USD) as number;
  console.log(`  Crédito de Apify: usado ${usd(c0.usado)} de ${usd(c0.tope)}; se deja ${usd(B.RESERVA_CREDITO_USD)} para Spy → esta corrida puede gastar hasta ${usd(techo)} (pediste ${usd(techoPedido)}).`);

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
  console.log(`  Plan (${plan.lecturas.length} corridas, como mucho ${usd(plan.totalUsd)}; hasta ${maxCarruseles} carruseles):`);
  for (const l of plan.lecturas) console.log(`    · ${l.fuente.tipo === 'cuenta' ? `@${l.fuente.instagram}` : `#${l.fuente.hashtag}`}: ${l.cuantas} publicaciones, techo ${usd(l.techoUsd)}`);
  if (plan.quedanFuera.length) console.log(`  No entran en el techo (la próxima vez): ${plan.quedanFuera.join(' ')}`);
  if (plan.alDia.length) console.log(`  Al día (leídas hace menos de una semana): ${plan.alDia.join(' ')}`);
  if (!deVerdad) return;

  const db = getSupabaseServer();
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
    const r = await apify(token, `/acts/${APIFY_ACTOR_PUBLICACIONES}/run-sync-get-dataset-items?${q}`, entrada).catch((e) => ({ status: 0, cuerpo: String(e) }));
    if (r.status < 200 || r.status >= 300 || !Array.isArray(r.cuerpo)) {
      if (esFaltaDeCredito(r.status, r.cuerpo)) { console.log(`  ✖ ${rotulo}: Apify dice que no queda crédito. Corta acá; lo guardado queda.`); break; }
      console.log(`  ✖ ${rotulo}: Apify contestó HTTP ${r.status}. Sigue con la próxima.`);
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
    const piezas = piezasDeApify(items)
      .map((p: { ref: string }) => ({ ...p, creador: creadorDe.get(p.ref)?.instagram ?? '' }));
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
    const aGuardar = conFoto.map(({ canal: _c, creador, ...f }: Record<string, unknown>) => ({ ...f, cuenta_id: idDe.get(String(creador)) }));
    const up = await db.from(S.T_PIEZAS).upsert(aGuardar, { onConflict: 'ref' });
    if (up.error) { console.log(`  ✖ ${rotulo}: no pude guardar (${up.error.message}). Sigue con la próxima.`); continue; }
    const carruseles = aGuardar.filter((f: { medio?: unknown }) => f.medio === 'carrusel');
    guardados += carruseles.length;
    for (const f of carruseles) porFormato.set(String(f.formato ?? 'sin tipo'), (porFormato.get(String(f.formato ?? 'sin tipo')) ?? 0) + 1);
    console.log(`  ✔ ${rotulo}: ${items.length} publicaciones → ${carruseles.length} carruseles guardados${aGuardar.length > carruseles.length ? ` (y ${aGuardar.length - carruseles.length} imágenes, para el outlier de la cuenta)` : ''}.`);
    await marcarLeida(l);
  }
  const c1 = await credito(token);
  console.log(`▶ Listo: ${guardados} carruseles guardados. Por tipo: ${[...porFormato].map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}.`);
  if (c1) console.log(`  Crédito de Apify: usado ${usd(c1.usado)} de ${usd(c1.tope)} (esta corrida, unos ${usd(Math.max(0, c1.usado - c0.usado))}).`);
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
  const token = await clave();
  if (!token) { console.log('✖ El negocio de la plataforma no tiene la clave de Spy (Apify). No se gastó nada.'); process.exit(2); }
  const c0 = await credito(token);
  if (!c0) { console.log('✖ No pude leer el crédito del mes de Apify: no se gasta a ciegas.'); process.exit(2); }
  const techo = B.techoConCredito(num('techo-usd', 0.5), c0, B.RESERVA_CREDITO_USD) as number;
  const { ASESORES } = await imp('lib/asesores/catalogo.ts');
  const { buscarPerfilesApify } = await imp('lib/instagram-buscar-apify.ts');
  const { APIFY_TOPE_USD } = await imp('lib/instagram-perfil.ts');
  const faltan = B.referentesSinCuenta(ASESORES, (await S.cuentasDeBiblioteca()) ?? []);
  const alcanza = Math.floor(techo / APIFY_TOPE_USD);
  console.log(`  ${faltan.length} referentes sin cuenta en la lista; alcanza para buscar ${Math.min(alcanza, faltan.length)} (techo ${usd(techo)}).`);
  for (const r of faltan.slice(0, alcanza)) {
    const xs = await buscarPerfilesApify(r.completo, token);
    console.log(`  · ${r.completo} (${r.id}): ${xs.length ? xs.slice(0, 5).map((p: { usuario: string; nombre?: string | null }) => `@${p.usuario}${p.nombre ? ` «${p.nombre}»` : ''}`).join(' · ') : 'sin candidatos'}`);
  }
  console.log('  Ninguno se sumó solo: mira cada perfil y suma el bueno con `sumar @usuario --nombre "…" --referente <id>`.');
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
    console.log(`No conozco «${args.comando}». Comandos: estado, leer, buscar, sumar, sacar, tema (ver la cabecera del script).`);
    process.exit(1);
}
