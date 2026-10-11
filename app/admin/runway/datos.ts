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
  { fecha: '2026-11-30', rotulo: '30 NOV', nota: 'se acaba el capital', tono: 'malo' },
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
// El 09/10 se cerraron #328, #358 y #790 con su prueba medida en la base (borrador
// propmv17h8dzpvf0o), y #17 con el push de la reagenda y el link de Cal.com.
//
// El detalle técnico, en docs/hallazgos-comunicacion.md → «Las seis tarjetas del Chatbot
// en paralelo» y «El setter con la charla de verdad».

export const CHATBOT_MEDIDO = '5, el 6 y el 9 de octubre de 2026';

/** Las propuestas de los casos de la post-agenda (#358), en el negocio de Mauricio. */
export const CHATBOT_CASOS = '/mako/revisar?ws=1';

export type EstadoChatbot = 'lista' | 'falta';

/** Lo que se hizo con UNA tarjeta de un apartado. «Cerrada» no va acá: la dice el tablero. */
export type TareaApartado = { estado: EstadoChatbot; hizo: string; falta?: string };

/** Algo que le toca a Martín. Si tiene adónde ir, lleva el link. */
export type Pendiente = { t: string; href?: string; boton?: string };

export const CHATBOT_TAREAS: Record<number, TareaApartado> = {
  // #834: la prueba del borrador decía «ningún camino cae en el de Mauricio» y quedaban SIETE
  // llamadas a los flujos que caían ahí (los webhooks de Calendly, Cal.com, Chatwoot y Meta).
  // Se cerró con el arreglo de esas siete, no con la prueba vieja.
  834: { estado: 'lista', hizo: 'Ni los avisos ni los flujos se cruzan entre negocios, y el semanal sale a cada cliente con lo suyo' },
  328: { estado: 'lista', hizo: 'Salió el primer audio de la post-agenda el 06/10, y el segundo paso el 07/10' },
  784: { estado: 'lista', hizo: 'Se vigila cada línea de cada negocio y el aviso le llega al dueño de esa línea' },
  790: { estado: 'lista', hizo: 'WhatsApp escalonado a 63 con reunión y mail a 884 formularios: armados y apagados, como decidiste' },
  19: { estado: 'lista', hizo: 'La cobranza sale al grupo del dueño; al cliente nada, como decidiste' },
  789: { estado: 'lista', hizo: 'Con una reunión nueva, la post-agenda vuelve a salir' },
  17: { estado: 'lista', hizo: 'A las 24 h, 1 h y 15 min, con el link. El primero salió el 09/10; reagendar limpia el «no asistió» y Cal.com también guarda el link' },
  748: { estado: 'lista', hizo: '«Para leer» al grabar un audio, con el guion que escribe MaKo gratis' },
  360: { estado: 'lista', hizo: 'MaKo deja de insistir cuando el lead rebate tres veces, y cierra la charla' },
  // #786: la tarjeta pedía resolver que la sembrada #1 tenía el mismo disparador. Medido el
  // 06/10: la #1 está archivada desde el 02/08 y el motor no enrola archivadas
  // (`getSecuenciasActivas`); la 198 le escribió UNA vez a 4 leads nuevos y a ningún viejo.
  786: { estado: 'lista', hizo: 'La bienvenida sale sola, una vez, y sólo a quien llegó en las últimas 72 h' },
  361: { estado: 'lista', hizo: 'El setter lee lo que el lead contestó al agendar y no se lo vuelve a preguntar' },
  745: { estado: 'lista', hizo: 'El onboarding mira lo que hay (la línea, la guía de voz) y no un tilde guardado' },
  358: { estado: 'lista', hizo: 'Los 4 casos de la post-agenda, cargados en las dos y probados contra el clasificador (7 de 7)' },
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
  '**Ya salen solos**: el primer audio de la post-agenda (06/10) y el primer recordatorio de 24 h (09/10).',
  '**Reagendar limpia el «no asistió»**, en Calendly y en Cal.com, y el historial del lead lo guarda.',
  '**Cal.com también guarda el link** de la reunión, así el recordatorio lo lleva.',
  '**Cuando la línea de un cliente vuelve, le llega «Volvió tu WhatsApp»**, y los dos avisos los puede apagar él.',
  '**«Lo adapta MaKo» anda con la key de Gemini** de los clientes que sólo tienen ésa.',
];

