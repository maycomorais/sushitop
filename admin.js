// =========================================
// 1. CONSTANTES E INICIALIZAÇÃO
// =========================================
const TAXA_MOTOBOY = 5000;
const AJUDA_COMBUSTIVEL = 20000;
const COORD_LOJA = { lat: -25.2365803, lng: -57.5380816 };

let perfilUsuario = null;
let intervaloAlarme = null; // Variável para controlar o loop do som

document.addEventListener('DOMContentLoaded', async () => {
    // Recupera a última aba
    let lastTab = localStorage.getItem('lastTab');
    if (!lastTab || !document.getElementById(lastTab)) {
        lastTab = 'pedidos';
    }
    showTab(lastTab);

    // Inicia Monitoramento Realtime (Backup)
    iniciarRealtime();

    // === SISTEMA DE AUTO-REFRESH (5 SEGUNDOS) ===
    // Isso garante que o pedido apareça mesmo se o Realtime falhar
    setInterval(() => {
        const abaAtual = localStorage.getItem('lastTab');
        console.log(`Auto-refresh na aba: ${abaAtual}`);
        
        if (abaAtual === 'pedidos') carregarPedidos(true); // true = modo silencioso (sem recarregar som se já estiver tocando)
        if (abaAtual === 'cozinha') carregarCozinha();
        if (abaAtual === 'financeiro') calcularFinanceiro();
        if (abaAtual === 'dashboard') carregarDashboard();
    }, 5000);

    // Carregamentos iniciais
    carregarListaSugestoes();

    // Verifica Login
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

    // Desbloqueio de Áudio do Navegador (Primeiro Clique)
    document.body.addEventListener('click', () => {
        const audio = document.getElementById('som-campainha');
        if(audio) {
            // Tenta tocar baixinho e pausar só para liberar a permissão
            audio.volume = 0.1;
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 1.0; // Volta volume normal
            }).catch(() => {});
        }
    }, { once: true });
});

// =========================================
// 2. CONTROLE DE ABAS
// =========================================
function showTab(tabId, event) {
    let target = document.getElementById(tabId);
    if (!target) {
        tabId = 'pedidos';
        target = document.getElementById('pedidos');
    }
    
    localStorage.setItem('lastTab', tabId);

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    
    target.classList.add('active');
    if (event) event.currentTarget.classList.add('active');

    // Carrega dados imediatos
    if (tabId === 'pedidos') carregarPedidos();
    if (tabId === 'cozinha') carregarCozinha();
    if (tabId === 'financeiro') calcularFinanceiro();
    if (tabId === 'motoboys') carregarMotoboys();
    if (tabId === 'produtos') carregarProdutos();
    if (tabId === 'categorias') carregarCategorias();
    if (tabId === 'configuracoes') carregarConfiguracoes();
    if (tabId === 'dashboard') carregarDashboard();
}

// =========================================
// 3. REALTIME E ALARME (Ding Dong Intermitente)
// =========================================
function iniciarRealtime() {
    supa.channel('tabela-pedidos-admin')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
            // Se entrou pedido novo pendente, toca o som
            if (payload.eventType === 'INSERT' && payload.new.status === 'pendente') {
                tocarAlarme();
            }
            // Força atualização visual imediata
            const abaAtual = localStorage.getItem('lastTab');
            if (abaAtual === 'pedidos') carregarPedidos();
            if (abaAtual === 'cozinha') carregarCozinha();
        })
        .subscribe();
}

// Variável de controle para saber se já está tocando
let alarmeAtivo = false;

function tocarAlarme() {
    const audio = document.getElementById('som-campainha');
    if (audio && !alarmeAtivo) {
        audio.currentTime = 0;
        audio.play().then(() => {
            alarmeAtivo = true;
        }).catch(e => console.log("Som bloqueado pelo navegador. Clique na tela."));
    }
}

function pararAlarme() {
    const audio = document.getElementById('som-campainha');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        alarmeAtivo = false;
    }
}

