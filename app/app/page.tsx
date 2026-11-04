// =============================================================================
// /app — el link único para instalar MaKo (3/11/2026)
// =============================================================================
// El QR del onboarding apunta acá. A cada dispositivo lo manda a lo suyo (lib/app-tiendas.ts): su tienda si ya está publicada, la guía para agregarla a la pantalla de inicio si
// todavía no, y a una computadora le muestra el QR.
//
// ⚠️ PÚBLICA (lib/rutas-publicas.ts): quien escanea puede no tener sesión en ese teléfono. Sólo GET, no lee cookies ni la base: lo único que mira es el dispositivo.
// =============================================================================

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { linkApp } from '@/lib/app-url';
import { RUTA_APP, destinoDeLaApp } from '@/lib/app-tiendas';
import { plataformaDeUA } from '@/lib/push-payload';
import { GuiaApp } from './GuiaApp';

export const metadata: Metadata = { title: 'Instala MaKo', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AppPage() {
  const destino = destinoDeLaApp(plataformaDeUA((await headers()).get('user-agent')));
  if (destino.tipo === 'tienda') redirect(destino.url);
  // Se arma también para un iPad, que se presenta como computadora: el server no lo distingue, y lo decide la pantalla.
  const qr = destino.tipo === 'qr' ? await QRCode.toDataURL(linkApp(RUTA_APP, null), { margin: 1, width: 480 }).catch(() => null) : null;
  return <GuiaApp inicial={destino} qr={qr} />;
}
