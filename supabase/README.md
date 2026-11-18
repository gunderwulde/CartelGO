# Supabase - caché compartida de POIs

Las celdas no caducan: una vez creadas no se vuelven a pedir. El cliente lee la tabla `poi_cells` directamente. Si una celda falta, llama a la función `poi-cell`, que lee las teselas vectoriales de OpenFreeMap (datos de OSM, las mismas del mapa), guarda el resultado y lo devuelve. Sin configurar nada, el juego lee las teselas directamente desde el móvil.

## Puesta en marcha (una vez)

1. Crea un proyecto en https://supabase.com (plan Free).
2. **SQL Editor** → pega y ejecuta `migrations/0001_poi_cells.sql`.
3. Despliega la función (necesita la CLI: `npm i -g supabase` o `npx supabase`):
   ```
   npx supabase login
   npx supabase link --project-ref <ID_DEL_PROYECTO>
   npx supabase functions deploy poi-cell
   ```
   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase solos.
4. En **Project Settings → API** copia la *Project URL* y la clave *anon public*.
5. Local: crea `.env.local` en la raíz (está ignorado por git):
   ```
   VITE_SUPABASE_URL=https://<ID>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
6. GitHub Pages: repo → *Settings → Secrets and variables → Actions → Variables* → crea `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los mismos valores.

La clave `anon` es pública por diseño; la protege RLS (solo lectura). Nunca pongas la `service_role` en el cliente.

## Notas
- `functions/poi-cell/index.ts` duplica la lógica de `src/services/tilePois.ts` (clasificación y geometría de teselas): si cambias los roles, cámbialos en los dos sitios y vuelve a desplegar.
- Los datos son de OpenStreetMap (ODbL): hay que mantener la atribución en el mapa.
- Plan Free: el proyecto se pausa tras ~1 semana sin actividad.

## Partida en la nube (cuentas)

El juego es local; la nube es copia de seguridad y puente entre móviles. Inicio de sesión por **código de email** (sin contraseñas).

1. **SQL Editor** → ejecuta  (tabla  con RLS: cada usuario solo ve la suya).
2. **Authentication → Emails → Templates → Magic Link**: el correo debe incluir el código. Añade, por ejemplo:
   \   (Sin  solo llega un enlace, y la app espera un código.)
3. **Authentication → Providers → Email**: activado, y la longitud del código de 6 a 8 dígitos (la app acepta de 6 a 10).
4. **Authentication → URL Configuration**: *Site URL* = .
5. El correo integrado de Supabase está muy limitado (unos pocos emails por hora). Vale para probar; para lanzar configura un SMTP propio en *Authentication → Emails → SMTP Settings*.

### Cómo sincroniza
- Sube cada ~3 min si hay cambios y al salir de la app; no sube nada si no ha cambiado.
- Cada dispositivo recuerda la revisión que sincronizó. Si la nube avanzó y lo local no, descarga; si avanzaron las dos, **pregunta** qué partida conservar. Nunca pisa en silencio.
- **Privacidad:** no se sube la posición exacta del HQ, solo  (H3 res. 7). Al restaurar en otro móvil hay que volver a colocarlo.
