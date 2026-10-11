// =============================================================================
// /offer-analyst → /offer  (la tab se unificó el 11/10/2026)
// =============================================================================
// Pedido de Martín, textual: «Implementa completamente la funcionalidad de "Offer Analyst" y
// "Offer Generator" pero todo en una misma tab que se llame "Offer"». La pantalla vive en
// app/offer; esto era un ComingSoon con la key 'offer', la misma que usa la tab nueva.
//
// ⚠️ SE REDIRIGE, NO SE BORRA: la ruta vieja está escrita donde no se puede editar de golpe
// (tareas del plan, mensajes de MaKo, marcadores), y app/admin/dev/areas.ts la declara en el
// `vive` del área (tests/dev-areas.test.ts exige que exista). Con `rutaConWs`: un `redirect()`
// pelado pierde la pestaña del cliente que el super admin está mirando.
//
// Sin guard de rol a propósito: un redirect no muestra nada, y /offer pone el suyo (con la
// misma key 'offer', que es la que tienen escrita las capas).
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';

export default async function OfferAnalystRenombrada() {
  redirect(await rutaConWs('/offer'));
}
