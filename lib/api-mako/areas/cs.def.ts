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
// abajo); el que vive EN MaKo —las clases y tareas que se cargan en Customer Success ›
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
    descripcion: 'Cómo va cada cliente con el CURSO de su servicio (las clases y tareas cargadas en Customer Success › Curso): en qué etapa de la entrega está, cuántas tareas de esa etapa envió y cuáles le faltan, cuánto vio de los videos medibles, y su acceso al portal (si lo tiene, si se le cortó, cuántas veces entró y cuándo fue la última). Con leadId, el detalle de ese cliente en cada producto con curso; sin leadId, una fila por cliente y producto de toda la cartera. ⚠️ Un video de Drive o Loom «sin medir» no es «no lo vio», y pct_visto null no es 0. Es una lectura: no crea el acceso ni le manda nada al cliente.',
    parametros: [
      { nombre: 'leadId', tipo: 'number', entero: true, minimo: 1, descripcion: 'id del cliente (de ver_cartera_cs). Sin él, el resumen de toda la cartera.' },
    ],
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
    id: 'invitar_cliente_curso_cs', area: 'cs', tipo: 'accion', confirmacion: 'chat', reversible: false,
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
];