/** Lo que le queda a Martín. Lo que tiene link, lo lleva al lado. */
export const CHATBOT_TE_TOCA: Pendiente[] = [
  { t: '**Apaga el workflow de n8n** «WhatsApp Reminders for Calendly». Hoy no manda nada, pero duplicaría si alguien recrea su conexión.' },
  { t: '**El día que mandes el mail del residuo**, corrige antes el remitente de Mauricio: hoy dice «MaKo».' },
  { t: '**Rota la key de Fathom** (FATHOM_API_KEY_MARTIN): quedó impresa en la salida de un agente.' },
  { t: '**Decide** qué se hace con las llaves de Zernio de dos clientes y con el proyecto Instagram del tablero.' },
  { t: '**Decide** qué es «por tiempo» en una secuencia: hoy, un horario que inscribe a quien esté en la etapa. La otra lectura: cuánto espera el primer mensaje.' },
  { t: '**Decide** si /mensajes se absorbe en /chatbot o queda como la tab de los avisos.' },
  { t: '**Decide** el nombre «Chat Analyst» para el dashboard de secuencias: ese nombre era para analizar conversaciones.' },
  { t: '**Decide** si un primer mensaje sin espera sale al instante aunque el deshacer del kanban no llegue a frenarlo (hoy sale).' },
  { t: '**Decide** si un evento de Calendly con datos incompletos se contesta bien y se anota (hoy da error; uno real nunca llega así).' },
  { t: '**Decide** si los fallos anotados de Calendly se ven en alguna pantalla. Hoy sólo con una consulta.' },
  { t: '**Dime en qué navegador** viste que un audio grabado no se volvía a reproducir: con el reproductor solo no pasa.' },
];

// =============================================================================
// Customer Success — el cierre del proyecto (06-07/10/2026)
// =============================================================================
// Pedido de Martín (06/10): «Revisa todo lo que falta en el proyecto de Customer Success y
// terminalo todo, cierra las tareas», y al día siguiente: «Dejame aquí los avances que se
// hicieron». Una auditoría de las 12 tarjetas contra el código dio CERO hechas; lo que no
// necesitaba una decisión se hizo en una tanda, y lo que sí, en otra con sus respuestas.
//
// ⚠️ EL MISMO REPARTO QUE EL CHATBOT: título, prioridad y «Cerrada» salen del tablero en cada
// carga. Acá vive sólo QUÉ SE HIZO y QUÉ FALTA. El detalle técnico, en
// docs/hallazgos-customer-success.md → «El cierre del proyecto».

export const CS_MEDIDO = '6 y el 7 de octubre de 2026';

/** La ficha de la clienta que quedó en una etapa que su producto no tiene (ws1, lead 21). */
export const CS_FICHA_HUERFANA = '/customer-success?ws=1&cliente=21';

export const CS_TAREAS: Record<number, TareaApartado> = {
  693: { estado: 'lista', hizo: 'Grabar / No grabar en cada clase, y cuántas faltan arriba' },
  692: { estado: 'lista', hizo: 'Notas con archivos en cada clase y en cada etapa; el alumno no las ve' },
  694: { estado: 'lista', hizo: 'Los dos campos que faltaban, en el curso de Mauricio y en la semilla' },
  660: { estado: 'lista', hizo: 'Whop salió: el programa vive en MaKo, en 9 etapas y 107 clases' },
  109: { estado: 'lista', hizo: 'La tabla suma «Último contacto» y «Vencidas», y te avisa de un cliente 21 días quieto' },
  747: { estado: 'lista', hizo: 'Un cliente puede ser «Sin cobro»: el CRM no le pide monto y no baja tu ticket' },
  780: { estado: 'lista', hizo: 'A los 3 días sin entrar, el alumno recibe por WhatsApp los videos que le faltan' },
  666: { estado: 'falta', hizo: 'La etapa de cada cliente se guarda con su historial, y el estado lo marca MaKo', falta: 'Decidir si la «Próxima llamada» es el próximo hito' },
  665: { estado: 'falta', hizo: 'La agenda aparece al completar la etapa, m6-m9 se contestan por área con su link, y la IA propone y el cliente aprueba', falta: 'Pegar el Calendly de cada etapa, y que un cliente real lo use' },
  107: { estado: 'falta', hizo: 'Las llamadas de entrega se analizan gratis: resumen, riesgos con su cita y próximos pasos', falta: 'Que Gemini conteste: hoy está saturado y reintenta cada hora' },
  667: { estado: 'falta', hizo: 'El borrador del protocolo, en tuteo y sin precios', falta: 'Que Mauricio decida la renovación y lo apruebe' },
  663: { estado: 'falta', hizo: 'Nada todavía', falta: 'Espera a que los clientes carguen sus palancas por área' },
};

