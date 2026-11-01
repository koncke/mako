'use client';

// =============================================================================
// GraficoHilo — una pregunta del Dashboard dibujada en el hilo del chat (G16, y la tabla, que es un gráfico de tipo tabla)
// =============================================================================
// Ops Center = lo principal (20/10/2026, la pieza 2.7 del chat Dashboard). El bloque `grafico` (lib/chat-bloques-dashboard.ts)
// lo arma `consultar_datos_dashboard` con la foto de lo que leyó; acá se dibuja con la MISMA pieza del Dashboard
// (`CuerpoGrafico`, app/dashboard/Grafico.tsx), que trae sus propios estilos (`EstilosGraficos`). No se copia nada.
//
// ⚠️ LO PESADO VA POR `next/dynamic`: CuerpoGrafico arrastra recharts y no tiene por qué entrar en el chat de quien nunca
//    pregunta un número (lo carga BloqueHilo así).
// ⚠️ LOS COLORES son los del tema por defecto (`varsDeTema(sanearTema(null))`): una pregunta no tiene una hoja con su estilo.
//    Y el alto es fijo para lo que mide su contenedor (recharts); una tabla o un número miden lo que dibujan.
// ⚠️ El link va por `Link` (app/_ui/Link.tsx), que le suma el `?ws=` de quien mira.
// ⚠️ EL DIBUJO VA ADENTRO DE `RedDeBloque` (app/dashboard/RedDeBloque.tsx): un gráfico que tira deja «Este bloque no
//    cargó» con el título y el link en pie. El bloque queda guardado en la sesión: sin la red, tumbaba el chat cada vez que
//    se abría. El pedazo que no llega (un deploy, la red del teléfono) lo atrapa otra red, la de BloqueHilo (revisión del 21/10).
// =============================================================================

import Link from '@/app/_ui/Link';
import { CuerpoGrafico, esTarjetaNumero } from '@/app/dashboard/Grafico';
import { RedDeBloque } from '@/app/dashboard/RedDeBloque';
import { sanearTema, varsDeTema } from '@/lib/graficos-temas';
import type { BloqueGrafico } from '@/lib/chat-bloques-dashboard';

const TEMA = sanearTema({ plantilla: 'vieja' });

const CSS = `
.ch-grafico{padding:12px 14px 10px}
.ch-grafico__nota{margin:2px 0 8px;font-size:12.5px;color:var(--dim)}
.ch-grafico__cuerpo{position:relative;min-height:0;display:flex;flex-direction:column}
.ch-grafico__cuerpo[data-mide]{height:220px}
.ch-grafico__cuerpo[data-tabla]{max-height:320px;overflow:auto}
`;

/** ¿Este tipo mide el alto de su contenedor (una serie, unas barras)? Una tabla o un número miden lo que dibujan. */
const mideSuCaja = (tipo: string): boolean => !esTarjetaNumero(tipo) && !tipo.startsWith('tabla');

export default function GraficoHilo({ b }: { b: BloqueGrafico }) {
  const tabla = b.grafico.tipo.startsWith('tabla');
  return (
    <div className="ch-bloque ch-grafico" data-bloque="grafico" style={varsDeTema(TEMA)}>
      <style>{CSS}</style>
      <p className="ch-bloque__titulo">{b.titulo}</p>
      {b.nota && <p className="ch-grafico__nota">{b.nota}</p>}
      <div className="ch-grafico__cuerpo" data-mide={mideSuCaja(b.grafico.tipo) || undefined} data-tabla={tabla || undefined}>
        <RedDeBloque nombre={b.titulo} reiniciarCon={[b]}>
          <CuerpoGrafico g={b.grafico} estado={{ cargando: false, resultado: b.resultado }} tema={TEMA} />
        </RedDeBloque>
      </div>
      {/* Una tabla ya dice «+N más» adentro. Una serie que no entra dibuja el tramo más cercano a hoy (la nota dice cuál):
          lo que falta puede ser de antes o de después (un vencimiento). */}
      {!tabla && b.resultado.fuera > 0 && <p className="ch-grafico__nota">{b.resultado.clase === 'tiempo' ? `Y ${b.resultado.fuera} puntos fuera de este tramo` : `Y ${b.resultado.fuera} más`}</p>}
      {b.abrir && <div className="ch-tarjeta__botones"><Link className="ch-abrir" href={b.abrir.href}>{b.abrir.titulo}</Link></div>}
    </div>
  );
}
