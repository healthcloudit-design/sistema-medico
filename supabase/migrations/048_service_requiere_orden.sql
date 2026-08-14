-- Flag opcional por servicio: indica si requiere orden del médico de cabecera.
-- Additivo y backward-compatible: default false => no cambia el comportamiento de los tenants existentes.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS requiere_orden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.services.requiere_orden IS
  'Si true, el flujo público pregunta por la orden del médico de cabecera antes de permitir reservar (usado por tenants de salud pública multi-centro).';
