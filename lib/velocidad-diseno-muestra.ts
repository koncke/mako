// =============================================================================
// velocidad-diseno-muestra — los datos de EJEMPLO de «Velocidad de llamada» (la miniatura de «Nueva hoja» y el arnés de la captura)
// =============================================================================
// Inventados: ningún lead, persona ni número real. Tienen la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`,
// lib/graficos-agregar.ts), así la miniatura pasa por el mismo `vistaVelocidad` que la hoja de verdad. Las cifras cierran entre
// tarjetas: los carriles suman los leads del resumen, y los tramos, los días y la carga de cada setter suman lo del resumen
// (tests/dashboard-diseno-velocidad.test.ts lo comprueba).
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import { ROTULO_RESULTADO, SIN_MARCAR } from './grabar-llamada-reglas';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const dia = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const NOMBRES = ['Camila Rojas', 'Javier Núñez', 'Sara Delgado', 'Tomás Herrera', 'Valeria Campos', 'Diego Fuentes', 'Paula Romero', 'Iván Molina', 'Lucía Vargas', 'Hernán Bravo',
  'Clara Ibáñez', 'Rubén Aguilar', 'Elisa Paredes', 'Gonzalo Ríos', 'Natalia Cruz', 'Óscar Medina', 'Marta Solís', 'Bruno Lagos', 'Inés Castro', 'Pablo Serrano'];
const SETTERS = ['Daniela Ortiz', 'Marcos Rivas', 'Luisa Méndez', 'Andrés Salas'];
const FUNNELS = ['Departamentos', 'Casas en preventa'];

// Los 30 días: [contactados, sin contactar], del más viejo a hoy.
const DIAS: Array<[number, number]> = Array.from({ length: 30 }, (_, i) => [3 + ((i * 7) % 6), (i * 5) % 4]);
const CONTACTADOS = DIAS.reduce((a, d) => a + d[0], 0), SIN = DIAS.reduce((a, d) => a + d[1], 0);
const YA = 6, LEADS = CONTACTADOS + SIN + YA;
const A_TIEMPO = 3, ESPERANDO = SIN - A_TIEMPO;
const EN_1H = Math.round(CONTACTADOS * 0.42);
// Los contactados por cuánto tardaron (suman CONTACTADOS).
const TRAMOS: Array<[string, number]> = [['En la primera hora', EN_1H], ['De 1 a 24 horas', 41], ['De 1 a 3 días', 18], ['Más de 3 días', CONTACTADOS - EN_1H - 41 - 18]];

const fila = (i: number, seg: number, extra: Record<string, string | null>) => ({ clave: NOMBRES[i % NOMBRES.length], etiqueta: NOMBRES[i % NOMBRES.length], ref: String(9000 + i), valores: [seg], extra });

