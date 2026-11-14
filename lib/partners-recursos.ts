// =============================================================================
// partners-recursos — lo que el partner usa para recomendar MaKo: el PDF de venta y los mensajes para copiar (27/10/2026)
// =============================================================================
// Compromiso de Martín en la llamada con Leila (Fathom 876470842-25), para esta semana: «recursos para revender» en MaKo
// Partners — PDF, audios, videos y mensajes. Arranca con lo que no hay que grabar: el PDF de venta (con SU link y SU código
// adentro) y los mensajes listos para copiar. Los audios y los videos los graba Martín; hasta que existan NO se muestran (nada
// de «próximamente»): la lista de lo que falta está en docs/hallazgos-partners.md.
//
// TODO SALE DE LO QUE MaKo VENDE DE VERDAD: los planes y sus precios (lib/planes-mako.ts) y lo que trae cada uno, dicho como la
// tabla de /planes (lib/planes-comparacion.ts, sin jerga: Leila, 27/10). Un precio o un tope que cambia cambia el PDF y los
// mensajes solos. Y no promete nada que el programa no dé: quien llega con el código no tiene descuento (no está decidido).
// Puro: lo dibuja app/partners/RecursosPartner.tsx y lo fija tests/partners-recursos.test.ts.
// =============================================================================

import { NOMBRE_PLAN_CON_PRUEBA, PLANES_MAKO_DEFAULT, PRUEBA_DIAS, PRUEBA_GRATIS_PRENDIDA, type PlanMako } from './planes-mako';
import { filasDeComparacion, GRUPOS_COMPARACION, type Celda, type FilaComparacion } from './planes-comparacion';

export type MensajeParaCopiar = { id: string; titulo: string; texto: string };

const usd = (n: number) => `US$ ${n.toLocaleString('es-AR')}`;
const planDe = (planes: readonly PlanMako[], id: string) => planes.find((x) => x.id === id && x.activo) ?? null;

/**
 * Los mensajes para copiar (en tú, cortos, con SU link). Uno por situación: el conocido, el estado o un grupo, Instagram, el
 * precio (con el código, que es lo que el comprador pone al pagar) y el seguimiento.
 */
export function mensajesParaCopiar(p: { link: string; codigo: string; planes?: readonly PlanMako[] }): MensajeParaCopiar[] {
  const planes = p.planes ?? PLANES_MAKO_DEFAULT;
  const esencial = planDe(planes, 'esencial');
  const pro = planDe(planes, 'pro');
  // La prueba es sólo de Pro desde el 12/11/2026 (`planConPrueba`, lib/planes-mako.ts): los mensajes lo dicen.
  const gratis = `${PRUEBA_DIAS} días gratis con ${NOMBRE_PLAN_CON_PRUEBA}`;
  const entrada = PRUEBA_GRATIS_PRENDIDA ? `${NOMBRE_PLAN_CON_PRUEBA} empieza con ${PRUEBA_DIAS} días gratis y te das de baja cuando quieras.` : 'Te das de baja cuando quieras.';
  const precio = [esencial && `MaKo Esencial cuesta ${usd(esencial.precioUsd)} por mes`, pro && `MaKo Pro, ${usd(pro.precioUsd)}`].filter(Boolean).join(' y ');
  return [
    {
      id: 'conocido', titulo: 'Para un conocido, por WhatsApp',
      texto: `Hola, ¿cómo estás? Estoy usando MaKo para vender con mi negocio: tus contactos, tu WhatsApp y tus anuncios en un solo lugar, con un asistente de IA que te ayuda a decidir qué hacer. ${PRUEBA_GRATIS_PRENDIDA ? `Lo pruebas ${gratis}` : 'Míralo aquí'}: ${p.link}`,
    },
    {
      id: 'estado', titulo: 'Para tu estado o un grupo',
      texto: `Si vendes por WhatsApp o con anuncios, mira MaKo: ordena tus contactos, te arma páginas de venta y videos con IA, y te dice qué mejorar en tus anuncios. ${PRUEBA_GRATIS_PRENDIDA ? gratis : 'Míralo aquí'}: ${p.link}`,
    },
    {
      id: 'instagram', titulo: 'Mensaje directo de Instagram',
      texto: `¡Hola! Vi lo que vendes y creo que te puede servir MaKo, lo uso para mi negocio: te ordena los contactos y los mensajes, y te ayuda con las páginas y los anuncios. ${PRUEBA_GRATIS_PRENDIDA ? `Lo pruebas ${gratis}, te` : 'Te'} dejo el link: ${p.link}`,
    },
    {
      id: 'precio', titulo: 'Si te preguntan cuánto cuesta',
      texto: `${precio ? `${precio}. ` : ''}${entrada} Si te suscribes, pon mi código ${p.codigo} al pagar: ${p.link}`,
    },
    {
      id: 'seguimiento', titulo: 'Seguimiento, a los dos días',
      texto: `¿Pudiste mirar MaKo? Si quieres te muestro cómo lo uso yo${PRUEBA_GRATIS_PRENDIDA ? `. Lo pruebas ${gratis}` : ''}: ${p.link}`,
    },
  ];
}

