-- Sprint 3: templates nfse_emitida e magic_link.

INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body_template)
VALUES
  (NULL, 'nfse_emitida', 'email',
   'Nota Fiscal emitida — {{escritorio_nome}}',
   'Olá {{nome}}, sua Nota Fiscal de Serviço nº {{numero_nfse}} foi emitida.\nValor: {{valor}}\nBaixe o PDF: {{pdf_url}}'),
  (NULL, 'magic_link', 'email',
   'Seu link de acesso — {{escritorio_nome}}',
   'Clique no link abaixo para acessar suas cobranças (válido por 15 minutos):\n{{magic_link_url}}')
ON CONFLICT (tenant_id, event_type, channel) DO NOTHING;
