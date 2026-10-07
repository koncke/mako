// =============================================================================
// El runway al 03/10/2026 — los datos de la pantalla, separados de la pantalla
// =============================================================================
// Es una FOTO con fecha, no un estado vivo: sale de tres fuentes (las llamadas
// con Leila del 21/09 y del 01/10, y el audio de 60 minutos del 03/10), y las
// 579 citas se verificaron con comparación exacta contra las transcripciones.
//
// ⚠️ POR ESO LOS NÚMEROS ESTÁN ESCRITOS Y NO SE CALCULAN DE LA BASE. Nada de
// esto vive en una tabla: el capital que queda, el show up medido y la ventana
// de venta salen de lo que Martín dijo en una grabación. Derivarlos de algo
// sería inventarlos.
//
// ⚠️ Y LLEVA SU FECHA A LA VISTA. Un runway sin fecha se lee como el estado de
// HOY, y este caduca solo: el día que entre una venta o se mueva un deadline,
// la pantalla miente. Cuando pase, se reescribe este archivo — o se borra la
// ruta, que es lo correcto el día que deje de ser la foto vigente.
//
// El detalle largo, con las citas, en docs/panorama-03oct.md (se lee en
// /admin/docs).

/** El día en que se midió todo esto. Se dibuja. */
export const MEDIDO = '3 de octubre de 2026';

/** El tramo que dibuja el riel. Las posiciones de los hitos salen de acá. */
export const DESDE = '2026-10-03';
export const HASTA = '2026-12-15';

export type Hito = {
  fecha: string;
  /** Lo que se lee debajo de la marca. Corto: es una etiqueta, no una frase. */
  rotulo: string;
  /** La nota de arriba. Vacía = sólo la fecha. */
  nota?: string;
  peso?: 'fuerte' | 'normal';
  tono?: 'malo';
};

export const HITOS: Hito[] = [
  { fecha: '2026-10-07', rotulo: '7 OCT', nota: 'P1 técnico', peso: 'fuerte' },
  { fecha: '2026-10-14', rotulo: '14 OCT', nota: 'cierra lo técnico', peso: 'fuerte' },
  { fecha: '2026-10-18', rotulo: '18', nota: 'prospección' },
  { fecha: '2026-11-01', rotulo: '1 NOV', nota: 'arrancan los anuncios', peso: 'fuerte' },
  { fecha: '2026-11-30', rotulo: '30 NOV', nota: 'se acaba la plata', tono: 'malo' },
  { fecha: '2026-12-15', rotulo: '15 DIC', nota: 'dejan de comprar', tono: 'malo' },
];

export type Cifra = {
  clave: string;
  /** El valor escrito. Excluyente con `faltanHasta`. */
  valor?: string;
  /** Si está, el valor son los días que faltan hasta esa fecha, contados al abrir. */
  faltanHasta?: string;
  urge: boolean;
  detalle: string;
};

export const CIFRAS: Cifra[] = [
  {
    clave: 'Capital restante', valor: 'US$2.000', urge: true,
    detalle: 'Dos pagos de **un solo cliente**, y menos en la práctica. Se termina en noviembre.',
  },
  {
    // ⚠️ El ÚNICO valor que no se escribe: se cuenta contra el reloj. Un «4 días»
    // escrito a mano es verdad el día que se escribe y miente todos los demás, y
    // justo esa cifra es la que aprieta. Lo demás —el capital, el show up— no
    // sale de ninguna tabla y por eso sí va escrito.
    clave: 'Al primer deadline', faltanHasta: '2026-10-07', urge: true,
    detalle: 'Chatbot, Ads Manager, CRM y Customer Success al 100% el 7/10. Cuatro frentes en paralelo.',
  },
  {
    clave: 'Ventana de venta', valor: '45 días', urge: false,
    detalle: 'Del 1/11 al 15/12. El precedente para estabilizar un funnel son **tres meses**.',
  },
];

export type Escalon = { et: string; que: string; cuando: string; estado: 'vive' | 'fuera' };