export function datosVelocidadMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, x: Resultado) => { if (k) out[k] = { resultado: x }; };
  const cat = (ids: string[], filas: Resultado['filas'], totales: Array<number | null>, extra?: string[]): Resultado =>
    ({ columnas: col(ids), filas, totales, fuera: 0, clase: 'categoria', ...(extra ? { columnasExtra: extra.map((id) => ({ id, nombre: id })) } : {}) });

  poner(p.resumen, {
    columnas: col(['leads', 'contactados', 'sin_contactar', 'base_1h', 'en_1h', 'mediana_contacto', 'mediana_espera', 'ya_hablaban']), filas: [], fuera: 0, clase: null,
    totales: [LEADS, CONTACTADOS, SIN, CONTACTADOS + ESPERANDO, EN_1H, 74, 1340, YA],
    anterior: [LEADS - 9, CONTACTADOS - 20, SIN + 7, null, null, null, null, null],
  });
  const dd = (k: number) => ddmm(dia(hoy, -k));
  // Sin contactar, de la espera más corta a la más larga: los primeros entraron hace menos de una hora.
  const esperas = [12, 26, 41, ...Array.from({ length: ESPERANDO }, (_, k) => 75 + k * 410)];
  poner(p.recien, cat(['espera'], esperas.map((m, k) => fila(k, m * 60, { dia: dd(Math.floor(m / 1440)), setter: SETTERS[k % 4], producto: FUNNELS[k % 2] })), [null], ['dia', 'setter', 'producto']));
  poner(p.esperan, cat(['espera'], esperas.slice().reverse().slice(0, 10).map((m, k) => fila(k + 3, m * 60, { dia: dd(Math.floor(m / 1440)), setter: SETTERS[k % 4], producto: FUNNELS[k % 2] })), [null], ['dia', 'setter', 'producto']));
  const canales = ['WhatsApp', 'Llamada', 'WhatsApp', 'Email', 'WhatsApp', 'Llamada'];
  poner(p.contactados, cat(['espera'], [4, 9, 13, 22, 35, 48].map((m, k) => fila(k + 8, m * 60, { dia: dd(k), setter: SETTERS[(k + 1) % 4], producto: FUNNELS[k % 2], canal: canales[k] })), [null], ['dia', 'setter', 'producto', 'canal']));
  poner(p.antes, cat(['leads'], Array.from({ length: YA }, (_, k) => ({ ...fila(k + 14, 1, { dia: dd(k + 2), setter: SETTERS[k % 4], producto: FUNNELS[k % 2], tramo: k % 3 ? 'Ya hablaban antes' : 'No se sabe' }) })), [YA], ['dia', 'setter', 'producto', 'tramo']));
  poner(p.chats, cat(['espera_respuesta', 'sin_responder'], [6, 19, 47, 95, 260, 1600].map((m, k) => ({ clave: NOMBRES[(k + 4) % 20], etiqueta: NOMBRES[(k + 4) % 20], ref: String(9100 + k), valores: [m * 60, m > 1440 ? 1 : 0], extra: { etapa: ['Contacto nuevo', 'Calificado', 'Contacto nuevo', 'Agendó visita', 'Calificado', 'Contacto nuevo'][k] } })), [null, 1], ['etapa']));
  const RES = [ROTULO_RESULTADO.agendo, ROTULO_RESULTADO.hablo, ROTULO_RESULTADO.no_contesto, ROTULO_RESULTADO.hablo, SIN_MARCAR, ROTULO_RESULTADO.no_interesa, ROTULO_RESULTADO.no_contesto, ROTULO_RESULTADO.agendo];
  const HORAS = ['09', '09', '10', '10', '11', '12', '13', '15', '16', '16', '17', '09', '11', '14'];
  poner(p.hoy, cat(['llamadas', 'minutos'], HORAS.map((h, k) => ({
    clave: NOMBRES[k % 20], etiqueta: NOMBRES[k % 20], ref: String(9200 + k), valores: [1, 3 + ((k * 5) % 14)],
    extra: { autor: SETTERS[k % 3], resultado: RES[k % RES.length], hora: h },
  })), [HORAS.length, 120], ['autor', 'resultado', 'hora']));
  poner(p.tramos, cat(['leads'], TRAMOS.map(([k, v]) => ({ clave: k, etiqueta: k, valores: [v] })), [CONTACTADOS]));
  poner(p.dias, { columnas: col(['contactados', 'sin_contactar']), fuera: 0, clase: 'tiempo', totales: [CONTACTADOS, SIN], filas: DIAS.map(([c, s], k) => { const d = dia(hoy, k - (DIAS.length - 1)); return { clave: d, etiqueta: d, valores: [c, s] }; }) });
  // Cada setter, su parte de los totales del resumen: las cuatro filas suman los leads, los contactados y los sin contactar de arriba.
  const repartir = (n: number) => { const pesos = [5, 4, 3, 2], suma = 14; const v = pesos.map((w) => Math.floor((n * w) / suma)); v[0] += n - v.reduce((a, x) => a + x, 0); return v; };
  const [cs, ss, ys] = [repartir(CONTACTADOS), repartir(SIN), repartir(YA)];
  poner(p.carga, cat(['leads', 'contactados', 'sin_contactar', 'mediana_contacto'], SETTERS.map((s, k) => (
    { clave: s, etiqueta: s, valores: [cs[k] + ss[k] + ys[k], cs[k], ss[k], [38, 95, 52, 310][k]] }
  )), [LEADS, CONTACTADOS, SIN, 74]));
  return out;
}
