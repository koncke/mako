// =============================================================================
// api-mako/areas/cs.def — las operaciones del área `cs` (definiciones)
// =============================================================================
// Una entrada por operación: id, qué es, parámetros, por qué canales sale, cómo se
// confirma. SIN server-only y sin importar valores de módulos que lo tengan: esto
// lo importan los tests y el generador de la referencia. Los cuerpos van en
// cs.run.ts, cruzados por id. Español neutro (lo lee el cliente).
//
// ⚠️ EL ÁREA DEJÓ DE SER `soloWs1` EL 26/09/2026, Y ESE ES EL CAMBIO. Hasta ese día
// las diecisiete operaciones eran el programa de 44 clases de UN cliente (el
// temario, su cuestionario, su curso en la plataforma externa, los casos de otros clientes suyos),
// así que estaban gateadas con `soloWs1` — que no es solo «el workspace 1»: en
// `gatingOk` (lib/api-mako/registro.ts) significa `ws === 1 Y rol === admin`, o sea
// que además exigía admin de rebote. Quedaron TRES, y las tres son de cualquier
// negocio: quiénes son mis clientes, cómo va cada uno y en qué estado está.
// Mantener `soloWs1` habría dejado la capacidad viva únicamente para el workspace
// de Mauricio, que es justo lo que este trabajo vino a deshacer.
//
// Lo que las gatea ahora, y por qué no hay más:
//   · `tab: 'customer-success'` — la CAPA del workspace (lib/capas.ts). Un cliente
//     que no compró la tab no tiene cartera de entrega: para él no existe.
//   · NADA de rol. La pantalla es `requireCapa('customer-success')` a secas y sus
//     server actions (app/customer-success/actions.ts) no miran el rol: un closer
//     ve la cartera y puede marcar un estado. La regla de AGENTS.md pide
//     `rolMinimo: 'admin'` donde la página hace `requireRolWs([])` —para que MaKo
//     no sea MÁS PERMISIVO que la pantalla—, y acá poner admin sería lo contrario:
//     esconder por MaKo lo que la pantalla muestra. Si algún día la tab se cierra
//     por rol, esto se cierra en el mismo commit.
//   · Ninguna cuesta plata ni sale a un proveedor, así que no hay integración que
//     exigir ni `rolMinimo` obligatorio por costo.
//
// Canales: todas son datos de PERSONAS (nombre, teléfono, email, cuotas, la
// razón por la que hay que atender a alguien, cómo va con su curso), así que NO
// salen por HTTP a un token que vive en la máquina de un tercero.
// `tests/api-mako-http.snapshot.txt` no lista ninguna operación de `cs`.
//
// ⚠️ EL CURSO VOLVIÓ, Y ES OTRO (06/10/2026). El de la plataforma externa se fue (ver
// abajo); el que vive EN MaKo —las clases y tareas que se cargan en Classroom ›
// Curso, mig 0202— es de cualquier negocio, y `ver_avance_curso_cs` lo lee. Es una
// LECTURA y nada más: nunca llama a `linkDeAcceso` (lib/curso-datos.ts), que CREA la
// fila del acceso del cliente. Mandarle el link sigue siendo un botón de la ficha.
//
// Qué NO está acá, a propósito:
//   · Todo el programa de Mauricio: el temario, sus grabaciones, el cuestionario
//     del cliente, el avance en la plataforma de cursos externa (que salió del
//     producto el 06/10/2026), los casos históricos y el banco de material.
//     Se fueron con `app/customer-success/programa/`, con `lib/programa-catalogo.ts`
//     y con las rutas que servían el cuestionario. No eran un molde de nada: eran
//     el curso de un cliente, con nombres de OTROS clientes suyos adentro.
//   · Los links de la tarea (emitir y revocar). El cuestionario que abrían ya no
//     existe, así que no hay link que emitir ni que cortar.
//   · Contestar o aprobar un bloque, registrar avance a mano: eran del programa.
// =============================================================================

