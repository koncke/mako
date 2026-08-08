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

import { Mako, Section, Status, ButtonLink } from '@/app/_ui';
import { ESTADOS, GRAMATICA, DESCRIPCIONES, type EstadoMako } from '@/lib/mako-gramatica';
import { MONO } from '@/app/_ui';

/** Un ejemplo por estado, con los campos que ese estado está obligado a mostrar. */
const EJEMPLOS: Record<EstadoMako, React.ComponentProps<typeof Mako>> = {
  detecto: {
    estado: 'detecto',
    titulo: 'El costo por agenda de «Dolor de espalda · Testimonial» se duplicó en 3 días',
    detalle: 'Pasó de $410 a $890 sin que cambiara el presupuesto ni el creativo.',
    importancia: 'alta',
    evidencia: 'Meta Ads · 5 al 8 de agosto · 41 clics, 2 agendas. La campaña gemela con el mismo presupuesto mantuvo $430.',
  },
  analizando: {
    estado: 'analizando',
    titulo: 'Buscando por qué se cayó la conversión de la landing',
    progreso: 0.62,
    fuente: 'landing_visits, vsl_events y las 14 campañas activas',
  },
  explica: {
    estado: 'explica',
    titulo: 'No es el anuncio: es que el 71% del tráfico nuevo entra desde el celular y el VSL no arranca solo',
    detalle: 'El costo por clic está igual que la semana pasada. Lo que cambió es quién llega y desde dónde.',
    evidencia: 'De 1.240 visitas, 880 son mobile. En mobile el play automático está bloqueado por el navegador, y solo el 12% toca el botón. En desktop lo ve el 58%.',
  },
  recomienda: {
    estado: 'recomienda',
    titulo: 'Poné una miniatura con botón de play visible arriba del pliegue en mobile',
    datos: [
      { k: 'Impacto esperado', v: 'Reproducciones de +12% a ~35%' },
      { k: 'Esfuerzo', v: 'Bajo · una tarde' },
      { k: 'Responsable', v: 'Martín' },
      { k: 'Objetivo', v: 'Bajar el costo por agenda' },
      { k: 'Se revisa', v: 'En 7 días' },
    ],
    accion: { label: 'Convertir en tarea del Plan' },
    secundaria: { label: 'No ahora' },
  },
  aprobacion: {
    estado: 'aprobacion',
    titulo: 'Puedo pausar los 3 anuncios que gastaron más de $1.500 sin una sola agenda',
    datos: [
      { k: 'Alcance', v: '3 anuncios de 2 conjuntos, campaña «Retargeting · Agosto»' },
      { k: 'Cambios', v: 'Pasan a PAUSADO en Meta. El presupuesto del conjunto no se toca' },
    ],
    accion: { label: 'Aprobar y pausar' },
    secundaria: { label: 'Ver cuáles son' },
  },
  ejecuta: {
    estado: 'ejecuta',
    titulo: 'Pausando los anuncios en Meta',
    progreso: 0.33,
    datos: [{ k: 'Elementos', v: '1 de 3 · «Testimonial Ana 30s»' }],
  },
  completo: {
    estado: 'completo',
    titulo: 'Listo: 3 anuncios pausados',
    datos: [
      { k: 'Resultado', v: 'Se liberan ~$1.500/día de gasto sin retorno' },
      { k: 'Cambios', v: '3 anuncios a PAUSADO · queda registrado en el historial' },
      { k: 'Próximo control', v: 'Lunes 11, con el reporte semanal' },
    ],
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
      <Section
        titulo="Los nueve estados de MaKo"
        nota="el rótulo sale de lib/mako-gramatica.ts, nunca de la pantalla"
        card
      >
        <p style={{ margin: '0 0 4px', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6, maxWidth: '70ch' }}>
          El diagnóstico del documento es que <em>«la inteligencia de MaKo aparece fragmentada»</em>:
          Retro, Second Brain, Perro Guardián, Semáforo, Chat Agent y las recomendaciones no comparten
          una gramática. Hoy hay <strong>35 archivos</strong> que escriben su propio «analizando…».
          La tarea está lista cuando el mismo estado se ve y se llama igual en el Plan, el Dashboard,
          el CRM y el chat — por eso el rótulo no es un prop.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 10 }}>
          {ESTADOS.map((e) => (
            <div key={e}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <code style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{e}</code>
                <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{GRAMATICA[e].comunica}</span>
              </div>
              <Mako {...EJEMPLOS[e]} />
              <div style={{ marginTop: 6, fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>
                Exige: {GRAMATICA[e].exige.join(' · ')}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section titulo="La versión de una línea" nota="para una fila de tabla o el encabezado de una card" card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
          {ESTADOS.map((e) => (
            <Mako key={e} estado={e} compacto titulo={e === 'analizando' ? 'la landing' : 'esta campaña'} />
          ))}
        </div>
      </Section>

      <Section titulo="El semáforo no vive acá" nota="tiene su propio registro" card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6, maxWidth: '70ch' }}>
            El verde/ámbar/rojo/gris apareció trabajando esta gramática —eran dos tipos
            incompatibles y había que unificarlos— pero <strong>no es parte del rediseño</strong>:
            no es una pieza del sistema de diseño, es un concepto del producto que lo cruza entero.
            Que dos cosas se toquen no las hace la misma tarea, y un registro que cuenta lo que no le
            toca deja de servir para lo que sí.
          </p>
          <ButtonLink href="/admin/dev/semaforo" variant="secondary">Ir al registro del semáforo →</ButtonLink>
        </div>
      </Section>

      <Section titulo="Las dos traducciones fijas" nota="un nombre propio no explica nada solo" card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
          {Object.values(DESCRIPCIONES).map((d) => (
            <div key={d.nombre} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Status tono="mako">{d.nombre}</Status>
              </span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>{d.que_hace}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
