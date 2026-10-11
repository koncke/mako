'use client';

// =============================================================================
// CuerpoBloqueExtra — el dibujo de los bloques de las tabs de Analysts
// =============================================================================
// CuerpoBloque (../CuerpoBloque.tsx) le pasa los bloques cuyo id está en BLOQUES_EXTRA, con las MISMAS
// props. Recibe lo que armó lib/graficos-bloques-extra.ts para cada uno (los tipos viven en
// lib/graficos-bloques-extra-catalogo.ts, así el server y el dibujo no se separan) y lo reparte:
//   · Ads Analyst   → BloquesAds (patrones, cuadrante)
//   · Landing       → BloquesLanding (mapa de calor, curva del video)
//   · Closing       → BloquesClosing (embudo, factores, closers)
//   · Productividad → BloquesProductividad (matriz, pirámide, lo que huele mal)
//
// Como un gráfico: sin datos, el giro o el error; con un error, el error tal cual llegó («Conecta Meta en
// Integraciones» es lo único que la persona puede arreglar). El mapa de calor es la excepción: pide sus
// datos él solo, así que se monta siempre.

import type { Bloque } from '@/lib/graficos-catalogo';
import type { EstiloEfectivo } from '@/lib/graficos-temas';
import type {
  DatosAtencion, DatosClosers, DatosCuadrante, DatosCurvaVsl, DatosEmbudoCierre, DatosFactores, DatosMatriz,
  DatosPatrones, DatosPiramide,
} from '@/lib/graficos-bloques-extra-catalogo';
import type { EstadoBloque } from '../CuerpoBloque';
import { Aviso } from '../piezas';
import { RaizExtra } from './piezas-extra';
import { BloqueCuadrante, BloquePatrones } from './BloquesAds';
import { BloqueCurvaVsl, BloqueMapaCalor } from './BloquesLanding';
import { BloqueClosers, BloqueEmbudoCierre, BloqueFactores } from './BloquesClosing';
import { BloqueAtencion, BloqueMatriz, BloquePiramide } from './BloquesProductividad';

export function CuerpoBloqueExtra({ b, estado, estilo, desde, hasta, onRefrescar }: {
  b: Bloque; estado: EstadoBloque; estilo: EstiloEfectivo; desde: string; hasta: string; onRefrescar: () => void;
}) {
  // El período ya viajó en el pedido de datos; estos bloques no escriben nada, así que no refrescan la hoja.
  void desde; void hasta; void onRefrescar;
  if (b.bloque === 'mapa_calor') return <RaizExtra><BloqueMapaCalor /></RaizExtra>;

  const d = estado.datos;
  if (!d || typeof d !== 'object' || estado.error) return <RaizExtra><Aviso cargando={estado.cargando} error={estado.error} /></RaizExtra>;

  return (
    <RaizExtra>
      {b.bloque === 'patrones_guiones' && <BloquePatrones d={d as DatosPatrones} />}
      {b.bloque === 'cuadrante_retencion' && <BloqueCuadrante d={d as DatosCuadrante} estilo={estilo} />}
      {b.bloque === 'curva_vsl' && <BloqueCurvaVsl d={d as DatosCurvaVsl} estilo={estilo} />}
      {b.bloque === 'embudo_cierre' && <BloqueEmbudoCierre d={d as DatosEmbudoCierre} estilo={estilo} />}
      {b.bloque === 'factores_cierre' && <BloqueFactores d={d as DatosFactores} />}
      {b.bloque === 'closers_cierre' && <BloqueClosers d={d as DatosClosers} estilo={estilo} />}
      {b.bloque === 'matriz_proyectos' && <BloqueMatriz d={d as DatosMatriz} />}
      {b.bloque === 'piramide_prioridad' && <BloquePiramide d={d as DatosPiramide} />}
      {b.bloque === 'tareas_atencion' && <BloqueAtencion d={d as DatosAtencion} />}
    </RaizExtra>
  );
}
