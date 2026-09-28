// =============================================================================
// /admin — se fue a /customer-success
// =============================================================================
// «Quiero que la ruta de admin se elimine, y que yo vea esta tab en customer
// success de mi cuenta de SuperAdmin» (27/09/2026). La pantalla es la misma
// —app/admin/AdminView.tsx, que ahora monta /customer-success cuando quien mira
// es super admin sin impersonar—; lo que se fue es la RUTA.
//
// ⚠️ EL ARCHIVO SE QUEDA COMO REDIRECT Y NO SE BORRA LA CARPETA. Sacar algo es
// enumerar dónde está: hay links viejos a /admin en marcadores, en mensajes y en
// el «Regresar a Admin» del modo Dev, y ocho sub-rutas vivas debajo de
// /admin/* (copywriting, dev, docs, ui, agente, friccion, guiones, rediseño).
// Un 404 acá se lee como que se rompió algo.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Sin guard de rol propio: el destino ya lo tiene (requireCapa) y duplicarlo acá
  // sería un segundo lugar donde vive la misma regla. El gate del proxy sigue
  // cortando /admin para quien no es super admin, antes de llegar hasta acá.
  redirect('/customer-success');
}
