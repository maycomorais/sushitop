// ==========================================
// 1. CONFIGURAÇÕES & DADOS GERAIS
// ==========================================
const FONE_LOJA = '595992490500'; 
const COORD_LOJA = { lat: -25.2365803, lng: -57.5380816 };
let COTACAO_REAL = 1100;
let autoConfirmTimer = null;

// DADOS DE PAGAMENTO (Pix e Alias)
const CHAVE_PIX = '16999647032';
const NOME_PIX = 'Jessica Aparecida Silva Pereira';
const DADOS_ALIAS = 'Banco: Itaú PY | Titular: Marcus de Alencar Roque Pereira';
const ALIAS_PY = 'Alias: 0992490500';

function iniciarTimerAutoConfirmacao(pedidoId) {
    // 4 horas em milissegundos
    const QUATRO_HORAS = 4 * 60 * 60 * 1000;
    
    // Cancela timer anterior se existir
    if (autoConfirmTimer) {
        clearTimeout(autoConfirmTimer);
    }
    
    // Inicia novo timer
    autoConfirmTimer = setTimeout(async () => {
        console.log('⏰ 4 horas passadas, confirmando entrega automaticamente...');
        await confirmarEntregaAutomatica(pedidoId);
    }, QUATRO_HORAS);
    
    // Salva timestamp no localStorage para persistir entre reloads
    const agora = new Date().getTime();
    const tempoExpiracao = agora + QUATRO_HORAS;
    localStorage.setItem('autoConfirmExpiry_' + pedidoId, tempoExpiracao);
    
    console.log('⏰ Timer de auto-confirmação iniciado para 4 horas');
}

// ===== FUNÇÃO PARA RESTAURAR TIMER APÓS RELOAD =====
function restaurarTimerSeNecessario() {
    const pedidoId = localStorage.getItem('sushi_pedido_id');
    if (!pedidoId) return;
    
    const tempoExpiracao = localStorage.getItem('autoConfirmExpiry_' + pedidoId);
    if (!tempoExpiracao) return;
    
    const agora = new Date().getTime();
    const tempoRestante = parseInt(tempoExpiracao) - agora;
    
    if (tempoRestante > 0) {
        // Ainda há tempo restante
        console.log('⏰ Restaurando timer de auto-confirmação...');
        autoConfirmTimer = setTimeout(async () => {
            await confirmarEntregaAutomatica(pedidoId);
        }, tempoRestante);
    } else {
        // Tempo já expirou, confirmar agora
        console.log('⏰ Tempo expirado, confirmando agora...');
        confirmarEntregaAutomatica(pedidoId);
    }
}

// ===== CONFIRMAÇÃO AUTOMÁTICA (4 HORAS) =====
async function confirmarEntregaAutomatica(pedidoId) {
    try {
        const { error } = await supa
            .from('pedidos')
            .update({ 
                status: 'entregue',
                entrega_confirmada_em: new Date().toISOString(),
                confirmacao_tipo: 'automatica'
            })
            .eq('id', pedidoId);
        
        if (error) throw error;
        
        console.log('✅ Entrega confirmada automaticamente após 4 horas');
        
        // Limpa dados locais
        localStorage.removeItem('autoConfirmExpiry_' + pedidoId);
        fecharTracker();
        
        // Mostra notificação
        if (Notification.permission === 'granted') {
            new Notification('Pedido Entregue ✅', {
                body: 'Sua entrega foi confirmada automaticamente. Obrigado!'
            });
        }
    } catch (err) {
        console.error('Erro ao confirmar entrega automática:', err);
    }
}

// ===== CONFIRMAÇÃO MANUAL (CLIENTE) =====
async function confirmarEntregaCliente() {
    const pedidoId = localStorage.getItem('sushi_pedido_id');
    if (!pedidoId) {
        alert('Erro: Pedido não encontrado');
        return;
    }
    
    if (!confirm('Confirmar que você recebeu o pedido?')) {
        return;
    }
    
    try {
        const { error } = await supa
            .from('pedidos')
            .update({ 
                status: 'entregue',
                entrega_confirmada_em: new Date().toISOString(),
                confirmacao_tipo: 'cliente'
            })
            .eq('id', pedidoId);
        
        if (error) throw error;
        
        console.log('✅ Entrega confirmada pelo cliente');
        
        // Cancela timer automático
        if (autoConfirmTimer) {
            clearTimeout(autoConfirmTimer);
        }
        localStorage.removeItem('autoConfirmExpiry_' + pedidoId);
        
        // Atualiza UI
        mostrarMensagemEntregaConfirmada();
        
        // Fecha tracker após 3 segundos
        setTimeout(() => {
            fecharTracker();
        }, 3000);
        
    } catch (err) {
        console.error('Erro ao confirmar entrega:', err);
        alert('Erro ao confirmar entrega. Tente novamente.');
    }
}

