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
    // Usa o novo sistema de tracking (track-order-card)
    // O elemento 'pedido-tracker' é do sistema antigo — redireciona para o novo
    atualizarTrackingVisual(status, null);
    
    const card = document.getElementById('track-order-card');
    if (card) card.style.display = 'block';
    
    const tn = document.getElementById('track-numero');
    if (tn) tn.textContent = uidPedido;
    
    const tf = document.getElementById('track-form');
    const tr = document.getElementById('track-result');
    if (tf) tf.style.display = 'none';
    if (tr) tr.style.display = 'block';

    // Botão confirmar entrega se saiu para entrega
    const pedidoId = localStorage.getItem('sushi_pedido_id');
    if (status === 'saiu_entrega' && pedidoId) {
        const tr2 = document.getElementById('track-result');
        if (tr2 && !document.getElementById('btn-confirmar-entrega')) {
            tr2.insertAdjacentHTML('beforeend', `
                <button id="btn-confirmar-entrega" onclick="confirmarEntregaCliente()" 
                        style="width:100%; margin-top:12px; padding:12px; background:#27ae60; color:white; 
                               border:none; border-radius:8px; font-weight:600; cursor:pointer; font-size:1rem;">
                    ✅ Confirmar Recebimento
                </button>
            `);
        }
        const tempoExpiracao = localStorage.getItem('autoConfirmExpiry_' + pedidoId);
        if (!tempoExpiracao) iniciarTimerAutoConfirmacao(pedidoId);
    }

    if (status === 'entregue') {
        mostrarMensagemEntregaConfirmada();
        if (autoConfirmTimer) clearTimeout(autoConfirmTimer);
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
  // 0=Dom,1=Seg...6=Sab → mapeia para as chaves do objeto
  const diaKeys = ['dom','seg','ter','qua','qui','sex','sab'];
  const diaKey = diaKeys[agora.getDay()];

  function horaParaMin(str) {
    if (!str) return null;
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  }

  function turnoAtivo(turno) {
    const abre = horaParaMin(turno.abre);
    const fecha = horaParaMin(turno.fecha);
    if (abre === null || fecha === null) return false;
    // Suporte a virada de meia-noite (ex: 18:30 às 01:00)
    if (fecha < abre) return horaAtual >= abre || horaAtual < fecha;
    return horaAtual >= abre && horaAtual < fecha;
  }

  // Lógica de Aberto/Fechado usando grade semanal
  let estaAberto = false;
  if (data.loja_aberta) {
    const hs = data.horarios_semanais;
    if (hs && hs[diaKey]) {
      const diaConfig = hs[diaKey];
      if (!diaConfig.fechado && diaConfig.turnos && diaConfig.turnos.length > 0) {
        estaAberto = diaConfig.turnos.some(turnoAtivo);
      }
    } else {
      // Fallback: se não houver grade configurada, usa os campos antigos
      const abre = horaParaMin(data.hora_abertura || '18:00');
      const fecha = horaParaMin(data.hora_fechamento || '23:59');
      if (abre !== null && fecha !== null) {
        if (fecha < abre) estaAberto = horaAtual >= abre || horaAtual < fecha;
        else estaAberto = horaAtual >= abre && horaAtual < fecha;
      }
    }
  }

  const badge = document.querySelector('.badge-status');
  if(badge) {
      // Obtém o idioma atual para traduzir Aberto/Fechado
      const lang = localStorage.getItem('language') || 'es';
      const textos = {
        es: { aberto: 'Abierto', fechado: 'Cerrado' },
        pt: { aberto: 'Aberto', fechado: 'Fechado' },
        en: { aberto: 'Open', fechado: 'Closed' },
        de: { aberto: 'Geöffnet', fechado: 'Geschlossen' }
      };
      const t = textos[lang] || textos.es;
      
      if (estaAberto) {
        badge.innerText = t.aberto;
        badge.classList.remove('closed');
        badge.classList.add('open');
      } else {
        badge.innerText = t.fechado;
        badge.classList.remove('open');
        badge.classList.add('closed');
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

// Renderiza o Menu (Categories + Produtos com subcategorias)
async function renderMenu() {
  const nav = document.getElementById('category-nav');
  const content = document.getElementById('menu-content');
  
  if(!nav || !content) return;

  nav.innerHTML = '';
  content.innerHTML = '';

  // Busca Categorias, Subcategorias e Produtos ativos
  const { data: categsDb } = await supa.from('categorias').select('*').order('ordem');
  let subcatsDb = [];
  try {
    const { data: _subs } = await supa.from('subcategorias').select('*').order('categoria_slug,ordem');
    subcatsDb = _subs || [];
  } catch (_) { subcatsDb = []; }
  const { data: produtos } = await supa.from('produtos').select('*')
      .eq('ativo', true)
      .or('somente_balcao.is.null,somente_balcao.eq.false');

  if (!produtos || !categsDb) {
    console.error('Erro ao carregar menu do banco');
    return;
  }

  const subcats = subcatsDb || [];

  // Monta mapa: categoria_slug -> lista de subcategorias
  const subcatPorCat = {};
  subcats.forEach(s => {
    if (!subcatPorCat[s.categoria_slug]) subcatPorCat[s.categoria_slug] = [];
    subcatPorCat[s.categoria_slug].push(s);
  });

  // Monta mapa: subcategoria_slug -> produtos
  // Monta mapa: categoria_slug -> produtos SEM subcategoria
  const prodPorSubcat = {};
  const prodSemSubcat = {};

  produtos.forEach((p) => {
    const cat = p.categoria_slug;
    const sub = p.subcategoria_slug;
    const item = {
      id: p.id,
      nome: p.nome,
      desc: p.descricao,
      preco: p.preco,
      img: p.imagem_url,
      montagem: p.montagem_config,
      e_montavel: p.e_montavel,
      subcategoria_slug: sub || null,
    };

    if (sub) {
      if (!prodPorSubcat[sub]) prodPorSubcat[sub] = [];
      prodPorSubcat[sub].push(item);
    } else {
      if (!prodSemSubcat[cat]) prodSemSubcat[cat] = [];
      prodSemSubcat[cat].push(item);
    }

    // Mantém MENU global para compatibilidade com outros lugares do código
    if (!MENU[cat]) MENU[cat] = [];
    MENU[cat].push(item);
  });

  // Filtro de horário
  const agora = new Date();
  const minAgora = agora.getHours() * 60 + agora.getMinutes();

  function categoriaVisivel(cat) {
    if (!cat.hora_inicio || !cat.hora_fim) return true;
    const [hI, mI] = cat.hora_inicio.split(':').map(Number);
    const [hF, mF] = cat.hora_fim.split(':').map(Number);
    const inicio = hI * 60 + mI;
    const fim = hF * 60 + mF;
    if (fim < inicio) return minAgora >= inicio || minAgora <= fim;
    return minAgora >= inicio && minAgora <= fim;
  }

  function renderProdutoDiv(item) {
    const img = item.img || 'https://cdn-icons-png.flaticon.com/512/2252/2252075.png';
    const cfg = item.montagem;
    const tipo = (cfg && !Array.isArray(cfg) && cfg.__tipo) ? cfg.__tipo : (item.e_montavel ? 'montavel' : 'padrao');

    let precoLabel = `Gs ${item.preco.toLocaleString('es-PY')}`;
    if (tipo === 'variacoes' && cfg && cfg.variacoes && cfg.variacoes.length > 0) {
      const precos = cfg.variacoes.map(v => v.preco || 0).filter(p => p > 0);
      if (precos.length > 0) {
        const min = Math.min(...precos);
        precoLabel = `<span style="font-size:0.72rem;font-weight:500;opacity:0.7">A partir de</span> Gs ${min.toLocaleString('es-PY')}`;
      }
    }

    const div = document.createElement('div');
    div.className = 'product-item';
    div.onclick = function() { abrirModal(item); };
    div.innerHTML = `
        <div class="prod-info">
            <div class="prod-title">${item.nome}</div>
            <div class="prod-desc">${item.desc || ''}</div>
            <div class="prod-price">${precoLabel}</div>
        </div>
        <img src="${img}" class="prod-img">
    `;
    return div;
  }

  // Constrói o HTML por categoria
  categsDb.forEach((cat) => {
    if (!categoriaVisivel(cat)) return;
    const key = cat.slug;
    const todosOsProdutos = MENU[key];
    if (!todosOsProdutos || todosOsProdutos.length === 0) return;

    // Pill de navegação
    const pill = document.createElement('button');
    pill.className = 'cat-pill';
    pill.innerText = cat.nome_exibicao;
    pill.onclick = () => {
      document.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      document.getElementById(key).scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    nav.appendChild(pill);

    // Seção da categoria
    const section = document.createElement('section');
    section.id = key;
    section.innerHTML = `<h2 class="section-title">${cat.nome_exibicao}</h2>`;

    const subcatsDessaCat = subcatPorCat[key] || [];
    const temSubcats = subcatsDessaCat.length > 0;

    if (!temSubcats) {
      // Sem subcategorias: renderiza tudo direto
      (prodSemSubcat[key] || []).concat(Object.keys(prodPorSubcat)
        .filter(k => subcats.find(s => s.slug === k && s.categoria_slug === key))
        .flatMap(k => prodPorSubcat[k] || [])
      ).forEach(item => section.appendChild(renderProdutoDiv(item)));
    } else {
      // Produtos sem subcategoria (aparecem primeiro, sem título de grupo)
      const semSub = prodSemSubcat[key] || [];
      semSub.forEach(item => section.appendChild(renderProdutoDiv(item)));

      // Grupos por subcategoria
      subcatsDessaCat.forEach(subcat => {
        const itensSub = prodPorSubcat[subcat.slug] || [];
        if (itensSub.length === 0) return; // Oculta subcategoria vazia

        const subtitulo = document.createElement('div');
        subtitulo.className = 'subcat-title';
        subtitulo.innerText = subcat.nome_exibicao;
        section.appendChild(subtitulo);

        itensSub.forEach(item => section.appendChild(renderProdutoDiv(item)));
      });
    }

    content.appendChild(section);
  });
}

// ==========================================
// 5. MODAL DE PRODUTO (multi-builder)
// ==========================================

// Variáveis de estado do modal
let _pizzaConfig = { tamanhoSelecionado: null, bordaSelecionada: false, tipoSelecionado: null, sabores: [] };

function abrirModal(item) {
  prodAtual = item;
  qtd = 1;
  itensMontagem = {};
  _pizzaConfig = { p: null, tamanhoSelecionado: null, numSabores: null, sabores: [], bordaConfig: null };

  document.getElementById('modal-title').innerText = item.nome;
  document.getElementById('modal-desc').innerText = item.desc || '';
  document.getElementById('modal-obs').value = '';
  document.getElementById('modal-qty').innerText = qtd;

  const divOptions = document.getElementById('modal-options');
  const divMontagem = document.getElementById('modal-montagem');
  divOptions.innerHTML = '';
  divMontagem.innerHTML = '';
  divMontagem.style.display = 'none';

  // Detecta tipo do produto
  const cfg = item.montagem; // montagem_config do banco
  let tipo = 'padrao';
  if (cfg && !Array.isArray(cfg) && cfg.__tipo) tipo = cfg.__tipo;
  else if (item.e_montavel || (cfg && Array.isArray(cfg) && cfg.length > 0)) tipo = 'montavel';

  if (tipo === 'montavel') {
    _renderMontavel(item, cfg, divOptions);
  } else if (tipo === 'pizza') {
    _renderPizza(cfg, divOptions);
  } else if (tipo === 'almoco') {
    _renderAlmoco(cfg, divOptions);
  } else if (tipo === 'variacoes') {
    _renderVariacoes(item, cfg, divOptions);
  }

  // Extras (para qualquer tipo)
  const extras = cfg && cfg.extras ? cfg.extras : null;
  if (extras && extras.length > 0) {
    _renderExtras(extras, divOptions);
  }

  // Atualiza preço inicial
  _atualizarPrecoPizza();
  document.getElementById('product-modal').classList.add('active');
}

function _renderMontavel(item, cfg, container) {
  const etapas = Array.isArray(cfg) ? cfg : (cfg && cfg.etapas ? cfg.etapas : []);
  etapas.forEach((etapa, idxEtapa) => {
    const h4 = document.createElement('h4');
    h4.innerText = `${etapa.titulo} (Máx: ${etapa.max})`;
    h4.style.cssText = 'margin-top:10px; font-size:0.95rem; color:#555;';
    container.appendChild(h4);

    etapa.itens.forEach((ingrediente) => {
      const label = document.createElement('label');
      label.style.cssText = 'display:block; padding:7px 10px; margin-bottom:3px; border:1px solid #eee; border-radius:8px; cursor:pointer;';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = ingrediente;
      input.style.marginRight = '8px';
      input.onchange = () => {
        if (!itensMontagem[idxEtapa]) itensMontagem[idxEtapa] = [];
        if (input.checked) {
          if (itensMontagem[idxEtapa].length < etapa.max) {
            itensMontagem[idxEtapa].push(ingrediente);
          } else {
            alert(`Máximo: ${etapa.max} itens para "${etapa.titulo}"`);
            input.checked = false;
          }
        } else {
          const idx = itensMontagem[idxEtapa].indexOf(ingrediente);
          if (idx > -1) itensMontagem[idxEtapa].splice(idx, 1);
        }
      };
      label.appendChild(input);
      label.appendChild(document.createTextNode(ingrediente));
      container.appendChild(label);
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  🍕 PIZZA BUILDER — UX completo (passo a passo)
//  Estado global da pizza:
//  _pizzaConfig = {
//    p:                 cfg.pizza (referência),
//    tamanhoSelecionado: { nome, fatias, cm, preco },
//    numSabores:        1|2|3|4 (escolhido pelo cliente),
//    sabores:           [{ nome, preco }],   // array com sabores escolhidos
//    bordaConfig:       null | { nome, preco }
//  }
// ═══════════════════════════════════════════════════════════

function _renderPizza(cfg, container) {
  if (!cfg || !cfg.pizza) return;
  const p = cfg.pizza;
  _pizzaConfig.p = p;

  /* ── PASSO 1: Tamanho ─────────────────────────────── */
  const secTam = document.createElement('section');
  secTam.className = 'pizza-step';
  secTam.innerHTML = `
    <div class="pizza-step-header">
      <span class="pizza-step-num">1</span>
      <span>Escolha o tamanho</span>
    </div>
    <div class="pizza-size-grid" id="pizza-size-grid"></div>`;
  container.appendChild(secTam);

  const sizeGrid = secTam.querySelector('#pizza-size-grid');
  (p.tamanhos || []).forEach((tam) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'pizza-size-card';
    card.dataset.nome = tam.nome;
    card.innerHTML = `
      <div class="pizza-size-name">${tam.nome}</div>
      <div class="pizza-size-info">${tam.fatias} fatias</div>
      <div class="pizza-size-info">⌀ ${tam.cm}cm</div>
      <div class="pizza-size-price">Gs ${(tam.preco || 0).toLocaleString('es-PY')}</div>`;
    card.onclick = () => {
      sizeGrid.querySelectorAll('.pizza-size-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      _pizzaConfig.tamanhoSelecionado = tam;
      _revelarPasso2(p, container);
      _atualizarPrecoPizza();
    };
    sizeGrid.appendChild(card);
  });

  /* ── Passos 2, 3, 4 aparecerão progressivamente ─── */
  const passo2 = document.createElement('div');
  passo2.id = 'pizza-passo2';
  passo2.style.display = 'none';
  container.appendChild(passo2);

  const passo3 = document.createElement('div');
  passo3.id = 'pizza-passo3';
  passo3.style.display = 'none';
  container.appendChild(passo3);

  const passo4 = document.createElement('div');
  passo4.id = 'pizza-passo4';
  passo4.style.display = 'none';
  container.appendChild(passo4);
}

/* Passo 2: Quantos sabores? */
function _revelarPasso2(p, container) {
  const passo2 = container.querySelector('#pizza-passo2') || document.getElementById('pizza-passo2');
  if (!passo2) return;
  _pizzaConfig.numSabores = null;
  _pizzaConfig.sabores = [];

  const maxLoja = p.max_sabores || 1;
  const opcoes = Array.from({ length: maxLoja }, (_, i) => i + 1);
  const labels = { 1: 'Inteira', 2: 'Meia a Meia', 3: '3 Sabores', 4: '4 Sabores' };

  passo2.innerHTML = `
    <section class="pizza-step">
      <div class="pizza-step-header">
        <span class="pizza-step-num">2</span>
        <span>Quantos sabores?</span>
      </div>
      <div class="pizza-divisao-grid">
        ${opcoes.map((n) => `
          <button type="button" class="pizza-divisao-btn" data-n="${n}" onclick="_selecionarDivisao(${n})">
            <div class="pizza-divisao-icone">${_iconePizza(n)}</div>
            <div class="pizza-divisao-nome">${labels[n] || n + ' Sabores'}</div>
          </button>`).join('')}
      </div>
    </section>`;
  passo2.style.display = 'block';
  // Esconde passos seguintes ao reeditar
  const p3 = container.querySelector('#pizza-passo3') || document.getElementById('pizza-passo3');
  const p4 = container.querySelector('#pizza-passo4') || document.getElementById('pizza-passo4');
  if (p3) { p3.innerHTML = ''; p3.style.display = 'none'; }
  if (p4) { p4.innerHTML = ''; p4.style.display = 'none'; }
}

function _iconePizza(n) {
  const icons = { 1: '🍕', 2: '🍕🍕', 3: '🍕🍕🍕', 4: '🍕🍕🍕🍕' };
  return icons[n] || '🍕';
}

/* Passo 3: Escolher sabores */
function _selecionarDivisao(n) {
  _pizzaConfig.numSabores = n;
  _pizzaConfig.sabores = new Array(n).fill(null);

  // Destaca botão selecionado
  document.querySelectorAll('.pizza-divisao-btn').forEach((b) => {
    b.classList.toggle('selected', parseInt(b.dataset.n) === n);
  });

  const p3 = document.getElementById('pizza-passo3');
  if (!p3) return;
  const p = _pizzaConfig.p;

  // Filtra sabores pelo tipo (Salgada/Doce) se definido
  const saboresFiltrados = (p.sabores || []).filter((s) => !s.tipo || !p.tipos || p.tipos.length <= 1 || true);

  // Gera HTML para escolha de cada slot de sabor
  let html = `<section class="pizza-step">
    <div class="pizza-step-header">
      <span class="pizza-step-num">3</span>
      <span>Escolha ${n === 1 ? 'o sabor' : `os ${n} sabores`}</span>
    </div>
    <p class="pizza-step-hint">
      ${n > 1 ? `Selecione ${n} sabores — um por slot.` : ''}
    </p>`;

  for (let slot = 0; slot < n; slot++) {
    const fracLabel = n === 1 ? '' : `<span class="pizza-fracao-badge">${slot + 1}/${n}</span>`;
    html += `
    <div class="pizza-slot-header">
      ${fracLabel}
      <span class="pizza-slot-label">${n === 1 ? 'Sabor' : `${slot + 1}º sabor`}</span>
    </div>
    <div class="pizza-sabores-lista" id="pizza-slot-${slot}">
      ${saboresFiltrados.map((s) => {
        const sfEsc = (s.nome || '').replace(/'/g, "\\'");
        return `<button type="button" class="pizza-sabor-item" data-slot="${slot}" data-nome="${s.nome}" data-preco="${s.preco || 0}" onclick="_selecionarSaborSlot(${slot}, '${sfEsc}', ${s.preco || 0}, this)">
          ${s.img ? `<img src="${s.img}" class="pizza-sabor-img" alt="${s.nome}">` : `<div class="pizza-sabor-emoji">🍕</div>`}
          <div class="pizza-sabor-info">
            <div class="pizza-sabor-nome">${s.nome}</div>
            ${s.preco ? `<div class="pizza-sabor-preco">Gs ${(s.preco).toLocaleString('es-PY')}</div>` : ''}
          </div>
        </button>`;
      }).join('')}
    </div>`;
  }
  html += `</section>`;

  p3.innerHTML = html;
  p3.style.display = 'block';

  // Borda aparece depois
  const p4 = document.getElementById('pizza-passo4');
  if (p4) { p4.innerHTML = ''; p4.style.display = 'none'; }
  _atualizarPrecoPizza();
}

function _selecionarSaborSlot(slot, nome, preco, el) {
  // Desmarca outros no mesmo slot
  const lista = document.getElementById(`pizza-slot-${slot}`);
  if (lista) lista.querySelectorAll('.pizza-sabor-item').forEach((b) => {
    b.classList.remove('selected');
    b.querySelector('.pizza-fracao-tag')?.remove();
  });

  el.classList.add('selected');
  const n = _pizzaConfig.numSabores || 1;
  // Adiciona tag de fração
  const tag = document.createElement('span');
  tag.className = 'pizza-fracao-tag';
  tag.textContent = n > 1 ? `${slot + 1}/${n}` : '✓';
  el.appendChild(tag);

  _pizzaConfig.sabores[slot] = { nome, preco };

  // Verifica se todos slots preenchidos → mostra borda
  const cheios = _pizzaConfig.sabores.filter(Boolean).length;
  if (cheios >= n) {
    _revelarPasso4Borda();
  }
  _atualizarPrecoPizza();
  _atualizarResumo();
}

/* Passo 4: Borda */
function _revelarPasso4Borda() {
  const p = _pizzaConfig.p;
  const p4 = document.getElementById('pizza-passo4');
  if (!p4) return;

  // Monta opções de borda
  const bordasOpcoes = p.bordas && p.bordas.length > 0
    ? p.bordas
    : p.tem_borda
      ? [{ nome: 'Borda Recheada', preco: p.borda_preco || 0 }]
      : [];

  p4.innerHTML = `<section class="pizza-step">
    <div class="pizza-step-header">
      <span class="pizza-step-num">4</span>
      <span>Borda recheada?</span>
    </div>
    <div class="pizza-opt-row">
      <button type="button" class="pizza-opt-chip selected" id="borda-nao" onclick="_pizzaSelecionarBorda(null)">
        Sem borda
      </button>
      ${bordasOpcoes.map((b) => `
        <button type="button" class="pizza-opt-chip" onclick="_pizzaSelecionarBorda('${b.nome.replace(/'/g,"\\'")}', ${b.preco || 0}, this)">
          🧀 ${b.nome} <span style="font-size:0.75rem;opacity:0.85">+Gs ${(b.preco||0).toLocaleString('es-PY')}</span>
        </button>`).join('')}
    </div>
  </section>`;
  p4.style.display = 'block';
}

function _pizzaSelecionarBorda(nome, preco, el) {
  document.querySelectorAll('#pizza-passo4 .pizza-opt-chip').forEach((c) => c.classList.remove('selected'));
  if (el) el.classList.add('selected');
  else document.getElementById('borda-nao')?.classList.add('selected');
  _pizzaConfig.bordaConfig = nome ? { nome, preco } : null;
  _atualizarPrecoPizza();
  _atualizarResumo();
}

// compatibilidade
function _selecionarBorda(com) { _pizzaSelecionarBorda(com ? 'Borda Recheada' : null, _pizzaConfig.p?.borda_preco || 0, null); }

/* Resumo em tempo real */
function _atualizarResumo() {
  const el = document.getElementById('pizza-resumo');
  if (!el) return;
  const saboresOk = (_pizzaConfig.sabores || []).filter(Boolean);
  if (saboresOk.length === 0) { el.style.display = 'none'; return; }

  // Preço base = tamanho (é sempre o preço principal da pizza)
  // Sabor premium (s.preco > 0) adiciona diferença sobre o tamanho
  const tamPreco = _pizzaConfig.tamanhoSelecionado?.preco || 0;
  const saborExtra = saboresOk.reduce((acc, s) => Math.max(acc, s.preco || 0), 0);
  const precoBase = tamPreco + (saborExtra > 0 ? saborExtra : 0);
  const precoBorda = _pizzaConfig.bordaConfig?.preco || 0;
  const tam = _pizzaConfig.tamanhoSelecionado;

  el.style.display = 'block';
  el.innerHTML = `
    <div class="pizza-resumo-header">🍕 Resumo da sua pizza</div>
    ${tam ? `<div class="pizza-resumo-linha"><span>Tamanho</span><span>${tam.nome} (${tam.fatias} fatias · ⌀${tam.cm}cm)</span></div>` : ''}
    ${saboresOk.map((s, i) => `<div class="pizza-resumo-linha"><span>${_pizzaConfig.numSabores > 1 ? `${i+1}/${_pizzaConfig.numSabores} Sabor` : 'Sabor'}</span><span>${s.nome}</span></div>`).join('')}
    ${_pizzaConfig.bordaConfig ? `<div class="pizza-resumo-linha"><span>Borda</span><span>${_pizzaConfig.bordaConfig.nome}</span></div>` : ''}
    <div class="pizza-resumo-total"><span>Total</span><span>Gs ${((precoBase + precoBorda) * (qtd || 1)).toLocaleString('es-PY')}</span></div>`;
}

function _atualizarPrecoPizza() {
  const cfg = prodAtual?.montagem;

  // Sempre soma extras (válido para qualquer tipo de produto)
  let extrasTotal = 0;
  document.querySelectorAll('.extra-check-input:checked').forEach((cb) => {
    extrasTotal += parseInt(cb.dataset.preco || 0);
  });

  // Tipo variações: preço controlado pelo click na variação
  const tipo = (cfg && !Array.isArray(cfg) && cfg.__tipo) ? cfg.__tipo : 'padrao';
  if (tipo === 'variacoes') {
    const base = _variacaoSelecionada ? (_variacaoSelecionada.preco || 0) : (prodAtual?.preco || 0);
    const total = (base + extrasTotal) * qtd;
    document.getElementById('modal-price').innerText = `Gs ${total.toLocaleString('es-PY')}`;
    _atualizarResumo();
    return;
  }

  if (!cfg || !cfg.pizza) {
    const base = (prodAtual?.preco || 0);
    const total = (base + extrasTotal) * qtd;
    document.getElementById('modal-price').innerText = `Gs ${total.toLocaleString('es-PY')}`;
    _atualizarResumo();
    return;
  }
  const saboresOk = (_pizzaConfig.sabores || []).filter(Boolean);
  const tamPreco = _pizzaConfig.tamanhoSelecionado?.preco || prodAtual.preco || 0;
  const saborExtra = saboresOk.reduce((acc, s) => Math.max(acc, s.preco || 0), 0);
  const precoBase = tamPreco + (saborExtra > 0 ? saborExtra : 0);
  const precoBorda = _pizzaConfig.bordaConfig?.preco || 0;
  const total = (precoBase + precoBorda + extrasTotal) * qtd;
  document.getElementById('modal-price').innerText = `Gs ${total.toLocaleString('es-PY')}`;
  _atualizarResumo();
}

// ─── VARIAÇÕES DE SABOR ───────────────────────────────────
let _variacaoSelecionada = null; // { nome, preco, img }

function _renderVariacoes(item, cfg, container) {
  _variacaoSelecionada = null;
  const variacoes = cfg && cfg.variacoes ? cfg.variacoes : [];

  if (variacoes.length === 0) return;

  const sec = document.createElement('div');
  sec.className = 'var-section';
  sec.innerHTML = `<div class="var-label">Escolha o sabor</div><div class="var-grid" id="var-grid"></div>`;
  container.appendChild(sec);

  const grid = sec.querySelector('#var-grid');
  variacoes.forEach((v) => {
    const card = document.createElement('div');
    card.className = 'var-card';
    const imgSrc = v.img || item.img || 'https://cdn-icons-png.flaticon.com/512/2252/2252075.png';
    card.innerHTML = `
      <img src="${imgSrc}" class="var-card-img" onerror="this.src='https://cdn-icons-png.flaticon.com/512/2252/2252075.png'">
      <div class="var-card-body">
        <div class="var-card-nome">${v.nome}</div>
        <div class="var-card-preco">Gs ${(v.preco || 0).toLocaleString('es-PY')}</div>
      </div>
      <div class="var-card-check">✓</div>
    `;
    card.dataset.preco = v.preco || 0;
    card.onclick = () => {
      grid.querySelectorAll('.var-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      _variacaoSelecionada = v;
      // Atualiza preço e imagem do modal
      document.getElementById('modal-price').innerText = `Gs ${((v.preco || 0) * qtd).toLocaleString('es-PY')}`;
      // Atualiza imagem do modal se a variação tiver foto própria
      const modalImg = document.querySelector('.modal-img') || document.getElementById('modal-img');
      if (modalImg && v.img) modalImg.src = v.img;
    };
    grid.appendChild(card);
  });
}

function _renderAlmoco(cfg, container) {
  if (!cfg || !cfg.almoco || !cfg.almoco.pratos) return;
  const pratos = cfg.almoco.pratos;

  const sec = document.createElement('div');
  sec.innerHTML = `<div class="sabor-slot-label">Escolha o prato</div><div class="almoco-pratos-grid" id="almoco-pratos-grid"></div>`;
  container.appendChild(sec);

  const grid = sec.querySelector('#almoco-pratos-grid');
  pratos.forEach((prato) => {
    const card = document.createElement('div');
    card.className = 'almoco-prato-option';
    card.innerHTML = `
      <img src="${prato.img || 'https://via.placeholder.com/160x110?text=Prato'}" alt="${prato.nome}">
      <div class="prato-info">
        <div class="prato-nome">${prato.nome}</div>
        <div class="prato-desc">${prato.desc || ''}</div>
        <div class="prato-preco">Gs ${(prato.preco || 0).toLocaleString('es-PY')}</div>
      </div>`;
    card.onclick = () => {
      grid.querySelectorAll('.almoco-prato-option').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      prodAtual._pratoselecionado = prato;
      // Atualiza preço
      const preco = prato.preco || prodAtual.preco || 0;
      document.getElementById('modal-price').innerText = `Gs ${(preco * qtd).toLocaleString('es-PY')}`;
    };
    grid.appendChild(card);
  });
}

function _renderExtras(extras, container) {
  const sec = document.createElement('div');
  sec.className = 'extras-section';
  sec.innerHTML = `<h5>➕ Adicionais (opcional)</h5>`;
  extras.forEach((ex) => {
    const row = document.createElement('label');
    row.className = 'extra-check-row';
    row.innerHTML = `
      <input type="checkbox" class="extra-check-input" data-preco="${ex.preco}" onchange="_atualizarPrecoPizza()">
      <span class="extra-check-label">${ex.nome}</span>
      <span class="extra-check-price">+Gs ${(ex.preco || 0).toLocaleString('es-PY')}</span>`;
    sec.appendChild(row);
  });
  container.appendChild(sec);
}

function fecharModalProduto() {
  document.getElementById('product-modal').classList.remove('active');
}

function mudarQtd(delta) {
  qtd = Math.max(1, qtd + delta);
  document.getElementById('modal-qty').innerText = qtd;
  _atualizarPrecoPizza();
}

function adicionarDoModal() {
  if (!prodAtual) return;

  const cfg = prodAtual.montagem;
  let tipo = 'padrao';
  if (cfg && !Array.isArray(cfg) && cfg.__tipo) tipo = cfg.__tipo;
  else if (prodAtual.e_montavel || (cfg && Array.isArray(cfg) && cfg.length > 0)) tipo = 'montavel';

  // Validações por tipo
  if (tipo === 'pizza') {
    if (!_pizzaConfig.tamanhoSelecionado) { alert('Selecione o tamanho da pizza!'); return; }
    const saboresOk = (_pizzaConfig.sabores || []).filter(Boolean);
    if (saboresOk.length === 0) { alert('Selecione ao menos 1 sabor!'); return; }
    if (_pizzaConfig.numSabores && saboresOk.length < _pizzaConfig.numSabores) {
      alert(`Você escolheu ${_pizzaConfig.numSabores} sabores mas selecionou apenas ${saboresOk.length}. Complete a seleção!`); return;
    }
  }
  if (tipo === 'almoco' && !prodAtual._pratoselecionado) {
    alert('Selecione o prato!'); return;
  }
  if (tipo === 'variacoes' && !_variacaoSelecionada) {
    alert('Escolha o sabor antes de adicionar!'); return;
  }

  // Monta descrição para o carrinho
  let montagem = [];
  let variacao = '';
  let precoFinal = prodAtual.preco;

  if (tipo === 'montavel') {
    for (let k in itensMontagem) montagem = montagem.concat(itensMontagem[k]);
  }

  if (tipo === 'pizza') {
    // ─────────────────────────────────────────────────────────────
    // PREÇO PIZZA:
    //   Base    = tamanho selecionado (sempre — é o preço principal)
    //   Extra   = maior preco individual dos sabores (0 se não há premium)
    //   Borda   = preco da borda escolhida (0 se sem borda)
    //   Total   = (Base + Extra) * qtd + Borda * qtd
    // ─────────────────────────────────────────────────────────────
    const saboresOk = (_pizzaConfig.sabores || []).filter(Boolean);
    const tamPreco    = _pizzaConfig.tamanhoSelecionado?.preco || 0;   // SEMPRE a base
    const saborExtra  = saboresOk.reduce((acc, s) => Math.max(acc, s.preco || 0), 0); // premium opcional
    const precoBorda  = _pizzaConfig.bordaConfig?.preco || 0;
    precoFinal = tamPreco + saborExtra + precoBorda;

    variacao  = _pizzaConfig.tamanhoSelecionado?.nome || '';
    const numSab = _pizzaConfig.numSabores || 1;
    const saboresStr = saboresOk
      .map((s, i) => numSab > 1 ? `${i+1}/${numSab} ${s.nome}` : s.nome)
      .join(' | ');

    // montagem: string legível para exibição no carrinho/cozinha
    montagem = [saboresStr].filter(Boolean);
    if (_pizzaConfig.bordaConfig) montagem.push(`Borda: ${_pizzaConfig.bordaConfig.nome}`);
  }

  if (tipo === 'almoco' && prodAtual._pratoselecionado) {
    const prato = prodAtual._pratoselecionado;
    variacao = prato.nome;
    precoFinal = prato.preco || prodAtual.preco;
    montagem = [prato.desc || ''];
  }

  if (tipo === 'variacoes' && _variacaoSelecionada) {
    variacao = _variacaoSelecionada.nome;
    precoFinal = _variacaoSelecionada.preco || prodAtual.preco;
    // Usa imagem da variação se disponível
    if (_variacaoSelecionada.img) prodAtual._variacaoImg = _variacaoSelecionada.img;
  }

  // Extras selecionados
  const extrasEscolhidos = [];
  document.querySelectorAll('.extra-check-input:checked').forEach((cb) => {
    const nome = cb.closest('.extra-check-row').querySelector('.extra-check-label').textContent;
    const preco = parseInt(cb.dataset.preco || 0);
    extrasEscolhidos.push({ nome, preco });
    precoFinal += preco;
  });
  if (extrasEscolhidos.length > 0) {
    montagem.push('Extras: ' + extrasEscolhidos.map((e) => e.nome).join(', '));
  }

  // Captura metadados da pizza ANTES de resetar _pizzaConfig
  const pizzaMeta = tipo === 'pizza' ? {
    tamanho: _pizzaConfig.tamanhoSelecionado?.nome   || '',
    sabores: (_pizzaConfig.sabores || []).filter(Boolean).map((s) => s.nome),
    borda:   _pizzaConfig.bordaConfig?.nome          || null,
  } : null;

  carrinho.push({
    id:       Date.now(),
    nome:     prodAtual.nome + (variacao ? ` (${variacao})` : ''),
    preco:    precoFinal,
    qtd:      qtd,
    montagem: montagem.filter(Boolean),
    obs:      document.getElementById('modal-obs').value,
    img:      prodAtual._variacaoImg || prodAtual.img,
    // Metadados estruturados — úteis para exibir no resumo e na cozinha
    ...(pizzaMeta ? { pizzaMeta } : {}),
  });

  // Limpa estado após push
  _pizzaConfig = { p: null, tamanhoSelecionado: null, numSabores: null, sabores: [], bordaConfig: null };
  _variacaoSelecionada = null;
  if (prodAtual) prodAtual._variacaoImg = null;

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

  // ── Atualiza sidebar desktop ──────────────────────────────
  const desktopItems    = document.getElementById('desktop-cart-items');
  const desktopEmpty    = document.getElementById('desktop-cart-empty');
  const desktopTotalRow = document.getElementById('desktop-cart-total-row');
  const desktopTotalVal = document.getElementById('desktop-cart-total-val');
  const desktopBtn      = document.getElementById('desktop-cart-btn');

  if (desktopItems) {
    desktopItems.innerHTML = '';
    if (carrinho.length === 0) {
      if (desktopEmpty)    desktopEmpty.style.display    = 'block';
      if (desktopTotalRow) desktopTotalRow.style.display = 'none';
      if (desktopBtn)      desktopBtn.disabled = true;
    } else {
      if (desktopEmpty)    desktopEmpty.style.display    = 'none';
      if (desktopTotalRow) desktopTotalRow.style.display = 'flex';
      if (desktopBtn)      desktopBtn.disabled = false;

      carrinho.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'desktop-cart-item';
        div.innerHTML = `
          <span class="desktop-cart-item-name">${item.qtd}x ${item.nome}</span>
          <span class="desktop-cart-item-price">Gs ${(item.preco * item.qtd).toLocaleString('es-PY')}</span>`;
        desktopItems.appendChild(div);
      });

      if (desktopTotalVal)
        desktopTotalVal.innerText = `Gs ${totalDinheiro.toLocaleString('es-PY')}`;
    }
  }

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
    // Pizza: exibe tamanho/sabores/borda de forma estruturada quando disponível
    let detalhes = '';
    if (item.pizzaMeta) {
      const m = item.pizzaMeta;
      const partes = [];
      if (m.tamanho) partes.push(`📐 ${m.tamanho}`);
      if (m.sabores && m.sabores.length > 0) partes.push(`🍕 ${m.sabores.join(' / ')}`);
      if (m.borda) partes.push(`🧀 ${m.borda}`);
      detalhes = `<br><small style="color:#888">${partes.join(' · ')}</small>`;
    } else if (item.montagem && item.montagem.length > 0) {
      detalhes = `<br><small style="color:#888">${item.montagem.join(', ')}</small>`;
    }
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
    // Calcula valor em BRL baseado no total atual
    const totalItens = carrinho.reduce((a, i) => a + i.preco * i.qtd, 0);
    let freteAplicado = modoEntrega === 'delivery' ? freteCalculado : 0;
    let desconto = 0;
    if (cupomAplicado) {
      if (cupomAplicado.tipo === 'percentual') desconto = Math.round(totalItens * (cupomAplicado.valor / 100));
      else if (cupomAplicado.tipo === 'frete') freteAplicado = 0;
    }
    const totalGs = totalItens - desconto + freteAplicado;
    const totalBrl = COTACAO_REAL > 0 ? (totalGs / COTACAO_REAL).toFixed(2) : '---';
    infoDiv.innerHTML = `<strong>💳 Chave Pix:</strong><br>${CHAVE_PIX}<br><small>Titular: ${NOME_PIX}</small><br><strong style="color:#c0392b;font-size:1rem">💰 Valor a pagar: R$ ${totalBrl}</strong><br><small style="color:#888">(Gs ${totalGs.toLocaleString('es-PY')} ÷ ${COTACAO_REAL})</small>`;
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

      // Incrementa contador de usos do cupom
      if (cupomAplicado?.id) {
        const novosUsos = (cupomAplicado.usos_realizados || 0) + 1;
        await supa.from('cupons')
          .update({ usos_realizados: novosUsos })
          .eq('id', cupomAplicado.id);
      }
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
      if(pag === 'Pix') {
          const totalBrl = COTACAO_REAL > 0 ? (totalGeral / COTACAO_REAL).toFixed(2) : '---';
          msg += `\n💠 Chave Pix: ${CHAVE_PIX}\n`;
          msg += `💰 Valor em Reais: R$ ${totalBrl} (Gs ${totalGeral.toLocaleString('es-PY')} ÷ ${COTACAO_REAL})\n`;
      }
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

// [Sistema legado mostrarTracker removido — usando versão track-order-card em L161]

function fecharTracker() {
    // Fecha tanto o tracker antigo quanto o novo card
    const tracker = document.getElementById('pedido-tracker');
    if (tracker) tracker.style.display = 'none';
    const card = document.getElementById('track-order-card');
    if (card) card.style.display = 'none';
    if (_trackingChannel) {
        _trackingChannel.unsubscribe();
        _trackingChannel = null;
    }
    if (_pollingTracker) {
        clearInterval(_pollingTracker);
        _pollingTracker = null;
    }
}

// Alias para o botão × do card de tracking no index.html
function fecharCardTracking() {
    fecharTracker();
}

// Restaura tracking ao recarregar a página
function restaurarTrackingSeExistir() {
    // Card de rastreio oculto por padrão - só aparece se houver pedido ativo
    const card = document.getElementById('track-order-card');
    if (card) card.style.display = 'none';

    const savedId  = localStorage.getItem('sushi_pedido_id');
    const savedUid = localStorage.getItem('sushi_pedido_uid');
    if (!savedId) return;

    console.log('🔄 Restaurando tracking para pedido:', savedId);
    if (typeof supa === 'undefined') return;

    supa.from('pedidos').select('status, motoboy_id, created_at').eq('id', savedId).single()
        .then(async ({ data, error }) => {
            if (error || !data) return;
            // Se já foi entregue ou cancelado, limpa e não mostra tracker
            if (data.status === 'entregue' || data.status === 'cancelado') {
                try { localStorage.removeItem('sushi_pedido_id'); localStorage.removeItem('sushi_pedido_uid'); } catch(e) {}
                return;
            }

            // REGRA 6H: tracker só aparece se o pedido tem menos de 6 horas
            if (data.created_at) {
                const diffHoras = (Date.now() - new Date(data.created_at).getTime()) / 3600000;
                if (diffHoras > 6) {
                    try { localStorage.removeItem('sushi_pedido_id'); localStorage.removeItem('sushi_pedido_uid'); } catch(e) {}
                    return;
                }
            }

            // Só mostra o card se houver pedido ativo
            if (card) card.style.display = 'block';

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

    // Verifica validade
    if (cupom.validade) {
        const vDate = new Date(cupom.validade + 'T23:59:59');
        if (vDate < new Date()) {
            msgBox.innerHTML = '<span style="color:#e74c3c">❌ Cupom expirado</span>';
            msgBox.style.display = 'block';
            cupomAplicado = null;
            atualizarTotalCheckout();
            return;
        }
    }

    // Verifica limite de usos
    if (cupom.limite_uso && cupom.limite_uso > 0) {
        const usados = cupom.usos_realizados || 0;
        if (usados >= cupom.limite_uso) {
            msgBox.innerHTML = `<span style="color:#e74c3c">❌ Este cupom atingiu o limite de ${cupom.limite_uso} usos</span>`;
            msgBox.style.display = 'block';
            cupomAplicado = null;
            atualizarTotalCheckout();
            return;
        }
    }
    
    const subtotal = carrinho.reduce((a, i) => a + i.preco * i.qtd, 0);
    if (subtotal < cupom.minimo) {
        msgBox.innerHTML = `<span style="color:#e74c3c">Valor mínimo: Gs ${cupom.minimo.toLocaleString('es-PY')}</span>`;
        msgBox.style.display = 'block';
        cupomAplicado = null;
    } else {
        cupomAplicado = cupom;
        const restante = cupom.limite_uso
            ? ` (${cupom.limite_uso - (cupom.usos_realizados || 0)} restantes)`
            : '';
        msgBox.innerHTML = `<span style="color:#27ae60">✅ Cupom aplicado!${restante}</span>`;
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

    // Botão confirmar recebimento — aparece ao sair para entrega, some nos outros status
    const _trackResult = document.getElementById('track-result');
    const _btnConfirmar = document.getElementById('btn-confirmar-entrega');
    if (status === 'saiu_entrega') {
        if (_trackResult && !_btnConfirmar) {
            const _btn = document.createElement('button');
            _btn.id = 'btn-confirmar-entrega';
            _btn.onclick = confirmarEntregaCliente;
            _btn.style.cssText = 'width:100%;margin-top:14px;padding:14px 0;background:linear-gradient(135deg,#27ae60,#2ecc71);color:white;border:none;border-radius:12px;font-weight:700;font-size:1rem;cursor:pointer;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(39,174,96,0.35)';
            _btn.innerHTML = '✅ Confirmar Recebimento do Pedido';
            _trackResult.appendChild(_btn);
        }
        // Inicia timer auto-confirm se ainda não iniciado
        const _pedidoLocal = localStorage.getItem('sushi_pedido_id');
        if (_pedidoLocal && typeof iniciarTimerAutoConfirmacao === 'function') {
            if (!localStorage.getItem('autoConfirmExpiry_' + _pedidoLocal)) {
                iniciarTimerAutoConfirmacao(_pedidoLocal);
            }
        }
    } else if (_btnConfirmar) {
        _btnConfirmar.remove();
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

let saboresSelecionados = []; // Array global para guardar a pizza atual

// Função auxiliar para calcular preço da pizza
function calcularTotalPizza() {
    if (saboresSelecionados.length === 0) return 0;

    // 1. Encontra o sabor mais caro (REGRA DE OURO)
    let maiorPreco = 0;
    saboresSelecionados.forEach(sabor => {
        if (sabor.preco > maiorPreco) maiorPreco = sabor.preco;
    });

    // 2. Verifica se tem borda
    const bordaPreco = produtoAtual.bordaSelecionada ? produtoAtual.bordaSelecionada.preco : 0;

    // 3. Atualiza botão
    const total = maiorPreco + bordaPreco;
    document.getElementById('btn-add-carrinho').innerText = 
        `Adicionar Gs ${total.toLocaleString('es-PY')}`;
        
    return total;
}

// Função para adicionar sabor (deve ser ligada aos checkboxes/cards da UI)
function toggleSaborPizza(saborObj, maxSabores) {
    const index = saboresSelecionados.findIndex(s => s.id === saborObj.id);

    if (index > -1) {
        // Se já tá, remove
        saboresSelecionados.splice(index, 1);
    } else {
        // Se não tá, verifica limite (1/2, 1/3, 1/4)
        if (saboresSelecionados.length < maxSabores) {
            saboresSelecionados.push(saborObj);
        } else {
            alert(`Você escolheu uma pizza de ${maxSabores} sabores. Remova um para trocar.`);
            return;
        }
    }
    
    // Recalcula visual
    renderizarSaboresSelecionados(); // Função que pinta a pizza
    calcularTotalPizza();
}