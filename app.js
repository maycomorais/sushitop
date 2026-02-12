// ==========================================
// 1. CONFIGURAÇÕES
// ==========================================
const FONE_LOJA = '595992490500';
const COORD_LOJA = { lat: -25.2365803, lng: -57.5380816 };
let COTACAO_REAL = 1100;

// DADOS PIX & BANCO
const CHAVE_PIX = '16999647032';
const NOME_PIX = 'Jessica Aparecida Silva Pereira';
const DADOS_ALIAS = 'Banco: Itaú PY | Titular: Marcus de Alencar Roque Pereira';
const ALIAS_PY = 'Alias: 0992490500';

if (typeof supa === 'undefined') {
  console.error('ERRO: O arquivo supabaseClient.js não foi carregado antes do app.js');
  alert('Erro de sistema. Recarregue a página.');
}

// ==========================================
// 2. ESTADO DA APLICAÇÃO
// ==========================================
let carrinho = [];
let freteCalculado = 0;
let localCliente = null;
let modoEntrega = 'delivery';
let prodAtual = null,
  optAtual = null,
  qtd = 1;
let itensMontagem = {};

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

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
  if (!supabase) {
    alert('Erro: Biblioteca Supabase não carregou.');
    return;
  }

  // 1. Carrega os dados salvos do cliente (Nome, Tel e o Último Pedido)
  if (typeof carregarDadosLocal === 'function') carregarDadosLocal();

  // 2. Tenta renderizar o menu do banco de dados
  if (typeof renderMenu === 'function') await renderMenu();

  // 3. Verifica configurações (Banner, Horário)
  if (typeof verificarHorario === 'function') await verificarHorario();

  const lastStr = localStorage.getItem('sushi_last');

  if (lastStr) {
    const last = JSON.parse(lastStr);

    // Verifica se há algo na array de pedidos
    if (last && Array.isArray(last) && last.length > 0) {
      // Exibe a caixinha tirando o display: none
      document.getElementById('buy-again-container').style.display = 'block';

      // Preenche visualmente a lista com os itens do último pedido
      const listEl = document.getElementById('last-order-list');
      if (listEl) {
        listEl.innerHTML = ''; // Limpa a lista por segurança
        last.forEach((item) => {
          // Adiciona a quantidade e o nome de cada item na lista do HTML
          listEl.innerHTML += `<li>${item.qtd}x ${item.nome}</li>`;
        });
      }
    }
  }
});

// --- FUNÇÃO DE HORÁRIO (NOVA) ---
async function verificarHorario() {
  const { data } = await supa.from('configuracoes').select('*').single();
  if (!data) return;

  if (data.cotacao_real) COTACAO_REAL = data.cotacao_real; // Atualiza cotação do banco

  const agora = new Date();
  const horaAtual = agora.getHours() * 60 + agora.getMinutes();

  function horaParaMin(str) {
    if (!str) return 0;
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  }

  const abre = horaParaMin(data.hora_abertura || '18:00');
  const fecha = horaParaMin(data.hora_fechamento || '23:59');
  const manualAberto = data.loja_aberta;
  const badge = document.querySelector('.badge-status');

  let estaAberto = false;
  if (!manualAberto) estaAberto = false;
  else {
    if (fecha < abre) estaAberto = horaAtual >= abre || horaAtual < fecha;
    else estaAberto = horaAtual >= abre && horaAtual < fecha;
  }

  if (estaAberto) {
    badge.innerText = 'Aberto';
    badge.style.background = '#e6ffea';
    badge.style.color = '#28a745';
  } else {
    badge.innerText = 'Fechado';
    badge.style.background = '#ffebee';
    badge.style.color = '#c0392b';
    // Opcional: Bloquear botão de finalizar
  }

  if (data.banner_imagem && data.banner_produto_id) {
    const bannerArea = document.querySelector('.banner-area');
    if (bannerArea) {
      // Atualiza a imagem
      const img = bannerArea.querySelector('img');
      if (img) img.src = data.banner_imagem;

      // Atualiza o click para o produto certo
      bannerArea.onclick = function () {
        clicarBanner(data.banner_produto_id);
      };
    }
  }
}

