// ══════════════════════════════════════════════════════════════
//  MÓDULO MENSALISTAS — Planos Mensais de Clientes
//  Arquivo: mensalistas.js  |  Requer: supabaseClient.js, crm.js
// ══════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────
//  Estado
// ──────────────────────────────────────────────────────────────
let _mens_planos           = [];
let _mens_clientes         = [];
let _mens_produtos         = [];
let _mens_planoEntregaAtual = null;
let _mens_nomeRestaurante  = '';

// ──────────────────────────────────────────────────────────────
//  HELPERS DE TIPO (unidades vs kg)
//  obs é armazenado como JSON: {"t":"kg","n":"nota do usuario"}
//  Para retrocompatibilidade: se obs não for JSON válido, trata como nota texto
// ──────────────────────────────────────────────────────────────
function _mensObs(plano) {
  try { return JSON.parse(plano.obs || 'null') || {}; } catch { return { n: plano.obs || '' }; }
}
function _mensGetTipo(plano)  { return _mensObs(plano).t || 'un'; }
function _mensGetNota(plano)  { return _mensObs(plano).n || ''; }
function _mensEncodeObs(tipo, nota) {
  return JSON.stringify({ t: tipo, n: nota || '' });
}

// Armazenagem: unidades = valor inteiro; kg = valor * 10 (precisão 0,1 kg)
function _mensKgToInt(kg)   { return Math.round(parseFloat(kg) * 10); }
function _mensIntToKg(n)    { return (n / 10).toFixed(1); }

function _mensFmtQtd(valorInt, tipo) {
  if (tipo === 'kg') return _mensIntToKg(valorInt).replace('.', ',') + ' kg';
  return valorInt + (valorInt === 1 ? ' unid.' : ' unids.');
}

// ──────────────────────────────────────────────────────────────
//  INIT — chamado por showTab('mensalistas')
// ──────────────────────────────────────────────────────────────
async function initMensalistas() {
  await Promise.all([
    _mensCarregarClientes(),
    _mensCarregarProdutos(),
    _mensCarregarNomeRestaurante(),
  ]);
  await mensCarregarPlanos();
}

async function _mensCarregarClientes() {
  const { data } = await supa.from('clientes').select('id, nome, telefone').order('nome');
  _mens_clientes = data || [];
}

async function _mensCarregarProdutos() {
  const { data } = await supa.from('produtos').select('id, nome, categoria_slug').order('nome');
  _mens_produtos = data || [];
}

async function _mensCarregarNomeRestaurante() {
  try {
    const { data } = await supa.from('configuracoes').select('nome_restaurante').maybeSingle();
    _mens_nomeRestaurante = data?.nome_restaurante || 'RESTAURANTE';
  } catch(e) { _mens_nomeRestaurante = 'RESTAURANTE'; }
}

// ──────────────────────────────────────────────────────────────
//  CARREGAR E RENDERIZAR PLANOS
// ──────────────────────────────────────────────────────────────
async function mensCarregarPlanos() {
  const loading = document.getElementById('mens-loading');
  if (loading) loading.style.display = 'flex';

  try {
    const { data, error } = await supa
      .from('planos_mensalistas')
      .select('*, clientes(id, nome, telefone)')
      .order('created_at', { ascending: false });

    if (error) { console.warn('mensCarregarPlanos:', error.message); return; }
    _mens_planos = data || [];
    _mensRenderKPIs();
    mensRenderPlanos();
  } catch(e) { console.warn('mensCarregarPlanos:', e.message); }
  finally { if (loading) loading.style.display = 'none'; }
}