/** El borrador del Plan con los cierres de este apartado (07/10). */
export const CS_BORRADOR = '/plan/revisar/propavremjgpwd98';

/** Lo que se escribió en producción para que esto ande. Pasado, con su número. */
export const CS_EN_PRODUCCION = [
  '**Las llamadas de entrega se analizan** en vez de tirarse: hay 283 en cola (129 de Mauricio) y entran de a dos por hora, gratis, cuando Google contesta.',
  '**Una clienta quedó en una etapa que su producto no tiene** porque el sistema validaba contra las etapas de fábrica cuando no podía leer las suyas. Ya no pasa.',
  '**Mover a un cliente ya no puede mandar dos WhatsApp**, y el historial dice quién lo movió, no «CRM».',
  '**La tabla de Clientes** suma «Último contacto» y «Vencidas», y cada mañana te avisa de quien lleva 21 días quieto. Al cliente no le llega nada.',
  '**«Sin cobro»**: un becado es cliente sin que el CRM le pida monto ni te baje el ticket.',
  '**El curso de Mauricio**: grabar / no grabar, notas con archivos, m6-m9 por área con el link de cada líder, la agenda al completar la etapa y la IA que propone la respuesta con lo hablado.',
  '**El recordatorio de clases** sale por WhatsApp a los 3 días sin entrar, con copia a Mauricio. Hoy no hay a quién: 0 invitados.',
  '**MaKo ve las tareas vencidas** de cada cliente y el avance de su curso.',
];

/** Lo que le queda a Martín. Lo que tiene link, lo lleva al lado. */
export const CS_TE_TOCA: Pendiente[] = [
  { t: '**Revisa el borrador del Plan**: las 2 a medias y las 7 tarjetas nuevas. Las 7 hechas ya se cerraron.', href: CS_BORRADOR, boton: 'Abrir el borrador' },
  { t: '**Ubica a Teresa** (quedó en «onboarding», que ya no existe): se mueve desde su ficha y no le manda nada.', href: CS_FICHA_HUERFANA, boton: 'Abrir su ficha' },
  { t: '**Ubica a los 14 clientes** en su etapa real, pega el Calendly de cada etapa y, con los videos grabados, invítalos.' },
  { t: '**Mándale a Mauricio el borrador de graduación** (docs/protocolos/graduacion.md): la renovación primero, sus contratos vencen en octubre y noviembre.' },
  { t: '**Prende la purga de archivos** con CURSO_PURGA_BORRAR=1 en Vercel, después de leer una corrida en modo prueba.' },
  { t: '**Contesta las decisiones abiertas**: el PAS, el Calendly de las sesiones, la baja en el kanban, «pausado», el becado en el CAC y /cs-analyst. Están en una tarjeta del borrador.' },
]