// =========================================
// 4. GESTÃO DE PEDIDOS
// =========================================
async function carregarPedidos(silencioso = false) {
    // 1. Verifica se tem pendentes para controlar o som
    const { count } = await supa.from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente');
    
    // Lógica do Som:
    // Se tem pendente (>0) e não está tocando, toca.
    // Se não tem pendente (0), para o som.
    if (count > 0) {
        if (!alarmeAtivo && !silencioso) tocarAlarme();
    } else {
        pararAlarme();
    }

    // 2. Busca os dados para a tabela
    const { data: pedidos } = await supa
        .from('pedidos')
        .select('*')
        .or('status.eq.pendente,status.eq.pronto_entrega')
        .order('id', { ascending: false });

    const tbody = document.getElementById('lista-pedidos');
    tbody.innerHTML = '';

    if (pedidos) {
        pedidos.forEach((p) => {
            let acoes = '';
            let linhaCor = '';
            let checkbox = '<i class="fas fa-clock" style="color:#ccc"></i>';
            
            // PENDENTE (AMARELO)
            if (p.status === 'pendente') {
                linhaCor = 'background-color: #fff3cd;';
                acoes = `<button class="btn btn-success" onclick="mudarStatus(${p.id}, 'em_preparo')"><i class="fas fa-fire"></i> Cozinha</button>
                         <button class="btn btn-danger" onclick="mudarStatus(${p.id}, 'cancelado')"><i class="fas fa-times"></i></button>`;
            } 
            // PRONTO (VERDE)
            else if (p.status === 'pronto_entrega') {
                linhaCor = 'background-color: #d4edda;';
                acoes = `<span style="color:green; font-weight:bold;">Aguardando Motoboy</span>`;
                
                // Dados para o Zap
                let nomeExibir = p.cliente_nome || 'Cliente';
                const dadosZap = {
                    id: p.id,
                    uid_temporal: p.uid_temporal,
                    total_geral: p.total_geral,
                    forma_pagamento: p.forma_pagamento,
                    obs_pagamento: p.obs_pagamento,
                    endereco_entrega: p.endereco_entrega,
                    geo_lat: p.geo_lat,
                    geo_lng: p.geo_lng,
                    itens: p.itens,
                    cliente_nome: nomeExibir,
                    cliente_telefone: p.cliente_telefone || 'Sem Tel',
                };
                const jsonSeguro = encodeURIComponent(JSON.stringify(dadosZap));
                checkbox = `<input type="checkbox" class="check-pedido" value="${jsonSeguro}">`;
            }

            tbody.innerHTML += `
                <tr style="${linhaCor}">
                    <td>${checkbox}</td>
                    <td>#${p.uid_temporal || p.id}</td>
                    <td>${p.cliente_nome || 'Cliente'}</td>
                    <td><span class="status-badge st-${p.status}">${p.status.toUpperCase().replace('_', ' ')}</span></td>
                    <td>Gs ${p.total_geral.toLocaleString('es-PY')}</td>
                    <td class="actions-cell">${acoes}</td>
                </tr>`;
        });
    }
}

async function mudarStatus(id, novoStatus) {
    // Confirmação rápida
    // if (!confirm(`Mudar para ${novoStatus.toUpperCase()}?`)) return;

    const { error } = await supa.from('pedidos').update({ status: novoStatus }).eq('id', id);

    if (error) {
        alert('Erro: ' + error.message);
    } else {
        // Se enviou para cozinha, o som DEVE parar imediatamente
        if (novoStatus === 'em_preparo') {
            pararAlarme();
        }
        
        // Atualiza a tela imediatamente
        carregarPedidos();
        // Se estivermos com a tela da cozinha aberta em outro lugar, ela atualizará em 5s
    }
}

