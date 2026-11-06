// Datos inventados para el banco de Campañas: una cuenta con muchas campañas en UN producto (el caso de Mauricio), varios productos y una sola.
import type { Lienzo } from '@/app/ads-manager/Lienzo';
import type { CampanaDeLienzo, ProductoDeLienzo } from '@/lib/media-buyer/productos';

const NOMBRES = ['Frío · Video 1', 'Frío · Testimonio', 'Retargeting 30d', 'Lookalike 1%', 'Agenda directa', 'Webinar registro', 'Carrusel casos', 'Oferta limitada', 'Reels gancho', 'Intereses coaching', 'Advantage+ amplio', 'Formulario calificado'];
function camp(i: number, producto: string): CampanaDeLienzo {
  const gasto = 40 + ((i * 97) % 900);
  const resultados = i % 5 === 0 ? 0 : 1 + ((i * 7) % 24);
  const costo = resultados ? Math.round((gasto / resultados) * 100) / 100 : null;
  return {
    id: `${producto}-${i}`, nombre: `${NOMBRES[i % NOMBRES.length]} ${Math.floor(i / NOMBRES.length) + 1}`, prendida: i % 6 !== 0, presupuestoDia: 20 + (i % 4) * 10,
    conjuntos: 1 + (i % 3), retenida: i === 7 || undefined, gasto, resultados, costo, tono: null,
  };
}
function producto(id: string, nombre: string, desde: number, cuantas: number): ProductoDeLienzo {
  const campanas = Array.from({ length: cuantas }, (_, i) => camp(desde + i, id));
  return { id, nombre, gasto: campanas.reduce((a, c) => a + c.gasto, 0), resultados: campanas.reduce((a, c) => a + c.resultados, 0), costo: null, tono: null, campanas };
}
export function lienzoDeEjemplo(caso: string): Lienzo {
  if (caso === 'uno') return { productos: [producto('1', 'Mentoría 1:1', 0, 4)], sinProducto: [], moneda: 'USD', cuenta: null, aviso: null };
  if (caso === 'varios') return { productos: [producto('1', 'Mentoría 1:1', 0, 9), producto('2', 'Programa grupal', 20, 7), producto('3', 'Webinar', 40, 4)], sinProducto: [camp(60, 'x'), camp(61, 'x')], moneda: 'USD', cuenta: null, aviso: null };
  if (caso === 'vacio') return { productos: [producto('1', 'Mentoría 1:1', 0, 0)], sinProducto: [], moneda: 'USD', cuenta: null, aviso: null };
  // Mauricio: todo en un solo producto, con muchísimas campañas.
  return { productos: [producto('1', 'Programa de coaching', 0, 40)], sinProducto: [], moneda: 'USD', cuenta: null, aviso: null };
}

/** Una config de Media Buyer ya armada, para los Ajustes. */
export function configDeEjemplo() {
  return {
    encendido: true, modo: 'propone', kpi: 'agenda', objetivo: 30, subidaMaxPctDia: 20, presupuestoMaxDia: 150, metaVentasMes: 12000, metaGastoMes: 4000,
    cuentaPublicitaria: 'act_123456789', zona: [], hasta: null, tacticas: {}, existeTabla: true, ultimaCorrida: null, ultimaCorridaInfo: null,
  };
}
