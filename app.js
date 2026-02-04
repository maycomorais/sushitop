// ==========================================
// 1. CONFIGURAÇÕES GERAIS
// ==========================================
const FONE_LOJA = "595976771714";
const COORD_LOJA = { lat: -25.2365803, lng: -57.5380816 }; // MRA / Loma
const COTACAO_REAL = 1100; // 1 Real = 1.100 Guaranis

// DADOS PIX
const CHAVE_PIX = "seuemail@pix.com"; 
const NOME_PIX = "Sushiteria fictícia";

// DADOS TRANSFERÊNCIA PARAGUAI
const DADOS_ALIAS = "Banco: Itaú PY | Titular: Sushiteria Ficiticia";
const ALIAS_PY = "Alias: seuemail@alias.com"; 

// ==========================================
// 2. ESTADO DA APLICAÇÃO
// ==========================================
let carrinho = [];
let freteCalculado = 0;
let localCliente = null;
let modoEntrega = 'delivery'; // 'delivery' ou 'retirada'
let prodAtual = null, optAtual = null, qtd = 1;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    renderMenu();
    carregarDadosLocal();
});

// ==========================================
// 3. RENDERIZAÇÃO DO MENU (VITRINE)
// ==========================================
// 1. RENDERIZAR MENU (VITRINE)
function renderMenu() {
    const nav = document.getElementById('category-nav');
    const content = document.getElementById('menu-content');
    
    // --- DICIONÁRIO DE NOMES BONITOS ---
    // Aqui você define exatamente como quer que apareça na tela
    const nomesCategorias = {
        "promocoes_do_dia": "Promoções do Dia",
        "sushis_e_rolls": "Sushis & Rolls",
        "temakis": "Temakis",
        "pratos_quentes": "Pratos Quentes",
        "pokes": "Pokes & Saladas",
        "bebidas": "Bebidas",
        "upsell": "Extras"
    };

    // Loop pelas categorias
    for (const [key, items] of Object.entries(MENU)) {
        if(key === "upsell") continue;

        // Verifica se tem um nome bonito, se não, usa o padrão (tira underline)
        const nomeExibicao = nomesCategorias[key] || key.replace(/_/g, " ");

        // Botão Navegação
        const pill = document.createElement('button');
        pill.className = 'cat-pill';
        pill.innerText = nomeExibicao; // Usa o nome corrigido
        pill.onclick = () => {
            document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            document.getElementById(key).scrollIntoView({behavior:'smooth', block:'start'});
        };
        nav.appendChild(pill);

        // Seção
        const section = document.createElement('section');
        section.id = key;
        // Usa o nome corrigido também no Título da Seção
        section.innerHTML = `<h2 class="section-title">${nomeExibicao}</h2>`;

        items.forEach(item => {
            let preco = item.opcoes ? item.opcoes[0].preco : item.preco;
            let img = item.img || "https://cdn-icons-png.flaticon.com/512/2252/2252075.png";

            const div = document.createElement('div');
            div.className = 'product-item';
            div.onclick = () => abrirModal(item);
            div.innerHTML = `
                <div class="prod-info">
                    <div class="prod-title">${item.nome}</div>
                    <div class="prod-desc">${item.desc || ''}</div>
                    <div class="prod-price">Gs ${preco.toLocaleString('es-PY')}</div>
                </div>
                <img src="${img}" class="prod-img">
            `;
            section.appendChild(div);
        });
        content.appendChild(section);
    }
}

// Função para quando clica no Banner
function clicarBanner(idProduto) {
    let itemEncontrado = null;
    for (const categoria in MENU) {
        const item = MENU[categoria].find(i => i.id === idProduto);
        if (item) {
            itemEncontrado = item;
            break;
        }
    }
    if (itemEncontrado) {
        abrirModal(itemEncontrado);
    } else {
        console.error("Produto do banner não encontrado: " + idProduto);
        alert("Promoção não encontrada.");
    }
}

