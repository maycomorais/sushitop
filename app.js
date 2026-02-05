// ==========================================
// 1. CONFIGURAÇÕES
// ==========================================
const FONE_LOJA = "595992490500";
const COORD_LOJA = { lat: -25.2365803, lng: -57.5380816 };
let COTACAO_REAL = 1100; 

// DADOS PIX & BANCO
const CHAVE_PIX = "16999647032"; 
const NOME_PIX = "Jessica Aparecida Silva Pereira";
const DADOS_ALIAS = "Banco: Itaú PY | Titular: Marcus de Alencar Roque Pereira";
const ALIAS_PY = "Alias: 0992490500";

if (typeof supa === 'undefined') {
    console.error("ERRO: O arquivo supabaseClient.js não foi carregado antes do app.js");
    alert("Erro de sistema. Recarregue a página.");
}

// ==========================================
// 2. ESTADO DA APLICAÇÃO
// ==========================================
let carrinho = [];
let freteCalculado = 0;
let localCliente = null;
let modoEntrega = 'delivery';
let prodAtual = null, optAtual = null, qtd = 1;
let itensMontagem = {}; 

// Variável Global de Menu (Preenchida via Banco)
let MENU = {
    "promocoes_do_dia": [], "sushis_e_rolls": [], "temakis": [],
    "pratos_quentes": [], "pokes": [], "bebidas": [], "upsell": []
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    if(!supabase) { alert("Erro: Biblioteca Supabase não carregou."); return; }
    
    verificarHorario(); // NOVO: Checa se está aberto
    renderMenu();
    carregarDadosLocal();
});

// --- FUNÇÃO DE HORÁRIO (NOVA) ---
async function verificarHorario() {
    const { data } = await supa.from('configuracoes').select('*').single();
    if(!data) return;

    if(data.cotacao_real) COTACAO_REAL = data.cotacao_real; // Atualiza cotação do banco

    const agora = new Date();
    const horaAtual = agora.getHours() * 60 + agora.getMinutes();

    function horaParaMin(str) {
        if(!str) return 0;
        const [h, m] = str.split(':').map(Number);
        return h * 60 + m;
    }

    const abre = horaParaMin(data.hora_abertura || "18:00");
    const fecha = horaParaMin(data.hora_fechamento || "23:59");
    const manualAberto = data.loja_aberta; 
    const badge = document.querySelector('.badge-status');

    let estaAberto = false;
    if (!manualAberto) estaAberto = false;
    else {
        if (fecha < abre) estaAberto = (horaAtual >= abre || horaAtual < fecha);
        else estaAberto = (horaAtual >= abre && horaAtual < fecha);
    }

    if(estaAberto) {
        badge.innerText = "Aberto";
        badge.style.background = "#e6ffea";
        badge.style.color = "#28a745";
    } else {
        badge.innerText = "Fechado";
        badge.style.background = "#ffebee";
        badge.style.color = "#c0392b";
        // Opcional: Bloquear botão de finalizar
    }
}

// 1. RENDERIZAR MENU (Busca do Banco)
async function renderMenu() {
    const nav = document.getElementById('category-nav');
    const content = document.getElementById('menu-content');
    nav.innerHTML = ''; content.innerHTML = ''; // Limpa antes de renderizar
    
    // Busca Categorias e Produtos do Banco
    const { data: categsDb } = await supa.from('categorias').select('*').order('ordem');
    const { data: produtos } = await supa.from('produtos').select('*').eq('ativo', true);

    if(!produtos || !categsDb) { console.error("Erro ao carregar menu do banco"); return; }

    // Limpa estrutura local
    for (let key in MENU) MENU[key] = [];

    // Popula estrutura local com dados do banco
    produtos.forEach(p => {
        if(!MENU[p.categoria_slug]) MENU[p.categoria_slug] = [];
        
        MENU[p.categoria_slug].push({
            id: p.id,
            nome: p.nome,
            desc: p.descricao,
            preco: p.preco,
            img: p.imagem_url,
            montagem: p.montagem_config, // JSON para Pokes
            e_montavel: p.e_montavel
            // Opções simples (P/M/G) podem ser adaptadas aqui se usar JSONB tbm
        });
    });

    // Renderiza na tela
    categsDb.forEach(cat => {
        const key = cat.slug;
        const items = MENU[key];

        if(items && items.length > 0) {
            // Cria Botão Navegação
            const pill = document.createElement('button');
            pill.className = 'cat-pill';
            pill.innerText = cat.nome_exibicao;
            pill.onclick = () => {
                document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                document.getElementById(key).scrollIntoView({behavior:'smooth', block:'start'});
            };
            nav.appendChild(pill);

            // Cria Seção
            const section = document.createElement('section');
            section.id = key;
            section.innerHTML = `<h2 class="section-title">${cat.nome_exibicao}</h2>`;

            items.forEach(item => {
                let img = item.img || "https://cdn-icons-png.flaticon.com/512/2252/2252075.png";
                
                // Card Produto
                const div = document.createElement('div');
                div.className = 'product-item';
                div.onclick = () => abrirModal(item);
                
                div.innerHTML = `
                    <div class="prod-info">
                        <div class="prod-title">${item.nome}</div>
                        <div class="prod-desc">${item.desc || ''}</div>
                        <div class="prod-price">Gs ${item.preco.toLocaleString('es-PY')}</div>
                    </div>
                    <img src="${img}" class="prod-img">
                `;
                section.appendChild(div);
            });
            content.appendChild(section);
        }
    });
}

