// =============================================================================
// La letra del Media Buyer: Inter, la de Madgicx (medido en madgicx.com, 25/10/2026)
// =============================================================================
// Madgicx usa Aeonik Pro en los títulos e Inter en el resto. Inter entra como en Chats (app/chats/fuente.tsx, que explica
// por qué NUNCA por `next/font/google`: un build que depende de la red de Google se cae cualquier día). Aeonik es de pago:
// los títulos van en Geist 500 (mb.css). React 19 sube el <link> al <head> y lo deduplica con el de Chats.
import { HOJA_INTER } from '@/app/chats/fuente';

export function FuenteMediaBuyer() {
  return <link rel="stylesheet" href={HOJA_INTER} precedence="default" />;
}
