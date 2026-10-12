// Ruta vieja: el módulo se renombró a /landing-generator para que el nombre de la tab y la
// URL digan lo mismo. Queda el redirect porque el path viejo está escrito en
// lugares que no se pueden editar de golpe: tareas del plan, mensajes que MaKo
// ya mandó, marcadores del navegador.
//
// ⚠️ LA QUERY ES EL DESTINO: el deep link del Landing Analyst era `/landing-writer?url=<landing>`
// («basarse en esta landing») y el redirect pelado la perdía. Viaja ENTERA (`destinoConQuery`, el
// mismo helper que usa /chatbot → /automations) y /landing-generator lleva el `?url=` a «Crear».
// `rutaConWs` no duplica el `?ws=` si ya venía.
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { destinoConQuery } from '@/lib/ruta-automations';

export default async function RedirectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(await rutaConWs(destinoConQuery('/landing-generator', await searchParams)));
}