function _mensRenderKPIs() {
  const total   = _mens_planos.length;
  const ativos  = _mens_planos.filter(p => p.ativo).length;
  const receita = _mens_planos.reduce((s, p) => s + (p.valor_plano || 0), 0);

  // Itens restantes: soma de unidades + kg separados para exibição
  const itensPorTipo = _mens_planos.reduce((acc, p) => {
    const tipo = _mensGetTipo(p);
    if (tipo === 'kg') acc.kg += (p.quantidade_restante || 0);
    else acc.un += (p.quantidade_restante || 0);
    return acc;
  }, { un: 0, kg: 0 });

  let itensTxt = '';
  if (itensPorTipo.un > 0 && itensPorTipo.kg > 0)
    itensTxt = `${itensPorTipo.un} un + ${_mensIntToKg(itensPorTipo.kg).replace('.',',')} kg`;
  else if (itensPorTipo.kg > 0)
    itensTxt = `${_mensIntToKg(itensPorTipo.kg).replace('.',',')} kg`;
  else
    itensTxt = String(itensPorTipo.un);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('mens-kpi-total',   total);
  set('mens-kpi-ativos',  ativos);
  set('mens-kpi-receita', `Gs ${Math.round(receita).toLocaleString('es-PY')}`);
  set('mens-kpi-itens',   itensTxt);
}

