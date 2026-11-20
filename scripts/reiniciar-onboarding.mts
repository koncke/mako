// =============================================================================
// reiniciar-onboarding — el onboarding y el reto de un negocio, de cero, SIN tocar lo suyo (20/11/2026)
// =============================================================================
// Martín, 20/11: «resetea al usuario de Leila para que ella pueda hacer todo el onboarding… sin que pierda su información». Lo mismo
// que el botón «Reiniciar onboarding» de la vista de administrador: las dos cosas llaman a `reiniciarOnboarding`
// (lib/reiniciar-onboarding-server.ts); qué se reinicia y qué queda lo dice lib/reiniciar-onboarding.ts.
//
// Desde la PC del Cerebro (lee y escribe la base de PRODUCCIÓN):
//
//   node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/reiniciar-onboarding.mts 11
//
// y, mirando lo que lista, otra vez con `--aplicar`.
//
// ⚠️ SIN `--aplicar`, SÓLO LEE Y LISTA. Con `--aplicar`, antes de escribir deja un respaldo con lo de antes (las claves y el perfil
//    del dueño, enteros): respaldo-reiniciar-onboarding-ws<ws>-<fecha>.json en C:/dev/respaldos, o en la carpeta de
//    `--respaldo=<carpeta>` / MAKO_RESPALDOS. NUNCA adentro de un repo (lib/respaldo-fuera-del-repo.ts): son datos de una clienta, y el
//    primero, el de Leila, quedó en la raíz del repo sin que git lo ignorara.
// ⚠️ Cada escritura es un compare-and-set: si la persona estaba usando MaKo y algo cambió en el medio, no se pisa y se avisa.
// ⚠️ Nunca en el negocio del dueño (ws 1) ni en el cliente de una agencia (le movería el cobro del primer mes): se niega.
// ⚠️ Su WhatsApp sigue verificado. Que recargue MaKo si lo tenía abierto (el navegador se limpia al cargar).
// =============================================================================

import { reiniciarOnboarding } from '../lib/reiniciar-onboarding-server';
import { carpetaDeRespaldos, escribirRespaldo } from '../lib/respaldo-fuera-del-repo';

const ws = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)));
const aplicar = process.argv.includes('--aplicar');
const respaldoEn = carpetaDeRespaldos({ pasada: process.argv.find((a) => a.startsWith('--respaldo='))?.slice('--respaldo='.length) });
if (!Number.isSafeInteger(ws) || ws <= 0) {
  console.error('uso: node --conditions=react-server --env-file=<.env.local> --import tsx scripts/reiniciar-onboarding.mts <ws> [--aplicar] [--respaldo=<carpeta fuera del repo>]');
  process.exit(2);
}

try {
  // Primero en seco SIEMPRE: el respaldo sale de esta lectura y se escribe antes de tocar nada.
  const seco = await reiniciarOnboarding(ws, { aplicar: false });
  const imprimir = (r: typeof seco.resultado) => {
    console.log(`\nws ${ws} — ${r.aplicado ? 'REINICIADO' : 'EN SECO (no se escribió nada)'}`);
    console.log('\nLo que se reinicia:');
    for (const c of r.cambios) console.log(`  · ${c.key}: ${c.nota}`);
    if (!r.cambios.length) console.log('  · (nada en el negocio: no tenía estado del onboarding)');
    if (r.perfil) console.log(`  · el perfil de ${r.perfil.email}: ${r.perfil.quitados.length ? r.perfil.quitados.join(', ') : 'nada que quitar'} (y la marca del reinicio)`);
    console.log('\nLo que queda:');
    for (const q of r.queda) console.log(`  · ${q}`);
    for (const a of r.avisos) console.log(`\n⚠️ ${a}`);
  };
  if (!aplicar) {
    imprimir(seco.resultado);
    console.log('\nPara hacerlo: el mismo comando con --aplicar.');
    process.exit(0);
  }
  // Si la carpeta está adentro de un repo, esto tira y no se escribe nada en la base.
  const archivo = escribirRespaldo(respaldoEn, `respaldo-reiniciar-onboarding-ws${ws}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, seco.respaldo);
  console.log(`Respaldo: ${archivo}`);
  const hecho = await reiniciarOnboarding(ws, { aplicar: true });
  imprimir(hecho.resultado);
  process.exit(hecho.resultado.avisos.length ? 1 : 0);
} catch (e) {
  console.error(`No se reinició: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
