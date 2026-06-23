// Seed/upsert de las 13 secuencias de nutrición del VSL funnel en
// nutricion_secuencias. Idempotente (on conflict por clave). Copy = docs/nutricion-templates.md.
// Uso: node scripts/seed-nutricion-secuencias.cjs   (lee DATABASE_URL de .env.local)
const fs = require('fs');
const postgres = require('postgres');
const m = fs.readFileSync(process.cwd() + '/.env.local', 'utf8').match(/^DATABASE_URL=(.+)$/m);
const sql = postgres(m[1].trim(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 15 });

const CAL = 'https://calendly.com/mauriciobustoseguia/60min';
const step = (orden, delay_horas, template_wa, categoria, cuerpo) => ({
  orden, canal: 'whatsapp', delay_horas, asunto: null, cuerpo,
  template_wa, template_categoria: categoria, template_idioma: 'es_MX', template_param: 'nombre',
});
const wa = (o, d, t, c) => step(o, d, t, 'marketing', c);
const ut = (o, d, t, c) => step(o, d, t, 'utility', c);

const SEQS = [
  ['form-sin-agenda', 'Instant form sin agenda', 'nutri', 'instant_form_sin_agenda', [
    wa(1, 1, 'nutri_form_1', `Hola {{nombre}}, soy Mauricio Bustos. Completaste el formulario porque querés que tu empresa crezca sin depender de vos en todo. Te ofrezco una sesión de 30 min sin costo para diagnosticar qué te está frenando — no es venta, es análisis. Agendá acá: ${CAL}`),
    wa(2, 24, 'nutri_form_2', `{{nombre}}, un dato: la mayoría de los dueños que nos contactan tienen crecimiento pero no les alcanza el tiempo. Eso no se arregla con más marketing, sino con estructura, ritmo de ejecución y accountability. En 30 min vemos qué te frena: ${CAL}`),
    wa(3, 72, 'nutri_form_3', `{{nombre}}, te lo dejo por última vez: tengo espacios esta semana para diagnósticos sin costo, de 30 min. Si ves un fit, hablamos; si no, te llevás un análisis fresco de tu negocio. Acá el link: ${CAL}`)]],
  ['vio-vsl-sin-agendar', 'Vio el VSL sin agendar', 'nutri', 'vio_vsl_sin_agendar', [
    wa(1, 24, 'nutri_vsl_1', `Hola {{nombre}}, soy Mauricio. Vi que miraste el video sobre el Sistema DOS™. ¿Querés agendar tu Diagnóstico Estratégico sin costo para ver cómo aplicarlo en tu empresa? Tengo lugares esta semana: ${CAL}`),
    wa(2, 96, 'nutri_vsl_2', `{{nombre}}, una última cosa. Muchos dueños que vieron ese video descubrieron cómo sistematizar su operación y crecer sin estar en cada decisión. ¿Vemos en 30 min si te aplica? Sin costo: ${CAL}`)]],
  ['vio-poco-vsl', 'Vio poco del VSL', 'nutri', 'vio_poco_vsl', [
    wa(1, 24, 'nutri_vslcorto_1', `Hola {{nombre}}, soy Mauricio. Vi que entraste a la landing pero no llegaste a ver el video completo. En 23 min muestra cómo ordenar tu empresa para que crezca sin depender de vos. Y si preferís ir al grano, agendá un diagnóstico de 30 min sin costo: ${CAL}`),
    wa(2, 96, 'nutri_vslcorto_2', `{{nombre}}, si el video no es lo tuyo, vamos directo: una reunión de 30 min, sin costo, donde sacamos un diagnóstico estratégico en vivo. ¿Te late? ${CAL}`)]],
  ['agendado-sin-confirmar', 'Agendó pero no confirmó', 'postagenda', 'agendado_sin_confirmar', [
    ut(1, 24, 'conf_agenda_1', `Hola {{nombre}}, soy del equipo de Mauricio Bustos. Tenés agendado tu Diagnóstico Estratégico con nosotros. ¿Me confirmás que vas a poder asistir? Si necesitás reprogramar: ${CAL}`),
    ut(2, 48, 'conf_agenda_2', `{{nombre}}, te recordamos tu Diagnóstico con Mauricio. ¿Seguís confirmado? Si cambió algo, reprogramá sin problema: ${CAL}`)]],
  ['no-show-j1', 'No asistió a Junta 1', 'noshow', 'no_show_j1', [
    ut(1, 2, 'noshow_j1_1', `Hola {{nombre}}, soy Mauricio. No pudimos conectar en tu Diagnóstico de hoy — sin drama, sé que el día se complica. Ese análisis es clave para ver el cuello de botella de tu ejecución. Reagendá acá: ${CAL}`),
    ut(2, 24, 'noshow_j1_2', `{{nombre}}, te dejo el seguimiento. El Diagnóstico sigue en pie y es el primer paso para ordenar tu empresa. Elegí el horario que te funcione: ${CAL}`)]],
  ['post-j1-sin-avanzar', 'Completó J1 pero no avanza', 'postagenda', 'post_j1_sin_avanzar', [
    wa(1, 1, 'postj1_1', `{{nombre}}, gracias por la reunión de hoy. Vimos que tu empresa crece pero el tiempo no te alcanza para estar en todo — ese es justo el problema que resuelve el Sistema DOS™. ¿Te quedó clara la diferencia entre cómo trabajás hoy y lo que podríamos implementar?`),
    wa(2, 48, 'postj1_2', `{{nombre}}, ¿pudiste pensar en lo que hablamos? Las empresas que aplican el Sistema DOS™ bajan fuerte su dependencia del dueño en pocos meses. Si te quedó alguna duda antes de avanzar, contámela.`),
    wa(3, 120, 'postj1_3', `{{nombre}}, en la reunión me dijiste que tu mayor reto es la ejecución. Para eso el Sistema DOS™ instala rutinas, accountability y ritmo. El siguiente paso es armar tu plan juntos. ¿Lo agendamos? ${CAL}`)]],
  ['post-j1-calificado-sin-j2', 'Calificado sin J2', 'postagenda', 'post_j1_calificado_sin_j2', [
    wa(1, 24, 'calif_j2_1', `{{nombre}}, quedamos en avanzar a la segunda sesión para armar tu plan con el Sistema DOS™. Te dejo el link para que elijas horario: ${CAL}`),
    wa(2, 96, 'calif_j2_2', `{{nombre}}, sigo con un lugar reservado para tu segunda sesión. Ahí bajamos todo a un plan concreto de 90 días. ¿La agendamos esta semana? ${CAL}`)]],
  ['no-show-j2', 'No asistió a Junta 2', 'noshow', 'no_show_j2', [
    ut(1, 4, 'noshow_j2_1', `Hola {{nombre}}, soy Mauricio. No pudimos vernos en la sesión de hoy — entiendo, pasa. Me gustaría retomar donde quedamos y dejarte tu plan armado. ¿Reagendamos? ${CAL}`),
    ut(2, 24, 'noshow_j2_2', `{{nombre}}, te dejo esto por si se te pasó. Lo que vimos en la primera sesión sigue vigente y el plan está a un paso. ¿Lo retomamos? ${CAL}`)]],
  ['post-j2-sin-cerrar', 'Completó J2 pero no cierra', 'nopaga', 'post_j2_sin_cerrar', [
    wa(1, 1, 'postj2_1', `{{nombre}}, gracias por tu tiempo hoy. Con lo que vimos, te dejo 3 cosas para arrancar ya: 1) definí quién lidera operaciones, ventas y finanzas, 2) fijá tus 3 objetivos para los próximos 90 días, 3) instalá una reunión semanal de 60 min de accountability. Cualquier duda, acá ando.`),
    wa(2, 48, 'postj2_2', `{{nombre}}, ¿cómo vas con los 3 puntos que vimos? Muchos llegan acá y no saben por dónde empezar — es normal. Estructurar tu equipo de dirección y afinar tus objetivos es el trabajo del Sistema DOS™. Contame cómo lo ves.`),
    wa(3, 120, 'postj2_3', `{{nombre}}, último mensaje por acá: la brecha entre saber qué hacer y hacerlo es enorme, y por eso el Sistema DOS™ es un acompañamiento de 90 días que instala disciplina en tu equipo. Si lo viste claro, podemos empezar esta semana. ¿Lo charlamos? ${CAL}`)]],
  ['confirmado-sin-pago', 'Confirmó pero no pagó', 'nopaga', 'confirmado_sin_pago', [
    ut(1, 1, 'pago_1', `Hola {{nombre}}, confirmamos tu lugar en el Sistema DOS™. Para dejarlo formalizado, ¿procedemos con el primer pago? Si tenés alguna duda o querés ver opciones de pago, contame y lo resolvemos.`),
    ut(2, 24, 'pago_2', `{{nombre}}, te escribo para coordinar el primer pago y dejar tu inicio agendado. Si necesitás financiar la inversión o ajustar algo, lo vemos sin problema. ¿Cómo preferís avanzar?`),
    ut(3, 72, 'pago_3', `{{nombre}}, te dejo el último recordatorio para formalizar tu lugar en el Sistema DOS™. ¿Lo cerramos? Si algo te frena, contámelo y lo resolvemos juntos.`)]],
  ['post-pago-bienvenida', 'Bienvenida post-pago', 'postagenda', 'post_pago', [
    ut(1, 1, 'bienvenida_1', `¡Bienvenido al Sistema DOS™, {{nombre}}! Recibimos tu pago y ya sos parte. En las próximas horas te llega el acceso y los siguientes pasos para arrancar. Cualquier cosa, por acá estamos.`)]],
  ['reactivacion-viejo', 'Reactivación de lead frío', 'manual', 'reactivacion_viejo', [
    wa(1, 1, 'react_1', `Hola {{nombre}}, soy Mauricio. Hace un tiempo mostraste interés en Negocio que Escala™ pero no llegamos a agendar. ¿Seguís buscando que tu empresa crezca sin depender de vos? Tengo 30 min esta semana para un diagnóstico sin costo: ${CAL}`),
    wa(2, 96, 'react_2', `{{nombre}}, último intento por acá: si antes no era el momento, capaz ahora sí. Tengo un espacio esta semana para ayudarte a ver por qué el negocio no crece al ritmo que querés. 30 min, sin costo: ${CAL}`)]],
  ['ultimo-intento-antes-noresp', 'Último intento antes de no-responde', 'manual', 'ultimo_intento_antes_noresp', [
    wa(1, 1, 'ultimo_1', `Hola {{nombre}}, te escribo una última vez. Quedó pendiente tu Diagnóstico de 30 min, sin costo y sin compromiso — te ayuda a ver dónde está el cuello de botella de tu negocio. Si te sigue interesando, agendá acá: ${CAL}`)]],
];

(async () => {
  for (const [clave, nombre, etapa, trigger, pasos] of SEQS) {
    await sql`insert into nutricion_secuencias (clave, nombre, etapa, trigger_tipo, activa, pasos)
      values (${clave}, ${nombre}, ${etapa}, ${trigger}, true, ${sql.json(pasos)})
      on conflict (clave) do update set nombre = excluded.nombre, etapa = excluded.etapa,
        trigger_tipo = excluded.trigger_tipo, pasos = excluded.pasos, updated_at = now()`;
  }
  const r = await sql`select clave, jsonb_array_length(pasos) p, activa from nutricion_secuencias order by id`;
  console.log('SECUENCIAS EN BASE: ' + r.length);
  for (const x of r) console.log('  ' + x.clave + ' · ' + x.p + ' pasos · ' + (x.activa ? 'activa' : 'pausada'));
  await sql.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
