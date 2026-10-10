import type { Metadata } from 'next';
import Costos from './Costos';

// Documento INTERNO de costos, para compartirle a Mauricio por link. Cae bajo
// /vsl → es pública por proxy.ts (startsWith '/vsl/'), así que el link se abre
// sin login. noindex: son números de la empresa, no se distribuye ni lo levanta
// ningún buscador.
// ⚠️ /vsl/estrategia YA NO es pública: desde el 10/10/2026 redirige a la tab de
// super admin /admin/estrategia. Si esta página también se muda (Martín pidió
// «todo en una sola tab, sólo super admin» y nombró «una de análisis de costos»),
// lo decide él: hoy sigue pública para mandársela por link a Mauricio.
//
// ⚠️ Los montos están escritos a mano, con la fecha de medición a la vista en el
// pie. NO se conectan a las APIs de facturación a propósito: esto es una foto
// fechada para una conversación, no un tablero en vivo. Si alguna vez se vuelve
// un tablero, el lugar es /admin/dev/pricing, que ya existe.
export const metadata: Metadata = {
  title: 'MaKo — Qué pagamos por mes · Interno',
  description:
    'Documento interno: todos los servicios que paga MaKo, qué cambió en agosto de 2026, quién paga qué y qué esperar cada mes.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Costos />;
}