export const ESCALONES: Escalon[] = [
  { et: 'P1', que: 'Chatbot · Ads Manager · CRM · Customer Success', cuando: '7 OCT', estado: 'vive' },
  { et: 'P2', que: 'Offer Analyst + Generator', cuando: 'eliminado', estado: 'fuera' },
  { et: 'P3', que: 'Onboarding + el video', cuando: '9 OCT · era 14', estado: 'vive' },
  { et: 'P4', que: 'Landing y VSL Analyst + Generator', cuando: 'eliminado', estado: 'fuera' },
  { et: 'P5', que: 'Video + Image Generator', cuando: '14 OCT · era 21', estado: 'vive' },
];

export const CUENTA = [
  { v: 'US$2.000', l: 'pauta' },
  { v: '÷' },
  { v: 'US$100', l: 'por agenda' },
  { v: '=' },
  { v: '20', l: 'agendas' },
  { v: '×' },
  { v: '50%', l: 'show up' },
  { v: '=' },
  { v: '10', l: 'clientes' },
  { v: '=' },
  { v: 'US$15.000', l: 'facturado', fin: true },
];




// =============================================================================
// La depuración del CRM — qué se hace con cada una de las 25 tarjetas abiertas
// =============================================================================
// Medido el 03/10: seis lectores pasaron las 25 por el código una por una, un
// cruzador buscó solapes y lo que NO tenía tarjeta, y tres refutadores atacaron
// por separado los «se va», los «se pospone» y los «se queda» — cada uno con una
// vara distinta, que es lo que hizo que esta vez cortara. La misma pregunta sin
// el marco del runway se había hecho el 30/09 y dio 0 de 25 cerrables.
//
// ⚠️ ACÁ VIVE SÓLO EL VEREDICTO. El título, la prioridad y el deadline salen del
// tablero en cada carga: el Perro recurva los scores todos los días, así que un
// número escrito acá estaría viejo mañana. Es el mismo reparto que ya usa
// app/admin/dev/crm/auditoria.ts.
//
// ⚠️ Y SE BORRA UNA FILA CUANDO LA TAREA SE CIERRA, en vez de corregirla: lo que
// no está en el tablero no se dibuja, y lo que está sin veredicto sale marcado
// como sin revisar — que es la verdad, no un hueco.
//
// El detalle de cada una, con archivo:línea, en docs/depuracion-crm-03oct.md.

export type Veredicto = 'queda' | 'pospone' | 'va';

// ⚠️ EL PORQUE DE UNA FILA YA CERRADA NO ES EL DE LA DECISION. El motivo de un
// «se pospone» es, por construccion, un argumento para NO hacerla: al lado de un
// «Hecha» se lee como una contradiccion, que es exactamente lo que la columna no
// puede hacer (AGENTS.md, «cuando la pantalla si muestra un porque»). El de un
// «se queda» sobrevive —dice que se rompia sin eso, o sea por que se hizo—, asi
// que `hecho` solo hace falta cuando el motivo deja de tener sentido una vez
// resuelta. Si cierras una pospuesta y no le escribis el texto, la fila va a
// mostrar el argumento de posponerla: por eso esta escrito aca y no en un commit.

export const VEREDICTO_LABEL: Record<Veredicto, string> = {
  queda: 'Se queda',
  pospone: 'Se pospone',
  va: 'Se funde',
};

/**
 * ⚠️ EL MOTIVO EXPLICA LA DECISIÓN, NO EL PROBLEMA. Es la columna «por qué» de la
 * tabla, al lado de «qué hacemos», así que tiene que contestar la pregunta de SU
 * veredicto y ninguna otra:
 *
 *   · `queda`    → **qué se rompe si no está** antes del 7/10 o del 17/10.
 *   · `pospone`  → **cómo se sobrevive sin eso** hasta el 15/12: el camino a mano,
 *                  o por qué hoy no le toca a nadie.
 *   · `va`       → **por qué ya no queda nada que hacer**.
 *
 * Medido el 04/10: la primera versión de #6 decía «lo ÚNICO que se pierde de verdad:
 * Meta lo borra a los 90 días» —que es un argumento para HACERLA— al lado de un chip
 * que decía «Se pospone». Martín: «¿qué carajos me dice eso? no me explica por qué se
 * pospone». Un motivo que describe el problema se lee como una contradicción con su
 * propio chip.
 */