// =============================================================================
// El Onboarding — la depuración del proyecto (10/10/2026)
// =============================================================================
// Pedido de Martín (10/10): «Revisa el proyecto del plan "ONBOARDING" y ponlo todo en
// Runway... Revisa según nuestro criterio si no hay que repriorizar o eliminar
// directamente tareas innecesarias».
//
// ⚠️ EL MISMO REPARTO QUE EL CRM: título, prioridad y «Hecha» salen del tablero en cada
// carga, y acá vive sólo el veredicto, con la misma regla de qué contesta cada motivo
// (ver el comentario de CRM_VEREDICTOS). Las «se va» se cerraron en el tablero el mismo
// día, con la evidencia en el historial de cada tarjeta: por eso llevan `hecho`.
//
// El criterio: la etapa 3 del plan vigente («Onboarding + el video», que vencía el 9/10)
// y la poda del 03/10 (P2 y P4 eliminados). Lo que sólo servía a la versión gratis se
// pospone, no se borra: la versión gratis se postergó, no se descartó. Las prioridades
// se escribieron en la BASE (`score_base`), que es de donde arranca el reparto diario.
// El detalle, en docs/hallazgos-onboarding.md → «La depuración del proyecto».

export const ONB_MEDIDO = '10 de octubre de 2026';

export const ONB_VEREDICTOS: Record<number, { que: Veredicto; motivo: string; hecho?: string }> = {
  // ── Se queda: qué se rompe sin esto ──
  734: { que: 'queda', motivo: 'Sin esto, quien paga y entra solo se traba en el paso 2 cuando se le acaba la cuota de Gemini' },
  171: { que: 'queda', motivo: 'Sin esto ningún cliente nuevo trae su histórico de leads de Meta, y nada lo avisa' },
  737: { que: 'queda', motivo: 'Es «el video» de la etapa: sin el tutorial, cada llamada grupal se va en «¿qué es esto?»' },
  801: { que: 'queda', motivo: 'El Ads Manager abre sin decir qué falta conectar: no tiene onboarding ni panel' },
  201: { que: 'queda', motivo: 'Una cuenta de Instagram figura «leída» con el perfil vacío, y el cliente cree que MaKo la entendió' },

  // ── Se va: por qué ya no queda nada que hacer ──
  372: { que: 'va', motivo: 'Ya está: Automations mira la línea en vivo', hecho: 'Automations abre con el QR si no hay WhatsApp y avisa si la línea se cae: nunca pide lo que ya está' },
  309: { que: 'va', motivo: 'Ya pasó lo que pedía', hecho: 'A Leila le llegó el código el 03/08, y que la línea esté viva lo dice el QR' },
  706: { que: 'va', motivo: 'Lo resuelve el plan que escribe MaKo', hecho: 'El plan ya no viene igual para todos: lo escribe MaKo con lo que el cliente contestó, y él lo revisa antes' },
  707: { que: 'va', motivo: 'Lo resuelve el plan que escribe MaKo', hecho: 'El plan que MaKo escribe al terminar ya sale del diagnóstico: la fase y el cuello' },

  // ── Se pospone: cómo se sobrevive sin eso ──
  614: { que: 'pospone', motivo: 'El arranque ya muestra el diagnóstico al terminar. El PDF por WhatsApp era para la versión gratis' },
  652: { que: 'pospone', motivo: 'Ya son 6 pasos, y Meta y el teléfono se dejan para después. Lo que falta era para la versión gratis' },
  607: { que: 'pospone', motivo: 'La bienvenida animada ya está. El video de 1 a 2 minutos era para la versión gratis' },
  608: { que: 'pospone', motivo: 'Era para que un usuario gratis quiera pagar, y la versión gratis se postergó' },
  532: { que: 'pospone', motivo: 'Los clientes que abandonaron se trabaron al conectar, no por no entender un paso' },
  164: { que: 'pospone', motivo: 'La Retro ya no es un paso del arranque: es una opción al final, que el cliente elige' },
  699: { que: 'pospone', motivo: 'Es del Copy Generator, no del arranque. En el Ads Writer cada guion ya se borra o se edita suelto' },
  214: { que: 'pospone', motivo: 'Quien agenda y no asiste ya cae en «se caen los leads», y el CRM separa los no-show' },
  213: { que: 'pospone', motivo: 'No frena a nadie: el resultado se lee, aunque la letra sea chica' },
  743: { que: 'pospone', motivo: 'Ninguna automatización de Leila usa esos audios. Se borran cuando ella vaya a regrabar' },
};

/**
 * Las que se BORRARON del tablero: ya no tienen fila de la que leer el título, así que va
 * escrito acá y se dibuja al pie, como CRM_NUEVA. El respaldo de la fila entera está en
 * dashboard-marketing-main/backups/onboarding-depuracion-2026-10-10.json (fuera del repo).
 */
