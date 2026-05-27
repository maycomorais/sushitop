// subscriptionAdmin.js
// Painel de gestão de assinatura — visível SOMENTE para adminMaster.
// Depende de: subscriptionDateUtils.js, subscriptionService.js

'use strict';

// ─────────────────────────────────────────────────────────────
// RENDER PRINCIPAL DO PAINEL
// ─────────────────────────────────────────────────────────────

async function carregarPainelAssinatura() {
  const container = document.getElementById('painel-assinatura');
  if (!container) return;

  container.innerHTML = `<div style="text-align:center;padding:40px;color:#888">⏳ Cargando...</div>`;

  const { getServerDate, calcularStatusAssinatura, calcularDataVencimento,
          calcularDataLimite, formatarData } = window.SubscriptionDateUtils;

  const [cfg, historico, hoje] = await Promise.all([
    SubscriptionService.getAssinatura(),
    SubscriptionService.getHistoricoPagamentos(12),
    getServerDate(_SUPABASE_URL, _SUPABASE_KEY),
  ]);

  if (!cfg) {
    container.innerHTML = `<div class="alert-box error">❌ No se pudo cargar la suscripción.</div>`;
    return;
  }

  const statusObj = calcularStatusAssinatura(cfg, hoje);
  const { status, diasParaVenc, diasParaBloc, dataVenc, dataLimite } = statusObj;

  // Status badge
  const BADGE = {
    em_dia:         { label: 'Al Día',        bg: '#d1fae5', cor: '#065f46' },
    alerta_verde:   { label: 'Vence Pronto', bg: '#d1fae5', cor: '#065f46' },
    alerta_amarelo: { label: 'Vence Mañana',   bg: '#fef9c3', cor: '#78350f' },
    alerta_laranja: { label: 'Vence Hoy',     bg: '#ffedd5', cor: '#7c2d12' },
    carencia:       { label: 'En Gracia',    bg: '#fee2e2', cor: '#7f1d1d' },
    bloqueado:      { label: 'BLOQUEADO',      bg: '#fca5a5', cor: '#7f1d1d' },
  };
  const badge = BADGE[status] || BADGE.em_dia;

  // Competência atual para confirmar pagamento
  const compAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2,'0')}`;
  const compLabel = hoje.toLocaleDateString('es-PY', { month:'long', year:'numeric', timeZone:'America/Asuncion' });
  const pagouEsteMes = historico.some(p => p.competencia === compAtual);
 
  // Regra de vencimento legível
  const regraLabel = cfg.tipo_vencimento === 'dia_util'
    ? `${cfg.dia_vencimento}º día hábil`
    : `Día ${cfg.dia_vencimento} (fijo)`;

  container.innerHTML = `
    <!-- ── Status atual ───────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
      <div class="sub-card">
        <div class="sub-card-label">Estado</div>
        <div style="display:inline-block;padding:6px 14px;border-radius:20px;
          background:${badge.bg};color:${badge.cor};font-weight:700;font-size:0.9rem">
          ${badge.label}
        </div>
      </div>
      <div class="sub-card">
        <div class="sub-card-label">Vencimiento (${hoje.toLocaleDateString('es-PY',{month:'long',timeZone:'America/Asuncion'})})</div>
        <div class="sub-card-value">${formatarData(dataVenc)}</div>
        <div style="font-size:0.78rem;color:#888;margin-top:2px">${regraLabel}</div>
      </div>
      <div class="sub-card">
        <div class="sub-card-label">Límite (c/ tolerancia)</div>
        <div class="sub-card-value">${formatarData(dataLimite)}</div>
        <div style="font-size:0.78rem;color:#888;margin-top:2px">${cfg.dias_carencia} día(s) de gracia</div>
      </div>
      <div class="sub-card">
        <div class="sub-card-label">Último Pago</div>
        <div class="sub-card-value" style="font-size:1rem">
          ${cfg.ultimo_pagamento_em
            ? new Date(cfg.ultimo_pagamento_em + 'T12:00').toLocaleDateString('es-PY')
            : '—'}
        </div>
      </div>
    </div>

    <!-- ── Confirmar pagamento ────────────────────────── -->
    <div class="sub-section">
      <h4 class="sub-section-title">💳 Confirmar Pago</h4>
      <div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap">
        <div>
          <label class="sub-label">Período</label>
          <input type="month" id="sub-competencia" class="sub-input" value="${compAtual}" />
        </div>
        <div style="flex:1;min-width:180px">
          <label class="sub-label">Observación (opcional)</label>
          <input type="text" id="sub-obs-pagamento" class="sub-input"
            placeholder="Ej: Transferencia confirmada — comprobante #1234" />
        </div>
        <button onclick="confirmarPagamentoAssinatura()"
          class="sub-btn-primary" ${pagouEsteMes ? 'style="background:#6b7280"' : ''}>
          ${pagouEsteMes ? '✅ Pagado este mes' : '💰 Confirmar Pago'}
        </button>
        ${statusObj.status === 'bloqueado'
          ? `<button onclick="desbloquearAssinatura()" class="sub-btn-secondary" style="background:#dc2626;color:#fff">
               🔓 Desbloquear Ahora
             </button>`
          : `<button onclick="bloquearAssinatura()" class="sub-btn-secondary">
               🔒 Bloquear Manualmente
             </button>`
        }
      </div>
    </div>

    <!-- ── Configurações ─────────────────────────────── -->
    <div class="sub-section">
      <h4 class="sub-section-title">⚙️ Configuración de Vencimiento</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px">
        <div>
          <label class="sub-label">Nombre de la Empresa</label>
          <input type="text" id="sub-tenant-nome" class="sub-input"
            value="${_esc(cfg.tenant_nome)}" placeholder="Sushi Top" />
        </div>
        <div>
          <label class="sub-label">Correo de Contacto</label>
          <input type="email" id="sub-tenant-email" class="sub-input"
            value="${_esc(cfg.tenant_email_contato || '')}" placeholder="admin@empresa.com" />
        </div>
        <div>
          <label class="sub-label">Tipo de Vencimiento</label>
          <select id="sub-tipo-venc" class="sub-input" onchange="_toggleDiaVenc()">
            <option value="dia_util"  ${cfg.tipo_vencimento==='dia_util'  ?'selected':''}>Nº Día Hábil</option>
            <option value="dia_fixo"  ${cfg.tipo_vencimento==='dia_fixo'  ?'selected':''}>Día Fijo</option>
          </select>
        </div>
        <div>
          <label class="sub-label" id="sub-dia-venc-label">
            ${cfg.tipo_vencimento==='dia_util' ? 'Nº de Día Hábil' : 'Día del Mes'}
          </label>
          <input type="number" id="sub-dia-vencimento" class="sub-input"
            value="${cfg.dia_vencimento}" min="1" max="31" />
        </div>
        <div>
          <label class="sub-label">Días de Gracia</label>
          <input type="number" id="sub-dias-carencia" class="sub-input"
            value="${cfg.dias_carencia}" min="0" max="30" />
        </div>
        <div style="grid-column:1/-1">
          <label class="sub-label">Observaciones internas</label>
          <input type="text" id="sub-obs-cfg" class="sub-input"
            value="${_esc(cfg.obs || '')}" placeholder="Ej: Plan Pro — Gs 297.000/mes" />
        </div>
      </div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button onclick="salvarConfigAssinatura()" class="sub-btn-primary">💾 Guardar Configuración</button>
        <span id="sub-cfg-msg" style="font-size:0.82rem;color:#22c55e;display:none"></span>
      </div>
    </div>
 
    <!-- ── Prévia do vencimento ───────────────────────── -->
    <div class="sub-section">
      <h4 class="sub-section-title">📅 Vista previa de próximos vencimientos</h4>
      <div id="sub-previa-venc" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        ${_gerarPreviaVencimentos(cfg, hoje)}
      </div>
    </div>
 
    <!-- ── Histórico ──────────────────────────────────── -->
    <div class="sub-section">
      <h4 class="sub-section-title">📋 Historial de Pagos</h4>
      ${_renderHistorico(historico)}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function _gerarPreviaVencimentos(cfg, hoje) {
  const { calcularDataVencimento, calcularDataLimite, formatarData } = window.SubscriptionDateUtils;
  let html = '';
  for (let i = 0; i < 3; i++) {
    let mes = hoje.getMonth() + i;
    let ano = hoje.getFullYear() + Math.floor(mes / 12);
    mes = mes % 12;
    try {
      const dv = calcularDataVencimento(cfg, ano, mes);
      const dl = calcularDataLimite(dv, cfg.dias_carencia);
      const nomeMes = dv.toLocaleDateString('es-PY', { month:'long', year:'numeric', timeZone:'America/Asuncion' });
      html += `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;min-width:160px">
          <div style="font-size:0.75rem;color:#94a3b8;text-transform:uppercase;font-weight:600;margin-bottom:4px">
            ${nomeMes}
          </div>
          <div style="font-weight:700;color:#1e293b;font-size:0.95rem">Vence: ${formatarData(dv)}</div>
          <div style="font-size:0.8rem;color:#ef4444;margin-top:2px">Limite: ${formatarData(dl)}</div>
        </div>`;
    } catch (_) {}
  }
  return html;
}

