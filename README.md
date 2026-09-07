# Divas Beauty Spa

Agenda del salón con reservas públicas, roles de administración y trabajadoras, equipo y jornadas, catálogo editable y fichas de clientas. Next.js + Supabase; despliegue existente en Vercel.

## Desarrollo local

1. `npm install`
2. Copiar `.env.example` a `.env.local` y completar las tres variables de Supabase. `SUPABASE_SERVICE_ROLE_KEY` es privada: solo se usa en el servidor y nunca debe tener prefijo `NEXT_PUBLIC_`.
3. `npm run dev`

## Activar la fase 2 en el proyecto existente

La implementación está validada localmente. **La migración y el despliegue de fase 2 todavía no se han aplicado al entorno remoto.**

1. Verificar en Supabase Auth que `rogedaniel1992@gmail.com` existe y tiene el correo confirmado. La migración se detiene sin modificar datos si falta esa cuenta confirmada.
2. Ejecutar una sola vez `supabase/migrations/20260907_phase2.sql` en el SQL Editor del proyecto existente, que ya debe tener las migraciones de fase 1. Se ejecuta dentro de una transacción; un error revierte el conjunto. No volver a ejecutar `schema.sql` ni las migraciones antiguas sobre el proyecto existente.
3. Publicar esta versión de la aplicación en el proyecto Vercel existente, con las tres variables de `.env.example` configuradas.
4. Iniciar sesión con el correo administrador. En **Equipo → Accesos del equipo**, vincular cada cuenta a su profesional y habilitarla. Las cuentas existentes distintas de la administradora quedan pendientes hasta este paso; las nuevas cuentas siempre requieren autorización.
5. Verificar en el entorno real: administradora ve todas las citas; trabajadora ve solo las propias; reserva pública crea su ficha; catálogo admite creación, edición y desactivación; fichas guardan contacto, notas y muestran el historial.

Para una base nueva, ejecutar en orden `supabase/schema.sql`, `20260902_public_booking.sql`, `20260902_professionals_schedule.sql` y luego `20260907_phase2.sql` después de crear/confirmar la cuenta administradora. `20260902_enable_app_access.sql` fue una reparación de fase 1 y repite políticas incluidas en `schema.sql`; no se ejecuta en una instalación nueva.

## Permisos y datos

- Administración gestiona citas, fichas, catálogo, profesionales, jornadas y accesos. No puede modificar sus propios permisos desde la aplicación.
- Las trabajadoras habilitadas y vinculadas a una profesional activa gestionan sus propias citas. Consultan el catálogo y las fichas de sus clientas; el historial muestra únicamente sus citas. Las fichas y el catálogo se editan por administración.
- Las políticas RLS comprueban el perfil en cada petición. Deshabilitar una cuenta o su profesional revoca el acceso aunque el token siga vigente. Los metadatos enviados al registrarse nunca conceden permisos.
- Las citas se vinculan por ID a profesionales y clientas. Renombrar una profesional conserva sus citas y su disponibilidad ocupada.
- Cada cita guarda el nombre, precio y duración del servicio. Los cambios posteriores al catálogo no reescriben esos valores; cambiar el servicio de una cita toma los valores nuevos. Las citas anteriores a fase 2 se inicializan con el catálogo disponible al migrar, porque no existían precios históricos almacenados.
- Servicios y profesionales se desactivan desde sus formularios para conservar el historial. Un servicio inactivo no acepta reservas nuevas, pero sus citas existentes pueden completarse o cancelarse.
- Las clientas existentes se agrupan solo cuando coinciden nombre y teléfono normalizado. Sin teléfono se mantienen separadas para evitar mezclar personas por nombre. Para citas futuras se puede seleccionar una ficha existente, incluso si no tiene teléfono.
- Las reservas públicas crean o vinculan su ficha automáticamente. No exponen notas, contactos ni historial. Excluir una cita de la consulta de disponibilidad requiere autorización sobre esa cita.

## Verificación

- `npm run build`: compilación de producción y revisión de tipos.
- `sh tests/run-api-tests.sh`: cinco pruebas del endpoint de disponibilidad, con un cliente de datos simulado; cubren autorización, servicios inactivos, duración histórica y profesionales renombradas.
- `psql -v ON_ERROR_STOP=1 -d <base_temporal_vacía> -f tests/phase2.sql`: prueba real de PostgreSQL con roles Auth simulados. **Usar únicamente una instancia de prueba**, nunca el proyecto del salón: crea roles, tablas y datos ficticios. Comprueba migración, permisos, intentos de escalación, revocación, horarios, fichas y conservación del historial.

No se ha realizado verificación de interfaz en navegador ni validación contra el Supabase remoto en esta sesión. La prevención atómica de reservas simultáneas sigue siendo un pendiente separado: las consultas actuales comprueban disponibilidad antes de insertar.