export const CRM_VEREDICTOS: Record<number, { que: Veredicto; motivo: string; hecho?: string }> = {
  // ── Se queda: qué se rompe sin esto ──
  621: { que: 'queda', motivo: 'Sin esto los 1.000 entran con medio nombre y no se pueden distinguir entre sí' },
  702: { que: 'queda', motivo: 'Es lo único que después separa los 1.000 en frío de los que te escribieron solos' },
  39: { que: 'queda', motivo: 'Los 1.000 entrarían sin vendedor: tu equipo es una persona y el asignador la saltea' },
  38: { que: 'queda', motivo: 'Cada vez que las dos reuniones caen juntas se borra el link de la primera' },
  174: { que: 'queda', motivo: 'Si conectas tu agenda y no entra ninguna cita, hoy no hay error que lo diga' },

  // ── Se va: por qué ya no queda nada que hacer ──
  37: { que: 'va', motivo: 'Ya está en producción. Lo único que quedaba vivo da 0 casos reales en 10.137 visitantes' },
  698: { que: 'va', motivo: 'Ya está hecho: es un renglón, se ignora en lote y nunca bloquea el guardado' },
  627: { que: 'va', motivo: 'Ya está construido. Lo único que falta se escribe dentro de #798', hecho: 'Una nutrición ahora puede ser de UN producto: respeta el embudo que declara, y la que no declara ninguno sigue funcionando igual' },
  15: { que: 'va', motivo: 'Es la misma tarea que #40, que ya nombra lo mismo que falta' },
  689: { que: 'va', motivo: 'Es la misma que #38: su texto se muda ahí, con sus dos mitades' },

  // ── Se pospone: cómo se sobrevive sin eso ──
  6: { que: 'pospone', motivo: 'Hoy nadie usa esas respuestas para vender. Ojo: es lo único que no se recupera después', hecho: 'El formulario que te trae los leads pregunta solo los 4 campos que ya se guardaban: no se perdió nada. Y de ahora en más se guarda entero' },
  697: { que: 'pospone', motivo: 'Mientras tanto se corrige a mano en la ficha. Y si lo quieres de paso, es una línea', hecho: 'La mensualidad nace cobrada: el botón ya no deja una deuda que «Completar con IA» borraba' },
  800: { que: 'pospone', motivo: 'Mientras tanto el lead se mueve a mano. Vuelve si no prendes el motor automático' },
  671: { que: 'pospone', motivo: 'Mientras tanto la segunda reunión se agenda a mano: un minuto por reunión' },
  622: { que: 'pospone', motivo: 'Tus 1.000 son contactos fríos, no clientes que ya pagaron: no te toca todavía', hecho: 'Un archivo con teléfonos locales duplicaba 1.153 de 1.154 contactos. Ahora los reconoce, y detecta la columna de pago' },
  // #19 se fue a «Feature: Chatbot» el 04/10: la cobranza es trabajo de ese canal,
  // lo decidió Martin. La entrada queda por si vuelve, pero el lector ya no la trae:
  // `tareasDelCrm` lista las tareas del PROYECTO, y esta colgaba de ahí.
  19: { que: 'pospone', motivo: 'La cuota vencida ya te sale en Comercial y se marca cobrada con un clic' },
  798: { que: 'pospone', motivo: 'Ningún cliente tiene todavía un embudo propio que medir', hecho: 'El tramo comercial mide las etapas del embudo de cada cliente; el que no tiene uno propio ve lo mismo de siempre' },
  40: { que: 'pospone', motivo: 'Nadie vende hoy en tres reuniones: el recorrido de dos alcanza' },
  332: { que: 'pospone', motivo: 'Lo que dijo en la llamada ya se puede leer en la ficha cuando lo necesitas', hecho: 'Lo que salió de la llamada tiene su apartado, al lado de lo que el lead escribió al agendar: son dos cosas distintas y ya no se pisan' },
  696: { que: 'pospone', motivo: 'El formulario ya entra solo; lo que queda es una decisión, no código', hecho: 'El formulario entra solo, y el Pixel se asigna a un producto: el lead cae en el embudo de ESE producto y no en el genérico' },
  701: { que: 'pospone', motivo: 'El dato está guardado: se puede dibujar cuando haga falta, sin perder nada', hecho: 'Ahora ves en qué hizo clic y hasta dónde bajó la página. Y si al negocio le falta el Pixel, la ficha lo dice y te lleva a conectarlo' },
  623: { que: 'pospone', motivo: 'El contacto entra igual; lo único que no pasa es que se le sume el dato nuevo', hecho: 'Reimportar el mismo archivo ahora ofrece sumarle los datos nuevos al que ya está, sin pisar lo que cargaste' },
  626: { que: 'pospone', motivo: 'Te deja la ficha duplicada, no te pierde el lead', hecho: 'El lead que entra solo se compara por los últimos 10 dígitos, igual que cuando lo cargas tú' },
  18: { que: 'pospone', motivo: 'El mecanismo ya está: lo que falta es escribir el texto, no programar' },
  20: { que: 'pospone', motivo: 'Apagarlo cortaría los recordatorios que hoy le llegan al lead' },
};