// ===== MOSTRAR MENSAGEM DE CONFIRMAÇÃO =====
function mostrarMensagemEntregaConfirmada() {
    const tracker = document.getElementById('pedido-tracker');
    if (!tracker) return;
    
    // Atualiza conteúdo do tracker
    tracker.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <div style="font-size:3rem; margin-bottom:10px;">✅</div>
            <div style="font-weight:700; font-size:1.2rem; color:#27ae60; margin-bottom:5px;">
                Entrega Confirmada!
            </div>
            <div style="font-size:0.9rem; color:#666;">
                Obrigado pela preferência!
            </div>
        </div>
    `;
}

// ===== ATUALIZAR FUNÇÃO mostrarTracker() EXISTENTE =====
// SUBSTITUA a função mostrarTracker() por esta versão atualizada:

function mostrarTracker(status, uidPedido) {
    const tracker = document.getElementById('pedido-tracker');
    if (!tracker) return;

    tracker.style.display = 'block';

    // Atualiza ID do pedido
    const elId = document.getElementById('tracker-pedido-id');
    if (elId) elId.textContent = `Pedido #${uidPedido}`;

    // Define ícone e mensagem por status
    const statusConfig = {
        'pendente': { icon: '⏳', msg: 'Aguardando confirmação...', step: 1 },
        'confirmado': { icon: '✅', msg: 'Pedido confirmado!', step: 1 },
        'em_preparo': { icon: '🔥', msg: 'Sua comida está sendo preparada', step: 2 },
        'pronto_entrega': { icon: '📦', msg: 'Pedido pronto! Aguardando motoboy', step: 3 },
        'saiu_entrega': { icon: '🛵', msg: 'Pedido saiu para entrega!', step: 3 },
        'entregue': { icon: '🎉', msg: 'Pedido entregue!', step: 4 }
    };

    const config = statusConfig[status] || statusConfig['pendente'];

    // Atualiza ícone e mensagem
    const elIcon = document.getElementById('tracker-status-icon');
    const elMsg = document.getElementById('tracker-msg');
    if (elIcon) elIcon.textContent = config.icon;
    if (elMsg) elMsg.textContent = config.msg;

    // Atualiza steps visuais
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`tstep-${i}`);
        if (step) {
            if (i <= config.step) {
                step.classList.add('tracker-step-active');
            } else {
                step.classList.remove('tracker-step-active');
            }
        }
    }

    // ===== NOVA FUNCIONALIDADE: BOTÃO DE CONFIRMAÇÃO =====
    // Se status for "saiu_entrega", mostra botão de confirmar
    const pedidoId = localStorage.getItem('sushi_pedido_id');
    
    if (status === 'saiu_entrega') {
        // Adiciona botão de confirmação
        const existingBtn = document.getElementById('btn-confirmar-entrega');
        if (!existingBtn) {
            const btnHTML = `
                <button id="btn-confirmar-entrega" onclick="confirmarEntregaCliente()" 
                        style="width:100%; margin-top:15px; padding:12px; background:#27ae60; color:white; 
                               border:none; border-radius:8px; font-weight:600; cursor:pointer; 
                               transition:all 0.3s; font-size:1rem;">
                    <i class="fas fa-check-circle"></i> Confirmar Recebimento
                </button>
            `;
            tracker.querySelector('div').insertAdjacentHTML('beforeend', btnHTML);
        }
        
        // Inicia timer de 4 horas se ainda não iniciado
        const tempoExpiracao = localStorage.getItem('autoConfirmExpiry_' + pedidoId);
        if (!tempoExpiracao) {
            iniciarTimerAutoConfirmacao(pedidoId);
        }
    }

    // Se já foi entregue, mostra mensagem de confirmação
    if (status === 'entregue') {
        mostrarMensagemEntregaConfirmada();
        
        // Cancela timer se existir
        if (autoConfirmTimer) {
            clearTimeout(autoConfirmTimer);
        }
        localStorage.removeItem('autoConfirmExpiry_' + pedidoId);
    }
}

// Validação de segurança do Supabase
if (typeof supa === 'undefined') {
  console.error('ERRO: O arquivo supabaseClient.js não foi carregado antes do app.js');
  // Não bloqueamos o app, mas avisamos no console
}

// ==========================================
// 2. ESTADO DA APLICAÇÃO (Variáveis Globais)
// ==========================================
let carrinho = [];
let freteCalculado = 0;
let localCliente = null;
let modoEntrega = 'delivery';
let prodAtual = null, optAtual = null, qtd = 1;
let itensMontagem = {};
let cupomAplicado = null;

// Variável Global de Menu (Preenchida via Banco)
let MENU = {
  promocoes_do_dia: [],
  sushis_e_rolls: [],
  temakis: [],
  pratos_quentes: [],
  pokes: [],
  bebidas: [],
  upsell: [],
};

// ==========================================
// 3. INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Carrega dados salvos (Nome, Tel, Último Pedido)
  carregarDadosLocal();

  // 2. Renderiza o Menu vindo do Banco de Dados
  await renderMenu();

  // 3. Verifica Horário de Funcionamento e Banner
  await verificarHorario();
  
  // 4. Restaura tracking se houver pedido ativo
  restaurarTrackingSeExistir();

  // Restaura timer se página foi recarregada durante entrega
    restaurarTimerSeNecessario();
});

// ==========================================
// 4. FUNÇÕES DE BANCO DE DADOS E MENU
// ==========================================

// Verifica Horário e Atualiza Banner
async function verificarHorario() {
  const { data } = await supa.from('configuracoes').select('*').single();
  if (!data) return;

  if (data.cotacao_real) COTACAO_REAL = data.cotacao_real;

  const agora = new Date();
  const horaAtual = agora.getHours() * 60 + agora.getMinutes();

  function horaParaMin(str) {
    if (!str) return 0;
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  }

  const abre = horaParaMin(data.hora_abertura || '18:00');
  const fecha = horaParaMin(data.hora_fechamento || '23:59');
  
  // Lógica de Aberto/Fechado AUTOMÁTICA baseada no horário
  let estaAberto = false;
  // Só verifica horário se a loja_aberta estiver true
  if (data.loja_aberta) {
     if (fecha < abre) estaAberto = horaAtual >= abre || horaAtual < fecha;
     else estaAberto = horaAtual >= abre && horaAtual < fecha;
  }

  const badge = document.querySelector('.badge-status');
  if(badge) {
      if (estaAberto) {
        badge.innerText = 'Aberto';
        badge.style.background = '#e6ffea';
        badge.style.color = '#28a745';
      } else {
        badge.innerText = 'Fechado';
        badge.style.background = '#ffebee';
        badge.style.color = '#c0392b';
      }
  }

  // Atualiza Banner Promocional
  if (data.banner_imagem && data.banner_produto_id) {
    const bannerArea = document.querySelector('.banner-area');
    if (bannerArea) {
      const img = bannerArea.querySelector('img');
      if (img) img.src = data.banner_imagem;
      
      bannerArea.onclick = function () {
        clicarBanner(data.banner_produto_id);
      };
    }
  }
  
  // Aplica personalização visual se existir
  if (data.nome_loja) {
    const h1 = document.querySelector('.store-details h1');
    if(h1) h1.textContent = data.nome_loja;
    
    // Atualiza o título da página também
    document.title = `${data.nome_loja} - Delivery`;
  }
  
  if (data.cor_primaria) {
    document.documentElement.style.setProperty('--primary', data.cor_primaria);
  }
  
  if (data.icone_url) {
    document.querySelectorAll('.logo-area img, link[rel="apple-touch-icon"]').forEach(img => {
      img.src = data.icone_url;
    });
  }
}