/** Un renglón de lo que trae un plan, como lo dice la tabla de /planes: «Páginas web para vender, publicadas: 3». */
const renglon = (f: FilaComparacion, c: Celda): string => (typeof c === 'string' ? `${f.que}: ${c.charAt(0).toLowerCase()}${c.slice(1)}` : f.que);

export type PlanDelPdf = { nombre: string; precio: string; resumen: string; incluye: string[] };
export type PdfDeVenta = {
  titulo: string; bajada: string; queHace: string[]; planes: PlanDelPdf[]; prueba: string;
  /** Quién lo recomienda (el negocio del partner), si se sabe. */
  deParte: string | null;
  link: string; codigo: string;
};

/**
 * El PDF de venta: una hoja para mandarle a un negocio. Qué hace MaKo, los dos planes con su precio y lo que trae cada uno
 * (Pro, «todo lo de Esencial» y lo que suma), la prueba gratis y, al pie, SU link y SU código. El Acelerador no va: se vende
 * por llamada y el programa de partners paga por los planes (lib/partners-reglas.ts).
 */
export function pdfDeVenta(p: { link: string; codigo: string; deParte?: string | null; planes?: readonly PlanMako[] }): PdfDeVenta {
  const planes = p.planes ?? PLANES_MAKO_DEFAULT;
  const filas = filasDeComparacion();
  const esencial = planDe(planes, 'esencial');
  const pro = planDe(planes, 'pro');
  const out: PlanDelPdf[] = [];
  if (esencial) {
    out.push({
      nombre: esencial.nombre, precio: `${usd(esencial.precioUsd)} por mes`, resumen: esencial.resumen,
      // Lo que entra en el plan y el asistente (12/11/2026): desde que la tabla dice TODO lo que trae MaKo, función por función, la
      // lista entera no entra en una hoja; lo que es de todos los planes ya lo dice «Qué hace MaKo».
      incluye: filas.filter((f) => f.esencial !== false && (f.grupo === GRUPOS_COMPARACION[0] || f.grupo === GRUPOS_COMPARACION[1])).map((f) => renglon(f, f.esencial)),
    });
  }
  if (pro) {
    out.push({
      nombre: pro.nombre, precio: `${usd(pro.precioUsd)} por mes`, resumen: pro.resumen,
      incluye: [
        ...(esencial ? [`Todo lo de ${esencial.nombre}, con más lugar`] : []),
        ...filas.filter((f) => f.pro !== false && (!esencial || f.esencial === false)).map((f) => renglon(f, f.pro)),
      ],
    });
  }
  return {
    titulo: 'MaKo: vende más con tu negocio, con IA',
    bajada: 'Tus contactos, tu WhatsApp, tus páginas y tus anuncios en un solo lugar, con un asistente que conoce tu negocio.',
    queHace: [
      'Guarda a tus contactos y te muestra en qué paso de la venta está cada uno.',
      'Atiendes WhatsApp e Instagram desde un solo lugar, y los seguimientos se mandan solos.',
      'Te arma páginas de venta y videos para tus anuncios con IA.',
      'Mira tus anuncios de Facebook e Instagram y te dice qué mejorar.',
    ],
    planes: out,
    prueba: PRUEBA_GRATIS_PRENDIDA ? `${NOMBRE_PLAN_CON_PRUEBA} empieza con ${PRUEBA_DIAS} días gratis. Te das de baja cuando quieras.` : 'Pagas al empezar y te das de baja cuando quieras.',
    deParte: p.deParte?.trim() ? p.deParte.trim().slice(0, 80) : null,
    link: p.link, codigo: p.codigo,
  };
}

/** El nombre del archivo: «mako-<código>.pdf» (el código ya es un slug: lib/compra-plan-reglas.ts, `CODIGO_REF_RE`). */
export const archivoDelPdf = (codigo: string): string => `mako-${codigo.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'partner'}.pdf`;