/**
 * La única que NO está en el tablero: un bug vivo que la depuración encontró de
 * paso. Se dibuja al pie de la tabla porque no tiene número hasta que se cree.
 */
export const CRM_NUEVA = {
  titulo: 'La importación creaba el duplicado que la pantalla decía que descartó',
  // Se encontró y se arregló el mismo día. `hecha` va escrito acá —y no sale del
  // tablero como las otras— porque esta tarjeta nunca se creó: el arreglo salió
  // antes. Si alguna vez se abre, este bloque se borra y la fila sale de la tabla.
  hecha: true,
  motivo: 'Las tres respuestas a «¿esta fila entra?» pasan por una sola función (01cf2164)',
};

export const CRM_DECISIONES = [
  '**¿Prendes el motor automático antes de importar?** De eso depende que #800 quede afuera: con 1.000 leads, darse cuenta de que uno está quieto abriendo su ficha no escala.',
  '**¿Filtras los 100 en la planilla, o importas los 1.000?** Si entran los 1.000, después hace falta separarlos y eso no existe.',
  '**#627 y #15 se funden en #798 y #40**, y fundirse MUEVE texto: lo que falta de cada una tiene que quedar escrito adentro de la otra antes de cerrarlas. ¿Las fundo?',
  '**«Agente: CRM automático»** sigue vivo con 0 tareas y parte en dos la respuesta a «¿dónde está lo del CRM?». ¿Se tacha?',
];

// =============================================================================
// El Chatbot — lo que se hizo con cada tarjeta del proyecto (06/10/2026)
// =============================================================================
// Pedido de Martín (06/10): «son muchos cambios, quiero que al finalizar todo me hagas un
// apartado en runway para que yo pueda visualizar todo lo que se hizo de chatbot».
//
// ⚠️ EL MISMO REPARTO QUE EL CRM: el título y la prioridad salen del tablero en cada
// carga, y «Cerrada» sale del `progress` de la tarjeta — nunca de este archivo. Lo único
// propio de acá es QUÉ SE HIZO y QUÉ FALTA, que no vive en ninguna tabla.
//
// ⚠️ `lista` NO es «cerrada»: dice que el trabajo está en producción. «Cerrada» lo dice la
// pantalla sola, leyendo la tarjeta; si alguien la reabre, vuelve a decir lo de acá. El
// borrador del Plan se aplicó el 06/10 a la noche: 15 cerradas con su prueba, y la #350
// quedó abierta a propósito (no se reproduce con el reproductor solo; ver su `falta`).
//
// El detalle técnico, en docs/hallazgos-comunicacion.md → «Las seis tarjetas del Chatbot
// en paralelo» y «El setter con la charla de verdad».

