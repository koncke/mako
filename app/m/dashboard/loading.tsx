// /m/dashboard mientras carga: EL loader de las tabs grandes, el mismo de la computadora (app/_ui/CargandoMako.tsx, 23/10/2026).
// Martín: «Los loader de las tabs o secciones grandes, quiero que sean todos como el de Ops Center. Con la criatura de
// MaKo», y con una barra que diga que carga. Hasta acá era un esqueleto gris: no se leía como «tocaste y está cargando».
// ⚠️ Un loading.tsx es un Suspense: va en la lista blanca de tests/layout-sin-suspense.test.ts (/m es privado entero).
import { CargandoMako } from '@/app/_ui/CargandoMako';

export default function Cargando() {
  return <CargandoMako que="el Dashboard" alto="calc(100dvh - var(--m-abajo, 72px) - 96px)" />;
}
