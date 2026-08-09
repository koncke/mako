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
    titulo: 'No es el anuncio: es que el 71% del tráfico nuevo entra desde el celular y el VSL no arranca solo',
    detalle: 'El costo por clic está igual que la semana pasada. Lo que cambió es quién llega y desde dónde.',
    evidencia: 'De 1.240 visitas, 880 son mobile. En mobile el play automático está bloqueado por el navegador, y solo el 12% toca el botón. En desktop lo ve el 58%.',
  },
  recomienda: {
    estado: 'recomienda',
    titulo: 'Poné el play visible arriba del pliegue en mobile',
    datos: [
      { k: 'Impacto esperado', v: 'Reproducciones de 12% a ~35%' },
      { k: 'Esfuerzo', v: 'Bajo · una tarde' },
      { k: 'Responsable', v: 'Martín' },
      { k: 'Objetivo', v: 'Bajar el costo por agenda' },
      { k: 'Se revisa', v: 'En 7 días' },
    ],
    accion: { label: 'Pasar al Plan' },
    secundaria: { label: 'Descartar' },
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
    titulo: 'Enviar la secuencia de reactivación',
    detalle: 'No se puede desenviar.',
    datos: [
      { k: 'A quiénes', v: '340 contactos sin respuesta hace más de 21 días' },
      { k: 'Qué reciben', v: '3 mensajes de WhatsApp, uno por día, a las 10:00' },
    ],
    accion: { label: 'Enviar la secuencia' },
    secundaria: { label: 'Ver la lista' },
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
    titulo: '3 anuncios pausados',
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
      { k: 'Te aviso si', v: 'Se cumple dos revisiones seguidas' },
    ],
  },
  sin_conclusion: {
    estado: 'sin_conclusion',
    titulo: 'No puedo decirte qué anuncio trae los clientes que más pagan',
    detalle: 'Puedo ver qué anuncio trae agendas, pero no cuánto factura cada una.',
    datos: [{ k: 'Falta', v: 'El monto cerrado en la ficha del lead. Hoy 38 de 52 leads ganados no lo tienen' }],
    accion: { label: 'Ir a completarlos en el CRM' },
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
      <Section titulo="Tenés que decidir" card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <Mako estado="recomienda" inline titulo="Martín" detalle="Cerró las últimas 4 tareas de esta campaña."
              accion={{ label: 'Asignar' }} secundaria={{ label: 'No' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>Etapa</span>
            <Mako estado="recomienda" inline titulo="Cualificado" detalle="Pidió precio y dejó teléfono."
              accion={{ label: 'Mover' }} secundaria={{ label: 'No' }} />
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