export const CHATBOT_MEDIDO = '5 y el 6 de octubre de 2026';

/** Las propuestas de los casos de la post-agenda (#358), en el negocio de Mauricio. */
export const CHATBOT_CASOS = '/mako/revisar?ws=1';

export type EstadoChatbot = 'lista' | 'falta';

export const CHATBOT_TAREAS: Record<number, { estado: EstadoChatbot; hizo: string; falta?: string }> = {
  // #834: la prueba del borrador decía «ningún camino cae en el de Mauricio» y quedaban SIETE
  // llamadas a los flujos que caían ahí (los webhooks de Calendly, Cal.com, Chatwoot y Meta).
  // Se cerró con el arreglo de esas siete, no con la prueba vieja.
  834: { estado: 'lista', hizo: 'Ni los avisos ni los flujos se cruzan entre negocios, y el semanal sale a cada cliente con lo suyo' },
  328: { estado: 'falta', hizo: 'La línea de Mauricio está conectada y el envío prendido', falta: 'Ver salir el primer audio con la próxima agenda' },
  784: { estado: 'lista', hizo: 'Se vigila cada línea de cada negocio y el aviso le llega al dueño de esa línea' },
  790: { estado: 'falta', hizo: 'WhatsApp escalonado a 63 con reunión y mail a 884 formularios: armados y apagados', falta: 'Corregir el remitente (dice «MaKo») y decidir cuándo se prende' },
  19: { estado: 'lista', hizo: 'La cobranza sale al grupo del dueño; al cliente nada, como decidiste' },
  789: { estado: 'lista', hizo: 'Con una reunión nueva, la post-agenda vuelve a salir' },
  17: { estado: 'falta', hizo: 'A las 24 h, 1 h y 15 min, con el link para entrar. Prendido para Mauricio', falta: 'Apagar el workflow de n8n' },
  748: { estado: 'lista', hizo: '«Para leer» al grabar un audio, con el guion que escribe MaKo gratis' },
  360: { estado: 'lista', hizo: 'MaKo deja de insistir cuando el lead rebate tres veces, y cierra la charla' },
  // #786: la tarjeta pedía resolver que la sembrada #1 tenía el mismo disparador. Medido el
  // 06/10: la #1 está archivada desde el 02/08 y el motor no enrola archivadas
  // (`getSecuenciasActivas`); la 198 le escribió UNA vez a 4 leads nuevos y a ningún viejo.
  786: { estado: 'lista', hizo: 'La bienvenida sale sola, una vez, y sólo a quien llegó en las últimas 72 h' },
  361: { estado: 'lista', hizo: 'El setter lee lo que el lead contestó al agendar y no se lo vuelve a preguntar' },
  745: { estado: 'lista', hizo: 'El onboarding mira lo que hay (la línea, la guía de voz) y no un tilde guardado' },
  358: { estado: 'falta', hizo: 'Los 4 casos de la post-agenda, probados contra el clasificador (7 de 7)', falta: 'Confirmar las 8 propuestas' },
  787: { estado: 'lista', hizo: 'Sale sola sólo al confirmar o cambiar el día; el precio va siempre a borrador' },
  788: { estado: 'lista', hizo: 'MaKo contesta del segundo mensaje en adelante: la charla sigue abierta 7 días' },
  380: { estado: 'lista', hizo: 'Cuando no hay borrador, el aviso dice por qué' },
  324: { estado: 'lista', hizo: 'El mensaje de las 24 h de la post-agenda lo adapta MaKo para cada lead' },
  356: { estado: 'lista', hizo: 'Obsoleta: el ensayo con notas de voz ya no existe' },
  792: { estado: 'lista', hizo: 'El Chatbot es sólo WhatsApp. Instagram salió del producto' },
  // #350: con un audio codificado como la app (lamejs, sin header), el reproductor solo
  // volvió a sonar desde 0 tres veces seguidas en Chrome (storage y recién grabado, 2,5 s y
  // 40 s) y en WebKit (storage). La sospecha escrita en la tarjeta —el truco de duración—
  // no es la causa. La tarjeta queda abierta: no está probado que esté arreglado.
  350: { estado: 'falta', hizo: 'Probado solo: vuelve a sonar desde 0 tres veces seguidas', falta: 'Saber en qué navegador lo viste: así no pasa' },
};

