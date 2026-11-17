# GDD.md - Game Design Document: "Cartel GO" (Título Provisional)

## 1. Visión General
- **Género:** GPS Location-Based / Idle Tycoon.
- **Plataforma:** Web Móvil (PWA instalable en iOS y Android).
- **Estilo Visual:** Caricatura vibrante (estilo *Grand Theft Auto: Chinatown Wars* mezclado con *Simpsons: Tapped Out*). Trazos negros gruesos, colores saturados y tono de humor ácido.
- **Modo de Juego:** Fase 1 Single-Player (PvE contra la policía y el mercado) con arquitectura preparada para Fase 2 Multijugador Asíncrono (PvP territorial).

---

## 2. Bucle Principal (Core Loop)

### Fase A: En la Calle (Exploración GPS)
1. El jugador camina por su ciudad con el mapa abierto.
2. El radar (radio de interacción de **50 metros**) detecta Puntos de Interés (POIs) generados desde OpenStreetMap.
3. **Abastecimiento:** El jugador visita Zonas Industriales o Farmacias para conseguir *Precursores* (materia prima).
4. **Distribución:** El jugador visita Parques, Bares o Discotecas para vender *Producto Terminado* a cambio de **Dinero Sucio**.
5. **Evasión:** El jugador evita el radio de influencia de las Comisarías (zonas de alto riesgo de redada).

### Fase B: En el Cuartel General (Gestión Idle)
1. Desde casa (o cualquier lugar), el jugador abre la vista de su **Cuartel General (HQ)**.
2. **Producción:** Asigna *Precursores* a los **Laboratorios** para cocinar productos de mayor pureza y valor de forma pasiva.
3. **Automatización:** Contrata *Camellos (NPCs)* y los asigna a POIs ya descubiertos para que generen ingresos pasivos constantes.
4. **Blanqueo:** Envía **Dinero Sucio** a sus *Negocios Tapadera* para convertirlo en **Dinero Limpio**, necesario para expandir infraestructuras.

---

## 3. Mapeo del Mundo Real (OpenStreetMap -> Gameplay)

| Etiqueta OSM | Tipo de Lugar Real | Rol en el Juego | Mecánica Especial |
| :--- | :--- | :--- | :--- |
| `landuse=industrial` | Polígonos / Fábricas | **Almacén Clandestino** | Compra de precursores al por mayor a bajo precio. |
| `amenity=pharmacy` | Farmacias | **Suministro Químico** | Compra de ingredientes refinados (límite diario). |
| `leisure=park` | Parques y Plazas | **Punto de Menudeo** | Venta rápida, bajo riesgo, margen de beneficio medio. |
| `amenity=bar` / `nightclub` | Bares y Discotecas | **Zona VIP** | Alta demanda y precio x2 entre las 20:00 y las 04:00. |
| `amenity=police` | Comisarías | **Zona Caliente** | Aumenta el medidor de "Búsqueda" (Heat). Si llega al 100%, pierdes la mercancía que llevas encima. |
| `shop=laundry` / `car_wash` | Lavanderías / Autolavados | **Negocio Tapadera** | Permite comprar el local para blanquear dinero automáticamente. |

---

## 4. Economía y Recursos

1. **Precursores (Materia Prima):** Químicos básicos, fertilizantes, baterías. Se obtienen en la calle.
2. **Mercancía (Productos Ficticios):**
   - *Hierba Risona* (Tier 1 - Cultivo rápido, bajo valor).
   - *Cristal Azul* (Tier 2 - Requiere Laboratorio Básico, valor medio).
   - *Polvo Estelar* (Tier 3 - Requiere Laboratorio Avanzado, alto valor).
3. **Dinero Sucio (Cash):** Se gana vendiendo en la calle o mediante camellos. No se puede usar para mejorar edificios principales y se pierde si te atrapa la policía.
4. **Dinero Limpio (Banco):** Se obtiene blanqueando Dinero Sucio. Sirve para ampliar el HQ, comprar negocios tapadera y desbloquear tecnologías.
5. **Reputación (XP):** Sube al completar entregas y expandir territorio. Desbloquea nuevos Tiers.

---

## 5. Infraestructuras del Imperio
- **Cuartel General (HQ):** El jugador lo coloca en el mapa al empezar (puede moverlo gratis cada 7 días). Determina el nivel máximo de los demás edificios.
- **Mochila / Vehículo:** Define cuánta mercancía puede cargar el jugador físicamente mientras camina.
- **Almacén:** Capacidad máxima de almacenamiento en la base.
- **Laboratorio:** Transforma Precursores en Mercancía automáticamente (mejorable en velocidad y pureza).
- **Red de Camellos:** Slots de NPCs que generan ingresos *Idle* en los barrios visitados.

---

## 6. Preparación para Multijugador (Fase 2 - Guerra de Territorios)
- El mapa se divide usando **Uber H3 (Resolución 8 - aprox. 0.7 km² por hexágono)**.
- Cada venta realizada por el jugador suma **Puntos de Influencia** en ese hexágono.
- El jugador con mayor influencia domina el hexágono, tiñéndolo de su color y obteniendo un **+15% de beneficios** en todas las operaciones dentro de esa zona.
- Los jugadores pueden ver los hexágonos dominados por rivales y competir haciendo ventas en esa zona para arrebatar el control.

---

## 7. Roadmap de Desarrollo (MVP)
- **Sprint 1 (Core Técnico):** Setup Vite + PWA, integración de MapLibre con estilo cartoon, lectura de GPS real y movimiento del avatar.
- **Sprint 2 (Mundo Real):** Conexión con Overpass API para pintar Parques, Bares y Comisarías reales alrededor del jugador.
- **Sprint 3 (Loop de Calle):** Inventario básico, interacción al estar a <50m de un POI (comprar precursores y vender producto).
- **Sprint 4 (Base e Idle):** Creación del HQ, sistema de fabricación en laboratorio con cálculo de tiempo offline y blanqueo básico.
- **Sprint 5 (Pulido UI):** Efectos de sonido cartoon, notificaciones locales (ej. "Lote terminado en el laboratorio") y balanceo económico.