// 2. MODAL DE PRODUTO (Mantendo sua lógica de montagem)
function abrirModal(item) {
    prodAtual = item;
    qtd = 1;
    itensMontagem = {}; 

    document.getElementById('modal-title').innerText = item.nome;
    document.getElementById('modal-desc').innerText = item.desc || '';
    document.getElementById('modal-obs').value = '';
    
    // Área de Opções (Tamanhos) e Montagem (Pokes)
    const divOptions = document.getElementById('modal-options');
    divOptions.innerHTML = ''; 

    // Lógica para Pokes (Montagem Complexa via JSON do banco)
    if(item.e_montavel && item.montagem) {
        item.montagem.forEach((etapa, idxEtapa) => {
            const h4 = document.createElement('h4');
            h4.innerText = `${etapa.titulo} (Máx: ${etapa.max})`;
            h4.style.marginTop = "10px";
            divOptions.appendChild(h4);

            etapa.itens.forEach(ingrediente => {
                const label = document.createElement('label');
                label.style.display = 'block';
                label.style.padding = '5px 0';
                
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.value = ingrediente;
                input.name = `etapa_${idxEtapa}`;
                
                // Controle de Máximo
                input.onchange = function() {
                    const marcados = document.querySelectorAll(`input[name="etapa_${idxEtapa}"]:checked`);
                    if(marcados.length > etapa.max) {
                        this.checked = false;
                        alert(`Máximo de ${etapa.max} itens nesta etapa.`);
                    }
                };

                label.appendChild(input);
                label.appendChild(document.createTextNode(" " + ingrediente));
                divOptions.appendChild(label);
            });
        });
    }

    atualizarPrecoModal();
    document.getElementById('product-modal').classList.add('active');
}

function fecharModalProduto() {
    document.getElementById('product-modal').classList.remove('active');
}

function mudarQtd(delta) {
    if (qtd + delta >= 1) {
        qtd += delta;
        atualizarPrecoModal();
    }
}

function atualizarPrecoModal() {
    // Se tiver opções de tamanho (implementação futura), soma aqui
    let precoFinal = prodAtual.preco; 
    document.getElementById('modal-qty').innerText = qtd;
    document.getElementById('modal-price').innerText = `Gs ${(precoFinal * qtd).toLocaleString('es-PY')}`;
}

function adicionarDoModal() {
    const obs = document.getElementById('modal-obs').value;
    
    // Coletar Montagem (Poke)
    let montagemEscolhida = [];
    if(prodAtual.e_montavel) {
        const inputs = document.querySelectorAll('#modal-options input:checked');
        if(inputs.length === 0) {
            if(!confirm("Tem certeza que não quer adicionar nenhum ingrediente?")) return;
        }
        inputs.forEach(i => montagemEscolhida.push(i.value));
    }

    carrinho.push({
        ...prodAtual,
        qtd: qtd,
        obs: obs,
        montagem: montagemEscolhida
    });

    updateUI();
    fecharModalProduto();
}

// 3. CARRINHO & UI
function updateUI() {
    const cartBar = document.getElementById('cart-bar');
    const countSpan = document.getElementById('cart-count');
    const totalSpan = document.getElementById('cart-total');

    const totalQtd = carrinho.reduce((acc, item) => acc + item.qtd, 0);
    const totalValor = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);

    if (totalQtd > 0) {
        cartBar.classList.add('show');
        countSpan.innerText = totalQtd;
        totalSpan.innerText = `Gs ${totalValor.toLocaleString('es-PY')}`;
    } else {
        cartBar.classList.remove('show');
    }
}

