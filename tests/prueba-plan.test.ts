// =============================================================================
// La PRUEBA GRATIS de 7 días de un plan de MaKo (25/10/2026)
// =============================================================================
// Martín (25/10, ~10:20): «quiero implementar la prueba gratuita de 7 días, y eliminar la garantia de devolución... para
// darte de alta en la prueba gratuita debes poner la tarjeta, tal cual como una suscripción, y se te cobra automático luego de
// esos 7 días». Lo que se cuida acá:
//   · qué cobro es una prueba, la huella de quien la autorizó y cuándo se avisa (lo puro, se ejecuta);
//   · la vigencia: en prueba está al día hasta el cobro; cancelada, cubierta hasta ese día y vencida desde ahí; sin el
//     cobro del día 8, mora. Antes un negocio en prueba era «sin pasarela» y nunca se cortaba;
//   · el cableado (lib/cobros.ts y lib/compra-plan.ts son `server-only`: se leen del FUENTE): el checkout arma la prueba
//     con Mercado Pago o Stripe (27/10) y con el primer cobro a los 7 días; el alta se hace al AUTORIZAR; la suscripción de MaKo del
//     negocio incluye la prueba (los topes, la baja); una prueba repetida se corta en la pasarela ANTES de anularse;
//   · MaKo Partners: el crédito sigue contando cuotas COBRADAS, y la prueba no deja ninguna.
//
// Probado rompiéndolo (25/10/2026): al pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  avisoFinDePrueba, compartenHuella, creadoPorPrueba, DIAS_AVISO_FIN_DE_PRUEBA, esPruebaDePlan, finDeLaPrueba, FILTRO_SUSCRIPCION_DE_MAKO,
  huellaMp, partesDeHuella, PASARELAS_CON_PRUEBA, tocaAvisarFinDePrueba,
} from '../lib/prueba-plan-reglas';
import { DIAS_PARA_SUSPENDER, unMesDespuesDe, vigenciaDelLugar, type CobroDelLugar } from '../lib/plan-acceso-reglas';
import { PRUEBA_DIAS } from '../lib/planes-mako';
import { leerPedidoCompra } from '../lib/compra-plan-reglas';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El cuerpo de una función de un archivo (hasta la función siguiente). */
function cuerpo(rel: string, nombre: string): string {
  const src = fuente(rel);
  const i = src.search(new RegExp(`\\n(?:export )?async function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre} en ${rel}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const |\n\/\*\*/);
  return fin > 0 ? resto.slice(0, fin) : resto;
}
const DIA = 86_400_000;
const T0 = Date.parse('2026-10-25T12:00:00Z');

test('qué cobro es una PRUEBA: una suscripción de la plataforma con alta, creada por /planes con «:prueba»', () => {
  assert.equal(PRUEBA_DIAS, 7);
  assert.equal(creadoPorPrueba('pro'), 'planes:pro:prueba');
  assert.ok(esPruebaDePlan({ tipo: 'suscripcion', alta_capa: 'agencia', creado_por: 'planes:pro:prueba' }));
  assert.ok(!esPruebaDePlan({ tipo: 'suscripcion', alta_capa: 'agencia', creado_por: 'planes:pro' }), 'la compra sin prueba no es una prueba');
  assert.ok(!esPruebaDePlan({ tipo: 'suscripcion', alta_capa: null, creado_por: 'planes:pro:prueba' }), 'sin alta no es la de MaKo');
  assert.ok(!esPruebaDePlan({ tipo: 'unico', alta_capa: 'agencia', creado_por: 'planes:pro:prueba' }));
  assert.ok(!esPruebaDePlan({ tipo: 'suscripcion', alta_capa: 'agencia', creado_por: 'reactivar:12' }), 'quien vuelve no tiene otra prueba');
  assert.equal(finDeLaPrueba(T0), new Date(T0 + 7 * DIA).toISOString());
  // Desde el 27/10/2026 también Stripe (con `trial_period_days`): sin ella, /planes nunca ofrecía Stripe y a quien compraba
  // desde México le llegaba el link de la Mercado Pago argentina (tests/planes-stripe-afuera.test.ts).
  // Las TRES que la arman con tarjeta (31/10/2026, al entrar Creem). ⚠️ Esta lista NO se ensancha sola y es la que
  // decide si una pasarela se OFRECE en /planes (`monedasDeLaPlataforma` saltea la que no esté): una pasarela nueva
  // que sepa hacer la prueba y que nadie agregue acá queda conectada, cobrando e invisible en la vitrina.
  assert.deepEqual([...PASARELAS_CON_PRUEBA], ['mercadopago', 'stripe', 'creem'], 'las que la arman con tarjeta');
});

test('la HUELLA de Mercado Pago: la cuenta que paga y la tarjeta guardada; una coincidencia en cualquiera es la misma persona', () => {
  const a = huellaMp({ pagadorId: '123456', tarjetaId: '987' });
  assert.equal(a, 'mp:123456|card:987');
  assert.deepEqual(partesDeHuella(a), { cuenta: '123456', tarjeta: '987' });
  assert.ok(compartenHuella(a, huellaMp({ pagadorId: '123456', tarjetaId: '555' })), 'la misma cuenta de MP con otra tarjeta');
  assert.ok(compartenHuella(a, huellaMp({ pagadorId: '777', tarjetaId: '987' })), 'la misma tarjeta guardada');
  assert.ok(!compartenHuella(a, huellaMp({ pagadorId: '777', tarjetaId: '555' })));
  assert.equal(huellaMp({ pagadorId: null, tarjetaId: null }), null);
  assert.equal(huellaMp({ pagadorId: 'a b;drop', tarjetaId: null }), null, 'nada raro entra a un filtro de la base');
  assert.ok(!compartenHuella(huellaMp({ pagadorId: null, tarjetaId: '1' }), huellaMp({ pagadorId: null, tarjetaId: '2' })), 'un «-» no es una coincidencia');
});

test('el AVISO: una vez, en los 2 días antes del cobro, con el monto, el día y cómo darse de baja', () => {
  const inicio = new Date(T0 + 7 * DIA).toISOString();
  assert.equal(DIAS_AVISO_FIN_DE_PRUEBA, 2);
  assert.ok(!tocaAvisarFinDePrueba({ inicioAt: inicio, ahoraMs: T0 + 4 * DIA, avisadoAt: null }), 'faltan 3 días');
  assert.ok(tocaAvisarFinDePrueba({ inicioAt: inicio, ahoraMs: T0 + 5 * DIA + 1, avisadoAt: null }), 'faltan menos de 2');
  assert.ok(!tocaAvisarFinDePrueba({ inicioAt: inicio, ahoraMs: T0 + 6 * DIA, avisadoAt: '2026-10-30T13:00:00Z' }), 'una sola vez');
  assert.ok(!tocaAvisarFinDePrueba({ inicioAt: inicio, ahoraMs: T0 + 8 * DIA, avisadoAt: null }), 'el cobro ya pasó');
  const m = avisoFinDePrueba({ nombrePlan: 'MaKo Pro', monto: 'US$ 97', inicioAt: inicio, linkPlan: 'https://hola-mako.com/configuraciones/plan' });
  assert.equal(m.asunto, 'Tu prueba gratis de MaKo Pro termina en 2 días');
  assert.match(m.cuerpo, /se cobra US\$ 97 con tu tarjeta/);
  assert.match(m.cuerpo, /date de baja antes desde «Tu plan» y no se te cobra nada:\nhttps:\/\/hola-mako\.com\/configuraciones\/plan/);
});

// ── La vigencia del lugar ────────────────────────────────────────────────────────────────────────────────────────

const prueba = (p: Partial<CobroDelLugar> = {}): CobroDelLugar => ({
  id: 7, tipo: 'suscripcion', estado: 'pendiente', suscripcion_estado: 'activa', pagado_at: null, reembolsado_at: null,
  inicio_at: new Date(T0 + 7 * DIA).toISOString(), created_at: new Date(T0).toISOString(), monto: 97, moneda: 'USD', monto_usd: 97,
  creado_por: 'planes:pro:prueba', alta_capa: 'agencia', ...p,
});
const diaDe = (ms: number) => new Date(ms).toISOString().slice(0, 10);

test('la VIGENCIA en prueba: al día hasta el cobro; sin el cobro del día 8, mora y después vencido', () => {
  const hasta = diaDe(T0 + 7 * DIA);
  assert.deepEqual(vigenciaDelLugar([prueba()], [], T0 + 3 * DIA), { estado: 'al-dia', cobroId: 7, hasta });
  const mora = vigenciaDelLugar([prueba()], [], T0 + 8 * DIA);
  assert.equal(mora.estado, 'mora');
  assert.equal(mora.estado === 'mora' && mora.deuda.monto, 97, 'se debe el primer período');
  assert.equal(vigenciaDelLugar([prueba()], [], T0 + (8 + DIAS_PARA_SUSPENDER) * DIA).estado, 'vencido');
});

test('la VIGENCIA de una prueba CANCELADA: cubierta hasta el día del cobro y vencida desde ese día (sin gracia)', () => {
  const hasta = diaDe(T0 + 7 * DIA);
  const c = prueba({ suscripcion_estado: 'cancelada' });
  assert.deepEqual(vigenciaDelLugar([c], [], T0 + 3 * DIA), { estado: 'cubierto', cobroId: 7, hasta, motivo: 'baja' });
  assert.deepEqual(vigenciaDelLugar([c], [], T0 + 7 * DIA + 1), { estado: 'vencido', cobroId: 7, hasta, motivo: 'baja' });
  assert.notEqual(vigenciaDelLugar([c], [], T0 + 400 * DIA).estado, 'sin-pasarela', 'antes era «sin pasarela»: acceso para siempre');
});

test('la VIGENCIA: una prueba que nadie autorizó no cubre nada, y una que ya se cobró es un plan como cualquiera', () => {
  assert.equal(vigenciaDelLugar([prueba({ suscripcion_estado: null })], [], T0 + DIA).estado, 'sin-pasarela');
  const cobrada = prueba({ estado: 'pagado', pagado_at: new Date(T0 + 7 * DIA).toISOString() });
  const v = vigenciaDelLugar([cobrada], [{ cobro_id: 7, pagado: true, fecha_pago: diaDe(T0 + 7 * DIA) }], T0 + 10 * DIA);
  assert.equal(v.estado, 'al-dia');
  assert.equal(v.estado === 'al-dia' ? v.hasta : null, unMesDespuesDe(diaDe(T0 + 7 * DIA)), 'un mes después del primer cobro');
});

// ── El cableado (se lee del fuente) ──────────────────────────────────────────────────────────────────────────────

test('el CHECKOUT: sólo con la pasarela que arma la prueba, una por email/cuenta ANTES de abrir el pago, y el cobro a 7 días', () => {
  const plan = fuente('lib/compra-plan.ts');
  assert.match(cuerpo('lib/compra-plan.ts', 'monedasDeLaPlataforma'), /if \(!PASARELAS_CON_PRUEBA\.includes\(p\)\) continue;/);
  const comprar = cuerpo('lib/compra-plan.ts', 'iniciarCompraDePlan');
  const freno = comprar.indexOf('const puede = await puedeEmpezarPrueba(p.email, ws);');
  assert.ok(freno > 0 && freno < comprar.indexOf('crearCobro('), 'la segunda prueba se frena antes de abrir el pago');
  // Con el interruptor (30/10/2026): el camino de la prueba sigue entero, y sólo se toma con `PRUEBA_GRATIS_PRENDIDA`.
  // Y desde el 12/11/2026, sólo en el plan que la trae (`planConPrueba`: Pro; Martín: «para acceder a la de 47 hay que pagar
  // directamente»). `planConPrueba` mira el interruptor adentro.
  assert.match(comprar, /const conPrueba = planConPrueba\(plan\.id\) && !p\.sinPrueba;/);
  assert.match(comprar, /creadoPor: conPrueba \? creadoPorPrueba\(plan\.id\) : conDescuento \? creadoPorPrimerMes\(plan\.id\) : `planes:\$\{plan\.id\}`,/);
  assert.match(comprar, /inicioAt: conPrueba \? finDeLaPrueba\(Date\.now\(\)\) : null,/, 'el primer cobro, el día 8 (el start_date de MP)');
  assert.match(comprar, /: \{ ok: false, status: 409, error: TEXTO_PRUEBA_USADA_EMAIL, sinPrueba: true \};/, 'quien ya la usó puede empezar sin ella');
  const puede = cuerpo('lib/compra-plan.ts', 'puedeEmpezarPrueba');
  assert.match(puede, /\(await listarUsuarios\(\)\)\.some\(\(u\) => u\.email === email\)/, 'un negocio que ya existe no tiene prueba');
  assert.match(puede, /\.eq\('email', email\)\.like\('creado_por', 'planes:%:prueba'\)\.not\('suscripcion_estado', 'is', null\)/, 'una prueba autorizada por email');
  assert.ok(plan.includes("import { listarUsuarios } from './usuarios';"));
  const r = leerPedidoCompra({ plan: 'pro', nombre: 'Ana', email: 'a@x.com', sinPrueba: true });
  assert.ok(r.ok && r.pedido.sinPrueba === true);
  assert.ok(fuente('app/api/planes/comprar/route.ts').includes('...(r.sinPrueba ? { sinPrueba: true } : {})'));
  assert.match(fuente('app/planes/[plan]/CompraPlan.tsx'), /onClick=\{\(e\) => \{ setSinPrueba\(true\); void enviar\(e, true\); \}\}>Empezar sin prueba<\/button>/);
});

test('el ALTA al autorizar la prueba; la SUSCRIPCIÓN DE MaKo del negocio incluye la prueba (topes, baja, «Tu plan»)', () => {
  const alta = cuerpo('lib/cobros.ts', 'altaSiCorresponde');
  assert.match(alta, /const pruebaAutorizada = esPruebaDePlan\(c\) && c\.estado === 'pendiente' && c\.suscripcion_estado === 'activa';/);
  assert.match(alta, /if \(!c\.alta_capa \|\| \(c\.estado !== 'pagado' && !pruebaAutorizada\)\) return;/);
  assert.equal(FILTRO_SUSCRIPCION_DE_MAKO, 'estado.eq.pagado,and(estado.eq.pendiente,suscripcion_estado.not.is.null,creado_por.like.planes:*:prueba)');
  const filtro = ".eq('workspace_id', plataforma).eq('alta_ws', ws).eq('tipo', 'suscripcion').or(FILTRO_SUSCRIPCION_DE_MAKO)";
  assert.ok(cuerpo('lib/cobros.ts', 'suscripcionDeMakoDe').includes(filtro), 'suscripcionDeMakoDe');
  assert.ok(fuente('lib/plan-esencial.ts').includes(filtro), 'los topes de Esencial leen lo mismo');
  assert.match(fuente('lib/plan-acceso.ts'), /const COLS = '[^']*creado_por, alta_capa';/, 'la vigencia ve la marca de la prueba');
  const baja = cuerpo('lib/cobros.ts', 'darDeBajaMiPlan');
  const rama = baja.indexOf("if (esPruebaDePlan(c) && c.estado === 'pendiente') {");
  assert.ok(rama > 0 && rama < baja.indexOf("if (c.proveedor === 'stripe') {"), 'la baja en prueba va antes que la de un plan pagado');
  assert.match(baja.slice(rama), /^[^]*?const r = await cancelarSuscripcionCobro\(c\.workspace_id, c\.id, autor\);/, 'se cancela en el acto: el día 8 no cobra');
});

test('la ACTIVACIÓN: sólo autorizada y de la cuenta de MaKo; una huella repetida se corta en la pasarela ANTES de anular', () => {
  const f = cuerpo('lib/cobros.ts', 'activarPruebaSiAutorizo');
  // Mercado Pago: autorizada, cobrada por la cuenta de MaKo y de ESTE cobro (`pruebaAutorizadaMp`).
  assert.match(cuerpo('lib/cobros.ts', 'pruebaAutorizadaMp'), /if \(!s\.ok \|\| s\.estado !== 'authorized' \|\| s\.cobradorId !== mp\.userId \|\| s\.referencia !== c\.token\) return null;/);
  assert.match(cuerpo('lib/cobros.ts', 'pruebaAutorizadaMp'), /cancelar: \(\) => cancelarSuscripcionMp\(mp\.token, s\.id, idemBaja\(c\.id\)\)/);
  // Cada pasarela contesta por lo suyo (la prueba de Creem se le preguntaba a Mercado Pago), y sin autorización no sigue nada.
  assert.match(f, /const s = await pruebaAutorizada\(c, plataforma\);\n\s*if \(!s\) return null;/, 'una prueba sin autorizar entregaría la cuenta');
  const quien = cuerpo('lib/cobros.ts', 'pruebaAutorizada');
  assert.match(quien, /case 'mercadopago': return pruebaAutorizadaMp\(c, plataforma\);/);
  assert.match(quien, /const _x: never = c\.proveedor;/, 'sin el `never`, la pasarela siguiente vuelve a caer en la de otra');
  const corte = f.indexOf('const corte = await s.cancelar();');
  const anula = f.indexOf("estado: 'anulado', suscripcion_estado: 'cancelada'");
  assert.ok(corte > 0 && anula > corte, 'primero se corta el cobro en la pasarela; si no, el día 8 cobraría una prueba anulada');
  assert.match(f.slice(corte, anula), /if \(!corte\.ok\) \{\s*console\.error\([^\n]*\);\s*return null;\s*\}/, 'si la pasarela no la canceló, no se anula nada (el cron reintenta)');
  const activa = f.indexOf("{ suscripcion_estado: 'activa', proveedor_suscripcion_id: s.id");
  assert.ok(activa > anula && f.indexOf('altaSiCorresponde(r)') > activa, 'el alta, con la suscripción ya activa');
  assert.match(f, /update\(\{ prueba_huella: huella \}\)/);
  // La llaman la página de vuelta y el cron.
  assert.match(fuente('app/pagar/[token]/listo/page.tsx'), /if \(await activarPruebaSiAutorizo\(c\)\) c = /);
  const cron = cuerpo('lib/cobros.ts', 'reconciliarCobros');
  assert.match(cron, /if \(esPruebaDePlan\(c\) && c\.estado === 'pendiente' && !c\.suscripcion_estado\) \{\s*if \(await activarPruebaSiAutorizo\(c\)\) cambiados\+\+;\s*continue;/);
});

test('la PÁGINA DE VUELTA: «Tu prueba gratis empezó» con el día del cobro; la repetida dice por qué y ofrece empezar sin prueba', () => {
  const p = fuente('app/pagar/[token]/listo/page.tsx');
  assert.match(p, /titulo="Tu prueba gratis empezó"/);
  assert.match(p, /No se te cobró nada\./);
  // Se dice por qué, y «esa tarjeta» sólo si la pasarela de verdad la reconoce (Creem no: va por email).
  assert.match(p, /huellaDeTarjeta \? TEXTO_PRUEBA_USADA_TARJETA : TEXTO_PRUEBA_USADA_EMAIL/);
  assert.match(p, /href=\{`\/planes\/\$\{plan\}\?sinPrueba=1`\}>Empezar sin prueba<\/a>/);
  assert.match(fuente('app/planes/[plan]/page.tsx'), /const conPrueba = planConPrueba\(plan\.id\) && uno\('sinPrueba'\) !== '1';/);
  assert.match(fuente('app/planes/[plan]/page.tsx'), /sinPrueba=\{!conPrueba\}/);
});

test('el AVISO por email: un cron diario con su auth primero, sólo pruebas autorizadas, y la marca de la mig 0334', () => {
  const r = fuente('app/api/cron/aviso-fin-de-prueba/route.ts');
  assert.match(r, /export async function GET\(req: NextRequest\) \{\n  const auth = checkCronAuth\(req\);\n  if \(auth\) return auth;/);
  assert.match(fuente('vercel.json'), /"path": "\/api\/cron\/aviso-fin-de-prueba",\s*"schedule": "0 13 \* \* \*"/);
  const f = fuente('lib/prueba-plan.ts');
  assert.match(f, /\.eq\('estado', 'pendiente'\)\.eq\('suscripcion_estado', 'activa'\)\s*\.like\('creado_por', 'planes:%:prueba'\)/);
  assert.match(f, /update\(\{ prueba_aviso_at: new Date\(ahoraMs\)\.toISOString\(\) \}\)/);
  const mig = fuente('supabase/migrations/0334_prueba_de_plan.sql');
  assert.match(mig, /alter table cobros add column if not exists prueba_huella text/);
  assert.match(mig, /alter table cobros add column if not exists prueba_aviso_at timestamptz;/);
});

test('MaKo PARTNERS: el crédito cuenta cuotas COBRADAS, y la prueba no deja ninguna hasta el día 8', () => {
  const meses = cuerpo('lib/partners-programa.ts', 'mesesPagadosDe');
  assert.match(meses, /const cuotas = await cuotasDeLugares\(plataforma, cobros\.map\(\(c\) => c\.id\)\);/);
  assert.match(cuerpo('lib/plan-acceso.ts', 'cuotasDeLugares'), /\.eq\('pagado', true\)/, 'sólo las cobradas');
  // La prueba no asienta ninguna cuota: el alta al autorizar no pasa por `aplicarPagoAprobado`.
  assert.doesNotMatch(cuerpo('lib/cobros.ts', 'activarPruebaSiAutorizo'), /aplicarPagoAprobado|asentarCuota|insert\(/);
});

// Roturas (25/10/2026; base 34 / 0 con mi-plan, plan-esencial y compra-plan), cada una restaurada (pasan / fallan):
//   · el alta sólo al pagar (la prueba sin cuenta)                          -> 33 / 1
//   · la suscripción de MaKo sin la prueba (sin topes ni baja)              -> 31 / 3
//   · los topes de Esencial sin la prueba                                   -> 32 / 2
//   · la baja en prueba como la de un plan pagado                           -> 33 / 1
//   · una prueba repetida se anula aunque MP no la haya cancelado           -> 33 / 1
//   · la prueba se activa sin estar autorizada                              -> 33 / 1
//   · sin el freno de la segunda prueba por email                           -> 33 / 1
//   · un negocio que ya existe vuelve a tener prueba                        -> 33 / 1
//   · el cobro desde el primer día (sin los 7 días)                         -> 33 / 1
//   · la prueba con Stripe también                                          -> 33 / 1
//   · la vigencia sin la prueba (sin pasarela = para siempre)               -> 32 / 2
//   · la prueba cancelada con la gracia de un plan pagado                   -> 33 / 1
//   · la huella acepta cualquier cosa                                       -> 33 / 1
//   · el aviso se manda todos los días                                      -> 33 / 1
//   · el cron del aviso sin la auth primero                                 -> 33 / 1
//   · la vuelta del pago no activa la prueba                                -> 33 / 1
//   · el cron no activa la prueba que nadie vio                             -> 33 / 1
//   · Partners cuenta cuotas sin cobrar                                     -> 33 / 1
