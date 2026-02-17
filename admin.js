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
        if(elCargo) elCargo.innerText = perfilUsuario.toUpperCase();
        
        if (perfilUsuario === 'dono') {
            const menuFin = document.getElementById('menu-financeiro');
            if(menuFin) menuFin.style.display = 'flex';
        }
        
        carregarDashboard();
        carregarMotoboysSelect();
    }

    // === DESBLOQUEIO DE SOM — AudioContext (sem AbortError) ===
    // play().then(pause()) SEMPRE gera AbortError no Chrome. Usamos buffer silencioso.
   document.body.addEventListener('click', () => {
        if (!audioHabilitado) {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const buf = ctx.createBuffer(1, ctx.sampleRate * 0.001, ctx.sampleRate);
                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.connect(ctx.destination);
                src.start(0);
                src.onended = () => { audioHabilitado = true; ctx.close(); };
            } catch(e) { audioHabilitado = true; }
        }
    }, { once: true });
});

// =========================================
// 2. CONTROLE DE ABAS 
// =========================================
function showTab(tabId, event) {
    console.log("Tentando abrir aba:", tabId);
    
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
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    
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
        carregarCupons();
    }
}

function showSubTab(subId) {
    console.log("Alternando para sub-aba:", subId);

    // 1. Seleciona todas as sub-abas e esconde TODAS
    const subtabs = document.querySelectorAll('.subtab-content');
    subtabs.forEach(tab => {
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
    supa.channel('tabela-pedidos-admin')
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
            audio.play()
                .then(() => { _alarmePlaying = false; })
                .catch(() => { _alarmePlaying = false; });
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
            console.log("Atualização pausada: Usuário está montando rota.");
            return; 
        }
    }

    // 1. Som e Notificação
    const { count } = await supa.from('pedidos')
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
        .or('status.eq.pendente,status.eq.pronto_entrega,status.eq.cancelamento_solicitado')
        .order('id', { ascending: false });

    const tbody = document.getElementById('lista-pedidos');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Container de cards mobile
    const cardsDiv = document.getElementById('lista-pedidos-cards');
    if (cardsDiv) cardsDiv.innerHTML = '';

    // Badge de cancelamento pendente para o dono
    const badgeCancelPendente = perfilUsuario === 'dono' ? 
        `<span style="background:#e74c3c;color:white;font-size:0.7rem;padding:2px 7px;border-radius:10px;margin-left:6px;vertical-align:middle;">CANC. PENDENTE</span>` : '';

    if (pedidos && pedidos.length > 0) {
        pedidos.forEach((p) => {
            let acoes = '';
            let linhaCor = '';
            let checkbox = '';
            
            const btnPrint = `<button class="btn btn-sm btn-info" onclick="imprimirPedido(${p.id})" title="Imprimir"><i class="fas fa-print"></i></button>`;
            const temSolicitacaoCancelamento = p.cancelamento_solicitado;

            // Badge cancelamento (só dono vê)
            const badgeCancelRow = temSolicitacaoCancelamento && perfilUsuario === 'dono' 
                ? `<div style="background:#fff0f0;border:1px solid #e74c3c;border-radius:6px;padding:4px 8px;font-size:0.75rem;margin-top:4px;color:#c0392b">
                     🚫 <strong>Cancelamento solicitado:</strong> ${p.cancelamento_motivo || '-'}
                     <br><button class="btn btn-danger btn-sm" onclick="aprovarCancelamento(${p.id})" style="margin-top:4px;font-size:0.7rem">✅ Aprovar</button>
                     <button class="btn btn-secondary btn-sm" onclick="negarCancelamento(${p.id})" style="margin-top:4px;font-size:0.7rem">❌ Negar</button>
                   </div>` : '';

            // PENDENTE
            if (p.status === 'pendente') {
                linhaCor = 'background-color: #fff3cd;';
                acoes = `
                    ${btnPrint}
                    <button class="btn btn-success btn-sm" onclick="mudarStatus(${p.id}, 'em_preparo')"><i class="fas fa-fire"></i> Cozinha</button>
                    ${perfilUsuario === 'dono' 
                        ? `<button class="btn btn-danger btn-sm" onclick="mudarStatus(${p.id}, 'cancelado')"><i class="fas fa-times"></i></button>` 
                        : `<button class="btn btn-warning btn-sm" onclick="solicitarCancelamento(${p.id})"><i class="fas fa-ban"></i> Solicitar Cancel.</button>`
                    }
                `;
            } 

            if (p.status === 'saiu_entrega') {
                acoes += `<button class="btn btn-success btn-sm" onclick="confirmarEntregaFuncionario(${p.id})"><i class="fas fa-check-circle"></i> Confirmar</button>`;
            }
            // PRONTO
            else if (p.status === 'pronto_entrega') {
                linhaCor = 'background-color: #d4edda;';

                // Botão cancelamento para pronto_entrega
                const btnCancelar = perfilUsuario === 'dono'
                    ? `<button class="btn btn-danger btn-sm" onclick="mudarStatus(${p.id}, 'cancelado')" title="Cancelar"><i class="fas fa-times"></i></button>`
                    : (!temSolicitacaoCancelamento ? `<button class="btn btn-warning btn-sm" onclick="solicitarCancelamento(${p.id})"><i class="fas fa-ban"></i></button>` : '');

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
                    <td>Gs ${(p.total_geral||0).toLocaleString('es-PY')}</td>
                    <td class="actions-cell">${acoes}</td>
                </tr>`;

            // Card mobile
            if (cardsDiv) {
                const statusLabel = p.status === 'pendente' ? '🔔 Novo' : p.status === 'em_preparo' ? '🔥 Na Cozinha' : p.status === 'pronto_entrega' ? '✅ Pronto' : p.status.replace('_',' ');
                const cardBg = p.status === 'pendente' ? '#fff3cd' : p.status === 'pronto_entrega' ? '#d4edda' : '#fff';
                const jsonSeguro = encodeURIComponent(JSON.stringify(p));
                let cardAcoes = '';
                if (p.status === 'pendente') {
                    cardAcoes = `
                        <button class="btn btn-success btn-sm" onclick="mudarStatus(${p.id}, 'em_preparo')"><i class="fas fa-fire"></i> Cozinha</button>
                        <button class="btn btn-info btn-sm" onclick="imprimirPedido(${p.id})"><i class="fas fa-print"></i></button>
                        ${perfilUsuario === 'dono' 
                            ? `<button class="btn btn-danger btn-sm" onclick="mudarStatus(${p.id}, 'cancelado')"><i class="fas fa-times"></i></button>`
                            : `<button class="btn btn-warning btn-sm" onclick="solicitarCancelamento(${p.id})"><i class="fas fa-ban"></i></button>`
                        }`;
                } else if (p.status === 'pronto_entrega' && p.tipo_entrega === 'balcao') {
                    cardAcoes = `<button class="btn btn-success btn-sm" onclick="finalizarMesa(${p.id})"><i class="fas fa-check"></i> Entregar</button>
                        <button class="btn btn-info btn-sm" onclick="imprimirPedido(${p.id})"><i class="fas fa-print"></i></button>`;
                } else if (p.status === 'pronto_entrega') {
                    cardAcoes = `<label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:#155724;font-weight:600;">
                        <input type="checkbox" class="check-pedido" value="${jsonSeguro}" style="width:18px;height:18px;"> Incluir na Rota
                    </label>
                    <button class="btn btn-info btn-sm" onclick="imprimirPedido(${p.id})"><i class="fas fa-print"></i></button>`;
                }

                const badgeCancelCard = temSolicitacaoCancelamento && perfilUsuario === 'dono' ? `
                    <div style="background:#fff0f0;border:1px solid #e74c3c;border-radius:6px;padding:6px 8px;font-size:0.75rem;color:#c0392b;margin-top:6px">
                        🚫 Cancel. solicitado: ${p.cancelamento_motivo || '-'}
                        <br><button class="btn btn-danger btn-sm" onclick="aprovarCancelamento(${p.id})" style="font-size:0.7rem;margin-top:4px">✅ Aprovar</button>
                        <button class="btn btn-secondary btn-sm" onclick="negarCancelamento(${p.id})" style="font-size:0.7rem;margin-top:4px">❌ Negar</button>
                    </div>` : '';

                cardsDiv.innerHTML += `
                    <div style="background:${cardBg}; border-radius:10px; padding:14px 16px; box-shadow:0 2px 8px rgba(0,0,0,0.07); border-left:4px solid ${p.status==='pendente'?'#f59e0b':p.status==='pronto_entrega'?'#22c55e':'#94a3b8'};">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                            <div>
                                <div style="font-weight:700;font-size:1rem">#${p.uid_temporal || p.id} — ${p.cliente_nome || 'Cliente'}</div>
                                <div style="font-size:0.78rem;color:#666;margin-top:2px">${p.endereco_entrega || (p.tipo_entrega === 'balcao' ? '🏪 Balcão' : '')}</div>
                            </div>
                            <span class="status-badge st-${p.status}" style="font-size:0.7rem">${statusLabel}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <strong style="font-size:1rem;color:var(--dark)">Gs ${(p.total_geral||0).toLocaleString('es-PY')}</strong>
                            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${cardAcoes}</div>
                        </div>
                        ${badgeCancelCard}
                    </div>`;
            }
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;">Nenhum pedido ativo.</td></tr>';
        if (cardsDiv) cardsDiv.innerHTML = '<div style="text-align:center;padding:30px;color:#aaa;font-size:0.95rem">Nenhum pedido ativo no momento.</div>';
    }
}

// === CANCELAMENTO WORKFLOW ===
async function solicitarCancelamento(pedidoId) {
    const motivo = prompt('🚫 Solicitar cancelamento\n\nInforme o motivo do cancelamento:');
    if (!motivo || !motivo.trim()) return;

    const user = await supa.auth.getUser();
    const email = user?.data?.user?.email || 'desconhecido';

    const { error } = await supa.from('pedidos').update({
        cancelamento_solicitado: true,
        cancelamento_motivo: motivo.trim(),
        cancelamento_solicitado_por: email,
        cancelamento_solicitado_em: new Date().toISOString()
    }).eq('id', pedidoId);

    if (error) { alert('❌ Erro: ' + error.message); return; }

    // Registra na tabela de solicitações
    await supa.from('solicitacoes_cancelamento').insert([{
        pedido_id: pedidoId,
        motivo: motivo.trim(),
        solicitado_por: email
    }]);

    alert('✅ Solicitação enviada! O dono será notificado para aprovar.');
    carregarPedidos();
}

async function aprovarCancelamento(pedidoId) {
    if (!confirm('⚠️ Confirma o CANCELAMENTO deste pedido?\nEsta ação não pode ser desfeita.')) return;

    const user = await supa.auth.getUser();
    const email = user?.data?.user?.email || 'dono';

    const { error } = await supa.from('pedidos').update({
        status: 'cancelado',
        cancelamento_aprovado_por: email,
        cancelamento_aprovado_em: new Date().toISOString()
    }).eq('id', pedidoId);

    if (error) { alert('❌ Erro: ' + error.message); return; }

    // Marca como aprovada na tabela de solicitações
    await supa.from('solicitacoes_cancelamento')
        .update({ aprovado: true, aprovado_por: email, aprovado_em: new Date().toISOString() })
        .eq('pedido_id', pedidoId).eq('aprovado', false);

    alert('✅ Pedido cancelado com sucesso!');
    carregarPedidos();
}

async function negarCancelamento(pedidoId) {
    const obs = prompt('Motivo para NEGAR o cancelamento (opcional):') || '';
    const user = await supa.auth.getUser();
    const email = user?.data?.user?.email || 'dono';

    await supa.from('pedidos').update({
        cancelamento_solicitado: false,
        cancelamento_motivo: null
    }).eq('id', pedidoId);

    await supa.from('solicitacoes_cancelamento')
        .update({ negado: true, negado_por: email, negado_em: new Date().toISOString(), observacoes: obs })
        .eq('pedido_id', pedidoId).eq('aprovado', false);

    alert('✅ Solicitação de cancelamento negada.');
    carregarPedidos();
}



async function mudarStatus(id, novoStatus) {
    // Registra o timestamp do novo status no campo correspondente
    const camposTimestamp = {
        'em_preparo': ['tempo_confirmado', 'tempo_preparo_iniciado'], // aceita E começa a preparar
        'pronto_entrega': 'tempo_pronto',
        'saiu_entrega': 'tempo_saiu_entrega',
        'entregue': 'tempo_entregue'
    };

    const updateData = { status: novoStatus };
    const campos = camposTimestamp[novoStatus];
    if (campos) {
        const agora = new Date().toISOString();
        if (Array.isArray(campos)) campos.forEach(c => updateData[c] = agora);
        else updateData[campos] = agora;
    }
    // Status 'cancelado' mantém os timestamps existentes

    const { error } = await supa.from('pedidos').update(updateData).eq('id', id);
    if (error) { console.error('Erro ao atualizar:', error); alert('Erro ao mudar status'); return; }

    if (typeof pararAlarme === 'function') pararAlarme();

    const abaAtual = localStorage.getItem('lastTab');
    if (abaAtual === 'cozinha')      carregarCozinha();
    else if (abaAtual === 'pedidos') carregarPedidos();
    else if (abaAtual === 'pdv')     carregarMonitorMesas();
}

// === FUNÇÃO DE IMPRESSÃO (RESTAURADA) ===
async function imprimirPedido(id) {
    const { data: p } = await supa.from('pedidos').select('*').eq('id', id).single();
    if (!p) return;

    const dados = {
        id: p.id, // usa ID real do banco
        cliente: { nome: p.cliente_nome, tel: p.cliente_telefone },
        entrega: { tipo: p.tipo_entrega, ref: p.endereco_entrega },
        itens: (p.itens || []).map((i) => ({ q: i.qtd || i.q || 1, n: i.nome || i.n, p: i.preco || i.p || 0, m: i.montagem || i.m, o: i.obs || i.o })),
        valores: { sub: p.subtotal, frete: p.frete_cobrado_cliente, total: p.total_geral },
        pagamento: { metodo: p.forma_pagamento, obs: p.obs_pagamento },
        factura: p.dados_factura,
        data: new Date(p.created_at || Date.now()).toLocaleString('pt-BR')
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
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#aaa; font-size:1.5rem;">👨‍🍳 Cozinha Livre!</div>';
        return;
    }

    pedidos.forEach(p => {
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

        // === CORREÇÃO: Aceita tanto formato completo quanto abreviado ===
        let itensHtml = '';
        if (p.itens && Array.isArray(p.itens)) {
            p.itens.forEach(item => {
                // Suporta {qtd, nome, montagem, obs} E {q, n, m, o}
                const quantidade = item.qtd || item.q || 1;
                const nomeItem = item.nome || item.n || 'Item';
                const observacao = item.obs || item.o || '';
                const montagemArray = item.montagem || item.m || [];
                
                const obs = observacao ? `<div style="color:#e74c3c; font-size:0.85rem">⚠️ ${observacao}</div>` : '';
                const listaMontagem = Array.isArray(montagemArray) ? montagemArray.join(', ') : '';
                const montagem = listaMontagem ? `<div style="font-size:0.8rem; color:#666; margin-left:10px;">+ ${listaMontagem}</div>` : '';
                
                itensHtml += `
                    <li style="border-bottom:1px dashed #444; padding:5px 0;">
                        <strong>${quantidade}x</strong> ${nomeItem}
                        ${montagem}
                        ${obs}
                    </li>
                `;
            });
        }

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
let _caixaState = { faturamento:0, custoEntregas:0, totalSaidas:0, totalEntradas:0, totalPix:0, totalTransf:0, totalCartao:0, totalEfetivo:0, qtdPedidos:0 };

async function calcularFinanceiro() {
    const abaFin = document.getElementById('financeiro');
    if(!abaFin || !abaFin.classList.contains('active')) return;

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
        if(!inicio) elInicio.value = `${ano}-${mes}-${dia}`;
        if(!fim) elFim.value = `${ano}-${mes}-${dia}`;
        
        dataInicio = `${ano}-${mes}-${dia} 00:00:00`;
        dataFim = `${ano}-${mes}-${dia} 23:59:59`;
    }

    // ========================================
    // 1. BUSCA PEDIDOS (CORRIGIDO)
    // ========================================
    let query = supa.from('pedidos')
        .select('*, motoboys(nome)')  // JOIN para pegar nome do motoboy
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
        pedidosFiltrados = pedidosFiltrados.filter(p => 
            p.dados_factura && (p.dados_factura.ruc || p.dados_factura.ci)
        );
    } else if (facturaFiltro === 'sem_factura') {
        pedidosFiltrados = pedidosFiltrados.filter(p => 
            !p.dados_factura || (!p.dados_factura.ruc && !p.dados_factura.ci)
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
        let limpo = v.toString().replace(/[^\d,-]/g, '').replace(',', '.'); 
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

    pedidosFiltrados.forEach(p => {
        const valorPedido = safeNum(p.total_geral);
        faturamento += valorPedido;
        qtdPedidos++;

        const pag = (p.forma_pagamento || '').toLowerCase();

        if (pag.includes('pix')) totalPix += valorPedido;
        else if (pag.includes('transfer')) totalTransf += valorPedido;
        else if (pag.includes('cartao') || pag.includes('cartão')) totalCartao += valorPedido;
        else if (pag.includes('efetivo') || pag.includes('dinheiro')) totalEfetivo += valorPedido;

        if (p.tipo_entrega === 'delivery') {
            custoEntregas += (typeof TAXA_MOTOBOY !== 'undefined') ? TAXA_MOTOBOY : 5000;
            const nomeMoto = p.motoboys?.nome || 'Sem Motoboy';
            if (!motoMap[nomeMoto]) {
                motoMap[nomeMoto] = 0;
                // Adiciona combustível 1× por motoboy único no período
                custoEntregas += (typeof AJUDA_COMBUSTIVEL !== 'undefined') ? AJUDA_COMBUSTIVEL : 20000;
            }
            motoMap[nomeMoto]++;
        }
    });

    // Movimentações de caixa (despesas e sangrias reduzem; suprimentos/abertura aumentam)
    let totalSaidas = 0;     // despesa + sangria
    let totalEntradas = 0;   // suprimento + abertura
    if (caixa) {
        caixa.forEach(c => {
            const v = safeNum(c.valor);
            if (c.tipo === 'despesa' || c.tipo === 'sangria') totalSaidas += v;
            if (c.tipo === 'suprimento' || c.tipo === 'abertura') totalEntradas += v;
        });
    }

    // Guarda estado para fecharCaixaResumo()
    _caixaState = { faturamento, custoEntregas, totalSaidas, totalEntradas, totalPix, totalTransf, totalCartao, totalEfetivo, qtdPedidos };

    // ========================================
    // 5. ATUALIZA INTERFACE
    // ========================================
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.innerText = val;
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
            tbodyMoto.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999">Nenhuma entrega no período</td></tr>';
        } else {
            for (const [nome, qtd] of Object.entries(motoMap)) {
                const taxaMoto    = (typeof TAXA_MOTOBOY      !== 'undefined') ? TAXA_MOTOBOY      : 5000;
                const combustivel = (typeof AJUDA_COMBUSTIVEL !== 'undefined') ? AJUDA_COMBUSTIVEL : 20000;
                const totalEntregas = qtd * taxaMoto;
                const totalMoto     = totalEntregas + combustivel; // combustível: 1x por motoboy por dia
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
        lucro: fmt(lucro)
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
    let query = supa.from('pedidos')
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
        pedidosFiltrados = pedidos.filter(p => 
            p.dados_factura && (p.dados_factura.ruc || p.dados_factura.ci)
        );
    } else if (facturaFiltro === 'sem_factura') {
        pedidosFiltrados = pedidos.filter(p => 
            !p.dados_factura || (!p.dados_factura.ruc && !p.dados_factura.ci)
        );
    }

    // 4. Prepara dados para CSV
    let csv = 'ID Pedido,Data/Hora,Cliente,Telefone,Tipo Entrega,Forma Pagamento,Subtotal,Frete,Total,RUC/CI,Razão Social\n';

    pedidosFiltrados.forEach(p => {
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
    const ws = XLSX.utils.json_to_sheet(pedidosFiltrados.map(p => ({
        'ID': p.id,
        'Data': new Date(p.created_at).toLocaleString('pt-BR'),
        'Cliente': p.cliente_nome,
        'Telefone': p.cliente_telefone,
        'Tipo': p.tipo_entrega,
        'Pagamento': p.forma_pagamento,
        'Subtotal': p.subtotal,
        'Frete': p.frete_cobrado_cliente,
        'Total': p.total_geral,
        'RUC/CI': p.dados_factura?.ruc || p.dados_factura?.ci || '',
        'Razão': p.dados_factura?.razao || ''
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendas');

    const hoje = new Date();
    XLSX.writeFile(wb, `Relatorio_${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}.xlsx`);
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
    if (error) { console.error(error); return; }
    const tbody = document.getElementById('rel-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const fmtDiff = (t1, t2) => {
        if (!t1 || !t2) return '-';
        const diff = Math.round((new Date(t2) - new Date(t1)) / 60000);
        if (diff < 60) return diff + ' min';
        return Math.floor(diff/60) + 'h ' + (diff%60) + 'm';
    };
    const fmtHora = (t) => t ? new Date(t).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : '-';
    (pedidos || []).forEach(p => {
        const statusBadge = { pendente:'🔔 Pendente',em_preparo:'🔥 Preparo',pronto_entrega:'📦 Pronto',saiu_entrega:'🛵 Saiu',entregue:'✅ Entregue',cancelado:'❌ Cancelado' }[p.status] || p.status;
        const itensList = (p.itens || []).map(i => (i.qtd||i.q||1)+'x '+(i.nome||i.n||'?')).join(', ');
        tbody.innerHTML += '<tr><td><strong>#'+p.id+'</strong></td><td>'+new Date(p.created_at).toLocaleString('pt-BR')+'</td><td><div style="font-weight:600">'+(p.cliente_nome||'-')+'</div><div style="font-size:0.75rem;color:#666">'+(p.cliente_telefone||'')+'</div></td><td style="font-size:0.8rem">'+(itensList||'-')+'</td><td>'+statusBadge+(p.cancelamento_solicitado&&p.status!=='cancelado'?' 🚫':'')+'</td><td>Gs '+(p.total_geral||0).toLocaleString('es-PY')+'</td><td style="font-size:0.78rem"><div>📥 Receb: '+fmtHora(p.tempo_recebido)+'</div><div>✅ Aceite: '+fmtHora(p.tempo_confirmado)+' ('+fmtDiff(p.tempo_recebido,p.tempo_confirmado)+')</div><div>🔥 Cozinha: '+fmtHora(p.tempo_preparo_iniciado)+'</div><div>📦 Pronto: '+fmtHora(p.tempo_pronto)+' ('+fmtDiff(p.tempo_preparo_iniciado,p.tempo_pronto)+')</div><div>🛵 Saiu: '+fmtHora(p.tempo_saiu_entrega)+'</div><div>✅ Entregue: '+fmtHora(p.tempo_entregue)+' ('+fmtDiff(p.tempo_saiu_entrega,p.tempo_entregue)+')</div><div><strong>⏱ Total: '+fmtDiff(p.tempo_recebido,p.tempo_entregue)+'</strong></div></td></tr>';
    });
    if (!pedidos||pedidos.length===0) tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px;color:#aaa">Nenhum pedido encontrado.</td></tr>';
    const el=document.getElementById('rel-total-count'); if(el) el.textContent=(pedidos||[]).length+' pedidos encontrados';
}

function abrirModalCaixa(tipo) {
    document.getElementById('modal-caixa').style.display = 'flex';
    document.getElementById('tipo-caixa').value = tipo;
    
    let titulo = 'Operação';
    if(tipo === 'abertura') titulo = '🟢 Abertura de Caixa';
    if(tipo === 'suprimento') titulo = '➕ Adicionar Dinheiro';
    if(tipo === 'sangria') titulo = '💸 Sangria (Retirada)';
    if(tipo === 'despesa') titulo = '🧾 Pagar Despesa';
    
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

    const { error } = await supa.from('movimentacoes_caixa').insert([{
        tipo: tipo,
        valor: valor,
        descricao: desc,
        usuario_email: userEmail
    }]);

    if (error) {
        alert('Erro ao salvar: ' + error.message);
    } else {
        alert('Operação registrada com sucesso!');
        fecharModal('modal-caixa');
        calcularFinanceiro(); // Atualiza os números
    }
}

async function fecharCaixaResumo() {
    if(!confirm('Fechar o caixa de hoje?\nIsso registra o fechamento e zera os totais exibidos.')) return;
    await calcularFinanceiro();
    const s = _caixaState;
    const fmt = (n) => 'Gs ' + n.toLocaleString('es-PY');
    const lucro = s.faturamento + s.totalEntradas - s.custoEntregas - s.totalSaidas;

    // Registra fechamento no banco como movimentação
    try {
        await supa.from('movimentacoes_caixa').insert([{
            tipo: 'fechamento',
            valor: lucro,
            descricao: `Fechamento ${new Date().toLocaleDateString('pt-BR')} | Fat: ${fmt(s.faturamento)} | Res: ${fmt(lucro)}`,
            usuario_email: document.getElementById('user-email')?.innerText || 'admin'
        }]);
    } catch(e) { console.warn('Aviso fechamento:', e.message); }

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
    ['card-faturamento','card-custo-moto','card-lucro',
     'total-pix','total-transf','total-cartao','total-efetivo',
     'card-ticket-medio'].forEach(id => {
        const el = document.getElementById(id); if(el) el.innerText = 'Gs 0';
    });
    const qEl = document.getElementById('card-qtd-pedidos');
    if(qEl) qEl.innerText = '0';
    _caixaState = { faturamento:0, custoEntregas:0, totalSaidas:0, totalEntradas:0,
                    totalPix:0, totalTransf:0, totalCartao:0, totalEfetivo:0, qtdPedidos:0 };
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
            // (Use 'saiu_entrega' se quiser rastrear, ou 'entregue' se quiser finalizar já)
            supa.from('pedidos')
                .update({ status: 'saiu_entrega', motoboy_id: selMoto.value })
                .eq('id', p.id)
                .then();

            msg += `📦 *PEDIDO #${p.uid_temporal || p.id}*\n`;
            msg += `👤 ${p.cliente_nome} | 📞 ${p.cliente_telefone || ''}\n`;
            
            // LÓGICA DE BEBIDAS (Restaurada)
            if (p.itens && Array.isArray(p.itens)) {
                const bebidas = p.itens.filter(i => /coca|fanta|sprite|guarana|agua|cerveja|refri/i.test(i.nome));
                if (bebidas.length > 0) {
                    msg += `🥤 *LEVAR:* ${bebidas.map(b => `${b.qtd}x ${b.nome}`).join(', ')}\n`;
                }
            }

            // LÓGICA DE MAPA (Restaurada)
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
            } else if (forma.includes('cartao') || forma.includes('credito') || forma.includes('debito')) {
                msg += `💳 *Cobrar Cartão: Gs ${totalFmt}*\n`;
            } else {
                // Dinheiro / Efetivo
                msg += `💰 *COBRAR: Gs ${totalFmt}*\n`;
                
                // Lógica de Troco
                const obsPag = p.obs_pagamento || '';
                const nums = obsPag.match(/\d+/g);
                if(nums) {
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
                if(obsPag && !nums) msg += `⚠️ Obs: ${obsPag}\n`;
            }

            msg += `-----------------\n`;
            taxaTotal += (typeof TAXA_MOTOBOY !== 'undefined' ? TAXA_MOTOBOY : 5000);
            
        } catch (e) {
            console.error("Erro ao processar pedido na rota:", e);
        }
    });

    // MAPA GERAL DA ROTA
    if (coords.length > 0) {
        // Usa coordenadas da loja se existirem, senão usa padrão
        const latLoja = (typeof COORD_LOJA !== 'undefined') ? COORD_LOJA.lat : '';
        const lngLoja = (typeof COORD_LOJA !== 'undefined') ? COORD_LOJA.lng : '';
        const rota = `https://www.google.com/maps/dir/${latLoja},${lngLoja}/${coords.join('/')}`;
        msg += `\n🗺️ *ROTA NO MAPA:*\n${rota}\n`;
    }

    msg += `\n🏍️ *Taxa Total: Gs ${taxaTotal.toLocaleString('es-PY')}*`;
    
    // Abre WhatsApp
    const foneDestino = telMoto || ''; // Se tiver numero no cadastro do motoboy
    window.open(`https://wa.me/${foneDestino}?text=${encodeURIComponent(msg)}`, '_blank');
    
    // Recarrega a tela depois de um tempo para atualizar os status
    setTimeout(() => {
        if(typeof carregarPedidos === 'function') carregarPedidos();
        if(typeof calcularFinanceiro === 'function') calcularFinanceiro();
    }, 2000);
}

// =========================================
// 8. PRODUTOS E CRUD COMPLETO (RESTAURADO)
// =========================================
async function carregarProdutos() {
    const { data } = await supa.from('produtos').select('*').order('nome');
    
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        const wrapper = document.getElementById('lista-produtos-wrapper');
        let container = document.getElementById('mobile-produtos');
        
        if (!container) {
            container = document.createElement('div');
            container.className = 'mobile-cards-container';
            container.id = 'mobile-produtos';
            const tableContainer = wrapper.querySelector('.table-container');
            wrapper.insertBefore(container, tableContainer);
        }
        
        container.innerHTML = '';
        
        (data || []).forEach(p => {
            const card = document.createElement('div');
            card.className = 'mobile-card';
            const pausadoBadge = !p.ativo ? `<span style="background:#e74c3c;color:white;font-size:0.7rem;padding:2px 6px;border-radius:4px;margin-left:5px">⏸️ Pausado</span>` : '';
            card.innerHTML = `
                <div class="mobile-card-header">
                    <div>
                        <div class="mobile-card-title">${p.nome}${pausadoBadge}</div>
                        <div style="font-size:0.75rem; color:var(--primary); font-weight:600">ID: #${p.id}</div>
                    </div>
                    ${p.imagem_url ? `<img src="${p.imagem_url}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;">` : ''}
                </div>
                <div class="mobile-card-body">
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Categoria:</span>
                        <span class="mobile-card-value">${p.categoria_slug || '-'}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">Preço:</span>
                        <span class="mobile-card-value">Gs ${p.preco.toLocaleString('es-PY')}</span>
                    </div>
                </div>
                <div class="mobile-card-actions">
                    <button class="btn btn-info" onclick='editarProduto(${JSON.stringify(p).replace(/'/g, "&apos;").replace(/"/g, "&quot;")})'>
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn ${p.ativo ? 'btn-warning' : 'btn-success'}" onclick="pausarProduto(${p.id}, ${p.ativo})">
                        ${p.ativo ? '<i class="fas fa-pause"></i> Pausar' : '<i class="fas fa-play"></i> Ativar'}
                    </button>
                    <button class="btn btn-danger" onclick="deletarProduto(${p.id})">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
        
        carregarSelectCategorias();
        return;
    }
    
    // CÓDIGO DESKTOP
    const tb = document.getElementById('lista-produtos');
    tb.innerHTML = '';
    
    if(data) {
        data.forEach((p) => {
            const pJson = JSON.stringify(p).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
            const pausadoBadge = !p.ativo ? `<span style="background:#e74c3c;color:white;font-size:0.7rem;padding:1px 5px;border-radius:3px;margin-left:4px">⏸️</span>` : '';
            tb.innerHTML += `
                <tr style="${!p.ativo ? 'opacity:0.6;' : ''}">
                    <td><strong style="color:var(--primary)">#${p.id}</strong></td>
                    <td><img src="${p.imagem_url}" width="30" style="border-radius:4px"></td>
                    <td>${p.nome}${pausadoBadge}</td>
                    <td>${p.categoria_slug}</td>
                    <td>Gs ${p.preco.toLocaleString()}</td>
                    <td class="actions-cell">
                        <button class="btn btn-sm btn-primary" onclick='editarProduto(${pJson})'><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm ${p.ativo ? 'btn-warning' : 'btn-success'}" onclick="pausarProduto(${p.id}, ${p.ativo})" title="${p.ativo ? 'Pausar' : 'Ativar'}">
                            <i class="fas fa-${p.ativo ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deletarProduto(${p.id})"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
        });
    }
    carregarSelectCategorias();
}

