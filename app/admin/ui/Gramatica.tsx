'use client';

// =============================================================================
// La gramática de MaKo, renderizada — los nueve estados de verdad
// =============================================================================
// Va en archivo aparte y no adentro de CatalogoUI.tsx por la tarea #534 (partir
// los archivos gigantes): ese ya pasa las 500 líneas y es el que más se toca.
//
// Los ejemplos son del producto real —una campaña de Meta, un lead del CRM, una
// tarea del Plan— y no «Lorem ipsum». Un catálogo con contenido de relleno
// miente sobre el tamaño de las cosas: la tarjeta de «recomienda» con cinco
// campos ocupa lo que ocupa, y eso hay que poder verlo antes de meterla en una
// columna de 320 px.
//
// ⚠️ ACÁ NO SE EXPLICA NADA. La primera versión tenía, alrededor de cada
// ejemplo, la key en mono, una línea de «qué comunica» y otra de «qué exige», más
// un párrafo de diagnóstico arriba y una nota bajo cada título. Todo eso ya está
// en `lib/mako-gramatica.ts` y en la bitácora, que es donde se lee; acá tapaba
// justo lo único que esta pantalla puede dar y ningún documento puede: **ver las
// piezas**. Regla de la casa: título corto y nada de prosa debajo salvo pedido
// explícito.

import { Mako, Section } from '@/app/_ui';
import { ESTADOS, GRAMATICA, type EstadoMako } from '@/lib/mako-gramatica';