import type { OperacionDef, Parametro } from '../tipos';
import { CAMPOS_TARJETA_CLIENTE, FORMAS_TARJETA_CLIENTE } from '@/lib/tarjeta-clientes';
import { MODELOS_CLIENTE } from '@/lib/plantillas-modelo-reglas';

const SIN_HTTP = ['whatsapp', 'app'] as const;
const CS = { tab: 'customer-success' } as const;

const leadId: Parametro = {
  nombre: 'leadId', tipo: 'number', obligatorio: true, entero: true, minimo: 1,
  descripcion: 'id del lead ganado que es cliente de este negocio (de ver_cartera_cs).',
};

export const DEFS: readonly OperacionDef[] = [
  // ── Lecturas (sin HTTP: datos de personas) ───────────────────────────────────
  {
    id: 'ver_cartera_cs', area: 'cs', tipo: 'lectura',
    titulo: 'Ver la cartera de clientes',
    descripcion: 'Los clientes de este workspace (los leads ganados) ordenados por CUÁL NECESITA ATENCIÓN HOY, que es como los ordena la pantalla. De cada uno: el nivel de atención y su motivo en una frase, hace cuánto cerró, la última conversación (sesión o WhatsApp), si está esperando respuesta, cuotas vencidas, semana del contrato y el trabajo abierto en el tablero. ⚠️ El nivel null significa NO SE PUEDE SABER (sin contrato cargado, sin datos o una lectura que falló): no es «está al día». Por default solo activos y pausados, como la pantalla. Úsala antes de ver_cliente_cs para conseguir el leadId.',
    parametros: [
      { nombre: 'atencion', tipo: 'string', enum: ['atencion', 'sin-datos', 'bien'], descripcion: 'solo los clientes de ese nivel. «sin-datos» son los que no se pueden evaluar.' },
      { nombre: 'incluirCerrados', tipo: 'boolean', descripcion: 'true suma los graduados y los dados de baja (por default quedan afuera).' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'ver_cliente_cs', area: 'cs', tipo: 'lectura',
    titulo: 'Ver el detalle de un cliente',
    descripcion: 'Todo lo de la ENTREGA de un cliente, para tener a mano antes de hablarle: por qué necesita atención (o por qué no se puede saber), qué dice el contrato (qué es, qué se le prometió, garantía, sesiones pactadas, duración y arranque con su fuente), la última conversación, sesiones, cuotas vencidas y contacto. La historia de la VENTA no está aquí: vive en el CRM. Necesita el leadId de ver_cartera_cs.',
    parametros: [leadId],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'ver_avance_curso_cs', area: 'cs', tipo: 'lectura',
    titulo: 'Ver el avance en el curso',
    descripcion: 'Cómo va cada cliente con el CURSO de su servicio (las clases y tareas cargadas en Classroom): en qué etapa de la entrega está, cuántas tareas de esa etapa envió y cuáles le faltan, cuánto vio de los videos medibles, y su acceso al portal (si lo tiene, si se le cortó, cuántas veces entró y cuándo fue la última). Con leadId, el detalle de ese cliente en cada producto con curso; sin leadId, una fila por cliente y producto de toda la cartera. ⚠️ Un video de Drive o Loom «sin medir» no es «no lo vio», y pct_visto null no es 0. Es una lectura: no crea el acceso ni le manda nada al cliente.',
    parametros: [
      { nombre: 'leadId', tipo: 'number', entero: true, minimo: 1, descripcion: 'id del cliente (de ver_cartera_cs). Sin él, el resumen de toda la cartera.' },
    ],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'ver_pagos_clientes_agencia', area: 'cs', tipo: 'lectura',
    titulo: 'Ver los pagos de clientes',
    descripcion: 'Sólo para una AGENCIA: por cada cliente suyo con cuenta de MaKo, lo que falta pagar. «primer_mes_sin_pagar»: al abrirle la cuenta se creó el link de Mercado Pago de su primer mes, y pagarlo lo habilita solo. «renovacion»: terminó el onboarding, su mes ya corre, y la suscripción mensual (que empieza a cobrar en `desde`) espera que la agencia la autorice; `activada: true` es que ya la autorizó. Si la cuenta la paga el cliente, el pago lo ve él al terminar su onboarding. Los links NO vienen aquí: están en Agency Dashboard, en la cuenta de cada cliente («Pagar su mes» o «Activar renovación»). Un cliente que no aparece no tiene nada pendiente.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    // MaKo Partners (17/10/2026, docs/diseno-clients.md D7-D10): las cuentas de MaKo de los clientes de una agencia viven
    // en la tab /partners. Sin HTTP: son negocios de terceros.
    id: 'ver_clientes_partners', area: 'cs', tipo: 'lectura',
    titulo: 'Ver los clientes de la agencia',
    descripcion: 'Sólo para una AGENCY (un negocio con el plan Pro que se sumó como Agency): las cuentas de MaKo de sus clientes, que viven en la tab Agency Dashboard y NO son los clientes de la entrega (ver_cartera_cs). De cada una: nombre, estado de la cuenta (pendiente: espera que se pague su primer mes o que MaKo la habilite; aprobado: activa; revocado), desde cuándo, su plan, quién la paga (agencia o cliente), cuántas personas entran (sólo las activas), si falta pagar su primer mes o activar la renovación, y el lead del CRM del que salió (puede no haber). Los links de pago no vienen: están en Agency Dashboard.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },

  // ── Acciones por chat ─────────────────────────────────────────────────────────
  {
    id: 'marcar_estado_cliente_cs', area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Marcar estado de un cliente',
    descripcion: 'Cambia el estado de un cliente dentro de la entrega: activo, graduado (terminó bien), baja (se fue antes) o pausado. Es una DECISIÓN de quien atiende, no un cálculo: pasarse del plazo del contrato no es haber terminado. Para una baja pide el motivo antes de proponerla. Graduado y baja lo sacan de la vista principal de la cartera. No toca la etapa del lead en el CRM.',
    escribe: 'el estado (y el motivo, si viene) del cliente en cs_clientes',
    parametros: [
      leadId,
      { nombre: 'estado', tipo: 'string', enum: ['activo', 'graduado', 'baja', 'pausado'], obligatorio: true, descripcion: 'el estado nuevo dentro de la entrega.' },
      { nombre: 'motivo', tipo: 'string', max: 500, descripcion: 'por qué. Obligatorio para una baja. Sin motivo se conserva el que había.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    // #874 (17/10/2026): traída de la rama a medias `wip/api-acciones-1410` (quieta desde el 14/10, sólo esta acción),
    // para la ⚡ Acción «Invitar al curso» de un flujo. Lo que manda y anota es `invitarAlCurso` (lib/curso-invitar.ts),
    // el MISMO de la ficha, la tarjeta del kanban y el CRM al ganar.
    id: 'invitar_cliente_curso_cs', aTerceros: true, area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Invitar un cliente al curso',
    descripcion: 'Invita a un cliente al curso: le manda por email (y también por WhatsApp si se pide) su link de entrada al portal, y le crea el acceso si no lo tenía. Con productoId invita al curso de ESE servicio, como la ficha y la tarjeta del kanban: el email nombra sólo ese curso y su acceso pasa a abrirlo (sin cerrarle los que ya veía); sin productoId, el email nombra los cursos que ya ve. Sin email usa el del CRM; si el CRM no tenía ninguno, el que se pasa queda guardado en el lead. Si ya estaba invitado (a ese curso) o ya entró, no reenvía, salvo reenviar: true. Si su acceso está cortado o el curso no tiene clases, no invita y dice por qué. El WhatsApp sale solo si el email salió. Después, {{curso_link}} en un mensaje es su link.',
    escribe: 'crea su acceso al portal si no lo tenía, anota la invitación y qué curso abre (curso_accesos), guarda el email en el lead si no tenía, y manda un email (y opcionalmente un WhatsApp)',
    parametros: [
      leadId,
      { nombre: 'productoId', rotulo: 'Curso', tipo: 'number', entero: true, minimo: 1, descripcion: 'el servicio de cuyo curso se lo invita (uno suyo). Sin esto, los cursos que ya ve.' },
      { nombre: 'email', tipo: 'string', max: 200, descripcion: 'a qué email. Sin esto, el del CRM.' },
      { nombre: 'canales', tipo: 'string[]', enum: ['email', 'whatsapp'], max: 2, descripcion: 'por dónde: ["email"] (default) o ["email", "whatsapp"].' },
      { nombre: 'reenviar', tipo: 'boolean', descripcion: 'true = mandarla aunque ya esté invitado o ya haya entrado.' },
    ],
    canales: SIN_HTTP, costo: 'externo', gating: CS,
  },
  {
    // La opción del CRM «Llevar a MaKo Partners» (Martín, 17/10/2026: «si un usuario se unió al programa de "MaKo
    // Partners", que le aparezca la opción en el CRM para llevarlos allí»), por chat. El núcleo es el MISMO de la tab y
    // del CRM: `abrirCuentaDePartner` (lib/partners.ts). Crea una cuenta de la plataforma: lo confirma una persona, y
    // sólo el admin. Si paga el cliente y no hay link del primer mes, su acceso NO sale (25/10/2026): la descripción
    // dice los dos caminos (prometía «le llega su acceso ya»), y la de `abrir_cuenta_cliente_agency` también.
    id: 'llevar_a_partners', aTerceros: true, area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Abrirle su cuenta a un lead',
    descripcion: 'Sólo para una AGENCY (un negocio con el plan Pro que se sumó como Agency): le abre a un lead de su CRM (de cualquier etapa: no hace falta que sea cliente) su propia cuenta de MaKo, como cliente de la agencia, en Agency Dashboard. Se elige quién la paga: la agencia (default: el link de su primer mes queda en Agency Dashboard y pagarlo la habilita; a quien la va a usar le llega su acceso al quedar habilitada) o el cliente (si MaKo ya puede cobrarle, le llega su acceso, hace su onboarding y al terminarlo le aparece el pago; si no, su cuenta espera a que MaKo la habilite y ahí le llega su acceso). Su mes corre desde que termina el onboarding. Necesita un email: sin email usa el del CRM. Si el lead ya tiene cuenta, no abre otra.',
    escribe: 'crea la cuenta de MaKo del cliente (un workspace nuevo de la plataforma, pendiente), su usuario admin, lo liga al lead (leads.cliente_ws), anota quién paga y crea el link de pago de su primer mes; si paga el cliente y el link salió, le manda su acceso',
    parametros: [
      { nombre: 'leadId', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'id del lead del CRM (cualquier etapa).' },
      { nombre: 'email', tipo: 'string', max: 200, descripcion: 'el email de quien va a usar la cuenta. Sin esto, el del CRM.' },
      { nombre: 'paga', rotulo: 'Quién paga', tipo: 'string', enum: ['agencia', 'cliente'], descripcion: 'quién paga su cuenta: agencia (default, con su tarjeta) o cliente (al terminar su onboarding).' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: { tab: 'customer-success', rolMinimo: 'admin' },
  },
  // ── Agency Dashboard (25/10/2026, docs/feedback-25-10-tarde.md punto 9) ────────────────────────────────────────
  // Sumarse como Agency, ver cómo está y abrir la cuenta de un cliente que no está en el CRM. El núcleo, en lib/agency.ts
  // y lib/partners.ts (el MISMO de la tab). Sólo el admin: se crean cuentas de la plataforma. Sin HTTP: son negocios de
  // terceros. Sin `tab`: Agency es del plan, no de una tab de la capa.
  {
    id: 'ver_agency', area: 'cs', tipo: 'lectura',
    titulo: 'Ver el estado de Agency',
    descripcion: 'Si este negocio es Agency (tiene el plan MaKo Pro activo y se sumó desde Agency Dashboard), si puede sumarse y, si no, por qué (plan: Agency es parte de MaKo Pro; pausado: su cuenta está pausada), lo que contó al sumarse (cuántos clientes maneja, su rubro, quién paga hoy las herramientas de sus clientes) y cuántas cuentas de clientes tiene por estado. Una agencia NO gana dinero con MaKo: sus clientes son suyos, y MaKo no les hace promociones ni les ofrece otros planes.',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  {
    id: 'sumarse_como_agency', area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Sumarse como Agency',
    descripcion: 'Suma este negocio como Agency: desde ahí abre las cuentas de MaKo de sus clientes, entra a cada una con controles de admin y elige si cada cuenta la paga la agencia o el cliente. Sólo con el plan MaKo Pro activo (si no, dice por qué). Antes de proponerlo conviene preguntar las tres cosas del alta: cuántos clientes maneja, a qué se dedican y quién paga hoy sus herramientas. Si ya es Agency, no hace nada.',
    escribe: 'anota que el negocio se sumó como Agency (agencias) y lo que contó (app_settings agency.perfil)',
    parametros: [
      { nombre: 'clientes', rotulo: 'Cuántos clientes', tipo: 'string', enum: ['1-5', '6-20', '21-50', '50+'], descripcion: 'cuántos clientes maneja hoy.' },
      { nombre: 'rubro', rotulo: 'Rubro', tipo: 'string', max: 120, descripcion: 'a qué se dedican sus clientes, en pocas palabras.' },
      { nombre: 'pagaHoy', rotulo: 'Quién paga hoy', tipo: 'string', enum: ['yo', 'clientes', 'depende'], descripcion: 'quién paga hoy las herramientas de sus clientes: yo (la agencia), clientes o depende. Es lo que el alta de un cliente propone primero.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  {
    id: 'abrir_cuenta_cliente_agency', aTerceros: true, area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Abrir la cuenta de un cliente',
    descripcion: 'Sólo para una AGENCY: le abre su cuenta de MaKo a un cliente que NO está en el CRM (si está, usar llevar_a_partners con su leadId), con su nombre y su email. Se elige quién la paga: la agencia (default: el link de su primer mes queda en Agency Dashboard; pagarlo la habilita y ahí le llega su acceso) o el cliente (si MaKo ya puede cobrarle, le llega su acceso y al terminar su onboarding le aparece el pago, y hasta que pague la agencia no entra a su cuenta; si no, su cuenta espera a que MaKo la habilite y ahí le llega su acceso). Su mes corre desde que termina el onboarding. Si el email ya tiene cuenta de MaKo, no abre otra.',
    escribe: 'crea la cuenta de MaKo del cliente (un workspace nuevo de la plataforma, pendiente), su usuario admin, anota quién paga y crea el link de pago de su primer mes; si paga el cliente y el link salió, le manda su acceso',
    parametros: [
      { nombre: 'nombre', rotulo: 'Nombre', tipo: 'string', obligatorio: true, max: 120, descripcion: 'el nombre del negocio (o de la persona) del cliente.' },
      { nombre: 'email', rotulo: 'Email', tipo: 'string', obligatorio: true, max: 200, descripcion: 'el email de quien va a usar la cuenta: por ahí le llega el acceso.' },
      { nombre: 'paga', rotulo: 'Quién paga', tipo: 'string', enum: ['agencia', 'cliente'], descripcion: 'quién paga su cuenta: agencia (default, con su tarjeta) o cliente (al terminar su onboarding).' },
      { nombre: 'plan', rotulo: 'Plan', tipo: 'string', enum: ['esencial', 'pro'], descripcion: 'su plan de MaKo: esencial (default, US$47 por mes) o pro (US$97 por mes).' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  {
    // DAR DE BAJA LA CUENTA DE UN CLIENTE (29/10/2026, llamada con Thiago: «darlo de baja cuando vos quieras»; lib/agencia-baja.ts).
    id: 'dar_de_baja_cliente_agency', aTerceros: true, area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Dar de baja la cuenta de un cliente',
    descripcion: 'Sólo para una AGENCY: da de baja la cuenta de MaKo de un cliente de su cartera. Cancela su cobro (la renovación en Mercado Pago o Stripe, y los links sin pagar), la agencia deja de administrarla y de entrar a ella, y al cliente le llega un mail. Sus datos NO se borran: la cuenta queda de él, pausada, y si quiere seguir elige su plan y lo paga él. Pedir el número de cuenta con ver_clientes_partner.',
    escribe: 'cancela el cobro del cliente en la pasarela, pasa su fila de la cartera a revocada, pausa su cuenta (app_settings plan.corte_por_pago) y le manda un mail',
    parametros: [
      { nombre: 'clienteWs', rotulo: 'Cliente', tipo: 'number', entero: true, minimo: 1, obligatorio: true, descripcion: 'el número de cuenta del cliente de la cartera.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  {
    // LA PLANTILLA DE UN MODELO DE NEGOCIO (MAU-01, 27/10/2026, lib/plantillas-modelo.ts): Mauricio, «una base tipo copy
    // paste que disminuya mi intervención de iniciar de cero». Lo mismo que «Plantilla del negocio» en la ficha de una
    // cuenta del Agency Dashboard. Sin HTTP, como las demás de Agency: son cuentas de terceros.
    id: 'aplicar_plantilla_de_modelo', area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: false,
    titulo: 'Aplicar la plantilla de un modelo de negocio',
    descripcion: 'Arma la base de una cuenta según cómo vende: tienda-b2c (le vende a personas: un local, una tienda online o un restaurante), b2b-crm (le vende a empresas, con reuniones y propuestas) o manufactura (fabrica y vende por cotización y orden de compra). Crea su funnel con las etapas de ese modelo, el objetivo del trimestre con 4 KPIs semanales (sin números: la meta y el compromiso los pone el negocio) y un proyecto en su Plan con la guía para cargar sus datos. Lo que ya existe con el mismo nombre no se duplica. Con clienteWs, una AGENCY se la aplica a un cliente de su cartera; sin él, se aplica a este negocio.',
    escribe: 'un funnel (funnels), un objetivo con sus KPIs (objectives, kpis) y un proyecto con sus tareas en el Plan (plan_proyectos, plan_tareas), en la cuenta del cliente o en la propia',
    parametros: [
      { nombre: 'modelo', rotulo: 'Modelo', tipo: 'string', obligatorio: true, enum: [...MODELOS_CLIENTE], descripcion: 'tienda-b2c, b2b-crm o manufactura.' },
      { nombre: 'clienteWs', rotulo: 'Cliente', tipo: 'number', entero: true, minimo: 1, descripcion: 'sólo para una Agency: el número de cuenta del cliente de su cartera. Sin esto, se aplica a este negocio.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
  {
    // LA TARJETA DE UN CLIENTE, PERSONALIZADA (21/10/2026, Martín: «la personalización de las tarjetas en clientes, plan,
    // etc.»). Es DE UNA PERSONA (usuarios.perfil), así que sale sólo por la app, como la del CRM (crm.def.ts,
    // `ver_campos_tarjeta_crm`): por WhatsApp o HTTP no hay sesión que diga quién es. Se cambia en Clientes, «⋯» ›
    // «Personalizar tarjetas».
    id: 'ver_tarjeta_clientes', area: 'cs', tipo: 'lectura',
    titulo: 'Cómo se ve la tarjeta de un cliente',
    descripcion: 'Cómo ve la persona cada tarjeta del kanban de Clientes: con qué forma (Completa, Compacta o Con portada), qué datos lleva (foto, empresa, la etapa y su aviso, proyectos · tareas · recurrentes), qué plantilla tiene puesta, las plantillas de fábrica y las propias, y el catálogo completo. Se elige en Clientes, «⋯» › «Personalizar tarjetas» (o clic derecho en una tarjeta), y es de cada persona.',
    parametros: [],
    salida: 'json', canales: ['app'], costo: 'gratis', gating: CS,
  },
  {
    // Sólo por la app, como su lectura: es de UNA persona.
    id: 'personalizar_tarjetas_clientes', area: 'cs', tipo: 'accion', confirmacion: 'chat',
    titulo: 'Personalizar la tarjeta de los clientes',
    descripcion: 'PROPONE cómo se ve la tarjeta de un cliente en el kanban de Clientes para la persona que lo pide (queda pendiente hasta el «sí»): poner una plantilla por su nombre (de fábrica o propia, de ver_tarjeta_clientes), o elegir la forma y los datos. Con guardarComo, además la guarda como plantilla propia con ese nombre (con el mismo nombre, la reemplaza). Es de cada persona: no cambia la tarjeta del resto del equipo.',
    parametros: [
      { nombre: 'plantilla', tipo: 'string', max: 40, descripcion: 'el nombre de una plantilla (Completa, Compacta, Sin foto, Con portada, Sin avance, Sólo la etapa, Sólo el nombre, o una propia).' },
      { nombre: 'forma', tipo: 'string', enum: [...FORMAS_TARJETA_CLIENTE], descripcion: 'la forma, si no se pasa una plantilla.' },
      { nombre: 'campos', tipo: 'string[]', max: CAMPOS_TARJETA_CLIENTE.length, vaciaEsValor: true, descripcion: 'los datos, si no se pasa una plantilla ([] = sólo el nombre). Cada uno va en su lugar de la tarjeta: el orden no cambia nada.' },
      { nombre: 'guardarComo', tipo: 'string', max: 32, descripcion: 'guardar lo elegido como plantilla propia con este nombre.' },
    ],
    canales: ['app'], costo: 'gratis', gating: CS,
    reversible: true, escribe: 'la tarjeta de los clientes de esa persona (usuarios.perfil.clientesTarjeta)',
  },
  // ── La ENTREGA de un cliente (23/10/2026, P0-5 de la auditoría de la API) ─────────────────────────────
  // Mover a un cliente en el kanban de un servicio, quitarlo de un servicio y devolverlo: las MISMAS funciones que el
  // arrastre y «Quitar de este producto» de la ficha (`moverClienteDeEtapa`, lib/cs-mover-etapa.ts; lib/cs-quitar-producto.ts).
  // Hasta hoy `proponer_cambio_etapa` y `mover_lead_en_producto` movían el CRM (`lead_funnel`) y nada del registro
  // escribía la entrega (`cliente_entrega`). Sin HTTP, como el resto del área (y la decisión del 08/10: el token del curso
  // no mueve clientes de etapa). Mover y devolver con etapa llevan `aTerceros`: entrar a una etapa arranca sus
  // automatizaciones de entrega, que le pueden escribir al cliente. Sin `rolMinimo`, como la pantalla (ver arriba).
  {
    id: 'mover_cliente_entrega', aTerceros: true, area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Mover un cliente en la entrega',
    descripcion: 'PROPONE pasar a un cliente a otra etapa de la entrega de un servicio, el kanban de Clients (queda pendiente hasta el «sí»). Entrar a la etapa arranca sus automatizaciones de entrega, que le pueden escribir al cliente. Sin etapa, la primera. Si ese servicio no era suyo, lo suma a esa entrega. Para deshacer, el mismo pedido con la etapa anterior.',
    escribe: 'la etapa del cliente en la entrega de ese servicio (cliente_entrega), con su línea de historial, y lo enrola en las automatizaciones de esa etapa',
    parametros: [
      leadId,
      { nombre: 'productoId', rotulo: 'Servicio', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'el servicio (producto) por su id. Si falta o no es suyo, la respuesta trae los suyos.' },
      { nombre: 'etapa', rotulo: 'Etapa', tipo: 'string', max: 80, descripcion: 'la etapa de la entrega, por su clave o su nombre. Sin esto, la primera. Si no existe, la respuesta trae las que hay.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'quitar_cliente_de_servicio', area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Quitar un cliente de un servicio',
    descripcion: 'PROPONE sacar a un cliente de UNO de sus servicios (queda pendiente hasta el «sí»): deja el kanban de ese servicio y sigue en los otros, como «Quitar de este producto» de su ficha. Si es su único servicio, no se puede. Sin aviso al cliente. Se deshace con devolver_cliente_a_servicio.',
    escribe: 'saca al cliente de la entrega de ese servicio (borra su fila de cliente_entrega, o marca cliente_entrega_fuera si era el servicio de su embudo), con su línea de historial',
    parametros: [leadId, { nombre: 'productoId', rotulo: 'Servicio', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'el servicio (producto) por su id. Si falta o no es suyo, la respuesta trae los suyos.' }],
    canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    id: 'devolver_cliente_a_servicio', aTerceros: true, area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: true,
    titulo: 'Devolver un cliente a un servicio',
    descripcion: 'PROPONE devolver a un cliente al kanban de un servicio del que se lo quitó (queda pendiente hasta el «sí»). Con etapa vuelve a esa; sin ella, a donde lo pone el servicio (la primera etapa). Si entra a una etapa, arrancan sus automatizaciones de entrega. El reloj de «hace cuánto está en la etapa» arranca hoy.',
    escribe: 'vuelve a poner al cliente en la entrega de ese servicio (cliente_entrega, y saca la marca de cliente_entrega_fuera), con su línea de historial',
    parametros: [
      leadId,
      { nombre: 'productoId', rotulo: 'Servicio', tipo: 'number', obligatorio: true, entero: true, minimo: 1, descripcion: 'el servicio (producto) por su id. Si falta o no es suyo, la respuesta trae los suyos.' },
      { nombre: 'etapa', rotulo: 'Etapa', tipo: 'string', max: 80, descripcion: 'la etapa a la que vuelve, por su clave o su nombre. Sin esto, la primera.' },
    ],
    canales: SIN_HTTP, costo: 'gratis', gating: CS,
  },
  {
    // LA MENSUALIDAD POR FUERA DE MaKo (acuerdo con Código Inmobiliario, 30/10/2026; lib/agencia-mes.ts). Va AL FINAL del área
    // (AGENTS.md: una nueva no le saca el lugar a otra). Sin HTTP, como las demás de Agency: son cuentas de terceros.
    id: 'ver_mensualidad_agencia', area: 'cs', tipo: 'lectura',
    titulo: 'Ver la mensualidad de la agencia',
    descripcion: 'Sólo para una AGENCY con la mensualidad por fuera de MaKo prendida: el total que paga este mes (su plan más el de cada cliente que cuenta), cada renglón, hasta qué día se paga (del 1 al 5, por Binance u otro medio que se acordó) y si ya está pagado. De cada cliente: desde qué día cuenta, o hasta qué día está sin costo (14 días desde que se lo invitó), o si se dio de baja. Un cliente que empieza a contar a mitad de mes suma sus días de ese mes al mes siguiente; si se da de baja antes de sus 14 días, no se cobra. Los pagos los anota MaKo: la agencia no los marca. Con la mensualidad apagada, sus cuentas se pagan con su link (ver_pagos_clientes_agencia).',
    parametros: [],
    salida: 'json', canales: SIN_HTTP, costo: 'gratis', gating: { rolMinimo: 'admin' },
  },
];
