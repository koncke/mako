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

import { Mako, Section, Status } from '@/app/_ui';
import { ESTADOS, GRAMATICA, DESCRIPCIONES, type EstadoMako } from '@/lib/mako-gramatica';

/** Un ejemplo por estado, con los campos que ese estado está obligado a mostrar. */
const EJEMPLOS: Record<EstadoMako, React.ComponentProps<typeof Mako>> = {
  detecto: {
    estado: 'detecto',
    titulo: 'El costo por agenda de «Dolor de espalda · Testimonial» se duplicó en 3 días',
    detalle: 'Pasó de $410 a $890 sin que cambiara el presupuesto ni el creativo.',
    importancia: 'alta',
    evidencia: 'Meta Ads · 5 al 8 de agosto · 41 clics, 2 agendas. La campaña gemela con el mismo presupuesto mantuvo $430.',
  },
  // El rótulo viaja con la fuente: «Revisando» solo es el «Processing…» que
  // Apple marca como el copy a evitar.
  analizando: {
    estado: 'analizando',
    titulo: 'por qué cayó la conversión de la landing',
    progreso: 0.62,
    fuente: '14 campañas activas',
  },
  explica: {
    estado: 'explica',
    // 54 caracteres. El anterior tenía 97 y arrancaba con lo que NO era: en una
    // lista el ojo baja por el margen izquierdo y captura las dos primeras
    // palabras, así que «No es el anuncio» se comía el lugar del hecho.
    titulo: 'El 71% del tráfico nuevo entra desde el celular y el VSL no arranca solo',
    detalle: 'No es el anuncio: el costo por clic está igual que la semana pasada. Lo que cambió es quién llega y desde dónde.',
    evidencia: 'De 1.240 visitas, 880 son mobile. En mobile el play automático está bloqueado por el navegador, y solo el 12% toca el botón. En desktop lo ve el 58%.',
  },
  // ⚠️ El título ya no tiene voseo. «Poné el play visible arriba del pliegue»
  // tenía dos problemas: la forma verbal es rioplatense —y la UI va en español
  // neutro— y «arriba del pliegue» es calco de *above the fold*, jerga que el
  // dueño de un negocio no tiene por qué conocer.
  recomienda: {
    estado: 'recomienda',
    titulo: 'Mostrar el play sin scroll en mobile',
    // La línea que decide si vale abrir: el resultado y lo que cuesta, en una
    // frase. Sin esto la fila cerrada es un título suelto y hay que abrir las
    // tres para saber cuál importa.
    consecuencia: 'Reproducciones de 12% a ~35% · una tarde de trabajo',
    detalle: 'En mobile el navegador bloquea el arranque automático del video, y el botón queda abajo de todo: solo el 12% lo toca.',
    // ⚠️ «Impacto esperado» y «Esfuerzo» NO están acá: los dice la consecuencia,
    // que es la línea que se ve sin abrir. Estaban en los dos lados y el mismo
    // número aparecía dos veces en la misma tarjeta, una con ~ y otra sin.
    // El estado los sigue exigiendo; lo que cambió es dónde viven.
    datos: [
      { k: 'Responsable', v: 'Martín' },
      { k: 'Objetivo', v: 'Bajar el costo por agenda' },
      { k: 'Se revisa', v: 'En 7 días' },
    ],
    evidencia: 'De 1.240 visitas, 880 son mobile. En desktop, donde el video arranca solo, lo ve el 58%.',
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
    detalle: 'Son contactos que dejaron de responder hace más de tres semanas y todavía no fueron marcados como perdidos.',
    datos: [
      { k: 'A quiénes', v: '340 contactos sin respuesta hace más de 21 días' },
      { k: 'Cuándo salen', v: 'Uno por día a las 10:00, desde mañana' },
    ],
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
    accion: { label: 'Enviar a 340 contactos' },
    // «Ver la lista» dejó de ser botón: la lista es contenido del panel. Y el
    // par de salidas nombra qué pasa con cada una, en vez de Sí/No.
    secundaria: { label: 'No enviar' },
  },
  ejecuta: {
    estado: 'ejecuta',
    titulo: '«Testimonial Ana 30s»',
    fuente: 'Meta Ads',
    progreso: 0.33,
    datos: [{ k: 'Van', v: '1 de 3' }],
  },
  // El caso que ya no pide permiso: se hizo, y la salida es Deshacer.
  completo: {
    estado: 'completo',
    // ⚠️ EL VERBO ENTRA AL TÍTULO, y acá es obligatorio. «3 anuncios pausados»
    // es ambiguo entre «hay 3 pausados» y «acabo de pausar 3»: con el rótulo
    // «Hecho» arriba se resolvía solo, y ese rótulo se fue con el kicker. Este
    // estado además es de tono `good`, así que su marca es un punto verde y no
    // la estrella — sin el verbo, lo único que diría que ya pasó sería un color,
    // que es justo lo que la gramática rechaza («un color solo deja afuera a
    // quien no lo distingue»).
    titulo: 'Pausé 3 anuncios',
    detalle: 'Gastaban $4.480 sin traer una sola agenda.',
    datos: [
      { k: 'Cambios', v: 'Pasaron a pausado en Meta · queda en el historial' },
      { k: 'Vuelvo a mirar', v: 'El lunes, con el reporte semanal' },
    ],
    deshacer: { label: 'Deshacer' },
  },
  vigila: {
    estado: 'vigila',
    titulo: 'Estoy mirando el costo por agenda de las campañas activas',
    datos: [
      { k: 'Condición', v: 'Que suba más de 40% contra su propia media de 7 días' },
      { k: 'Frecuencia', v: 'Cada 6 horas' },
      { k: 'Última revisión', v: 'Hoy 09:00' },
      { k: 'Te aviso si', v: 'Se cumple en dos revisiones seguidas' },
    ],
  },
  sin_conclusion: {
    estado: 'sin_conclusion',
    titulo: 'No puedo decirte qué anuncio trae los clientes que más pagan',
    consecuencia: '38 de 52 leads ganados no tienen el monto cargado',
    detalle: 'Puedo ver qué anuncio trae agendas, pero no cuánto factura cada una.',
    // El rótulo del estado ya dice «Falta un dato», así que el campo no puede
    // llamarse «Falta»: eran tres nombres para el mismo hueco (el rótulo, la
    // etiqueta y `exige[0] = "qué fuente falta"`).
    datos: [
      { k: 'Qué dato', v: 'El monto cerrado, en la ficha del lead' },
      { k: 'Desde cuándo', v: 'Los leads ganados de los últimos 4 meses' },
    ],
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

      <Section titulo="Está pasando algo" card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ESTADOS.filter((e) => GRAMATICA[e].forma === 'curso').map((e) => <Mako key={e} {...EJEMPLOS[e]} />)}
        </div>
      </Section>

      <Section titulo="Te estás enterando" card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ESTADOS.filter((e) => GRAMATICA[e].forma === 'aviso').map((e) => <Mako key={e} {...EJEMPLOS[e]} />)}
        </div>
      </Section>

      {/* El patrón de Linear: la sugerencia pegada al campo que propone cambiar,
          no en una tarjeta aparte. El «por qué» aparece al pasar el cursor. */}
      <Section titulo="Pegado al dato" card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 460 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>Responsable</span>
            {/* Ningún botón de MaKo puede ser «Sí», «No» ni «Aceptar» a secas:
                cada uno nombra su acción Y su objeto. «No» no dice qué pasa. */}
            <Mako estado="recomienda" inline titulo="Martín" detalle="Cerró las últimas 4 tareas de esta campaña."
              accion={{ label: 'Asignar a Martín' }} secundaria={{ label: 'Elegir otro' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>Etapa</span>
            <Mako estado="recomienda" inline titulo="Cualificado" detalle="Pidió precio y dejó teléfono."
              accion={{ label: 'Mover a Cualificado' }} secundaria={{ label: 'Dejar como está' }} />
          </div>
        </div>
      </Section>

      <Section titulo="En una fila" card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {ESTADOS.map((e) => <Mako key={e} estado={e} compacto />)}
        </div>
      </Section>

      <Section titulo="Second Brain y Perro Guardián" card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {Object.values(DESCRIPCIONES).map((d) => (
            <div key={d.nombre} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <Status tono="mako">{d.nombre}</Status>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>{d.que_hace}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
