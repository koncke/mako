// =============================================================================
// ¿Se puede repetir un pedido de generación contra el Flow nuevo?
// =============================================================================
// Antes de escribir el transporte del replay hay UNA pregunta que decide si el
// frente es viable, y se contesta GRATIS con datos que ya están en producción:
//
//   ¿El espejo ve a BOQ acuñar su token de reCAPTCHA?
//
// Si lo ve, sabemos la ACCIÓN con la que lo acuña — y reCAPTCHA Enterprise ATA el
// token a la acción: con una acción equivocada Google contesta 403 «reCAPTCHA
// evaluation failed», que es el mismo cuerpo que devuelve un token robado. Sin ese
// dato no se puede reponer un token fresco, y el replay no se puede escribir: el
// camino pasa a ser manejar la UI de Flow, que es otro proyecto.
//
// En el Flow VIEJO el envoltorio de `grecaptcha.enterprise.execute` no capturó nada
// en dos intentos y hubo que leer el bundle a mano (ver background.js, la sección
// de la acción del captcha). O sea que la respuesta no es obvia y hay que mirarla.
//
// ⚠️ UN VACÍO NO PRUEBA QUE NO ACUÑE. Prueba que NOSOTROS no lo vimos, que es otra
// cosa — y este script lo dice así, en vez de dar un cero con cara de conclusión.
//
//   npx tsx --conditions=react-server scripts/flow-viabilidad-replay.ts
//
// ⚠️ SOLO LEE.
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });
import { getSupabaseServer } from '../lib/supabase';

async function main() {
  const db = getSupabaseServer();
  const { data, error } = await db
    .from('flow_puentes')
    .select('workspace_id, etiqueta, estado, version, acciones_captcha, ultimo_visto, project_id')
    .order('ultimo_visto', { ascending: false });

  if (error) {
    console.error('No pude leer flow_puentes:', error.message);
    process.exit(1);
  }
  const filas = data || [];
  if (!filas.length) {
    console.log('No hay ningún puente registrado. Nada que medir todavía.');
    return;
  }

  console.log(`${filas.length} puentes registrados.\n`);
  let conAcciones = 0;
  for (const f of filas) {
    const acc = String(f.acciones_captcha || '').trim();
    if (acc) conAcciones++;
    const visto = f.ultimo_visto ? new Date(String(f.ultimo_visto)) : null;
    const hace = visto ? `${Math.round((Date.now() - visto.getTime()) / 60000)} min` : 'nunca';
    console.log(`ws ${f.workspace_id} · ${f.etiqueta || '—'}`);
    console.log(`   estado ${f.estado || '—'} · v${f.version || '—'} · visto hace ${hace}`);
    console.log(`   acciones de captcha vistas: ${acc || '(ninguna)'}`);
    console.log(`   projectId de Flow: ${f.project_id || '—'}`);
    console.log('');
  }

  console.log('─'.repeat(66));
  // ⚠️ LA PREGUNTA NO ES «¿ALGUIEN VIO EL CAPTCHA?» SINO «¿ALGUIEN LO VIO EN BOQ?».
  //
  // Es la trampa de «una observación verdadera que también vale para los casos
  // buenos no explica nada»: el Flow VIEJO acuñaba el captcha y eso está medido
  // desde hace meses. Contar esas filas daría VIABLE sobre una pregunta que nadie
  // contestó, y mandaría a escribir un transporte que quizá no puede funcionar.
  //
  // El discriminador es la versión de la extensión: el soporte de BOQ entró en la
  // 0.45.0 (es la primera que espeja XHR con cuerpo, que es como manda BOQ). Una
  // fila anterior a eso midió el Flow viejo, diga lo que diga.
  const eraBoq = (v: string) => {
    const [a, b] = String(v || '').split('.').map(Number);
    return Number.isFinite(a) && Number.isFinite(b) && (a > 0 || b >= 45);
  };
  const boq = filas.filter((f) => eraBoq(String(f.version || '')));
  const boqConAcciones = boq.filter((f) => String(f.acciones_captcha || '').trim());

  console.log(`Puentes en la era BOQ (extensión ≥ 0.45.0): ${boq.length} de ${filas.length}.`);
  if (boqConAcciones.length) {
    console.log(`VIABLE: ${boqConAcciones.length} vieron acuñar el captcha EN BOQ.`);
    console.log(`Acciones: ${boqConAcciones.map((f) => f.acciones_captcha).join(' · ')}`);
    console.log('Sabemos con qué acción lo pide, así que se puede reponer un token fresco.');
    return;
  }
  if (conAcciones) {
    console.log(`⚠️  NO MEDIDO EN BOQ. ${conAcciones} fila(s) vieron acuñar el captcha, pero`);
    console.log('    TODAS son de extensiones anteriores a la 0.45.0, o sea del Flow VIEJO.');
    console.log('    Eso ya se sabía y no contesta la pregunta de este script.');
    console.log('');
    console.log('    Qué falta: UNA generación en flow.google.com con la extensión al día.');
    console.log('    Después volver a correr esto. Hasta entonces el transporte del replay');
    console.log('    no se escribe: sin la acción, un token repuesto da 403 «reCAPTCHA');
    console.log('    evaluation failed» — el mismo cuerpo que devuelve un token robado, o');
    console.log('    sea el error más caro de diagnosticar que tiene este sistema.');
    return;
  }
  {
    // ⚠️ Se dice qué NO prueba, además de qué muestra. Un cero acá manda a rehacer
    // la arquitectura entera, así que tiene que venir con su alcance escrito.
    console.log('NO MEDIDO TODAVÍA: ningún puente reportó acciones de captcha.');
    console.log('');
    console.log('Eso NO prueba que BOQ no lo acuñe: prueba que nuestro espejo no lo vio.');
    console.log('Las dos explicaciones caben y son muy distintas:');
    console.log('  (a) nadie generó nada con una extensión que sepa reportarlo, o');
    console.log('  (b) BOQ acuña el token por un camino que el envoltorio no cubre');
    console.log('      (un worker, un iframe, un bundle que guarda la referencia antes).');
    console.log('');
    console.log('Se separan con UNA generación manual y volviendo a correr esto. Hasta');
    console.log('entonces, el transporte del replay no se escribe: sin la acción, un token');
    console.log('repuesto da 403 «reCAPTCHA evaluation failed» — el mismo cuerpo que');
    console.log('devuelve un token robado, o sea el error más caro de diagnosticar.');
  }
}

void main();