function _renderHistorico(historico) {
  if (!historico.length) return `<p style="color:#888;font-size:0.85rem">Ningún pago registrado.</p>`;
  const rows = historico.map(p => {
    const dt = new Date(p.confirmado_em).toLocaleDateString('es-PY', { timeZone:'America/Asuncion' });
    const [ano, mes] = p.competencia.split('-');
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic'];
    const compLabel = `${meses[parseInt(mes)-1]}/${ano}`;
    return `<tr>
      <td style="padding:8px 12px;font-weight:600">${compLabel}</td>
      <td style="padding:8px 12px;color:#64748b">${dt}</td>
      <td style="padding:8px 12px;color:#94a3b8;font-size:0.82rem">${p.confirmado_por || '—'}</td>
      <td style="padding:8px 12px;color:#94a3b8;font-size:0.82rem">${p.obs || '—'}</td>
    </tr>`;
  }).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:0.88rem">
    <thead>
      <tr style="background:#f1f5f9;border-bottom:1px solid #e2e8f0">
        <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600">Período</th>
        <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600">Confirmado el</th>
        <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600">Por</th>
        <th style="padding:8px 12px;text-align:left;color:#475569;font-weight:600">Obs</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function _toggleDiaVenc() {
  const tipo = document.getElementById('sub-tipo-venc')?.value;
  const lbl  = document.getElementById('sub-dia-venc-label');
  if (lbl) lbl.textContent = tipo === 'dia_util' ? 'Nº de Día Hábil' : 'Día del Mes';
  const input = document.getElementById('sub-dia-vencimento');
  if (input && tipo === 'dia_util') input.setAttribute('max', '22');
  if (input && tipo === 'dia_fixo') input.setAttribute('max', '31');
}

// ─────────────────────────────────────────────────────────────
// AÇÕES
// ─────────────────────────────────────────────────────────────

async function confirmarPagamentoAssinatura() {
  const competencia = document.getElementById('sub-competencia')?.value;
  const obs         = document.getElementById('sub-obs-pagamento')?.value?.trim();
  if (!competencia) return alert('Seleccione el mes correspondiente.');
 
  const [ano, mes] = competencia.split('-');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'];
  if (!confirm(`¿Confirmar pago de ${meses[parseInt(mes)-1]}/${ano}?`)) return;
 
  const btn = document.querySelector('[onclick="confirmarPagamentoAssinatura()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
 
  const result = await SubscriptionService.confirmarPagamento(
    competencia,
    window._operadorNome || 'adminMaster',
    obs
  );
 
  if (!result.ok) {
    alert('❌ Error: ' + result.error);
    if (btn) { btn.disabled = false; btn.textContent = '💰 Confirmar Pago'; }
  } else {
    alert(`✅ ¡Pago de ${meses[parseInt(mes)-1]}/${ano} confirmado!`);
    carregarPainelAssinatura();
  }
}

async function salvarConfigAssinatura() {
  const cfg = {
    tenant_nome:          document.getElementById('sub-tenant-nome')?.value?.trim(),
    tenant_email_contato: document.getElementById('sub-tenant-email')?.value?.trim(),
    tipo_vencimento:      document.getElementById('sub-tipo-venc')?.value,
    dia_vencimento:       parseInt(document.getElementById('sub-dia-vencimento')?.value),
    dias_carencia:        parseInt(document.getElementById('sub-dias-carencia')?.value),
    obs:                  document.getElementById('sub-obs-cfg')?.value?.trim(),
  };
 
  if (!cfg.tenant_nome)           return alert('Ingrese el nombre de la empresa.');
  if (!cfg.dia_vencimento || cfg.dia_vencimento < 1) return alert('Ingrese el día de vencimiento.');
  if (cfg.tipo_vencimento === 'dia_util' && cfg.dia_vencimento > 22)
    return alert('El Nº de día hábil debe ser entre 1 y 22.');
  if (cfg.tipo_vencimento === 'dia_fixo' && cfg.dia_vencimento > 31)
    return alert('El día fijo debe ser entre 1 y 31.');
 
  const btn = document.querySelector('[onclick="salvarConfigAssinatura()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
 
  const result = await SubscriptionService.salvarConfigAssinatura(cfg);
 
  if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar Configuración'; }
 
  if (!result.ok) {
    alert('❌ Error: ' + result.error);
  } else {
    const msgEl = document.getElementById('sub-cfg-msg');
    if (msgEl) { msgEl.textContent = '✅ ¡Guardado!'; msgEl.style.display = 'inline'; }
    setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 3000);
    carregarPainelAssinatura();
  }
}

async function bloquearAssinatura() {
  if (!confirm('⚠️ ¿Bloquear el sistema para TODOS los usuarios ahora?')) return;
  const r = await SubscriptionService.alternarBloqueio(true, window._operadorNome);
  if (!r.ok) return alert('Error: ' + r.error);
  alert('🔒 Sistema bloqueado.');
  carregarPainelAssinatura();
}
 
async function desbloquearAssinatura() {
  if (!confirm('¿Desbloquear el sistema?')) return;
  const r = await SubscriptionService.alternarBloqueio(false, window._operadorNome);
  if (!r.ok) return alert('Error: ' + r.error);
  alert('🔓 Sistema desbloqueado.');
  carregarPainelAssinatura();
}
