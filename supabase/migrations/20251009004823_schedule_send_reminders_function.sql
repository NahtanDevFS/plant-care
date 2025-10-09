-- supabase/migrations/xxxxxxxx_schedule_send_reminders_function.sql

SELECT cron.unschedule('send-daily-reminders');

-- Programar la función 'send-reminders' para que se ejecute todos los días a las 15:00 UTC (9 AM en Guatemala)
SELECT
  cron.schedule(
    'send-daily-reminders', -- Nombre único para tu tarea
    '0 15 * * *', -- Expresión Cron: "a los 0 minutos de la hora 15 (3 PM UTC), todos los días"
    $$
      SELECT
        net.http_post(
          url := 'https://sqipbxfyklsvzfgdodxd.supabase.co/functions/v1/send-reminders', -- <-- PEGA AQUÍ LA URL DE TU FUNCIÓN
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxaXBieGZ5a2xzdnpmZ2RvZHhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyODg1ODUsImV4cCI6MjA3NDg2NDU4NX0.UZe8ry9UlLFFWgjZpRWABRNVLScTRdYL0thyCcS37Pw"}'::jsonb
        )
      AS request_id;
    $$
  );