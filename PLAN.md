# PLAN.md - Cartel GO

Plan de trabajo derivado de [GDD.md](GDD.md) y [AGENTS.md](AGENTS.md). Marca `[x]` al completar cada tarea.

- **Repo:** https://github.com/gunderwulde/CartelGO.git
- **Publicación:** GitHub Pages → `https://gunderwulde.github.io/CartelGO/`
- **Estado actual:** carpeta local sin `git init` y sin código; solo documentación.

---

## Fase 0 - Repo y despliegue temprano (hacerlo primero)

Desplegar desde el día 1 evita sorpresas con rutas, HTTPS y service worker.

- [ ] `git init`, rama `main`, añadir `origin` = repo de GitHub, primer commit con GDD/AGENTS/PLAN.
- [ ] `.gitignore` (node_modules, dist, .env*, etc.) y `README.md` corto.
- [ ] Scaffold Vite + React + TypeScript (`strict: true`, sin `any`).
- [ ] Instalar dependencias del stack: `tailwindcss`, `lucide-react`, `zustand`, `maplibre-gl`, `h3-js`, `idb-keyval` (o `dexie`), `vite-plugin-pwa`.
- [ ] **Configurar para GitHub Pages:**
  - `base: '/CartelGO/'` en `vite.config.ts`.
  - PWA manifest con `scope` y `start_url` = `/CartelGO/`.
  - Todas las rutas de assets relativas al `base` (nada de `/icon.png` absoluto).
  - Si se usa router: `HashRouter` (Pages no hace fallback SPA) o copiar `index.html` a `404.html`.
- [ ] Workflow `.github/workflows/deploy.yml`: build + `actions/upload-pages-artifact` + `actions/deploy-pages` en cada push a `main`.
- [ ] En GitHub: *Settings → Pages → Source = GitHub Actions*.
- [ ] Verificar que la URL pública carga, es HTTPS (necesario para Geolocation) y es instalable como PWA.

**Hecho cuando:** una pantalla "Hola Cartel" se ve en la URL de Pages y se instala en móvil.

---

## Sprint 1 - Core técnico

- [ ] Estructura de carpetas según AGENTS.md (`components/ map/ services/ store/ data/ types/`).
- [ ] Tailwind con tema cartoon (bordes negros gruesos, sombras duras, paleta saturada).
- [ ] MapLibre GL con estilo cartoon custom.
  - **Decisión pendiente:** fuente de teselas vectoriales gratuita y sin API key (p. ej. OpenFreeMap) frente a MapTiler/Stadia (requieren key, que quedaría expuesta en el cliente). Recomendado: OpenFreeMap + estilo propio.
- [ ] `geoService.ts`: wrapper de `watchPosition`, Haversine, manejo de permisos denegados / sin GPS.
- [ ] Avatar del jugador moviéndose en el mapa.
- [ ] **Anti-cheat:** velocidad > 25 km/h → bloquear interacciones y mostrar aviso "Modo Conducción".
- [ ] Modo debug/simulación (mover el avatar con el dedo o teclado) para poder testear en escritorio sin caminar.
- [ ] Iconos PWA (192/512, maskable) y splash.

## Sprint 2 - Mundo real (Overpass)

- [ ] `osmService.ts`: consulta Overpass por hexágono H3 / radio 1.5 km con las etiquetas del GDD §3 (`industrial`, `pharmacy`, `park`, `bar`/`nightclub`, `police`, `laundry`/`car_wash`).
- [ ] Parser OSM → POIs del juego (tipo, rol, posición; polígonos → centroide).
- [ ] **Caché en IndexedDB ≥ 24 h** por hexágono; nunca consultar en cada tick de GPS.
- [ ] Gestión de errores/rate-limit de Overpass (reintentos con backoff, endpoint alternativo).
- [ ] Pintar marcadores/iconos por tipo y radio de 50 m del radar; círculo de influencia de comisarías.

## Sprint 3 - Loop de calle

- [ ] `data/`: catálogo de precursores, productos (Hierba Risona, Cristal Azul, Polvo Estelar → nombres ficticios, ver AGENTS §3), precios.
- [ ] Stores Zustand: `playerStore`, `inventoryStore`, `mapStore`.
- [ ] Inventario con capacidad de mochila.
- [ ] Interacción a < 50 m: comprar precursores (industrial/farmacia, con límite diario) y vender (parque, bares con x2 de 20:00 a 04:00).
- [ ] Medidor de Heat por cercanía a comisarías; al 100 % se pierde la mercancía.
- [ ] Persistencia del progreso en IndexedDB (offline-first).

## Sprint 4 - Base e Idle

- [ ] Colocación del HQ (movible gratis cada 7 días). **Privacidad:** guardar coordenadas solo en local; para cualquier envío futuro usar H3 res. 7 u offset aleatorio.
- [ ] `idleEngine.ts`: producción por delta `Date.now()` vs `lastSyncTimestamp` (no depender de `setInterval`).
- [ ] Laboratorio: precursores → mercancía, con niveles de velocidad/pureza.
- [ ] Camellos asignados a POIs descubiertos → ingresos pasivos.
- [ ] Negocios tapadera (lavandería/autolavado): blanqueo Dinero Sucio → Dinero Limpio.
- [ ] Mejoras de HQ, almacén y mochila con Dinero Limpio; sistema de Reputación (XP) y desbloqueo de Tiers.
- [ ] Tests unitarios del `idleEngine` y del cálculo de precios/Heat.

## Sprint 5 - Pulido

- [ ] Efectos de sonido cartoon y opción de silencio.
- [ ] Notificaciones locales ("Lote terminado"). Nota: en iOS solo funcionan con la PWA instalada; sin backend/push las notificaciones fiables son limitadas → valorar y documentar.
- [ ] Balanceo económico.
- [ ] Onboarding (permiso de GPS, aviso de seguridad al caminar, tono satírico).
- [ ] Revisión de rendimiento y batería en móvil (frecuencia de `watchPosition`, repintados del mapa).
- [ ] Revisión legal/stores: aviso de que todo es ficticio, sin drogas reales.

---

## Fase 2 (fuera del MVP) - Multijugador

- [ ] Supabase (PostgreSQL + PostGIS), auth.
- [ ] Hexágonos H3 res. 8, puntos de influencia por venta, dominio +15 %.
- [ ] Respetar la regla de privacidad del HQ (solo H3 res. 7).
- [ ] Validación server-side de ventas (el cliente es manipulable).

---

## Riesgos y decisiones abiertas

| Tema | Riesgo / decisión |
| :--- | :--- |
| Teselas del mapa | Necesitan fuente gratuita sin key; respetar licencias y atribución de OSM. |
| Overpass | Endpoint público con límites; caché agresiva obligatoria. |
| GitHub Pages | Solo estático, base path `/CartelGO/`, sin fallback SPA. |
| GPS en iOS PWA | Pide permiso con frecuencia y no hay segundo plano: el juego solo funciona con la app abierta. |
| Título | "Cartel GO" es provisional; el nombre puede chocar con *Pokémon GO* en tiendas; decidir antes de lanzar fuera de Pages. |
| Seguridad física | Aviso claro de no jugar caminando por zonas peligrosas ni conduciendo. |

## Siguiente paso inmediato

Ejecutar **Fase 0** completa (repo + Vite + deploy a Pages).
