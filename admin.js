// =========================================
// 1. CONSTANTES E INICIALIZAÇÃO
// =========================================
const TAXA_MOTOBOY = 5000;
const AJUDA_COMBUSTIVEL = 20000;
const COORD_LOJA = { lat: -25.2365803, lng: -57.5380816 };

let perfilUsuario = null;
let audioHabilitado = false; // Controle de permissão do navegador

document.addEventListener('DOMContentLoaded', async () => {
  // Recupera a última aba ou define padrão
  let lastTab = localStorage.getItem('lastTab');
  if (!lastTab || !document.getElementById(lastTab)) {
    lastTab = 'pedidos';
  }
  showTab(lastTab);

  // Inicia Monitoramento Realtime
  iniciarRealtime();

  // === SISTEMA DE AUTO-REFRESH (10 SEGUNDOS) ===
  // Backup caso o Realtime falhe
  setInterval(() => {
    const abaAtual = localStorage.getItem('lastTab');
    // true = modo silencioso (sem recarregar som se já estiver tocando)
    if (abaAtual === 'pedidos') carregarPedidos(true);
    if (abaAtual === 'cozinha') carregarCozinha();
    if (abaAtual === 'pdv') carregarMonitorMesas();
    // if (abaAtual === 'financeiro') calcularFinanceiro();
    if (abaAtual === 'dashboard') carregarDashboard();
  }, 10000);

  // Verifica Login e Permissões
  if (typeof checkUser === 'function') {
    const session = await checkUser();
    const { data: perfil } = await supa
      .from('perfis_acesso')
      .select('cargo')
      .eq('id', session.user.id)
      .single();

    perfilUsuario = perfil ? perfil.cargo : 'gerente';
    const elCargo = document.getElementById('user-cargo');
    if (elCargo) elCargo.innerText = perfilUsuario.toUpperCase();

    if (perfilUsuario === 'dono') {
      const menuFin = document.getElementById('menu-financeiro');
      if (menuFin) menuFin.style.display = 'flex';
    }

    carregarDashboard();
    carregarMotoboysSelect();
  }

  window.addEventListener('resize', () => {
    if (document.getElementById('pdv')?.classList.contains('active')) pdvIniciarTabs();
  });

  // === DESBLOQUEIO DE SOM — AudioContext (sem AbortError) ===
  // play().then(pause()) SEMPRE gera AbortError no Chrome. Usamos buffer silencioso.
  document.body.addEventListener(
    'click',
    () => {
      if (!audioHabilitado) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.001, ctx.sampleRate);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
          src.onended = () => {
            audioHabilitado = true;
            ctx.close();
          };
        } catch (e) {
          audioHabilitado = true;
        }
      }
    },
    { once: true },
  );
});

// selecionarTipo do Gemini removido — o sistema usa selecionarTipoBuilder() abaixo

// =========================================
// 2. CONTROLE DE ABAS
// =========================================
function showTab(tabId, event) {
  console.log('Tentando abrir aba:', tabId);

  // 1. O 'de-para' para garantir que IDs como 'categorias' ou 'motoboys'
  // abram a aba pai correta no seu novo HTML
  let realTabId = tabId;
  if (tabId === 'categorias' || tabId === 'motoboys') {
    realTabId = 'produtos';
  }

  let target = document.getElementById(realTabId);
  if (!target) {
    target = document.getElementById('pedidos');
    realTabId = 'pedidos';
  }

  localStorage.setItem('lastTab', realTabId);

  // 2. Reset visual
  document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach((m) => m.classList.remove('active'));

  // 3. Ativa a aba pai
  target.classList.add('active');

  // 4. Ativa o botão no menu lateral
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }

  // 5. PULO DO GATO: Se a aba for produtos, categorias ou motoboys,
  // precisamos ativar a SUB-ABA correspondente
  if (realTabId === 'produtos') {
    if (tabId === 'categorias') showSubTab('lista-categorias-wrapper');
    else if (tabId === 'motoboys') showSubTab('lista-motos-wrapper');
    else showSubTab('lista-produtos-wrapper'); // Padrão
  }

  // 6. Carregamento de dados
  if (realTabId === 'pedidos') carregarPedidos();
  if (realTabId === 'cozinha') carregarCozinha();
  if (realTabId === 'financeiro') calcularFinanceiro();
  if (realTabId === 'dashboard') carregarDashboard();
  if (realTabId === 'pdv') carregarPDV();
  if (realTabId === 'equipe') carregarEquipe();
  if (realTabId === 'configuracoes') {
    carregarConfiguracoes();
    if (perfilUsuario === 'dono' || perfilUsuario === 'gerente') {
      carregarCupons();
    }
  }
}

function showSubTab(subId) {
  console.log('Alternando para sub-aba:', subId);

  // 1. Seleciona todas as sub-abas e esconde TODAS
  const subtabs = document.querySelectorAll('.subtab-content');
  subtabs.forEach((tab) => {
    tab.style.display = 'none';
  });

  // 2. Mostra apenas a que foi clicada
  const target = document.getElementById(subId);
  if (target) {
    target.style.display = 'block';
  }

  // 3. Carrega os dados específicos
  if (subId === 'lista-produtos-wrapper') carregarProdutos();
  if (subId === 'lista-categorias-wrapper') carregarCategorias();
  if (subId === 'lista-motos-wrapper') carregarMotoboys();
}

// =========================================
// 3. REALTIME E ALARME (LOOP)
// =========================================
function iniciarRealtime() {
  supa
    .channel('tabela-pedidos-admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
      // Se entrou pedido novo pendente, tenta tocar o som
      if (payload.eventType === 'INSERT' && payload.new.status === 'pendente') {
        tocarAlarme();
      }
      // Atualiza a tela atual
      const abaAtual = localStorage.getItem('lastTab');
      if (abaAtual === 'pedidos') carregarPedidos();
      if (abaAtual === 'cozinha') carregarCozinha();
      if (abaAtual === 'dashboard') carregarDashboard();
    })
    .subscribe();
}

let loopAlarme = null;
let _alarmePlaying = false;

function tocarAlarme() {
  const audio = document.getElementById('som-campainha');
  if (!audio || loopAlarme) return; // já está tocando

  const _tocar = () => {
    if (!_alarmePlaying) {
      _alarmePlaying = true;
      audio.currentTime = 0;
      audio
        .play()
        .then(() => {
          _alarmePlaying = false;
        })
        .catch(() => {
          _alarmePlaying = false;
        });
    }
  };

  _tocar();
  loopAlarme = setInterval(_tocar, 4000);
}

function pararAlarme() {
  if (loopAlarme) {
    clearInterval(loopAlarme);
    loopAlarme = null;
  }
  const audio = document.getElementById('som-campainha');
  if (audio && !audio.paused) {
    audio.pause();
    audio.currentTime = 0;
  }
  _alarmePlaying = false;
}

// =========================================
// 4. GESTÃO DE PEDIDOS (COM IMPRESSÃO)
// =========================================
async function carregarPedidos(silencioso = false) {
  // === TRAVA DE SEGURANÇA (Para não limpar sua seleção) ===
  if (silencioso) {
    const selecionados = document.querySelectorAll('.check-pedido:checked');
    if (selecionados.length > 0) {
      console.log('Atualização pausada: Usuário está montando rota.');
      return;
    }
  }

  // 1. Som e Notificação
  const { count } = await supa
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pendente');

  if (count > 0) {
    if (!silencioso && typeof tocarAlarme === 'function') tocarAlarme();
  } else {
    if (typeof pararAlarme === 'function') pararAlarme();
  }

  // 2. Busca Dados - inclui cancelamento_solicitado para badge
  const { data: pedidos } = await supa
    .from('pedidos')
    .select('*')
    .or('status.eq.pendente,status.eq.pronto_entrega,status.eq.saiu_entrega')
    .order('id', { ascending: false });

  const tbody = document.getElementById('lista-pedidos');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Container de cards mobile
  const cardsDiv = document.getElementById('lista-pedidos-cards');
  if (cardsDiv) cardsDiv.innerHTML = '';

  // Badge de cancelamento pendente para o dono
  const badgeCancelPendente =
    perfilUsuario === 'dono'
      ? `<span style="background:#e74c3c;color:white;font-size:0.7rem;padding:2px 7px;border-radius:10px;margin-left:6px;vertical-align:middle;">CANC. PENDENTE</span>`
      : '';

  if (pedidos && pedidos.length > 0) {
    pedidos.forEach((p) => {
      let acoes = '';
      let linhaCor = '';
      let checkbox = '';

      const btnPrint = `<button class="btn btn-sm btn-info" onclick="imprimirPedido(${p.id})" title="Imprimir"><i class="fas fa-print"></i></button>`;
      const temSolicitacaoCancelamento = p.cancelamento_solicitado;

      // Badge cancelamento (só dono vê)
      const badgeCancelRow =
        temSolicitacaoCancelamento && perfilUsuario === 'dono'
          ? `<div style="background:#fff0f0;border:1px solid #e74c3c;border-radius:6px;padding:4px 8px;font-size:0.75rem;margin-top:4px;color:#c0392b">
                     🚫 <strong>Cancelamento solicitado:</strong> ${p.cancelamento_motivo || '-'}
                     <br><button class="btn btn-danger btn-sm" onclick="aprovarCancelamento(${p.id})" style="margin-top:4px;font-size:0.7rem">✅ Aprovar</button>
                     <button class="btn btn-secondary btn-sm" onclick="negarCancelamento(${p.id})" style="margin-top:4px;font-size:0.7rem">❌ Negar</button>
                   </div>`
          : '';

      // PENDENTE
      if (p.status === 'pendente') {
        linhaCor = 'background-color: #fff3cd;';
        acoes = `
                    ${btnPrint}
                    <button class="btn btn-success btn-sm" onclick="mudarStatus(${p.id}, 'em_preparo')"><i class="fas fa-fire"></i> Cozinha</button>
                    ${
                      perfilUsuario === 'dono'
                        ? `<button class="btn btn-danger btn-sm" onclick="mudarStatus(${p.id}, 'cancelado')"><i class="fas fa-times"></i></button>`
                        : `<button class="btn btn-warning btn-sm" onclick="solicitarCancelamento(${p.id})"><i class="fas fa-ban"></i> Solicitar Cancelamento</button>`
                    }
                `;
      }

      if (p.status === 'saiu_entrega') {
        linhaCor = 'background-color: #ddf0ff;';
        const _btnCancelSaiu =
          perfilUsuario === 'dono'
            ? `<button class="btn btn-danger btn-sm" onclick="mudarStatus(${p.id}, 'cancelado')" title="Cancelar"><i class="fas fa-times"></i></button>`
            : !temSolicitacaoCancelamento
              ? `<button class="btn btn-warning btn-sm" onclick="solicitarCancelamento(${p.id})" title="Solicitar cancelamento"><i class="fas fa-ban"></i> Cancelar</button>`
              : `<span style="font-size:0.72rem;color:#e67e22;font-weight:600">⏳ Cancel. Pendente</span>`;
        acoes = `${btnPrint} <button class="btn btn-success btn-sm" onclick="confirmarEntregaFuncionario(${p.id})"><i class="fas fa-check-circle"></i> Confirmar</button> ${_btnCancelSaiu}`;
      }
      // PRONTO
      else if (p.status === 'pronto_entrega') {
        linhaCor = 'background-color: #d4edda;';

        // Botão cancelamento para pronto_entrega
        const btnCancelar =
          perfilUsuario === 'dono'
            ? `<button class="btn btn-danger btn-sm" onclick="mudarStatus(${p.id}, 'cancelado')" title="Cancelar"><i class="fas fa-times"></i></button>`
            : !temSolicitacaoCancelamento
              ? `<button class="btn btn-warning btn-sm" onclick="solicitarCancelamento(${p.id})"><i class="fas fa-ban"></i></button>`
              : '';

        if (p.tipo_entrega === 'delivery') {
          const jsonSeguro = encodeURIComponent(JSON.stringify(p));
          checkbox = `<input type="checkbox" class="check-pedido" value="${jsonSeguro}" style="width:20px; height:20px;">`;
          acoes = `${btnPrint} ${btnCancelar} <span style="color:#155724; font-weight:bold; font-size:0.9rem; margin-left:5px;"><i class="fas fa-motorcycle"></i> Aguardando Rota</span>`;
        } else {
          const icone = p.tipo_entrega === 'balcao' ? 'fa-store' : 'fa-hand-holding';
          const tipo = p.tipo_entrega === 'balcao' ? 'BALCÃO' : 'RETIRADA';
          checkbox = `<div style="text-align:center; color:#e67e22; font-size:1.2rem"><i class="fas ${icone}" title="${tipo}"></i></div>`;
          acoes = `${btnPrint} ${btnCancelar} <button class="btn btn-success btn-sm" onclick="finalizarMesa(${p.id})">Baixar</button>`;
        }
      }

      // Linha da tabela (desktop)
      tbody.innerHTML += `
                <tr style="${linhaCor}">
                    <td style="text-align:center; vertical-align: middle;">${checkbox}</td>
                    <td><strong>#${p.uid_temporal || p.id}</strong></td>
                    <td>
                        <div style="font-weight:bold">${p.cliente_nome || 'Cliente'}</div>
                        <div style="font-size:0.8rem; color:#666">${p.endereco_entrega || ''}</div>
                        ${badgeCancelRow}
                    </td>
                    <td><span class="status-badge st-${p.status}">${p.status.toUpperCase().replace('_', ' ')}</span>
                    ${temSolicitacaoCancelamento && perfilUsuario === 'dono' ? badgeCancelPendente : ''}</td>
                    <td>Gs ${(p.total_geral || 0).toLocaleString('es-PY')}</td>
                    <td class="actions-cell">${acoes}</td>
                </tr>`;

      // Card mobile
      if (cardsDiv) {
        const statusLabel =
          p.status === 'pendente'
            ? '🔔 Novo'
            : p.status === 'em_preparo'
              ? '🔥 Na Cozinha'
              : p.status === 'pronto_entrega'
                ? '✅ Pronto'
                : p.status.replace('_', ' ');
        const cardBg =
          p.status === 'pendente'
            ? '#fff3cd'
            : p.status === 'pronto_entrega'
              ? '#d4edda'
              : p.status === 'saiu_entrega'
                ? '#ddf0ff'
                : '#fff';
        const jsonSeguro = encodeURIComponent(JSON.stringify(p));
        let cardAcoes = '';
        const cardBgSaiu = p.status === 'saiu_entrega' ? '#ddf0ff' : '';
        if (p.status === 'saiu_entrega') {
          const _btnCancelSaiuCard =
            perfilUsuario === 'dono'
              ? `<button class="btn btn-danger btn-sm" onclick="mudarStatus(${p.id}, 'cancelado')"><i class="fas fa-times"></i></button>`
              : !temSolicitacaoCancelamento
                ? `<button class="btn btn-warning btn-sm" onclick="solicitarCancelamento(${p.id})"><i class="fas fa-ban"></i> Cancelar</button>`
                : `<span style="font-size:0.7rem;color:#e67e22;font-weight:600">⏳ Pendente</span>`;
          cardAcoes = `
                        <button class="btn btn-success btn-sm" onclick="confirmarEntregaFuncionario(${p.id})"><i class="fas fa-check-circle"></i> Confirmar</button>
                        <button class="btn btn-info btn-sm" onclick="imprimirPedido(${p.id})"><i class="fas fa-print"></i> Imprimir</button>
                        ${_btnCancelSaiuCard}`;
        } else if (p.status === 'pendente') {
          cardAcoes = `
                        <button class="btn btn-success btn-sm" onclick="mudarStatus(${p.id}, 'em_preparo')"><i class="fas fa-fire"></i> Cozinha</button>
                        <button class="btn btn-info btn-sm" onclick="imprimirPedido(${p.id})"><i class="fas fa-print"></i> Imprimir</button>
                        ${
                          perfilUsuario === 'dono'
                            ? `<button class="btn btn-danger btn-sm" onclick="mudarStatus(${p.id}, 'cancelado')"><i class="fas fa-times"></i></button>`
                            : `<button class="btn btn-warning btn-sm" onclick="solicitarCancelamento(${p.id})"><i class="fas fa-ban"></i> Cancelar</button>`
                        }`;
        } else if (p.status === 'pronto_entrega' && p.tipo_entrega === 'balcao') {
          const _btnCancelBalcao =
            perfilUsuario === 'dono'
              ? `<button class="btn btn-danger btn-sm" onclick="mudarStatus(${p.id}, 'cancelado')"><i class="fas fa-times"></i></button>`
              : !temSolicitacaoCancelamento
                ? `<button class="btn btn-warning btn-sm" onclick="solicitarCancelamento(${p.id})"><i class="fas fa-ban"></i> Cancelar</button>`
                : '';
          cardAcoes = `<button class="btn btn-success btn-sm" onclick="finalizarMesa(${p.id})"><i class="fas fa-check"></i> Entregar</button>
                        <button class="btn btn-info btn-sm" onclick="imprimirPedido(${p.id})"><i class="fas fa-print"></i> Imprimir</button>
                        ${_btnCancelBalcao}`;
        } else if (p.status === 'pronto_entrega') {
          const _btnCancelPronto =
            perfilUsuario === 'dono'
              ? `<button class="btn btn-danger btn-sm" onclick="mudarStatus(${p.id}, 'cancelado')"><i class="fas fa-times"></i></button>`
              : !temSolicitacaoCancelamento
                ? `<button class="btn btn-warning btn-sm" onclick="solicitarCancelamento(${p.id})"><i class="fas fa-ban"></i></button>`
                : '';
          cardAcoes = `<label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:#155724;font-weight:600;">
                        <input type="checkbox" class="check-pedido" value="${jsonSeguro}" style="width:18px;height:18px;"> Incluir na Rota
                    </label>
                    <button class="btn btn-info btn-sm" onclick="imprimirPedido(${p.id})"><i class="fas fa-print"></i> Imprimir</button>
                    ${_btnCancelPronto}`;
        }

        const badgeCancelCard =
          temSolicitacaoCancelamento && perfilUsuario === 'dono'
            ? `
                    <div style="background:#fff0f0;border:1px solid #e74c3c;border-radius:6px;padding:6px 8px;font-size:0.75rem;color:#c0392b;margin-top:6px">
                        🚫 Cancel. solicitado: ${p.cancelamento_motivo || '-'}
                        <br><button class="btn btn-danger btn-sm" onclick="aprovarCancelamento(${p.id})" style="font-size:0.7rem;margin-top:4px">✅ Aprovar</button>
                        <button class="btn btn-secondary btn-sm" onclick="negarCancelamento(${p.id})" style="font-size:0.7rem;margin-top:4px">❌ Negar</button>
                    </div>`
            : '';

        cardsDiv.innerHTML += `
                    <div style="background:${cardBg}; border-radius:10px; padding:14px 16px; box-shadow:0 2px 8px rgba(0,0,0,0.07); border-left:4px solid ${p.status === 'pendente' ? '#f59e0b' : p.status === 'pronto_entrega' ? '#22c55e' : p.status === 'saiu_entrega' ? '#3498db' : '#94a3b8'};">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                            <div>
                                <div style="font-weight:700;font-size:1rem">#${p.uid_temporal || p.id} — ${p.cliente_nome || 'Cliente'}</div>
                                <div style="font-size:0.78rem;color:#666;margin-top:2px">${p.endereco_entrega || (p.tipo_entrega === 'balcao' ? '🏪 Balcão' : '')}</div>
                            </div>
                            <span class="status-badge st-${p.status}" style="font-size:0.7rem">${statusLabel}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <strong style="font-size:1rem;color:var(--dark)">Gs ${(p.total_geral || 0).toLocaleString('es-PY')}</strong>
                            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${cardAcoes}</div>
                        </div>
                        ${badgeCancelCard}
                    </div>`;
      }
    });
  } else {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;">Nenhum pedido ativo.</td></tr>';
    if (cardsDiv)
      cardsDiv.innerHTML =
        '<div style="text-align:center;padding:30px;color:#aaa;font-size:0.95rem">Nenhum pedido ativo no momento.</div>';
  }
}

// === CANCELAMENTO WORKFLOW ===
async function solicitarCancelamento(pedidoId) {
  const motivo = prompt('🚫 Solicitar cancelamento\n\nInforme o motivo do cancelamento:');
  if (!motivo || !motivo.trim()) return;

  const user = await supa.auth.getUser();
  const email = user?.data?.user?.email || 'desconhecido';

  const { error } = await supa
    .from('pedidos')
    .update({
      cancelamento_solicitado: true,
      cancelamento_motivo: motivo.trim(),
      cancelamento_solicitado_por: email,
      cancelamento_solicitado_em: new Date().toISOString(),
    })
    .eq('id', pedidoId);

  if (error) {
    alert('❌ Erro: ' + error.message);
    return;
  }

  // Registra na tabela de solicitações
  await supa.from('solicitacoes_cancelamento').insert([
    {
      pedido_id: pedidoId,
      motivo: motivo.trim(),
      solicitado_por: email,
    },
  ]);

  alert('✅ Solicitação enviada! O dono será notificado para aprovar.');
  carregarPedidos();
}

async function aprovarCancelamento(pedidoId) {
  if (!confirm('⚠️ Confirma o CANCELAMENTO deste pedido?\nEsta ação não pode ser desfeita.'))
    return;

  const user = await supa.auth.getUser();
  const email = user?.data?.user?.email || 'dono';

  const { error } = await supa
    .from('pedidos')
    .update({
      status: 'cancelado',
      cancelamento_aprovado_por: email,
      cancelamento_aprovado_em: new Date().toISOString(),
    })
    .eq('id', pedidoId);

  if (error) {
    alert('❌ Erro: ' + error.message);
    return;
  }

  // Marca como aprovada na tabela de solicitações
  await supa
    .from('solicitacoes_cancelamento')
    .update({ aprovado: true, aprovado_por: email, aprovado_em: new Date().toISOString() })
    .eq('pedido_id', pedidoId)
    .eq('aprovado', false);

  alert('✅ Pedido cancelado com sucesso!');
  carregarPedidos();
}