// =========================================
// 5. TELA COZINHA
// =========================================
async function carregarCozinha() {
    // Usa data_pedido para ordenar corretamente
    const { data: pedidos } = await supa
        .from('pedidos')
        .select('*')
        .eq('status', 'em_preparo')
        .order('data_pedido', { ascending: true });

    const grid = document.getElementById('grid-cozinha');
    grid.innerHTML = '';

    if (!pedidos || pedidos.length === 0) {
        grid.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">Cozinha livre! 🔥</p>';
        return;
    }

    const agora = new Date();

    pedidos.forEach((p) => {
        const dataRef = p.data_pedido || p.created_at; 
        const horaPedido = new Date(dataRef);
        const diffMs = agora - horaPedido;
        const diffMin = Math.floor(diffMs / 60000);

        let classeCor = 'cozinha-verde';
        if (diffMin >= 20 && diffMin <= 30) classeCor = 'cozinha-amarela';
        else if (diffMin > 30) classeCor = 'cozinha-vermelha';

        let htmlItens = '';
        if (p.itens) {
            p.itens.forEach((item) => {
                const qtd = item.qtd || item.quantidade || 1;
                const obs = item.obs ? `<div style="color:red; font-size:0.9em; margin-left:10px;">⚠️ ${item.obs}</div>` : '';
                htmlItens += `<li style="margin-bottom:8px; border-bottom:1px dashed #eee; padding-bottom:5px;">
                    <strong style="font-size:1.1em">${qtd}x</strong> ${item.nome}
                    ${obs}
                </li>`;
            });
        }

        grid.innerHTML += `
            <div class="card-cozinha ${classeCor}">
                <div style="flex: 1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0">#${p.uid_temporal || p.id} <span style="font-weight:normal; font-size:0.8em">(${p.cliente_nome || 'Balcão'})</span></h3>
                        <span class="timer-badge"><i class="far fa-clock"></i> ${diffMin} min</span>
                    </div>
                    <ul style="list-style:none; padding:0; margin-top:15px;">
                        ${htmlItens}
                    </ul>
                </div>
                <div style="margin-left: 15px; border-left:1px solid #eee; padding-left:15px;">
                    <button class="btn btn-success" style="padding: 20px 15px;" onclick="mudarStatus(${p.id}, 'pronto_entrega')">
                        <i class="fas fa-check"></i><br>PRONTO
                    </button>
                </div>
            </div>`;
    });
}