// 1. RENDERIZAR MENU (Busca do Banco)
async function renderMenu() {
  const nav = document.getElementById('category-nav');
  const content = document.getElementById('menu-content');
  nav.innerHTML = '';
  content.innerHTML = ''; // Limpa antes de renderizar

  // Busca Categorias e Produtos do Banco
  const { data: categsDb } = await supa.from('categorias').select('*').order('ordem');
  const { data: produtos } = await supa.from('produtos').select('*').eq('ativo', true);

  if (!produtos || !categsDb) {
    console.error('Erro ao carregar menu do banco');
    return;
  }

  // Limpa estrutura local
  for (let key in MENU) MENU[key] = [];

  // Popula estrutura local com dados do banco
  produtos.forEach((p) => {
    if (!MENU[p.categoria_slug]) MENU[p.categoria_slug] = [];

    MENU[p.categoria_slug].push({
      id: p.id,
      nome: p.nome,
      desc: p.descricao,
      preco: p.preco,
      img: p.imagem_url,
      montagem: p.montagem_config, // JSON para Pokes
      e_montavel: p.e_montavel,
      // Opções simples (P/M/G) podem ser adaptadas aqui se usar JSONB tbm
    });
  });

  // Renderiza na tela
  categsDb.forEach((cat) => {
    const key = cat.slug;
    const items = MENU[key];

    if (items && items.length > 0) {
      // Cria Botão Navegação
      const pill = document.createElement('button');
      pill.className = 'cat-pill';
      pill.innerText = cat.nome_exibicao;
      pill.onclick = () => {
        document.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        document.getElementById(key).scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      nav.appendChild(pill);

      // Cria Seção
      const section = document.createElement('section');
      section.id = key;
      section.innerHTML = `<h2 class="section-title">${cat.nome_exibicao}</h2>`;

      items.forEach((item) => {
        let img = item.img || 'https://cdn-icons-png.flaticon.com/512/2252/2252075.png';

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
        input.name = `etapa_${idxEtapa}`;

        // Controle de Máximo
        input.onchange = function () {
          const marcados = document.querySelectorAll(`input[name="etapa_${idxEtapa}"]:checked`);
          if (marcados.length > etapa.max) {
            this.checked = false;
            alert(`Máximo de ${etapa.max} itens nesta etapa.`);
          }
        };

        label.appendChild(input);
        label.appendChild(document.createTextNode(' ' + ingrediente));
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
  document.getElementById('modal-price').innerText =
    `Gs ${(precoFinal * qtd).toLocaleString('es-PY')}`;
}

function adicionarDoModal() {
  const obs = document.getElementById('modal-obs').value;

  // Coletar Montagem (Poke)
  let montagemEscolhida = [];
  if (prodAtual.e_montavel) {
    const inputs = document.querySelectorAll('#modal-options input:checked');
    if (inputs.length === 0) {
      if (!confirm('Tem certeza que não quer adicionar nenhum ingrediente?')) return;
    }
    inputs.forEach((i) => montagemEscolhida.push(i.value));
  }

  carrinho.push({
    ...prodAtual,
    qtd: qtd,
    obs: obs,
    montagem: montagemEscolhida,
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
  const totalValor = carrinho.reduce((acc, item) => acc + item.preco * item.qtd, 0);

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
    let descMontagem = '';
    if (item.montagem && item.montagem.length) {
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
  if (modoEntrega === 'delivery' && freteCalculado === 0 && localCliente) {
    calcularFrete();
  }

  atualizarTotalCheckout();
  verificarPagamento(); // Atualiza visual do pagamento

  // ---> CHAMADA DO UPSELL INSERIDA AQUI <---
  if (typeof renderizarUpsell === 'function') {
    renderizarUpsell();
  }

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
  const btn = document.getElementById('btn-gps');
  const msg = document.getElementById('frete-msg');

  // Limpa estados anteriores
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Localizando...';
  btn.classList.remove('erro-validacao');

  if (!navigator.geolocation) {
    tratarErroGPS('Seu navegador não suporta GPS.');
    return;
  }

  // OPÇÕES CRITICAS PARA IPHONE/SAFARI
  const options = {
    enableHighAccuracy: true, // Força usar o GPS hardware
    timeout: 10000, // Espera até 10 segundos antes de falhar
    maximumAge: 0, // Não usa cache de posição antiga
  };

  navigator.geolocation.getCurrentPosition(
    // SUCESSO
    (pos) => {
      localCliente = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const dist = getDistancia(COORD_LOJA.lat, COORD_LOJA.lng, localCliente.lat, localCliente.lng);

      // Regra de Frete (Exemplo - ajuste conforme seus valores)
      if (dist <= 3.3) {
        freteCalculado = 6000;
      } else {
        const kmExcedente = Math.ceil(dist - 3.3);
        freteCalculado = 6000 + kmExcedente * 6000;
      }

      msg.innerHTML = `Dist: ${dist.toFixed(1)}km | Frete: Gs ${freteCalculado.toLocaleString('es-PY')}`;
      msg.style.color = '#28a745';
      btn.innerHTML = '<i class="fas fa-check"></i> Localizado';
      btn.style.background = '#28a745';

      // Esconde o botão de erro manual se ele estava visível
      document.getElementById('box-erro-gps').style.display = 'none';
      if (typeof atualizarTotalCheckout === 'function') atualizarTotalCheckout();
    },
    // ERRO
    (err) => {
      console.error(err);
      let texto = 'Erro ao obter localização.';
      if (err.code === 1) texto = 'Permissão de localização negada.';
      else if (err.code === 2) texto = 'Sinal de GPS indisponível.';
      else if (err.code === 3) texto = 'Tempo esgotado ao buscar GPS.';

      tratarErroGPS(texto);
    },
    options, // Passa as opções aqui
  );
}

// Função auxiliar para liberar venda sem GPS
function tratarErroGPS(motivo) {
  const btn = document.getElementById('btn-gps');
  btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro no GPS';
  btn.style.background = '#e74c3c';

  alert(
    `⚠️ ${motivo}\n\nO iPhone/Navegador bloqueou sua localização.\n\nNão se preocupe! Apareceu uma opção abaixo para você combinar o frete e enviar sua localização direto no WhatsApp.`,
  );

  // Mostra o "Plano B"
  document.getElementById('box-erro-gps').style.display = 'block';

  // Zera o frete mas marca uma flag para deixar passar
  freteCalculado = 0;
  window.gpsManual = true; // Flag global
}

// Fórmula de Haversine para distância em km
function getDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function atualizarTotalCheckout() {
  // 1. Soma os itens
  const totalItens = carrinho.reduce((acc, item) => acc + item.preco * item.qtd, 0);

  // 2. Verifica se é delivery e pega o frete
  const frete = modoEntrega === 'delivery' ? freteCalculado : 0;

  // 3. Soma tudo
  const totalGeral = totalItens + frete;

  // 4. Mostra na tela (no ID do modal)
  const elTotal = document.getElementById('total-final-checkout');
  if (elTotal) {
    elTotal.innerText = `Gs ${totalGeral.toLocaleString('es-PY')}`;
  }
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
  const totalItens = carrinho.reduce((acc, item) => acc + item.preco * item.qtd, 0);
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
  let v = input.value.replace(/\D/g, '');
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
  // 1. PEGA OS ELEMENTOS
  const elNome = document.getElementById('cli-nome');
  const elTel = document.getElementById('cli-tel');
  const elPag = document.getElementById('forma-pag');
  const btnGps = document.getElementById('btn-gps');
  const checkSemGps = document.getElementById('check-sem-gps');

  // 2. LIMPA ERROS VISUAIS
  [elNome, elTel, elPag, btnGps].forEach((el) => el?.classList.remove('erro-validacao'));
  document.querySelectorAll('.msg-erro-texto').forEach((span) => (span.style.display = 'none'));

  let temErro = false;

  // Validações Básicas
  if (!elNome.value.trim()) {
    elNome.classList.add('erro-validacao');
    temErro = true;
  }
  if (!elTel.value.trim()) {
    elTel.classList.add('erro-validacao');
    temErro = true;
  }
  if (!elPag.value) {
    elPag.classList.add('erro-validacao');
    temErro = true;
  }

  // Validação Delivery (GPS ou Plano B)
  const usouPlanoB = checkSemGps && checkSemGps.checked && checkSemGps.offsetParent !== null;

  if (modoEntrega === 'delivery') {
    if (freteCalculado === 0 && !usouPlanoB) {
      btnGps.classList.add('erro-validacao');
      alert('⚠️ Precisamos da sua localização ou que marque a opção de enviar pelo WhatsApp.');
      temErro = true;
    }
  }

  if (temErro) {
    document
      .querySelector('.erro-validacao')
      .scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // 3. PREPARA DADOS
  const nome = elNome.value;
  const tel = elTel.value;
  const ref = document.getElementById('cli-ref').value;
  const pag = elPag.value;
  const ddi = document.getElementById('cli-ddi')
    ? document.getElementById('cli-ddi').value
    : '+595';

  const totalItens = carrinho.reduce((acc, item) => acc + item.preco * item.qtd, 0);
  // Se usou Plano B (sem GPS), o delivery vai como 0 no total inicial
  const totalGeral = totalItens + (modoEntrega === 'delivery' ? freteCalculado : 0);

  const idPedido = `${new Date().getHours()}${new Date().getMinutes()}${Math.floor(Math.random() * 9)}`;

  // Salva no Banco
  const telCompleto = ddi + tel;
  let clienteId = null;

  if (typeof supa !== 'undefined') {
    const { data: clienteSalvo, error: erroCliente } = await supa
      .from('clientes')
      .upsert(
        { telefone: telCompleto, nome: nome, endereco_padrao: ref },
        { onConflict: 'telefone' }
      )
      .select() // Importante: pede para retornar os dados salvos
      .single();
    
    if (clienteSalvo) {
      clienteId = clienteSalvo.id;
    }
  }

  // 2. AGORA: Cria o objeto do pedido COM os dados do cliente
  const pedidoDb = {
    uid_temporal: idPedido,
    status: 'pendente',
    tipo_entrega: modoEntrega,
    subtotal: totalItens,
    frete_cobrado_cliente: freteCalculado,
    total_geral: totalGeral,
    forma_pagamento: pag,
    itens: carrinho, // Aqui estão os itens com .qtd
    endereco_entrega: ref,
    geo_lat: localCliente ? String(localCliente.lat) : '',
    geo_lng: localCliente ? String(localCliente.lng) : '',
    obs_pagamento: pag === 'Efetivo' ? document.getElementById('troco-valor').value : '',
    
    // CAMPOS NOVOS (A solução do problema):
    cliente_id: clienteId,          // Cria o vínculo oficial
    cliente_nome: nome,             // Salva o nome direto no pedido (garantia)
    cliente_telefone: telCompleto,  // Salva o telefone direto no pedido (garantia)
    
    dados_factura: document.getElementById('check-factura').checked
      ? {
          ruc: document.getElementById('cli-ruc').value,
          razao: document.getElementById('cli-zao').value,
        }
      : null,
  };

  // 3. Salva o pedido
  if (typeof supa !== 'undefined') {
    await supa.from('pedidos').insert([pedidoDb]);
  }

  localStorage.setItem('sushi_last', JSON.stringify(carrinho));

  // 4. MONTA MENSAGEM WHATSAPP
  let msg = `*PEDIDO #${idPedido}* - SUSHI TOP\n`;
  msg += `--------------------------\n`;
  msg += `👤 Cliente: ${nome}\n`;
  msg += `📱 Tel: ${telCompleto}\n`;
  msg += `🛵 Tipo: ${modoEntrega.toUpperCase()}\n`;

  // BLOCO DE ENDEREÇO (Sem duplicidade)
  if (modoEntrega === 'delivery') {
    if (localCliente && freteCalculado > 0) {
      // Link corrigido com cifrão $ e chaves {}
      msg += `📍 Maps: https://maps.google.com/?q=${localCliente.lat},${localCliente.lng}\n`;
      msg += `🛵 Delivery: Gs ${freteCalculado.toLocaleString('es-PY')}\n`;
    } else if (usouPlanoB) {
      msg += `📍 *Localização:* Enviarei aqui no WhatsApp 📎\n`;
      msg += `🛵 *Delivery:* A COMBINAR\n`;
    }
    msg += `🏠 Ref: ${ref}\n`;
  }

  msg += `--------------------------\n`;
  carrinho.forEach((item) => {
    msg += `${item.qtd}x ${item.nome}\n`;
    if (item.montagem && item.montagem.length > 0) msg += `   + ${item.montagem.join(', ')}\n`;
    if (item.obs) msg += `   Obs: ${item.obs}\n`;
  });

  msg += `--------------------------\n`;
  msg += `Subtotal: Gs ${totalItens.toLocaleString('es-PY')}\n`;

  // Totais
  if (modoEntrega === 'delivery' && usouPlanoB) {
    msg += `*TOTAL (Sem Delivery): Gs ${totalItens.toLocaleString('es-PY')}*\n`;
    msg += `⚠️ *Total Final dependerá do valor do Delivery*\n`;
  } else {
    if (modoEntrega === 'delivery')
      msg += `Delivery: Gs ${freteCalculado.toLocaleString('es-PY')}\n`;
    msg += `*TOTAL: Gs ${totalGeral.toLocaleString('es-PY')}*\n`;
  }

  msg += `--------------------------\n`;

  // Pagamento e Troco
  if (pag === 'Efetivo') {
    const valorPagoStr = document.getElementById('troco-valor').value;
    let valorPagoNum = parseInt(valorPagoStr.replace(/\D/g, '')) || 0;
    if (valorPagoNum > 0 && valorPagoNum < 1000) valorPagoNum *= 1000;

    const troco = valorPagoNum - totalGeral;
    msg += `💰 Pagamento: Efetivo\n`;
    msg += `💵 Paga com: Gs ${valorPagoNum.toLocaleString('es-PY')}\n`;

    if (!usouPlanoB) {
      if (troco >= 0) msg += `🔄 *Troco/Vuelta: Gs ${troco.toLocaleString('es-PY')}*\n`;
      else msg += `⚠️ Valor insuficiente\n`;
    }
  } else {
    msg += `💰 Pagamento: ${pag}\n`;
  }

  if (pag === 'Pix' || pag === 'Transferencia') {
    msg += `\n⚠️ *ATENÇÃO: Envie o comprovante / Enviar comprobante.*\n`;
  }

  if (document.getElementById('check-factura').checked) {
    msg += `\n📄 RUC: ${document.getElementById('cli-ruc').value}\nRazão: ${document.getElementById('cli-zao').value}\n`;
  }

  // 5. ENVIA E LIMPA
  window.open(`https://wa.me/${FONE_LOJA}?text=${encodeURIComponent(msg)}`, '_blank');

  // --- CORREÇÃO DO ERRO ---
  carrinho = []; // Zera a lista

  // Chama a função CORRETA: updateUI() em vez de atualizarCarrinho()
  if (typeof updateUI === 'function') {
    updateUI();
  }

  // Fecha o modal de checkout (usando o ID correto do seu HTML: checkout-modal)
  const modalCheckout = document.getElementById('checkout-modal');
  if (modalCheckout) {
    modalCheckout.style.display = 'none';
    modalCheckout.classList.remove('active');
  }

  // Recarrega a página para garantir limpeza total
  setTimeout(() => {
    alert('✅ Pedido Enviado! / Pedido Enviado!');
    window.location.reload();
  }, 1000);
}

// 8. DADOS LOCAIS & REPETIR PEDIDO (Melhorado)
function carregarDadosLocal() {
  const user = JSON.parse(localStorage.getItem('sushi_user'));
  if (user) {
    if (document.getElementById('cli-nome')) document.getElementById('cli-nome').value = user.nome;
    if (document.getElementById('cli-tel')) document.getElementById('cli-tel').value = user.tel;
  }

  const last = JSON.parse(localStorage.getItem('sushi_last'));

  // Procura o ID correto que você me mandou: buy-again-container
  const box = document.getElementById('buy-again-container');

  // Só mostra o botão se o último pedido tiver itens de verdade
  if (last && Array.isArray(last) && last.length > 0) {
    if (box) {
      box.style.display = 'block'; // Mostra a caixa

      const ul = document.getElementById('last-order-list');
      if (ul) {
        ul.innerHTML = ''; // Limpa a lista antes de preencher
        last.forEach((i) => {
          ul.innerHTML += `<li style="border-bottom: 1px dashed #eee; padding: 5px 0;"><b>${i.qtd}x</b> ${i.nome}</li>`;
        });
      }
    }
  } else {
    // Se estiver vazio, esconde a caixa
    if (box) box.style.display = 'none';
  }
}


function repetirPedido() {
  const last = JSON.parse(localStorage.getItem('sushi_last'));
  if (last && Array.isArray(last) && last.length > 0) {
    carrinho = last;
    updateUI();
    if (typeof abrirCheckout === 'function') abrirCheckout();
  }
}

// 9. BANNER
function clicarBanner(idProduto) {
  console.log('Tentando abrir banner com ID:', idProduto);

  let produtoEncontrado = null;

  // Procura em todas as categorias
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
    alert('Desculpe, esta promoção não está mais disponível ou o menu está carregando.');
  }
}

function limparCarrinho() {
  // 1. Se já estiver vazio, não faz nada
  if (carrinho.length === 0) return;

  // 2. Confirmação
  if (confirm('Tem certeza que deseja esvaziar o carrinho?')) {
    // 3. Zera a lista ATUAL apenas (Removi a linha que apagava a memória)
    carrinho = [];

    // 4. Atualiza os números vermelhos na tela
    if (typeof updateUI === 'function') {
      updateUI();
    } else {
      // Fallback manual de segurança
      document.getElementById('cart-count').innerText = '0';
      document.getElementById('cart-total').innerText = 'Gs 0';
      document.getElementById('carrinho-lista').innerHTML =
        '<p class="empty-msg">Carrinho vazio</p>';
      document.getElementById('total-final-checkout').innerText = 'Gs 0';
    }

    // 5. Fecha o modal de checkout (usando o ID correto do seu HTML)
    const modalCheckout = document.getElementById('checkout-modal');
    if (modalCheckout) {
      modalCheckout.style.display = 'none';
      modalCheckout.classList.remove('active');
    }
  }
}

function renderizarUpsell() {
  const container = document.getElementById('lista-upsell');
  // Se não tiver o container no HTML ou não tiver bebidas no menu, sai.
  if (!container || !MENU['bebidas']) return;

  container.innerHTML = '';

  MENU['bebidas'].forEach((item) => {
    const div = document.createElement('div');
    div.className = 'upsell-item';
    div.innerHTML = `
            <img src="${item.img}" alt="${item.nome}">
            <div class="upsell-info">
                <h4>${item.nome}</h4>
                <span>Gs ${item.preco.toLocaleString('es-PY')}</span>
                <button onclick="adicionarDoUpsell('${item.id}')">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        `;
    container.appendChild(div);
  });
}

// 2. ADICIONAR ITEM DO UPSELL DIRETO NO CARRINHO
function adicionarDoUpsell(idProduto) {
  // Procura o item na categoria bebidas
  const item = MENU['bebidas'].find((i) => i.id == idProduto);

  if (item) {
    // Verifica se já está no carrinho
    const existente = carrinho.find((c) => c.id === item.id);
    if (existente) {
      existente.qtd++;
    } else {
      carrinho.push({
        ...item,
        qtd: 1,
        obs: '',
        montagem: [],
      });
    }

    // 1. Atualiza os números flutuantes e o Total do sistema
    updateUI();

    // 2. O SEGREDO AQUI: Manda redesenhar a lista dentro do modal instantaneamente
    abrirCheckout();
  }
}

function verificarUltimoPedido() {
  const pedidoSalvo = localStorage.getItem('ultimoPedidoSushiteria');
  const areaRepetir = document.getElementById('area-repetir-pedido');

  // Se existir um pedido salvo e a área do botão existir no HTML
  if (pedidoSalvo && areaRepetir) {
    const carrinhoSalvo = JSON.parse(pedidoSalvo);

    // Só mostra se o carrinho salvo não estiver vazio
    if (carrinhoSalvo.length > 0) {
      areaRepetir.style.display = 'block';
    }
  }
}

// Garante que a verificação rode assim que o site terminar de carregar
document.addEventListener('DOMContentLoaded', verificarUltimoPedido);
