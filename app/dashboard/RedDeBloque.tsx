'use client';

// =============================================================================
// RedDeBloque — una tarjeta de la hoja que se rompe al dibujarse no se lleva la pantalla entera
// =============================================================================
// 17/10/2026: Martín vio en el celular «Cannot read properties of undefined (reading 'length')» y la portada de General
// entera se cayó: un solo bloque roto (el ejemplo de «Meta objetivo» sin `funnelIds`, 6b922f7e3) tumbaba todo, porque
// React desmonta hasta el error boundary más cercano y el único era el de la app (app/error.tsx). Ahora cada tarjeta va
// adentro de esta red: si su dibujo tira, ESA tarjeta dice «Este bloque no cargó» y el resto de la hoja sigue en pie.
//   · Los bloques de General (./ElementoGeneral.tsx), en la computadora, en el teléfono (app/m/hoy/GeneralM.tsx dibuja
//     con la misma pieza) y en las miniaturas.
//   · Los gráficos y los demás elementos de cualquier hoja, General o Dashboard (./EditorInforme.tsx): el cuerpo va
//     adentro de la red y la cabecera (el título, el filtro) queda.
//
// ⚠️ Volver a intentar: una tarjeta rota vuelve a dibujarse cuando cambia algo de `reiniciarCon` (comparado de a uno,
//    como las dependencias de un efecto: la tarjeta, sus datos), o con la `key` que le ponga quien la monta. Una tarjeta
//    SANA no se vuelve a montar por eso: no pierde lo que tenía adentro (el scroll de una tabla).
// ⚠️ Un error boundary es una CLASE: React no tiene un hook para esto. Y sólo atrapa lo que tira al DIBUJAR (render y
//    efectos de montaje): un clic que falla adentro de la tarjeta es de su handler, como siempre.
// =============================================================================

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

/** Lo que dice una tarjeta que no se pudo dibujar (corto: es texto de pantalla). */
export const TEXTO_BLOQUE_ROTO = 'Este bloque no cargó';

// Propio de la red: la tarjeta rota puede ser un gráfico del Dashboard, donde no está el CSS de General.
const CSS = `.red-bloque-roto{flex:1;display:grid;place-items:center;text-align:center;padding:16px;font-size:14px;color:var(--dim);border:1px dashed var(--border-strong);border-radius:12px}`;

type Props = { nombre: string; reiniciarCon?: readonly unknown[]; children: ReactNode };

export class RedDeBloque extends Component<Props, { roto: boolean }> {
  state = { roto: false };

  static getDerivedStateFromError(): { roto: boolean } {
    return { roto: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // El detalle va a la consola (y a los logs del navegador): la pantalla dice sólo que no cargó.
    console.error(`[hoja] «${this.props.nombre}» no se pudo dibujar:`, error, info.componentStack);
  }

  componentDidUpdate(antes: Props): void {
    if (this.state.roto && cambio(antes.reiniciarCon, this.props.reiniciarCon)) this.setState({ roto: false });
  }

  render(): ReactNode {
    if (!this.state.roto) return this.props.children;
    return (
      <>
        <style>{CSS}</style>
        <div className="red-bloque-roto" role="alert" title={`«${this.props.nombre}» no se pudo dibujar`}>{TEXTO_BLOQUE_ROTO}<ReportarASoporte /></div>
      </>
    );
  }
}

/** ¿Cambió algo? De a uno y por identidad, como las dependencias de un efecto. */
export function cambio(antes: readonly unknown[] | undefined, ahora: readonly unknown[] | undefined): boolean {
  if (!antes || !ahora) return antes !== ahora;
  return antes.length !== ahora.length || ahora.some((v, i) => !Object.is(v, antes[i]));
}
