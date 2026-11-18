// Ruta vieja: el módulo se renombró a /vsl-generator para que el nombre de la tab y la
// URL digan lo mismo. Queda el redirect porque el path viejo está escrito en
// lugares que no se pueden editar de golpe: tareas del plan, mensajes que MaKo
// ya mandó, marcadores del navegador.
//
// 18/11/2026: va DIRECTO a donde va /vsl-generator (../vsl-generator/destino.ts), sin el doble salto; quien no puede usar
// el Copywriter cae en /vsl-generator, que le muestra el «Coming soon». La puerta la pone cada destino.
import { redirect } from 'next/navigation';
import { rutaConWs } from '@/lib/workspace';
import { veCopywriter } from '../copywriter/acceso';
import { destinoDelVslGenerator } from '../vsl-generator/destino';

export default async function RedirectPage() {
  redirect(await rutaConWs(destinoDelVslGenerator(await veCopywriter()) ?? '/vsl-generator'));
}