function mensRenderPlanos() {
  const cont = document.getElementById('mens-lista-planos');
  if (!cont) return;

  const filtro  = (document.getElementById('mens-filtro-status')?.value || 'todos');
  const busca   = (document.getElementById('mens-busca')?.value || '').toLowerCase().trim();

  let planos = _mens_planos.filter(p => {
    if (filtro === 'ativo'   && !p.ativo) return false;
    if (filtro === 'inativo' &&  p.ativo) return false;
    if (busca) {
      const nome     = (p.clientes?.nome || '').toLowerCase();
      const tel      = (p.clientes?.telefone || '').toLowerCase();
      const produto  = (p.produto_nome || '').toLowerCase();
      if (!nome.includes(busca) && !tel.includes(busca) && !produto.includes(busca)) return false;
    }
    return true;
  });

  if (!planos.length) {
    cont.innerHTML = `
      <div style="text-align:center;color:#aaa;padding:40px">
        <div style="font-size:2rem;margin-bottom:8px">📋</div>
        <div>${t('mens.nenhum_plano', 'Nenhum plano mensal registrado ainda.')}</div>
      </div>`;
    return;
  }

  cont.innerHTML = planos.map(p => {
    const tipo         = _mensGetTipo(p);
    const qtdTotal     = p.quantidade_total || 0;
    const qtdRest      = p.quantidade_restante || 0;
    const pct          = qtdTotal > 0 ? Math.round((qtdRest / qtdTotal) * 100) : 0;
    const barColor     = pct > 50 ? '#1a7a2e' : pct > 20 ? '#f39c12' : '#e74c3c';
    const statusColor  = p.ativo ? '#1a7a2e' : '#9ca3af';
    const dataFim      = p.data_fim
      ? new Date(p.data_fim + 'T12:00:00').toLocaleDateString('es-PY')
      : t('geral.indeterminado', 'Indeterminado');
    const vencendo     = p.data_fim && new Date(p.data_fim) < new Date(Date.now() + 7 * 86400000);
    const fmtRest      = _mensFmtQtd(qtdRest, tipo);
    const fmtTotal     = _mensFmtQtd(qtdTotal, tipo);
    const esgotado     = qtdRest <= 0 && p.ativo;

    return `
      <div style="background:#fff;border:1.5px solid ${p.ativo ? '#d1fae5' : '#e5e7eb'};border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.05)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:1rem;margin-bottom:2px">${p.clientes?.nome || '—'}</div>
            <div style="color:#6b7280;font-size:0.82rem">${p.clientes?.telefone || ''}</div>
            <div style="font-weight:600;font-size:0.9rem;margin-top:6px;color:#111">
              ${tipo === 'kg' ? '⚖️' : '📦'} ${p.produto_nome}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <span style="background:${p.ativo ? '#dcfce7' : '#f3f4f6'};color:${statusColor};padding:3px 11px;border-radius:10px;font-size:0.73rem;font-weight:700">
              ${p.ativo ? '● ' + t('geral.ativo', 'ATIVO') : '○ ' + t('geral.inativo', 'INATIVO')}
            </span>
            <div style="font-size:0.75rem;color:${vencendo && p.ativo ? '#e74c3c' : '#9ca3af'};margin-top:5px">
              ${vencendo && p.ativo ? '⚠️ ' : ''}${t('geral.vence', 'Vence:')} ${dataFim}
            </div>
            <div style="font-weight:700;color:#1a7a2e;font-size:0.95rem;margin-top:3px">
              Gs ${Math.round(p.valor_plano || 0).toLocaleString('es-PY')}
            </div>
          </div>
        </div>

        <div style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:5px">
            <span style="color:#555">${t('mens.saldo_itens', 'Saldo:')} <b style="color:#111">${fmtRest}</b> de ${fmtTotal}</span>
            <span style="color:${barColor};font-weight:700">${pct}%</span>
          </div>
          <div style="background:#f0f0f0;border-radius:6px;height:9px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:6px;transition:width 0.4s"></div>
          </div>
        </div>

        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
          ${p.ativo && qtdRest > 0 ? `
          <button onclick="mensAbrirEntrega(${p.id})"
            style="flex:2;padding:9px;background:#1a7a2e;color:#fff;border:none;border-radius:9px;cursor:pointer;font-size:0.83rem;font-weight:700;min-width:120px">
            ${tipo === 'kg' ? '⚖️' : '📦'} ${t('mens.registrar_entrega', 'Registrar Entrega')}
          </button>` : (esgotado ? `
          <div style="flex:2;padding:9px;background:#fef3c7;color:#92400e;border-radius:9px;font-size:0.82rem;font-weight:600;text-align:center;min-width:120px">
            ✅ ${t('mens.plano_esgotado', 'Plano esgotado')}
          </div>` : '')}
          <button onclick="mensAbrirModalPlano(${p.id})"
            style="flex:1;padding:9px;background:#3498db;color:#fff;border:none;border-radius:9px;cursor:pointer;font-size:0.83rem;font-weight:600;min-width:70px">
            ✏️
          </button>
          <button onclick="mensVerHistorico(${p.id})"
            style="flex:1;padding:9px;background:#9b59b6;color:#fff;border:none;border-radius:9px;cursor:pointer;font-size:0.83rem;font-weight:600;min-width:70px">
            📋
          </button>
          <button onclick="mensExcluirPlano(${p.id})"
            style="flex:0 0 40px;padding:9px;background:#fee2e2;color:#e74c3c;border:none;border-radius:9px;cursor:pointer;font-size:0.9rem;font-weight:700"
            title="${t('mens.excluir_plano', 'Excluir plano')}">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ──────────────────────────────────────────────────────────────
//  MODAL NOVO / EDITAR PLANO
// ──────────────────────────────────────────────────────────────
function mensToggleTipoPlano() {
  const tipo  = document.getElementById('mens-plano-tipo')?.value || 'un';
  const label = document.getElementById('mens-plano-qtd-label');
  const input = document.getElementById('mens-plano-qtd');
  if (tipo === 'kg') {
    if (label) label.textContent = 'Peso total contratado (kg) *';
    if (input) { input.placeholder = 'Ex: 5.0'; input.step = '0.1'; input.min = '0.1'; }
  } else {
    if (label) label.textContent = 'Qtd Total de Itens *';
    if (input) { input.placeholder = 'Ex: 22'; input.step = '1'; input.min = '1'; }
  }
}

function mensAbrirModalPlano(id = null) {
  const p    = id ? _mens_planos.find(p => p.id === id) : null;
  const tipo = p ? _mensGetTipo(p) : 'un';
  const nota = p ? _mensGetNota(p) : '';

  document.getElementById('mens-plano-id').value     = p?.id || '';
  document.getElementById('mens-plano-cli-id').value  = p?.cliente_id || '';
  document.getElementById('mens-plano-produto').value = p?.produto_nome || '';
  document.getElementById('mens-plano-valor').value   = p?.valor_plano || '';
  document.getElementById('mens-plano-ini').value     = p?.data_inicio || new Date().toISOString().split('T')[0];
  document.getElementById('mens-plano-fim').value     = p?.data_fim || '';
  document.getElementById('mens-plano-nota').value    = nota;

  // Tipo
  const selTipo = document.getElementById('mens-plano-tipo');
  if (selTipo) selTipo.value = tipo;

  // Quantidade — exibir em unidade display (kg ou int)
  const qtdInput = document.getElementById('mens-plano-qtd');
  if (qtdInput) {
    if (tipo === 'kg') {
      qtdInput.value = p ? _mensIntToKg(p.quantidade_total) : '';
    } else {
      qtdInput.value = p?.quantidade_total || '';
    }
  }
  mensToggleTipoPlano();

  const chkAtivo = document.getElementById('mens-plano-ativo');
  if (chkAtivo) chkAtivo.checked = p ? p.ativo : true;

  // Popula select de clientes
  const selCli = document.getElementById('mens-plano-cli-sel');
  if (selCli) {
    selCli.innerHTML = `<option value="">${t('mens.selecione_cliente', '— Selecione o cliente —')}</option>` +
      _mens_clientes.map(c =>
        `<option value="${c.id}" ${p?.cliente_id === c.id ? 'selected' : ''}>${c.nome}${c.telefone ? ' · ' + c.telefone : ''}</option>`
      ).join('');
    selCli.onchange = () => {
      document.getElementById('mens-plano-cli-id').value = selCli.value;
    };
  }

  // Popula select de produtos
  const selProd = document.getElementById('mens-plano-prod-sel');
  if (selProd) {
    selProd.innerHTML = `<option value="">${t('mens.selecione_cardapio', '— Selecione do cardápio —')}</option>` +
      _mens_produtos.map(pr =>
        `<option value="${pr.nome}" ${p?.produto_nome === pr.nome ? 'selected' : ''}>${pr.nome}${pr.categoria_slug ? ' · ' + pr.categoria_slug : ''}</option>`
      ).join('');
    selProd.onchange = () => {
      if (selProd.value) document.getElementById('mens-plano-produto').value = selProd.value;
    };
  }

  // Info de renovação se editando
  const infoRenov = document.getElementById('mens-renov-info');
  if (infoRenov) {
    if (p) {
      const saldoFmt = _mensFmtQtd(p.quantidade_restante, tipo);
      infoRenov.style.display = 'block';
      infoRenov.innerHTML = `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;font-size:0.82rem;color:#1e40af;margin-bottom:14px">
          ${t('mens.renovacao_info', '<b>Renovação:</b> Ao modificar a quantidade total, o saldo restante será ajustado proporcionalmente.<br>Saldo atual: <b>{qtd}</b>.').replace('{qtd}', saldoFmt)}
        </div>`;
    } else {
      infoRenov.style.display = 'none';
    }
  }

  document.getElementById('modal-mens-plano').style.display = 'flex';
  setTimeout(() => document.getElementById('mens-plano-cli-sel')?.focus(), 100);
}

async function mensSalvarPlano() {
  const id           = document.getElementById('mens-plano-id').value;
  const cliente_id   = parseInt(document.getElementById('mens-plano-cli-id').value) || null;
  const produto_nome = document.getElementById('mens-plano-produto').value.trim();
  const tipo         = document.getElementById('mens-plano-tipo')?.value || 'un';
  const qtdRaw       = document.getElementById('mens-plano-qtd').value;
  const nota         = document.getElementById('mens-plano-nota')?.value.trim() || '';
  const valor        = parseFloat(document.getElementById('mens-plano-valor').value) || 0;
  const data_ini     = document.getElementById('mens-plano-ini').value || null;
  const data_fim     = document.getElementById('mens-plano-fim').value || null;
  const ativo        = document.getElementById('mens-plano-ativo')?.checked ?? true;

  // Converter para inteiro de armazenamento
  const qtd_total = tipo === 'kg'
    ? _mensKgToInt(qtdRaw)
    : (parseInt(qtdRaw) || 0);

  if (!cliente_id)    { alert(t('mens.alerta_cliente', 'Selecione o cliente.')); return; }
  if (!produto_nome)  { alert(t('mens.alerta_produto', 'Insira o produto/item do plano.')); return; }
  if (qtd_total <= 0) { alert(tipo === 'kg'
      ? 'Insira o peso total em kg (ex: 5.0).'
      : t('mens.alerta_qtd', 'Insira a quantidade total de itens (ex: 22 refeições).')); return; }
  if (valor <= 0)     { alert(t('mens.alerta_valor', 'Insira o valor do plano.')); return; }

  const payload = {
    cliente_id,
    produto_nome,
    quantidade_total: qtd_total,
    valor_plano: valor,
    data_inicio: data_ini,
    data_fim,
    ativo,
    obs: _mensEncodeObs(tipo, nota),
  };

  let error;
  if (id) {
    const planoAtual = _mens_planos.find(p => p.id == id);
    if (planoAtual && qtd_total !== planoAtual.quantidade_total) {
      const diferenca = qtd_total - planoAtual.quantidade_total;
      payload.quantidade_restante = Math.max(0, planoAtual.quantidade_restante + diferenca);
    }
    ({ error } = await supa.from('planos_mensalistas').update(payload).eq('id', id));
  } else {
    payload.quantidade_restante = qtd_total;
    ({ error } = await supa.from('planos_mensalistas').insert([payload]));
  }

  if (error) { alert(t('mens.erro_salvar', 'Erro ao salvar: ') + error.message); return; }
  fecharModal('modal-mens-plano');
  mensCarregarPlanos();
}

// ──────────────────────────────────────────────────────────────
//  REGISTRAR ENTREGA
// ──────────────────────────────────────────────────────────────
function mensAbrirEntrega(planoId) {
  _mens_planoEntregaAtual = _mens_planos.find(p => p.id === planoId);
  if (!_mens_planoEntregaAtual) return;

  const p    = _mens_planoEntregaAtual;
  const tipo = _mensGetTipo(p);
  const isKg = tipo === 'kg';

  document.getElementById('mens-ent-plano-id').value      = p.id;
  document.getElementById('mens-ent-cliente').textContent  = p.clientes?.nome || '—';
  document.getElementById('mens-ent-tel').textContent      = p.clientes?.telefone || '';
  document.getElementById('mens-ent-produto').textContent  = p.produto_nome;
  document.getElementById('mens-ent-obs').value  = '';

  // Saldo
  const fmtRest  = _mensFmtQtd(p.quantidade_restante, tipo);
  const fmtTotal = _mensFmtQtd(p.quantidade_total, tipo);
  document.getElementById('mens-ent-saldo').textContent = `${fmtRest} de ${fmtTotal} ${t('mens.disponiveis', 'disponíveis')}`;

  // Input de quantidade
  const qtdInput = document.getElementById('mens-ent-qtd');
  const qtdLabel = document.getElementById('mens-ent-qtd-label');
  if (isKg) {
    qtdInput.step  = '0.1';
    qtdInput.min   = '0.1';
    qtdInput.value = '0.5';
    qtdInput.max   = _mensIntToKg(p.quantidade_restante);
    if (qtdLabel) qtdLabel.textContent = 'Peso entregue (kg) *';
  } else {
    qtdInput.step  = '1';
    qtdInput.min   = '1';
    qtdInput.value = '1';
    qtdInput.max   = p.quantidade_restante;
    if (qtdLabel) qtdLabel.textContent = t('mens.qtd_entregue', 'Quantidade entregue *');
  }

  // Valor unitário
  const elValor = document.getElementById('mens-ent-valor-unit');
  if (elValor) {
    if (p.quantidade_total > 0) {
      const valorUnit = p.valor_plano / p.quantidade_total;
      if (isKg) {
        elValor.textContent = `Gs ${Math.round(valorUnit * 10).toLocaleString('es-PY')} /kg`;
      } else {
        elValor.textContent = `Gs ${Math.round(valorUnit).toLocaleString('es-PY')} /un`;
      }
    } else {
      elValor.textContent = '';
    }
  }

  document.getElementById('modal-mens-entrega').style.display = 'flex';
  setTimeout(() => document.getElementById('mens-ent-qtd')?.focus(), 100);
}

async function mensSalvarEntrega() {
  const planoId = parseInt(document.getElementById('mens-ent-plano-id').value);
  const obs     = document.getElementById('mens-ent-obs').value.trim();

  const p    = _mens_planos.find(p => p.id === planoId);
  if (!p) return;

  const tipo = _mensGetTipo(p);
  const isKg = tipo === 'kg';

  // Quantidade: se kg, converter input decimal → inteiro de armazenamento
  const qtdRaw = document.getElementById('mens-ent-qtd').value;
  const qtd    = isKg ? _mensKgToInt(qtdRaw) : (parseInt(qtdRaw) || 1);

  if (qtd <= 0) {
    alert(t('mens.alerta_qtd_valida', 'Insira uma quantidade válida.'));
    return;
  }
  if (qtd > p.quantidade_restante) {
    const max = isKg ? _mensIntToKg(p.quantidade_restante) + ' kg' : p.quantidade_restante + ' itens';
    alert(t('mens.alerta_saldo_insuficiente', 'Saldo insuficiente. Máximo disponível: {qtd}.').replace('{qtd}', max));
    return;
  }

  const { data: entrega, error: errEnt } = await supa
    .from('mensalista_entregas')
    .insert([{
      plano_id:     planoId,
      cliente_id:   p.cliente_id,
      produto_nome: p.produto_nome,
      quantidade:   qtd,
      observacoes:  obs || null,
    }])
    .select('id, created_at')
    .single();

  if (errEnt) { alert(t('mens.erro_registrar', 'Erro ao registrar entrega: ') + errEnt.message); return; }

  const novoRestante = p.quantidade_restante - qtd;
  const { error: errUp } = await supa
    .from('planos_mensalistas')
    .update({ quantidade_restante: novoRestante })
    .eq('id', planoId);

  if (errUp) { alert(t('mens.erro_saldo', 'Erro ao atualizar saldo: ') + errUp.message); return; }

  fecharModal('modal-mens-entrega');
  p.quantidade_restante = novoRestante;
  _mensRenderKPIs();
  mensRenderPlanos();

  const novoRestFmt = _mensFmtQtd(novoRestante, tipo);
  const qtdFmt      = _mensFmtQtd(qtd, tipo);
  const imprimir = confirm(
    t('mens.confirm_sucesso', '✅ Entrega registrada com sucesso!\nEntregue: {qtd}\nSaldo restante: {novoRestante}\n\nDeseja imprimir o comprovante para o cliente assinar?')
      .replace('{qtd}', qtdFmt)
      .replace('{novoRestante}', novoRestFmt)
  );
  if (imprimir) {
    mensImprimirComprovante(p, qtd, obs, entrega?.id, entrega?.created_at, novoRestante, tipo);
  }
}

// ──────────────────────────────────────────────────────────────
//  IMPRIMIR COMPROVANTE
// ──────────────────────────────────────────────────────────────
function mensImprimirComprovante(plano, qtd, obs, entregaId, dataEntrega, saldoApos, tipo) {
  tipo = tipo || _mensGetTipo(plano);
  const cliente  = plano.clientes || {};
  const dataFmt  = dataEntrega
    ? new Date(dataEntrega).toLocaleString('es-PY', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : new Date().toLocaleString('es-PY', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const dataFim  = plano.data_fim
    ? new Date(plano.data_fim + 'T12:00:00').toLocaleDateString('es-PY')
    : t('geral.indeterminado', 'Indeterminado');
  const saldoAnt = ((saldoApos !== undefined ? saldoApos : plano.quantidade_restante) + qtd);
  const qtdFmt   = _mensFmtQtd(qtd, tipo);
  const restFmt  = _mensFmtQtd(saldoApos !== undefined ? saldoApos : plano.quantidade_restante, tipo);
  const totFmt   = _mensFmtQtd(plano.quantidade_total, tipo);
  const antFmt   = _mensFmtQtd(saldoAnt, tipo);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${t('mens.ticket_titulo', 'Comprovante Plano Mensal')}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:Arial,sans-serif; font-size:13px; background:#d0d0d0; padding:16px; }
    .ticket { background:#fff; max-width:320px; margin:0 auto; padding:12px; box-shadow:0 4px 12px rgba(0,0,0,0.2); }
    .center { text-align:center; }
    hr { border:none; border-top:1px dashed #000; margin:7px 0; }
    .big  { font-size:16px; font-weight:900; letter-spacing:1px; text-transform:uppercase; }
    .med  { font-size:14px; font-weight:700; }
    .sm   { font-size:11px; color:#555; }
    .row  { display:flex; justify-content:space-between; padding:3px 0; font-size:12px; gap:6px; }
    .row b { color:#111; }
    .saldo-box { background:#f0fdf4; border:1.5px solid #86efac; border-radius:8px; padding:10px 12px; margin:8px 0; text-align:center; }
    .saldo-box .num { font-size:22px; font-weight:900; color:#1a7a2e; }
    .saldo-box .lab { font-size:10px; color:#555; }
    .assinatura { margin-top:24px; text-align:center; }
    .assinatura .linha { border-top:1px solid #000; margin:0 10px 5px; }
    .assinatura .leg { font-size:10px; color:#555; }
    .btn-print { display:block; width:100%; padding:14px; background:#1a7a2e; color:#fff; border:none;
      font-size:15px; font-weight:700; cursor:pointer; margin-top:16px; border-radius:8px; font-family:Arial,sans-serif; }
    @media print {
      body { background:none; padding:0; }
      .btn-print { display:none; }
      .ticket { box-shadow:none; max-width:100%; width:100%; padding:1mm; }
      @page { margin:2mm; size:58mm auto; }
    }
  </style>
</head>
<body>
<div class="ticket">
  <div class="center" style="margin-bottom:6px">
    <div class="big">${_mens_nomeRestaurante || 'RESTAURANTE'}</div>
    <div class="med">${t('mens.ticket_cabecalho', 'COMPROVANTE PLANO MENSAL')}</div>
    <div class="sm">${dataFmt}</div>
    ${entregaId ? `<div class="sm">${t('mens.ticket_entrega', 'Entrega')} #${entregaId}</div>` : ''}
  </div>
  <hr>
  <div class="row"><span>${t('geral.cliente', 'Cliente')}:</span><b>${cliente.nome || '—'}</b></div>
  <div class="row"><span>Tel:</span><b>${cliente.telefone || '—'}</b></div>
  <hr>
  <div class="row"><span>${t('mens.ticket_plano', 'Plano / Item')}:</span><b>${plano.produto_nome}</b></div>
  <div class="row"><span>${t('mens.ticket_entregada', 'Qtd. entregue')}:</span><b>${qtdFmt}</b></div>
  ${obs ? `<div class="row"><span>Obs:</span><span>${obs}</span></div>` : ''}
  <div class="row"><span>${t('mens.ticket_valor', 'Valor do plano')}:</span><b>Gs ${Math.round(plano.valor_plano || 0).toLocaleString('es-PY')}</b></div>
  <div class="row"><span>${t('geral.vencimento', 'Vencimento')}:</span><b>${dataFim}</b></div>
  <hr>
  <div class="saldo-box">
    <div class="lab">${t('mens.ticket_saldo_restante', 'SALDO RESTANTE APÓS ESTA ENTREGA')}</div>
    <div class="num">${restFmt}</div>
    <div class="lab">${t('mens.ticket_contratados', 'de {qtd} contratados').replace('{qtd}', totFmt)}</div>
  </div>
  <div class="center sm" style="margin-top:4px">${t('mens.ticket_saldo_anterior', 'Saldo anterior')}: ${antFmt}</div>
  <hr>
  <div class="assinatura">
    <div style="font-size:11px;color:#555;margin-bottom:16px">
      ${t('mens.ticket_declaracao', 'Confirmo que recebi o(s) item(ns) acima conforme meu plano mensal.')}
    </div>
    <div class="linha"></div>
    <div class="leg">${t('mens.ticket_assinatura', 'Assinatura do cliente')} — ${cliente.nome || '_________________'}</div>
    <div class="leg" style="margin-top:8px">${t('geral.data', 'Data')}: ____/____/________</div>
  </div>
  <hr>
  <div class="center sm">*** ${t('geral.obrigado', 'OBRIGADO')} ***</div>
</div>
<button class="btn-print" onclick="window.print()">${t('mens.ticket_imprimir', '🖨️ IMPRIMIR COMPROVANTE')}</button>
<script>setTimeout(()=>window.print(), 600);</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=420,height=680,scrollbars=yes');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert(t('geral.popup_bloqueado', 'Popup bloqueado. Permita popups para este site para imprimir.'));
  }
}

// ──────────────────────────────────────────────────────────────
//  HISTÓRICO DE ENTREGAS
// ──────────────────────────────────────────────────────────────
async function mensVerHistorico(planoId) {
  const p = _mens_planos.find(p => p.id === planoId);
  if (!p) return;

  const tipo = _mensGetTipo(p);

  const { data } = await supa
    .from('mensalista_entregas')
    .select('*')
    .eq('plano_id', planoId)
    .order('created_at', { ascending: false });

  const entregasTotal = (data || []).reduce((s, e) => s + (e.quantidade || 0), 0);

  const linhas = (data || []).map(e => `
    <tr>
      <td style="font-size:0.8rem;color:#888;white-space:nowrap">
        ${new Date(e.created_at).toLocaleString('es-PY', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
      </td>
      <td style="text-align:center;font-weight:700;color:#1a7a2e">${_mensFmtQtd(e.quantidade, tipo)}</td>
      <td style="font-size:0.8rem;color:#555">${e.observacoes || '—'}</td>
      <td style="text-align:center">
        <button onclick="mensReimprimirEntrega(${e.id}, ${planoId})"
          style="background:#f3f4f6;color:#374151;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:0.75rem">
          🖨️
        </button>
      </td>
    </tr>`
  ).join('') || '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:12px">' + t('mens.nenhuma_entrega', 'Nenhuma entrega registrada ainda') + '</td></tr>';

  document.getElementById('mens-hist-nome').textContent        = p.clientes?.nome || '—';
  document.getElementById('mens-hist-produto').textContent     = p.produto_nome;
  document.getElementById('mens-hist-plano-total').textContent = _mensFmtQtd(p.quantidade_total, tipo);
  document.getElementById('mens-hist-plano-rest').textContent  = _mensFmtQtd(p.quantidade_restante, tipo);
  document.getElementById('mens-hist-entregues').textContent   = _mensFmtQtd(entregasTotal, tipo);
  document.getElementById('mens-hist-tbody').innerHTML         = linhas;
  document.getElementById('modal-mens-hist').style.display     = 'flex';
}

async function mensReimprimirEntrega(entregaId, planoId) {
  const { data: e } = await supa
    .from('mensalista_entregas')
    .select('*')
    .eq('id', entregaId)
    .single();

  const p = _mens_planos.find(p => p.id === planoId);
  if (!e || !p) return;

  const { data: posteriores } = await supa
    .from('mensalista_entregas')
    .select('quantidade')
    .eq('plano_id', planoId)
    .gt('created_at', e.created_at);

  const qtdPosteriores = (posteriores || []).reduce((s, x) => s + (x.quantidade || 0), 0);
  const saldoApos = p.quantidade_restante + qtdPosteriores;

  mensImprimirComprovante(p, e.quantidade, e.observacoes, e.id, e.created_at, saldoApos);
}

// ──────────────────────────────────────────────────────────────
//  UTILITÁRIOS
// ──────────────────────────────────────────────────────────────
function mensFiltrar() {
  mensRenderPlanos();
}

// ──────────────────────────────────────────────────────────────
//  EXCLUIR PLANO
// ──────────────────────────────────────────────────────────────
async function mensExcluirPlano(id) {
  if (!confirm(t('mens.confirm_excluir', 'Excluir este plano? As entregas registradas também serão excluídas.'))) return;
  try {
    await supa.from('mensalista_entregas').delete().eq('plano_id', id);
    const { error } = await supa.from('planos_mensalistas').delete().eq('id', id);
    if (error) { alert(t('mens.erro_excluir', 'Erro ao excluir: ') + error.message); return; }
    await initMensalistas();
  } catch(e) { alert(t('ft.erro', 'Erro: ') + e.message); }
}
