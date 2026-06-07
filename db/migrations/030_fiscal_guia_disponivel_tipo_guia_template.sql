-- Fase 2.7 — template WhatsApp guia.disponivel com tipo DAS ou DARF

INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body_template)

VALUES (

  NULL,

  'guia.disponivel',

  'whatsapp',

  NULL,

  'Olá {{nome}}, sua guia {{tipo_guia}} de {{competencia}} no valor de {{valor}} está disponível. Vencimento: {{data_vencimento}}. Linha digitável: {{linha_digitavel}}. PDF: {{pdf_url}}'

)

ON CONFLICT (tenant_id, event_type, channel) DO UPDATE

  SET body_template = EXCLUDED.body_template,

      is_active = true,

      updated_at = now();