async function negarCancelamento(pedidoId) {
  const obs = prompt('Motivo para NEGAR o cancelamento (opcional):') || '';
  const user = await supa.auth.getUser();
  const email = user?.data?.user?.email || 'dono';

  await supa
    .from('pedidos')
    .update({
      cancelamento_solicitado: false,
      cancelamento_motivo: null,
    })
    .eq('id', pedidoId);

  await supa
    .from('solicitacoes_cancelamento')
    .update({
      negado: true,
      negado_por: email,
      negado_em: new Date().toISOString(),
      observacoes: obs,
    })
    .eq('pedido_id', pedidoId)
    .eq('aprovado', false);

  alert('✅ Solicitação de cancelamento negada.');
  carregarPedidos();
}

async function mudarStatus(id, novoStatus) {
  // Registra o timestamp do novo status no campo correspondente
  const camposTimestamp = {
    em_preparo: ['tempo_confirmado', 'tempo_preparo_iniciado'], // aceita E começa a preparar
    pronto_entrega: 'tempo_pronto',
    saiu_entrega: 'tempo_saiu_entrega',
    entregue: 'tempo_entregue',
  };

  const updateData = { status: novoStatus };
  const campos = camposTimestamp[novoStatus];
  if (campos) {
    const agora = new Date().toISOString();
    if (Array.isArray(campos)) campos.forEach((c) => (updateData[c] = agora));
    else updateData[campos] = agora;
  }
  // Status 'cancelado' mantém os timestamps existentes

  const { error } = await supa.from('pedidos').update(updateData).eq('id', id);
  if (error) {
    console.error('Erro ao atualizar:', error);
    alert('Erro ao mudar status');
    return;
  }

  if (typeof pararAlarme === 'function') pararAlarme();

  const abaAtual = localStorage.getItem('lastTab');
  if (abaAtual === 'cozinha') carregarCozinha();
  else if (abaAtual === 'pedidos') carregarPedidos();
  else if (abaAtual === 'pdv') carregarMonitorMesas();
}