// 4. CHECKOUT
function abrirCheckout() {
    if (carrinho.length === 0) return;

    const lista = document.getElementById('carrinho-lista');
    lista.innerHTML = '';

    carrinho.forEach((item, index) => {
        let descMontagem = "";
        if(item.montagem && item.montagem.length) {
            descMontagem = `<div style="font-size:0.75rem; color:#666;">+ ${item.montagem.join(', ')}</div>`;
        }
        
        const div = document.createElement('div');
        div.className = 'cart-item-row';
        div.innerHTML = `
            <div class="cart-details">
                <div class="cart-title">${item.nome}</div>
                ${descMontagem}
                ${item.obs ? `<div class="cart-variant">Obs: ${item.obs}</div>` : ''}
                <div class="cart-item-price">Gs ${(item.preco * item.qtd).toLocaleString('es-PY')}</div>
            </div>
            <div class="qty-mini">
                <button onclick="alterarQtdCarrinho(${index}, -1)">-</button>
                <span>${item.qtd}</span>
                <button onclick="alterarQtdCarrinho(${index}, 1)">+</button>
            </div>
        `;
        lista.appendChild(div);
    });

    // Se ainda não calculou frete, tenta delivery
    if(modoEntrega === 'delivery' && freteCalculado === 0 && localCliente) {
        calcularFrete(); 
    }
    
    atualizarTotalCheckout();
    verificarPagamento(); // Atualiza visual do pagamento
    document.getElementById('checkout-modal').classList.add('active');
}

function fecharCheckout() {
    document.getElementById('checkout-modal').classList.remove('active');
}

function alterarQtdCarrinho(index, delta) {
    carrinho[index].qtd += delta;
    if (carrinho[index].qtd <= 0) {
        carrinho.splice(index, 1);
        if (carrinho.length === 0) fecharCheckout();
    }
    updateUI();
    abrirCheckout();
}

function mudarModoEntrega(modo) {
    modoEntrega = modo;
    const btnDelivery = document.getElementById('btn-delivery');
    const btnRetirada = document.getElementById('btn-retirada');
    const boxEndereco = document.getElementById('box-endereco');

    if (modo === 'delivery') {
        btnDelivery.classList.add('active');
        btnRetirada.classList.remove('active');
        boxEndereco.style.display = 'block';
        if (localCliente && freteCalculado === 0) calcularFrete();
    } else {
        btnRetirada.classList.add('active');
        btnDelivery.classList.remove('active');
        boxEndereco.style.display = 'none';
        freteCalculado = 0;
        document.getElementById('frete-msg').innerHTML = '';
    }
    atualizarTotalCheckout();
}

// 5. GEOLOCALIZAÇÃO
function calcularFrete() {
    const btnGps = document.getElementById('btn-gps');
    const msg = document.getElementById('frete-msg');

    if (!navigator.geolocation) {
        alert("Seu navegador não suporta geolocalização.");
        return;
    }

    btnGps.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            localCliente = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            const dist = getDistancia(COORD_LOJA.lat, COORD_LOJA.lng, localCliente.lat, localCliente.lng);
            
            // Regra de Frete (Exemplo)
            if (dist <= 3.0) freteCalculado = 5000;
            else if (dist <= 5.0) freteCalculado = 10000;
            else if (dist <= 8.0) freteCalculado = 15000;
            else freteCalculado = 20000; // Longe

            msg.innerHTML = `Distância: ${dist.toFixed(1)}km | Frete: Gs ${freteCalculado.toLocaleString('es-PY')}`;
            msg.style.color = 'green';
            btnGps.innerHTML = '<i class="fas fa-check"></i> Localizado';
            btnGps.style.background = '#28a745';
            
            atualizarTotalCheckout();
        },
        (error) => {
            console.error(error);
            alert("Erro ao obter localização. Verifique se o GPS está ativo.");
            btnGps.innerHTML = '<i class="fas fa-map-marker-alt"></i> Usar minha localização';
        }
    );
}

// Fórmula de Haversine para distância em km
function getDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function atualizarTotalCheckout() {
    const totalItens = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    const totalFinal = totalItens + (modoEntrega === 'delivery' ? freteCalculado : 0);
    document.getElementById('total-final-checkout').innerText = `Gs ${totalFinal.toLocaleString('es-PY')}`;
}