/** Un ejemplo por estado, con los campos que ese estado está obligado a mostrar. */
const EJEMPLOS: Record<EstadoMako, React.ComponentProps<typeof Mako>> = {
  detecto: {
    estado: 'detecto',
    titulo: 'El costo por turno de «Dolor de espalda · Testimonial» se duplicó en 3 días',
    detalle: 'Pasó de $410 a $890 sin que cambiara el presupuesto ni el anuncio.',
    importancia: 'alta',
    cuando: 'hace 40 min',
    evidencia: 'Meta Ads · 5 al 8 de agosto · 41 clics, 2 turnos. La campaña gemela con el mismo presupuesto se mantuvo en $430.',
  },
  // ⚠️ El título es una FRASE COMPLETA. Antes era un fragmento («por qué se
  // duplicó…») porque el rótulo lo arrancaba desde la izquierda; ahora el rótulo
  // es la píldora al final del título, igual que en los otros ocho, así que el
  // título tiene que sostenerse solo. El verbo lo pone la píldora: «Por qué se
  // duplicó el costo por turno» + [Revisando].
  analizando: {
    estado: 'analizando',
    titulo: 'Por qué se duplicó el costo por turno',
    progreso: 0.62,
    fuente: '14 campañas activas',
    pasos: [
      'Leí las 14 campañas activas de los últimos 30 días',
      'Comparé el costo por turno contra su propia media',
      'Buscando qué cambió: creativo, público o presupuesto',
      'Cruzar con lo que pasa en la página de turnos',
    ],
  },
  explica: {
    estado: 'explica',
    titulo: 'Los turnos no bajaron: el 71% ahora llega desde el celular',
    cuando: 'hace 35 min',
    detalle: 'El costo por clic está igual que la semana pasada. Lo que cambió es desde dónde entra la gente, y en el celular el formulario queda abajo de todo.',
    evidencia: 'De 1.240 visitas, 880 entraron desde el celular. Ahí pide turno el 12%; desde la computadora, el 58%.',
  },
  // ⚠️ EL EJEMPLO ES DE UN CLIENTE, NO DE LA CASA. El anterior decía «Mostrar el
  // play sin scroll en mobile» y hablaba del VSL de MaKo: el dueño lo marcó
  // —«pusiste cosas de SuperAdmin, ¿qué tiene que ver eso con los clientes?»— y
  // tenía razón. Este catálogo se usa para diseñar lo que ve un CLIENTE, así que
  // los nueve estados cuentan una sola historia suya: una clínica que pauta en
  // Meta, se le dispara el costo por turno, y MaKo la acompaña de punta a punta.
  // Un ejemplo que habla de nuestro propio producto miente sobre el tamaño y el
  // vocabulario de lo que la pieza va a tener que mostrar.
  recomienda: {
    estado: 'recomienda',
    titulo: 'Subir el formulario de turnos a la primera pantalla del celular',
    // La línea que decide si vale abrir: el resultado y lo que cuesta, en una
    // frase. Sin esto la fila cerrada es un título suelto y hay que abrir las
    // tres para saber cuál importa.
    consecuencia: 'Turnos pedidos de 12% a ~35% · una tarde de trabajo',
    cuando: 'hace 20 min',
    detalle: 'Hoy hay que bajar tres pantallas para llegar al formulario, y el 71% de la gente entra desde el celular. Subirlo no cambia el anuncio ni el presupuesto: cambia lo que pasa cuando ya hiciste el gasto.',
    // ⚠️ «Impacto esperado» y «Esfuerzo» NO están acá: los dice la consecuencia,
    // que es la línea que se ve sin abrir. Estaban en los dos lados y el mismo
    // número aparecía dos veces, una con ~ y otra sin.
    // El estado los sigue exigiendo; lo que cambió es dónde viven.
    datos: [
      { k: 'Responsable', v: 'Quien maneja la web' },
      { k: 'Objetivo', v: 'Bajar el costo por turno' },
      { k: 'Se revisa', v: 'En 7 días' },
    ],
    evidencia: 'De 1.240 visitas, 880 entraron desde el celular. Ahí pide turno el 12%; desde la computadora, donde el formulario se ve de entrada, el 58%.',
    // El Plan ya tiene cómo se escribe el contexto de una tarea (el detalle, la
    // checklist, las preguntas del Perro) y su propia pantalla de revisión. El
    // modal no rehace nada de eso: pasa la tarea y ofrece ir a verla ahí.
    ver: { capacidad: 'experimento', label: 'Probarlo como experimento' },
    accion: { label: 'Pasar al Plan' },
    // «Descartar» → «Ignorar». Un botón tiene que decir qué pasa si lo tocás, y
    // «descartar» suena a que se borra algo. Acá no se borra nada: la sugerencia
    // se deja pasar.
    secundaria: { label: 'Ignorar' },
  },
  // ⚠️ El ejemplo cambió a propósito. Antes era «pausar 3 anuncios», y pausar
  // SE PUEDE DESHACER: pedir permiso ahí gasta la atención que hace falta el día
  // que MaKo quiera hacer algo sin vuelta atrás. Mandar 340 mensajes no se
  // desmanda. Ése es el caso que merece este estado.
  //
  // Y sin redundancia: el título dice QUÉ y por qué, «Alcance» dice solo DÓNDE y
  // «Cambios» solo qué queda distinto. Ningún número ni verbo se repite.
  aprobacion: {
    estado: 'aprobacion',
    // El número entra al TÍTULO porque acá el número es el riesgo: «Enviar la
    // secuencia de reactivación» y «Enviar la secuencia a 340 contactos» piden
    // permiso para cosas muy distintas.
    titulo: 'Enviar la secuencia a 340 contactos',
    // ⚠️ Decía «340 mensajes de WhatsApp» y estaba MAL: son 3 mensajes a cada
    // uno de los 340 contactos, o sea 1.020. Apareció recién al ver la tarjeta
    // abierta, con el título, la consecuencia y el campo uno debajo del otro —
    // el mismo número repetido tres veces es lo que hace visible que uno miente.
    consecuencia: '3 mensajes a cada uno, uno por día · no se puede deshacer',
    cuando: 'hace 2 h',
    detalle: 'Son contactos que dejaron de responder hace más de tres semanas y todavía no fueron marcados como perdidos.',
    datos: [
      { k: 'A quiénes', v: '340 contactos sin respuesta hace más de 21 días' },
      { k: 'Cuándo salen', v: 'Uno por día a las 10:00, desde mañana' },
      { k: 'Desde qué número', v: 'El de la clínica (+598 9…)' },
    ],
    evidenciaRotulo: 'Los tres mensajes, tal cual van a salir',
    // ⚠️ EL TEXTO REAL DE LO QUE SE VA A MANDAR, no un resumen de cuántos son.
    // Antes «Qué reciben: 3 mensajes de WhatsApp» vivía detrás de un click y el
    // botón que los enviaba estaba siempre a la vista: se podía aprobar un envío
    // sin haberlo leído nunca. Es el arreglo más importante de todo el rediseño.
    evidencia: (
      <>
        <div>1. «Hola {'{nombre}'}, quedó pendiente lo que hablamos. ¿Todavía te interesa?»</div>
        <div>2. «Te dejo el caso de alguien que estaba en la misma situación hace tres meses.»</div>
        <div>3. «Si no es el momento, te aviso y no te escribo más. ¿Lo dejamos por ahora?»</div>
      </>
    ),
    // «Desenviar» no existe en español. Y el riesgo del número es el dato que
    // puede hacer que el dueño diga que no, y no estaba en ningún lado.
    advertencia: 'No se puede deshacer. Si varios los marcan como no deseados, WhatsApp puede limitar el número.',
    // ⚠️ ESTE NO LINKEA, Y ES LA EXCEPCIÓN QUE CONFIRMA LA REGLA. `aprobacion`
    // BLOQUEA, y su contrato pide «los cambios previstos, con el texto a la
    // vista». Una aprobación que manda a otra tab a leer lo que se va a enviar
    // es una aprobación que se va a dar sin leer.
    accion: { label: 'Enviar a 340 contactos' },
    // «Ver la lista» dejó de ser botón: la lista es contenido del panel. Y el
    // par de salidas nombra qué pasa con cada una, en vez de Sí/No.
    secundaria: { label: 'No enviar' },
  },
  ejecuta: {
    estado: 'ejecuta',
    titulo: 'Pausar los 3 anuncios que no traen turnos',
    fuente: 'Meta Ads',
    progreso: 0.33,
    pasos: [
      '«Dolor de espalda · Carrusel» pausado',
      'Pausando «Ciática · Estático»',
      'Pausar «Testimonial Ana 30s»',
    ],
    // Va a la segunda línea junto a la fuente, unido por punto medio: «Meta Ads
    // · van 1 de 3». Es el orden de la línea secundaria de Uppy —archivos,
    // datos, tiempo restante— y la regla de Geist: «the bar alone doesn't say
    // what's progressing».
    datos: [{ k: 'van', v: '1 de 3' }],
  },
  // ⚠️ ESTE ES EL EJEMPLO QUE PIDIÓ EL DUEÑO, Y ES `completo`, NO `aprobacion`.
  // «Los mensajes de nutrición que armamos secuencia: no mostrar la secuencia
  // allí, sino permitirles visualizarla yendo a la tab correspondiente.»
  //
  // Elegir el estado decide el diseño entero: `aprobacion` OBLIGA a mostrar el
  // texto completo —«los cambios previstos, con el texto a la vista»— así que
  // los cinco mensajes tendrían que entrar en 600 px. `completo` no, y además
  // es lo que de verdad pasa: la secuencia nace PAUSADA (lib/setting-secuencias.ts),
  // o sea que MaKo hizo algo reversible sin pedir permiso y te lo cuenta.
  //
  // Por eso el modal dice CUÁNTOS y CÓMO terminan, y el link lleva a verlos.
  completo: {
    estado: 'completo',
    // ⚠️ EL VERBO ENTRA AL TÍTULO, y acá es obligatorio. «3 anuncios pausados»
    // es ambiguo entre «hay 3 pausados» y «acabo de pausar 3»: con el rótulo
    // «Hecho» arriba se resolvía solo, y ese rótulo se fue con el kicker. Este
    // estado además es de tono `good`, así que su marca es un punto verde y no
    // la estrella — sin el verbo, lo único que diría que ya pasó sería un color,
    // que es justo lo que la gramática rechaza («un color solo deja afuera a
    // quien no lo distingue»).
    titulo: 'Escribí los 5 mensajes de la secuencia «No Show»',
    cuando: 'hace 1 h',
    detalle: 'Están pausados: no sale nada hasta que los prendas.',
    // NI UN MENSAJE ACÁ. Los cinco se ven y se EDITAN en Automations, así que
    // dibujarlos en el modal garantiza que un día digan algo distinto de lo que
    // el usuario ve al lado. El modal dice cuántos son y cómo terminan.
    datos: [
      { k: 'Para quién', v: 'Los que agendaron y no se presentaron' },
      { k: 'Qué mandan', v: '3 por WhatsApp y 2 por email, uno cada 2 días' },
      { k: 'Hasta cuándo', v: 'Hasta que reagende, o 7 días de silencio' },
    ],
    ver: { capacidad: 'nutricion', ancla: '?sec=no-show&stab=mensajes', label: 'Ver los 5 mensajes' },
    deshacer: { label: 'Descartar la secuencia' },
  },
  vigila: {
    estado: 'vigila',
    titulo: 'Estoy mirando el costo por turno de las campañas activas',
    cuando: 'desde el lunes',
    datos: [
      { k: 'Condición', v: 'Que suba más de 40% contra su propia media de 7 días' },
      { k: 'Frecuencia', v: 'Cada 6 horas' },
      { k: 'Última revisión', v: 'Hoy 09:00' },
      { k: 'Te aviso si', v: 'Se cumple en dos revisiones seguidas' },
    ],
  },
  sin_conclusion: {
    estado: 'sin_conclusion',
    titulo: 'No puedo decirte qué anuncio trae los pacientes que más gastan',
    consecuencia: '38 de 52 tratamientos cerrados no tienen el monto cargado',
    cuando: 'ayer',
    detalle: 'Puedo ver qué anuncio trae turnos, pero no cuánto factura cada uno. Sin eso, «el anuncio más barato» y «el anuncio que más deja» pueden ser dos anuncios distintos y no hay cómo saberlo.',
    // El rótulo del estado ya dice «Falta un dato», así que el campo no puede
    // llamarse «Falta»: eran tres nombres para el mismo hueco (el rótulo, la
    // etiqueta y `exige[0] = "qué fuente falta"`).
    datos: [
      { k: 'Qué dato', v: 'El monto cerrado, en la ficha del paciente' },
      { k: 'Desde cuándo', v: 'Los tratamientos cerrados de los últimos 4 meses' },
      { k: 'Con eso puedo', v: 'Ordenar los anuncios por lo que dejan, no por lo que cuestan' },
    ],
    evidenciaRotulo: 'Lo que sí puedo ver hoy',
    evidencia: '52 tratamientos cerrados en 4 meses, y de esos 14 tienen monto. Con 14 la diferencia entre campañas queda dentro del margen de error.',
    // El CRM resuelve los datos sin marcar en «A revisar» (la vista `/crm?pendientes=1` se borró el 16/10/2026).
    // El modal no rehace ese listado: manda al CRM.
    ver: { capacidad: 'crm-lead', ancla: '', label: 'Abrir el CRM' },
    accion: { label: 'Cargar los montos en el CRM' },
  },
};