// === FUNÇÃO DE IMPRESSÃO (RESTAURADA) ===
async function imprimirPedido(id) {
  const { data: p } = await supa.from('pedidos').select('*').eq('id', id).single();
  if (!p) return;

  const dados = {
    id: p.id,
    cliente: { nome: p.cliente_nome, tel: p.cliente_telefone },
    entrega: { tipo: p.tipo_entrega, ref: p.endereco_entrega },
    // Imprime apenas itens pendentes (sem status ou status 'pendente')
    itens: (p.itens || [])
      .filter((i) => !i.status_item || i.status_item === 'pendente')
      .map((i) => ({
        q: i.qtd || i.q || 1,
        n: i.nome || i.n,
        p: i.preco || i.p || 0,
        m: i.montagem || i.m,
        o: i.obs || i.o,
      })),
    valores: { sub: p.subtotal, frete: p.frete_cobrado_cliente, total: p.total_geral },
    pagamento: { metodo: p.forma_pagamento, obs: p.obs_pagamento },
    factura: p.dados_factura,
    data: new Date(p.created_at || Date.now()).toLocaleString('pt-BR'),
  };

  const jsonStr = JSON.stringify(dados);
  // Base64 URL-safe: substitui +, / e = que quebram a URL
  const base64 = btoa(unescape(encodeURIComponent(jsonStr)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Abre a janela de impressão
  window.open(`imprimir.html?d=${base64}`, 'Print', 'width=420,height=700');
}

// =========================================
// 5. TELA COZINHA
// =========================================
async function carregarCozinha() {
  const { data: pedidos } = await supa
    .from('pedidos')
    .select('*')
    .eq('status', 'em_preparo')
    .order('id', { ascending: true });

  const grid = document.getElementById('grid-cozinha');
  if (!grid) return;

  grid.innerHTML = '';

  if (!pedidos || pedidos.length === 0) {
    grid.innerHTML =
      '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#aaa; font-size:1.5rem;">👨‍🍳 Cozinha Livre!</div>';
    return;
  }

  pedidos.forEach((p) => {
    const dataOriginal = p.created_at || p.data_pedido || new Date();
    const horaPedido = new Date(dataOriginal).getTime();
    const agora = new Date().getTime();

    let minutos = 0;
    if (!isNaN(horaPedido)) {
      minutos = Math.floor((agora - horaPedido) / 60000);
    } else {
      console.warn(`Pedido ${p.id} com data inválida:`, dataOriginal);
    }

    let corTempo = '#2ecc71';
    if (minutos > 20) corTempo = '#f1c40f';
    if (minutos > 40) corTempo = '#e74c3c';

    // === Filtra apenas itens PENDENTES para a cozinha ===
    // Itens sem status_item são tratados como pendente (retrocompatibilidade)
    const itensPendentes = (p.itens || []).filter(
      (item) => !item.status_item || item.status_item === 'pendente'
    );

    // Se não há nenhum item pendente neste pedido, pula o card
    if (itensPendentes.length === 0) return;

    let itensHtml = '';
    itensPendentes.forEach((item) => {
        // Suporta {qtd, nome, montagem, obs} E {q, n, m, o}
        const quantidade = item.qtd || item.q || 1;
        const nomeItem = item.nome || item.n || 'Item';
        const observacao = item.obs || item.o || '';
        const montagemArray = item.montagem || item.m || [];

        const obs = observacao
          ? `<div style="color:#e74c3c; font-size:0.85rem">⚠️ ${observacao}</div>`
          : '';
        const listaMontagem = Array.isArray(montagemArray) ? montagemArray.join(', ') : '';
        const montagem = listaMontagem
          ? `<div style="font-size:0.8rem; color:#666; margin-left:10px;">+ ${listaMontagem}</div>`
          : '';

        itensHtml += `
                    <li style="border-bottom:1px dashed #444; padding:5px 0;">
                        <strong>${quantidade}x</strong> ${nomeItem}
                        ${montagem}
                        ${obs}
                    </li>
                `;
    });

    grid.innerHTML += `
            <div class="kds-card">
                <div class="kds-header" style="background:${corTempo}; color:#fff; padding:10px; border-radius:5px 5px 0 0; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; font-size:1.1rem">#${p.uid_temporal || p.id}</span>
                    <span>⏱️ ${minutos} min</span>
                </div>
                <div style="padding:10px;">
                    <div style="font-weight:bold; font-size:1.1rem; margin-bottom:10px; color:#2c3e50">
                        ${p.cliente_nome || 'Cliente'}
                    </div>
                    <ul style="list-style:none; padding:0; margin:0; color:#333;">
                        ${itensHtml}
                    </ul>
                </div>
                <div style="padding:10px; margin-top:auto;">
                    <button class="btn btn-success" style="width:100%; padding:15px; font-size:1.1rem;" onclick="mudarStatus(${p.id}, 'pronto_entrega')">
                        ✅ PRONTO
                    </button>
                </div>
            </div>
        `;
  });
}

// =========================================
// 6. FINANCEIRO
// =========================================
// Estado persistente do último cálculo financeiro
let _caixaState = {
  faturamento: 0,
  custoEntregas: 0,
  totalSaidas: 0,
  totalEntradas: 0,
  totalPix: 0,
  totalTransf: 0,
  totalCartao: 0,
  totalEfetivo: 0,
  qtdPedidos: 0,
};

async function calcularFinanceiro() {
  const abaFin = document.getElementById('financeiro');
  if (!abaFin || !abaFin.classList.contains('active')) return;

  console.log('💰 Calculando Financeiro...');

  // Pega elementos do DOM
  const elInicio = document.getElementById('fin-inicio');
  const elFim = document.getElementById('fin-fim');
  const elTipo = document.getElementById('fin-tipo');
  const elFactura = document.getElementById('fin-factura'); // NOVO filtro

  if (!elInicio || !elFim || !elTipo) return;

  const inicio = elInicio.value;
  const fim = elFim.value;
  const tipoFiltro = elTipo.value;
  const facturaFiltro = elFactura ? elFactura.value : 'todos'; // NOVO

  let dataInicio, dataFim;

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');

  // Define período
  if (inicio && fim) {
    dataInicio = inicio + ' 00:00:00';
    dataFim = fim + ' 23:59:59';
  } else {
    if (!inicio) elInicio.value = `${ano}-${mes}-${dia}`;
    if (!fim) elFim.value = `${ano}-${mes}-${dia}`;

    dataInicio = `${ano}-${mes}-${dia} 00:00:00`;
    dataFim = `${ano}-${mes}-${dia} 23:59:59`;
  }

  // ========================================
  // 1. BUSCA PEDIDOS (CORRIGIDO)
  // ========================================
  let query = supa
    .from('pedidos')
    .select('*, motoboys(nome)') // JOIN para pegar nome do motoboy
    .eq('status', 'entregue') // ← CORRIGIDO: só vendas finalizadas
    .gte('created_at', dataInicio)
    .lte('created_at', dataFim);

  // Filtro por forma de pagamento
  if (tipoFiltro !== 'todos') {
    query = query.eq('forma_pagamento', tipoFiltro); // ← CORRIGIDO: campo certo
  }

  const { data: pedidos, error } = await query;
  if (error) {
    console.error('Erro ao buscar pedidos:', error);
    return;
  }

  // ========================================
  // 2. FILTRA FACTURA (SE NECESSÁRIO)
  // ========================================
  let pedidosFiltrados = pedidos || [];

  if (facturaFiltro === 'com_factura') {
    pedidosFiltrados = pedidosFiltrados.filter(
      (p) => p.dados_factura && (p.dados_factura.ruc || p.dados_factura.ci),
    );
  } else if (facturaFiltro === 'sem_factura') {
    pedidosFiltrados = pedidosFiltrados.filter(
      (p) => !p.dados_factura || (!p.dados_factura.ruc && !p.dados_factura.ci),
    );
  }

  // ========================================
  // 3. BUSCA MOVIMENTAÇÕES DE CAIXA
  // ========================================
  const { data: caixa } = await supa
    .from('movimentacoes_caixa')
    .select('*')
    .gte('created_at', dataInicio)
    .lte('created_at', dataFim);

  // ========================================
  // 4. CÁLCULOS
  // ========================================
  const safeNum = (v) => {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    let limpo = v
      .toString()
      .replace(/[^\d,-]/g, '')
      .replace(',', '.');
    return parseFloat(limpo) || 0;
  };
  const fmt = (n) => 'Gs ' + n.toLocaleString('es-PY');

  let faturamento = 0;
  let totalPix = 0;
  let totalTransf = 0;
  let totalCartao = 0;
  let totalEfetivo = 0;
  let custoEntregas = 0;
  let qtdPedidos = 0;
  const motoMap = {};

  pedidosFiltrados.forEach((p) => {
    const valorPedido = safeNum(p.total_geral);
    faturamento += valorPedido;
    qtdPedidos++;

    const pag = (p.forma_pagamento || '').toLowerCase();

    if (pag.includes('pix')) totalPix += valorPedido;
    else if (pag.includes('transfer')) totalTransf += valorPedido;
    else if (pag.includes('cartao') || pag.includes('cartão')) totalCartao += valorPedido;
    else if (pag.includes('efetivo') || pag.includes('dinheiro')) totalEfetivo += valorPedido;

    if (p.tipo_entrega === 'delivery') {
      custoEntregas += typeof TAXA_MOTOBOY !== 'undefined' ? TAXA_MOTOBOY : 5000;
      const nomeMoto = p.motoboys?.nome || 'Sem Motoboy';
      if (!motoMap[nomeMoto]) {
        motoMap[nomeMoto] = 0;
        // Adiciona combustível 1× por motoboy único no período
        custoEntregas += typeof AJUDA_COMBUSTIVEL !== 'undefined' ? AJUDA_COMBUSTIVEL : 20000;
      }
      motoMap[nomeMoto]++;
    }
  });

  // Movimentações de caixa (despesas e sangrias reduzem; suprimentos/abertura aumentam)
  let totalSaidas = 0; // despesa + sangria
  let totalEntradas = 0; // suprimento + abertura
  if (caixa) {
    caixa.forEach((c) => {
      const v = safeNum(c.valor);
      if (c.tipo === 'despesa' || c.tipo === 'sangria') totalSaidas += v;
      if (c.tipo === 'suprimento' || c.tipo === 'abertura') totalEntradas += v;
    });
  }

  // Guarda estado para fecharCaixaResumo()
  _caixaState = {
    faturamento,
    custoEntregas,
    totalSaidas,
    totalEntradas,
    totalPix,
    totalTransf,
    totalCartao,
    totalEfetivo,
    qtdPedidos,
  };

  // ========================================
  // 5. ATUALIZA INTERFACE
  // ========================================
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  setVal('card-faturamento', fmt(faturamento));
  setVal('card-custo-moto', fmt(custoEntregas));

  const lucro = faturamento + totalEntradas - custoEntregas - totalSaidas;
  setVal('card-lucro', fmt(lucro));

  setVal('total-pix', fmt(totalPix));
  setVal('total-transf', fmt(totalTransf)); // Agora funciona
  setVal('total-cartao', fmt(totalCartao));
  setVal('total-efetivo', fmt(totalEfetivo));

  // NOVOS campos (se existirem no HTML)
  setVal('card-qtd-pedidos', qtdPedidos);
  const ticketMedio = qtdPedidos > 0 ? faturamento / qtdPedidos : 0;
  setVal('card-ticket-medio', fmt(ticketMedio));

  // ========================================
  // 6. TABELA MOTOBOYS
  // ========================================
  const tbodyMoto = document.getElementById('lista-financeiro-motoboys');
  if (tbodyMoto) {
    tbodyMoto.innerHTML = '';
    if (Object.keys(motoMap).length === 0) {
      tbodyMoto.innerHTML =
        '<tr><td colspan="4" style="text-align:center; color:#999">Nenhuma entrega no período</td></tr>';
    } else {
      for (const [nome, qtd] of Object.entries(motoMap)) {
        const taxaMoto = typeof TAXA_MOTOBOY !== 'undefined' ? TAXA_MOTOBOY : 5000;
        const combustivel = typeof AJUDA_COMBUSTIVEL !== 'undefined' ? AJUDA_COMBUSTIVEL : 20000;
        const totalEntregas = qtd * taxaMoto;
        const totalMoto = totalEntregas + combustivel; // combustível: 1x por motoboy por dia
        tbodyMoto.innerHTML += `
                    <tr>
                        <td data-label="Nome">${nome}</td>
                        <td data-label="Entregas">${qtd}</td>
                        <td data-label="Taxa">Gs ${taxaMoto.toLocaleString('es-PY')} × ${qtd} + comb. Gs ${combustivel.toLocaleString('es-PY')}</td>
                        <td data-label="Total a Pagar"><strong>Gs ${totalMoto.toLocaleString('es-PY')}</strong></td>
                    </tr>`;
      }
    }
  }

  console.log('✅ Financeiro atualizado:', {
    pedidos: qtdPedidos,
    faturamento: fmt(faturamento),
    lucro: fmt(lucro),
  });
}

async function exportarFinanceiro() {
  // 1. Pega os mesmos filtros da tela
  const elInicio = document.getElementById('fin-inicio');
  const elFim = document.getElementById('fin-fim');
  const elTipo = document.getElementById('fin-tipo');
  const elFactura = document.getElementById('fin-factura');

  const inicio = elInicio.value;
  const fim = elFim.value;
  const tipoFiltro = elTipo ? elTipo.value : 'todos';
  const facturaFiltro = elFactura ? elFactura.value : 'todos';

  // Define período
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');

  let dataInicio, dataFim;
  if (inicio && fim) {
    dataInicio = inicio + ' 00:00:00';
    dataFim = fim + ' 23:59:59';
  } else {
    dataInicio = `${ano}-${mes}-${dia} 00:00:00`;
    dataFim = `${ano}-${mes}-${dia} 23:59:59`;
  }

  // 2. Busca os dados
  let query = supa
    .from('pedidos')
    .select('*')
    .eq('status', 'entregue')
    .gte('created_at', dataInicio)
    .lte('created_at', dataFim);

  if (tipoFiltro !== 'todos') {
    query = query.eq('forma_pagamento', tipoFiltro);
  }

  const { data: pedidos, error } = await query;

  if (error) {
    alert('Erro ao buscar dados: ' + error.message);
    return;
  }

  if (!pedidos || pedidos.length === 0) {
    alert('Nenhum pedido encontrado no período selecionado.');
    return;
  }

  // 3. Filtra por factura se necessário
  let pedidosFiltrados = pedidos;
  if (facturaFiltro === 'com_factura') {
    pedidosFiltrados = pedidos.filter(
      (p) => p.dados_factura && (p.dados_factura.ruc || p.dados_factura.ci),
    );
  } else if (facturaFiltro === 'sem_factura') {
    pedidosFiltrados = pedidos.filter(
      (p) => !p.dados_factura || (!p.dados_factura.ruc && !p.dados_factura.ci),
    );
  }

  // 4. Prepara dados para CSV
  let csv =
    'ID Pedido,Data/Hora,Cliente,Telefone,Tipo Entrega,Forma Pagamento,Subtotal,Frete,Total,RUC/CI,Razão Social\n';

  pedidosFiltrados.forEach((p) => {
    const data = new Date(p.created_at).toLocaleString('pt-BR');
    const cliente = (p.cliente_nome || '').replace(/,/g, ' '); // Remove vírgulas
    const telefone = p.cliente_telefone || '';
    const tipo = p.tipo_entrega || '';
    const pagamento = p.forma_pagamento || '';
    const subtotal = p.subtotal || 0;
    const frete = p.frete_cobrado_cliente || 0;
    const total = p.total_geral || 0;
    const ruc = p.dados_factura?.ruc || p.dados_factura?.ci || '';
    const razao = (p.dados_factura?.razao || '').replace(/,/g, ' ');

    csv += `${p.id},${data},${cliente},${telefone},${tipo},${pagamento},${subtotal},${frete},${total},${ruc},${razao}\n`;
  });

  // 5. Cria arquivo e faz download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `Relatorio_Financeiro_${ano}-${mes}-${dia}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  alert(`✅ Relatório exportado com sucesso!\n\nTotal de pedidos: ${pedidosFiltrados.length}`);
}

// =====================================================
// ALTERNATIVA: EXPORTAR PARA EXCEL REAL (XLSX)
// =====================================================
// Se quiser usar biblioteca SheetJS para Excel verdadeiro:

async function exportarFinanceiroXLSX() {
  // Aviso: Requer biblioteca SheetJS
  if (typeof XLSX === 'undefined') {
    alert('Biblioteca XLSX não carregada. Usando CSV simples.');
    exportarFinanceiro();
    return;
  }

  // Busca os dados (mesmo código acima)
  // ... código de busca ...

  // Cria planilha
  const ws = XLSX.utils.json_to_sheet(
    pedidosFiltrados.map((p) => ({
      ID: p.id,
      Data: new Date(p.created_at).toLocaleString('pt-BR'),
      Cliente: p.cliente_nome,
      Telefone: p.cliente_telefone,
      Tipo: p.tipo_entrega,
      Pagamento: p.forma_pagamento,
      Subtotal: p.subtotal,
      Frete: p.frete_cobrado_cliente,
      Total: p.total_geral,
      'RUC/CI': p.dados_factura?.ruc || p.dados_factura?.ci || '',
      Razão: p.dados_factura?.razao || '',
    })),
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vendas');

  const hoje = new Date();
  XLSX.writeFile(
    wb,
    `Relatorio_${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}.xlsx`,
  );
}

// =====================================================
// RELATÓRIO DETALHADO DE PEDIDOS
// =====================================================
async function abrirRelatorio() {
  const modal = document.getElementById('modal-relatorio');
  if (modal) {
    modal.style.display = 'flex';
    await carregarRelatorio();
  }
}

async function carregarRelatorio() {
  const filtroNum = document.getElementById('rel-filtro-numero')?.value?.trim();
  const filtroInicio = document.getElementById('rel-filtro-inicio')?.value;
  const filtroFim = document.getElementById('rel-filtro-fim')?.value;
  const hoje = new Date().toISOString().split('T')[0];
  let query = supa.from('pedidos').select('*').order('id', { ascending: false }).limit(100);
  if (filtroNum) {
    query = query.eq('id', parseInt(filtroNum));
  } else {
    const ini = filtroInicio || hoje;
    const fim = filtroFim || hoje;
    query = query.gte('created_at', ini + ' 00:00:00').lte('created_at', fim + ' 23:59:59');
  }
  const { data: pedidos, error } = await query;
  if (error) {
    console.error(error);
    return;
  }
  const tbody = document.getElementById('rel-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const fmtDiff = (t1, t2) => {
    if (!t1 || !t2) return '-';
    const diff = Math.round((new Date(t2) - new Date(t1)) / 60000);
    if (diff < 60) return diff + ' min';
    return Math.floor(diff / 60) + 'h ' + (diff % 60) + 'm';
  };
  const fmtHora = (t) =>
    t ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
  (pedidos || []).forEach((p) => {
    const statusBadge =
      {
        pendente: '🔔 Pendente',
        em_preparo: '🔥 Preparo',
        pronto_entrega: '📦 Pronto',
        saiu_entrega: '🛵 Saiu',
        entregue: '✅ Entregue',
        cancelado: '❌ Cancelado',
      }[p.status] || p.status;
    const itensList = (p.itens || [])
      .map((i) => (i.qtd || i.q || 1) + 'x ' + (i.nome || i.n || '?'))
      .join(', ');
    tbody.innerHTML +=
      '<tr><td><strong>#' +
      p.id +
      '</strong></td><td>' +
      new Date(p.created_at).toLocaleString('pt-BR') +
      '</td><td><div style="font-weight:600">' +
      (p.cliente_nome || '-') +
      '</div><div style="font-size:0.75rem;color:#666">' +
      (p.cliente_telefone || '') +
      '</div></td><td style="font-size:0.8rem">' +
      (itensList || '-') +
      '</td><td>' +
      statusBadge +
      (p.cancelamento_solicitado && p.status !== 'cancelado' ? ' 🚫' : '') +
      '</td><td>Gs ' +
      (p.total_geral || 0).toLocaleString('es-PY') +
      '</td><td style="font-size:0.78rem"><div>📥 Receb: ' +
      fmtHora(p.tempo_recebido) +
      '</div><div>✅ Aceite: ' +
      fmtHora(p.tempo_confirmado) +
      ' (' +
      fmtDiff(p.tempo_recebido, p.tempo_confirmado) +
      ')</div><div>🔥 Cozinha: ' +
      fmtHora(p.tempo_preparo_iniciado) +
      '</div><div>📦 Pronto: ' +
      fmtHora(p.tempo_pronto) +
      ' (' +
      fmtDiff(p.tempo_preparo_iniciado, p.tempo_pronto) +
      ')</div><div>🛵 Saiu: ' +
      fmtHora(p.tempo_saiu_entrega) +
      '</div><div>✅ Entregue: ' +
      fmtHora(p.tempo_entregue) +
      ' (' +
      fmtDiff(p.tempo_saiu_entrega, p.tempo_entregue) +
      ')</div><div><strong>⏱ Total: ' +
      fmtDiff(p.tempo_recebido, p.tempo_entregue) +
      '</strong></div></td></tr>';
  });
  if (!pedidos || pedidos.length === 0)
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:20px;color:#aaa">Nenhum pedido encontrado.</td></tr>';
  const el = document.getElementById('rel-total-count');
  if (el) el.textContent = (pedidos || []).length + ' pedidos encontrados';
}

function abrirModalCaixa(tipo) {
  document.getElementById('modal-caixa').style.display = 'flex';
  document.getElementById('tipo-caixa').value = tipo;

  let titulo = 'Operação';
  if (tipo === 'abertura') titulo = '🟢 Abertura de Caixa';
  if (tipo === 'suprimento') titulo = '➕ Adicionar Dinheiro';
  if (tipo === 'sangria') titulo = '💸 Sangria (Retirada)';
  if (tipo === 'despesa') titulo = '🧾 Pagar Despesa';

  document.getElementById('titulo-caixa').innerText = titulo;
  document.getElementById('valor-caixa').value = '';
  document.getElementById('desc-caixa').value = '';
  document.getElementById('valor-caixa').focus();
}

async function salvarMovimentacaoCaixa() {
  const tipo = document.getElementById('tipo-caixa').value;
  const valor = document.getElementById('valor-caixa').value;
  const desc = document.getElementById('desc-caixa').value;

  if (!valor || valor <= 0) return alert('Digite um valor válido.');

  // Pega email do usuario logado (simulado ou do html)
  const userEmail = document.getElementById('user-email').innerText || 'admin';

  const { error } = await supa.from('movimentacoes_caixa').insert([
    {
      tipo: tipo,
      valor: valor,
      descricao: desc,
      usuario_email: userEmail,
    },
  ]);

  if (error) {
    alert('Erro ao salvar: ' + error.message);
  } else {
    alert('Operação registrada com sucesso!');
    fecharModal('modal-caixa');
    calcularFinanceiro(); // Atualiza os números
  }
}

async function fecharCaixaResumo() {
  if (!confirm('Fechar o caixa de hoje?\nIsso registra o fechamento e zera os totais exibidos.'))
    return;
  await calcularFinanceiro();
  const s = _caixaState;
  const fmt = (n) => 'Gs ' + n.toLocaleString('es-PY');
  const lucro = s.faturamento + s.totalEntradas - s.custoEntregas - s.totalSaidas;

  // Registra fechamento no banco como movimentação
  try {
    await supa.from('movimentacoes_caixa').insert([
      {
        tipo: 'fechamento',
        valor: lucro,
        descricao: `Fechamento ${new Date().toLocaleDateString('pt-BR')} | Fat: ${fmt(s.faturamento)} | Res: ${fmt(lucro)}`,
        usuario_email: document.getElementById('user-email')?.innerText || 'admin',
      },
    ]);
  } catch (e) {
    console.warn('Aviso fechamento:', e.message);
  }

  alert(`📊 FECHAMENTO DO DIA
═══════════════════════════
Faturamento Total: ${fmt(s.faturamento)}

💰 Por Método:
  💵 Dinheiro:      ${fmt(s.totalEfetivo)}
  📱 Pix:           ${fmt(s.totalPix)}
  💳 Cartão:        ${fmt(s.totalCartao)}
  🏦 Transferência: ${fmt(s.totalTransf)}

📦 Pedidos: ${s.qtdPedidos}
🏍️ Custo Entregas: ${fmt(s.custoEntregas)}
💸 Saídas: ${fmt(s.totalSaidas)}
➕ Entradas: ${fmt(s.totalEntradas)}
═══════════════════════════
💵 RESULTADO: ${fmt(lucro)}
═══════════════════════════
✅ Dinheiro na gaveta: ${fmt(s.totalEfetivo)}
Fechamento registrado!`);

  // Zera os cards na tela
  [
    'card-faturamento',
    'card-custo-moto',
    'card-lucro',
    'total-pix',
    'total-transf',
    'total-cartao',
    'total-efetivo',
    'card-ticket-medio',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerText = 'Gs 0';
  });
  const qEl = document.getElementById('card-qtd-pedidos');
  if (qEl) qEl.innerText = '0';
  _caixaState = {
    faturamento: 0,
    custoEntregas: 0,
    totalSaidas: 0,
    totalEntradas: 0,
    totalPix: 0,
    totalTransf: 0,
    totalCartao: 0,
    totalEfetivo: 0,
    qtdPedidos: 0,
  };
}

// =========================================
// 7. ZAP & ROTA
// =========================================
function enviarRotaZap() {
  const checks = document.querySelectorAll('.check-pedido:checked');
  const selMoto = document.getElementById('sel-motoboy');

  if (checks.length === 0 || !selMoto.value) return alert('Selecione os pedidos e o motoboy!');

  // Pega dados do motoboy selecionado
  const opt = selMoto.options[selMoto.selectedIndex];
  // Fallback: se não tiver dataset, tenta pegar do texto
  const nomeMoto = opt.dataset.nome || opt.text;
  const telMoto = opt.dataset.tel || ''; // Importante ter o telefone no value ou dataset

  let msg = `🛵 *ROTA - ${nomeMoto.toUpperCase()}*\n\n`;
  let coords = [];
  let taxaTotal = 0;

  checks.forEach((chk) => {
    try {
      // Agora 'p' tem o objeto COMPLETO do banco
      const p = JSON.parse(decodeURIComponent(chk.value));

      // Atualiza status no banco para "saiu_entrega" ou "entregue"
      supa
        .from('pedidos')
        .update({ status: 'saiu_entrega', motoboy_id: selMoto.value })
        .eq('id', p.id)
        .then();

      msg += `📦 *PEDIDO #${p.uid_temporal || p.id}*\n`;
      msg += `👤 ${p.cliente_nome} | 📞 ${p.cliente_telefone || ''}\n`;

      // LÓGICA DE BEBIDAS 
      if (p.itens && Array.isArray(p.itens)) {
        const bebidas = p.itens.filter((i) =>
          /coca|fanta|energetico|milk|suco|sprite|guarana|agua|cerveja|refri/i.test(i.nome),
        );
        if (bebidas.length > 0) {
          msg += `🥤 *LEVAR:* ${bebidas.map((b) => `${b.qtd}x ${b.nome}`).join(', ')}\n`;
        }
      }

      // LÓGICA DE MAPA 
      if (p.geo_lat && p.geo_lng) {
        const link = `https://www.google.com/maps/search/?api=1&query=${p.geo_lat},${p.geo_lng}`;
        msg += `📍 ${link}\n`;
        coords.push(`${p.geo_lat},${p.geo_lng}`);
      } else {
        msg += `🏠 ${p.endereco_entrega || 'Retirada'}\n`;
      }

      // LÓGICA DE PAGAMENTO (Restaurada)
      const forma = (p.forma_pagamento || '').toLowerCase();
      const totalFmt = p.total_geral.toLocaleString('es-PY');

      if (forma.includes('pix') || forma.includes('transfer') || forma.includes('alias')) {
        msg += `✅ *PAGO (Pix/Transf)*\n`;
      } else if (
        forma.includes('cartao') ||
        forma.includes('credito') ||
        forma.includes('debito')
      ) {
        msg += `💳 *Cobrar Cartão: Gs ${totalFmt}*\n`;
      } else {
        // Dinheiro / Efetivo
        msg += `💰 *COBRAR: Gs ${totalFmt}*\n`;

        // Lógica de Troco
        const obsPag = p.obs_pagamento || '';
        const nums = obsPag.match(/\d+/g);
        if (nums) {
          // Pega o maior número encontrado na obs como valor de troco
          // Ex: "Troco para 100" -> 100.000
          let valorTroco = parseInt(nums.join(''));
          if (valorTroco < 1000) valorTroco *= 1000;

          if (valorTroco > p.total_geral) {
            const devolver = valorTroco - p.total_geral;
            msg += `🔄 Troco p/ ${valorTroco.toLocaleString()} (Levar Gs ${devolver.toLocaleString()})\n`;
          }
        }
        // Adiciona obs se não for só numero
        if (obsPag && !nums) msg += `⚠️ Obs: ${obsPag}\n`;
      }

      msg += `-----------------\n`;
      taxaTotal += typeof TAXA_MOTOBOY !== 'undefined' ? TAXA_MOTOBOY : 5000;
    } catch (e) {
      console.error('Erro ao processar pedido na rota:', e);
    }
  });

  // MAPA GERAL DA ROTA
  if (coords.length > 0) {
    // Usa coordenadas da loja se existirem, senão usa padrão
    const latLoja = typeof COORD_LOJA !== 'undefined' ? COORD_LOJA.lat : '';
    const lngLoja = typeof COORD_LOJA !== 'undefined' ? COORD_LOJA.lng : '';
    const rota = `https://www.google.com/maps/dir/${latLoja},${lngLoja}/${coords.join('/')}`;
    msg += `\n🗺️ *ROTA NO MAPA:*\n${rota}\n`;
  }

  msg += `\n🏍️ *Taxa Total: Gs ${taxaTotal.toLocaleString('es-PY')}*`;

  // Abre WhatsApp
  const foneDestino = telMoto || ''; // Se tiver numero no cadastro do motoboy
  window.open(`https://wa.me/${foneDestino}?text=${encodeURIComponent(msg)}`, '_blank');

  // Recarrega a tela depois de um tempo para atualizar os status
  setTimeout(() => {
    if (typeof carregarPedidos === 'function') carregarPedidos();
    if (typeof calcularFinanceiro === 'function') calcularFinanceiro();
  }, 2000);
}

// =========================================
// 8. PRODUTOS E CRUD COMPLETO (RESTAURADO)
// =========================================
// Cache dos produtos para filtro local
let _todosProdutos = [];

async function carregarProdutos() {
  const { data } = await supa.from('produtos').select('*').order('nome');
  _todosProdutos = data || [];
  renderizarCardsProdutos(_todosProdutos);
  // Só recarrega o select de categorias se o modal de produto estiver fechado
  const modalAberto = document.getElementById('modal-produto')?.style.display === 'flex';
  if (!modalAberto) carregarSelectCategorias();
}

function filtrarProdutos(termo) {
  if (!termo.trim()) {
    renderizarCardsProdutos(_todosProdutos);
    return;
  }
  const t = termo.toLowerCase();
  const filtrados = _todosProdutos.filter(p =>
    p.nome.toLowerCase().includes(t) ||
    (p.categoria_slug || '').toLowerCase().includes(t)
  );
  renderizarCardsProdutos(filtrados);
}

function renderizarCardsProdutos(lista) {
  const grid = document.getElementById('lista-produtos-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!lista || lista.length === 0) {
    grid.innerHTML = '<p style="color:#bbb;font-size:0.9rem;padding:20px 0">Nenhum produto encontrado.</p>';
    return;
  }

  const _TIPO_ICONS = {
    padrao:'📦', bebida:'🥤', lanche:'🍔', pizza:'🍕',
    acai:'🍇', shake:'🥤', suco:'🍊', sorvete:'🍦',
    montavel:'🥗', almoco:'🍽️', combo:'⭐'
  };
  const _TIPO_NAMES = {
    padrao:'Simples', bebida:'Bebida', lanche:'Lanche', pizza:'Pizza',
    acai:'Açaí', shake:'Shake', suco:'Suco', sorvete:'Sorvete',
    montavel:'Montável', almoco:'Prato', combo:'Combo'
  };

  lista.forEach(p => {
    const cfg = p.montagem_config;
    let tipoKey = 'padrao';
    if (cfg && !Array.isArray(cfg) && cfg.__tipo) tipoKey = cfg.__tipo;
    else if (p.e_montavel || (cfg && Array.isArray(cfg) && cfg.length > 0)) tipoKey = 'montavel';

    const tipoIcon  = _TIPO_ICONS[tipoKey]  || '📦';
    const tipoName  = _TIPO_NAMES[tipoKey]  || tipoKey;
    const extrasQtd = cfg?.extras?.length || 0;

    const imgHtml = p.imagem_url
      ? `<img src="${p.imagem_url}" alt="${p.nome}" loading="lazy">`
      : `<div class="produto-card-img-placeholder">${tipoIcon}</div>`;

    const badgePausado = !p.ativo ? `<span class="badge-pausado">⏸ Pausado</span>` : '';
    const badgeBalcao  = p.somente_balcao ? `<span class="badge-balcao">🏪 Balcão</span>` : '';
    const badgeExtras  = extrasQtd > 0 ? `<span title="${extrasQtd} adicionais" style="font-size:0.7rem;color:#3498db;font-weight:700">➕${extrasQtd}</span>` : '';

    const pJson = JSON.stringify(p).replace(/'/g, '&apos;').replace(/"/g, '&quot;');

    const card = document.createElement('div');
    card.className = `produto-card${!p.ativo ? ' pausado' : ''}`;
    card.innerHTML = `
      <div class="produto-card-img-wrap">
        ${imgHtml}
        <div class="produto-card-badges">
          <span class="badge-tipo">${tipoIcon} ${tipoName}</span>
          ${badgePausado}
          ${badgeBalcao}
        </div>
      </div>
      <div class="produto-card-body">
        <div class="produto-card-nome">${p.nome} ${badgeExtras}</div>
        <div class="produto-card-meta">
          <span class="produto-card-cat">${p.categoria_slug || '—'}</span>
          <span class="produto-card-id">#${p.id}</span>
        </div>
        <div class="produto-card-preco">Gs ${(p.preco || 0).toLocaleString('es-PY')}</div>
      </div>
      <div class="produto-card-actions">
        <button class="btn btn-sm btn-primary" onclick='editarProduto(${pJson})'>
          <i class="fas fa-edit"></i> Editar
        </button>
        <button class="btn btn-sm ${p.ativo ? 'btn-warning' : 'btn-success'}"
          onclick="pausarProduto(${p.id}, ${p.ativo})"
          title="${p.ativo ? 'Pausar produto' : 'Reativar produto'}">
          <i class="fas fa-${p.ativo ? 'pause' : 'play'}"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="deletarProduto(${p.id})" title="Excluir">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function editarProduto(p) {
  abrirModalProduto(p);
}

async function deletarProduto(id) {
  if (
    !confirm(
      '⚠️ ATENÇÃO: Deletar este produto?\n\nEsta ação não pode ser desfeita. O produto será removido permanentemente do sistema.',
    )
  )
    return;
  const { error } = await supa.from('produtos').delete().eq('id', id);
  if (error) alert('❌ Erro ao deletar: ' + error.message);
  else {
    alert('✅ Produto deletado!');
    carregarProdutos();
  }
}

function previewUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById('img-preview').src = e.target.result;
      document.getElementById('box-preview').style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function salvarProduto() {
  const btn = event.target;
  btn.innerText = 'Salvando...';
  btn.disabled = true;
  try {
    const id = document.getElementById('prod-id').value;
    const fileInput = document.getElementById('prod-img-file');
    let urlFinal = document.getElementById('prod-img').value;

    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const nomeArq = Date.now() + '-' + file.name.replace(/\s+/g, '-');
      await supa.storage.from('produtos').upload(nomeArq, file);
      const { data } = supa.storage.from('produtos').getPublicUrl(nomeArq);
      urlFinal = data.publicUrl;
    }

    const tipo = document.getElementById('prod-tipo-builder').value || 'padrao';

    // Monta o config completo
    let configFinal = { __tipo: tipo };

    const usaMontavel = ['montavel','acai','shake','suco'];
    if (usaMontavel.includes(tipo)) {
      const etapas = [];
      document.querySelectorAll('.etapa-item').forEach((div) => {
        etapas.push({
          titulo: div.querySelector('.step-titulo').value,
          max: parseInt(div.querySelector('.step-max').value),
          itens: div.querySelector('.step-itens').value.split(',').map((s) => s.trim()).filter((s) => s),
        });
      });
      configFinal.etapas = etapas;
    }

    if (tipo === 'pizza') {
      const tamanhos = [];
      document.querySelectorAll('.pizza-tamanho-row').forEach((row) => {
        const pTrad = parseFloat(row.querySelector('[data-f="preco_tradicional"]')?.value) || 0;
        const pEsp  = parseFloat(row.querySelector('[data-f="preco_especial"]')?.value) || 0;
        const pDoce = parseFloat(row.querySelector('[data-f="preco_doce"]')?.value) || 0;
        tamanhos.push({
          nome:               row.querySelector('[data-f="nome"]').value,
          fatias:             parseInt(row.querySelector('[data-f="fatias"]').value) || 0,
          cm:                 parseInt(row.querySelector('[data-f="cm"]').value) || 0,
          preco_tradicional:  pTrad,
          preco_especial:     pEsp,
          preco_doce:         pDoce,
          borda_preco:        parseFloat(row.querySelector('[data-f="borda_preco"]')?.value) || 0,
          // compatibilidade: preco = menor valor entre as categorias usadas
          preco: Math.min(...[pTrad, pEsp, pDoce].filter(v => v > 0)) || pTrad,
        });
      });
      const sabores = [];
      document.querySelectorAll('.pizza-sabor-row').forEach((row) => {
        sabores.push({
          nome: row.querySelector('[data-f="snome"]').value,
          tipo: row.querySelector('[data-f="stipo"]').value,
          img:  row.querySelector('[data-f="simg"]')?.value || '',
          preco: 0, // preço agora é definido por categoria no tamanho
        });
      });
      // Coleta lista de bordas
      const bordas = [];
      document.querySelectorAll('.pizza-borda-row').forEach((row) => {
        const nome  = row.querySelector('[data-f="bnome"]').value.trim();
        const preco = parseFloat(row.querySelector('[data-f="bpreco"]').value) || 0;
        if (nome) bordas.push({ nome, preco });
      });

      configFinal.pizza = {
        max_sabores: parseInt(document.getElementById('pizza-max-sabores').value) || 2,
        tipos: [
          document.getElementById('pizza-tipo-salgada').checked ? 'Salgada' : null,
          document.getElementById('pizza-tipo-doce').checked ? 'Doce' : null,
        ].filter(Boolean),
        tem_borda: bordas.length > 0,
        bordas,                      // lista completa de bordas com nome+preco
        borda_preco: bordas[0]?.preco || 0,  // compatibilidade retroativa
        tamanhos,
        sabores,
      };
    }

    // Extras
    const temExtras = document.getElementById('prod-tem-extras').checked;
    if (temExtras) {
      const extras = [];
      document.querySelectorAll('.extra-row').forEach((row) => {
        const n = row.querySelector('[data-f="enome"]').value;
        const p = parseFloat(row.querySelector('[data-f="epreco"]').value) || 0;
        if (n) extras.push({ nome: n, preco: p });
      });
      configFinal.extras = extras;
    }

    // Variações de sabor
    if (tipo === 'variacoes') {
      const variacoes = [];
      document.querySelectorAll('.variacao-row').forEach((row) => {
        const nome  = row.querySelector('[data-f="vnome"]').value.trim();
        const preco = parseFloat(row.querySelector('[data-f="vpreco"]').value) || 0;
        const img   = row.querySelector('[data-f="vimg"]').value.trim() || '';
        const ativoEl = row.querySelector('[data-f="vativo"]');
        const ativo = ativoEl ? ativoEl.checked : true;
        if (nome) variacoes.push({ nome, preco, img, ativo });
      });
      configFinal.variacoes = variacoes;
    }

    // Compatibilidade retroativa: mantém montagem_config array para tipo montavel
    const isM = usaMontavel.includes(tipo);
    const montagemCompat = isM ? (configFinal.etapas || []) : [];

    // Para variações: preco = menor valor entre as variações (usado no "A partir de")
    let precoBase = parseFloat(document.getElementById('prod-preco').value) || 0;
    if (tipo === 'variacoes' && configFinal.variacoes && configFinal.variacoes.length > 0) {
      const precos = configFinal.variacoes.map(v => v.preco).filter(p => p > 0);
      if (precos.length > 0) precoBase = Math.min(...precos);
    }

    const dados = {
      nome: document.getElementById('prod-nome').value,
      descricao: document.getElementById('prod-desc').value,
      preco: precoBase,
      categoria_slug: document.getElementById('prod-cat').value || null,
      subcategoria_slug: document.getElementById('prod-subcat')?.value || null,
      imagem_url: urlFinal,
      e_montavel: isM,
      montagem_config: isM ? montagemCompat : configFinal,  // novo: armazena config completo
      ativo: true,
      somente_balcao: document.getElementById('prod-somente-balcao')?.checked || false,
    };

    if (id) await supa.from('produtos').update(dados).eq('id', id);
    else await supa.from('produtos').insert([dados]);

    fecharModal('modal-produto');
    carregarProdutos();
  } catch (e) {
    alert('Erro: ' + e.message);
  } finally {
    btn.innerText = 'Salvar';
    btn.disabled = false;
  }
}

async function abrirModalProduto(produto = null, tipoInicial = null) {
  const modal = document.getElementById('modal-produto');

  // Reset completo
  document.getElementById('builder-steps').innerHTML = '';
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-nome').value = '';
  document.getElementById('prod-desc').value = '';
  document.getElementById('prod-preco').value = '';
  document.getElementById('prod-img').value = '';
  document.getElementById('box-preview').style.display = 'none';
  document.getElementById('prod-somente-balcao').checked = false;
  document.getElementById('prod-tem-extras').checked = false;
  document.getElementById('extras-area').style.display = 'none';
  document.getElementById('extras-lista').innerHTML = '';
  document.getElementById('pizza-tamanhos-lista').innerHTML = '';
  document.getElementById('pizza-bordas-lista').innerHTML = '';
  document.getElementById('pizza-borda-preco-box').style.display = 'none';
  document.getElementById('pizza-tem-borda').checked = false;
  document.getElementById('pizza-sabores-lista').innerHTML = '<p style="color:#aaa;font-size:0.82rem;text-align:center;margin:10px 0">Clique em "+ Sabor" para adicionar</p>';
  const variacoesLista = document.getElementById('variacoes-lista');
  if (variacoesLista) variacoesLista.innerHTML = '';
  // CORREÇÃO: Limpa o file input para não reutilizar imagem anterior
  const fileInputReset = document.getElementById('prod-img-file');
  if (fileInputReset) fileInputReset.value = '';

  let tipo = 'padrao';

  if (produto) {
    document.getElementById('prod-id').value = produto.id;
    document.getElementById('prod-nome').value = produto.nome;
    document.getElementById('prod-desc').value = produto.descricao || '';
    document.getElementById('prod-preco').value = produto.preco;
    document.getElementById('prod-img').value = produto.imagem_url || '';
    document.getElementById('prod-somente-balcao').checked = produto.somente_balcao || false;

    if (produto.imagem_url) {
      document.getElementById('img-preview').src = produto.imagem_url;
      document.getElementById('box-preview').style.display = 'block';
    }

    const cfg = produto.montagem_config;

    // Detecta tipo
    if (cfg && !Array.isArray(cfg) && cfg.__tipo) {
      tipo = cfg.__tipo;

      if (tipo === 'montavel' && cfg.etapas) {
        cfg.etapas.forEach((e) => addBuilderStep(e.titulo, e.max, e.itens));
      }
      if (tipo === 'pizza' && cfg.pizza) {
        const p = cfg.pizza;
        document.getElementById('pizza-max-sabores').value = p.max_sabores || 2;
        document.getElementById('pizza-tipo-salgada').checked = (p.tipos || []).includes('Salgada');
        document.getElementById('pizza-tipo-doce').checked = (p.tipos || []).includes('Doce');
        // Carrega bordas (novo formato: lista; retrocompat: borda_preco único)
        const bordas = p.bordas && p.bordas.length > 0
          ? p.bordas
          : p.tem_borda && p.borda_preco
            ? [{ nome: 'Borda Recheada', preco: p.borda_preco }]
            : [];
        document.getElementById('pizza-tem-borda').checked = bordas.length > 0;
        document.getElementById('pizza-bordas-lista').innerHTML = '';
        toggleBordaPreco();
        bordas.forEach((b) => addPizzaBorda(b));
        (p.tamanhos || []).forEach((t) => addPizzaTamanho(t));
        if (p.sabores && p.sabores.length > 0) {
          document.getElementById('pizza-sabores-lista').innerHTML = '';
          p.sabores.forEach((s) => addPizzaSabor(s));
        }
      }
      if (tipo === 'almoco' && cfg.almoco) {
        // Tipo almoco legado: tratar como simples (builder removido)
        tipo = 'padrao';
      }
      // Variações de sabor
      if (tipo === 'variacoes' && cfg.variacoes) {
        document.getElementById('variacoes-lista').innerHTML = '';
        cfg.variacoes.forEach((v) => addVariacao(v));
      }
      // Extras
      if (cfg.extras && cfg.extras.length > 0) {
        document.getElementById('prod-tem-extras').checked = true;
        document.getElementById('extras-area').style.display = 'block';
        cfg.extras.forEach((ex) => addExtra(ex));
      }
    } else if (cfg && Array.isArray(cfg)) {
      // Compatibilidade: array antigo = montavel
      tipo = 'montavel';
      cfg.forEach((e) => addBuilderStep(e.titulo, e.max, e.itens));
    } else if (produto.e_montavel) {
      tipo = 'montavel';
    }
  }

  // Aplica tipo inicial (vindo do seletor externo ao modal)
  if (!produto && tipoInicial) {
    tipo = tipoInicial;
  }

  // Mostra botão "Alterar tipo" apenas ao editar produto existente
  const btnAlterar = document.getElementById('btn-alterar-tipo');
  if (btnAlterar) btnAlterar.style.display = produto ? 'inline-flex' : 'none';
  // Fecha o grid de tipos se estava aberto
  const gridWrapper = document.getElementById('builder-type-grid-wrapper');
  if (gridWrapper) gridWrapper.style.display = 'none';

  selecionarTipoBuilder(tipo);

  // CORREÇÃO: Carrega categorias com a categoria atual do produto já selecionada
  const catAtual = produto ? (produto.categoria_slug || '') : '';
  const subcatAtual = produto ? (produto.subcategoria_slug || '') : '';
  await carregarSelectCategorias(catAtual);
  await carregarSelectSubcategorias(catAtual, subcatAtual);

  modal.style.display = 'flex';
}

// Mapa: tipo semântico → qual builder exibir
const BUILDER_MAP = {
  padrao:'', bebida:'', lanche:'', combo:'', sorvete:'',
  pizza:'builder-pizza',
  montavel:'builder-montavel', acai:'builder-montavel',
  shake:'builder-montavel', suco:'builder-montavel',
  variacoes:'builder-variacoes',
};
const BUILDER_HINTS = {
  acai:  '🍇 Crie etapas: "Tamanho", "Complementos", "Frutas", "Coberturas".',
  shake: '🥤 Crie etapas: "Tamanho" e "Sabor base".',
  suco:  '🍊 Crie etapas: "Fruta", "Tamanho" e "Adicionais".',
};

const _TIPO_BADGE_LABELS = {
  padrao:'📦 Simples', bebida:'🥤 Bebida', lanche:'🍔 Lanche', pizza:'🍕 Pizza',
  acai:'🍇 Açaí', shake:'🥤 Shake', suco:'🍊 Suco', sorvete:'🍦 Sorvete',
  montavel:'🥗 Montável', almoco:'🍽️ Prato', combo:'⭐ Combo', variacoes:'🎨 Variações',
};

function selecionarTipoBuilder(tipo) {
  document.getElementById('prod-tipo-builder').value = tipo;

  document.querySelectorAll('.builder-type-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tipo === tipo);
  });

  document.querySelectorAll('.builder-section').forEach((s) => s.style.display = 'none');

  const builderId = BUILDER_MAP[tipo];
  if (builderId) {
    const el = document.getElementById(builderId);
    if (el) el.style.display = 'block';
  }

  // Atualiza badge de tipo no modal
  const badge = document.getElementById('modal-tipo-badge');
  if (badge) badge.textContent = _TIPO_BADGE_LABELS[tipo] || tipo;

  const hintEl = document.getElementById('builder-tipo-hint');
  if (hintEl) {
    const msg = BUILDER_HINTS[tipo] || '';
    hintEl.textContent = msg;
    hintEl.style.display = msg ? 'block' : 'none';
    if (msg) {
      hintEl.style.cssText = 'background:#fff8e1;border-left:4px solid #f59e0b;border-radius:6px;padding:10px 14px;font-size:0.82rem;color:#78350f;margin-top:8px;';
    }
  }

  const lancheHint = document.getElementById('builder-lanche-hint');
  if (lancheHint) {
    lancheHint.style.display = (tipo === 'lanche' || tipo === 'combo') ? 'block' : 'none';
  }
}

// Abre modal com tipo pré-selecionado (vindo do seletor externo)
function criarNovoProduto(tipo) {
  // Esconde o seletor de tipos
  const panel = document.getElementById('novo-produto-tipos');
  if (panel) panel.style.display = 'none';
  // O botão "alterar tipo" só é visível ao editar
  const btnAlterar = document.getElementById('btn-alterar-tipo');
  if (btnAlterar) btnAlterar.style.display = 'none';
  abrirModalProduto(null, tipo);
}

// Toggle do painel de seleção de tipo (botão "+ Novo Produto")
function toggleNovosProdutosTipos() {
  const panel = document.getElementById('novo-produto-tipos');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// Toggle do grid de tipos DENTRO do modal (ao editar)
function toggleAlterarTipo() {
  const wrapper = document.getElementById('builder-type-grid-wrapper');
  if (!wrapper) return;
  wrapper.style.display = wrapper.style.display === 'none' ? 'block' : 'none';
}

// Compatibilidade retroativa
function toggleBuilder() {
  const isM = document.getElementById('prod-montavel')?.checked;
  if (isM) selecionarTipoBuilder('montavel');
}

function addBuilderStep(t = '', m = 1, i = []) {
  const div = document.createElement('div');
  div.className = 'etapa-item';
  div.innerHTML = `<div class="etapa-header"><input type="text" class="form-control step-titulo" value="${t}" placeholder="Título da etapa (ex: Escolha a base)"><input type="number" class="form-control step-max" value="${m}" style="width:70px" title="Máx. seleções"><button class="btn btn-sm btn-danger" onclick="this.parentElement.parentElement.remove()">X</button></div><textarea class="etapa-ingredientes step-itens" placeholder="Itens separados por vírgula. Ex: Arroz, Atum, Salmão, Tofu">${Array.isArray(i) ? i.join(', ') : i}</textarea>`;
  document.getElementById('builder-steps').appendChild(div);
}

// ─── VARIAÇÕES DE SABOR BUILDER ───────────────────────────────────
function addVariacao(dados = {}) {
  const lista = document.getElementById('variacoes-lista');
  const row = document.createElement('div');
  row.className = 'variacao-row';
  const pausado = dados.ativo === false;
  row.style.cssText = `background:${pausado ? '#fff5f5' : '#fff'};border:1px solid ${pausado ? '#fca5a5' : '#e9d5ff'};border-radius:10px;padding:12px;display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;opacity:${pausado ? '0.7' : '1'}`;
  row.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      <input data-f="vnome" class="form-control" value="${dados.nome || ''}" placeholder="Nome da variação (ex: Salmon y Cream Cheese)" style="font-weight:600">
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-size:0.8rem;color:#777;white-space:nowrap">Gs</span>
        <input data-f="vpreco" type="number" class="form-control" value="${dados.preco || ''}" placeholder="Preço" style="max-width:140px">
      </div>
      <input data-f="vimg" class="form-control" value="${dados.img || ''}" placeholder="URL da foto (opcional — usa foto do produto por padrão)" style="font-size:0.8rem;color:#888">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.82rem;color:${pausado ? '#c0392b' : '#16a34a'}">
        <input data-f="vativo" type="checkbox" ${!pausado ? 'checked' : ''} onchange="this.closest('.variacao-row').style.background=this.checked?'#fff':'#fff5f5';this.closest('.variacao-row').style.opacity=this.checked?'1':'0.7';this.closest('.variacao-row').style.borderColor=this.checked?'#e9d5ff':'#fca5a5';this.parentElement.style.color=this.checked?'#16a34a':'#c0392b';this.parentElement.lastChild.textContent=this.checked?' Disponível':' Pausado'">
        <span>${pausado ? ' Pausado' : ' Disponível'}</span>
      </label>
    </div>
    <div style="width:60px;height:60px;border-radius:8px;overflow:hidden;background:#f3f4f6;flex-shrink:0">
      ${dados.img ? `<img src="${dados.img}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:1.5rem">🖼</div>'}
    </div>
    <button class="btn btn-sm btn-danger" onclick="this.closest('.variacao-row').remove()" title="Remover" style="align-self:start">✕</button>
  `;
  lista.appendChild(row);
}

// ─── PIZZA BUILDER ───────────────────────────────────
function toggleBordaPreco() {
  const tem = document.getElementById('pizza-tem-borda').checked;
  document.getElementById('pizza-borda-preco-box').style.display = tem ? 'block' : 'none';
}

function addPizzaBorda(dados = {}) {
  const lista = document.getElementById('pizza-bordas-lista');
  const row = document.createElement('div');
  row.className = 'pizza-borda-row';
  row.innerHTML = `
    <input data-f="bnome" class="form-control" value="${dados.nome || ''}" placeholder="Ex: Cheddar, Catupiry, Chocolate...">
    <div style="display:flex;align-items:center;gap:4px">
      <span style="white-space:nowrap;font-size:0.8rem;color:#777">Gs</span>
      <input data-f="bpreco" type="number" class="form-control" value="${dados.preco || ''}" placeholder="Ex: 8000">
    </div>
    <button class="btn btn-sm btn-danger" onclick="this.closest('.pizza-borda-row').remove()" title="Remover">✕</button>
  `;
  lista.appendChild(row);
}

function addPizzaTamanho(dados = {}) {
  const lista = document.getElementById('pizza-tamanhos-lista');
  const row = document.createElement('div');
  row.className = 'pizza-tamanho-row';
  // Retrocompatibilidade: se veio só `preco` (formato antigo), usa como preco_tradicional
  const pTrad = dados.preco_tradicional ?? dados.preco ?? '';
  const pEsp  = dados.preco_especial ?? '';
  const pDoce = dados.preco_doce ?? '';
  const pBorda = dados.borda_preco ?? '';
  row.innerHTML = `
    <div class="pizza-tamanho-header">
      <div class="pizza-tamanho-info">
        <div><label>Nome</label><input data-f="nome" class="form-control" value="${dados.nome || ''}" placeholder="Ex: G"></div>
        <div><label>Fatias</label><input data-f="fatias" type="number" class="form-control" value="${dados.fatias || ''}" placeholder="8"></div>
        <div><label>Cm</label><input data-f="cm" type="number" class="form-control" value="${dados.cm || ''}" placeholder="35"></div>
      </div>
      <button class="btn btn-sm btn-danger pizza-tamanho-remove" onclick="this.closest('.pizza-tamanho-row').remove()" title="Remover">✕</button>
    </div>
    <div class="pizza-tamanho-precos">
      <div><label>🍕 Tradicional (Gs)</label><input data-f="preco_tradicional" type="number" class="form-control" value="${pTrad}" placeholder="60000"></div>
      <div><label>⭐ Especial (Gs)</label><input data-f="preco_especial" type="number" class="form-control" value="${pEsp}" placeholder="65000"></div>
      <div><label>🍫 Doce (Gs)</label><input data-f="preco_doce" type="number" class="form-control" value="${pDoce}" placeholder="60000"></div>
      <div><label>🧀 Borda (Gs)</label><input data-f="borda_preco" type="number" class="form-control" value="${pBorda}" placeholder="10000"></div>
    </div>
  `;
  lista.appendChild(row);
}

async function uploadSaborImagem(fileInput, row) {
  if (!fileInput.files.length) return;
  const file = fileInput.files[0];
  const nomeArq = `sabores/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
  fileInput.disabled = true;
  fileInput.parentElement.querySelector('.pizza-sabor-upload-btn').textContent = '⏳';
  try {
    const { error } = await supa.storage.from('produtos').upload(nomeArq, file);
    if (error) throw error;
    const { data } = supa.storage.from('produtos').getPublicUrl(nomeArq);
    row.querySelector('[data-f="simg"]').value = data.publicUrl;
    const prev = row.querySelector('.pizza-sabor-img-preview');
    prev.src = data.publicUrl;
    prev.style.display = 'block';
  } catch(e) {
    alert('Erro ao enviar imagem: ' + e.message);
  } finally {
    fileInput.disabled = false;
    fileInput.parentElement.querySelector('.pizza-sabor-upload-btn').textContent = '📷';
  }
}

function addPizzaSabor(dados = {}) {
  const lista = document.getElementById('pizza-sabores-lista');
  const ph = lista.querySelector('p');
  if (ph) ph.remove();
  const row = document.createElement('div');
  row.className = 'pizza-sabor-row';
  const imgSrc = dados.img || '';
  row.innerHTML = `
    <div class="pizza-sabor-main">
      <input data-f="snome" class="form-control" value="${dados.nome || ''}" placeholder="Nome do sabor (ex: Frango Catupiry)">
      <select data-f="stipo" class="form-control pizza-sabor-tipo">
        <option value="Tradicional" ${(!dados.tipo || dados.tipo === 'Tradicional' || dados.tipo === 'Salgada') ? 'selected' : ''}>🍕 Tradicional</option>
        <option value="Especial" ${dados.tipo === 'Especial' ? 'selected' : ''}>⭐ Especial</option>
        <option value="Doce" ${dados.tipo === 'Doce' ? 'selected' : ''}>🍫 Doce</option>
      </select>
      <button class="btn btn-sm btn-danger" onclick="this.closest('.pizza-sabor-row').remove()" title="Remover">✕</button>
    </div>
    <div class="pizza-sabor-img-row">
      <img class="pizza-sabor-img-preview" src="${imgSrc}" style="display:${imgSrc ? 'block' : 'none'}" alt="">
      <input data-f="simg" type="text" class="form-control" value="${imgSrc}" placeholder="URL da imagem (ou clique 📷)">
      <label class="pizza-sabor-upload-label">
        <span class="pizza-sabor-upload-btn">📷</span>
        <input type="file" accept="image/*" style="display:none" onchange="uploadSaborImagem(this, this.closest('.pizza-sabor-row'))">
      </label>
    </div>
  `;
  lista.appendChild(row);
}

// ─── EXTRAS BUILDER ──────────────────────────────────
function toggleExtras() {
  const ativo = document.getElementById('prod-tem-extras').checked;
  document.getElementById('extras-area').style.display = ativo ? 'block' : 'none';
}

function addExtra(dados = {}) {
  const lista = document.getElementById('extras-lista');
  const row = document.createElement('div');
  row.className = 'extra-row';
  row.innerHTML = `
    <input data-f="enome" class="form-control" value="${dados.nome || ''}" placeholder="Ex: Wasabi, Ovo Frito">
    <input data-f="epreco" type="number" class="form-control" value="${dados.preco || ''}" placeholder="Preço (Gs)">
    <button class="btn btn-sm btn-danger" onclick="this.closest('.extra-row').remove()" title="Remover">✕</button>
  `;
  lista.appendChild(row);
}

// =========================================
// 8. PRODUTOS E CATEGORIAS (CORRIGIDO)
// =========================================

// --- CATEGORIAS ---
async function carregarCategorias() {
  const { data, error } = await supa.from('categorias').select('*').order('ordem');

  const grid = document.getElementById('lista-categorias');
  if (!grid) return;

  if (error) {
    grid.innerHTML = `<p style="color:red;padding:20px">Erro ao carregar categorias: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    grid.innerHTML = `
      <div class="cat-empty">
        <i class="fas fa-tags" style="font-size:3rem;color:#ddd;margin-bottom:12px;display:block"></i>
        <p>Nenhuma categoria criada ainda.</p>
        <button class="btn btn-primary" onclick="abrirModalCategoria()"><i class="fas fa-plus"></i> Criar primeira categoria</button>
      </div>`;
    carregarSelectCategorias();
    return;
  }

  const paleta = ['#FF441F','#3498db','#2ecc71','#9b59b6','#e67e22','#1abc9c','#e74c3c','#f39c12','#34495e','#00b894'];

  grid.innerHTML = '';
  data.forEach((c, idx) => {
    const cor = paleta[idx % paleta.length];
    const cJson = JSON.stringify(c).replace(/'/g, '&apos;').replace(/"/g, '&quot;');
    const horarioBadge = c.hora_inicio && c.hora_fim
      ? `<span class="cat-badge cat-badge-horario">🕐 ${c.hora_inicio} – ${c.hora_fim}</span>`
      : `<span class="cat-badge cat-badge-sempre">✅ Sempre visível</span>`;

    const card = document.createElement('div');
    card.className = 'cat-card';
    card.style.borderTopColor = cor;
    card.innerHTML = `
      <div class="cat-card-top">
        <div class="cat-card-icon" style="background:${cor}20;color:${cor}">
          <i class="fas fa-tag"></i>
        </div>
        <div class="cat-card-info">
          <div class="cat-card-nome">${c.nome_exibicao}</div>
          <code class="cat-card-slug">${c.slug}</code>
        </div>
        <div class="cat-card-ordem" style="background:${cor}15;color:${cor}">#${c.ordem}</div>
      </div>
      <div class="cat-card-mid">${horarioBadge}</div>
      <div class="cat-card-actions">
        <button class="cat-btn cat-btn-sub" onclick="abrirPainelSubcategorias('${c.slug}')" title="Gerenciar Subcategorias">
          <i class="fas fa-layer-group"></i><span>Sub</span>
        </button>
        <button class="cat-btn cat-btn-edit" onclick='editarCategoria(${cJson})' title="Editar Categoria">
          <i class="fas fa-pen"></i><span>Editar</span>
        </button>
        <button class="cat-btn cat-btn-del" onclick="deletarCat('${c.slug}')" title="Excluir Categoria">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    grid.appendChild(card);
  });

  carregarSelectCategorias();
}

// Carrega o Select no Modal de Produto
async function carregarSelectCategorias(valorAtual = null) {
  const { data } = await supa.from('categorias').select('*').order('ordem');
  const sel = document.getElementById('prod-cat');
  if (!sel) return;

  // Preserva seleção atual se não foi passado valorAtual
  const valorPreservar = valorAtual || sel.value;

  sel.innerHTML = '<option value="">— Sem categoria —</option>';
  if (data) {
    data.forEach((c) => (sel.innerHTML += `<option value="${c.slug}">${c.nome_exibicao}</option>`));
  }

  // Restaura seleção
  if (valorPreservar) sel.value = valorPreservar;
}

// =========================================
// SISTEMA DE SUBCATEGORIAS
// =========================================

// Carrega subcategorias no select do modal de produto
async function carregarSelectSubcategorias(categoriaSlag = '', valorAtual = '') {
  const sel = document.getElementById('prod-subcat');
  const box = document.getElementById('box-subcategoria');
  if (!sel) return;

  sel.innerHTML = '<option value="">— Sem subcategoria —</option>';

  if (!categoriaSlag) {
    if (box) box.style.display = 'none';
    return;
  }

  try {
    const { data, error } = await supa
      .from('subcategorias')
      .select('*')
      .eq('categoria_slug', categoriaSlag)
      .order('ordem');

    if (error) {
      console.warn('Subcategorias indisponíveis:', error.message);
      // Mostra o box mesmo assim (com só a opção "sem subcategoria")
      if (box) box.style.display = 'block';
      return;
    }

    // Sempre mostra o campo quando uma categoria está selecionada
    if (box) box.style.display = 'block';

    if (data && data.length > 0) {
      data.forEach((s) => (sel.innerHTML += `<option value="${s.slug}">${s.nome_exibicao}</option>`));
      if (valorAtual) sel.value = valorAtual;
    }
  } catch (e) {
    console.warn('Erro ao buscar subcategorias:', e);
    // Mostra mesmo assim — melhor mostrar vazio do que esconder sem avisar
    if (box) box.style.display = 'block';
  }
}

// Chamado quando o usuário muda a categoria no modal de produto
async function onCatChange() {
  const catSlug = document.getElementById('prod-cat').value;
  await carregarSelectSubcategorias(catSlug, '');
}

// --- CRUD DE SUBCATEGORIAS ---
let _catSlugAtualSubcat = '';

async function carregarSubcategorias(categoriaSlag) {
  _catSlugAtualSubcat = categoriaSlag;
  const wrapper = document.getElementById('lista-subcategorias-wrapper');
  if (!wrapper) return;

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h4 style="margin:0">Subcategorias de: <strong>${categoriaSlag}</strong></h4>
      <button class="btn btn-primary btn-sm" onclick="abrirModalSubcat()">+ Nova Subcategoria</button>
    </div>`;

  try {
    const { data, error } = await supa
      .from('subcategorias')
      .select('*')
      .eq('categoria_slug', categoriaSlag)
      .order('ordem');

    if (error) throw error;

    if (!data || data.length === 0) {
      html += '<p style="color:#aaa;padding:10px 0">Nenhuma subcategoria criada ainda.</p>';
    } else {
      html += '<table class="table"><thead><tr><th>Slug</th><th>Nome</th><th>Ordem</th><th></th></tr></thead><tbody>';
      data.forEach((s) => {
        const sJson = JSON.stringify(s).replace(/'/g, '&apos;').replace(/"/g, '&quot;');
        html += `<tr>
          <td>${s.slug}</td>
          <td>${s.nome_exibicao}</td>
          <td>${s.ordem}</td>
          <td class="actions-cell">
            <button class="btn btn-sm btn-info" onclick='editarSubcat(${sJson})'><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deletarSubcat('${s.slug}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      });
      html += '</tbody></table>';
    }
  } catch (e) {
    html += `<div style="background:#fff3cd;padding:12px;border-radius:8px;color:#856404;font-size:0.85rem">
      ⚠️ A tabela <strong>subcategorias</strong> ainda não existe no banco.<br>
      Execute o SQL abaixo no Supabase para ativá-la:<br><br>
      <code style="background:#f8f9fa;padding:4px 8px;border-radius:4px;font-size:0.8rem;display:block;white-space:pre-wrap">
CREATE TABLE subcategorias (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  nome_exibicao TEXT NOT NULL,
  categoria_slug TEXT REFERENCES categorias(slug) ON DELETE CASCADE,
  ordem INT DEFAULT 0
);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS subcategoria_slug TEXT REFERENCES subcategorias(slug) ON DELETE SET NULL;
      </code>
    </div>`;
  }

  wrapper.innerHTML = html;
}

function abrirModalSubcat(subcat = null) {
  const isEdit = !!subcat;
  const slugVal = subcat ? subcat.slug : '';
  const nomeVal = subcat ? subcat.nome_exibicao : '';
  const ordemVal = subcat ? subcat.ordem : '';

  const modalHtml = `
    <div id="modal-subcat" class="modal-overlay" style="display:flex">
      <div class="modal-content" style="max-width:400px">
        <h3>${isEdit ? 'Editar Subcategoria' : 'Nova Subcategoria'}</h3>
        <input type="hidden" id="subcat-modo" value="${isEdit ? 'sim' : 'nao'}">
        <input type="hidden" id="subcat-slug-original" value="${slugVal}">
        <div class="form-group">
          <label>Nome Exibição</label>
          <input type="text" id="subcat-nome" class="form-control" value="${nomeVal}" oninput="autoSlugFromSubcatNome()">
        </div>
        <div class="form-group">
          <label>Slug (ID único)</label>
          <input type="text" id="subcat-slug" class="form-control" value="${slugVal}">
          <small style="color:#888">Gerado automaticamente ou edite manualmente</small>
        </div>
        <div class="form-group">
          <label>Ordem</label>
          <input type="number" id="subcat-ordem" class="form-control" value="${ordemVal}">
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onclick="salvarSubcat()">Salvar</button>
          <button class="btn btn-secondary" onclick="document.getElementById('modal-subcat').remove()">Cancelar</button>
        </div>
      </div>
    </div>`;

  // Remove modal anterior se existir
  document.getElementById('modal-subcat')?.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function editarSubcat(s) {
  abrirModalSubcat(s);
}

function autoSlugFromSubcatNome() {
  const nome = document.getElementById('subcat-nome').value;
  const slug = gerarSlug(nome);
  document.getElementById('subcat-slug').value = slug;
}

async function salvarSubcat() {
  const modo = document.getElementById('subcat-modo').value;
  const slugOriginal = document.getElementById('subcat-slug-original').value;
  const nome = document.getElementById('subcat-nome').value.trim();
  const slug = document.getElementById('subcat-slug').value.trim();
  const ordem = parseInt(document.getElementById('subcat-ordem').value) || 0;

  if (!slug || !nome) return alert('Preencha o slug e o nome!');

  const dados = {
    slug,
    nome_exibicao: nome,
    categoria_slug: _catSlugAtualSubcat,
    ordem,
  };

  let erro = null;
  if (modo === 'sim') {
    const { error } = await supa.from('subcategorias').update(dados).eq('slug', slugOriginal);
    erro = error;
  } else {
    const { error } = await supa.from('subcategorias').insert([dados]);
    erro = error;
  }

  if (erro) {
    alert('Erro ao salvar: ' + erro.message);
  } else {
    document.getElementById('modal-subcat')?.remove();
    carregarSubcategorias(_catSlugAtualSubcat);
  }
}

async function deletarSubcat(slug) {
  if (!confirm(`Deletar a subcategoria "${slug}"?\n\nOs produtos vinculados ficarão sem subcategoria.`)) return;

  // Desvincula produtos
  await supa.from('produtos').update({ subcategoria_slug: null }).eq('subcategoria_slug', slug);

  const { error } = await supa.from('subcategorias').delete().eq('slug', slug);
  if (error) alert('Erro: ' + error.message);
  else carregarSubcategorias(_catSlugAtualSubcat);
}

// Utilitário: gera slug a partir de um texto
function gerarSlug(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// Abre Modal de Edição (Recebe o objeto c inteiro)
function editarCategoria(c) {
  document.getElementById('titulo-modal-cat').innerText = 'Editar Categoria';
  document.getElementById('cat-modo-edicao').value = 'sim';

  const slugInput = document.getElementById('cat-slug');
  slugInput.value = c.slug;
  slugInput.readOnly = false; // Permite editar o slug
  slugInput.dataset.slugOriginal = c.slug; // Guarda o original para comparar

  document.getElementById('cat-nome').value = c.nome_exibicao;
  document.getElementById('cat-ordem').value = c.ordem;

  document.getElementById('modal-cat').style.display = 'flex';
}

async function salvarCategoria() {
  const slugInput = document.getElementById('cat-slug');
  const slug = slugInput.value.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_');
  const nome = document.getElementById('cat-nome').value.trim();
  let ordemVal = parseInt(document.getElementById('cat-ordem').value);
  const modo = document.getElementById('cat-modo-edicao').value;
  const slugOriginal = slugInput.dataset.slugOriginal || slug;

  if (!slug || !nome) return alert('Preencha o slug e o nome!');

  // Se ordem não foi preenchida ou ficou 0 em modo inserção, busca a próxima automaticamente
  if ((!ordemVal || ordemVal === 0) && modo !== 'sim') {
    const { data: ult } = await supa
      .from('categorias')
      .select('ordem')
      .order('ordem', { ascending: false })
      .limit(1);
    ordemVal = ult && ult.length > 0 && ult[0].ordem != null ? ult[0].ordem + 1 : 1;
  }

  let erro = null;

  if (modo === 'sim') {
    const slugMudou = slug !== slugOriginal;

    if (slugMudou) {
      // 1. Insere novo registro com o novo slug
      const { error: insErr } = await supa.from('categorias').insert([{
        slug,
        nome_exibicao: nome,
        ordem: ordemVal
      }]);
      if (insErr) { alert('Erro ao salvar: ' + insErr.message); return; }

      // 2. Migra todos os produtos do slug antigo para o novo
      await supa.from('produtos').update({ categoria_slug: slug }).eq('categoria_slug', slugOriginal);

      // 3. Migra subcategorias (se existirem)
      try {
        await supa.from('subcategorias').update({ categoria_slug: slug }).eq('categoria_slug', slugOriginal);
      } catch (_) {}

      // 4. Deleta o registro antigo
      const { error: delErr } = await supa.from('categorias').delete().eq('slug', slugOriginal);
      erro = delErr;
    } else {
      const { error } = await supa
        .from('categorias')
        .update({ nome_exibicao: nome, ordem: ordemVal })
        .eq('slug', slugOriginal);
      erro = error;
    }
  } else {
    const { error } = await supa.from('categorias').insert([{ slug, nome_exibicao: nome, ordem: ordemVal }]);
    erro = error;
  }

  if (erro) alert('Erro ao salvar: ' + erro.message);
  else {
    fecharModal('modal-cat');
    carregarCategorias();
  }
}

async function abrirModalCategoria() {
  document.getElementById('titulo-modal-cat').innerText = 'Nova Categoria';
  document.getElementById('cat-modo-edicao').value = 'nao';
  const slugInput = document.getElementById('cat-slug');
  slugInput.value = '';
  slugInput.readOnly = false;
  slugInput.dataset.slugOriginal = '';
  document.getElementById('cat-nome').value = '';

  // Auto-preenche a ordem com o próximo número
  try {
    const { data } = await supa
      .from('categorias')
      .select('ordem')
      .order('ordem', { ascending: false })
      .limit(1);
    const proximaOrdem = data && data.length > 0 && data[0].ordem != null ? data[0].ordem + 1 : 1;
    document.getElementById('cat-ordem').value = proximaOrdem;
  } catch (e) {
    document.getElementById('cat-ordem').value = '';
  }

  document.getElementById('modal-cat').style.display = 'flex';
}

async function deletarProduto(id) {
  const confirmar = confirm(
    '⚠️ ATENÇÃO: Deletar este produto?\n\nEsta ação não pode ser desfeita. O produto será removido permanentemente do sistema.',
  );
  if (!confirmar) return;

  try {
    const { error } = await supa.from('produtos').delete().eq('id', id);
    if (error) {
      alert('❌ Erro ao deletar: ' + error.message);
    } else {
      alert('✅ Produto deletado com sucesso!');
      carregarProdutos();
    }
  } catch (e) {
    alert('❌ Erro inesperado: ' + e.message);
  }
}

async function pausarProduto(id, ativoAtual) {
  const novoStatus = !ativoAtual;
  const acao = novoStatus ? 'reativar' : 'pausar';
  if (!confirm(`Deseja ${acao} este produto?`)) return;

  const { error } = await supa.from('produtos').update({ ativo: novoStatus }).eq('id', id);
  if (error) {
    alert('❌ Erro: ' + error.message);
  } else {
    alert(novoStatus ? '✅ Produto reativado!' : '⏸️ Produto pausado!');
    carregarProdutos();
  }
}

async function deletarCat(slug) {
  // Verifica quantos produtos usam esta categoria
  const { count } = await supa
    .from('produtos')
    .select('*', { count: 'exact', head: true })
    .eq('categoria_slug', slug);

  let msg = `⚠️ ATENÇÃO: Deletar a categoria "${slug}"?\n\nEsta ação não pode ser desfeita.`;
  if (count > 0) {
    msg += `\n\n⚠️ ${count} produto(s) usam esta categoria e ficarão sem categoria após a exclusão.`;
  }

  const confirmar = confirm(msg);
  if (!confirmar) return;

  try {
    // Primeiro: desvincula todos os produtos desta categoria
    if (count > 0) {
      await supa
        .from('produtos')
        .update({ categoria_slug: null, subcategoria_slug: null })
        .eq('categoria_slug', slug);
    }

    // Segundo: remove subcategorias vinculadas (se a tabela existir)
    try {
      await supa.from('subcategorias').delete().eq('categoria_slug', slug);
    } catch (_) { /* tabela pode não existir ainda */ }

    // Terceiro: deleta a categoria
    const { error } = await supa.from('categorias').delete().eq('slug', slug);
    if (error) {
      alert('❌ Erro ao deletar: ' + error.message);
    } else {
      alert('✅ Categoria deletada com sucesso!');
      carregarCategorias();
    }
  } catch (e) {
    alert('❌ Erro inesperado: ' + e.message);
  }
}

// Abre o painel de subcategorias abaixo da tabela de categorias
function abrirPainelSubcategorias(categoriaSlug) {
  const painel = document.getElementById('lista-subcategorias-wrapper');
  if (!painel) return;
  painel.style.display = 'block';
  painel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  carregarSubcategorias(categoriaSlug);
}

// Auto-gera o slug a partir do nome da categoria (modal de categoria)
function autoSlugFromNome() {
  const modo = document.getElementById('cat-modo-edicao')?.value;
  // Só auto-gera o slug se for criação (não edição)
  if (modo === 'sim') return;
  const nome = document.getElementById('cat-nome').value;
  document.getElementById('cat-slug').value = gerarSlug(nome);
}

async function deletarMotoboy(id) {
  const confirmar = confirm(
    '⚠️ ATENÇÃO: Deletar este motoboy?\n\nEsta ação não pode ser desfeita.',
  );
  if (!confirmar) return;

  try {
    const { error } = await supa.from('motoboys').delete().eq('id', id);
    if (error) {
      if (error.code === '23503' || (error.message && error.message.includes('foreign key'))) {
        alert(
          '❌ Não é possível excluir este motoboy pois ele possui pedidos vinculados.\n\nDica: Você pode desativar o motoboy em vez de excluir.',
        );
      } else {
        alert('❌ Erro ao deletar: ' + error.message);
      }
    } else {
      alert('✅ Motoboy deletado com sucesso!');
      carregarMotoboys();
      carregarMotoboysSelect();
    }
  } catch (e) {
    alert('❌ Erro inesperado: ' + e.message);
  }
}
async function carregarMotoboys() {
  const { data, error } = await supa.from('motoboys').select('*').order('nome');

  // Log limpo: só mostra se houver erro real
  if (error) console.error('❌ carregarMotoboys error:', error);

  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    const wrapper = document.getElementById('lista-motos-wrapper');
    let container = document.getElementById('mobile-motos');

    if (!container) {
      container = document.createElement('div');
      container.className = 'mobile-cards-container';
      container.id = 'mobile-motos';
      const tableContainer = wrapper.querySelector('.table-container');
      if (tableContainer) {
        wrapper.insertBefore(container, tableContainer);
      }
    }

    container.innerHTML = '';

    if (!error && data && data.length > 0) {
      data.forEach((m) => {
        const card = document.createElement('div');
        card.className = 'mobile-card';
        card.innerHTML = `
                    <div class="mobile-card-header">
                        <div class="mobile-card-title">
                            <i class="fas fa-motorcycle" style="color:var(--primary);margin-right:8px;"></i>
                            ${m.nome}
                        </div>
                    </div>
                    <div class="mobile-card-body">
                        <div class="mobile-card-row">
                            <span class="mobile-card-label">Telefone:</span>
                            <span class="mobile-card-value">${m.telefone || '-'}</span>
                        </div>
                    </div>
                    <div class="mobile-card-actions">
                        <button class="btn btn-info" onclick='editarMoto(${JSON.stringify(m).replace(/'/g, '&apos;').replace(/"/g, '&quot;')})'>
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-danger" onclick="deletarMotoboy(${m.id})">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </div>
                `;
        container.appendChild(card);
      });
    } else {
      container.innerHTML =
        '<p style="text-align:center;padding:20px;color:#999">Nenhum motoboy cadastrado.</p>';
    }

    // Esconde tabela desktop no mobile
    const tableContainer = wrapper.querySelector('.table-container');
    if (tableContainer) tableContainer.style.display = 'none';

    return;
  }

  // CÓDIGO DESKTOP
  const wrapper = document.getElementById('lista-motos-wrapper');
  const tableContainer = wrapper ? wrapper.querySelector('.table-container') : null;
  if (tableContainer) tableContainer.style.display = 'block'; // Mostra tabela no desktop

  const tbody = document.getElementById('lista-motos');
  if (!tbody) {
    console.error('❌ Elemento lista-motos não encontrado!');
    return;
  }

  tbody.innerHTML = '';

  if (error) {
    console.error('❌ Erro ao carregar motoboys:', error);
    tbody.innerHTML =
      '<tr><td colspan="3" style="text-align:center;color:red">Erro ao carregar motoboys</td></tr>';
    return;
  }

  if (data && data.length > 0) {
    data.forEach((m) => {
      const mJson = JSON.stringify(m).replace(/'/g, "'").replace(/"/g, '&quot;');
      tbody.innerHTML += `
                <tr>
                    <td data-label="Nome">${m.nome}</td>
                    <td data-label="Telefone">${m.telefone || '-'}</td>
                    <td class="actions-cell">
                        <button class="btn btn-sm btn-info" onclick='editarMoto(${mJson})'>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deletarMotoboy(${m.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
    });
  } else {
    tbody.innerHTML =
      '<tr><td colspan="3" style="text-align:center">Nenhum motoboy cadastrado.</td></tr>';
  }
}

// Função chamada pelo botão editar
function editarMoto(m) {
  document.getElementById('moto-id').value = m.id;
  document.getElementById('moto-nome').value = m.nome;
  document.getElementById('moto-tel').value = m.telefone || '';
  document.getElementById('modal-moto').style.display = 'flex';
}

function abrirModalMoto() {
  document.getElementById('moto-id').value = '';
  document.getElementById('moto-nome').value = '';
  document.getElementById('moto-tel').value = '';
  document.getElementById('modal-moto').style.display = 'flex';
}

async function salvarMotoboy() {
  const dados = {
    nome: document.getElementById('moto-nome').value,
    telefone: document.getElementById('moto-tel').value,
  };
  const id = document.getElementById('moto-id').value;

  if (!dados.nome || !dados.nome.trim()) {
    alert('❌ Nome do motoboy é obrigatório!');
    return;
  }

  try {
    if (id) {
      const { error } = await supa.from('motoboys').update(dados).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supa.from('motoboys').insert([dados]);
      if (error) throw error;
    }

    alert('✅ Motoboy salvo com sucesso!');
    fecharModal('modal-moto');
    carregarMotoboys();
    carregarMotoboysSelect(); // Atualiza o select da Rota
  } catch (e) {
    alert('❌ Erro ao salvar: ' + e.message);
  }
}

async function carregarMotoboysSelect() {
  const { data } = await supa.from('motoboys').select('*');
  const sel = document.getElementById('sel-motoboy');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione...</option>';
  if (data) {
    data.forEach((m) => {
      sel.innerHTML += `<option value="${m.id}" data-tel="${m.telefone}" data-nome="${m.nome}">${m.nome}</option>`;
    });
  }
}

// =========================================
// MOTOBOYS (CORRIGIDO)
// =========================================

// === CONFIGURAÇÕES (COMPLETO) ===

const DIAS_SEMANA = [
  { key: 'seg', label: 'Segunda-feira' },
  { key: 'ter', label: 'Terça-feira' },
  { key: 'qua', label: 'Quarta-feira' },
  { key: 'qui', label: 'Quinta-feira' },
  { key: 'sex', label: 'Sexta-feira' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

function _renderGradeSemanal(horariosSalvos = {}) {
  const container = document.getElementById('grade-semanal');
  if (!container) return;
  container.innerHTML = '';
  DIAS_SEMANA.forEach(({ key, label }) => {
    const dia = horariosSalvos[key] || { fechado: false, turnos: [{ abre: '', fecha: '' }] };
    const fechado = dia.fechado === true;
    const turnos = dia.turnos && dia.turnos.length > 0 ? dia.turnos : [{ abre: '', fecha: '' }];

    const row = document.createElement('div');
    row.className = 'dia-row';
    row.dataset.dia = key;

    let turnosHtml = turnos.map((t, i) => `
      <div class="turno-row" data-idx="${i}">
        <span class="turno-sep">${i > 0 ? 'e das' : 'das'}</span>
        <input type="time" class="form-control turno-abre" value="${t.abre || ''}" style="width:110px">
        <span class="turno-sep">às</span>
        <input type="time" class="form-control turno-fecha" value="${t.fecha || ''}" style="width:110px">
        ${i > 0 ? `<button class="btn-rm-turno" onclick="removerTurno(this)" title="Remover turno">✕</button>` : ''}
      </div>`).join('');

    row.innerHTML = `
      <div class="dia-row-header">
        <label class="dia-toggle">
          <input type="checkbox" class="dia-fechado-check" ${fechado ? 'checked' : ''} onchange="toggleDiaFechado(this)">
          <span class="dia-toggle-slider"></span>
        </label>
        <span class="dia-nome">${label}</span>
        <span class="dia-status-text">${fechado ? '<span style="color:#e74c3c">Fechado</span>' : '<span style="color:#27ae60">Aberto</span>'}</span>
      </div>
      <div class="dia-turnos" style="${fechado ? 'display:none' : ''}">
        <div class="turnos-lista">${turnosHtml}</div>
        <button class="btn-add-turno" onclick="adicionarTurno(this)">+ 2º turno</button>
      </div>
    `;
    container.appendChild(row);
  });
}

function toggleDiaFechado(checkbox) {
  const row = checkbox.closest('.dia-row');
  const turnos = row.querySelector('.dia-turnos');
  const statusTxt = row.querySelector('.dia-status-text');
  if (checkbox.checked) {
    if (turnos) turnos.style.display = 'none';
    if (statusTxt) statusTxt.innerHTML = '<span style="color:#e74c3c">Fechado</span>';
  } else {
    if (turnos) turnos.style.display = '';
    if (statusTxt) statusTxt.innerHTML = '<span style="color:#27ae60">Aberto</span>';
  }
}

function adicionarTurno(btn) {
  const lista = btn.previousElementSibling;
  const idx = lista.querySelectorAll('.turno-row').length;
  if (idx >= 2) { alert('Máximo de 2 turnos por dia.'); return; }
  const div = document.createElement('div');
  div.className = 'turno-row';
  div.dataset.idx = idx;
  div.innerHTML = `
    <span class="turno-sep">e das</span>
    <input type="time" class="form-control turno-abre" style="width:110px">
    <span class="turno-sep">às</span>
    <input type="time" class="form-control turno-fecha" style="width:110px">
    <button class="btn-rm-turno" onclick="removerTurno(this)" title="Remover turno">✕</button>
  `;
  lista.appendChild(div);
}

function removerTurno(btn) {
  btn.closest('.turno-row').remove();
}

function _lerGradeSemanal() {
  const horarios = {};
  document.querySelectorAll('.dia-row').forEach((row) => {
    const key = row.dataset.dia;
    const fechado = row.querySelector('.dia-fechado-check').checked;
    const turnos = [];
    row.querySelectorAll('.turno-row').forEach((t) => {
      const abre = t.querySelector('.turno-abre').value;
      const fecha = t.querySelector('.turno-fecha').value;
      if (abre || fecha) turnos.push({ abre, fecha });
    });
    horarios[key] = { fechado, turnos: fechado ? [] : (turnos.length ? turnos : [{ abre: '', fecha: '' }]) };
  });
  return horarios;
}

async function carregarConfiguracoes() {
  // Gestão de cupons: apenas dono e gerente
  const _cardCupons = document.getElementById('card-cupons-cfg');
  if (_cardCupons)
    _cardCupons.style.display =
      perfilUsuario === 'dono' || perfilUsuario === 'gerente' ? '' : 'none';

  const { data } = await supa.from('configuracoes').select('*').single();
  if (!data) return;

  const s = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };
  s('cfg-aberta', data.loja_aberta ? 'true' : 'false');
  s('cfg-cotacao', data.cotacao_real);
  s('cfg-banner-id', data.banner_produto_id || '');
  s('cfg-banner-img', data.banner_imagem || '');

  // Renderiza a grade semanal com dados salvos (ou vazia)
  _renderGradeSemanal(data.horarios_semanais || {});

  if (data.banner_imagem) {
    const prev = document.getElementById('cfg-banner-preview');
    const box = document.getElementById('cfg-banner-preview-box');
    if (prev) prev.src = data.banner_imagem;
    if (box) box.style.display = 'block';
  }

  // Personalização visual (se campos existirem)
  const sc = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  };
  sc('cfg-nome-loja', data.nome_loja);
  sc('cfg-cor-primaria', data.cor_primaria);
  sc('cfg-cor-primaria-hex', data.cor_primaria);

  // Sincronizar color picker com hex
  const corPicker = document.getElementById('cfg-cor-primaria');
  const corHex = document.getElementById('cfg-cor-primaria-hex');
  if (corPicker && corHex) {
    corPicker.addEventListener('input', (e) => { corHex.value = e.target.value; });
    corHex.addEventListener('input', (e) => {
      if (e.target.value.startsWith('#') && e.target.value.length === 7) corPicker.value = e.target.value;
    });
  }

  // Preview do ícone se existir
  if (data.icone_url) {
    const prevIcone = document.getElementById('cfg-icone-preview');
    const boxIcone = document.getElementById('cfg-icone-preview-box');
    if (prevIcone) prevIcone.src = data.icone_url;
    if (boxIcone) boxIcone.style.display = 'block';
  }
}

async function salvarConfiguracoes() {
  const g = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : null;
  };
  const dados = {
    loja_aberta: g('cfg-aberta') === 'true',
    cotacao_real: parseFloat(g('cfg-cotacao')) || 1100,
    banner_produto_id: g('cfg-banner-id'),
    banner_imagem: g('cfg-banner-img') || '',
    horarios_semanais: _lerGradeSemanal(),
  };

  // Personalização extra (se campos existirem)
  const nomeLoja = g('cfg-nome-loja');
  const corPri = g('cfg-cor-primaria');
  const corSec = g('cfg-cor-secundaria');
  if (nomeLoja) dados.nome_loja = nomeLoja;
  if (corPri) dados.cor_primaria = corPri;
  if (corSec) dados.cor_secundaria = corSec;

  const { error } = await supa.from('configuracoes').update(dados).gt('id', 0);
  if (error) alert('Erro: ' + error.message);
  else alert('✅ Configurações salvas!');
}

function previewBanner(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const prev = document.getElementById('cfg-banner-preview');
    const box = document.getElementById('cfg-banner-preview-box');
    if (prev) {
      prev.src = e.target.result;
    }
    if (box) {
      box.style.display = 'block';
    }
  };
  reader.readAsDataURL(input.files[0]);
}

async function salvarBanner() {
  const fileInput = document.getElementById('cfg-banner-file');
  const prodId = document.getElementById('cfg-banner-id')?.value;

  if (!prodId) {
    alert('Informe o ID do produto promocional.');
    return;
  }
  if (!fileInput?.files?.length) {
    alert('Selecione uma foto para o banner.');
    return;
  }

  const btn = event.target;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  btn.disabled = true;

  try {
    const file = fileInput.files[0];
    const nomeArq = `banner_${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadErr } = await supa.storage
      .from('produtos')
      .upload(nomeArq, file, { upsert: true });
    if (uploadErr) throw uploadErr;

    const { data: urlData } = supa.storage.from('produtos').getPublicUrl(nomeArq);
    const urlFinal = urlData.publicUrl;

    // Salva a URL e o ID do produto na tabela configuracoes
    await supa
      .from('configuracoes')
      .update({
        banner_imagem: urlFinal,
        banner_produto_id: prodId,
      })
      .gt('id', 0);

    document.getElementById('cfg-banner-img').value = urlFinal;
    alert('✅ Promoção ativada! O banner foi atualizado no cardápio.');
  } catch (e) {
    alert('Erro ao enviar: ' + e.message);
  } finally {
    btn.innerHTML = '<i class="fas fa-upload"></i> Enviar Foto & Ativar Promoção';
    btn.disabled = false;
  }
}
function previewIcone(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const prev = document.getElementById('cfg-icone-preview');
    const box = document.getElementById('cfg-icone-preview-box');
    if (prev) prev.src = e.target.result;
    if (box) box.style.display = 'block';
  };
  reader.readAsDataURL(input.files[0]);
}

async function salvarPersonalizacao() {
  const btn = event.target;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
  btn.disabled = true;

  try {
    const dados = {};
    const nomeLoja = document.getElementById('cfg-nome-loja')?.value;
    const corPri = document.getElementById('cfg-cor-primaria')?.value;
    const corHex = document.getElementById('cfg-cor-primaria-hex')?.value;

    if (nomeLoja) dados.nome_loja = nomeLoja;
    if (corPri) dados.cor_primaria = corPri;
    // Se o usuário digitou hex manual, usa ele
    if (corHex && corHex.startsWith('#')) dados.cor_primaria = corHex;

    // Upload do ícone se houver
    const iconeFile = document.getElementById('cfg-icone-file');
    if (iconeFile?.files?.length) {
      const file = iconeFile.files[0];
      const nomeArq = `icone_loja_${Date.now()}.${file.name.split('.').pop()}`;
      await supa.storage.from('produtos').upload(nomeArq, file, { upsert: true });
      const { data: urlData } = supa.storage.from('produtos').getPublicUrl(nomeArq);
      dados.icone_url = urlData.publicUrl;
    }

    if (Object.keys(dados).length > 0) {
      const { error } = await supa.from('configuracoes').update(dados).gt('id', 0);
      if (error) throw error;
    }
    alert('✅ Personalização salva! Recarregue o cardápio (index.html) para ver as mudanças.');
  } catch (e) {
    alert('Erro: ' + e.message);
  } finally {
    btn.innerHTML = '<i class="fas fa-paint-brush"></i> Salvar Personalização';
    btn.disabled = false;
  }
}

async function carregarDashboard() {
  // Saudação dinâmica
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const elGreet = document.getElementById('dash-greeting');
  if (elGreet) elGreet.textContent = saudacao + ' 👋';

  const elDate = document.getElementById('dash-date');
  if (elDate)
    elDate.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  const hoje = new Date().toISOString().split('T')[0];

  // Pedidos de hoje entregues
  const { data: pedidos } = await supa
    .from('pedidos')
    .select('*')
    .gte('created_at', hoje)
    .eq('status', 'entregue');
  const total = pedidos ? pedidos.reduce((a, b) => a + (b.total_geral || 0), 0) : 0;

  // Pedidos em preparo
  const { count: emPreparo } = await supa
    .from('pedidos')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'em_preparo');

  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.innerText = v;
  };
  setVal('kpi-vendas', `Gs ${total.toLocaleString('es-PY')}`);
  setVal('kpi-pedidos', pedidos ? pedidos.length : 0);
  setVal(
    'kpi-moto',
    `Gs ${((pedidos?.length || 0) * TAXA_MOTOBOY + (pedidos?.length > 0 ? AJUDA_COMBUSTIVEL : 0)).toLocaleString('es-PY')}`,
  );
  setVal('kpi-em-preparo', emPreparo || 0);

  // === RANKING PRODUTOS ===
  await carregarRankingProdutos();

  // === RANKING CLIENTES ===
  await carregarRankingClientes();

  // (tabela legada removida)
}

// ══════════════════════════════════════════════════════════
// RANKING PRODUTOS com filtro de período
// ══════════════════════════════════════════════════════════
async function carregarRankingProdutos() {
  const sel = document.getElementById('rank-prod-periodo');
  const periodo = sel ? sel.value : 'hoje';
  const customBox = document.getElementById('rank-prod-custom');
  if (customBox) customBox.style.display = periodo === 'custom' ? 'flex' : 'none';
  const { inicio, fim } = _calcularIntervalo(periodo, 'rank-prod-inicio', 'rank-prod-fim');

  let query = supa.from('pedidos').select('itens').eq('status', 'entregue');
  if (inicio) query = query.gte('created_at', inicio);
  if (fim)    query = query.lte('created_at', fim);
  const { data } = await query;

  const cnt = {};
  (data || []).forEach(ped => {
    (Array.isArray(ped.itens) ? ped.itens : []).forEach(item => {
      const n = item.nome || item.n || 'Produto';
      const q = parseInt(item.qtd || item.q || 1);
      cnt[n] = (cnt[n] || 0) + q;
    });
  });
  const ranking = Object.entries(cnt)
    .map(([nome, v]) => ({ nome, v }))
    .sort((a, b) => b.v - a.v).slice(0, 8);

  const el = document.getElementById('ranking-produtos-list');
  if (!el) return;
  if (!ranking.length) { el.innerHTML = '<div class="rank-vazio">Nenhuma venda no período</div>'; return; }
  el.innerHTML = '';
  const max = ranking[0].v;
  ranking.forEach((p, i) => {
    const pct = Math.round((p.v / max) * 100);
    el.innerHTML += `<div class="rank-item">
      <div class="rank-pos rank-pos-${i+1}">${i+1}</div>
      <div class="rank-info">
        <div class="rank-name">${p.nome}</div>
        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${pct}%"></div></div>
      </div>
      <div class="rank-val">${p.v}</div>
    </div>`;
  });
}

// ══════════════════════════════════════════════════════════
// RANKING CLIENTES com filtro de período + limpeza de "MESA X -"
// ══════════════════════════════════════════════════════════
async function carregarRankingClientes() {
  const sel = document.getElementById('rank-cli-periodo');
  const periodo = sel ? sel.value : 'tudo';
  const customBox = document.getElementById('rank-cli-custom');
  if (customBox) customBox.style.display = periodo === 'custom' ? 'flex' : 'none';
  const { inicio, fim } = _calcularIntervalo(periodo, 'rank-cli-inicio', 'rank-cli-fim');

  let query = supa.from('pedidos')
    .select('cliente_nome, cliente_telefone, total_geral')
    .eq('status', 'entregue').order('created_at', { ascending: false }).limit(1000);
  if (inicio) query = query.gte('created_at', inicio);
  if (fim)    query = query.lte('created_at', fim);
  const { data } = await query;

  const map = {};
  (data || []).forEach(p => {
    const nomeLimpo = (p.cliente_nome || '').replace(/^MESA\s+\d+\s*-\s*/i, '').trim() || 'Cliente';
    const tel = (p.cliente_telefone || '').trim();
    if (nomeLimpo === 'Cliente' && tel.length < 5) return;
    const key = tel.length > 5 ? tel : 'nome:' + nomeLimpo;
    if (!map[key]) map[key] = { nome: nomeLimpo, tel, qtd: 0, total: 0 };
    else if (nomeLimpo !== 'Cliente' && map[key].nome === 'Cliente') map[key].nome = nomeLimpo;
    map[key].qtd++;
    map[key].total += p.total_geral || 0;
  });

  const top = Object.values(map).sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  const el = document.getElementById('ranking-clientes-list');
  if (!el) return;
  if (!top.length) { el.innerHTML = '<div class="rank-vazio">Nenhum cliente no período</div>'; return; }
  el.innerHTML = '';
  const max = top[0].qtd;
  top.forEach((c, i) => {
    const pct = Math.round((c.qtd / max) * 100);
    el.innerHTML += `<div class="rank-item">
      <div class="rank-pos rank-pos-${i+1}">${i+1}</div>
      <div class="rank-info">
        <div class="rank-name">${c.nome}</div>
        ${c.tel ? `<div class="rank-sub"><i class="fas fa-phone"></i> ${c.tel}</div>` : ''}
        <div class="rank-bar-wrap"><div class="rank-bar rank-bar-purple" style="width:${pct}%"></div></div>
      </div>
      <div class="rank-val">${c.qtd}x</div>
    </div>`;
  });
}

// Utilitário: datas para os rankings
function _calcularIntervalo(periodo, idI, idF) {
  const now = new Date();
  let inicio = null, fim = null;
  if (periodo === 'hoje') {
    inicio = now.toISOString().split('T')[0] + 'T00:00:00';
  } else if (periodo === '7') {
    const d = new Date(now); d.setDate(d.getDate()-7);
    inicio = d.toISOString().split('T')[0] + 'T00:00:00';
  } else if (periodo === '30') {
    const d = new Date(now); d.setDate(d.getDate()-30);
    inicio = d.toISOString().split('T')[0] + 'T00:00:00';
  } else if (periodo === 'mes') {
    inicio = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01T00:00:00`;
  } else if (periodo === 'custom') {
    const elI = document.getElementById(idI);
    const elF = document.getElementById(idF);
    if (elI?.value) inicio = elI.value + 'T00:00:00';
    if (elF?.value) fim    = elF.value + 'T23:59:59';
  }
  return { inicio, fim };
}

// ══════════════════════════════════════════════════════════
// PDV MOBILE — Tabs de navegação
// ══════════════════════════════════════════════════════════
function pdvMudarAba(aba, btn) {
  document.querySelectorAll('.pdv-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // No mobile, os painéis são os próprios elements dentro do pdv-panel-venda
  const map = { carrinho:'.pdv-carrinho', produtos:'.pdv-produtos', monitor:'.pdv-monitor' };
  Object.values(map).forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.classList.remove('pdv-tab-active');
  });
  const target = document.querySelector(map[aba]);
  if (target) target.classList.add('pdv-tab-active');
  
  // Se clicou em monitor, mostra o panel de mesas no mobile
  if (aba === 'monitor') {
    const panelMesas = document.getElementById('pdv-panel-mesas');
    const panelVenda = document.getElementById('pdv-panel-venda');
    if (panelMesas) panelMesas.style.display = 'block';
    if (panelVenda) panelVenda.style.display = 'none';
  } else {
    const panelMesas = document.getElementById('pdv-panel-mesas');
    const panelVenda = document.getElementById('pdv-panel-venda');
    if (panelMesas) panelMesas.style.display = 'none';
    if (panelVenda) panelVenda.style.display = 'block';
  }
}

function pdvMudarView(view) {
  const panelVenda = document.getElementById('pdv-panel-venda');
  const panelMesas = document.getElementById('pdv-panel-mesas');
  const btnVenda   = document.getElementById('pdv-view-btn-venda');
  const btnMesas   = document.getElementById('pdv-view-btn-mesas');
  if (view === 'venda') {
    if (panelVenda) panelVenda.style.display = 'block';
    if (panelMesas) panelMesas.style.display = 'none';
    if (btnVenda)   btnVenda.classList.add('active');
    if (btnMesas)   btnMesas.classList.remove('active');
  } else {
    if (panelVenda) panelVenda.style.display = 'none';
    if (panelMesas) panelMesas.style.display = 'block';
    if (btnVenda)   btnVenda.classList.remove('active');
    if (btnMesas)   btnMesas.classList.add('active');
    carregarMonitorMesas();
  }
}

function pdvIniciarTabs() {
  const isMobile = window.innerWidth <= 768;
  const tabsEl = document.getElementById('pdv-tabs');
  const footer = document.getElementById('pdv-mobile-footer');
  const headerBar = document.querySelector('.pdv-header-bar .pdv-view-btns');

  if (isMobile) {
    if (tabsEl) tabsEl.style.display = 'flex';
    if (footer) footer.style.display = 'flex';
    if (headerBar) headerBar.style.display = 'none';
    // Mobile começa mostrando o cardápio
    document.querySelectorAll('.pdv-tab-btn').forEach(b => b.classList.remove('active'));
    const btnCardapio = tabsEl ? tabsEl.querySelector('.pdv-tab-btn:nth-child(1)') : null;
    if (btnCardapio) { btnCardapio.classList.add('active'); }
    pdvMudarAba('produtos', null);
  } else {
    if (tabsEl) tabsEl.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (headerBar) headerBar.style.display = 'flex';
    // Desktop: mostra produtos e carrinho sempre
    ['.pdv-carrinho', '.pdv-produtos'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.classList.add('pdv-tab-active');
    });
    const panelVenda = document.getElementById('pdv-panel-venda');
    if (panelVenda) panelVenda.style.display = 'block';
  }
}

async function logout() {
  const { error } = await supa.auth.signOut();
  if (error) alert('Erro ao sair: ' + error.message);
  else window.location.href = 'login.html';
}

// =========================================
// 9. VENDA BALCÃO (NOVA VERSÃO VISUAL)
// =========================================

// =========================================
// 9. VENDA BALCÃO (VISUAL / NOVO)
// =========================================
let carrinhoPDV = [];
let produtosCachePDV = [];
// Cotação carregada das configurações (fallback 1100)
let _cotacaoPDV = 1100;

async function carregarPDV() {
  // PDV carrega TODOS os produtos ativos (incluindo somente_balcao e pausados não)
  const { data } = await supa
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .neq('pausado', true)
    .order('categoria_slug')
    .order('nome');
  produtosCachePDV = data || [];

  // Carrega categorias para exibir no PDV
  const { data: cats } = await supa.from('categorias').select('*').order('ordem');
  produtosCatsPDV = cats || [];

  // Carrega cotação atual das configurações
  const { data: cfg } = await supa.from('configuracoes').select('cotacao_real').single();
  if (cfg && cfg.cotacao_real) _cotacaoPDV = Number(cfg.cotacao_real);

  renderizarGridPDV();
  atualizarBarraMesasAtivas();
  pdvIniciarTabs();
}

let produtosCatsPDV = [];

let _pdvCatFiltro = 'todos';

function renderizarGridPDV(filtroNome = '') {
  const grid = document.getElementById('pdv-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Gera chips de categoria
  const filterBar = document.getElementById('pdv-cat-filter');
  if (filterBar) {
    filterBar.innerHTML = '';
    const allChip = document.createElement('button');
    allChip.className = `pdv-cat-chip${_pdvCatFiltro === 'todos' ? ' active' : ''}`;
    allChip.textContent = 'TODOS';
    allChip.onclick = () => { _pdvCatFiltro = 'todos'; renderizarGridPDV(document.getElementById('pdv-busca')?.value || ''); };
    filterBar.appendChild(allChip);

    const slugsUsados = [...new Set(produtosCachePDV.map(p => p.categoria_slug).filter(Boolean))];
    const ordemCats = produtosCatsPDV.map(c => c.slug);
    slugsUsados.sort((a,b) => {
      const ia = ordemCats.indexOf(a), ib = ordemCats.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1; if (ib === -1) return -1;
      return ia - ib;
    });
    slugsUsados.forEach(slug => {
      const catInfo = produtosCatsPDV.find(c => c.slug === slug);
      const chip = document.createElement('button');
      chip.className = `pdv-cat-chip${_pdvCatFiltro === slug ? ' active' : ''}`;
      chip.textContent = (catInfo?.nome_exibicao || slug).toUpperCase();
      chip.onclick = () => { _pdvCatFiltro = slug; renderizarGridPDV(document.getElementById('pdv-busca')?.value || ''); };
      filterBar.appendChild(chip);
    });
  }

  // Filtra produtos
  const query = filtroNome.toLowerCase().trim();
  let produtos = produtosCachePDV.filter(p => {
    if (_pdvCatFiltro !== 'todos' && p.categoria_slug !== _pdvCatFiltro) return false;
    if (query && !p.nome.toLowerCase().includes(query)) return false;
    return true;
  });

  if (_pdvCatFiltro !== 'todos' || query) {
    // Flat grid sem cabeçalhos de categoria
    const row = document.createElement('div');
    row.className = 'pdv-cat-row';
    produtos.forEach(p => {
      row.appendChild(_criarCardPDV(p));
    });
    if (produtos.length === 0) {
      row.innerHTML = `<p style="color:#aaa;grid-column:1/-1;text-align:center;padding:20px">Nenhum produto encontrado</p>`;
    }
    grid.appendChild(row);
    return;
  }

  // Agrupa por categoria
  const porCategoria = {};
  produtosCachePDV.forEach((p) => {
    const cat = p.categoria_slug || 'outros';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(p);
  });

  const ordemCats = produtosCatsPDV.map((c) => c.slug);
  const slugsOrdenados = Object.keys(porCategoria).sort((a, b) => {
    const ia = ordemCats.indexOf(a), ib = ordemCats.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1; if (ib === -1) return -1;
    return ia - ib;
  });

  slugsOrdenados.forEach((slug) => {
    const catInfo = produtosCatsPDV.find((c) => c.slug === slug);
    const catNome = catInfo ? catInfo.nome_exibicao : slug;

    const h = document.createElement('div');
    h.className = 'pdv-cat-header';
    h.textContent = catNome;
    grid.appendChild(h);

    const row = document.createElement('div');
    row.className = 'pdv-cat-row';
    porCategoria[slug].forEach((p) => row.appendChild(_criarCardPDV(p)));
    grid.appendChild(row);
  });
}

function _criarCardPDV(p) {
  const img = p.imagem_url || '';
  const card = document.createElement('div');
  card.className = 'pdv-card';
  if (img) card.style.backgroundImage = `url('${img}')`;
  else card.classList.add('pdv-card-noimg');
  card.title = p.nome;
  card.onclick = () => adicionarItemPDV(p);
  card.innerHTML = `
    <div class="pdv-card-price">Gs ${p.preco.toLocaleString('es-PY')}</div>
    <div class="pdv-card-overlay">${p.nome}</div>
  `;
  return card;
}

function filtrarPDV(valor) {
  renderizarGridPDV(valor);
}

function adicionarItemPDV(p) {
  // Verifica se produto tem variações
  const cfg = p.montagem_config;
  const tipo = cfg && !Array.isArray(cfg) && cfg.__tipo ? cfg.__tipo : null;
  if (tipo === 'variacoes' && cfg.variacoes && cfg.variacoes.length > 0) {
    const variacoesAtivas = cfg.variacoes.filter(v => v.ativo !== false);
    if (variacoesAtivas.length === 0) {
      alert('⏸️ Todas as variações deste produto estão pausadas.');
      return;
    }
    _mostrarModalVariacaoPDV(p, variacoesAtivas);
    return;
  }
  const existe = carrinhoPDV.find((i) => i.id === p.id && !i.variacao);
  if (existe) existe.qtd++;
  else carrinhoPDV.push({ ...p, qtd: 1 });
  atualizarCarrinhoPDV();
}

function _mostrarModalVariacaoPDV(produto, variacoes) {
  // Remove modal anterior se existir
  document.getElementById('pdv-var-modal')?.remove();

  // ── Overlay ────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'pdv-var-modal';
  overlay.style.cssText = [
    'position:fixed;inset:0;background:rgba(0,0,0,0.55)',
    'z-index:99999;display:flex;align-items:center',
    'justify-content:center;padding:16px',
  ].join(';');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // ── Modal container ────────────────────────────────────────────────
  const modal = document.createElement('div');
  modal.style.cssText = [
    'background:#fff;border-radius:16px;padding:20px',
    'max-width:420px;width:100%;max-height:80vh',
    'overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)',
  ].join(';');

  // ── Cabeçalho ──────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px';

  const titulo = document.createElement('div');
  titulo.innerHTML = `
    <h4 style="margin:0;font-size:1rem;color:#333">🎨 Escolha a variação</h4>
    <p style="margin:4px 0 0;font-size:0.88rem;color:#666">${produto.nome}</p>
  `;

  const btnFechar = document.createElement('button');
  btnFechar.textContent = '✕';
  btnFechar.style.cssText = 'background:none;border:none;font-size:1.3rem;cursor:pointer;color:#999;flex-shrink:0;padding:4px 8px;border-radius:6px';
  btnFechar.addEventListener('click', () => overlay.remove());

  header.appendChild(titulo);
  header.appendChild(btnFechar);
  modal.appendChild(header);

  // ── Lista de variações — 100% DOM, zero inline-onclick ────────────
  const lista = document.createElement('div');
  lista.style.cssText = 'display:flex;flex-direction:column;gap:10px';

  variacoes.forEach((variacao) => {
    // Captura variacao e produto via closure — sem serialização HTML
    const btn = document.createElement('button');
    btn.style.cssText = [
      'display:flex;align-items:center;gap:12px',
      'background:#f9f9f9;border:2px solid #e5e7eb',
      'border-radius:10px;padding:10px 14px',
      'cursor:pointer;text-align:left;width:100%',
      'transition:border-color 0.15s,box-shadow 0.15s',
    ].join(';');

    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = 'var(--primary, #FF441F)';
      btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = '#e5e7eb';
      btn.style.boxShadow = 'none';
    });

    // Imagem — src atribuído via .src, nunca via innerHTML com dados externos
    const imgSrc = variacao.img || produto.imagem_url || '';
    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc;
      img.style.cssText = 'width:52px;height:52px;border-radius:8px;object-fit:cover;flex-shrink:0';
      img.addEventListener('error', () => img.style.display = 'none');
      btn.appendChild(img);
    }

    // Informações de texto
    const info = document.createElement('div');
    info.style.flex = '1';

    const nomeEl = document.createElement('div');
    nomeEl.textContent = variacao.nome; // .textContent = seguro contra XSS
    nomeEl.style.cssText = 'font-weight:700;font-size:0.9rem;color:#333';

    const precoEl = document.createElement('div');
    const precoFinal = variacao.preco || produto.preco;
    precoEl.textContent = `Gs ${precoFinal.toLocaleString('es-PY')}`;
    precoEl.style.cssText = 'font-size:0.82rem;color:var(--primary, #FF441F);font-weight:600;margin-top:2px';

    info.appendChild(nomeEl);
    info.appendChild(precoEl);
    btn.appendChild(info);

    // ── Ação de adicionar ao carrinho — closure captura variacao e produto ──
    btn.addEventListener('click', () => {
      const chave = variacao.nome; // identifica variação
      const existe = carrinhoPDV.find(
        (i) => i.id === produto.id && i.variacao === chave
      );

      if (existe) {
        existe.qtd++;
      } else {
        carrinhoPDV.push({
          ...produto,
          preco:    precoFinal,
          qtd:      1,
          variacao: chave,
        });
      }

      atualizarCarrinhoPDV();
      overlay.remove();
    });

    lista.appendChild(btn);
  });

  modal.appendChild(lista);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function removerItemPDV(idx) {
  carrinhoPDV.splice(idx, 1);
  atualizarCarrinhoPDV();
}

function atualizarCarrinhoPDV() {
  const lista    = document.getElementById('pdv-lista');
  const totalEl  = document.getElementById('balcao-total');
  if (!lista) return;

  lista.innerHTML = '';
  let total = 0;

  // ── Itens existentes da mesa (snapshot do DB) ──────────────────
  const itensExistentes = window._mesaAbertaPedido
    ? (Array.isArray(window._mesaAbertaPedido.itens) ? window._mesaAbertaPedido.itens : [])
    : [];

  if (itensExistentes.length > 0) {
    const secTitle = document.createElement('div');
    secTitle.className = 'pdv-sec-title';
    secTitle.textContent = 'Itens já lançados';
    lista.appendChild(secTitle);

    itensExistentes.forEach((item, idx) => {
      const entregue  = item.status_item === 'entregue';
      const qtd       = item.qtd || item.q || 1;
      const nome      = item.nome || item.n || 'Item';
      const preco     = item.preco || item.p || 0;
      total += preco * qtd;

      const row = document.createElement('div');
      row.className = 'pdv-item-row pdv-item-existente' + (entregue ? ' pdv-item-entregue' : '');
      row.innerHTML = `
        <div class="pdv-item-info">
          <strong>${qtd}x</strong> ${nome}
          ${entregue ? '<span class="badge-entregue">✓ Entregue</span>' : ''}
        </div>
        <div class="pdv-item-acoes">
          <span>Gs ${(preco * qtd).toLocaleString('es-PY')}</span>
          ${!entregue ? `
            <button class="btn btn-sm btn-success pdv-btn-baixar"
              title="Marcar como entregue"
              onclick="baixarItemMesa(${window._mesaAbertaId}, ${idx})">
              <i class="fas fa-check"></i>
            </button>` : ''}
        </div>`;
      lista.appendChild(row);
    });
  }

  // ── Novos itens sendo adicionados (carrinhoPDV) ────────────────
  if (carrinhoPDV.length > 0) {
    const secTitle2 = document.createElement('div');
    secTitle2.className = 'pdv-sec-title pdv-sec-novo';
    secTitle2.textContent = itensExistentes.length > 0 ? '+ Novos itens' : 'Itens do pedido';
    lista.appendChild(secTitle2);

    carrinhoPDV.forEach((item, idx) => {
      total += item.preco * item.qtd;
      const row = document.createElement('div');
      row.className = 'pdv-item-row';
      row.innerHTML = `
        <div class="pdv-item-info"><strong>${item.qtd}x</strong> ${item.nome}</div>
        <div class="pdv-item-acoes">
          <span>Gs ${(item.preco * item.qtd).toLocaleString('es-PY')}</span>
          <button class="btn btn-sm btn-danger" onclick="removerItemPDV(${idx})">✕</button>
        </div>`;
      lista.appendChild(row);
    });
  }

  if (itensExistentes.length === 0 && carrinhoPDV.length === 0) {
    lista.innerHTML = '<p class="pdv-lista-vazio">Nenhum item adicionado.</p>';
  }

  if (totalEl) totalEl.innerText = total.toLocaleString('es-PY');
  
  // Atualiza barra inferior mobile
  const mobileQtd = document.getElementById('pdv-mobile-qtd');
  const mobileTot = document.getElementById('pdv-mobile-total-val');
  const qtdTotal = carrinhoPDV.reduce((a, i) => a + i.qtd, 0);
  if (mobileQtd) mobileQtd.textContent = qtdTotal + (qtdTotal === 1 ? ' item' : ' itens');
  if (mobileTot) mobileTot.textContent = total.toLocaleString('es-PY');
  
  atualizarInfoPagPDV(total);
}

function atualizarInfoPagPDV(total) {
  const pag = document.getElementById('balcao-pag')?.value;
  const infoBox = document.getElementById('balcao-pag-info');
  if (!infoBox) return;

  if (pag === 'Pix' && total > 0) {
    const valorReais = (total / _cotacaoPDV).toFixed(2);
    infoBox.style.display = 'block';
    infoBox.innerHTML = `<i class="fas fa-qrcode"></i> <strong>Cobrar em Pix: R$ ${valorReais}</strong>`;
  } else {
    infoBox.style.display = 'none';
  }
}

async function salvarPedidoBalcao() {
  if (carrinhoPDV.length === 0 && !window._mesaAbertaId) return alert('Carrinho vazio!');
  if (carrinhoPDV.length === 0 && window._mesaAbertaId) return alert('Adicione ao menos 1 novo item antes de lançar.');

  const mesa = document.getElementById('balcao-mesa').value.trim();
  if (!mesa) {
    alert('⚠️ Número de mesa é obrigatório!');
    document.getElementById('balcao-mesa').focus();
    return;
  }

  const cli      = document.getElementById('balcao-cliente').value || 'Cliente';
  const tel      = document.getElementById('balcao-telefone').value || '';
  const pag      = document.getElementById('balcao-pag').value;
  const nomeFinal = `MESA ${mesa} - ${cli}`;

  // ── Novos itens ganham status_item: 'pendente' ─────────────────
  const novosItens = carrinhoPDV.map((i) => ({
    id:           i.id || Date.now() + Math.random(),
    nome:         i.nome,
    preco:        i.preco,
    qtd:          i.qtd,
    montagem:     i.montagem || [],
    obs:          i.obs     || '',
    status_item:  'pendente',   // ← campo de status por item
    lancado_em:   new Date().toISOString(),
  }));

  if (window._mesaAbertaId) {
    // ── UPDATE: mantém itens existentes (com seus status_item atuais)
    //           e acrescenta apenas os novos itens pendentes ──────────
    const itensExistentes = Array.isArray(window._mesaAbertaPedido?.itens)
      ? window._mesaAbertaPedido.itens
      : [];

    const itensMerged = [...itensExistentes, ...novosItens];
    const novoTotal   = itensMerged.reduce((acc, i) => acc + ((i.preco || 0) * (i.qtd || 1)), 0);

    const { error } = await supa.from('pedidos').update({
      itens:           itensMerged,
      total_geral:     novoTotal,
      subtotal:        novoTotal,
      forma_pagamento: pag,
      cliente_nome:    nomeFinal,
      cliente_telefone: tel,
      status:          'em_preparo',
    }).eq('id', window._mesaAbertaId);

    if (error) {
      alert('Erro ao atualizar mesa: ' + error.message);
      return;
    }

    // Reset
    window._mesaAbertaId     = null;
    window._mesaAbertaTotal  = 0;
    window._mesaAbertaPedido = null;
    carrinhoPDV = [];
    document.getElementById('balcao-cliente').value   = '';
    document.getElementById('balcao-mesa').value      = '';
    document.getElementById('balcao-telefone').value  = '';
    document.querySelector('.pdv-mesa-aviso')?.remove();
    atualizarCarrinhoPDV();
    atualizarBarraMesasAtivas();
    carregarMonitorMesas();
    alert(`✅ ${novosItens.length} item(s) enviado(s) para a cozinha!`);
    return;
  }

  // ── INSERT: novo pedido de balcão ─────────────────────────────
  const totalNovo = novosItens.reduce((acc, i) => acc + i.preco * i.qtd, 0);
  const pedido = {
    uid_temporal:         `BALC-${Math.floor(Math.random() * 1000)}`,
    status:               'em_preparo',
    tipo_entrega:         'balcao',
    total_geral:          totalNovo,
    subtotal:             totalNovo,
    frete_cobrado_cliente: 0,
    forma_pagamento:      pag,
    itens:                novosItens,
    endereco_entrega:     `Mesa ${mesa}`,
    cliente_nome:         nomeFinal,
    cliente_telefone:     tel,
    obs_pagamento:        'Pagamento no Balcão',
  };

  const { error } = await supa.from('pedidos').insert([pedido]);
  if (error) {
    alert('Erro: ' + error.message);
    return;
  }

  carrinhoPDV = [];
  document.getElementById('balcao-cliente').value  = '';
  document.getElementById('balcao-mesa').value     = '';
  document.getElementById('balcao-telefone').value = '';
  atualizarCarrinhoPDV();
  atualizarBarraMesasAtivas();
  carregarMonitorMesas();
  alert('Pedido enviado para a Cozinha! 👨‍🍳');
}


// ── Barra de Mesas Ativas no PDV ─────────────────────────────
async function atualizarBarraMesasAtivas() {
  const bar = document.getElementById('pdv-mesas-bar');
  const vazio = document.getElementById('pdv-mesas-vazio');
  if (!bar) return;

  const { data } = await supa
    .from('pedidos')
    .select('id, endereco_entrega, cliente_nome, total_geral, status, itens')
    .eq('tipo_entrega', 'balcao')
    .neq('status', 'entregue')
    .neq('status', 'cancelado')
    .order('id', { ascending: true });

  // Limpar chips anteriores (manter apenas label e span vazio)
  bar.querySelectorAll('.mesa-chip').forEach((c) => c.remove());
  if (vazio) vazio.style.display = data && data.length > 0 ? 'none' : 'inline';

  if (!data || data.length === 0) return;

  data.forEach((p) => {
    const nrMesa = (p.endereco_entrega || '').replace('Mesa ', '') || p.id;
    const chip = document.createElement('button');
    chip.className = 'mesa-chip' +
      (p.status === 'pronto_entrega' ? ' mesa-pronto' :
       p.status === 'em_preparo' ? ' mesa-em-preparo' : '');
    chip.title = `${p.cliente_nome || 'Mesa ' + nrMesa} — Gs ${(p.total_geral || 0).toLocaleString('es-PY')} — Clique para adicionar itens`;
    chip.innerHTML = `<span class="mesa-chip-num">${nrMesa}</span><span class="mesa-chip-status">${
      p.status === 'pronto_entrega' ? '✓ Pronto' :
      p.status === 'em_preparo' ? '🔥' : '●'
    }</span>`;
    chip.onclick = () => abrirMesaExistente(p);
    bar.appendChild(chip);
  });
}

// Abre uma mesa existente no carrinho PDV para adicionar mais itens
function abrirMesaExistente(pedido) {
  const nrMesa = (pedido.endereco_entrega || '').replace('Mesa ', '') || '';
  const nomeCli = (pedido.cliente_nome || '').replace(/^MESA \d+ - /i, '');

  // Preenche os campos
  const elMesa = document.getElementById('balcao-mesa');
  const elCli  = document.getElementById('balcao-cliente');
  if (elMesa) elMesa.value = nrMesa;
  if (elCli)  elCli.value  = nomeCli === 'Cliente' ? '' : nomeCli;

  // ──────────────────────────────────────────────────────────────────
  // MUDANÇA: carrinhoPDV fica VAZIO — só recebe os NOVOS itens.
  // Os itens existentes ficam em window._mesaAbertaPedido (snapshot do DB).
  // Na hora do save, fazemos merge: existentes (intactos) + novos (pendente).
  // ──────────────────────────────────────────────────────────────────
  carrinhoPDV = [];
  window._mesaAbertaId     = pedido.id;
  window._mesaAbertaTotal  = pedido.total_geral || 0;
  window._mesaAbertaPedido = pedido; // guarda snapshot completo

  atualizarCarrinhoPDV();

  // Scroll para o topo do PDV
  const pdv = document.getElementById('pdv');
  if (pdv) pdv.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Aviso visual
  const aviso = document.createElement('div');
  aviso.className = 'pdv-mesa-aviso';
  aviso.innerHTML = `<i class="fas fa-edit"></i> Editando Mesa ${nrMesa} — adicione os NOVOS itens e clique em Lançar`;
  const existing = pdv?.querySelector('.pdv-mesa-aviso');
  if (existing) existing.remove();
  const h4 = pdv?.querySelector('.pdv-carrinho-titulo');
  if (h4) h4.after(aviso);
  setTimeout(() => aviso?.remove(), 8000);
}

async function carregarMonitorMesas() {
  // Atualiza barra de chips de mesas no PDV junto com o monitor
  atualizarBarraMesasAtivas();
  // Busca pedidos de Balcão que NÃO foram finalizados (entregues)
  const { data } = await supa
    .from('pedidos')
    .select('*')
    .eq('tipo_entrega', 'balcao')
    .neq('status', 'entregue') // Traz 'pendente', 'em_preparo' e 'pronto_entrega'
    .order('id', { ascending: false });

  const div = document.getElementById('lista-mesas-andamento');
  if (!div) return;

  div.innerHTML = '';

  if (!data || data.length === 0) {
    div.innerHTML = '<p class="mesa-monitor-vazio">Nenhum pedido ativo.</p>';
    return;
  }

  data.forEach((p) => {
    let statusHtml = '';
    let acaoHtml = '';
    let cardClass = 'mesa-monitor-card';

    // Lógica Visual do Status — usa classes CSS
    if (p.status === 'em_preparo') {
      cardClass += ' mesa-preparo';
      statusHtml = '<span class="mesa-monitor-status-cozinha"><i class="fas fa-fire"></i> Na Cozinha</span>';
      acaoHtml = '<small class="mesa-monitor-status-cozinha">Aguardando cozinha...</small>';
    } else if (p.status === 'pronto_entrega') {
      cardClass += ' mesa-pronta';
      statusHtml = '<span class="mesa-monitor-status-pronto"><i class="fas fa-check-circle"></i> PRONTO!</span>';
      acaoHtml = `<button class="btn btn-sm btn-success btn-block-pdv" onclick="finalizarMesa(${p.id})">Entregar / Baixar</button>`;
    } else {
      statusHtml = `<span class="mesa-monitor-valor">${p.status}</span>`;
    }

    const nrMesa = (p.endereco_entrega || '').replace('Mesa ', '') || (p.uid_temporal || p.id);

    // Lista de itens com status visual por item
    const itens = Array.isArray(p.itens) ? p.itens : [];
    const pendentes = itens.filter((i) => !i.status_item || i.status_item === 'pendente');
    const entregues = itens.filter((i) => i.status_item === 'entregue');

    let itensListHtml = itens.map((item, idx) => {
      const isEntregue = item.status_item === 'entregue';
      const nome = item.nome || item.n || 'Item';
      const qtd  = item.qtd  || item.q  || 1;
      return `
        <div class="monitor-item-row ${isEntregue ? 'monitor-item-entregue' : ''}">
          <span class="monitor-item-nome">${qtd}x ${nome}</span>
          ${isEntregue
            ? '<span class="monitor-item-badge-entregue">✓ Entregue</span>'
            : `<button class="btn btn-xs btn-outline-success monitor-btn-baixar"
                title="Marcar como entregue"
                onclick="baixarItemMesa(${p.id}, ${idx})">
                <i class="fas fa-check"></i>
               </button>`}
        </div>`;
    }).join('');

    // Contador de pendentes no cabeçalho
    const cntPendente = pendentes.length > 0
      ? `<span class="mesa-monitor-cnt-pendente">${pendentes.length} pendente${pendentes.length > 1 ? 's' : ''}</span>`
      : '';

    const card = document.createElement('div');
    card.className = cardClass;
    card.innerHTML = `
      <div class="mesa-monitor-titulo">Mesa ${nrMesa} ${cntPendente}</div>
      <div class="mesa-monitor-cliente">${p.cliente_nome || '-'}</div>
      <div class="mesa-monitor-itens-lista">${itensListHtml}</div>
      <div class="mesa-monitor-rodape">
        ${statusHtml}
        <span class="mesa-monitor-valor">Gs ${(p.total_geral || 0).toLocaleString('es-PY')}</span>
      </div>
      ${acaoHtml}
    `;
    div.appendChild(card);
  });
}

// ── Baixa parcial: marca 1 item como 'entregue' no banco ──────────
// idx = índice do item dentro do array p.itens no banco
async function baixarItemMesa(pedidoId, itemIdx) {
  // Busca snapshot mais recente do banco (evita conflito de estado stale)
  const { data: p, error: errFetch } = await supa
    .from('pedidos').select('itens, total_geral').eq('id', pedidoId).single();
  if (errFetch || !p) { alert('Erro ao buscar comanda.'); return; }

  const itens = Array.isArray(p.itens) ? [...p.itens] : [];
  if (!itens[itemIdx]) return;

  // Muda status do item específico
  itens[itemIdx] = { ...itens[itemIdx], status_item: 'entregue' };

  const { error } = await supa
    .from('pedidos').update({ itens }).eq('id', pedidoId);

  if (error) { alert('Erro ao baixar item: ' + error.message); return; }

  // Atualiza o snapshot local e re-renderiza o carrinho PDV
  if (window._mesaAbertaPedido && window._mesaAbertaId === pedidoId) {
    window._mesaAbertaPedido = { ...window._mesaAbertaPedido, itens };
    atualizarCarrinhoPDV();
  }
  // Atualiza o monitor de mesas sem precisar recarregar tudo
  atualizarBarraMesasAtivas();
}

// Função para dar baixa na mesa (Muda status para 'entregue' e sai da lista)
async function finalizarMesa(id) {
  if (confirm('Confirmar entrega e pagamento desta mesa?')) {
    await supa.from('pedidos').update({ status: 'entregue' }).eq('id', id);
    carregarMonitorMesas();
    // Se estiver na aba financeiro, atualiza também
    if (typeof calcularFinanceiro === 'function') calcularFinanceiro();
  }
}

// Utilitários de Modal e Checkbox
function fecharModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function toggleTodos(s) {
  document.querySelectorAll('.check-pedido').forEach((c) => (c.checked = s.checked));
}

// Clique fora do modal fecha
window.onclick = function (event) {
  if (event.target.classList.contains('modal-overlay')) {
    event.target.classList.remove('active');
    event.target.style.display = 'none';
  }
};

// ESC fecha modal
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    document
      .querySelectorAll('.modal-overlay.active, .modal-overlay[style*="flex"]')
      .forEach((modal) => {
        modal.classList.remove('active');
        modal.style.display = 'none';
      });
  }
});

// =========================================
// 10. GESTÃO DE EQUIPE
// =========================================
async function carregarEquipe() {
  const { data } = await supa.from('perfis_acesso').select('*').order('cargo');

  const tbody = document.getElementById('lista-equipe');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (data) {
    data.forEach((u) => {
      const dataCriacao = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-';
      const ehDono = u.cargo === 'dono';
      const ehGerente = u.cargo === 'gerente';
      const ehFuncionario = u.cargo === 'funcionario';

      // Botão de promoção/rebaixamento (só dono pode gerenciar)
      let acaoCargo = '';
      if (!ehDono && perfilUsuario === 'dono') {
        if (ehFuncionario) {
          acaoCargo = `<button class="btn btn-sm btn-success" onclick="promoverUsuario('${u.id}', 'gerente')" title="Promover a Gerente"><i class="fas fa-arrow-up"></i> Gerente</button>`;
        } else if (ehGerente) {
          acaoCargo = `<button class="btn btn-sm btn-warning" onclick="promoverUsuario('${u.id}', 'funcionario')" title="Rebaixar a Funcionário"><i class="fas fa-arrow-down"></i> Funcionário</button>`;
        }
        acaoCargo += ` <button class="btn btn-sm btn-danger" onclick="excluirUsuario('${u.id}', '${u.email}')" title="Excluir"><i class="fas fa-trash"></i></button>`;
      }

      const cargoBadge = ehDono ? '🔑 Dono' : ehGerente ? '👔 Gerente' : '👷 Funcionário';
      tbody.innerHTML += `<tr>
                <td>${u.email}</td>
                <td>${cargoBadge}</td>
                <td>${dataCriacao}</td>
                <td>${acaoCargo}</td>
            </tr>`;
    });
  }
}

async function promoverUsuario(id, novoCargo) {
  const msg =
    novoCargo === 'gerente'
      ? 'Promover este usuário a Gerente?'
      : 'Rebaixar este usuário a Funcionário?';
  if (!confirm(msg)) return;

  const { error } = await supa.from('perfis_acesso').update({ cargo: novoCargo }).eq('id', id);
  if (error) {
    alert('❌ Erro: ' + error.message);
  } else {
    alert(`✅ Cargo alterado para ${novoCargo}!`);
    carregarEquipe();
  }
}

async function excluirUsuario(id, email) {
  if (
    !confirm(
      `⚠️ Excluir o usuário "${email}"?\n\nEsta ação remove apenas o perfil. O acesso de autenticação pode precisar ser revogado no Supabase Dashboard.`,
    )
  )
    return;

  const { error } = await supa.from('perfis_acesso').delete().eq('id', id);
  if (error) {
    alert('❌ Erro ao excluir: ' + error.message);
  } else {
    alert('✅ Usuário excluído com sucesso!');
    carregarEquipe();
  }
}

async function cadastrarUsuario() {
  const email = document.getElementById('novo-user-email')?.value?.trim();
  const senha = document.getElementById('novo-user-senha')?.value;
  const cargo = document.getElementById('novo-user-cargo')?.value;

  if (!email || !senha || senha.length < 6)
    return alert('Email e senha (mín. 6 caracteres) são obrigatórios');

  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Criando...';
  }

  try {
    // 1. Cria usuário na Autenticação do Supabase
    const { data, error } = await supa.auth.signUp({ email, password: senha });

    if (error) {
      alert('❌ Erro ao criar usuário: ' + error.message);
      return;
    }

    if (data.user) {
      // 2. Salva perfil no banco usando upsert para evitar duplicata de chave
      const { error: errPerfil } = await supa
        .from('perfis_acesso')
        .upsert([{ id: data.user.id, email, cargo }], { onConflict: 'id' });

      if (errPerfil) {
        alert('⚠️ Usuário de autenticação criado, mas erro ao salvar perfil: ' + errPerfil.message);
      } else {
        alert('✅ Usuário cadastrado com sucesso!\n\nO usuário receberá um email de confirmação.');
        document.getElementById('novo-user-email').value = '';
        document.getElementById('novo-user-senha').value = '';
        carregarEquipe();
      }
    } else {
      alert('⚠️ Usuário criado. Aguardando confirmação de email para ativar.');
    }
  } catch (e) {
    alert('❌ Erro inesperado: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-user-plus"></i> Criar';
    }
  }
}

function addBuilderStep(titulo = '', max = 1, itens = []) {
  const container = document.getElementById('builder-steps');
  const index = container.children.length;

  const stepDiv = document.createElement('div');
  stepDiv.className = 'builder-step-card';
  stepDiv.innerHTML = `
        <div class="builder-step-header">
            <h4>Etapa ${index + 1}</h4>
            <button type="button" class="btn-remove-step" onclick="removerEtapa(${index})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        
        <div class="builder-step-body">
            <!-- NOME DA ETAPA -->
            <div class="form-group">
                <label>Nome da Etapa</label>
                <input type="text" class="etapa-titulo input-modern" 
                       value="${titulo}" 
                       placeholder="Ex: Base, Proteína, Molho...">
            </div>
            
            <!-- QUANTIDADE MÁXIMA -->
            <div class="form-group">
                <label>Quantidade Máxima de Itens</label>
                <input type="number" class="etapa-max input-modern" 
                       value="${max}" min="1" 
                       placeholder="Ex: 1">
                <small>Cliente poderá escolher até este número de itens</small>
            </div>
            
            <!-- LISTA DE ITENS -->
            <div class="form-group">
                <label>Itens Disponíveis</label>
                <div class="itens-list" id="itens-list-${index}">
                    ${itens
                      .map(
                        (item, i) => `
                        <div class="item-row">
                            <input type="text" class="input-modern" value="${item}" 
                                   placeholder="Nome do item">
                            <button type="button" class="btn-remove-item" 
                                    onclick="removerItem(${index}, ${i})">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `,
                      )
                      .join('')}
                </div>
                <button type="button" class="btn-add-item" onclick="adicionarItem(${index})">
                    <i class="fas fa-plus"></i> Adicionar Item
                </button>
            </div>
        </div>
    `;

  container.appendChild(stepDiv);
}

function adicionarItem(etapaIndex) {
  const lista = document.getElementById(`itens-list-${etapaIndex}`);
  const itemDiv = document.createElement('div');
  itemDiv.className = 'item-row';
  itemDiv.innerHTML = `
        <input type="text" class="input-modern" placeholder="Nome do item">
        <button type="button" class="btn-remove-item" 
                onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
  lista.appendChild(itemDiv);
}

function removerEtapa(index) {
  if (confirm('Remover esta etapa?')) {
    const container = document.getElementById('builder-steps');
    container.children[index].remove();
  }
}

// CARREGAR CUPONS
async function carregarCupons() {
  const { data } = await supa.from('cupons').select('*').order('created_at', { ascending: false });
  const tbody = document.getElementById('lista-cupons');

  if (!tbody) return;
  tbody.innerHTML = '';

  (data || []).forEach((c) => {
    const tipoLabel = c.tipo === 'percentual' ? `${c.valor}%` : 'Frete Grátis';
    const statusBadge = c.ativo
      ? '<span class="badge badge-success">Ativo</span>'
      : '<span class="badge badge-danger">Inativo</span>';

    // Uso / limite
    const usosRealizados = c.usos_realizados || c.usos_atual || 0;
    let usoHtml;
    if (c.limite_uso && c.limite_uso > 0) {
      const restante = c.limite_uso - usosRealizados;
      const esgotado  = restante <= 0;
      usoHtml = `
        <div style="font-size:0.82rem">
          <span style="font-weight:700;color:${esgotado ? '#e74c3c' : '#27ae60'}">${usosRealizados}/${c.limite_uso}</span>
          ${esgotado ? '<span class="badge badge-danger" style="font-size:0.65rem">Esgotado</span>' : `<span style="color:#888;font-size:0.72rem">(${restante} restantes)</span>`}
        </div>`;
    } else {
      usoHtml = `<span style="color:#aaa;font-size:0.82rem">${usosRealizados} usos / ∞</span>`;
    }

    // Validade
    let validadeHtml = '<span style="color:#ccc;font-size:0.8rem">—</span>';
    if (c.validade) {
      const vDate    = new Date(c.validade + 'T00:00:00');
      const hoje     = new Date();
      hoje.setHours(0,0,0,0);
      const expirado = vDate < hoje;
      validadeHtml   = `<span style="font-size:0.8rem;color:${expirado ? '#e74c3c' : '#555'}">${vDate.toLocaleDateString('pt-BR')}${expirado ? ' <em style=\'font-size:0.7rem\'>(Expirado)</em>' : ''}</span>`;
    }

    tbody.innerHTML += `
            <tr>
                <td><strong>${c.codigo}</strong></td>
                <td>${c.tipo === 'percentual' ? 'Percentual' : 'Frete Grátis'}</td>
                <td>${tipoLabel}</td>
                <td>Gs ${c.minimo.toLocaleString('es-PY')}</td>
                <td>${usoHtml}</td>
                <td>${validadeHtml}</td>
                <td>${statusBadge}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-primary" onclick='editarCupom(${JSON.stringify(c)})'>
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deletarCupom(${c.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
  });
}

// ABRIR MODAL CUPOM
function abrirModalCupom(cupom = null) {
  document.getElementById('cupom-id').value = cupom ? cupom.id : '';
  document.getElementById('cupom-codigo').value = cupom ? cupom.codigo : '';
  document.getElementById('cupom-tipo').value = cupom ? cupom.tipo : 'percentual';
  document.getElementById('cupom-valor').value = cupom ? cupom.valor : '';
  document.getElementById('cupom-minimo').value = cupom ? cupom.minimo : '';
  document.getElementById('cupom-ativo').checked = cupom ? cupom.ativo : true;
  // Limite de usos e validade
  document.getElementById('cupom-limite').value   = cupom?.limite_uso  ?? '';
  document.getElementById('cupom-validade').value = cupom?.validade    ? cupom.validade.split('T')[0] : '';

  alterarTipoCupom();

  const modal = document.getElementById('modal-cupom');
  modal.style.display = 'flex';
  modal.classList.add('active');
}

function editarCupom(cupom) {
  abrirModalCupom(cupom);
}

function alterarTipoCupom() {
  const tipo = document.getElementById('cupom-tipo').value;
  const boxValor = document.getElementById('box-valor-cupom');
  boxValor.style.display = tipo === 'percentual' ? 'block' : 'none';
}

// SALVAR CUPOM
async function salvarCupom() {
  const id = document.getElementById('cupom-id').value;
  const limiteRaw = parseInt(document.getElementById('cupom-limite').value);
  const validadeRaw = document.getElementById('cupom-validade').value;

  const dados = {
    codigo:     document.getElementById('cupom-codigo').value.toUpperCase(),
    tipo:       document.getElementById('cupom-tipo').value,
    valor:      parseFloat(document.getElementById('cupom-valor').value) || 0,
    minimo:     parseFloat(document.getElementById('cupom-minimo').value) || 0,
    ativo:      document.getElementById('cupom-ativo').checked,
    limite_uso: (!isNaN(limiteRaw) && limiteRaw > 0) ? limiteRaw : null,
    validade:   validadeRaw || null,
  };

  if (!dados.codigo) {
    alert('Digite um código para o cupom');
    return;
  }

  let error;
  if (id) {
    ({ error } = await supa.from('cupons').update(dados).eq('id', id));
  } else {
    ({ error } = await supa.from('cupons').insert([dados]));
  }

  if (error) {
    alert('Erro: ' + error.message);
  } else {
    alert('✅ Cupom salvo com sucesso!');
    document.getElementById('modal-cupom').classList.remove('active'); // Fecha o modal
    document.getElementById('modal-cupom').style.display = 'none';
    carregarCupons();
  }
}

// DELETAR CUPOM
async function deletarCupom(id) {
  if (confirm('Deletar este cupom?')) {
    const { error } = await supa.from('cupons').delete().eq('id', id);
    if (error) alert('Erro: ' + error.message);
    else carregarCupons();
  }
}

async function confirmarEntregaFuncionario(pedidoId) {
  if (!confirm('Confirmar que este pedido foi entregue ao cliente?')) {
    return;
  }

  try {
    const { error } = await supa
      .from('pedidos')
      .update({
        status: 'entregue',
        entrega_confirmada_em: new Date().toISOString(),
        confirmacao_tipo: 'funcionario',
      })
      .eq('id', pedidoId);

    if (error) throw error;

    alert('✅ Entrega confirmada com sucesso!');
    carregarPedidos();
  } catch (err) {
    console.error('Erro ao confirmar entrega:', err);
    alert('Erro ao confirmar entrega');
  }
}

let graficoInstance = null;

// ===== ABRIR MODAL DE GRÁFICOS =====
function abrirGraficos() {
  const modal = document.getElementById('modal-graficos');
  if (!modal) {
    console.error('Modal de gráficos não encontrado');
    return;
  }
  modal.style.display = 'flex';

  // Carrega dados padrão de 7 dias
  carregarDadosGrafico('7');
}

// ===== CARREGAR DADOS DO GRÁFICO =====
async function carregarDadosGrafico(dias) {
  try {
    // Atualiza botões visuais
    document.querySelectorAll('.btn-periodo').forEach((btn) => {
      const btnDias = btn.getAttribute('data-dias');
      if (btnDias === dias) {
        btn.style.background = '#8e44ad';
        btn.style.color = '#fff';
      } else {
        btn.style.background = '#bdc3c7';
        btn.style.color = '#333';
      }
    });

    // Calcula data de início
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - parseInt(dias));

    // Busca pedidos no período
    const { data: pedidos, error } = await supa
      .from('pedidos')
      .select('*')
      .gte('created_at', dataInicio.toISOString())
      .lte('created_at', dataFim.toISOString())
      .neq('status', 'cancelado');

    if (error) throw error;

    // Processa dados
    processarDadosGrafico(pedidos, dias);
  } catch (err) {
    console.error('Erro ao carregar dados do gráfico:', err);
    alert('Erro ao carregar gráfico');
  }
}

// ===== PROCESSAR E EXIBIR DADOS =====
function processarDadosGrafico(pedidos, dias) {
  // Agrupa vendas por dia
  const vendasPorDia = {};
  let totalPeriodo = 0;

  pedidos.forEach((p) => {
    const data = new Date(p.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
    const valor = p.total_geral || 0;
    vendasPorDia[data] = (vendasPorDia[data] || 0) + valor;
    totalPeriodo += valor;
  });

  // Ordena por data
  const datasOrdenadas = Object.keys(vendasPorDia).sort((a, b) => {
    const [diaA, mesA] = a.split('/');
    const [diaB, mesB] = b.split('/');
    return new Date(2024, mesA - 1, diaA) - new Date(2024, mesB - 1, diaB);
  });

  const valores = datasOrdenadas.map((d) => vendasPorDia[d]);

  // Calcula estatísticas
  const mediaPorDia = totalPeriodo / parseInt(dias);
  const melhorValor = Math.max(...valores);
  const piorValor = Math.min(...valores);
  const melhorDia = datasOrdenadas[valores.indexOf(melhorValor)];
  const piorDia = datasOrdenadas[valores.indexOf(piorValor)];

  // Atualiza cards
  document.getElementById('graf-total-periodo').textContent =
    `Gs ${totalPeriodo.toLocaleString('es-PY')}`;
  document.getElementById('graf-media-dia').textContent =
    `Gs ${Math.round(mediaPorDia).toLocaleString('es-PY')}`;
  document.getElementById('graf-melhor-dia').textContent =
    `${melhorDia} - Gs ${melhorValor.toLocaleString('es-PY')}`;
  document.getElementById('graf-pior-dia').textContent =
    `${piorDia} - Gs ${piorValor.toLocaleString('es-PY')}`;

  // Gera cores das barras
  const cores = valores.map((v) => {
    if (v === melhorValor) return '#27ae60'; // Verde para melhor
    if (v === piorValor) return '#e74c3c'; // Vermelho para pior
    return '#3498db'; // Azul para demais
  });

  // Renderiza gráfico
  renderizarGrafico(datasOrdenadas, valores, cores);
}

// ===== RENDERIZAR GRÁFICO COM CHART.JS =====
function renderizarGrafico(labels, data, cores) {
  const canvas = document.getElementById('canvas-grafico');
  if (!canvas) {
    console.error('Canvas do gráfico não encontrado');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Destroi gráfico anterior se existir
  if (graficoInstance) {
    graficoInstance.destroy();
  }

  // Cria novo gráfico
  graficoInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Vendas (Gs)',
          data: data,
          backgroundColor: cores,
          borderWidth: 0,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return 'Gs ' + context.parsed.y.toLocaleString('es-PY');
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return 'Gs ' + (value / 1000).toFixed(0) + 'k';
            },
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

// ===== FECHAR MODAL (se não existir função genérica) =====
if (typeof fecharModal !== 'function') {
  function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }
}