/** Lo que se escribió en producción para que esto ande. Pasado, con su número. */
export const CHATBOT_EN_PRODUCCION = [
  '**El editor de /chatbot es el lienzo**: la lista flota encima, «Publicar» abajo, Ctrl+Z, el ＋ en cada tarjeta y el disparador por tiempo o por acción.',
  '**Los flujos de un cliente ya no corren en la cuenta de Mauricio**: los ocho webhooks pasan el negocio del evento, y sin él no corre nada.',
  '**El webhook de Calendly de Mauricio volvió**: estaba apagado desde el 21/09. Entraron las 3 reservas que faltaban; dos tienen la reunión por delante (9/10 y 13/10).',
  '**Y ya no se apaga solo**: un evento que falla siempre se anota y se contesta bien. Sólo lo que se arregla reintentando le pide a Calendly que reintente.',
  '**Ni se pierde una reserva si la base no contesta**: Calendly la reintenta, en vez de darla por ajena.',
  '**Prendido para Mauricio**: el envío de WhatsApp, el recordatorio al lead y la bienvenida.',
  '**El mensaje de las 24 h** de la post-agenda lo escribe MaKo para cada lead.',
  '**El residuo quedó armado y apagado**: la secuencia de WhatsApp y el mail en borrador.',
  '**El semanal** les llega a los clientes desde el lunes 12/10, por mail.',
];

/** Lo que le queda a Martín. Lo que tiene link, lo lleva al lado. */
export const CHATBOT_TE_TOCA: Array<{ t: string; href?: string; boton?: string }> = [
  { t: '**Confirma los 8 casos** de la post-agenda. Hasta entonces, un agendado que contesta va a una persona.', href: CHATBOT_CASOS, boton: 'Abrir las propuestas' },
  { t: '**Apaga el workflow de n8n** «WhatsApp Reminders for Calendly». Hoy no manda nada, pero duplicaría si alguien recrea su conexión.' },
  { t: '**Corrige el remitente de Mauricio** antes de mandar el mail del residuo: hoy dice «MaKo».' },
  { t: '**Rota la key de Fathom** (FATHOM_API_KEY_MARTIN): quedó impresa en la salida de un agente.' },
  { t: '**Decide** si el residuo sale solo o como borrador, y qué pasa con los 29 que quedaron afuera.' },
  { t: '**Decide** si un lead que faltó a la R1 y vuelve a agendar recibe recordatorios (hoy no).' },
  { t: '**Decide** qué se hace con las llaves de Zernio de dos clientes y con el proyecto Instagram del tablero.' },
  { t: '**Decide** si se avisa cuando la línea vuelve, y si el cliente puede apagar el aviso de línea caída.' },
  { t: '**Decide** qué es «por tiempo» en una secuencia: hoy, un horario que inscribe a quien esté en la etapa. La otra lectura: cuánto espera el primer mensaje.' },
  { t: '**Decide** si /mensajes se absorbe en /chatbot o queda como la tab de los avisos.' },
  { t: '**Decide** el nombre «Chat Analyst» para el dashboard de secuencias: ese nombre era para analizar conversaciones.' },
  { t: '**Decide** si un primer mensaje sin espera sale al instante aunque el deshacer del kanban no llegue a frenarlo (hoy sale).' },
  { t: '**Decide** si un evento de Calendly con datos incompletos se contesta bien y se anota (hoy da error; uno real nunca llega así).' },
  { t: '**Decide** si los fallos anotados de Calendly se ven en alguna pantalla. Hoy sólo con una consulta.' },
  { t: '**Dime en qué navegador** viste que un audio grabado no se volvía a reproducir: con el reproductor solo no pasa.' },
];

