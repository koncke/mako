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
import { ESTADOS, DESCRIPCIONES, type EstadoMako } from '@/lib/mako-gramatica';

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
      <Section titulo="Los nueve estados" card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ESTADOS.map((e) => <Mako key={e} {...EJEMPLOS[e]} />)}
        </div>
      </Section>

      {/* Los mismos nueve, en chip. Sin título de ejemplo: en el catálogo obligaba
          a inventar «esta campaña» nueve veces, y ese relleno era lo único que se
          leía. Solos y del mismo largo se ven como lo que son, un juego. */}
      <Section titulo="En una línea" card>
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