export function LaGramatica() {
  return (
    <>
      {/* ⚠️ UNO A LA VEZ, no los nueve apilados.
          Las nueve tarjetas completas una debajo de otra son un muro de texto —y
          además mienten sobre el producto, donde NUNCA se ven dos juntas: se ve
          una, adentro de una pantalla. Los chips hacen de selector, así que de
          paso dejan de ser decoración y se prueban solos: son la variante que va
          en una fila de tabla. */}
      {/* Sin `gap`: son filas de una lista separadas por un filete, no tarjetas
          apiladas. El gap era lo que las convertía en tres cajas iguales una
          debajo de otra — «cards are the lazy container». */}
      <Section titulo="Requiere tu decisión" card>
        <div>
          {ESTADOS.filter((e) => GRAMATICA[e].forma === 'decision').map((e) => <Mako key={e} {...EJEMPLOS[e]} />)}
        </div>
      </Section>

      {/* También sin `gap`: filas con filete, igual que las de decisión. Con el
          gap de 4 px quedaban dos líneas sueltas flotando en el medio de una
          tarjeta grande. */}
      <Section titulo="Está pasando algo" card>
        <div>
          {ESTADOS.filter((e) => GRAMATICA[e].forma === 'curso').map((e) => <Mako key={e} {...EJEMPLOS[e]} />)}
        </div>
      </Section>

      {/* ⚠️ SIN `gap`, igual que las otras dos. Acá había cuatro TARJETAS con
          caja apiladas adentro de esta `Section card`: cajas adentro de una
          caja, que es el «nested cards are always wrong» que ya se había citado
          para sacarle la caja a las decisiones y que no se aplicó abajo. */}
      <Section titulo="Te estás enterando" card>
        <div>
          {ESTADOS.filter((e) => GRAMATICA[e].forma === 'aviso').map((e) => <Mako key={e} {...EJEMPLOS[e]} />)}
        </div>
      </Section>

      {/* El patrón de Linear: la sugerencia pegada al campo que propone cambiar,
          no en una tarjeta aparte. */}
      {/* ⚠️ SIN `maxWidth: 460`. Era el mismo bug del ancho muerto en chiquito:
          un tope pegado a la izquierda adentro de una tarjeta de 1134 px. Ahora
          la pastilla ocupa el ancho del campo, que es lo que va a pasar en la
          ficha real del lead. */}
      <Section titulo="Pegado al dato" card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ⚠️ UNA sola acción visible, no dos. Copilot acepta con Tab y
              descarta con Escape, sin un botón en reposo; Gmail no tiene forma
              de rechazar —seguir escribiendo ES el rechazo—; Linear revela el
              botón recién al pasar el cursor. Y «Asignar a Carolina» al lado de
              un valor que ya dice «Carolina» repetía el dato adentro del botón:
              el verbo alcanza, el objeto está a la izquierda. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>Responsable del seguimiento</span>
            <Mako estado="recomienda" inline titulo="Carolina" detalle="Cerró los últimos 4 turnos de esta campaña."
              accion={{ label: 'Asignar' }} secundaria={{ label: 'Elegir otra' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>Etapa</span>
            <Mako estado="recomienda" inline titulo="Cualificado" detalle="Preguntó el precio y dejó el teléfono."
              accion={{ label: 'Mover' }} secundaria={{ label: 'Dejar como está' }} />
          </div>
        </div>
      </Section>

      <Section titulo="En una fila" card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ESTADOS.map((e) => <Mako key={e} estado={e} compacto />)}
        </div>
      </Section>
      {/* ⚠️ Acá vivía «Second Brain y Perro Guardián»: dos `Status` con un párrafo
          al lado explicando qué hace cada uno. Se sacó porque NO ES UNA PIEZA —
          es documentación, y este archivo abre diciendo que acá no se explica
          nada. Los dos textos siguen en `DESCRIPCIONES` (lib/mako-gramatica.ts),
          que es de donde los toman las pantallas que sí los muestran. */}
    </>
  );
}