// ==========================================
// 4. MODAL DE PRODUTO (POKE + OBS)
// ==========================================
function abrirModal(item) {
    prodAtual = item;
    qtd = 1;
    
    document.getElementById('modal-title').innerText = item.nome;
    document.getElementById('modal-desc').innerText = item.desc || '';
    
    // Limpa campo de observação
    const campoObs = document.getElementById('modal-obs');
    if(campoObs) campoObs.value = '';
    
    const divOpts = document.getElementById('modal-options');
    const divMont = document.getElementById('modal-montagem');
    
    divOpts.innerHTML = '';
    divMont.innerHTML = ''; 
    
    // --- CASO 1: PRODUTO COM OPÇÕES (ex: Tamanho) ---
    if (item.opcoes) {
        divOpts.style.display = 'block';
        divMont.style.display = 'none';
        
        optAtual = item.opcoes[0];
        item.opcoes.forEach((op, i) => {
            const div = document.createElement('div');
            div.className = `option-item ${i===0?'selected':''}`;
            div.innerHTML = `<span>${op.tamanho}</span> <strong>Gs ${op.preco.toLocaleString('es-PY')}</strong>`;
            div.onclick = () => {
                optAtual = op;
                document.querySelectorAll('.option-item').forEach(d=>d.classList.remove('selected'));
                div.classList.add('selected');
                atualizarPrecoModal();
            };
            divOpts.appendChild(div);
        });
    } 
    // --- CASO 2: POKE (MONTAGEM) ---
    else if (item.montagem) {
        divOpts.style.display = 'none';
        divMont.style.display = 'block';
        optAtual = { preco: item.preco, tamanho: 'Montado' };

        item.montagem.forEach((etapa, idxEtapa) => {
            const h4 = document.createElement('div');
            h4.className = 'montagem-title';
            h4.innerText = etapa.titulo;
            divMont.appendChild(h4);

            etapa.itens.forEach(ingrediente => {
                const label = document.createElement('label');
                label.className = 'montagem-item';
                
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.name = `etapa-${idxEtapa}`;
                input.value = ingrediente;
                
                // Controle de Máximo
                input.onchange = function() {
                    const marcados = document.querySelectorAll(`input[name="etapa-${idxEtapa}"]:checked`);
                    if(marcados.length > etapa.max) {
                        this.checked = false;
                        alert(`Máximo de ${etapa.max} opções nesta etapa!`);
                    }
                };

                label.appendChild(input);
                label.appendChild(document.createTextNode(ingrediente));
                divMont.appendChild(label);
            });
        });
    }
    // --- CASO 3: SIMPLES ---
    else {
        divOpts.style.display = 'none';
        divMont.style.display = 'none';
        optAtual = { tamanho: 'Padrão', preco: item.preco };
    }
    
    atualizarPrecoModal();
    document.getElementById('product-modal').classList.add('active');
}

function atualizarPrecoModal() {
    document.getElementById('modal-qty').innerText = qtd;
    document.getElementById('modal-price').innerText = `Gs ${(optAtual.preco * qtd).toLocaleString('es-PY')}`;
}

function mudarQtd(n) { if(qtd+n>0) { qtd+=n; atualizarPrecoModal(); } }
function fecharModalProduto() { document.getElementById('product-modal').classList.remove('active'); }

function adicionarDoModal() {
    // Captura Obs
    const campoObs = document.getElementById('modal-obs');
    const obsTexto = campoObs ? campoObs.value.trim() : '';

    // Captura Montagem Poke
    let listaMontagem = [];
    if(prodAtual.montagem) {
        const checkboxes = document.querySelectorAll('#modal-montagem input:checked');
        if(checkboxes.length === 0) {
            alert("Por favor, escolha os ingredientes!");
            return;
        }
        checkboxes.forEach(chk => listaMontagem.push(chk.value));
    }

    carrinho.push({ 
        ...prodAtual, 
        preco: optAtual.preco, 
        tamanho: optAtual.tamanho, 
        qtd: qtd,
        obs: obsTexto,
        montagem: listaMontagem
    });
    
    updateUI();
    fecharModalProduto();
}

