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
- `sh tests/run-api-tests.sh`: siete pruebas del endpoint de disponibilidad, con un cliente de datos simulado; cubren autorización, servicios inactivos, duración histórica y profesionales renombradas.
- `psql -v ON_ERROR_STOP=1 -d <base_temporal_vacía> -f tests/phase2.sql`: prueba real de PostgreSQL con roles Auth simulados. **Usar únicamente una instancia de prueba**, nunca el proyecto del salón: crea roles, tablas y datos ficticios. Comprueba migración, permisos, intentos de escalación, revocación, horarios, fichas y conservación del historial.

No se ha realizado verificación de interfaz en navegador ni validación contra el Supabase remoto en esta sesión.

## Activar la protección contra reservas simultáneas

Después de la fase 2, ejecutar una sola vez `supabase/migrations/20260907_appointments_no_overlap.sql` en Supabase y publicar los cambios de aplicación en Vercel. No volver a ejecutar la migración de fase 2 si ya está aplicada.

La migración no borra ni corrige citas. Si encuentra cruces existentes o citas no canceladas sin profesional vinculada, revierte todo y se detiene. Ejecutar `supabase/checks/appointment_conflicts.sql` para identificar los registros y resolverlos según corresponda (reagendar, asignar profesional o cancelar) antes de reintentar. La instalación bloquea escrituras brevemente mientras valida y crea la restricción.

La restricción `appointments_no_overlap` impide cruces por ID de profesional para todos los estados excepto `cancelled`, incluyendo peticiones simultáneas y cambios de hora, profesional, servicio o estado. Los intervalos incluyen el inicio y excluyen el final: una cita puede empezar exactamente cuando termina otra. El cálculo usa UTC y minutos transcurridos, independiente de la zona horaria de la sesión. Una cita no cancelada debe tener profesional vinculada.

PostgreSQL devuelve `23P01` ante un cruce. La API pública lo convierte en HTTP 409 sin exponer los datos de la cita que ocupó el horario. Ambos formularios muestran un mensaje y recargan disponibilidad; la agenda también informa conflictos al reactivar citas. Las comprobaciones previas de disponibilidad se mantienen como ayuda, pero la garantía está en la base de datos.

Prueba real de concurrencia (solo en una base desechable inicializada con `tests/phase2.sql`, usando el clúster local de pruebas `/tmp:55432`):

```bash
python3 tests/booking-concurrency.py <base_temporal>
```

Comprueba migración con cruces previos, dos inserciones simultáneas de reserva pública/trabajadora, límites consecutivos, profesionales distintas, cancelación concurrente, reactivación, cambios de hora/duración, y zona horaria. La activación en el Supabase real queda a cargo del usuario.

## Fidelización: activación en un solo despliegue

Con fase 2 ya aplicada, ejecutar una sola vez y en orden:

1. `supabase/migrations/20260908_loyalty_settings.sql` (omitir si ya se aplicó).
2. `supabase/migrations/20260908_loyalty_cards.sql`.
3. Publicar esta versión completa en Vercel una sola vez. No requiere nuevas variables de entorno.

En **Administración → Fidelización**, guardar las visitas necesarias (1–100) y el descuento porcentual entero (1–100). Ambos comienzan sin configurar. En **Clientas → Ver ficha**, emitir la tarjeta antes de la próxima visita; compartir el enlace privado o QR, o abrir WhatsApp con el mensaje preparado. El envío requiere la acción del usuario.

### Reglas del programa

- Cada cita completada cuyo inicio sea posterior a la emisión suma un sello, hasta llenar la tarjeta. No se importan visitas históricas ni se acreditan citas futuras. Las trabajadoras suman sellos al completar sus propias citas; solo administración emite tarjetas y canjea descuentos.
- Cambiar visitas o porcentaje afecta a las tarjetas que se emitan después. Las existentes conservan las condiciones con las que se emitieron.
- Una tarjeta llena permite un descuento en una cita posterior completada, que comience después del término de las citas que dieron sus sellos. El canje no suma otro sello. Mientras el premio esté pendiente, no se acumulan sellos adicionales.
- El canje registra el descuento sobre el precio histórico de la cita, redondeado al peso, y abre una nueva tarjeta. El detalle de cita y el historial de canjes muestran el total descontado. El pago sigue siendo presencial/manual; no se procesa ningún cobro online ni se altera el precio base histórico del servicio.
- Cancelar, eliminar o cambiar de clienta una cita retira su sello si todavía no se ha canjeado. Las citas utilizadas para obtener o aplicar un beneficio canjeado conservan sus datos: se bloquean cambios de estado, clienta, fecha, servicio, duración y eliminación para mantener la integridad del canje. Las notas sí se pueden editar.
- Emisiones, sellos y canjes están protegidos por restricciones y bloqueos de filas en PostgreSQL. Repetir un mismo canje no genera otro descuento ni otra tarjeta.
- El enlace `/tarjeta/<token>` es de consulta, no requiere cuenta y muestra únicamente progreso y beneficios. No devuelve nombre, teléfono, notas ni citas. No se indexa y no envía referrer. Administración puede renovar el enlace para invalidar el anterior. El QR se genera dentro de la aplicación, sin enviar el enlace a un servicio externo.

### Validación local

`npm run build` comprueba compilación y tipos. En una base **temporal y desechable**, ejecutar `tests/phase2.sql` y luego `tests/loyalty.sql`. El segundo aplica ambas migraciones nuevas y comprueba permisos, validación de condiciones, emisión, sellos, cancelaciones, canje, conservación de condiciones, privacidad y revocación de enlaces. Ejecutar después `python3 tests/loyalty-concurrency.py <base_temporal> <puerto>` para comprobar emisiones, sellos y canjes simultáneos. Nunca ejecutar estos archivos de pruebas sobre el Supabase del salón.