// Renderiza o Menu (Categories + Produtos)
async function renderMenu() {
  const nav = document.getElementById('category-nav');
  const content = document.getElementById('menu-content');
  
  if(!nav || !content) return;

  nav.innerHTML = '';
  content.innerHTML = '';

  // Busca Categorias e Produtos ativos — exclui os de somente balcão
  const { data: categsDb } = await supa.from('categorias').select('*').order('ordem');
  const { data: produtos } = await supa.from('produtos').select('*')
      .eq('ativo', true)
      .or('somente_balcao.is.null,somente_balcao.eq.false');

  if (!produtos || !categsDb) {
    console.error('Erro ao carregar menu do banco');
    return;
  }

  // Limpa e popula a estrutura MENU local
  for (let key in MENU) MENU[key] = []; // Reseta

  produtos.forEach((p) => {
    // Se a categoria não existe no objeto local, cria
    if (!MENU[p.categoria_slug]) MENU[p.categoria_slug] = [];

    MENU[p.categoria_slug].push({
      id: p.id,
      nome: p.nome,
      desc: p.descricao,
      preco: p.preco,
      img: p.imagem_url,
      montagem: p.montagem_config,
      e_montavel: p.e_montavel,
    });
  });

  // Constrói o HTML
  categsDb.forEach((cat) => {
    const key = cat.slug;
    const items = MENU[key];

    if (items && items.length > 0) {
      // Cria Botão Navegação (Pill)
      const pill = document.createElement('button');
      pill.className = 'cat-pill';
      pill.innerText = cat.nome_exibicao;
      pill.onclick = () => {
        document.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        document.getElementById(key).scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      nav.appendChild(pill);

      // Cria Seção de Produtos
      const section = document.createElement('section');
      section.id = key;
      section.innerHTML = `<h2 class="section-title">${cat.nome_exibicao}</h2>`;

      items.forEach((item) => {
        // Stringify seguro para passar no onclick
        const itemJson = JSON.stringify(item).replace(/'/g, "'").replace(/"/g, "&quot;");
        let img = item.img || 'https://cdn-icons-png.flaticon.com/512/2252/2252075.png';

        const div = document.createElement('div');
        div.className = 'product-item';
        div.onclick = function() { abrirModal(item); }; // Uso de closure é mais seguro que onclick string

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

// ==========================================
// 5. MODAL DE PRODUTO
// ==========================================
function abrirModal(item) {
  prodAtual = item;
  qtd = 1;
  itensMontagem = {};

  document.getElementById('modal-title').innerText = item.nome;
  document.getElementById('modal-desc').innerText = item.desc || '';
  document.getElementById('modal-obs').value = '';

  // Área de Opções (Montagem / Pokes)
  const divOptions = document.getElementById('modal-options');
  divOptions.innerHTML = '';

  if (item.e_montavel && item.montagem) {
    item.montagem.forEach((etapa, idxEtapa) => {
      const h4 = document.createElement('h4');
      h4.innerText = `${etapa.titulo} (Máx: ${etapa.max})`;
      h4.style.marginTop = '10px';
      divOptions.appendChild(h4);

      etapa.itens.forEach((ingrediente) => {
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.padding = '5px 0';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = ingrediente;
        input.onchange = () => {
          if (!itensMontagem[idxEtapa]) itensMontagem[idxEtapa] = [];
          if (input.checked) {
            if (itensMontagem[idxEtapa].length < etapa.max) {
              itensMontagem[idxEtapa].push(ingrediente);
            } else {
              alert(`Máximo: ${etapa.max}`);
              input.checked = false;
            }
          } else {
            const idx = itensMontagem[idxEtapa].indexOf(ingrediente);
            if (idx > -1) itensMontagem[idxEtapa].splice(idx, 1);
          }
        };

        label.appendChild(input);
        label.appendChild(document.createTextNode(' ' + ingrediente));
        divOptions.appendChild(label);
      });
    });
  }

  document.getElementById('modal-qty').innerText = qtd;
  document.getElementById('modal-price').innerText = `Gs ${item.preco.toLocaleString('es-PY')}`;
  document.getElementById('product-modal').classList.add('active');
}

function fecharModalProduto() {
  document.getElementById('product-modal').classList.remove('active');
}

function mudarQtd(delta) {
  qtd = Math.max(1, qtd + delta);
  document.getElementById('modal-qty').innerText = qtd;
  document.getElementById('modal-price').innerText = `Gs ${(prodAtual.preco * qtd).toLocaleString('es-PY')}`;
}

function adicionarDoModal() {
  if (!prodAtual) return;

  let montagem = [];
  for (let k in itensMontagem) montagem = montagem.concat(itensMontagem[k]);

  carrinho.push({
    id: Date.now(),
    nome: prodAtual.nome,
    preco: prodAtual.preco,
    qtd: qtd,
    montagem: montagem,
    obs: document.getElementById('modal-obs').value,
    img: prodAtual.img,
  });

  updateUI();
  fecharModalProduto();
}

// ==========================================
// 6. ATUALIZAÇÃO DA UI (Carrinho)
// ==========================================
function updateUI() {
  const cartBar = document.getElementById('cart-bar');
  const count = document.getElementById('cart-count');
  const total = document.getElementById('cart-total');

  const totalItens = carrinho.reduce((a, i) => a + i.qtd, 0);
  const totalDinheiro = carrinho.reduce((a, i) => a + i.preco * i.qtd, 0);

  count.innerText = totalItens;
  total.innerText = `Gs ${totalDinheiro.toLocaleString('es-PY')}`;
  cartBar.classList.toggle('show', totalItens > 0);

  // Atualiza lista no checkout se estiver aberto
  const modalCheckout = document.getElementById('checkout-modal');
  if (modalCheckout && modalCheckout.classList.contains('active')) {
    renderCarrinho();
  }
}

function limparCarrinho() {
  if (confirm('Deseja limpar o carrinho?')) {
    carrinho = [];
    cupomAplicado = null;
    updateUI();
  }
}

// ==========================================
// 7. CHECKOUT E VALIDAÇÃO
// ==========================================
function abrirCheckout() {
  if (carrinho.length === 0) return alert('Carrinho vazio!');
  renderCarrinho();
  renderUpsell();
  document.getElementById('checkout-modal').classList.add('active');
}

function fecharCheckout() {
  document.getElementById('checkout-modal').classList.remove('active');
}

function renderCarrinho() {
  const lista = document.getElementById('carrinho-lista');
  lista.innerHTML = '';

  carrinho.forEach((item, idx) => {
    const totalItem = item.preco * item.qtd;
    const detalhes = item.montagem && item.montagem.length > 0 ? `<br><small style="color:#888">${item.montagem.join(', ')}</small>` : '';
    const obs = item.obs ? `<br><small style="color:#666"><strong>Obs:</strong> ${item.obs}</small>` : '';

    lista.innerHTML += `
      <div class="cart-item-row">
        ${item.img ? `<img src="${item.img}" class="cart-thumb">` : ''}
        <div class="cart-details">
          <div class="cart-title">${item.nome}</div>
          ${detalhes}
          ${obs}
          <div class="cart-item-price">Gs ${totalItem.toLocaleString('es-PY')}</div>
        </div>
        <div class="qty-mini">
          <button onclick="mudarQtdCarrinho(${idx}, -1)">−</button>
          <span>${item.qtd}</span>
          <button onclick="mudarQtdCarrinho(${idx}, 1)">+</button>
        </div>
      </div>
    `;
  });

  atualizarTotalCheckout();
}

function mudarQtdCarrinho(idx, delta) {
  if (idx < 0 || idx >= carrinho.length) return;
  carrinho[idx].qtd = Math.max(1, carrinho[idx].qtd + delta);
  if (carrinho[idx].qtd === 0) carrinho.splice(idx, 1);
  renderCarrinho();
  updateUI();
}

function renderUpsell() {
  const upsellDiv = document.getElementById('lista-upsell');
  if (!upsellDiv) return;
  
  upsellDiv.innerHTML = '';
  const upsellItems = MENU['bebidas'] || [];

  upsellItems.slice(0, 5).forEach((item) => {
    const img = item.img || 'https://via.placeholder.com/80?text=🥤';
    upsellDiv.innerHTML += `
      <div class="upsell-item" style="min-width:100px;text-align:center;cursor:pointer;" onclick='adicionarUpsell(${JSON.stringify(item).replace(/'/g, "&#39;")})'>
        <img src="${img}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;margin-bottom:5px;">
        <div style="font-size:0.75rem;font-weight:600">${item.nome}</div>
        <div style="font-size:0.7rem;color:var(--primary)">Gs ${item.preco.toLocaleString('es-PY')}</div>
      </div>
    `;
  });
}

function adicionarUpsell(item) {
  carrinho.push({ ...item, qtd: 1, montagem: [], obs: '' });
  renderCarrinho();
  updateUI();
}

// ==========================================
// CUPOM DE DESCONTO
// ==========================================
function aplicarCupom() {
  const codigo = document.getElementById('cupom-codigo')?.value?.trim().toUpperCase();
  const msgBox = document.getElementById('cupom-msg');
  
  if (!codigo) {
    msgBox.innerHTML = '<span style="color:#e74c3c">Digite um código</span>';
    msgBox.style.display = 'block';
    return;
  }
  
  // Cupons de exemplo - você pode buscar do banco de dados
  const cupons = {
    'BEMVINDO10': { tipo: 'percentual', valor: 10, min: 50000 },
    'SUSHI20': { tipo: 'percentual', valor: 20, min: 100000 },
    'FRETEGRATIS': { tipo: 'frete', valor: 0, min: 0 }
  };
  
  const cupom = cupons[codigo];
  
  if (!cupom) {
    msgBox.innerHTML = '<span style="color:#e74c3c">❌ Cupom inválido</span>';
    msgBox.style.display = 'block';
    cupomAplicado = null;
  } else {
    const subtotal = carrinho.reduce((a, i) => a + i.preco * i.qtd, 0);
    if (subtotal < cupom.min) {
      msgBox.innerHTML = `<span style="color:#e74c3c">Valor mínimo: Gs ${cupom.min.toLocaleString('es-PY')}</span>`;
      msgBox.style.display = 'block';
      cupomAplicado = null;
    } else {
      cupomAplicado = { codigo, ...cupom };
      msgBox.innerHTML = '<span style="color:#27ae60">✅ Cupom aplicado!</span>';
      msgBox.style.display = 'block';
    }
  }
  
  atualizarTotalCheckout();
}

function atualizarTotalCheckout() {
  const totalItens = carrinho.reduce((a, i) => a + i.preco * i.qtd, 0);
  let desconto = 0;
  let freteAplicado = freteCalculado;
  
  if (cupomAplicado) {
    if (cupomAplicado.tipo === 'percentual') {
      desconto = Math.round(totalItens * (cupomAplicado.valor / 100));
    } else if (cupomAplicado.tipo === 'frete') {
      freteAplicado = 0;
    }
  }
  
  const totalGeral = totalItens - desconto + (modoEntrega === 'delivery' ? freteAplicado : 0);
  
  let html = `
    <div style="display:flex;justify-content:space-between;margin:5px 0;font-size:0.9rem">
      <span>Subtotal:</span>
      <span>Gs ${totalItens.toLocaleString('es-PY')}</span>
    </div>
  `;
  
  if (desconto > 0) {
    html += `
      <div style="display:flex;justify-content:space-between;margin:5px 0;font-size:0.9rem;color:#27ae60">
        <span>Desconto (${cupomAplicado.codigo}):</span>
        <span>- Gs ${desconto.toLocaleString('es-PY')}</span>
      </div>
    `;
  }
  
  if (modoEntrega === 'delivery') {
    html += `
      <div style="display:flex;justify-content:space-between;margin:5px 0;font-size:0.9rem">
        <span>Frete:</span>
        <span>Gs ${freteAplicado.toLocaleString('es-PY')}</span>
      </div>
    `;
  }
  
  const totalEl = document.getElementById('total-final-checkout');
  if (totalEl) {
    totalEl.innerHTML = `
      <div style="border-top:2px solid #eee;padding-top:10px;margin-top:10px">
        ${html}
        <div style="display:flex;justify-content:space-between;font-size:1.2rem;font-weight:bold;margin-top:10px">
          <span>Total:</span>
          <span>Gs ${totalGeral.toLocaleString('es-PY')}</span>
        </div>
      </div>
    `;
  }
}

function mudarModoEntrega(modo) {
  modoEntrega = modo;
  document.getElementById('btn-delivery').classList.toggle('active', modo === 'delivery');
  document.getElementById('btn-retirada').classList.toggle('active', modo === 'retirada');
  document.getElementById('box-endereco').style.display = modo === 'delivery' ? 'block' : 'none';
  atualizarTotalCheckout();
}

function toggleFactura() {
  const checked = document.getElementById('check-factura').checked;
  document.getElementById('box-ruc').classList.toggle('hidden', !checked);
}

function verificarPagamento() {
  const pag = document.getElementById('forma-pag').value;
  const infoDiv = document.getElementById('info-pagamento-extra');
  const boxTroco = document.getElementById('box-troco');

  infoDiv.style.display = 'none';
  boxTroco.classList.add('hidden');

  if (pag === 'Efetivo') {
    boxTroco.classList.remove('hidden');
  } else if (pag === 'Pix') {
    infoDiv.style.display = 'block';
    infoDiv.innerHTML = `<strong>💳 Chave Pix:</strong><br>${CHAVE_PIX}<br><small>Titular: ${NOME_PIX}</small>`;
  } else if (pag === 'Transferencia') {
    infoDiv.style.display = 'block';
    infoDiv.innerHTML = `<strong>🏦 Dados para Transferência:</strong><br>${DADOS_ALIAS}<br>${ALIAS_PY}`;
  }
}

async function calcularFrete() {
  const btn = document.getElementById('btn-gps');
  const msg = document.getElementById('frete-msg');
  const boxErro = document.getElementById('box-erro-gps');

  btn.innerText = 'Localizando...';
  btn.disabled = true;

  if (!navigator.geolocation) {
    msg.innerHTML = '<span style="color:#e74c3c">GPS não disponível neste dispositivo</span>';
    boxErro.style.display = 'block';
    btn.innerText = '📍 Calcular Frete';
    btn.disabled = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      localCliente = { lat: position.coords.latitude, lng: position.coords.longitude };
      const dist = calcularDistancia(COORD_LOJA.lat, COORD_LOJA.lng, localCliente.lat, localCliente.lng);
      
      // === NOVA TABELA DE FRETE ===
      if (dist <= 3.3) {
        freteCalculado = 6000;
      } else if (dist <= 4.2) {
        freteCalculado = 12000;
      } else if (dist <= 5.2) {
        freteCalculado = 18000;
      } else if (dist <= 6.2) {
        freteCalculado = 24000;
      } else {
        // Acima de 6.3km: 24.000 + 3.000 por km adicional
        const kmExtra = Math.ceil(dist - 6.2);
        freteCalculado = 24000 + (kmExtra * 3000);
      }
      
      msg.innerHTML = `<span style="color:#27ae60">✅ Distância: ${dist.toFixed(1)}km - Frete: Gs ${freteCalculado.toLocaleString('es-PY')}</span>`;
      msg.style.color = '#27ae60';
      boxErro.style.display = 'none';
      
      btn.innerText = '✅ Localização OK';
      btn.disabled = true;
      atualizarTotalCheckout();
    },
    (error) => {
      msg.innerHTML = '<span style="color:#e74c3c">Não foi possível obter sua localização</span>';
      boxErro.style.display = 'block';
      btn.innerText = '📍 Tentar Novamente';
      btn.disabled = false;
    }
  );
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ==========================================
// 8. ENVIO DO PEDIDO
// ==========================================
async function enviarZap() {
  const nome = document.getElementById('cli-nome').value.trim();
  const ddi = document.getElementById('cli-ddi').value;
  const tel = document.getElementById('cli-tel').value.trim();
  const pag = document.getElementById('forma-pag').value;

  if (!nome || !tel || !pag) return alert('Preencha todos os campos obrigatórios!');

  if (modoEntrega === 'delivery' && !localCliente && !document.getElementById('check-sem-gps')?.checked) {
    alert('Por favor, calcule o frete ou marque a opção de enviar localização pelo WhatsApp');
    return;
  }

  const usouPlanoB = document.getElementById('check-sem-gps')?.checked;
  const ref = document.getElementById('cli-ref').value || '';
  const telCompleto = ddi + tel;

  const totalItens = carrinho.reduce((a, i) => a + i.preco * i.qtd, 0);
  let desconto = 0;
  let freteAplicado = freteCalculado;
  
  if (cupomAplicado) {
    if (cupomAplicado.tipo === 'percentual') {
      desconto = Math.round(totalItens * (cupomAplicado.valor / 100));
    } else if (cupomAplicado.tipo === 'frete') {
      freteAplicado = 0;
    }
  }
  
  const totalGeral = totalItens - desconto + (modoEntrega === 'delivery' ? freteAplicado : 0);

  // 1. Salva no Banco PRIMEIRO para pegar o ID real
  let pedidoDbId = null;
  let numeroPedido = null;
  
  if (typeof supa !== 'undefined') {
    const pedidoDb = {
      status: 'pendente',
      tipo_entrega: modoEntrega,
      subtotal: totalItens,
      frete_cobrado_cliente: modoEntrega === 'delivery' ? freteAplicado : 0,
      desconto_cupom: desconto,
      total_geral: totalGeral,
      forma_pagamento: pag,
      obs_pagamento: pag === 'Efetivo' ? document.getElementById('troco-valor').value : '',
      itens: carrinho.map((i) => ({ n: i.nome, p: i.preco, q: i.qtd, t: i.variacao, m: i.montagem, o: i.obs })),
      endereco_entrega: ref,
      geo_lat: localCliente ? localCliente.lat.toString() : null,
      geo_lng: localCliente ? localCliente.lng.toString() : null,
      cliente_nome: nome,
      cliente_telefone: telCompleto,
      dados_factura: document.getElementById('check-factura').checked
        ? { ruc: document.getElementById('cli-ruc').value, razao: document.getElementById('cli-zao').value }
        : null,
    };

    const { data: pedidoSalvo, error } = await supa.from('pedidos').insert([pedidoDb]).select().single();

    if (error) {
      console.error('Erro ao salvar pedido:', error);
      alert('⚠️ Erro ao salvar pedido no sistema. Tente novamente.');
      return;
    }
    
    if (pedidoSalvo) {
      pedidoDbId = pedidoSalvo.id;
      numeroPedido = pedidoSalvo.id; // USA O ID DO BANCO
      console.log('✅ Pedido salvo com ID:', pedidoDbId);
    }
  }

  // Salva localmente para "Repetir Pedido"
  localStorage.setItem('sushi_last', JSON.stringify(carrinho));
  localStorage.setItem('sushi_user', JSON.stringify({ nome, tel }));

  // 2. Usa o número real do pedido na mensagem
  const idDisplay = numeroPedido || 'TEMP';
  
  // 3. Monta Mensagem WhatsApp
  let msg = `🍣 PEDIDO #${idDisplay} - SUSHITERIA\n`;
  msg += `--------------------------\n`;
  msg += `👤 Cliente: ${nome}\n`;
  msg += `📱 Tel: ${telCompleto}\n`;
  msg += `🛵 Tipo: ${modoEntrega === 'delivery' ? 'DELIVERY' : 'RETIRADA'}\n`;

  if (modoEntrega === 'delivery') {
    if (localCliente && freteAplicado > 0) {
      msg += `📍 Maps: https://maps.google.com/?q=${localCliente.lat},${localCliente.lng}\n`;
      msg += `🛵 Delivery: Gs ${freteAplicado.toLocaleString('es-PY')}\n`;
    } else if (usouPlanoB) {
      msg += `📍 *Localização:* Enviarei aqui no WhatsApp 📎\n`;
      msg += `🛵 *Delivery:* A COMBINAR\n`;
    }
    msg += `🏠 Ref: ${ref}\n`;
  }

  msg += `--------------------------\n`;
  carrinho.forEach((item) => {
    msg += `${item.qtd}x ${item.nome}`;
    if (item.variacao) msg += ` (${item.variacao})`;
    msg += `\n`;
    if (item.montagem && item.montagem.length > 0) msg += `   + ${item.montagem.join(', ')}\n`;
    if (item.obs) msg += `   Obs: ${item.obs}\n`;
  });

  msg += `--------------------------\n`;
  msg += `Subtotal: Gs ${totalItens.toLocaleString('es-PY')}\n`;
  
  if (desconto > 0) {
    msg += `Desconto (${cupomAplicado.codigo}): -Gs ${desconto.toLocaleString('es-PY')}\n`;
  }
  
  if (modoEntrega === 'delivery' && !usouPlanoB) {
      msg += `Delivery: Gs ${freteAplicado.toLocaleString('es-PY')}\n`;
  }
  msg += `TOTAL: Gs ${totalGeral.toLocaleString('es-PY')}\n`;
  msg += `--------------------------\n`;

  // Pagamento e Troco
  if (pag === 'Efetivo') {
     const trocoVal = document.getElementById('troco-valor').value;
     msg += `💰 Pagamento: Efetivo (Troco p/: ${trocoVal})\n`;
  } else {
     msg += `💰 Pagamento: ${pag}\n`;
  }

  // Avisos de Pix/Alias (Bilíngue)
  if (pag === 'Pix' || pag === 'Transferencia') {
      if(pag === 'Pix') msg += `\n💠 Chave Pix: ${CHAVE_PIX}\n`;
      if(pag === 'Transferencia') msg += `\n📎 Alias: ${ALIAS_PY}\n`;
      
      msg += `\n⚠️ ATENÇÃO: Envie o comprovante / Enviar comprobante.\n`;
      
      msg += `\n⚠️ *ATENÇÃO: SEU PEDIDO SERÁ CONFIRMADO APENAS APÓS O ENVIO DE SEU COMPROVANTE*\n`;
  }

  // Factura
  if (document.getElementById('check-factura').checked) {
      msg += `\n📄 RUC: ${document.getElementById('cli-ruc').value}\nRazão: ${document.getElementById('cli-zao').value}\n`;
  }

  // Envia
  window.open(`https://wa.me/${FONE_LOJA}?text=${encodeURIComponent(msg)}`, '_blank');

  // Limpa carrinho e fecha checkout
  carrinho = [];
  cupomAplicado = null;
  updateUI();
  fecharCheckout();
  
  // Mostra alerta e card de tracking
  alert('✅ Pedido Enviado! Agora você pode acompanhar seu pedido abaixo.');
  
  // Mostra card de tracking
  if (numeroPedido) {
    mostrarCardTracking(numeroPedido);
  }
}

// ==========================================
// 9. DADOS LOCAIS & REPETIR PEDIDO (Funções Restauradas)
// ==========================================
function carregarDadosLocal() {
  const user = JSON.parse(localStorage.getItem('sushi_user'));
  if (user) {
    if (document.getElementById('cli-nome')) document.getElementById('cli-nome').value = user.nome;
    if (document.getElementById('cli-tel')) document.getElementById('cli-tel').value = user.tel;
  }

  const last = JSON.parse(localStorage.getItem('sushi_last'));
  const box = document.getElementById('buy-again-container');

  if (last && Array.isArray(last) && last.length > 0) {
    if (box) {
      box.style.display = 'block';
      const ul = document.getElementById('last-order-list');
      if (ul) {
        ul.innerHTML = '';
        last.forEach((i) => {
          ul.innerHTML += `<li style="border-bottom: 1px dashed #eee; padding: 5px 0;"><b>${i.qtd}x</b> ${i.nome}</li>`;
        });
      }
    }
  } else {
    if (box) box.style.display = 'none';
  }
}

function repetirPedido() {
  const last = JSON.parse(localStorage.getItem('sushi_last'));
  if (last && Array.isArray(last) && last.length > 0) {
    carrinho = last;
    updateUI();
    abrirCheckout();
  }
}

function clicarBanner(idProduto) {
  let produtoEncontrado = null;
  for (const key in MENU) {
    const item = MENU[key].find((i) => i.id == idProduto);
    if (item) {
      produtoEncontrado = item;
      break;
    }
  }

  if (produtoEncontrado) {
    abrirModal(produtoEncontrado);
  } else {
    console.error('Produto do banner não encontrado no menu carregado.');
    // Não damos alert para não incomodar caso o menu ainda esteja carregando
  }
}
// ==========================================
// 10. TRACKING DE PEDIDO — POLLING GARANTIDO
// ==========================================
// ARQUITETURA: polling a cada 5s como BASE (funciona sempre).
// Realtime como BÔNUS (mais rápido, mas fecha no plano free).
// O erro "CLOSED" no console é normal — o polling cobre.
let _trackingChannel  = null;   // canal Realtime (bônus)
let _pollingTracker   = null;   // setInterval de 5s (garantia)
let _lastTrackedSt    = '';     // evita re-render sem mudança
let _trackedId        = null;   // id do pedido em tracking

const TRACKER_STEPS = {
    'pendente':       { step: 1, icon: '📥', msg: 'Pedido recebido! Aguardando confirmação...' },
    'em_preparo':     { step: 2, icon: '🔥', msg: 'Seu pedido está sendo preparado!' },
    'pronto_entrega': { step: 3, icon: '📦', msg: 'Pronto! Aguardando motoboy...' },
    'saiu_entrega':   { step: 3, icon: '🛵', msg: 'Seu pedido saiu para entrega!' },
    'entregue':       { step: 4, icon: '✅', msg: 'Pedido entregue! Bom apetite! 🍣' },
    'cancelado':      { step: 0, icon: '❌', msg: 'Pedido cancelado. Entre em contato conosco.' },
};

function iniciarTracking(pedidoDbId, uidTemporal) {
    if (!pedidoDbId) return;
    _trackedId     = pedidoDbId;
    const uid      = uidTemporal || pedidoDbId;

    try {
        localStorage.setItem('sushi_pedido_id',  pedidoDbId);
        localStorage.setItem('sushi_pedido_uid', uid);
    } catch(e) {}

    _lastTrackedSt = 'pendente';
    mostrarTracker('pendente', uid);

    _iniciarPollingTracking(pedidoDbId, uid);   // GARANTIA (sempre funciona)
    _tentarCanalRealtime(pedidoDbId, uid);       // BÔNUS (mais rápido quando disponível)

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ── POLLING: consulta o banco a cada 5s ──
function _iniciarPollingTracking(pedidoId, uid) {
    if (_pollingTracker) { clearInterval(_pollingTracker); _pollingTracker = null; }

    _pollingTracker = setInterval(async () => {
        try {
            const { data } = await supa
                .from('pedidos')
                .select('status, motoboy_id')
                .eq('id', pedidoId)
                .single();

            if (!data || data.status === _lastTrackedSt) return; // sem mudança
            _lastTrackedSt = data.status;

            mostrarTracker(data.status, uid);

            // Atualiza também o card de busca se visível
            if (typeof atualizarTrackingVisual === 'function') {
                let motoboy = null;
                if (data.motoboy_id) {
                    const { data: m } = await supa.from('motoboys')
                        .select('nome, telefone').eq('id', data.motoboy_id).single();
                    motoboy = m;
                }
                atualizarTrackingVisual(data.status, motoboy);
            }

            // Notificação push
            if ('Notification' in window && Notification.permission === 'granted' && TRACKER_STEPS[data.status]) {
                new Notification('Sushiteria Delivery 🍣', {
                    body: TRACKER_STEPS[data.status].msg,
                    icon: 'https://img.freepik.com/vetores-gratis/desenho-de-modelo-de-logotipo-de-sushi_742173-17797.jpg'
                });
            }

            if (data.status === 'entregue' || data.status === 'cancelado') {
                clearInterval(_pollingTracker); _pollingTracker = null;
                if (_trackingChannel) { _trackingChannel.unsubscribe(); _trackingChannel = null; }
                setTimeout(() => {
                    try { localStorage.removeItem('sushi_pedido_id'); localStorage.removeItem('sushi_pedido_uid'); } catch(e) {}
                }, 10000);
            }
        } catch(e) { /* falha silenciosa de rede */ }
    }, 5000);
}

// ── REALTIME: bônus quando disponível ──
function _tentarCanalRealtime(pedidoId, uid) {
    try {
        if (_trackingChannel) { _trackingChannel.unsubscribe(); _trackingChannel = null; }
        _trackingChannel = supa
            .channel(`sushi-track-${pedidoId}-${Date.now()}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'pedidos',
                filter: `id=eq.${pedidoId}`
            }, (payload) => {
                const ns = payload.new?.status;
                if (ns && ns !== _lastTrackedSt) {
                    _lastTrackedSt = ns;
                    mostrarTracker(ns, uid);
                }
            })
            .subscribe((st) => {
                // CLOSED é normal no plano free — polling já cobre
                if (st === 'CLOSED' || st === 'CHANNEL_ERROR') {
                    _trackingChannel = null;
                }
            });
    } catch(e) { /* Realtime indisponível */ }
}

function mostrarTracker(status, uid) {
    const t = TRACKER_STEPS[status] || TRACKER_STEPS['pendente'];
    const tracker = document.getElementById('pedido-tracker');
    if (!tracker) {
        console.warn('⚠️ Elemento pedido-tracker não encontrado');
        return;
    }

    const iconEl = document.getElementById('tracker-status-icon');
    const msgEl = document.getElementById('tracker-msg');
    const idEl = document.getElementById('tracker-pedido-id');
    
    if (iconEl) iconEl.innerText = t.icon;
    if (msgEl) msgEl.innerText = t.msg;
    if (idEl) idEl.innerText = uid ? `Pedido #${uid}` : '';
    
    tracker.style.display = 'block';

    // Atualiza passos visuais
    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById(`tstep-${i}`);
        if (!el) continue;
        el.classList.toggle('tracker-step-active', i <= t.step);
        el.classList.toggle('tracker-step-done',   i <  t.step);
    }

    // Se entregue ou cancelado, esconde após 8s
    if (status === 'entregue' || status === 'cancelado') {
        setTimeout(() => {
            fecharTracker();
            // Limpa do localStorage
            try {
                localStorage.removeItem('sushi_pedido_id');
                localStorage.removeItem('sushi_pedido_uid');
            } catch (e) {
                console.error('Erro ao limpar localStorage:', e);
            }
        }, 8000);
    }
}

function fecharTracker() {
    const tracker = document.getElementById('pedido-tracker');
    if (tracker) tracker.style.display = 'none';
    if (_trackingChannel) {
        _trackingChannel.unsubscribe();
        _trackingChannel = null;
    }
}

// Restaura tracking ao recarregar a página
function restaurarTrackingSeExistir() {
    // Card de rastreio SEMPRE visível (cliente pode digitar o número)
    const card = document.getElementById('track-order-card');
    if (card) card.style.display = 'block';

    const savedId  = localStorage.getItem('sushi_pedido_id');
    const savedUid = localStorage.getItem('sushi_pedido_uid');
    if (!savedId) return;

    console.log('🔄 Restaurando tracking para pedido:', savedId);
    if (typeof supa === 'undefined') return;

    supa.from('pedidos').select('status, motoboy_id').eq('id', savedId).single()
        .then(async ({ data, error }) => {
            if (error || !data) return;
            if (data.status === 'entregue' || data.status === 'cancelado') {
                try { localStorage.removeItem('sushi_pedido_id'); localStorage.removeItem('sushi_pedido_uid'); } catch(e) {}
                return;
            }

            // Preenche input e abre resultado direto
            const input = document.getElementById('track-pedido-input');
            if (input) input.value = savedId;
            const tf = document.getElementById('track-form');   if(tf)  tf.style.display  = 'none';
            const tr = document.getElementById('track-result'); if(tr)  tr.style.display  = 'block';
            const tn = document.getElementById('track-numero'); if(tn)  tn.textContent    = savedId;

            let motoboy = null;
            if (data.motoboy_id) {
                const { data: m } = await supa.from('motoboys')
                    .select('nome, telefone').eq('id', data.motoboy_id).single();
                motoboy = m;
            }

            atualizarTrackingVisual(data.status, motoboy);
            _lastTrackedSt = data.status;
            _trackedId     = savedId;

            _iniciarPollingTracking(savedId, savedUid);
            _tentarCanalRealtime(savedId, savedUid);
        });
}

async function aplicarCupom() {
    const codigo = document.getElementById('cupom-codigo')?.value?.trim().toUpperCase();
    const msgBox = document.getElementById('cupom-msg');
    
    if (!codigo) {
        msgBox.innerHTML = '<span style="color:#e74c3c">Digite um código</span>';
        msgBox.style.display = 'block';
        return;
    }
    
    // Busca no banco
    const { data: cupom, error } = await supa
        .from('cupons')
        .select('*')
        .eq('codigo', codigo)
        .eq('ativo', true)
        .single();
    
    if (error || !cupom) {
        msgBox.innerHTML = '<span style="color:#e74c3c">❌ Cupom inválido ou inativo</span>';
        msgBox.style.display = 'block';
        cupomAplicado = null;
        atualizarTotalCheckout();
        return;
    }
    
    const subtotal = carrinho.reduce((a, i) => a + i.preco * i.qtd, 0);
    if (subtotal < cupom.minimo) {
        msgBox.innerHTML = `<span style="color:#e74c3c">Valor mínimo: Gs ${cupom.minimo.toLocaleString('es-PY')}</span>`;
        msgBox.style.display = 'block';
        cupomAplicado = null;
    } else {
        cupomAplicado = cupom;
        msgBox.innerHTML = '<span style="color:#27ae60">✅ Cupom aplicado!</span>';
        msgBox.style.display = 'block';
    }
    
    atualizarTotalCheckout();
}
// =============================================
// NOVO SISTEMA DE TRACKING - CARD FIXO
// =============================================

// Mostrar card de tracking automaticamente após enviar pedido
function mostrarCardTracking(numeroPedido) {
    const card = document.getElementById('track-order-card');
    const input = document.getElementById('track-pedido-input');
    
    if (card && input) {
        card.style.display = 'block';
        input.value = numeroPedido;
        buscarPedido(); // Busca automaticamente
        
        // Scroll suave até o card
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Fechar card de tracking
function fecharCardTracking() {
    const card = document.getElementById('track-order-card');
    if (card) card.style.display = 'none';
}

// Voltar para busca
function voltarBusca() {
    document.getElementById('track-form').style.display = 'block';
    document.getElementById('track-result').style.display = 'none';
    document.getElementById('track-pedido-input').value = '';
}

// Buscar pedido por número
async function buscarPedido() {
    const input = document.getElementById('track-pedido-input');
    const numeroPedido = input ? input.value.trim() : '';
    
    if (!numeroPedido) {
        alert('Por favor, digite o número do pedido');
        return;
    }
    
    // Esconde form, mostra resultado
    document.getElementById('track-form').style.display = 'none';
    document.getElementById('track-result').style.display = 'block';
    document.getElementById('track-numero').textContent = numeroPedido;
    document.getElementById('track-status-msg').textContent = 'Buscando...';
    
    try {
        // Busca no Supabase
        const { data: pedido, error } = await supa
            .from('pedidos')
            .select('*, motoboys(nome, telefone)')
            .eq('id', parseInt(numeroPedido))
            .single();
        
        if (error || !pedido) {
            document.getElementById('track-status-msg').textContent = 'Pedido não encontrado';
            document.getElementById('track-icon').textContent = '❌';
            return;
        }
        
        // Atualiza status visual
        atualizarTrackingVisual(pedido.status, pedido.motoboys);
        
        // Inscreve no Realtime para atualizações
        iniciarTrackingRealtime(pedido.id);
        
    } catch (err) {
        console.error('Erro ao buscar pedido:', err);
        document.getElementById('track-status-msg').textContent = 'Erro ao buscar pedido';
    }
}

// Atualizar visual do tracking
function atualizarTrackingVisual(status, motoboy) {
    const statusMap = {
        'pendente':       { msg: 'Aguardando confirmação...', icon: '⏳', step: 1 },
        'em_preparo':     { msg: '🔥 Preparando seu pedido!', icon: '🔥', step: 2 },
        'pronto_entrega': { msg: '📦 Pronto! Aguardando motoboy...', icon: '📦', step: 3 },
        'saiu_entrega':   { msg: '🛵 Seu pedido saiu para entrega!', icon: '🛵', step: 3 },
        'entregue':       { msg: '✅ Pedido entregue! Bom apetite!', icon: '✅', step: 4 },
        'cancelado':      { msg: '❌ Pedido cancelado. Fale conosco.', icon: '❌', step: 0 }
    };
    
    const info = statusMap[status] || statusMap['pendente'];
    
    document.getElementById('track-status-msg').textContent = info.msg;
    document.getElementById('track-icon').textContent = info.icon;
    
    // Ativa steps
    for (let i = 1; i <= 4; i++) {
        const step = document.getElementById(`track-step-${i}`);
        if (step) {
            if (i <= info.step) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        }
    }
    
    // Mostra info do motoboy se saiu para entrega
    const motoInfo = document.getElementById('track-motoboy-info');
    if (motoInfo) {
        if ((status === 'saiu_entrega' || status === 'entregue') && motoboy) {
            motoInfo.style.display = 'block';
            document.getElementById('track-motoboy-nome').textContent = motoboy.nome || 'Não informado';
            const telLink = document.getElementById('track-motoboy-tel');
            if (telLink && motoboy.telefone) {
                telLink.textContent = motoboy.telefone;
                telLink.href = `https://wa.me/${motoboy.telefone.replace(/\D/g, '')}`;
            }
        } else {
            motoInfo.style.display = 'none';
        }
    }
}

// iniciarTrackingRealtime — usado pelo card de busca do index
// Delega para o sistema central (polling + realtime bônus)
function iniciarTrackingRealtime(pedidoId) {
    _trackedId     = pedidoId;
    _lastTrackedSt = ''; // força re-render na primeira leitura do polling
    localStorage.setItem('sushi_pedido_id', pedidoId);
    localStorage.setItem('sushi_pedido_uid', pedidoId);
    _iniciarPollingTracking(pedidoId, pedidoId);
    _tentarCanalRealtime(pedidoId, pedidoId);
}