// ==========================================
// 5. CARRINHO E CHECKOUT
// ==========================================
function updateUI() {
    const bar = document.getElementById('cart-bar');
    if(carrinho.length > 0) {
        bar.classList.add('show');
        const total = carrinho.reduce((a,b)=>a+(b.preco*b.qtd),0);
        document.getElementById('cart-count').innerText = carrinho.reduce((a,b)=>a+b.qtd, 0);
        document.getElementById('cart-total').innerText = `Gs ${total.toLocaleString('es-PY')}`;
    } else {
        bar.classList.remove('show');
    }
}

function abrirCheckout() {
    if(carrinho.length===0) return;
    
    renderizarItensCarrinho();
    renderizarUpsell();
    
    if(!modoEntrega) mudarModoEntrega('delivery'); 
    
    document.getElementById('checkout-modal').classList.add('active');
    atualizarTotalCheckout();
    verificarPagamento(); // Verifica se já tem Pix selecionado
}

function renderizarItensCarrinho() {
    const container = document.getElementById('carrinho-lista');
    container.innerHTML = '';

    carrinho.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'cart-item-row';
        
        let img = item.img || "https://cdn-icons-png.flaticon.com/512/2252/2252075.png";
        let subtotal = item.preco * item.qtd;
        
        // Monta texto de detalhes (Tamanho, Poke, Obs)
        let variacoes = [];
        if(item.tamanho && item.tamanho !== 'Padrão' && item.tamanho !== 'Montado') variacoes.push(item.tamanho);
        if(item.montagem && item.montagem.length > 0) variacoes.push("Poke Montado");
        if(item.obs) variacoes.push(`Obs: ${item.obs}`);

        div.innerHTML = `
            <img src="${img}" class="cart-thumb">
            <div class="cart-details">
                <div class="cart-title">${item.nome}</div>
                <div class="cart-variant">${variacoes.join(' • ')}</div>
                <div class="cart-item-price">Gs ${subtotal.toLocaleString('es-PY')}</div>
            </div>
            <div class="qty-mini">
                <button onclick="alterarQtdCarrinho(${index}, -1)">-</button>
                <span>${item.qtd}</span>
                <button onclick="alterarQtdCarrinho(${index}, 1)">+</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function alterarQtdCarrinho(index, delta) {
    const item = carrinho[index];
    if (item.qtd + delta <= 0) {
        carrinho.splice(index, 1);
    } else {
        item.qtd += delta;
    }
    updateUI();
    if (carrinho.length === 0) {
        fecharCheckout();
    } else {
        renderizarItensCarrinho();
        atualizarTotalCheckout();
    }
}

function renderizarUpsell() {
    const upList = document.getElementById('upsell-list');
    upList.innerHTML = '';
    MENU.upsell.forEach(u => {
        const d = document.createElement('div');
        d.className = 'upsell-card';
        d.innerHTML = `<h5>${u.nome}</h5><span>Gs ${u.preco.toLocaleString('es-PY')}</span>`;
        d.onclick = () => {
            carrinho.push({...u, qtd:1, tamanho:'Extra', img: 'https://cdn-icons-png.flaticon.com/512/2405/2405479.png'}); 
            d.style.background = '#d4edda';
            setTimeout(()=>d.style.background='', 200);
            updateUI();
            renderizarItensCarrinho();
            atualizarTotalCheckout();
        };
        upList.appendChild(d);
    });
}

function limparCarrinho() {
    if(confirm("Deseja esvaziar o carrinho?")) {
        carrinho = [];
        updateUI();
        fecharCheckout();
    }
}

function fecharCheckout() { document.getElementById('checkout-modal').classList.remove('active'); }

function mudarModoEntrega(modo) {
    modoEntrega = modo;
    document.getElementById('btn-delivery').className = modo === 'delivery' ? 'active' : '';
    document.getElementById('btn-retirada').className = modo === 'retirada' ? 'active' : '';
    
    const boxEnd = document.getElementById('box-endereco');
    if (modo === 'retirada') {
        boxEnd.style.display = 'none';
        freteCalculado = 0;
    } else {
        boxEnd.style.display = 'block';
        if (freteCalculado === 0 && localCliente) calcularFrete(); 
    }
    atualizarTotalCheckout();
    verificarPagamento(); 
}

function atualizarTotalCheckout() {
    const itens = carrinho.reduce((a,b)=>a+(b.preco*b.qtd),0);
    const final = itens + freteCalculado;
    document.getElementById('total-final-checkout').innerText = `Gs ${final.toLocaleString('es-PY')}`;
}

// ==========================================
// 6. FRETE (GPS)
// ==========================================
function calcularFrete() {
    const btn = document.getElementById('btn-gps');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculando...';
    
    if(!navigator.geolocation) { alert("GPS indisponível"); return; }
    
    navigator.geolocation.getCurrentPosition(pos => {
        localCliente = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const dist = getDistancia(COORD_LOJA.lat, COORD_LOJA.lng, localCliente.lat, localCliente.lng);
        
        // REGRA: Até 3km=5k | 3-5km=15k | +5km: +5k a cada 2km
        if (dist <= 3.0) {
            freteCalculado = 5000;
        } else if (dist <= 5.0) {
            freteCalculado = 15000;
        } else {
            const kmExtra = dist - 5.0;
            const faixasExtras = Math.ceil(kmExtra / 2.0);
            freteCalculado = 15000 + (faixasExtras * 5000);
        }
        
        document.getElementById('frete-msg').innerHTML = `Distância: ${dist.toFixed(1)}km <br> Frete: Gs ${freteCalculado.toLocaleString('es-PY')}`;
        btn.innerHTML = '<i class="fas fa-check"></i> Recalcular';
        btn.style.background = '#28a745';
        atualizarTotalCheckout();
        verificarPagamento(); // Recalcula total do Pix se mudou o frete
        
    }, () => {
        alert("Ative o GPS para calcular o frete.");
        btn.innerHTML = 'Tentar Novamente';
    });
}

function getDistancia(lat1,lon1,lat2,lon2) {
    const R = 6371; 
    const dLat = (lat2-lat1) * Math.PI/180;
    const dLon = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ==========================================
// 7. PAGAMENTO E ENVIO WHATSAPP
// ==========================================
function verificarPagamento() {
    const metodo = document.getElementById('forma-pag').value;
    let infoBox = document.getElementById('info-pagamento-extra');
    if(!infoBox) return;

    const boxTroco = document.getElementById('box-troco');
    
    infoBox.style.display = 'none';
    infoBox.innerHTML = '';
    boxTroco.style.display = 'none';

    // Totais
    const totalItens = carrinho.reduce((a,b)=>a+(b.preco*b.qtd),0);
    const totalGeral = totalItens + freteCalculado;

    if (metodo === 'Efetivo') {
        boxTroco.style.display = 'block';
    } 
    else if (metodo === 'Pix') {
        const valorEmReais = totalGeral / COTACAO_REAL;
        const valorFormatado = valorEmReais.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        
        infoBox.innerHTML = `
            <strong>Total em Reais: ${valorFormatado}</strong><br>
            Chave Pix: ${CHAVE_PIX}<br>
            Nome: ${NOME_PIX}
        `;
        infoBox.style.display = 'block';
    } 
    else if (metodo === 'Transferencia') {
        infoBox.innerHTML = `
            <strong>Dados para Transferência:</strong><br>
            ${DADOS_ALIAS}<br>
            <strong>${ALIAS_PY}</strong>
        `;
        infoBox.style.display = 'block';
    }
}

function toggleFactura() {
    const chk = document.getElementById('check-factura').checked;
    document.getElementById('box-ruc').style.display = chk?'block':'none';
}

function enviarZap() {
    if(carrinho.length===0) return;
    
    // --- 1. GERA O ID ÚNICO AGORA ---
    const idPedido = gerarIdPedido(); // Ex: 2035129

    const nome = document.getElementById('cli-nome').value;
    const ddi = document.getElementById('cli-ddi').value;
    const tel = document.getElementById('cli-tel').value;
    const pag = document.getElementById('forma-pag').value;
    
    if(!nome || !tel || !pag) { alert("Por favor, preencha Nome, WhatsApp e Forma de Pagamento."); return; }
    if(modoEntrega==='delivery' && freteCalculado===0) { alert("Por favor, clique em Calcular Frete."); return; }

    localStorage.setItem('sushi_user', JSON.stringify({ nome, ddi, tel }));
    localStorage.setItem('sushi_last', JSON.stringify(carrinho));

    const totalItens = carrinho.reduce((a,b)=>a+(b.preco*b.qtd),0);
    const totalGeral = totalItens + freteCalculado;

    // --- LÓGICA INTELIGENTE DE TROCO E TEXTOS ---
    let textoPagamento = "";
    let obsPagamentoCupom = ""; 

    if (pag === 'Efetivo') {
        let valorInput = document.getElementById('troco-valor').value;
        let valorPago = parseInt(valorInput.replace(/\./g, '').replace(/,/g, '').replace(/\D/g, ''));

        if(isNaN(valorPago)) { alert("Digite o valor para troco!"); return; }

        if (valorPago < totalGeral && valorPago < 10000) { valorPago = valorPago * 1000; }

        if (valorPago < totalGeral) {
            alert(`Erro: O valor do pagamento é menor que o Total!`);
            return;
        }

        const vuelto = valorPago - totalGeral;
        textoPagamento += `💳 *Pagamento: Efetivo (Guaranis)*\n`;
        textoPagamento += `💰 Paga com: Gs ${valorPago.toLocaleString('es-PY')}\n`;
        textoPagamento += `🔄 *Troco (Vuelto): Gs ${vuelto.toLocaleString('es-PY')}*\n`;
        obsPagamentoCupom = `Troco: ${vuelto.toLocaleString('es-PY')}`;
    } 
    else if (pag === 'Pix') {
        const totalReais = totalGeral / COTACAO_REAL;
        textoPagamento += `💳 *Pagamento: Pix*\n`;
        textoPagamento += `🇧🇷 Valor: R$ ${totalReais.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}\n`;
        textoPagamento += `🔑 Chave: ${CHAVE_PIX}\n`;
        textoPagamento += `👤 Nome: ${NOME_PIX}\n`;
        obsPagamentoCupom = `Pix (R$ ${totalReais.toFixed(2)})`;
    }
    else if (pag === 'Transferencia') {
        textoPagamento += `💳 *Pagamento: Transferência*\n`;
        textoPagamento += `🏦 Dados Bancários:\n${DADOS_ALIAS}\n`;
        textoPagamento += `👉 ${ALIAS_PY}\n`;
        obsPagamentoCupom = "Transferência Bancária";
    }
    else {
        textoPagamento += `💳 *Pagamento: ${pag}*\n`;
        obsPagamentoCupom = pag;
    }

    // --- GERAR LINK DE IMPRESSÃO ---
    const dadosPedido = {
        id: idPedido, 
        cliente: { nome: nome, tel: ddi + ' ' + tel },
        entrega: { 
            tipo: modoEntrega, 
            lat: localCliente ? localCliente.lat : '', 
            lng: localCliente ? localCliente.lng : '',
            ref: document.getElementById('cli-ref').value
        },
        itens: carrinho.map(i => ({ 
            q: i.qtd, n: i.nome, t: i.tamanho, p: i.preco, 
            o: i.obs, m: i.montagem 
        })),
        valores: { sub: totalItens, frete: freteCalculado, total: totalGeral },
        pagamento: { metodo: pag, obs: obsPagamentoCupom },
        factura: document.getElementById('check-factura').checked ? {
            ruc: document.getElementById('cli-ruc').value,
            razao: document.getElementById('cli-zao').value
        } : null
    };

    const jsonString = JSON.stringify(dadosPedido);
    const base64Code = btoa(unescape(encodeURIComponent(jsonString)));
    const linkImpressao = `${window.location.origin}${window.location.pathname.replace('index.html', '')}imprimir.html?d=${base64Code}`;

    // --- MONTAGEM DA MENSAGEM WHATSAPP ---
    let msg = `*PEDIDO #${idPedido} - SUSHITERIA FICTICIA*\n`; 
    msg += `--------------------------\n`;
    msg += `👤 *Cliente:* ${nome}\n`;
    msg += `📞 *Tel:* ${ddi} ${tel}\n`;
    msg += `🛵 *Tipo:* ${modoEntrega.toUpperCase()}\n`;
    
    if(modoEntrega === 'delivery') {
        msg += `📍 *Maps:* http://maps.google.com/?q=${localCliente.lat},${localCliente.lng}\n`;
        msg += `🏠 *Ref:* ${document.getElementById('cli-ref').value}\n`;
    }

    msg += `--------------------------\n`;
    carrinho.forEach(i => {
        msg += `${i.qtd}x ${i.nome} ${i.tamanho!=='Padrão' && i.tamanho!=='Montado'?`(${i.tamanho})`:''} \n`;
        if(i.montagem && i.montagem.length > 0) msg += `   📝 Ing: ${i.montagem.join(', ')}\n`;
        if(i.obs) msg += `   ⚠️ Obs: ${i.obs}\n`;
    });
    msg += `--------------------------\n`;
    msg += `Subtotal: Gs ${totalItens.toLocaleString('es-PY')}\n`;
    if(modoEntrega === 'delivery') msg += `Frete: Gs ${freteCalculado.toLocaleString('es-PY')}\n`;
    msg += `*TOTAL: Gs ${totalGeral.toLocaleString('es-PY')}*\n`;
    msg += `--------------------------\n`;
    msg += textoPagamento;

    if(document.getElementById('check-factura').checked) {
        msg += `\n📄 *DADOS FACTURA*\n`;
        msg += `RUC: ${document.getElementById('cli-ruc').value}\n`;
        msg += `Razão: ${document.getElementById('cli-zao').value}\n`;
    }

    msg += `--------------------------\n`;
    msg += `🖨️ *Imprimir Comanda:*\n${linkImpressao}`;

    window.open(`https://wa.me/${FONE_LOJA}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ==========================================
// 8. DADOS LOCAIS (HISTÓRICO)
// ==========================================
function carregarDadosLocal() {
    const u = JSON.parse(localStorage.getItem('sushi_user'));
    if(u) {
        document.getElementById('cli-nome').value = u.nome;
        document.getElementById('cli-tel').value = u.tel;
        if(u.ddi) document.getElementById('cli-ddi').value = u.ddi;
    }
    const last = JSON.parse(localStorage.getItem('sushi_last'));
    if(last) {
        document.getElementById('buy-again-container').style.display = 'flex';
        document.getElementById('last-order-desc').innerText = `${last.length} itens do último pedido`;
    }
}

function repetirPedido() {
    const last = JSON.parse(localStorage.getItem('sushi_last'));
    if(last) { carrinho = last; updateUI(); alert("Itens adicionados!"); }
}

// --- GERADOR DE ID TEMPORAL (Único por 24h) ---
function gerarIdPedido() {
    const agora = new Date();
    const h = String(agora.getHours()).padStart(2, '0');
    const m = String(agora.getMinutes()).padStart(2, '0');
    const s = String(agora.getSeconds()).padStart(2, '0');
    // Gera 1 dígito aleatório (0-9) para desempate
    const r = Math.floor(Math.random() * 10); 
    
    // Retorna algo como: 2030159
    return `${h}${m}${s}${r}`;
}