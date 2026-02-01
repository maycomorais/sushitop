// --- CONFIGURAÇÕES ---
const FONE_LOJA = "595992490500";
const COORD_LOJA = { lat: -25.240629, lng: -57.541956 }; // MRA / Loma

// Estado
let carrinho = [];
let modoEntrega = 'delivery'; // 'delivery' ou 'retirada'
let freteCalculado = 0;
let localCliente = null;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    renderMenu();
    carregarDadosLocal();
});

// 1. RENDERIZAR MENU
function renderMenu() {
    const nav = document.getElementById('category-nav');
    const content = document.getElementById('menu-content');
    
    // Categorias
    for (const [key, items] of Object.entries(MENU)) {
        if(key === "upsell") continue;

        // Botão Navegação
        const pill = document.createElement('button');
        pill.className = 'cat-pill';
        pill.innerText = key.replace(/_/g, " ");
        pill.onclick = () => {
            document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            document.getElementById(key).scrollIntoView({behavior:'smooth', block:'start'});
        };
        nav.appendChild(pill);

        // Seção
        const section = document.createElement('section');
        section.id = key;
        section.innerHTML = `<h2 class="section-title">${key.replace(/_/g, " ")}</h2>`;

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

// 2. MODAL PRODUTO
let prodAtual = null, optAtual = null, qtd = 1;

function abrirModal(item) {
    prodAtual = item;
    qtd = 1;
    document.getElementById('modal-title').innerText = item.nome;
    document.getElementById('modal-desc').innerText = item.desc || '';
    
    const divOpts = document.getElementById('modal-options');
    divOpts.innerHTML = '';

    if (item.opcoes) {
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
    } else {
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
    carrinho.push({ ...prodAtual, preco: optAtual.preco, tamanho: optAtual.tamanho, qtd });
    updateUI();
    fecharModalProduto();
}

// 3. CHECKOUT E LÓGICA DE ENTREGA
function updateUI() {
    const bar = document.getElementById('cart-bar');
    if(carrinho.length > 0) {
        bar.classList.add('show');
        const total = carrinho.reduce((a,b)=>a+(b.preco*b.qtd),0);
        document.getElementById('cart-count').innerText = carrinho.reduce((a,b)=>a+b.qtd,0); // Soma quantidades
        document.getElementById('cart-total').innerText = `Gs ${total.toLocaleString('es-PY')}`;
    } else {
        bar.classList.remove('show');
    }
}

function abrirCheckout() {
    if(carrinho.length===0) return;
    
    renderizarItensCarrinho(); 
    renderizarUpsell();        
    
    mudarModoEntrega('delivery'); 
    document.getElementById('checkout-modal').classList.add('active');
    atualizarTotalCheckout();
}

function renderizarItensCarrinho() {
    const container = document.getElementById('carrinho-lista');
    container.innerHTML = '';

    carrinho.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'cart-item-row';
        
        let img = item.img || "https://cdn-icons-png.flaticon.com/512/2252/2252075.png";
        let subtotal = item.preco * item.qtd;
        let detalhe = item.tamanho && item.tamanho !== 'Padrão' ? item.tamanho : '';

        div.innerHTML = `
            <img src="${img}" class="cart-thumb">
            <div class="cart-details">
                <div class="cart-title">${item.nome}</div>
                <div class="cart-variant">${detalhe}</div>
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
        // Remover item
        carrinho.splice(index, 1);
    } else {
        // Alterar quantidade
        item.qtd += delta;
    }
    
    // Atualiza tudo
    updateUI(); // Barra flutuante
    
    if (carrinho.length === 0) {
        fecharCheckout(); // Se ficar vazio, fecha
    } else {
        renderizarItensCarrinho(); // Redesenha a lista
        atualizarTotalCheckout();  // Recalcula total final
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
            // Adiciona como item extra no carrinho
            carrinho.push({...u, qtd:1, tamanho:'Extra', img: 'https://cdn-icons-png.flaticon.com/512/2405/2405479.png'}); 
            
            // Feedback visual
            d.style.background = '#d4edda';
            setTimeout(()=>d.style.background='', 200);
            
            // Atualiza listas
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
        // Se já tinha calculado antes, mantém. Se não, reseta.
        if (freteCalculado === 0 && localCliente) calcularFrete(); 
    }
    atualizarTotalCheckout();
}

function atualizarTotalCheckout() {
    const itens = carrinho.reduce((a,b)=>a+(b.preco*b.qtd),0);
    const final = itens + freteCalculado;
    document.getElementById('total-final-checkout').innerText = `Gs ${final.toLocaleString('es-PY')}`;
}

// 4. CÁLCULO DE FRETE (SUA REGRA)
function calcularFrete() {
    const btn = document.getElementById('btn-gps');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculando...';
    
    if(!navigator.geolocation) { alert("GPS indisponível"); return; }
    
    navigator.geolocation.getCurrentPosition(pos => {
        localCliente = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        
        // Distância em KM
        const dist = getDistancia(COORD_LOJA.lat, COORD_LOJA.lng, localCliente.lat, localCliente.lng);
        
        // REGRA DE NEGÓCIO:
        // Até 3,3km = 5.000
        // 3,4km a 5km = 15.000
        // Acima de 5km = 15.000 + 5.000 a cada 2km
        
        if (dist <= 3.3) {
            freteCalculado = 6000;
        } else if (dist <= 5.0) {
            freteCalculado = 12000;
        } else {
            const kmExtra = dist - 6.0;
            const faixasExtras = Math.ceil(kmExtra / 2.0); // A cada 2km
            freteCalculado = 12000 + (faixasExtras * 6000);
        }
        
        document.getElementById('frete-msg').innerHTML = `Distância: ${dist.toFixed(1)}km <br> Frete: Gs ${freteCalculado.toLocaleString('es-PY')}`;
        btn.innerHTML = '<i class="fas fa-check"></i> Recalcular';
        btn.style.background = '#28a745';
        atualizarTotalCheckout();
        
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

// 5. FORMULÁRIO E ENVIO
function verificarPagamento() {
    const val = document.getElementById('forma-pag').value;
    document.getElementById('box-troco').style.display = (val==='Efetivo')?'block':'none';
}
function toggleFactura() {
    const chk = document.getElementById('check-factura').checked;
    document.getElementById('box-ruc').style.display = chk?'block':'none';
}

function enviarZap() {
    if(carrinho.length===0) return;
    const nome = document.getElementById('cli-nome').value;
    const pag = document.getElementById('forma-pag').value;
    
    if(!nome || !pag) { alert("Informe Nome e Pagamento"); return; }
    if(modoEntrega==='delivery' && freteCalculado===0) { alert("Calcule o frete!"); return; }

    // Salvar LocalStorage
    localStorage.setItem('sushi_user', JSON.stringify({ nome, ddi:document.getElementById('cli-ddi').value, tel:document.getElementById('cli-tel').value }));
    localStorage.setItem('sushi_last', JSON.stringify(carrinho));

    let msg = `*NOVO PEDIDO - SUSHI TOP*\n`;
    msg += `--------------------------\n`;
    msg += `👤 *${nome}*\n`;
    msg += `🛵 *Tipo:* ${modoEntrega.toUpperCase()}\n`;
    
    if(modoEntrega === 'delivery') {
        msg += `📍 *Maps:* http://maps.google.com/?q=${localCliente.lat},${localCliente.lng}\n`;
        msg += `🏠 *Ref:* ${document.getElementById('cli-ref').value}\n`;
    }

    msg += `--------------------------\n`;
    let subtotal = 0;
    carrinho.forEach(i => {
        let t = i.preco*i.qtd;
        subtotal += t;
        msg += `${i.qtd}x ${i.nome} ${i.tamanho!=='Padrão'?`(${i.tamanho})`:''} \n   Gs ${t.toLocaleString('es-PY')}\n`;
    });
    
    msg += `--------------------------\n`;
    msg += `Subtotal: Gs ${subtotal.toLocaleString('es-PY')}\n`;
    msg += `Frete: Gs ${freteCalculado.toLocaleString('es-PY')}\n`;
    msg += `*TOTAL: Gs ${(subtotal+freteCalculado).toLocaleString('es-PY')}*\n`;
    msg += `--------------------------\n`;
    msg += `💳 Pag: ${pag}\n`;
    if(pag==='Efetivo') msg += `💵 Troco: ${document.getElementById('troco-valor').value}\n`;
    if(document.getElementById('check-factura').checked) {
        msg += `📄 RUC: ${document.getElementById('cli-ruc').value}\n`;
        msg += `Razão: ${document.getElementById('cli-zao').value}\n`;
    }

    const telLoja = FONE_LOJA; 
    window.open(`https://wa.me/${telLoja}?text=${encodeURIComponent(msg)}`, '_blank');
}

function carregarDadosLocal() {
    const u = JSON.parse(localStorage.getItem('sushi_user'));
    if(u) {
        document.getElementById('cli-nome').value = u.nome;
        document.getElementById('cli-tel').value = u.tel;
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