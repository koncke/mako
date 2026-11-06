# Avisos de licencia (29/10/2026)

Lo que MaKo toma de un repo de código abierto (el método de un experto, una regla, una lista) conserva el aviso de su licencia, aunque el texto se traduzca y se reescriba. Es el molde de `app/image-editor/_doory/LICENSE-DOORY` y `app/video-editor/_opencut/LICENSE-OPENCUT`, pero en **un solo lugar**: marketingskills lo usan cuatro tabs, y cuatro copias del mismo archivo se desfasan.

**La regla:**
- una copia **literal** por repo, `LICENSE-<REPO>`, bajada de `raw.githubusercontent.com/<dueño>/<repo>/main/LICENSE` (con un 404 se prueban `master`, `LICENSE.md` y `api.github.com/repos/<dueño>/<repo>/license` antes de concluir «sin licencia»; docs/hallazgos-infra.md);
- la cabecera de cada archivo que toma algo nombra el aviso (`lib/avisos/LICENSE-<REPO>`);
- un README que dice «MIT» no alcanza: sin LICENSE, no se copia.

`tests/avisos-licencias.test.ts` comprueba que cada archivo sea la licencia entera con su línea de copyright.

| Archivo | Repo | Copyright | Lo usa (docs/plantillas-reales/README.md, sección 5) |
|---|---|---|---|
| `LICENSE-MARKETINGSKILLS` | https://github.com/coreyhaines31/marketingskills | 2025 Corey Haines | Copywriter, Image, AI Avatar, Offer |
| `LICENSE-PROFOUND` | https://github.com/retieedra-profound/skills-marketing-library | 2026 Profound | Copywriter |
| `LICENSE-CLAUDE-YOUTUBE` | https://github.com/agricidaniel/claude-youtube | 2025 Daniel Agrici | Copywriter (y Video la edita) |
| `LICENSE-CRAIGHEWITT-SKILLS` | https://github.com/thecraighewitt/skills | 2026 Craig Hewitt | Video |
| `LICENSE-VIDEO-USE` | https://github.com/browser-use/video-use | 2026 Browser Use | Video |
| `LICENSE-CLAUDE-SHORTS` | https://github.com/AgriciDaniel/claude-shorts | 2026 Daniel Agrici | Video |
| `LICENSE-DIFFUSIONSTUDIO-LOTTIE` | https://github.com/diffusionstudio/lottie | 2026 Diffusion Studio Inc. | Video (más adelante) |
| `LICENSE-VIDEO-THUMBNAIL-SKILL` | https://github.com/aabrole/claude-video-thumbnail-skill | 2026 aabrole | Image |
| `LICENSE-SOCIAL-MEDIA-SKILLS` | https://github.com/charlie947/social-media-skills | 2026 Charlie Hills | Image |
| `LICENSE-INSTAGRAM-CAROUSEL-SKILL` | https://github.com/jeevanbavandla/instagram-carousel-skill | 2026 Jeevan Bavandla | Image |
| `LICENSE-MOTION-SKILLS` | https://github.com/motion-creative/skills | 2025 Motion | AI Avatar |
| `LICENSE-STUDIO-ADMIN` | https://github.com/arhamkhnz/next-shadcn-admin-dashboard | 2024 Mohammed Arham Khan | Admin (`/admin`): el CÓDIGO de Studio Admin portado archivo por archivo (app/admin/_studio, app/admin/usuarios, app/admin/ingresos), commit 036631e del 5/11/2026 |

Las once primeras son MIT y se bajaron el 29/10/2026 de la rama `main`; la de Studio Admin, el 5/11/2026 (su LICENSE del commit 036631e). La de Diffusion Studio abre con el copyright y no con «MIT License»: así está en su repo.