function editarProduto(p) {
    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-nome').value = p.nome;
    document.getElementById('prod-desc').value = p.descricao || '';
    document.getElementById('prod-preco').value = p.preco;
    document.getElementById('prod-cat').value = p.categoria_slug;
    document.getElementById('prod-img').value = p.imagem_url;
    document.getElementById('prod-img-file').value = ''; 
    if (p.imagem_url) {
        document.getElementById('img-preview').src = p.imagem_url;
        document.getElementById('box-preview').style.display = 'block';
    }

    document.getElementById('prod-montavel').checked = p.e_montavel;
    const cbBalcao = document.getElementById('prod-somente-balcao');
    if (cbBalcao) cbBalcao.checked = p.somente_balcao || false;
    document.getElementById('builder-steps').innerHTML = '';
    toggleBuilder();
    if (p.montagem_config)
        p.montagem_config.forEach((e) => addBuilderStep(e.titulo, e.max, e.itens));
    document.getElementById('modal-produto').style.display = 'flex';
}

async function deletarProduto(id) {
    if (!confirm('⚠️ ATENÇÃO: Deletar este produto?\n\nEsta ação não pode ser desfeita. O produto será removido permanentemente do sistema.')) return;
    const { error } = await supa.from('produtos').delete().eq('id', id);
    if (error) alert('❌ Erro ao deletar: ' + error.message);
    else { alert('✅ Produto deletado!'); carregarProdutos(); }
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

        const isM = document.getElementById('prod-montavel').checked;
        let mJson = [];
        if (isM) {
            document.querySelectorAll('.etapa-item').forEach((div) => {
                mJson.push({
                    titulo: div.querySelector('.step-titulo').value,
                    max: parseInt(div.querySelector('.step-max').value),
                    itens: div.querySelector('.step-itens').value.split(',').map((s) => s.trim()).filter((s) => s),
                });
            });
        }

        const dados = {
            nome: document.getElementById('prod-nome').value,
            descricao: document.getElementById('prod-desc').value,
            preco: parseFloat(document.getElementById('prod-preco').value),
            categoria_slug: document.getElementById('prod-cat').value,
            imagem_url: urlFinal,
            e_montavel: isM,
            montagem_config: mJson,
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

function abrirModalProduto(produto = null) {
    const modal = document.getElementById('modal-produto');
    const builderArea = document.getElementById('builder-steps');
    
    // LIMPA TUDO ANTES
    builderArea.innerHTML = '';
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-nome').value = '';
    document.getElementById('prod-desc').value = '';
    document.getElementById('prod-preco').value = '';
    document.getElementById('prod-img').value = '';
    document.getElementById('prod-montavel').checked = false;
    
    if (produto) {
        // PREENCHE COM DADOS REAIS
        document.getElementById('prod-id').value = produto.id;
        document.getElementById('prod-nome').value = produto.nome;
        document.getElementById('prod-desc').value = produto.descricao || '';
        document.getElementById('prod-preco').value = produto.preco;
        document.getElementById('prod-img').value = produto.imagem_url || '';
        document.getElementById('prod-montavel').checked = produto.e_montavel || false;
        
        // CARREGA MONTAGENS
        if (produto.montagem_config && Array.isArray(produto.montagem_config)) {
            produto.montagem_config.forEach(etapa => {
                addBuilderStep(etapa.titulo, etapa.max, etapa.itens);
            });
        }
    }
    
    toggleBuilder();
    modal.style.display = 'flex';
}

function toggleBuilder() {
    document.getElementById('builder-area').style.display = document.getElementById('prod-montavel').checked ? 'block' : 'none';
}

function addBuilderStep(t = '', m = 1, i = []) {
    const div = document.createElement('div');
    div.className = 'etapa-item';
    div.innerHTML = `<div class="etapa-header"><input type="text" class="form-control step-titulo" value="${t}" placeholder="Título"><input type="number" class="form-control step-max" value="${m}" style="width:70px"><button class="btn btn-sm btn-danger" onclick="this.parentElement.parentElement.remove()">X</button></div><textarea class="etapa-ingredientes step-itens">${i.join(', ')}</textarea>`;
    document.getElementById('builder-steps').appendChild(div);
}

// =========================================
// 8. PRODUTOS E CATEGORIAS (CORRIGIDO)
// =========================================

// --- CATEGORIAS ---
async function carregarCategorias() {
    const { data, error } = await supa.from('categorias').select('*').order('ordem');
    
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        const wrapper = document.getElementById('lista-categorias-wrapper');
        let container = document.getElementById('mobile-categorias');
        
        if (!container) {
            container = document.createElement('div');
            container.className = 'mobile-cards-container';
            container.id = 'mobile-categorias';
            const tableContainer = wrapper.querySelector('.table-container');
            wrapper.insertBefore(container, tableContainer);
        }
        
        container.innerHTML = '';
        
        if (!error && data) {
            data.forEach(c => {
                const card = document.createElement('div');
                card.className = 'mobile-card';
                card.innerHTML = `
                    <div class="mobile-card-header">
                        <div class="mobile-card-title">${c.nome_exibicao}</div>
                    </div>
                    <div class="mobile-card-body">
                        <div class="mobile-card-row">
                            <span class="mobile-card-label">Slug:</span>
                            <span class="mobile-card-value">${c.slug}</span>
                        </div>
                        <div class="mobile-card-row">
                            <span class="mobile-card-label">Ordem:</span>
                            <span class="mobile-card-value">${c.ordem}</span>
                        </div>
                    </div>
                    <div class="mobile-card-actions">
                        <button class="btn btn-info" onclick='editarCategoria(${JSON.stringify(c).replace(/'/g, "&apos;").replace(/"/g, "&quot;")})'>
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-danger" onclick="deletarCat('${c.slug}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        }
        
        carregarSelectCategorias();
        return;
    }
    
    // CÓDIGO DESKTOP
    const tbody = document.getElementById('lista-categorias');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (error) {
        console.error("Erro categorias:", error);
        return;
    }

    if (data) {
        data.forEach(c => {
            const cJson = JSON.stringify(c).replace(/'/g, "'").replace(/"/g, "&quot;");
            tbody.innerHTML += `
                <tr>
                    <td data-label="Slug">${c.slug}</td>
                    <td data-label="Nome">${c.nome_exibicao}</td>
                    <td data-label="Ordem">${c.ordem}</td>
                    <td class="actions-cell">
                        <button class="btn btn-sm btn-info" onclick='editarCategoria(${cJson})'>
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deletarCat('${c.slug}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    carregarSelectCategorias(); 
}

// Carrega o Select no Modal de Produto
async function carregarSelectCategorias() {
    const { data } = await supa.from('categorias').select('*').order('ordem');
    const sel = document.getElementById('prod-cat');
    if(!sel) return;
    
    sel.innerHTML = '';
    if(data) {
        // Aqui também usa nome_exibicao
        data.forEach((c) => (sel.innerHTML += `<option value="${c.slug}">${c.nome_exibicao}</option>`));
    }
}

// Abre Modal de Edição (Recebe o objeto c inteiro)
function editarCategoria(c) {
    document.getElementById('titulo-modal-cat').innerText = 'Editar Categoria';
    document.getElementById('cat-modo-edicao').value = 'sim';
    
    document.getElementById('cat-slug').value = c.slug;
    document.getElementById('cat-slug').readOnly = true; // Trava o slug na edição
    
    document.getElementById('cat-nome').value = c.nome_exibicao; // Usa nome_exibicao
    document.getElementById('cat-ordem').value = c.ordem;
    
    document.getElementById('modal-cat').style.display = 'flex';
}

async function salvarCategoria() {
    const slug = document.getElementById('cat-slug').value.trim().toLowerCase().replace(/\s+/g, '-');
    const nome = document.getElementById('cat-nome').value.trim();
    let ordemVal = parseInt(document.getElementById('cat-ordem').value);
    const modo = document.getElementById('cat-modo-edicao').value;

    if (!slug || !nome) return alert('Preencha o slug e o nome!');
    
    // Se ordem não foi preenchida ou ficou 0 em modo inserção, busca a próxima automaticamente
    if ((!ordemVal || ordemVal === 0) && modo !== 'sim') {
        const { data: ult } = await supa.from('categorias').select('ordem').order('ordem', { ascending: false }).limit(1);
        ordemVal = (ult && ult.length > 0 && ult[0].ordem != null) ? (ult[0].ordem + 1) : 1;
    }
    
    const dados = { slug, nome_exibicao: nome, ordem: ordemVal };
    
    let erro = null;
    if (modo === 'sim') {
        const slugOriginal = document.getElementById('cat-slug').dataset.slugOriginal || slug;
        const { error } = await supa.from('categorias').update({ nome_exibicao: nome, ordem: ordemVal }).eq('slug', slugOriginal);
        erro = error;
    } else {
        const { error } = await supa.from('categorias').insert([dados]);
        erro = error;
    }

    if (erro) alert('Erro ao salvar: ' + erro.message);
    else { fecharModal('modal-cat'); carregarCategorias(); }
}

async function abrirModalCategoria() {
    document.getElementById('titulo-modal-cat').innerText = 'Nova Categoria';
    document.getElementById('cat-modo-edicao').value = 'nao';
    document.getElementById('cat-slug').value = '';
    document.getElementById('cat-slug').readOnly = false;
    document.getElementById('cat-nome').value = '';
    
    // Auto-preenche a ordem com o próximo número
    try {
        const { data } = await supa.from('categorias').select('ordem').order('ordem', { ascending: false }).limit(1);
        const proximaOrdem = (data && data.length > 0 && data[0].ordem != null) ? (data[0].ordem + 1) : 1;
        document.getElementById('cat-ordem').value = proximaOrdem;
    } catch(e) {
        document.getElementById('cat-ordem').value = '';
    }
    
    document.getElementById('modal-cat').style.display = 'flex';
}

async function deletarProduto(id) {
    const confirmar = confirm('⚠️ ATENÇÃO: Deletar este produto?\n\nEsta ação não pode ser desfeita. O produto será removido permanentemente do sistema.');
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
    const confirmar = confirm('⚠️ ATENÇÃO: Deletar esta categoria?\n\n⚠️ IMPORTANTE: Certifique-se de que não há produtos usando esta categoria, ou eles ficarão sem categoria!\n\nEsta ação não pode ser desfeita.');
    if (!confirmar) return;
    
    try {
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

async function deletarMotoboy(id) {
    const confirmar = confirm('⚠️ ATENÇÃO: Deletar este motoboy?\n\nEsta ação não pode ser desfeita.');
    if (!confirmar) return;
    
    try {
        const { error } = await supa.from('motoboys').delete().eq('id', id);
        if (error) {
            if (error.code === '23503' || (error.message && error.message.includes('foreign key'))) {
                alert('❌ Não é possível excluir este motoboy pois ele possui pedidos vinculados.\n\nDica: Você pode desativar o motoboy em vez de excluir.');
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
            data.forEach(m => {
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
                        <button class="btn btn-info" onclick='editarMoto(${JSON.stringify(m).replace(/'/g, "&apos;").replace(/"/g, "&quot;")})'>
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
            container.innerHTML = '<p style="text-align:center;padding:20px;color:#999">Nenhum motoboy cadastrado.</p>';
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
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:red">Erro ao carregar motoboys</td></tr>';
        return;
    }

    if (data && data.length > 0) {
        data.forEach(m => {
            const mJson = JSON.stringify(m).replace(/'/g, "'").replace(/"/g, "&quot;");
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
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Nenhum motoboy cadastrado.</td></tr>';
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
        telefone: document.getElementById('moto-tel').value 
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
        data.forEach(m => {
            sel.innerHTML += `<option value="${m.id}" data-tel="${m.telefone}" data-nome="${m.nome}">${m.nome}</option>`;
        });
    }
}

// =========================================
// MOTOBOYS (CORRIGIDO)
// =========================================

// === CONFIGURAÇÕES (COMPLETO) ===
async function carregarConfiguracoes() {
    const { data } = await supa.from('configuracoes').select('*').single();
    if (!data) return;

    const s = (id, val) => { const el = document.getElementById(id); if(el) el.value = val ?? ''; };
    s('cfg-aberta',     data.loja_aberta ? 'true' : 'false');
    s('cfg-cotacao',    data.cotacao_real);
    s('cfg-hora-abre',  data.hora_abertura  || '');
    s('cfg-hora-fecha', data.hora_fechamento || '');
    s('cfg-banner-id',  data.banner_produto_id || '');
    s('cfg-banner-img', data.banner_imagem || '');

    if (data.banner_imagem) {
        const prev = document.getElementById('cfg-banner-preview');
        const box  = document.getElementById('cfg-banner-preview-box');
        if (prev) prev.src = data.banner_imagem;
        if (box)  box.style.display = 'block';
    }

    // Personalização visual (se campos existirem)
    const sc = (id, val) => { const el = document.getElementById(id); if(el && val) el.value = val; };
    sc('cfg-nome-loja',   data.nome_loja);
    sc('cfg-cor-primaria', data.cor_primaria);
    sc('cfg-cor-primaria-hex', data.cor_primaria);
    
    // Sincronizar color picker com hex
    const corPicker = document.getElementById('cfg-cor-primaria');
    const corHex = document.getElementById('cfg-cor-primaria-hex');
    if (corPicker && corHex) {
        corPicker.addEventListener('input', (e) => {
            corHex.value = e.target.value;
        });
        corHex.addEventListener('input', (e) => {
            if (e.target.value.startsWith('#') && e.target.value.length === 7) {
                corPicker.value = e.target.value;
            }
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
    const g = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
    const dados = {
        loja_aberta:       g('cfg-aberta') === 'true',
        cotacao_real:      parseFloat(g('cfg-cotacao')) || 1100,
        hora_abertura:     g('cfg-hora-abre'),
        hora_fechamento:   g('cfg-hora-fecha'),
        banner_produto_id: g('cfg-banner-id'),
        banner_imagem:     g('cfg-banner-img') || '',
    };

    // Personalização extra (se campos existirem)
    const nomeLoja = g('cfg-nome-loja');
    const corPri   = g('cfg-cor-primaria');
    const corSec   = g('cfg-cor-secundaria');
    if (nomeLoja)  dados.nome_loja     = nomeLoja;
    if (corPri)    dados.cor_primaria  = corPri;
    if (corSec)    dados.cor_secundaria = corSec;

    const { error } = await supa.from('configuracoes').update(dados).gt('id', 0);
    if (error) alert('Erro: ' + error.message);
    else       alert('✅ Configurações salvas!');
}

function previewBanner(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const prev = document.getElementById('cfg-banner-preview');
        const box  = document.getElementById('cfg-banner-preview-box');
        if (prev) { prev.src = e.target.result; }
        if (box)  { box.style.display = 'block'; }
    };
    reader.readAsDataURL(input.files[0]);
}

async function salvarBanner() {
    const fileInput = document.getElementById('cfg-banner-file');
    const prodId    = document.getElementById('cfg-banner-id')?.value;

    if (!prodId) { alert('Informe o ID do produto promocional.'); return; }
    if (!fileInput?.files?.length) { alert('Selecione uma foto para o banner.'); return; }

    const btn = event.target;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    btn.disabled = true;

    try {
        const file    = fileInput.files[0];
        const nomeArq = `banner_${Date.now()}.${file.name.split('.').pop()}`;
        const { error: uploadErr } = await supa.storage.from('produtos').upload(nomeArq, file, { upsert: true });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supa.storage.from('produtos').getPublicUrl(nomeArq);
        const urlFinal = urlData.publicUrl;

        // Salva a URL e o ID do produto na tabela configuracoes
        await supa.from('configuracoes').update({
            banner_imagem:     urlFinal,
            banner_produto_id: prodId
        }).gt('id', 0);

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
        const box  = document.getElementById('cfg-icone-preview-box');
        if (prev) prev.src = e.target.result;
        if (box)  box.style.display = 'block';
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
        const corPri   = document.getElementById('cfg-cor-primaria')?.value;
        const corHex   = document.getElementById('cfg-cor-primaria-hex')?.value;
        
        if (nomeLoja) dados.nome_loja = nomeLoja;
        if (corPri) dados.cor_primaria = corPri;
        // Se o usuário digitou hex manual, usa ele
        if (corHex && corHex.startsWith('#')) dados.cor_primaria = corHex;

        // Upload do ícone se houver
        const iconeFile = document.getElementById('cfg-icone-file');
        if (iconeFile?.files?.length) {
            const file    = iconeFile.files[0];
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
    if (elDate) elDate.textContent = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });

    const hoje = new Date().toISOString().split('T')[0];
    
    // Pedidos de hoje entregues
    const { data: pedidos } = await supa.from('pedidos').select('*').gte('created_at', hoje).eq('status', 'entregue');
    const total = pedidos ? pedidos.reduce((a, b) => a + (b.total_geral || 0), 0) : 0;
    
    // Pedidos em preparo
    const { count: emPreparo } = await supa.from('pedidos').select('*', { count:'exact', head:true }).eq('status', 'em_preparo');

    const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };
    setVal('kpi-vendas', `Gs ${total.toLocaleString('es-PY')}`);
    setVal('kpi-pedidos', pedidos ? pedidos.length : 0);
    setVal('kpi-moto', `Gs ${((pedidos?.length || 0) * TAXA_MOTOBOY + (pedidos?.length > 0 ? AJUDA_COMBUSTIVEL : 0)).toLocaleString('es-PY')}`);
    setVal('kpi-em-preparo', emPreparo || 0);

    // === RANKING PRODUTOS ===
    const { data: ranking } = await supa.from('produtos').select('nome, vendas_total').order('vendas_total', { ascending: false }).limit(5);
    
    const listaProd = document.getElementById('ranking-produtos-list');
    if (listaProd && ranking) {
        listaProd.innerHTML = '';
        const maxVendas = ranking[0]?.vendas_total || 1;
        ranking.forEach((p, i) => {
            const pct = Math.round(((p.vendas_total || 0) / maxVendas) * 100);
            listaProd.innerHTML += `
                <div class="rank-item">
                    <div class="rank-pos rank-pos-${i+1}">${i+1}</div>
                    <div class="rank-info">
                        <div class="rank-name">${p.nome}</div>
                        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${pct}%"></div></div>
                    </div>
                    <div class="rank-val">${p.vendas_total || 0}</div>
                </div>`;
        });
    }

    // === RANKING CLIENTES ===
    // Agrupa por telefone nos pedidos do banco
    const { data: todosPedidos } = await supa.from('pedidos')
        .select('cliente_nome, cliente_telefone, total_geral')
        .eq('status', 'entregue')
        .order('created_at', { ascending: false })
        .limit(500);

    const listaClientes = document.getElementById('ranking-clientes-list');
    if (listaClientes && todosPedidos) {
        const clienteMap = {};
        todosPedidos.forEach(p => {
            const key = p.cliente_telefone || 'Sem telefone';
            if (!clienteMap[key]) {
                clienteMap[key] = { 
                    nome: p.cliente_nome || 'Desconhecido', 
                    telefone: p.cliente_telefone || '-',
                    qtd: 0, 
                    total: 0 
                };
            }
            clienteMap[key].qtd++;
            clienteMap[key].total += (p.total_geral || 0);
        });

        const top5 = Object.values(clienteMap)
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, 5);

        listaClientes.innerHTML = '';
        const maxQtd = top5[0]?.qtd || 1;
        top5.forEach((c, i) => {
            const pct = Math.round((c.qtd / maxQtd) * 100);
            listaClientes.innerHTML += `
                <div class="rank-item">
                    <div class="rank-pos rank-pos-${i+1}">${i+1}</div>
                    <div class="rank-info">
                        <div class="rank-name">${c.nome}</div>
                        <div style="font-size:0.75rem; color:#7f8c8d; margin-top:2px;">
                            <i class="fas fa-phone"></i> ${c.telefone}
                        </div>
                        <div class="rank-bar-wrap"><div class="rank-bar rank-bar-purple" style="width:${pct}%"></div></div>
                    </div>
                    <div class="rank-val">${c.qtd}x</div>
                </div>`;
        });
    }

    // Legado: tabela ranking (oculta mas mantida para não quebrar refs JS antigas)
    const tb = document.querySelector('#tabela-ranking tbody');
    if(tb && ranking) {
        tb.innerHTML = '';
        ranking.forEach(p => tb.innerHTML += `<tr><td>${p.nome}</td><td>${p.vendas_total}</td></tr>`);
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
    const { data } = await supa.from('produtos').select('*')
        .eq('ativo', true)
        .neq('pausado', true)
        .order('categoria_slug').order('nome');
    produtosCachePDV = data || [];

    // Carrega categorias para exibir no PDV
    const { data: cats } = await supa.from('categorias').select('*').order('ordem');
    produtosCatsPDV = cats || [];

    // Carrega cotação atual das configurações
    const { data: cfg } = await supa.from('configuracoes').select('cotacao_real').single();
    if (cfg && cfg.cotacao_real) _cotacaoPDV = Number(cfg.cotacao_real);

    renderizarGridPDV();
}

let produtosCatsPDV = [];

function renderizarGridPDV() {
    const grid = document.getElementById('pdv-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Agrupa produtos por categoria
    const porCategoria = {};
    produtosCachePDV.forEach(p => {
        const cat = p.categoria_slug || 'outros';
        if (!porCategoria[cat]) porCategoria[cat] = [];
        porCategoria[cat].push(p);
    });

    // Ordena categorias pela ordem definida
    const ordemCats = produtosCatsPDV.map(c => c.slug);
    const slugsOrdenados = Object.keys(porCategoria).sort((a, b) => {
        const ia = ordemCats.indexOf(a);
        const ib = ordemCats.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });

    slugsOrdenados.forEach(slug => {
        const catInfo = produtosCatsPDV.find(c => c.slug === slug);
        const catNome = catInfo ? catInfo.nome_exibicao : slug;

        // Título da categoria
        const h = document.createElement('div');
        h.style.cssText = 'width:100%; padding:8px 4px 4px; font-weight:700; font-size:0.85rem; color:#555; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #eee; margin-bottom:4px;';
        h.textContent = catNome;
        grid.appendChild(h);

        // Cards dos produtos
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;';

        porCategoria[slug].forEach(p => {
            const img = p.imagem_url || 'https://via.placeholder.com/100?text=🍣';
            const card = document.createElement('div');
            card.className = 'pdv-card';
            card.style.backgroundImage = `url('${img}')`;
            card.onclick = () => adicionarItemPDV(p);
            card.innerHTML = `
                <div class="pdv-card-price">Gs ${p.preco.toLocaleString('es-PY')}</div>
                <div class="pdv-card-overlay">${p.nome}</div>
            `;
            row.appendChild(card);
        });

        grid.appendChild(row);
    });
}

function adicionarItemPDV(p) {
    const existe = carrinhoPDV.find(i => i.id === p.id);
    if(existe) existe.qtd++; else carrinhoPDV.push({ ...p, qtd:1 });
    atualizarCarrinhoPDV();
}

function removerItemPDV(idx) {
    carrinhoPDV.splice(idx, 1);
    atualizarCarrinhoPDV();
}

function atualizarCarrinhoPDV() {
    const lista = document.getElementById('pdv-lista');
    const totalEl = document.getElementById('balcao-total');
    if (!lista) return;
    lista.innerHTML = '';
    let total = 0;

    carrinhoPDV.forEach((item, idx) => {
        total += item.preco * item.qtd;
        lista.innerHTML += `
            <div class="pdv-item-row">
                <div><strong>${item.qtd}x</strong> ${item.nome}</div>
                <div style="display:flex; gap:5px; align-items:center;">
                    <span>Gs ${(item.preco * item.qtd).toLocaleString('es-PY')}</span>
                    <button class="btn btn-sm btn-danger" onclick="removerItemPDV(${idx})">✕</button>
                </div>
            </div>`;
    });
    if (totalEl) totalEl.innerText = total.toLocaleString('es-PY');

    // Atualiza info de PIX se estiver selecionado
    atualizarInfoPagPDV(total);
}

function atualizarInfoPagPDV(total) {
    const pag = document.getElementById('balcao-pag')?.value;
    const infoBox = document.getElementById('balcao-pag-info');
    if (!infoBox) return;

    if (pag === 'Pix' && total > 0) {
        const valorReais = (total / _cotacaoPDV).toFixed(2);
        infoBox.style.display = 'block';
        infoBox.innerHTML = `<i class="fas fa-qrcode"></i> <strong>Cobrar em Pix: R$ ${valorReais}</strong> <span style="color:#888;font-size:0.8rem">(Gs ${total.toLocaleString('es-PY')} ÷ ${_cotacaoPDV})</span>`;
    } else {
        infoBox.style.display = 'none';
    }
}

async function salvarPedidoBalcao() {
    if (carrinhoPDV.length === 0) return alert('Carrinho vazio!');
    
    const mesa = document.getElementById('balcao-mesa').value.trim();
    if (!mesa) {
        alert('⚠️ Número de mesa é obrigatório!');
        document.getElementById('balcao-mesa').focus();
        return;
    }

    const cli = document.getElementById('balcao-cliente').value || 'Cliente';
    const tel = document.getElementById('balcao-telefone').value || '';
    const pag = document.getElementById('balcao-pag').value;
    const total = parseInt(document.getElementById('balcao-total').innerText.replace(/\D/g, ''));

    const nomeFinal = `MESA ${mesa} - ${cli}`;

    const pedido = {
        uid_temporal: `BALC-${Math.floor(Math.random()*1000)}`,
        status: 'em_preparo',
        tipo_entrega: 'balcao',
        total_geral: total, subtotal: total, frete_cobrado_cliente: 0,
        forma_pagamento: pag, itens: carrinhoPDV,
        endereco_entrega: `Mesa ${mesa}`,
        cliente_nome: nomeFinal,
        cliente_telefone: tel,
        obs_pagamento: 'Pagamento no Balcão'
    };

    const { error } = await supa.from('pedidos').insert([pedido]);
    if (error) alert('Erro: ' + error.message);
    else {
        carrinhoPDV = [];
        document.getElementById('balcao-cliente').value = '';
        document.getElementById('balcao-mesa').value = '';
        document.getElementById('balcao-telefone').value = '';
        atualizarCarrinhoPDV();
        carregarMonitorMesas();
        alert('Pedido enviado para a Cozinha! 👨‍🍳');
    }
}

async function carregarMonitorMesas() {
    // Busca pedidos de Balcão que NÃO foram finalizados (entregues)
    const { data } = await supa
        .from('pedidos')
        .select('*')
        .eq('tipo_entrega', 'balcao')
        .neq('status', 'entregue') // Traz 'pendente', 'em_preparo' e 'pronto_entrega'
        .order('id', { ascending: false });

    const div = document.getElementById('lista-mesas-andamento');
    if(!div) return;
    
    div.innerHTML = '';

    if (!data || data.length === 0) {
        div.innerHTML = '<p style="text-align:center; font-size:0.8rem; color:#aaa; margin-top:20px">Nenhum pedido ativo.</p>';
        return;
    }

    data.forEach(p => {
        let statusHtml = '';
        let acaoHtml = '';
        let corCard = 'background: rgba(255,255,255,0.1);';

        // Lógica Visual do Status
        if (p.status === 'em_preparo') {
            statusHtml = '<span style="color:#f1c40f"><i class="fas fa-fire"></i> Na Cozinha</span>';
            acaoHtml = `<small style="color:#aaa">Aguardando...</small>`;
        } else if (p.status === 'pronto_entrega') {
            corCard = 'background: rgba(46, 204, 113, 0.2); border: 1px solid #2ecc71;';
            statusHtml = '<span style="color:#2ecc71; font-weight:bold"><i class="fas fa-check-circle"></i> PRONTO!</span>';
            // Botão para finalizar e sumir da lista
            acaoHtml = `<button class="btn btn-sm btn-success" style="width:100%; margin-top:5px" onclick="finalizarMesa(${p.id})">Entregar/Baixar</button>`;
        } else {
            statusHtml = `<span style="color:#ccc">${p.status}</span>`;
        }

        div.innerHTML += `
            <div style="${corCard} padding: 10px; border-radius: 5px; margin-bottom: 10px;">
                <div style="font-weight:bold; font-size:1rem; color:#fff">
                    #${p.uid_temporal || p.id}
                </div>
                <div style="color:#eee; font-size:0.9rem; margin-bottom:5px">
                    ${p.cliente_nome}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    ${statusHtml}
                    <span style="font-size:0.8rem; color:#fff">Gs ${p.total_geral.toLocaleString()}</span>
                </div>
                ${acaoHtml}
            </div>
        `;
    });
}

// Função para dar baixa na mesa (Muda status para 'entregue' e sai da lista)
async function finalizarMesa(id) {
    if(confirm('Confirmar entrega e pagamento desta mesa?')) {
        await supa.from('pedidos').update({ status: 'entregue' }).eq('id', id);
        carregarMonitorMesas();
        // Se estiver na aba financeiro, atualiza também
        if(typeof calcularFinanceiro === 'function') calcularFinanceiro();
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

function toggleTodos(s) { document.querySelectorAll('.check-pedido').forEach((c) => (c.checked = s.checked)); }

// Clique fora do modal fecha
window.onclick = function (event) {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.classList.remove('active');
        event.target.style.display = 'none';
    }
};

// ESC fecha modal
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active, .modal-overlay[style*="flex"]').forEach((modal) => {
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
        data.forEach(u => {
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
            
            const cargoBadge = ehDono ? '🔑 Dono' : (ehGerente ? '👔 Gerente' : '👷 Funcionário');
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
    const msg = novoCargo === 'gerente' ? 'Promover este usuário a Gerente?' : 'Rebaixar este usuário a Funcionário?';
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
    if (!confirm(`⚠️ Excluir o usuário "${email}"?\n\nEsta ação remove apenas o perfil. O acesso de autenticação pode precisar ser revogado no Supabase Dashboard.`)) return;
    
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

    if (!email || !senha || senha.length < 6) return alert('Email e senha (mín. 6 caracteres) são obrigatórios');

    const btn = event?.target;
    if (btn) { btn.disabled = true; btn.innerText = 'Criando...'; }

    try {
        // 1. Cria usuário na Autenticação do Supabase
        const { data, error } = await supa.auth.signUp({ email, password: senha });
        
        if (error) {
            alert('❌ Erro ao criar usuário: ' + error.message);
            return;
        }

        if (data.user) {
            // 2. Salva perfil no banco usando upsert para evitar duplicata de chave
            const { error: errPerfil } = await supa.from('perfis_acesso')
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
    } catch(e) {
        alert('❌ Erro inesperado: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-user-plus"></i> Criar'; }
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
                    ${itens.map((item, i) => `
                        <div class="item-row">
                            <input type="text" class="input-modern" value="${item}" 
                                   placeholder="Nome do item">
                            <button type="button" class="btn-remove-item" 
                                    onclick="removerItem(${index}, ${i})">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('')}
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
    
    (data || []).forEach(c => {
        const tipoLabel = c.tipo === 'percentual' ? `${c.valor}%` : 'Frete Grátis';
        const statusBadge = c.ativo 
            ? '<span class="badge badge-success">Ativo</span>' 
            : '<span class="badge badge-danger">Inativo</span>';
        
        tbody.innerHTML += `
            <tr>
                <td><strong>${c.codigo}</strong></td>
                <td>${c.tipo === 'percentual' ? 'Percentual' : 'Frete Grátis'}</td>
                <td>${tipoLabel}</td>
                <td>Gs ${c.minimo.toLocaleString('es-PY')}</td>
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
    const dados = {
        codigo: document.getElementById('cupom-codigo').value.toUpperCase(),
        tipo: document.getElementById('cupom-tipo').value,
        valor: parseFloat(document.getElementById('cupom-valor').value) || 0,
        minimo: parseFloat(document.getElementById('cupom-minimo').value) || 0,
        ativo: document.getElementById('cupom-ativo').checked
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
                confirmacao_tipo: 'funcionario'
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
        document.querySelectorAll('.btn-periodo').forEach(btn => {
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
    
    pedidos.forEach(p => {
        const data = new Date(p.created_at).toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit' 
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
    
    const valores = datasOrdenadas.map(d => vendasPorDia[d]);
    
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
    const cores = valores.map(v => {
        if (v === melhorValor) return '#27ae60'; // Verde para melhor
        if (v === piorValor) return '#e74c3c';   // Vermelho para pior
        return '#3498db';                         // Azul para demais
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
            datasets: [{
                label: 'Vendas (Gs)',
                data: data,
                backgroundColor: cores,
                borderWidth: 0,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Gs ' + context.parsed.y.toLocaleString('es-PY');
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'Gs ' + (value / 1000).toFixed(0) + 'k';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
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