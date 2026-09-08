que migracion# Roadmap — Divas Beauty Spa

Este documento es la guía de evolución del sistema. Cada mejora terminada se marca aquí antes de pasar a la siguiente fase.

## Estado actual

- [x] Agenda visual responsive.
- [x] Crear citas durante la sesión.
- [x] Servicios alineados con Divas Beauty Spa.
- [x] Acceso a reservas por WhatsApp.
- [x] Despliegue de prueba en Vercel.
- [x] Secciones disponibles: Agenda, Clientes, Servicios y Equipo.
- [x] Navegación diaria de la agenda y eliminación de citas de demostración.
- [x] Citas persistentes en Supabase.
- [x] Inicio de sesión básico para acceder a la agenda.
- [x] Reserva pública sin cuenta para clientas.
- [x] Horarios disponibles y prevención de cruces en reservas públicas.
- [x] Estados operativos para citas y liberación automática al cancelar.
- [x] Horarios disponibles y prevención de cruces en la agenda interna.

## Fase 1 — Agenda operativa

Objetivo: usar la agenda diariamente sin perder la información.

- [x] Conectar Supabase para guardar los datos.
- [x] Crear y eliminar citas reales.
- [x] Editar citas.
- [x] Ver detalle completo de una cita.
- [x] Navegar por días en la agenda.
- [x] Mostrar calendario semanal.
- [x] Estados: confirmada, completada, cancelada y no asistió.
- [x] Evitar cruces de horario para cada profesional.

## Fase 2 — Equipo y servicios

Objetivo: organizar el trabajo real del salón.

**Implementación terminada y validada localmente el 7 de septiembre de 2026. Pendiente de activación en Supabase y Vercel.** Las casillas de esta fase reflejan el código implementado; no un despliegue ya realizado.

- [x] Inicio de sesión para administradora y trabajadoras.
- [x] Permisos: cada trabajadora ve sus citas; administración ve todo.
- [x] Configurar horarios y días de trabajo por profesional.
- [x] Administrar equipo de profesionales.
- [x] Administrar catálogo de servicios, precios y duración.
- [x] Ficha e historial de cada clienta.

### Activación de fase 2

- [ ] Aplicar `supabase/migrations/20260907_phase2.sql` al proyecto real. Requiere que `rogedaniel1992@gmail.com` exista con correo confirmado.
- [ ] Publicar esta versión en Vercel.
- [ ] Vincular y habilitar las cuentas reales del equipo.
- [ ] Verificar los flujos de administración, trabajadora y reserva pública en el entorno real.

## Fase 3 — Reservas de clientas

Objetivo: facilitar que las clientas reserven y confirmen su hora.

- [x] Página pública de reservas.
- [x] Mostrar solo horas disponibles.
- [x] Confirmación manual de cita por WhatsApp con mensaje prellenado.
- [ ] Recordatorios automáticos antes de la cita.
- [x] Bandeja de recordatorios manuales asistidos por WhatsApp.

## Fase 4 — Administración del negocio

Objetivo: apoyar las decisiones del salón.

- [ ] Registrar pagos y métodos de pago.
- [ ] Calcular comisiones por profesional.
- [ ] Reportes de ventas, servicios y asistencia.
- [ ] Indicadores de clientas frecuentes y cancelaciones.

## Ideas futuras

- [ ] Lista de espera cuando no haya cupos.
- [ ] Paquetes, promociones y tarjetas de regalo.
- [ ] Galería de trabajos por profesional.
- [ ] Integración con Google Calendar.

---

**Próxima prioridad:** activar y verificar la fase 2 en Supabase/Vercel; después, recordatorios automáticos de fase 3.

**Protección de reservas simultáneas:** implementada mediante una restricción de exclusión en PostgreSQL. Pendiente de aplicar `supabase/migrations/20260907_appointments_no_overlap.sql` y publicar los mensajes de conflicto en Vercel.

- [x] Bloquear cruces concurrentes al crear, editar o reactivar citas.
- [x] Mantener libres las citas canceladas y permitir horarios consecutivos.
- [x] Mostrar un mensaje de horario ocupado y actualizar disponibilidad ante un conflicto.
- [ ] Aplicar la migración de protección en Supabase y desplegar esta versión (a cargo del usuario).