// 6. PAGAMENTO & FATURA
function verificarPagamento() {
    const metodo = document.getElementById('forma-pag').value;
    const infoBox = document.getElementById('info-pagamento-extra');
    const boxTroco = document.getElementById('box-troco');
    
    // Esconde tudo primeiro
    infoBox.style.display = 'none';
    boxTroco.style.display = 'none';

    // Calcula Total para mostrar em Reais se for Pix
    const totalItens = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    const totalGeral = totalItens + (modoEntrega === 'delivery' ? freteCalculado : 0);

    if (metodo === 'Pix') {
        const valorReais = (totalGeral / COTACAO_REAL).toFixed(2);
        infoBox.style.display = 'block';
        infoBox.innerHTML = `
            <strong>Total em Reais: R$ ${valorReais}</strong><br>
            Chave: ${CHAVE_PIX}<br>
            Nome: ${NOME_PIX}
        `;
    } else if (metodo === 'Transferencia') {
        infoBox.style.display = 'block';
        infoBox.innerHTML = `${DADOS_ALIAS}<br>${ALIAS_PY}`;
    } else if (metodo === 'Efetivo') {
        boxTroco.style.display = 'block';
    }
}

function toggleFactura() {
    const check = document.getElementById('check-factura');
    const box = document.getElementById('box-ruc');
    box.style.display = check.checked ? 'block' : 'none';
}

function mascaraTelefone(input) {
    let v = input.value.replace(/\D/g,"");
    input.value = v; // Apenas números, simples para PY
}

// 7. ENVIAR PEDIDO (WHATSAPP + SUPABASE)
function gerarIdTemporal() {
    const now = new Date();
    // Gera algo como 2030159 (HoraMinutoSegundoMilissegundo curto)
    return `${now.getHours()}${now.getMinutes()}${now.getSeconds()}${Math.floor(Math.random() * 9)}`;
}

// app.js - Substitua a função enviarZap

async function enviarZap() {
    const nome = document.getElementById('cli-nome').value;
    const tel = document.getElementById('cli-tel').value;
    const ref = document.getElementById('cli-ref').value;
    const pag = document.getElementById('forma-pag').value;
    const ddiInput = document.getElementById('cli-ddi');
    const ddi = ddiInput ? ddiInput.value : '+595';

    if (!nome || !tel) return alert("Por favor, preencha seu nome e telefone.");
    if (modoEntrega === 'delivery' && freteCalculado === 0) return alert("Por favor, clique em 'Usar minha localização' para calcular o frete.");

    // Cálculos
    const totalItens = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    const totalGeral = totalItens + (modoEntrega === 'delivery' ? freteCalculado : 0);
    const idPedido = gerarIdTemporal();

    const pedidoDb = {
        uid_temporal: idPedido,
        status: 'pendente',
        tipo_entrega: modoEntrega,
        subtotal: totalItens,
        frete_cobrado_cliente: freteCalculado,
        total_geral: totalGeral,
        forma_pagamento: pag,
        itens: carrinho,
        endereco_entrega: ref,
        geo_lat: localCliente ? String(localCliente.lat) : '',
        geo_lng: localCliente ? String(localCliente.lng) : '',
        obs_pagamento: pag === 'Efetivo' ? document.getElementById('troco-valor').value : '',
        dados_factura: document.getElementById('check-factura').checked ? {
            ruc: document.getElementById('cli-ruc').value,
            razao: document.getElementById('cli-zao').value
        } : null
    };

    // Salva no Banco
    const telCompleto = ddi + tel;
    const db = (typeof supa !== 'undefined') ? supa : ((typeof supabase !== 'undefined') ? supabase : null);
    
    if(db) {
        await db.from('clientes').upsert({ telefone: telCompleto, nome: nome, endereco_padrao: ref }, { onConflict: 'telefone' });
        db.from('pedidos').insert([pedidoDb]).then(({ error }) => { if(error) console.error(error); });
    }

    localStorage.setItem('sushi_user', JSON.stringify({ nome, tel, ddi }));
    localStorage.setItem('sushi_last', JSON.stringify(carrinho));

    // Monta Mensagem
    let msg = `*PEDIDO #${idPedido}* - SUSHI TOP\n`;
    msg += `--------------------------\n`;
    msg += `👤 Cliente: ${nome}\n`;
    msg += `📞 Tel: ${telCompleto}\n`;
    msg += `🛵 Tipo: ${modoEntrega.toUpperCase()}\n`;

    if (modoEntrega === 'delivery') {
        if(localCliente) {
            msg += `📍 Maps: https://www.google.com/maps/search/?api=1&query=${localCliente.lat},${localCliente.lng}\n`;
        }
        msg += `🏠 Ref: ${ref}\n`;
    }

    msg += `--------------------------\n`;
    carrinho.forEach(item => {
        msg += `${item.qtd}x ${item.nome}\n`;
        if(item.montagem && item.montagem.length > 0) msg += `   + ${item.montagem.join(', ')}\n`;
        if(item.obs) msg += `   Obs: ${item.obs}\n`;
    });

    msg += `--------------------------\n`;
    msg += `Subtotal: Gs ${totalItens.toLocaleString('es-PY')}\n`;
    if(modoEntrega === 'delivery') msg += `Frete: Gs ${freteCalculado.toLocaleString('es-PY')}\n`;
    msg += `*TOTAL: Gs ${totalGeral.toLocaleString('es-PY')}*\n`;
    msg += `--------------------------\n`;
    
    // --- LÓGICA DE TROCO ---
    if(pag === 'Efetivo') {
        const valorPagoStr = document.getElementById('troco-valor').value;
        
        // 1. Remove tudo que não é número (pontos, letras, espaços)
        let valorPagoNum = parseInt(valorPagoStr.replace(/\D/g, '')) || 0;

        // 2. REGRA DO PARAGUAI: Se digitou menos de 1000 (ex: 100, 150, 50), multiplica por 1000
        if(valorPagoNum > 0 && valorPagoNum < 1000) {
            valorPagoNum = valorPagoNum * 1000;
        }

        const troco = valorPagoNum - totalGeral;

        // Formata o valor corrigido para mostrar na mensagem (ex: mostra 150.000 em vez de 150)
        const valorExibicao = valorPagoNum.toLocaleString('es-PY');

        msg += `💰 Pagamento: Efetivo\n`;
        msg += `💵 Paga com: Gs ${valorExibicao}\n`; // Mostra o valor já corrigido
        
        if(troco >= 0) {
            msg += `🔄 *Troco: Gs ${troco.toLocaleString('es-PY')}*\n`;
        } else {
            msg += `⚠️ Valor insuficiente (Faltam Gs ${Math.abs(troco).toLocaleString('es-PY')})\n`;
        }
    } else {
        msg += `💰 Pagamento: ${pag}\n`;
    }

    if(pag === 'Pix' || pag === 'Transferencia') {
        msg += `\n⚠️ *ATENÇÃO: Seu Pedido só será confirmado após o envio do comprovante de pagamento.*\n`;
    }

    if(document.getElementById('check-factura').checked) {
        msg += `\n📄 *DADOS FACTURA*\nRUC: ${document.getElementById('cli-ruc').value}\nRazão: ${document.getElementById('cli-zao').value}\n`;
    }

    window.open(`https://wa.me/${FONE_LOJA}?text=${encodeURIComponent(msg)}`, '_blank');
}