// =========================================
// 6. FINANCEIRO
// =========================================
async function calcularFinanceiro() {
    console.log("Calculando financeiro...");
    let pix = 0, cartao = 0, efetivo = 0, totalFaturamento = 0;
    let custoTotalMotoboys = 0;
    let relatorioMotoboys = {}; 
    const hoje = new Date().toISOString().split('T')[0];

    // Busca Motoboys
    const { data: listaMotoboys } = await supa.from('motoboys').select('*');
    if (listaMotoboys) {
        listaMotoboys.forEach(m => relatorioMotoboys[m.id] = { nome: m.nome, qtd: 0, total: 0 });
    }
    relatorioMotoboys['outros'] = { nome: 'Outros', qtd: 0, total: 0 };

    // Busca Vendas
    const { data: vendas } = await supa
        .from('pedidos')
        .select('*')
        .eq('status', 'entregue')
        .gte('data_pedido', hoje);

    if (vendas) {
        vendas.forEach((v) => {
            totalFaturamento += (v.total_geral || 0);

            // Soma Pagamentos
            const forma = (v.forma_pagamento || '').toLowerCase();
            if (forma.includes('pix') || forma.includes('transfer')) pix += v.total_geral;
            else if (forma.includes('cartao')) cartao += v.total_geral;
            else efetivo += v.total_geral;

            // Custo Motoboy
            if (v.tipo_entrega === 'delivery' && v.motoboy_id) {
                const taxa = TAXA_MOTOBOY; 
                custoTotalMotoboys += taxa;
                if (relatorioMotoboys[v.motoboy_id]) {
                    relatorioMotoboys[v.motoboy_id].qtd++;
                    relatorioMotoboys[v.motoboy_id].total += taxa;
                } else {
                    relatorioMotoboys['outros'].qtd++;
                    relatorioMotoboys['outros'].total += taxa;
                }
            }
        });
    }

    // Adiciona Ajuda de Custo (Combustível)
    Object.values(relatorioMotoboys).forEach(moto => {
        if (moto.qtd > 0) {
            moto.total += AJUDA_COMBUSTIVEL; 
            custoTotalMotoboys += AJUDA_COMBUSTIVEL;
            moto.combustivel = true;
        }
    });

    // Atualiza DOM
    const fmt = (v) => `Gs ${v.toLocaleString('es-PY')}`;
    if(document.getElementById('total-pix')) document.getElementById('total-pix').innerText = fmt(pix);
    if(document.getElementById('total-cartao')) document.getElementById('total-cartao').innerText = fmt(cartao);
    if(document.getElementById('total-efetivo')) document.getElementById('total-efetivo').innerText = fmt(efetivo);
    if(document.getElementById('card-faturamento')) document.getElementById('card-faturamento').innerText = fmt(totalFaturamento);
    if(document.getElementById('card-custo-moto')) document.getElementById('card-custo-moto').innerText = fmt(custoTotalMotoboys);
    if(document.getElementById('card-lucro')) document.getElementById('card-lucro').innerText = fmt(totalFaturamento - custoTotalMotoboys);

    const tbody = document.getElementById('lista-financeiro-motoboys');
    if (tbody) {
        tbody.innerHTML = '';
        Object.values(relatorioMotoboys).forEach(moto => {
            if (moto.qtd > 0) {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${moto.nome}</strong>${moto.combustivel ? '<br><small style="color:green">+ Combustível</small>' : ''}</td>
                        <td style="text-align:center;">${moto.qtd}</td>
                        <td style="text-align:center;">Gs ${TAXA_MOTOBOY.toLocaleString()}</td>
                        <td style="text-align:right; font-weight:bold;">${fmt(moto.total)}</td>
                    </tr>`;
            }
        });
    }
}

// =========================================
// 7. ZAP & ROTA
// =========================================
function enviarRotaZap() {
    const checks = document.querySelectorAll('.check-pedido:checked');
    const selMoto = document.getElementById('sel-motoboy');

    if (checks.length === 0 || !selMoto.value) return alert('Selecione os pedidos e o motoboy!');
    
    const opt = selMoto.options[selMoto.selectedIndex];
    let msg = `🛵 *ROTA - ${opt.dataset.nome.toUpperCase()}*\n\n`;
    let coords = [];
    let taxaTotal = 0;

    checks.forEach((chk) => {
        const p = JSON.parse(decodeURIComponent(chk.value));
        
        // Atualiza status no banco
        supa.from('pedidos').update({ status: 'entregue', motoboy_id: selMoto.value }).eq('id', p.id).then();

        msg += `📦 *PEDIDO #${p.uid_temporal || p.id}*\n`;
        msg += `👤 ${p.cliente_nome} | 📞 ${p.cliente_telefone}\n`;
        
        // Bebidas
        if (p.itens) {
            const bebidas = p.itens.filter(i => /coca|fanta|sprite|guarana|agua|cerveja/i.test(i.nome));
            if (bebidas.length > 0) {
                msg += `🥤 *LEVAR:* ${bebidas.map(b => `${b.qtd}x ${b.nome}`).join(', ')}\n`;
            }
        }

        // Endereço e Link
        if (p.geo_lat && p.geo_lng) {
            const link = `http://maps.google.com/?q=${p.geo_lat},${p.geo_lng}`;
            msg += `📍 ${link}\n`;
            coords.push(`${p.geo_lat},${p.geo_lng}`);
        } else {
            msg += `🏠 ${p.endereco_entrega}\n`;
        }

        // Cobrança
        const forma = (p.forma_pagamento || '').toLowerCase();
        if (forma.includes('pix') || forma.includes('transfer')) {
            msg += `✅ *PAGO (Pix/Transf)*\n`;
        } else if (forma.includes('cartao')) {
            msg += `💳 *Cobrar Cartão: Gs ${p.total_geral.toLocaleString('es-PY')}*\n`;
        } else {
            msg += `💰 *COBRAR: Gs ${p.total_geral.toLocaleString('es-PY')}*\n`;
            // Lógica de troco simples
            const obsPag = p.obs_pagamento || '';
            const nums = obsPag.match(/\d+/g);
            if(nums) {
                let valorTroco = parseInt(nums.join(''));
                if (valorTroco < 1000) valorTroco *= 1000; // Ajuste zeros
                if (valorTroco > p.total_geral) {
                    msg += `🔄 Levar troco para: Gs ${valorTroco.toLocaleString()}\n`;
                }
            }
        }
        msg += `-----------------\n`;
        taxaTotal += TAXA_MOTOBOY;
    });

    // Rota Otimizada Google Maps
    if (coords.length > 0) {
        const rota = `https://www.google.com/maps/dir/${COORD_LOJA.lat},${COORD_LOJA.lng}/${coords.join('/')}`;
        msg += `\n🗺️ *ROTA NO MAPA:*\n${rota}\n`;
    }

    msg += `\n🏍️ *Taxa Total: Gs ${taxaTotal.toLocaleString('es-PY')}*`;
    
    window.open(`https://wa.me/${opt.dataset.tel}?text=${encodeURIComponent(msg)}`, '_blank');
    
    // Atualiza a tela após 1s
    setTimeout(() => carregarPedidos(), 1000);
}

// =========================================
// 8. FUNÇÕES GERAIS (Produtos, Cats, Motoboys)
// =========================================
// ... (Mantendo as funções padrão de CRUD para economizar espaço, elas não mudaram a lógica)
async function carregarProdutos() {
    const { data } = await supa.from('produtos').select('*').order('nome');
    const tb = document.getElementById('lista-produtos');
    tb.innerHTML = '';
    data.forEach((p) => {
        const pJson = JSON.stringify(p).replace(/'/g, "'");
        tb.innerHTML += `<tr><td><img src="${p.imagem_url}" width="30"></td><td>${p.nome}</td><td>${p.categoria_slug}</td><td>Gs ${p.preco.toLocaleString()}</td><td class="actions-cell"><button class="btn btn-sm btn-primary" onclick='editarProduto(${pJson})'><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-danger" onclick="deletarProduto(${p.id})"><i class="fas fa-trash"></i></button></td></tr>`;
    });
    carregarSelectCategorias();
}
// ... As funções editarProduto, salvarProduto, etc, permanecem iguais ...
// Vou incluir as essenciais para o funcionamento:

async function deletarProduto(id) { if(confirm('Excluir?')) { await supa.from('produtos').delete().eq('id', id); carregarProdutos(); } }
function previewUpload(input) { if (input.files && input.files[0]) { const r = new FileReader(); r.onload = (e) => { document.getElementById('img-preview').src = e.target.result; document.getElementById('box-preview').style.display = 'block'; }; r.readAsDataURL(input.files[0]); } }
async function salvarProduto() {
    // ... Lógica de upload igual ao anterior ...
    const btn = event.target; btn.innerText = 'Salvando...'; btn.disabled = true;
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
        };
        if (id) await supa.from('produtos').update(dados).eq('id', id);
        else await supa.from('produtos').insert([dados]);
        fecharModal('modal-produto'); carregarProdutos();
    } catch (e) { alert('Erro: ' + e.message); } finally { btn.innerText = 'Salvar'; btn.disabled = false; }
}

function abrirModalProduto() { document.getElementById('prod-id').value = ''; toggleBuilder(); document.getElementById('modal-produto').style.display = 'flex'; }
function toggleBuilder() { document.getElementById('builder-area').style.display = document.getElementById('prod-montavel').checked ? 'block' : 'none'; }
function addBuilderStep(t = '', m = 1, i = []) {
    const div = document.createElement('div');
    div.className = 'etapa-item';
    div.innerHTML = `<div class="etapa-header"><input type="text" class="form-control step-titulo" value="${t}" placeholder="Título"><input type="number" class="form-control step-max" value="${m}" style="width:70px"><button class="btn btn-sm btn-danger" onclick="this.parentElement.parentElement.remove()">X</button></div><textarea class="etapa-ingredientes step-itens">${i.join(', ')}</textarea>`;
    document.getElementById('builder-steps').appendChild(div);
}

// Categorias e Motoboys (Simplificados para não estourar limite)
async function carregarCategorias() { const { data } = await supa.from('categorias').select('*').order('ordem'); const tb = document.getElementById('lista-categorias'); tb.innerHTML = ''; data.forEach(c => { const cJson = JSON.stringify(c).replace(/'/g, "'"); tb.innerHTML += `<tr><td>${c.slug}</td><td>${c.nome_exibicao}</td><td>${c.ordem}</td><td class="actions-cell"><button class="btn btn-sm btn-primary" onclick='editarCategoria(${cJson})'><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-danger" onclick="deletarCat('${c.slug}')"><i class="fas fa-trash"></i></button></td></tr>`; }); }
async function carregarSelectCategorias() { const { data } = await supa.from('categorias').select('*').order('ordem'); const sel = document.getElementById('prod-cat'); sel.innerHTML = ''; data.forEach(c => sel.innerHTML += `<option value="${c.slug}">${c.nome_exibicao}</option>`); }
function editarCategoria(c) { document.getElementById('cat-slug').value = c.slug; document.getElementById('cat-nome').value = c.nome_exibicao; document.getElementById('cat-ordem').value = c.ordem; document.getElementById('modal-cat').style.display = 'flex'; }
async function salvarCategoria() { const dados = { slug: document.getElementById('cat-slug').value, nome_exibicao: document.getElementById('cat-nome').value, ordem: parseInt(document.getElementById('cat-ordem').value) }; await supa.from('categorias').upsert([dados]); fecharModal('modal-cat'); carregarCategorias(); }
async function deletarCat(slug) { if(confirm('Excluir?')) { await supa.from('categorias').delete().eq('slug', slug); carregarCategorias(); } }
function abrirModalCategoria() { document.getElementById('modal-cat').style.display = 'flex'; }

async function carregarMotoboys() { const { data } = await supa.from('motoboys').select('*'); const tb = document.getElementById('lista-motos'); tb.innerHTML = ''; data.forEach(m => { const mJson = JSON.stringify(m).replace(/'/g, "'"); tb.innerHTML += `<tr><td>${m.nome}</td><td>${m.telefone}</td><td class="actions-cell"><button class="btn btn-sm btn-primary" onclick='editarMoto(${mJson})'>Edit</button><button class="btn btn-sm btn-danger" onclick="deletarMoto(${m.id})"><i class="fas fa-trash"></i></button></td></tr>`; }); }
async function carregarMotoboysSelect() { const { data } = await supa.from('motoboys').select('*').eq('ativo', true); const sel = document.getElementById('sel-motoboy'); if(sel) { sel.innerHTML = '<option value="">Selecione...</option>'; data.forEach(m => sel.innerHTML += `<option value="${m.id}" data-tel="${m.telefone}" data-nome="${m.nome}">${m.nome}</option>`); } }
async function salvarMotoboy() { const dados = { nome: document.getElementById('moto-nome').value, telefone: document.getElementById('moto-tel').value }; const id = document.getElementById('moto-id').value; if(id) await supa.from('motoboys').update(dados).eq('id', id); else await supa.from('motoboys').insert([dados]); fecharModal('modal-moto'); carregarMotoboys(); }
async function deletarMoto(id) { if(confirm('Excluir?')) await supa.from('motoboys').delete().eq('id', id); carregarMotoboys(); }
function abrirModalMoto() { document.getElementById('moto-id').value = ''; document.getElementById('modal-moto').style.display = 'flex'; }
function editarMoto(m) { document.getElementById('moto-id').value = m.id; document.getElementById('moto-nome').value = m.nome; document.getElementById('moto-tel').value = m.telefone; document.getElementById('modal-moto').style.display = 'flex'; }

async function carregarConfiguracoes() { /* Mesma logica anterior */ const { data } = await supa.from('configuracoes').select('*').single(); if(data) { document.getElementById('cfg-aberta').value = data.loja_aberta.toString(); document.getElementById('cfg-cotacao').value = data.cotacao_real; document.getElementById('cfg-hora-abre').value = data.hora_abertura; document.getElementById('cfg-hora-fecha').value = data.hora_fechamento; document.getElementById('cfg-banner-id').value = data.banner_produto_id; document.getElementById('cfg-banner-img').value = data.banner_imagem; if(data.banner_imagem) document.getElementById('preview-banner').src = data.banner_imagem; } }
async function salvarConfiguracoes() { const dados = { loja_aberta: document.getElementById('cfg-aberta').value === 'true', cotacao_real: document.getElementById('cfg-cotacao').value, hora_abertura: document.getElementById('cfg-hora-abre').value, hora_fechamento: document.getElementById('cfg-hora-fecha').value, banner_produto_id: document.getElementById('cfg-banner-id').value, banner_imagem: document.getElementById('cfg-banner-img').value }; await supa.from('configuracoes').update(dados).gt('id', 0); alert('Salvo!'); }

async function carregarDashboard() {
    const hoje = new Date().toISOString().split('T')[0];
    const { data: pedidos } = await supa.from('pedidos').select('*').gte('data_pedido', hoje).eq('status', 'entregue');
    const total = pedidos ? pedidos.reduce((a, b) => a + (b.total_geral || 0), 0) : 0;
    
    if(document.getElementById('kpi-vendas')) document.getElementById('kpi-vendas').innerText = `Gs ${total.toLocaleString('es-PY')}`;
    if(document.getElementById('kpi-pedidos')) document.getElementById('kpi-pedidos').innerText = pedidos ? pedidos.length : 0;
    
    // Ranking Simples
    const { data: ranking } = await supa.from('produtos').select('nome, vendas_total').order('vendas_total', { ascending: false }).limit(5);
    const tb = document.querySelector('#tabela-ranking tbody');
    if(tb) { tb.innerHTML = ''; if (ranking) ranking.forEach(p => tb.innerHTML += `<tr><td>${p.nome}</td><td>${p.vendas_total}</td></tr>`); }
}
async function logout() { await supa.auth.signOut(); window.location.href = 'login.html'; }

// =========================================
// 9. VENDA BALCÃO (CORRIGIDA)
// =========================================
let itensBalcao = [];
let produtosCache = [];

async function carregarListaSugestoes() {
    const { data } = await supa.from('produtos').select('nome, preco');
    produtosCache = data || [];
    const dl = document.getElementById('lista-sugestoes');
    if (dl) {
        dl.innerHTML = '';
        produtosCache.forEach((p) => (dl.innerHTML += `<option value="${p.nome}">Gs ${p.preco}</option>`));
    }
}

function abrirModalBalcao() {
    itensBalcao = [];
    document.getElementById('balcao-cliente').value = '';
    document.getElementById('balcao-busca').value = '';
    atualizarListaBalcao();
    if (produtosCache.length === 0) carregarListaSugestoes();
    document.getElementById('modal-balcao').style.display = 'flex';
}

function adicionarItemBalcao() {
    const val = document.getElementById('balcao-busca').value;
    const prod = produtosCache.find((p) => p.nome === val);
    if (prod) {
        itensBalcao.push({ nome: prod.nome, preco: prod.preco, qtd: 1 });
        document.getElementById('balcao-busca').value = '';
        atualizarListaBalcao();
    }
}

function atualizarListaBalcao() {
    const tb = document.getElementById('lista-itens-balcao');
    tb.innerHTML = '';
    let total = 0;
    itensBalcao.forEach((i, idx) => {
        total += i.preco;
        tb.innerHTML += `<tr><td>${i.nome}</td><td>Gs ${i.preco.toLocaleString()}</td><td><button class="btn btn-sm btn-danger" onclick="itensBalcao.splice(${idx},1); atualizarListaBalcao()">X</button></td></tr>`;
    });
    document.getElementById('balcao-total').innerText = total.toLocaleString('es-PY');
}

async function salvarPedidoBalcao() {
    const cliente = document.getElementById('balcao-cliente').value || 'Cliente Balcão';
    const total = parseInt(document.getElementById('balcao-total').innerText.replace(/\D/g, ''));
    const pag = document.getElementById('balcao-pag').value;

    if (total === 0) return alert('Adicione itens!');

    // CORREÇÃO AQUI: removido 'clientes: { nome: ... }'
    const pedido = {
        uid_temporal: `BALC-${Math.floor(Math.random() * 1000)}`,
        status: 'entregue',
        tipo_entrega: 'balcao',
        total_geral: total,
        subtotal: total,
        frete_cobrado_cliente: 0,
        forma_pagamento: pag,
        itens: itensBalcao,
        endereco_entrega: 'Retirada Balcão',
        cliente_nome: cliente, // Salva o nome direto na coluna texto
        cliente_telefone: 'Balcão'
    };

    const { error } = await supa.from('pedidos').insert([pedido]);

    if (error) {
        alert('Erro: ' + error.message);
        console.error(error);
    } else {
        alert('Venda registrada!');
        fecharModal('modal-balcao');
        if (typeof calcularFinanceiro === 'function') calcularFinanceiro();
    }
}

// Utilitários
function fecharModal(id) { document.getElementById(id).style.display = 'none'; }
function toggleTodos(s) { document.querySelectorAll('.check-pedido').forEach((c) => (c.checked = s.checked)); }
window.onclick = function (event) {
    if (event.target.classList.contains('modal-overlay')) {
        document.querySelectorAll('.modal-overlay').forEach((modal) => { modal.style.display = 'none'; });
    }
};