export const ONB_ELIMINADAS = [
  {
    num: 625,
    titulo: 'Reiniciar el onboarding de Leila para pruebas, sin perder su CRM ni su plan',
    motivo: 'El arranque se prueba en el Cliente de Prueba, que está sin empezar: no hace falta tocar la cuenta de Leila',
  },
];

/** Lo que le queda a Martín de este proyecto. */
export const ONB_TE_TOCA: Pendiente[] = [
  { t: '**Ponle fecha a las 5 que quedan**: la etapa vencía el 9/10. Primero #734 y #171, que son las que traban a un cliente.' },
  { t: '**Graba el video tutorial** (#737): es lo único de la etapa que no es código.' },
]

// =============================================================================
// El Dashboard: la depuración del proyecto del tablero (11/10)
// =============================================================================
// Pedido de Martín (10/10, por el chat «MaKo Pricing»): «Quiero desarrollar la tab de
// Graphics como te lo indiqué... y también dile que revise el proyecto de Dashboard en el
// PLAN, para que revise las tareas... Revisa según nuestro criterio si no hay que reprioizar
// o eliminar directamente tareas innecesarias», y «Sí, en Runway».
//
// El mismo reparto que el CRM y el Onboarding: título, prioridad y «Hecha» salen del tablero
// en cada carga; acá vive sólo el veredicto (ver el comentario de CRM_VEREDICTOS). El
// criterio: el Dashboard no está en ninguna de las cinco etapas del 1/10, y la poda («si es
// puede ser, no se hace»). Lo que se construyó en la misma tanda —Graphics › Mis gráficos— se
// llevó dos tarjetas y explica otra. El detalle, en docs/hallazgos-graficos.md.

export const DASH_MEDIDO = '11 de octubre de 2026';

export const DASH_VEREDICTOS: Record<number, { que: Veredicto; motivo: string; hecho?: string }> = {
  // ── Se va: por qué ya no queda nada que hacer ──
  320: { que: 'va', motivo: 'Ya está en Mis gráficos', hecho: '«Costo por agenda» es una métrica de Mis gráficos (pauta ÷ agendas de Meta), y el informe inicial la trae' },
  326: { que: 'va', motivo: 'Lo cubre Mis gráficos', hecho: 'Cada persona arma su tablero con el período que elige. Las palancas con semáforo nunca se definieron' },
  322: { que: 'va', motivo: 'No queda qué arreglar', hecho: 'Julio es el tracking caído del 15/07 al 03/08, que no se recupera. Mis gráficos separa las agendas de Meta y las del CRM' },
  341: { que: 'va', motivo: 'Ya agrupa por lunes', hecho: 'La base y la app agrupan las cohortes por lunes, y un test lo fija' },

  // ── Se pospone: cómo se sobrevive sin eso ──
  705: { que: 'pospone', motivo: 'Lo histórico se mira con «Máximo». Leticia figura perdida con un pago cobrado: se corrige en su ficha' },
  323: { que: 'pospone', motivo: 'Falta el conteo a mano de Mauricio para comparar, y es historia de marzo a julio' },
  219: { que: 'pospone', motivo: 'La meta de plata ya se carga en /general. La capacidad nunca se definió, y Objetivos va después' },
  321: { que: 'pospone', motivo: 'El período exacto se mira en Mis gráficos. El piso de Tendencias es anterior a la pauta más vieja' },
  342: { que: 'pospone', motivo: 'El desglose sólo perdería gente arriba de 1.000 agendas al año, y el ws1 tiene 129' },
  670: { que: 'pospone', motivo: 'Pinta mal un estado de un mapa que mira una sola cuenta: no frena ninguna decisión' },
};

/** Lo que le queda a Martín de este proyecto. */
export const DASH_TE_TOCA: Pendiente[] = [
  { t: '**Arma tu informe** en Mis gráficos: elige los gráficos y átales datos.', href: '/graficos', boton: 'Abrir Mis gráficos' },
  { t: '**Corrige a Leticia** en el CRM de Leila: figura perdida con un pago cobrado de US$40 (#705).' },
];