// 8. DADOS LOCAIS & REPETIR PEDIDO (Melhorado)
function carregarDadosLocal() {
    const u = JSON.parse(localStorage.getItem('sushi_user'));
    if(u) {
        document.getElementById('cli-nome').value = u.nome;
        document.getElementById('cli-tel').value = u.tel;
        if(u.ddi) document.getElementById('cli-ddi').value = u.ddi;
    }
    const last = JSON.parse(localStorage.getItem('sushi_last'));
    if(last && last.length > 0) {
        const container = document.getElementById('buy-again-container');
        if(container) {
            container.style.display = 'block'; // Mostra o container
            
            // GERA A LISTA VISUAL (UL/LI)
            const ul = document.getElementById('last-order-list');
            if(ul) {
                ul.innerHTML = '';
                last.forEach(i => {
                    const li = document.createElement('li');
                    li.style.borderBottom = '1px dashed #eee';
                    li.style.padding = '5px 0';
                    li.innerHTML = `<b>${i.qtd}x</b> ${i.nome}`;
                    ul.appendChild(li);
                });
            } else {
                // Fallback se não tiver a UL no HTML ainda
                const desc = document.getElementById('last-order-desc');
                if(desc) desc.innerText = `${last.length} itens do último pedido`;
            }
        }
    }
}

function repetirPedido() {
    const last = JSON.parse(localStorage.getItem('sushi_last'));
    if(last) { 
        carrinho = last; 
        updateUI(); 
        abrirCheckout(); // Já abre o checkout direto para facilitar
    }
}

// 9. BANNER (Mantido do seu original)
function clicarBanner(idProduto) {
    // Procura em todas as categorias
    for (const key in MENU) {
        const item = MENU[key].find(i => i.id === idProduto);
        if (item) {
            abrirModal(item);
            return;
        }
    }
}