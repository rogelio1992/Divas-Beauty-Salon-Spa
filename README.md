# Luna Beauty Studio

MVP de agenda para un salón de belleza. Incluye una interfaz responsive con calendario diario, filtro por profesional y creación local de citas.

## Inicio local

1. Instala dependencias: `npm install`
2. Copia `.env.example` a `.env.local` y agrega las credenciales de Supabase cuando se cree el proyecto.
3. Ejecuta `npm run dev`.

## Próxima integración

Crear en Supabase las tablas `profiles`, `services` y `appointments`; aplicar políticas RLS para que las trabajadoras solo consulten sus citas y la administradora gestione toda la agenda.
