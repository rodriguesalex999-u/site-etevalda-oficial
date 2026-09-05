// ========================================
// GRUPO ETEVALDA MT - VERSÃO FUNCIONAL
// ========================================

// 1. CONFIGURAÇÃO DO SUPABASE
const SUPABASE_URL = 'https://vnrfmsyanrvqqhmqyixk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xGLDFQarl-DhshRW0932FQ_asug0TUK';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1.1 CONFIGURAÇÃO DO FACEBOOK PIXEL & CONVERSIONS API
const FB_PIXEL_ID = '1002683195582228';

// Função para gerar event_id único para desduplicação
function generateEventId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Função para coletar dados do usuário para a Conversions API
function collectUserData() {
    const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    };

    return {
        em: null,
        ph: null,
        fn: null,
        ln: null,
        ct: detectedLocation?.city || null,
        st: detectedState || null,
        zp: null,
        client_ip_address: null,
        client_user_agent: navigator.userAgent,
        fbc: getCookie('_fbc'),
        fbp: getCookie('_fbp')
    };
}

// Função para enviar evento para a Conversions API (servidor)
async function sendToConversionsAPI(eventName, customData, userData = null, eventId = null) {
    const eventIdFinal = eventId || generateEventId();
    const userDataFinal = userData || collectUserData();

    try {
        const response = await fetch('/api/facebook-conversions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_name: eventName,
                event_id: eventIdFinal,
                event_time: Math.floor(Date.now() / 1000),
                user_data: userDataFinal,
                custom_data: customData,
                action_source: 'website'
            })
        });

        if (response.ok) {
            console.log(`✅ Conversions API: ${eventName} enviado com event_id ${eventIdFinal}`);
            return eventIdFinal;
        } else {
            console.error(`❌ Erro Conversions API: ${eventName}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Erro ao enviar para Conversions API: ${eventName}`, error);
        return null;
    }
}

// Função unificada de rastreamento com desduplicação
function trackEvent(eventName, customData, userData = null) {
    const eventId = generateEventId();

    // 1. Envia via Pixel (navegador)
    if (typeof fbq !== 'undefined') {
        fbq('track', eventName, customData, { eventID: eventId });
        console.log(`📊 Pixel: ${eventName} com event_id ${eventId}`);
    }

    // 2. Envia via Conversions API (servidor) - assíncrono com o MESMO event_id
    sendToConversionsAPI(eventName, customData, userData, eventId);

    return eventId;
}

// 2. ESTADO DA APLICAÇÃO
let products = [];
let categories = [];
let cart = [];
let currentCategory = 'all';
let searchQuery = '';
let secondarySectionsLoaded = false;
let allProductsCache = [];  // sempre contém TODOS os produtos, independente da categoria ativa
let allProductsLoaded = [];
let faqs = [];
let socialProofImages = [];
let reviews = [];
let siteSettings = { reviews_title: 'O que nossos clientes dizem' };
let teamCarouselData = [];
let teamCarouselIndex = 0;
let teamCarouselAutoInterval = null;
let secCardObserver = null;
let deliveryTimerInterval = null;
let viewerIncrementTimeout = null;
let currentZoomIndex = 0;
let superZoomMediaList = [];
let currentModalProduct = null;
let currentMediaList = [];
let currentMediaIndex = 0;
let complementShownIds = [];
let isLoadingMoreComplement = false;

// Observer reutilizavel para animacao de entrada de cards
// Loop RAF compartilhado para animacoes de preco — evita multiplos RAFs concorrentes
const _activePriceAnims = new Map();
let _priceAnimFrameId = null;

function _tickPriceAnims(timestamp) {
    let hasActive = false;
    _activePriceAnims.forEach((anim, el) => {
        const prog = Math.min(1, (timestamp - anim.start) / anim.duration);
        const eased = 1 - Math.pow(1 - prog, 3);
        el.textContent = (anim.target * eased).toFixed(2).replace('.', ',');
        if (prog < 1) {
            hasActive = true;
        } else {
            _activePriceAnims.delete(el);
        }
    });
    if (hasActive) {
        _priceAnimFrameId = requestAnimationFrame(_tickPriceAnims);
    } else {
        _priceAnimFrameId = null;
    }
}

function _startPriceAnim(numEl, targetPrice) {
    numEl.textContent = '0,00';
    _activePriceAnims.set(numEl, {
        start: performance.now(),
        duration: 700,
        target: targetPrice
    });
    if (!_priceAnimFrameId) {
        _priceAnimFrameId = requestAnimationFrame(_tickPriceAnims);
    }
}

const _cardAnimObserver = window.IntersectionObserver ? new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('card-visible');
            const priceEl = e.target.querySelector('.price-now');
            if (priceEl) {
                const _target = parseFloat(priceEl.dataset.target);
                const numEl = priceEl.querySelector('.num');
                if (numEl && !isNaN(_target)) {
                    _startPriceAnim(numEl, _target);
                }
            }
            _cardAnimObserver.unobserve(e.target);
        }
    });
}, { threshold: 0.08, rootMargin: '0px 0px 100px 0px' }) : null;
let productViewers = {};
let viewerOpenCount = 0;

// Dicionários para notificações geo-localizadas
const NEIGHBORHOODS = {
    'Cuiabá': ['Dom Aquino', 'Pedra 90', 'CPA 2', 'Coophamil', 'Cristo Rei', 'Tijucal', 'Osmar Cabral', 'Jardim Leblon', 'Dr Fábio', 'Bosque da Saúde', 'Verdão'],
    'Rondonópolis': ['Vila Aurora', 'Cidade Alta', 'Jardim Atlântico', 'Parque Universitário', 'Santa Cruz', 'Jardim Ipanema', 'Jardim Tropical'],
    'Sinop': ['Setor Comercial', 'Jardim Jacarandás', 'Jardim Primaveras', 'Jardim das Palmeiras', 'Jardim Imperial', 'Jardim Itália', 'Jardim Umuarama'],
    'Várzea Grande': ['Centro', 'Jardim América', 'Morada do Ouro', 'Santa Izabel', 'Planalto', 'São Simão', 'Cristo Rei', 'Alameda', 'Ipase', 'Marechal Rondon', 'Vila Arthur'],
    'Barra do Bugres': ['Centro', 'Setor Sul', 'Vila Operária', 'São João', 'Cohab'],
    'Diamantino': ['Centro', 'Bairro Novo', 'São João', 'Lagoa Azul'],
    'Tangará da Serra': ['Centro', 'Jardim Europa', 'Vila Horizonte', 'Cidade Alta'],
    'Primavera do Leste': ['Centro', 'Parque Vera Cruz', 'Jardim Primavera', 'Vila Nova']
};

const CUSTOMER_NAMES = ['Ana', 'Maria', 'João', 'Pedro', 'Carla', 'Lucas', 'Fernanda', 'Carlos'];
let detectedLocation = { city: 'Cuiabá', neighborhoods: NEIGHBORHOODS['Cuiabá'] };
let detectedState = 'MT';
// Retorna cidade conhecida com alta confiança: 1º localStorage, 2º IP detection
function _getKnownCity() {
    const saved = localStorage.getItem('user_city');
    if (saved && NEIGHBORHOODS[saved]) return saved;
    const detected = window.detectedCitySuggestion;
    if (detected && NEIGHBORHOODS[detected]) return detected;
    return null;
}

// Helper: detecta se uma URL é de vídeo
function isVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase().trim();
    // Extensões de vídeo diretas
    if (/\.(mp4|webm|mov|avi|mkv|m4v|3gp|ogv)(\?|$)/i.test(lower)) return true;
    // YouTube (watch, youtu.be, shorts, embed)
    if (/youtu(\.be\/|be\.com\/|\.com\/)/i.test(lower)) return true;
    // Vimeo
    if (/vimeo\.com\//i.test(lower)) return true;
    // Instagram Reels
    if (/instagram\.com\/reel/i.test(lower)) return true;
    // TikTok
    if (/tiktok\.com\//i.test(lower)) return true;
    // Cloudinary com tipo de recurso video
    if (/res\.cloudinary\.com\/.*\/video\//i.test(lower)) return true;
    return false;
}

// Helper: verifica se é vídeo de plataforma externa (YouTube, Vimeo, etc.) que precisa de iframe
function isExternalVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase().trim();
    // YouTube (watch, youtu.be, shorts, embed)
    if (/youtu(\.be\/|be\.com\/|\.com\/)/i.test(lower)) return true;
    // Vimeo
    if (/vimeo\.com\//i.test(lower)) return true;
    // Instagram Reels
    if (/instagram\.com\/reel/i.test(lower)) return true;
    // TikTok
    if (/tiktok\.com\//i.test(lower)) return true;
    return false;
}

// Helper: converte URL de vídeo externo para URL de embed
function getVideoEmbedUrl(url) {
    if (!url || typeof url !== 'string') return url;
    const lower = url.toLowerCase().trim();

    // YouTube: todas as variantes (watch, youtu.be, shorts, embed)
    // youtu.be/ID
    let ytMatch = lower.match(/youtu\.be\/([^&?/]+)/i);
    // youtube.com/watch?v=ID
    if (!ytMatch) ytMatch = lower.match(/youtube\.com\/watch\?v=([^&]+)/i);
    // youtube.com/shorts/ID
    if (!ytMatch) ytMatch = lower.match(/youtube\.com\/shorts\/([^&?/]+)/i);
    // youtube.com/embed/ID
    if (!ytMatch) ytMatch = lower.match(/youtube\.com\/embed\/([^&?/]+)/i);

    if (ytMatch) {
        const videoId = ytMatch[1];
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`;
    }

    // Vimeo: https://vimeo.com/ID
    const vimeoMatch = lower.match(/vimeo\.com\/(\d+)/i);
    if (vimeoMatch) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1&loop=1`;
    }

    // Instagram Reels - retorna URL original (iframe funciona diretamente)
    if (/instagram\.com\/reel/i.test(lower)) {
        return url;
    }

    // TikTok - retorna URL original (iframe funciona diretamente)
    if (/tiktok\.com\//i.test(lower)) {
        return url;
    }

    return url;
}

// Helper: renderiza mídia de vídeo corretamente (iframe para plataformas externas, video tag para direto)
function renderVideoMedia(url, autoplay = true, muted = true, loop = true, playsinline = true) {
    if (isExternalVideoUrl(url)) {
        const embedUrl = getVideoEmbedUrl(url);
        const allowAttrs = autoplay ? 'autoplay; encrypted-media; picture-in-picture' : 'encrypted-media; picture-in-picture';
        return `<iframe src="${embedUrl}" frameborder="0" allow="${allowAttrs}" allowfullscreen style="width:100%;height:100%;position:absolute;top:0;left:0;"></iframe>`;
    }
    const attrs = [
        autoplay ? 'autoplay' : '',
        muted ? 'muted' : '',
        loop ? 'loop' : '',
        playsinline ? 'playsinline' : ''
    ].filter(Boolean).join(' ');
    return `<video src="${url}" ${attrs}></video>`;
}

// 3. FUNÇÕES DE CARREGAMENTO
// Inicializar listener do popstate uma vez no carregamento da página
document.addEventListener('DOMContentLoaded', () => {
    // Ancora um estado base para que o primeiro 'voltar' nunca saia do site imediatamente
    window.history.replaceState({ page: 'site' }, '', window.location.href);
    window.addEventListener('popstate', handleMobileBack);
});

async function loadProducts(reset = false) {
    if (reset) {
        allProductsLoaded = [];
    }

    try {
        console.log('🔍 Buscando produtos...');
        let query = _supabase.from('products').select('*');

        if (currentCategory !== 'all') {
            query = query.eq('category_id', currentCategory);
        }

        const { data, error } = await query;
        if (error) throw error;

        console.log('📦 Dados recebidos:', data);

        if (data && data.length > 0) {
            const filteredData = data;

            if (!searchQuery) {
                for (let i = filteredData.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [filteredData[i], filteredData[j]] = [filteredData[j], filteredData[i]];
                }
            }

            allProductsLoaded = reset ? filteredData : [...allProductsLoaded, ...filteredData];

            if (currentCategory === 'all' && reset) {
                allProductsCache = [...filteredData];
            }
            
            console.log('✅ Produtos carregados:', allProductsLoaded.length);
        } else {
            console.log('⚠️ Nenhum produto encontrado');
        }

        renderProducts();

    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
    }
}

async function loadCategories() {
    const { data } = await _supabase.from('categories').select('*').order('id');
    categories = data || [];
    renderCategoryBar();
    renderMegaMenu();
}

// ========================================
// MEGA MENU - Categorias do Supabase no dropdown do logo
// ========================================
function renderMegaMenu() {
    const container = document.getElementById('megaMenuContent');
    if (!container) return;

    let html = '<div class="mega-menu-category"><h4>Categorias</h4>';
    categories.forEach(cat => {
        const slug = slugifyCategory(cat.name);
        html += `<a data-category="${cat.id}" data-slug="${slug}" onclick="selectMegaCategory('${cat.id}','${slug}')">${cat.name}</a>`;
    });
    html += '</div>';
    html += '<div class="mega-menu-footer"><a onclick="selectMegaCategory(\'all\',\'all\')">Ver todos os produtos <i class="fas fa-arrow-right"></i></a></div>';

    container.innerHTML = html;
}

function selectMegaCategory(categoryId, slug) {
    const bar = document.getElementById('categoryBar');
    const target = bar ? bar.querySelector(`[data-category="${categoryId}"]`) : null;
    if (target) {
        target.click();
    } else if (categoryId === 'all') {
        currentCategory = 'all';
        window.location.hash = '';
        loadProducts(true);
    }
    closeMegaMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMegaMenu() {
    const megaMenu = document.getElementById('megaMenu');
    if (megaMenu) megaMenu.classList.add('active');
}

function closeMegaMenu() {
    const megaMenu = document.getElementById('megaMenu');
    if (megaMenu) megaMenu.classList.remove('active');
}

// ========================================
// MINI CARRINHO - Dropdown no botão do carrinho
// ========================================
function toggleMiniCart(forceShow) {
    const miniCart = document.getElementById('miniCart');
    if (!miniCart) return;

    const willShow = typeof forceShow === 'boolean' ? forceShow : !miniCart.classList.contains('active');
    miniCart.classList.toggle('active', willShow);
    renderMiniCart();
}

function renderMiniCart() {
    const itemsContainer = document.getElementById('miniCartItems');
    const totalEl = document.getElementById('miniCartTotal');
    if (!itemsContainer || !totalEl) return;

    if (!cart || cart.length === 0) {
        itemsContainer.innerHTML = '<p style="text-align:center; color:var(--gray-medium); padding:10px 0;">Seu carrinho está vazio.</p>';
        totalEl.textContent = 'R$ 0,00';
        return;
    }

    itemsContainer.innerHTML = cart.map(item => `
        <div class="mini-cart-item">
            <img src="${item.image}" alt="${item.name}" loading="lazy">
            <div class="mini-cart-item-info">
                <span class="mini-cart-item-name">${item.name}</span>
                <span class="mini-cart-item-qty">Qtd: ${item.quantity}</span>
                <span class="mini-cart-item-price">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
            </div>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function _buildCartWhatsAppMessage() {
    let message = 'Olá! Gostaria de finalizar meu pedido:\n\n';
    cart.forEach(item => {
        message += `• ${item.name} - R$ ${item.price.toFixed(2).replace('.', ',')} (Qtd: ${item.quantity})\n`;
    });
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    message += `\nTotal: R$ ${total.toFixed(2).replace('.', ',')}`;
    return message;
}

function setupMiniCartListeners() {
    // Botão do carrinho abre o dropdown do mini carrinho
    const cartBtnEl = document.getElementById('cartBtn');
    if (cartBtnEl) {
        cartBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMegaMenu();
            toggleMiniCart();
        });
    }

    const closeMiniCartBtn = document.getElementById('closeMiniCart');
    if (closeMiniCartBtn) {
        closeMiniCartBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMiniCart(false);
        });
    }

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
        const miniCart = document.getElementById('miniCart');
        if (miniCart && miniCart.classList.contains('active')) {
            if (!miniCart.contains(e.target) && e.target.id !== 'cartBtn') {
                miniCart.classList.remove('active');
            }
        }
        const megaMenu = document.getElementById('megaMenu');
        if (megaMenu && megaMenu.classList.contains('active')) {
            if (!megaMenu.contains(e.target) && !e.target.closest('.logo')) {
                megaMenu.classList.remove('active');
            }
        }
    });

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleMiniCart(false);
            closeMegaMenu();
        }
    });

    // Finalizar pedido pelo mini carrinho
    const miniCheckout = document.getElementById('miniCartCheckout');
    if (miniCheckout) {
        miniCheckout.addEventListener('click', () => {
            if (!cart || cart.length === 0) {
                showToast('Carrinho vazio!');
                return;
            }
            trackEvent('Contact', { content_name: 'WhatsApp - Mini Carrinho' });
            window.open(`https://api.whatsapp.com/send/?phone=556593475496&text=${encodeURIComponent(_buildCartWhatsAppMessage())}`, '_blank');
        });
    }

    // Ver carrinho completo (abre o sidebar com quantidades)
    const viewFull = document.getElementById('miniCartViewFull');
    if (viewFull) {
        viewFull.addEventListener('click', () => {
            toggleMiniCart(false);
            toggleCart();
        });
    }

    // Mega Menu: hover no logo (desktop) + clique (mobile)
    const logoLink = document.getElementById('logoLink');
    const megaMenu = document.getElementById('megaMenu');
    if (logoLink && megaMenu) {
        logoLink.addEventListener('mouseenter', () => {
            closeMiniCartDrop();
            openMegaMenu();
        });
        megaMenu.addEventListener('mouseleave', () => closeMegaMenu());
        logoLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeMiniCartDrop();
            megaMenu.classList.contains('active') ? closeMegaMenu() : openMegaMenu();
        });
    }
}

function closeMiniCartDrop() {
    const miniCart = document.getElementById('miniCart');
    if (miniCart) miniCart.classList.remove('active');
}

window.selectMegaCategory = selectMegaCategory;
window.toggleMiniCart = toggleMiniCart;

function renderCategoryBar() {
    const bar = document.getElementById('categoryBar');
    if (!bar) return;

    let html = `<button class="category-pill active" data-category="all">Todos</button>`;
    categories.forEach(cat => {
        const slug = slugifyCategory(cat.name);
        html += `<button class="category-pill" data-category="${cat.id}" data-slug="${slug}">${cat.name}</button>`;
    });
    bar.innerHTML = html;

    bar.querySelectorAll('.category-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            bar.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const category = pill.dataset.category;
            const slug = pill.dataset.slug;

            currentCategory = category;
            allProductsLoaded = [];
            productViewers = {};

            if (slug === 'all' || category === 'all') {
                history.replaceState(null, '', window.location.pathname);
            } else {
                window.location.hash = slug;
            }

            const container = document.getElementById('productsContainer');
            if (container) container.innerHTML = '';

            loadProducts(true);
            updateSectionVisibility(currentCategory);
            if (secondarySectionsLoaded) {
                renderSocialProof();
                renderFaqs();
                renderReviews();
                renderTeamCarousel();
            }

            // Atualizar pill ativo na barra de busca (se existir)
            document.querySelectorAll('.search-category-item').forEach(item => {
                item.classList.toggle('active', item.dataset.category === category);
            });
        });
    });
}

function applyHashCategoryBar() {
    const hash = window.location.hash.slice(1);
    if (!hash || hash === 'all') return;
    const bar = document.getElementById('categoryBar');
    if (!bar) return;
    const match = bar.querySelector(`[data-slug="${hash}"]`);
    if (match) match.click();
}

async function loadFaqs() {
    const { data } = await _supabase.from('faqs').select('*').order('order_index');
    faqs = data || [];
}

async function loadSocialProof() {
    const { data } = await _supabase
        .from('social_proof')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
    
    socialProofImages = (data || []).filter(item => {
        return item.image_url && item.image_url.trim() !== '';
    });
}

async function loadSiteSettings() {
    try {
        const { data } = await _supabase.from('site_settings').select('data').eq('id', 1).single();
        if (data && data.data) siteSettings = { ...siteSettings, ...data.data };
    } catch (e) {
        // Tabela pode não existir ainda; usar defaults
    }
    const titleEl = document.getElementById('reviewsTitleText');
    if (titleEl) titleEl.textContent = siteSettings.reviews_title;
}

async function loadReviews() {
    const { data } = await _supabase
        .from('reviews')
        .select('*')
        .order('id', { ascending: false });
    reviews = data || [];
}

async function loadTeamCarousel() {
    const { data } = await _supabase
        .from('team_carousel')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
    teamCarouselData = data || [];
}

// 4. FUNÇÕES DE RENDERIZAÇÃO — LAZY LOADING (renderiza só o que cabe na tela)
const PRODUCTS_PER_PAGE = 12;
let _filteredProducts = [];
let _renderedCount = 0;
let _lazyObserver = null;

function _buildCardHTML(p, globalIndex) {
    const images = Array.isArray(p.images) ? p.images : [];
    const hasMultipleImages = images.length > 1;
    const hasVideoFirst = images.length > 0 && isVideoUrl(images[0]);
    const viewers = productViewers[p.id] || 5;
    const fakeMarkup = 1 + (0.15 + (((p.id * 7) % 16) / 100));
    const oldPrice = (p.price * fakeMarkup).toFixed(2).replace('.', ',');
    const discPct = Math.round((1 - 1/fakeMarkup) * 100);
    const isPriority = globalIndex < 12;
    const imgAttrs = `width="180" height="180" decoding="async" ${isPriority ? 'fetchpriority="high"' : 'loading="lazy"'}`;
    const currentPriceFormatted = p.price.toFixed(2).replace('.', ',');
    const cardOverlays = getAdditionalItemsOverlay(p);
    const videoPlayBadge = hasVideoFirst ? '<div class="badge-video"><i class="fas fa-play-circle"></i></div>' : '';

    return `
        <div class="product-card" onclick="window.openProductModal(${p.id})">
            <div class="product-image ${hasMultipleImages ? 'has-hover' : ''}">
                ${p.sold_today ? '<div class="badge-sold">🔥 Vendido hoje</div>' : ''}
                ${videoPlayBadge}
                <div class="badge-discount"><span>-</span><strong>${discPct}%</strong></div>
                <img id="product-img-${p.id}" src="${images[0] || 'https://via.placeholder.com/200'}" alt="${p.name}" class="product-img-main" ${imgAttrs}>
                ${hasMultipleImages ? `<img id="product-img-hover-${p.id}" src="${images[1] || 'https://via.placeholder.com/200'}" alt="${p.name}" class="product-img-hover" width="180" height="180" loading="lazy" decoding="async">` : ''}
                <button class="quick-add" onclick="event.stopPropagation();addToCartFly(event,${p.id})" aria-label="Adicionar ao carrinho">+</button>
                ${cardOverlays}
            </div>
            <div class="product-info">
                <div class="product-name">${p.name}</div>
                <div class="product-prices">
                    <span class="price-old">R$ ${oldPrice}</span>
                    <span class="price-now">
                        <span class="currency">R$</span>
                        <span class="num">${currentPriceFormatted}</span>
                    </span>
                </div>
                <span class="viewers"><span class="dot"></span>${viewers} pessoas vendo</span>
            </div>
        </div>`;
}

function _renderBatch(container) {
    const fragment = document.createDocumentFragment();
    const end = Math.min(_renderedCount + PRODUCTS_PER_PAGE, _filteredProducts.length);
    for (let i = _renderedCount; i < end; i++) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = _buildCardHTML(_filteredProducts[i], i);
        fragment.appendChild(wrapper.firstElementChild);
    }
    container.appendChild(fragment);
    _renderedCount = end;
}

function _observeCards(container, skipFirst) {
    if (!_cardAnimObserver) return;
    skipFirst = skipFirst || 4;
    container.querySelectorAll('.product-card:not(.card-anim-ready)').forEach((card, i) => {
        if (i < skipFirst) return;
        card.classList.add('card-anim-ready');
        _cardAnimObserver.observe(card);
    });
}

function _resetLazyLoad() {
    if (_lazyObserver) { _lazyObserver.disconnect(); _lazyObserver = null; }
    _renderedCount = 0;
    _filteredProducts = [];
}

function _prefetchNextBatch() {
    const start = _renderedCount;
    const end = Math.min(start + PRODUCTS_PER_PAGE, _filteredProducts.length);
    for (let i = start; i < end; i++) {
        const imgs = Array.isArray(_filteredProducts[i].images) ? _filteredProducts[i].images : [];
        imgs.slice(0, 2).forEach(src => { if (src) { const pi = new Image(); pi.src = src; } });
    }
}

function _setupLazyLoad(container) {
    if (_lazyObserver) _lazyObserver.disconnect();

    if (_renderedCount >= _filteredProducts.length) return;

    _lazyObserver = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        _renderBatch(container);
        _prefetchNextBatch();
        _observeCards(container, 0);
        if (_renderedCount >= _filteredProducts.length) {
            _lazyObserver.disconnect();
            _lazyObserver = null;
        } else {
            _lazyObserver.unobserve(entries[0].target);
            const cards = container.querySelectorAll('.product-card');
            _lazyObserver.observe(cards[cards.length - 1]);
        }
    }, { rootMargin: '1200px' });

    const cards = container.querySelectorAll('.product-card');
    if (cards.length > 0) {
        _lazyObserver.observe(cards[cards.length - 1]);
    }
}

function renderProducts() {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    _resetLazyLoad();

    _filteredProducts = allProductsLoaded.filter(p => {
        const matchCat = currentCategory === 'all' || String(p.category_id) === String(currentCategory);
        const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });

    if (_filteredProducts.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">Nenhum produto encontrado</p>';
        return;
    }

    // Gerar viewers
    _filteredProducts.forEach(p => {
        if (!productViewers[p.id]) {
            productViewers[p.id] = Math.floor(Math.random() * 38) + 3;
        }
    });

    // Vitrine de continuidade — em busca, mostra produtos em ordem natural
    const secondaryGrid = document.getElementById('secondaryProductsGrid');
    const secondarySource = allProductsCache.length > 0 ? allProductsCache : allProductsLoaded;
    if (secondaryGrid && secondarySource.length > 0) {
        const sorted = searchQuery ? [...secondarySource] : [...secondarySource].sort(() => Math.random() - 0.5);
        sorted.forEach(p => {
            if (!productViewers[p.id]) productViewers[p.id] = Math.floor(Math.random() * 38) + 3;
        });
        secondaryGrid.innerHTML = sorted.map(p => {
            const imgs = Array.isArray(p.images) ? p.images : [];
            const hasMulti = imgs.length > 1;
            const hasVideoFirst = imgs.length > 0 && isVideoUrl(imgs[0]);
            const views = productViewers[p.id] || 5;
            const markup = 1 + (0.15 + (((p.id * 7) % 16) / 100));
            const oldPr = (p.price * markup).toFixed(2).replace('.', ',');
            const disc = Math.round((1 - 1/markup) * 100);
            const currentPriceFormatted = p.price.toFixed(2).replace('.', ',');
            const overlays = getAdditionalItemsOverlay(p);
            return `
        <div class="product-card sec-card" onclick="window.openProductModal(${p.id})">
            <div class="product-image ${hasMulti ? 'has-hover' : ''}">
                ${p.sold_today ? '<div class="badge-sold">🔥 Vendido hoje</div>' : ''}
                ${hasVideoFirst ? '<div class="badge-video"><i class="fas fa-play-circle"></i></div>' : ''}
                <div class="badge-discount"><span>-</span><strong>${disc}%</strong></div>
                <img src="${imgs[0] || 'https://via.placeholder.com/200'}" alt="${p.name}" class="product-img-main" width="180" height="180" loading="lazy" decoding="async">
                ${hasMulti ? `<img src="${imgs[1] || 'https://via.placeholder.com/200'}" alt="${p.name}" class="product-img-hover" width="180" height="180" loading="lazy" decoding="async">` : ''}
                <button class="quick-add" onclick="event.stopPropagation();addToCartFly(event,${p.id})" aria-label="Adicionar ao carrinho">+</button>
                ${overlays}
            </div>
            <div class="product-info">
                <div class="product-name">${p.name}</div>
                <div class="product-prices">
                    <span class="price-old">R$ ${oldPr}</span>
                    <span class="price-now">
                        <span class="currency">R$</span>
                        <span class="num">${currentPriceFormatted}</span>
                    </span>
                </div>
                <span class="viewers"><span class="dot"></span>${views} pessoas vendo</span>
            </div>
        </div>`;
        }).join('');

        if (secondarySectionsLoaded) setupSecCardObserver();
    }

    // Primeiro lote — renderiza só o que cabe na tela
    container.innerHTML = '';
    _renderBatch(container);
    _prefetchNextBatch();
    _observeCards(container);
    _setupLazyLoad(container);
}

function slugifyCategory(name) {
    return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function renderCategories() {
    const list = document.getElementById('searchCategoryList');
    if (!list) return;

    renderSearchCategories('');
}

function renderSearchCategories(filter) {
    const container = document.getElementById('searchCategoryList');
    if (!container) return;

    const q = filter.trim().toLowerCase();
    let filtered = categories;
    if (q.length > 0) {
        filtered = categories.filter(cat =>
            cat.name.toLowerCase().includes(q)
        );
    }

    let html = '<div class="category-header"><i class="fas fa-th-list"></i> Categorias</div>';

    html += `<div class="search-category-item" data-category="all" data-slug="all">
        <i class="fas fa-th-large"></i>
        <span>Todos</span>
    </div>`;

    filtered.forEach(cat => {
        const slug = slugifyCategory(cat.name);
        html += `<div class="search-category-item" data-category="${cat.id}" data-slug="${slug}">
            <i class="fas fa-tag"></i>
            <span>${cat.name}</span>
        </div>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('.search-category-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const category = item.dataset.category;
            const slug = item.dataset.slug;

            const si = document.getElementById('searchInput');
            const sd = document.getElementById('searchDropdown');
            if (si) si.value = '';
            if (sd) sd.style.display = 'none';
            searchQuery = '';

            currentCategory = category;
            allProductsLoaded = [];
            productViewers = {};

            if (slug === 'all') {
                history.replaceState(null, '', window.location.pathname);
            } else {
                window.location.hash = slug;
            }

            const container = document.getElementById('productsContainer');
            if (container) container.innerHTML = '';

            loadProducts(true);
            updateSectionVisibility(currentCategory);
            if (secondarySectionsLoaded) {
                renderSocialProof();
                renderFaqs();
                renderReviews();
                renderTeamCarousel();
            }
        });
    });
}

function applyHashCategory() {
    const hash = window.location.hash.slice(1);
    if (!hash || hash === 'all') return;
    // Tenta sincronizar via barra de categorias (prioridade)
    const bar = document.getElementById('categoryBar');
    if (bar) {
        const matchBar = bar.querySelector(`[data-slug="${hash}"]`);
        if (matchBar) { matchBar.click(); return; }
    }
    // Fallback: busca no dropdown de categorias
    const list = document.getElementById('searchCategoryList');
    if (!list) return;
    const match = list.querySelector(`[data-slug="${hash}"]`);
    if (match) match.click();
}

// Funções de Hover de Imagem
window.hoverImage = function(productId, hoverState) {
    const mainImg = document.getElementById(`product-img-${productId}`);
    const hoverImg = document.getElementById(`product-img-hover-${productId}`);
    
    if (mainImg && hoverImg) {
        mainImg.style.display = hoverState ? 'none' : 'block';
        hoverImg.style.display = hoverState ? 'block' : 'none';
    }
};

window.unhoverImage = function(productId, hoverState) {
    const mainImg = document.getElementById(`product-img-${productId}`);
    const hoverImg = document.getElementById(`product-img-hover-${productId}`);
    
    if (mainImg && hoverImg) {
        mainImg.style.display = 'block';
        hoverImg.style.display = 'none';
    }
};

// Funções de Super Zoom
function openSuperZoom(productId, skipHistory = false, startIndex = 0) {
    const product = allProductsLoaded.find(p => p.id === productId);
    if (!product) return;

    const images = Array.isArray(product.images) ? product.images : [];
    superZoomMediaList = images;
    currentZoomIndex = startIndex;
    currentModalProduct = product;

    renderSuperZoomMedia();
    document.getElementById('superZoomOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Sempre empilha um novo estado para o super zoom — nunca substitui o estado do modal
    if (!skipHistory) {
        window.history.pushState({ 
            superZoomOpen: true, 
            productId: productId, 
            currentIndex: startIndex,
            modalOpen: true
        }, '', window.location.href);
    }
}

function renderSuperZoomMedia() {
    const content = document.getElementById('superZoomContent');
    if (!content || !superZoomMediaList.length) return;

    const currentImage = superZoomMediaList[currentZoomIndex];
    const navigationHtml = superZoomMediaList.length > 1 ? `
        <button class="super-zoom-nav super-zoom-prev" onclick="changeZoom(-1)">
            <i class="fas fa-chevron-left"></i>
        </button>
        <button class="super-zoom-nav super-zoom-next" onclick="changeZoom(1)">
            <i class="fas fa-chevron-right"></i>
        </button>
    ` : '';

    const zoomActionsHtml = currentModalProduct ? `
        <div class="super-zoom-actions">
            <button class="super-zoom-mp" onclick="handleBuyClick(${currentModalProduct.id})">
                <i class="fas fa-credit-card"></i> Comprar no Site
            </button>
            <button class="super-zoom-whatsapp" onclick="buyViaWhatsApp(${currentModalProduct.id})">
                <i class="fab fa-whatsapp"></i> Comprar Agora
            </button>
        </div>
    ` : '';

    const counterHtml = superZoomMediaList.length > 1 ? 
        `<div class="super-zoom-counter">${currentZoomIndex + 1} / ${superZoomMediaList.length}</div>` : '';

    const solitarioZoomHtml = currentModalProduct ? getAdditionalItemsOverlay(currentModalProduct) : '';

    content.innerHTML = `
        ${navigationHtml}
        <div class="super-zoom-image-container" style="position: relative;">
            <img src="${currentImage}" alt="Super Zoom" style="max-width: 90vw; max-height: 90vh; object-fit: contain; cursor: pointer;" onclick="changeZoom(1)">
            ${solitarioZoomHtml}
        </div>
        ${counterHtml}
        ${zoomActionsHtml}
    `;
}

function changeZoom(direction) {
    if (superZoomMediaList.length <= 1) return;
    
    currentZoomIndex = (currentZoomIndex + direction + superZoomMediaList.length) % superZoomMediaList.length;
    renderSuperZoomMedia();
    
    // Atualizar o histórico com o índice atual (para manter consistência no voltar)
    if (window.history.state && window.history.state.superZoomOpen && currentModalProduct) {
        window.history.replaceState({ 
            superZoomOpen: true, 
            productId: currentModalProduct.id, 
            currentIndex: currentZoomIndex 
        }, '', window.location.href);
    }
}

window.closeSuperZoom = function() {
    document.getElementById('superZoomOverlay').style.display = 'none';
    document.body.style.overflow = '';
    superZoomMediaList = [];
    currentZoomIndex = 0;
    currentModalProduct = null;
    
    // NÃO chamar history.back() aqui, apenas limpar o estado
    // O navegador já vai lidar com o voltar sozinho se o usuário apertar o botão
};

// Funções de Timer e Notificações
function startDeliveryTimer() {
    if (deliveryTimerInterval) {
        clearInterval(deliveryTimerInterval);
    }

    const endTime = new Date();
    endTime.setHours(endTime.getHours() + 3);
    endTime.setMinutes(59);
    endTime.setSeconds(59);

    deliveryTimerInterval = setInterval(() => {
        const now = new Date();
        const diff = endTime - now;

        if (diff <= 0) {
            clearInterval(deliveryTimerInterval);
            const timerElement = document.getElementById('deliveryTimer');
            if (timerElement) {
                timerElement.innerHTML = `
                    <i class="fas fa-check-circle"></i>
                    <span class="timer-text">Entrega encerrada</span>
                `;
            }
            return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const timeString = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
        
        const timerElement = document.getElementById('deliveryTimer');
        if (timerElement) {
            timerElement.innerHTML = `
                <i class="fas fa-clock"></i>
                <span class="timer-countdown">${timeString}</span>
                <span class="timer-text">para receber hoje!</span>
            `;
        }
    }, 1000);
}

// Incremento inteligente de viewers com psicologia
function startSmartViewerIncrement(productId) {
    if (viewerIncrementTimeout) {
        clearTimeout(viewerIncrementTimeout);
        viewerIncrementTimeout = null;
    }

    viewerOpenCount++;

    // Timing variável para não parecer automático:
    // 1º produto: 5-7s | 2º: 7-10s | 3º+: 8-14s (com variação aleatória)
    let baseDelay;
    if (viewerOpenCount === 1) {
        baseDelay = 5000 + Math.floor(Math.random() * 2000);
    } else if (viewerOpenCount === 2) {
        baseDelay = 7000 + Math.floor(Math.random() * 3000);
    } else {
        baseDelay = 8000 + Math.floor(Math.random() * 6000);
    }
    // Adicionar variação extra ímpar/par para quebrar padrão
    if (viewerOpenCount % 2 === 0) baseDelay += Math.floor(Math.random() * 2000);

    viewerIncrementTimeout = setTimeout(() => {
        const viewersEl = document.getElementById('modalViewersCount');
        const numberEl = document.getElementById('viewersNumber');
        if (!viewersEl || !numberEl) return;

        // Fase 1: Piscar para chamar atenção do cérebro
        viewersEl.classList.add('viewers-flash');

        // Fase 2: Após 1s do flash (tempo para o olho migrar), incrementar + som
        setTimeout(() => {
            const currentCount = parseInt(numberEl.textContent) || 0;
            const newCount = currentCount + 1;
            numberEl.textContent = newCount;

            // Atualizar no mapa para consistência
            if (productId) productViewers[productId] = newCount;

            // Animação de número subindo
            numberEl.classList.add('viewer-number-up');
            setTimeout(() => numberEl.classList.remove('viewer-number-up'), 600);

            // Som sutil de notificação
            playViewerSound();

            // Remover flash
            viewersEl.classList.remove('viewers-flash');
        }, 1000);
    }, baseDelay);
}

// Som sutil para o incremento de viewers
function playViewerSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.05);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
        // Silenciar erros de áudio (ex: autoplay policy)
    }
}

let _neighborhoodSeqIdx = 0;
let _geoIntervalId = null;
let _lastNeighborhoodCity = null;

function showGeoNotification() {
    const detectedCity = detectedLocation.city;
    const neighborhoods = detectedLocation.neighborhoods;

    // Se a cidade mudou, reinicia o índice para zero
    if (_lastNeighborhoodCity !== detectedCity) {
        _neighborhoodSeqIdx = 0;
        _lastNeighborhoodCity = detectedCity;
    }

    // Se já mostrou todos os bairros, para as notificações
    if (_neighborhoodSeqIdx >= neighborhoods.length) {
        if (_geoIntervalId) {
            clearInterval(_geoIntervalId);
            _geoIntervalId = null;
        }
        return;
    }

    const neighborhood = neighborhoods[_neighborhoodSeqIdx];
    _neighborhoodSeqIdx++;

    const customerName = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
    const msgIdx = (_neighborhoodSeqIdx - 1) % 4;

    const messages = [
        `<strong>${customerName}</strong> de <strong>${detectedCity}</strong> - <strong>${neighborhood}</strong> acabou de comprar!`,
        `<strong>${customerName}</strong> de <strong>${detectedCity}</strong> - <strong>${neighborhood}</strong> mandou mensagem no WhatsApp!`,
        `<strong>${customerName}</strong> de <strong>${detectedCity}</strong> - <strong>${neighborhood}</strong> está fechando a compra!`,
        `<strong>${customerName}</strong> de <strong>${detectedCity}</strong> - <strong>${neighborhood}</strong> avaliou positivo o atendimento!`
    ];

    const notification = document.getElementById('geoNotification');
    const notificationText = document.getElementById('geoNotificationText');
    const notifBar = document.getElementById('geoNotifBar');

    if (notification && notificationText) {
        notificationText.innerHTML = messages[msgIdx];
        if (notifBar) {
            notifBar.classList.remove('geo-bar-animate');
            void notifBar.offsetHeight;
            notifBar.classList.add('geo-bar-animate');
        }
        notification.classList.add('geo-show');
        clearTimeout(notification._geoTimer);
        notification._geoTimer = setTimeout(() => notification.classList.remove('geo-show'), 6200);
    }
}

function startGeoNotifications() {
    _neighborhoodSeqIdx = 0;
    _lastNeighborhoodCity = null;
    setTimeout(showGeoNotification, 45000);
    _geoIntervalId = setInterval(showGeoNotification, 55000);
}

// --- CONTADOR DE VISITAS RECORRENTES ---
function _initVisitCounter() {
    const today = new Date().toDateString();
    const savedDate = localStorage.getItem('_visit_date');
    const savedCount = parseInt(localStorage.getItem('_visit_count') || '0', 10);

    if (savedDate === today) {
        const newCount = savedCount + 1;
        localStorage.setItem('_visit_count', newCount.toString());
        return newCount;
    } else {
        localStorage.setItem('_visit_date', today);
        localStorage.setItem('_visit_count', '1');
        return 1;
    }
}

function _showVisitToast(visitCount) {
    const notif = document.getElementById('visitNotification');
    const text = document.getElementById('visitNotificationText');
    const bar = document.getElementById('visitNotifBar');
    if (!notif || !text) return false;

    const ordMap = { 2: '2ª', 3: '3ª', 4: '4ª', 5: '5ª', 6: '6ª', 7: '7ª', 8: '8ª', 9: '9ª', 10: '10ª' };
    const ordinal = ordMap[visitCount] || `${visitCount}ª`;

    text.innerHTML = `👋 <strong>Bem-vindo de volta!</strong> Esta é a sua <strong>${ordinal} visita</strong> hoje. Direcionando...`;

    if (bar) {
        bar.classList.remove('visit-bar-animate');
        void bar.offsetHeight;
        bar.classList.add('visit-bar-animate');
    }

    notif.classList.add('visit-show');
    clearTimeout(notif._visitTimer);
    notif._visitTimer = setTimeout(() => notif.classList.remove('visit-show'), 4200);

    return true;
}
// --- FIM DO CONTADOR ---

async function initGeoLocationBackground() {
    try {
        // Verificar se o usuário já escolheu uma cidade antes
        const savedCity = localStorage.getItem('user_city');
        if (savedCity) {
            detectedLocation.city = savedCity;
            console.log(`📍 Cidade carregada da memória: ${savedCity}`);
            return;
        }
        
        // Tentar detectar a cidade via IP (apenas como sugestão)
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const detectedCity = data.city || 'Cuiabá';
        
        if (NEIGHBORHOODS[detectedCity]) {
            detectedLocation = { city: detectedCity, neighborhoods: NEIGHBORHOODS[detectedCity] };
            // Auto-salva cidades conhecidas para evitar esperar IP em próximas visitas
            localStorage.setItem('user_city', detectedCity);
        } else {
            detectedLocation.city = detectedCity;
        }
        
        if (data.region_code) {
            detectedState = data.region_code;
        }
        
        // Guardar a cidade detectada para usar como sugestão
        window.detectedCitySuggestion = detectedCity;
        
    } catch (e) {
        console.warn('Erro na detecção de localização, usando Cuiabá como padrão');
        detectedLocation.city = 'Cuiabá';
        window.detectedCitySuggestion = 'Cuiabá';
    }
}

// Funções de Mídia do Modal
function changeModalMedia(index) {
    currentMediaIndex = index;
    const mainMedia = document.getElementById('modalMainMedia');
    const thumbnails = document.querySelectorAll('.modal-thumb');
    
    if (!mainMedia || !currentMediaList[index]) return;
    
    const product = currentModalProduct;
    const overlaysHtml = product ? getAdditionalItemsOverlay(product) : '';
    const soldTodayHtml = product?.sold_today ? '<div class="product-sold-today">Vendido Hoje</div>' : '';
    const mediaNavHtml = currentMediaList.length > 1 ? `
        <button class="modal-nav-btn modal-nav-prev" onclick="event.stopPropagation();changeModalMedia((currentMediaIndex - 1 + currentMediaList.length) % currentMediaList.length)">
            <i class="fas fa-chevron-left"></i>
        </button>
        <button class="modal-nav-btn modal-nav-next" onclick="event.stopPropagation();changeModalMedia((currentMediaIndex + 1) % currentMediaList.length)">
            <i class="fas fa-chevron-right"></i>
        </button>
    ` : '';
    
    // Atualiza mantendo os overlays e botoes em todas as fotos
    if (currentMediaList[index].type === 'video') {
        mainMedia.innerHTML = `${renderVideoMedia(currentMediaList[index].url)}${soldTodayHtml}${overlaysHtml}${mediaNavHtml}`;
    } else {
        mainMedia.innerHTML = `<img src="${currentMediaList[index].url}" alt="${product?.name || ''}">${soldTodayHtml}${overlaysHtml}${mediaNavHtml}`;
    }
    
    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

function setupModalMediaClick() {
    const mainMedia = document.getElementById('modalMainMedia');
    if (!mainMedia) return;
    
    // 1. Abrir Zoom ao clicar
    mainMedia.addEventListener('click', (e) => {
        if (currentMediaList[currentMediaIndex]?.type === 'image' && currentModalProduct) {
            openSuperZoom(currentModalProduct.id, false, currentMediaIndex);
        }
    });

    // 2. Sensores de movimento do dedo (Swipe) - Funcionando para todas as fotos
    let touchStartX = 0;
    let touchEndX = 0;

    mainMedia.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    mainMedia.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const threshold = 50; 
        
        if (touchEndX < touchStartX - threshold) {
            // Próxima foto
            const nextIndex = (currentMediaIndex + 1) % currentMediaList.length;
            changeModalMedia(nextIndex);
        } else if (touchEndX > touchStartX + threshold) {
            // Foto anterior
            const prevIndex = (currentMediaIndex - 1 + currentMediaList.length) % currentMediaList.length;
            changeModalMedia(prevIndex);
        }
    }, { passive: true });
}

function setupModalVideoAudio(hasAudio) {
    // Vídeos nativos (<video>)
    const videos = document.querySelectorAll('#modalMainMedia video');
    videos.forEach(video => {
        video.muted = !hasAudio;
    });
    // Vídeos em iframes (YouTube, Vimeo) - envia comando de mute/unmute via postMessage
    const iframes = document.querySelectorAll('#modalMainMedia iframe');
    iframes.forEach(iframe => {
        try {
            // YouTube: setVolume 0-100
            const ytVolume = hasAudio ? 100 : 0;
            iframe.contentWindow.postMessage(`{"event":"command","func":"setVolume","args":[${ytVolume}]}`, '*');
            // Vimeo: setVolume 0-1
            const vimeoVolume = hasAudio ? 1 : 0;
            iframe.contentWindow.postMessage(`{"method":"setVolume","value":${vimeoVolume}}`, '*');
        } catch (e) {
            // Ignorar erros de cross-origin
        }
    });
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    
    return stars;
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shareProduct(id) {
    const product = allProductsLoaded.find(p => p.id === id);
    if (!product) {
        showToast('Produto não encontrado para compartilhar.');
        return;
    }

    const shareData = {
        title: product.name,
        text: `Olha só essa joia incrível da Etevalda MT: ${product.name} por apenas R$ ${product.price.toFixed(2).replace('.', ',')}!`,
        url: window.location.href.split('#')[0] + `#product-${product.id}`
    };

    try {
        if (navigator.share) {
            navigator.share(shareData);
            showToast('Compartilhado com sucesso!');
        } else {
            navigator.clipboard.writeText(shareData.url);
            showToast('Link copiado para a área de transferência!');
        }
    } catch (err) {
        console.log('Compartilhamento cancelado ou erro:', err);
    }
}

// Função para renderizar o carrossel do modal
function renderModalCarousel() {
    if (!allProductsLoaded.length) return;

    // Renderiza os 3 carrosseis com produtos diferentes
    renderModalCarouselIndividual('modalInfiniteCarousel', 1);
    renderModalCarouselIndividual('modalInfiniteCarousel2', 2);
    renderModalCarouselIndividual('modalInfiniteCarousel3', 3);
}

function renderModalCarouselIndividual(carouselId, carouselIndex) {
    const modalCarousel = document.getElementById(carouselId);
    if (!modalCarousel) return;

    // Pega produtos aleatórios de TODAS as categorias (igual página principal)
    const randomProducts = [...allProductsLoaded]
        .filter(p => p.id !== currentModalProduct?.id)
        .sort(() => Math.random() - 0.5)
        .slice((carouselIndex - 1) * 8, carouselIndex * 8);

    // Se não tiver produtos suficientes, pega mais aleatórios
    if (randomProducts.length < 8) {
        // Pega mais produtos do início se necessário
        const additionalProducts = [...allProductsLoaded]
            .filter(p => p.id !== currentModalProduct?.id)
            .sort(() => Math.random() - 0.5)
            .slice(0, 16 - randomProducts.length);
        randomProducts.push(...additionalProducts);
    }

    // Duplica múltiplas vezes para criar o efeito verdadeiramente infinito
    const carouselProducts = [...randomProducts, ...randomProducts, ...randomProducts, ...randomProducts];
    
    modalCarousel.innerHTML = carouselProducts.map(p => {
        const images = Array.isArray(p.images) ? p.images : [];
        return `
            <div class="modal-carousel-item" onclick="window.openProductModal(${p && p.id ? p.id : 0})">
                <img src="${images[0]}" alt="${p.name}" loading="lazy">
                <div class="modal-carousel-item-info">
                    <div class="modal-carousel-item-name">${p.name}</div>
                    <div class="modal-carousel-item-price">R$ ${p.price.toFixed(2).replace('.', ',')}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Configura animação infinita contínua
    modalCarousel.style.animation = 'carouselScroll 60s linear infinite';
}

// Funções de Carrossel
function getProductsForCarousel(carouselIndex) {
    if (!allProductsLoaded.length) return [];
    
    const shuffled = [...allProductsLoaded].sort(() => Math.random() - 0.5);
    const productsPerCarousel = Math.ceil(shuffled.length / 5);
    const startIndex = (carouselIndex - 1) * productsPerCarousel;
    const endIndex = Math.min(startIndex + productsPerCarousel, shuffled.length);
    
    const carouselProducts = shuffled.slice(startIndex, endIndex);
    return [...carouselProducts, ...carouselProducts];
}

function renderCarousel(carouselId = 'infiniteCarousel', carouselIndex = 1) {
    const carousel = document.getElementById(carouselId);
    if (!carousel || !allProductsLoaded.length) return;

    const carouselProducts = getProductsForCarousel(carouselIndex);
    
    // Duplica múltiplas vezes para criar efeito verdadeiramente infinito
    const infiniteProducts = [...carouselProducts, ...carouselProducts, ...carouselProducts, ...carouselProducts];
    
    carousel.innerHTML = infiniteProducts.map((p, idx) => {
        const images = Array.isArray(p.images) ? p.images : [];
        const isFeatured = idx % 5 === 0;
        const info = `<div class="carousel-item-info"><div class="carousel-item-name">${p.name}</div><div class="carousel-item-price">R$ ${p.price.toFixed(2).replace('.', ',')}</div></div>`;
        if (isFeatured) {
            return `
            <div class="carousel-item featured" onclick="window.openProductModal(${p && p.id ? p.id : 0})">
                <div class="carousel-item-inner">
                    <img src="${images[0] || 'https://via.placeholder.com/150'}" alt="${p.name}" loading="lazy">
                    ${info}
                </div>
            </div>`;
        }
        return `
            <div class="carousel-item" onclick="window.openProductModal(${p && p.id ? p.id : 0})">
                <img src="${images[0] || 'https://via.placeholder.com/150'}" alt="${p.name}" loading="lazy" style="aspect-ratio: 1/1; object-fit: cover;">
                ${info}
            </div>`;
    }).join('');
    
    // Configura animação infinita contínua
    carousel.style.animation = 'carouselScroll 150s linear infinite';
}

function renderAllCarousels() {
    renderCarousel('infiniteCarousel', 1);
    renderCarousel('infiniteCarousel2', 2);
    renderCarousel('infiniteCarousel3', 3);
    renderCarousel('infiniteCarousel4', 4);
    renderCarousel('infiniteCarousel5', 5);
}

function _shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function _getSeenProofIds() {
    try { return JSON.parse(localStorage.getItem('sp_seen') || '[]'); } catch { return []; }
}

function _addSeenProofIds(ids) {
    const seen = _getSeenProofIds();
    ids.forEach(id => { if (!seen.includes(id)) seen.push(id); });
    try { localStorage.setItem('sp_seen', JSON.stringify(seen)); } catch {}
}

function renderSocialProof() {
    const grid = document.getElementById('socialProofGrid');
    if (!grid) return;

    if (!socialProofImages || socialProofImages.length === 0) {
        grid.innerHTML = '<p style="text-align:center;">Nenhuma imagem de prova social disponível</p>';
        return;
    }

    // Filtrar por category_ids: vazio/null = todas as categorias; específico = só naquela(s)
    const visibleImages = socialProofImages.filter(item => {
        if (!item.category_ids || item.category_ids === '') return true;
        return item.category_ids.split(',').map(s => s.trim()).includes(String(currentCategory));
    });

    if (visibleImages.length === 0) {
        grid.innerHTML = '';
        return;
    }

    // --- Sistema Inteligente: evitar repetir fotos já vistas ---
    const seenIds = _getSeenProofIds();
    const unseen = visibleImages.filter(item => !seenIds.includes(item.id));
    const chosen = unseen.length > 0 ? _shuffleArray([...unseen]) : _shuffleArray([...visibleImages]);

    // Marcar as escolhidas como vistas
    _addSeenProofIds(chosen.map(i => i.id));

    // Se já viu todas e tem mais de 6 fotos, reseta o histórico
    if (unseen.length === 0 && visibleImages.length > 6) {
        try { localStorage.setItem('sp_seen', JSON.stringify([])); } catch {}
    }

    grid.innerHTML = chosen.map(item => {
        const parts   = (item.caption || '').split('@@');
        const hasAt   = parts.length > 1;
        const spName  = hasAt ? parts[0].trim() : '';
        const spText  = hasAt ? parts[1].trim() : (item.caption || 'Cliente satisfeito');
        const hasPic  = item.image_url && item.image_url.trim();
        const imgHtml = hasPic
            ? `<img src="${item.image_url}" alt="Prova Social" loading="lazy" style="aspect-ratio:1/1;object-fit:cover;">`
            : `<div style="width:100%;aspect-ratio:1/1;background:linear-gradient(135deg,#1c1c1c,#141414);display:flex;align-items:center;justify-content:center;font-size:2rem;color:#d4af37;">${spName ? spName.charAt(0).toUpperCase() : '★'}</div>`;
        const nameHtml = spName ? `<span class="social-proof-name">${spName}</span>` : '';
        return `
        <div class="social-proof-card">
            <div class="social-proof-image">${imgHtml}</div>
            <div class="social-proof-overlay">${nameHtml}<p class="social-proof-text">${spText}</p></div>
        </div>`;
    }).join('');
}

function renderFaqs() {
    const grid = document.getElementById('faqGrid');
    if (!grid) return 0;

    // Filtrar: category_id nulo/indefinido = aparece em todas as categorias; específico = só naquela categoria
    const activeFaqs = (faqs || []).filter(f => {
        // Novo: category_ids (multi, separado por vírgula)
        if (f.category_ids !== undefined && f.category_ids !== null) {
            if (f.category_ids === '') return true; // Geral
            return f.category_ids.split(',').map(s => s.trim()).includes(String(currentCategory));
        }
        // Legado: category_id (inteiro simples)
        return f.category_id === null || f.category_id === undefined || String(f.category_id) === String(currentCategory);
    });

    if (activeFaqs.length === 0) {
        grid.innerHTML = '';
        return 0;
    }

    grid.innerHTML = activeFaqs.map(f => `
        <div class="faq-card" onclick="playFaqAudio(this)">
            <div class="faq-icon"><i class="fas fa-play"></i></div>
            <h3>${f.question}</h3>
            <div class="faq-audio">
                <audio preload="none">
                    <source src="${f.audio_url}" type="audio/mpeg">
                </audio>
            </div>
        </div>
    `).join('');
    return activeFaqs.length;
}

function renderReviews() {
    const container = document.getElementById('reviewsContainer');
    const section = document.getElementById('reviewsSection');
    if (!container) return;

    if (!reviews || reviews.length === 0) {
        if (section) { section.style.height = '0'; section.style.overflow = 'hidden'; }
        return;
    }

    // Filtrar por category_ids: vazio/null = todas as categorias
    const visibleReviews = reviews.filter(r => {
        if (!r.category_ids || r.category_ids === '') return true;
        return r.category_ids.split(',').map(s => s.trim()).includes(String(currentCategory));
    });

    if (visibleReviews.length === 0) {
        if (section) { section.style.height = '0'; section.style.overflow = 'hidden'; }
        return;
    }

    const titleEl = document.getElementById('reviewsTitleText');
    if (titleEl) titleEl.textContent = siteSettings.reviews_title || 'O que nossos clientes dizem';

    container.innerHTML = visibleReviews.map(r => {
        const customerName = r.customer_name || r.name || 'Cliente';
        const rating = r.rating || 5;
        const starsHtml = Array.from({ length: 5 }, (_, i) =>
            `<i class="fas fa-star" style="color:${i < rating ? '#ff9500' : '#444'}"></i>`
        ).join('');
        const avatarHtml = r.image_url
            ? `<img src="${r.image_url}" alt="${customerName}" class="review-carousel-avatar" loading="lazy">`
            : `<div class="review-carousel-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--gold-light);color:var(--gold-primary);font-weight:700;font-size:1.1rem;">${customerName.charAt(0).toUpperCase()}</div>`;
        return `
            <div class="review-carousel-card">
                <div class="review-carousel-header">
                    ${avatarHtml}
                    <div>
                        <div class="review-carousel-name">${customerName}</div>
                        <div class="review-carousel-stars">${starsHtml}</div>
                    </div>
                </div>
                <p class="review-carousel-comment">"${r.comment}"</p>
            </div>`;
    }).join('');
}

function renderTeamCarousel() {
    const track = document.getElementById('teamCarouselTrack');
    const section = document.getElementById('teamCarouselSection');
    if (!track) return;

    if (!teamCarouselData || teamCarouselData.length === 0) {
        if (section) { section.style.height = '0'; section.style.overflow = 'hidden'; }
        return;
    }

    // Filtrar por category_ids: vazio/null = todas as categorias
    const visibleTeam = teamCarouselData.filter(item => {
        if (!item.category_ids || item.category_ids === '') return true;
        return item.category_ids.split(',').map(s => s.trim()).includes(String(currentCategory));
    });

    if (visibleTeam.length === 0) {
        if (section) { section.style.height = '0'; section.style.overflow = 'hidden'; }
        return;
    }

    track.innerHTML = visibleTeam.map(item => `
        <div class="team-carousel-item">
            <img src="${item.image_url}" alt="${item.caption || 'Etevalda'}" class="team-carousel-image" loading="lazy">
            ${item.caption ? `<div class="team-carousel-caption">${item.caption}</div>` : ''}
        </div>`
    ).join('');

    const dotsEl = document.getElementById('teamCarouselDots');
    if (dotsEl && teamCarouselData.length > 1) {
        dotsEl.innerHTML = teamCarouselData.map((_, i) =>
            `<button class="team-carousel-dot${i === 0 ? ' active' : ''}" onclick="window.goToTeamSlide(${i})"></button>`
        ).join('');
    }

    teamCarouselIndex = 0;
    if (teamCarouselAutoInterval) clearInterval(teamCarouselAutoInterval);
    if (teamCarouselData.length > 1) {
        teamCarouselAutoInterval = setInterval(() => {
            window.goToTeamSlide((teamCarouselIndex + 1) % teamCarouselData.length);
        }, 4500);
    }
}

window.goToTeamSlide = function(index) {
    teamCarouselIndex = index;
    const track = document.getElementById('teamCarouselTrack');
    if (!track) return;
    const item = track.querySelector('.team-carousel-item');
    if (!item) return;
    track.style.transform = `translateX(-${index * item.offsetWidth}px)`;
    document.querySelectorAll('.team-carousel-dot').forEach((d, i) =>
        d.classList.toggle('active', i === index)
    );
};

function setupSecCardObserver() {
    const secondaryGrid = document.getElementById('secondaryProductsGrid');
    if (!secondaryGrid) return;

    if (secCardObserver) {
        secCardObserver.disconnect();
        secCardObserver = null;
    }

    const cards = secondaryGrid.querySelectorAll('.sec-card:not(.sec-card--visible)');
    if (!cards.length) return;

    if ('IntersectionObserver' in window) {
        secCardObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('sec-card--visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05, rootMargin: '0px 0px 60px 0px' });
        cards.forEach(card => secCardObserver.observe(card));
    } else {
        cards.forEach(card => card.classList.add('sec-card--visible'));
    }
}

function updateSectionVisibility(category) {
    if (!secondarySectionsLoaded) return;

    const isAll = !category || category === 'all';
    const show = el => { if (el) { el.style.opacity = '1'; el.style.height = 'auto'; el.style.overflow = 'visible'; el.style.minHeight = ''; el.style.marginBottom = ''; el.style.paddingTop = ''; el.style.paddingBottom = ''; } };
    const hide = el => { if (el) { el.style.opacity = '0'; el.style.height = '0'; el.style.overflow = 'hidden'; el.style.minHeight = '0'; el.style.marginBottom = '0'; el.style.paddingTop = '0'; el.style.paddingBottom = '0'; } };

    // faqSection: escondida em 'all'; em categoria específica, renderFaqs filtra e decide visibilidade
    if (isAll) {
        hide(document.getElementById('faqSection'));
    } else if (secondarySectionsLoaded) {
        const faqCount = renderFaqs();
        faqCount > 0 ? show(document.getElementById('faqSection')) : hide(document.getElementById('faqSection'));
    }

    // socialProofSection: sempre visível
    show(document.getElementById('socialProofSection'));

    // secondaryProductsSection: sempre visível (todas as categorias)
    show(document.getElementById('secondaryProductsSection'));

    // reviewsSection: visível apenas se houver reviews
    const revSec = document.getElementById('reviewsSection');
    if (reviews && reviews.length > 0) {
        show(revSec);
    } else {
        hide(revSec);
    }

    // carrossel 1: visível apenas em 'all' (em categorias específicas, a sequência é: prova social → FAQ → Veja mais)
    isAll ? show(document.getElementById('carouselSection')) : hide(document.getElementById('carouselSection'));

    // carrosséis 2-5: visíveis apenas em 'all'
    ['carouselSection2', 'carouselSection3', 'carouselSection4', 'carouselSection5'].forEach(id => {
        isAll ? show(document.getElementById(id)) : hide(document.getElementById(id));
    });
}

function showSecondarySections() {
    const sections = ['socialProofSection', 'faqSection', 'secondaryProductsSection', 'reviewsSection', 'carouselSection', 'carouselSection2', 'carouselSection3', 'carouselSection4', 'carouselSection5', 'teamCarouselSection'];
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) {
            section.style.display = '';
            section.style.opacity = '1';
            section.style.height = 'auto';
            section.style.overflow = 'visible';
        }
    });

    renderAllCarousels();
    renderSocialProof();
    renderFaqs();
    renderReviews();
    renderTeamCarousel();

    secondarySectionsLoaded = true;
    updateSectionVisibility(currentCategory);

    // Configurar observer APÓS a seção estar visível (corrige comportamento em mobile)
    setupSecCardObserver();

    // GARANTIA: forçar visibilidade dos cards após 500ms (caso o observer não dispare)
    setTimeout(() => {
        document.querySelectorAll('.sec-card:not(.sec-card--visible)').forEach(card => {
            card.classList.add('sec-card--visible');
        });
    }, 500);
}

// 5. FUNÇÕES DO MODAL

// Helper: Buscar nome da categoria pelo ID
function getCategoryName(categoryId) {
    const cat = categories.find(c => c.id === parseInt(categoryId));
    return cat ? cat.name : '';
}

// Helper: Buscar produtos upsell (mesma upsell_category)
function getUpsellProducts(product, maxItems = 6) {
    if (!product.upsell_category) return [];
    
    // Encontrar o ID da categoria upsell pelo nome
    const upsellCat = categories.find(c => c.name.toLowerCase() === product.upsell_category.toLowerCase());
    
    let upsellProducts = [];
    
    if (upsellCat) {
        // Buscar produtos da categoria upsell
        upsellProducts = allProductsLoaded.filter(p => 
            p.id !== product.id && 
            p.category_id === upsellCat.id
        );
    }
    
    // Se não encontrou por ID, tentar por nome da upsell_category
    if (upsellProducts.length === 0) {
        upsellProducts = allProductsLoaded.filter(p => 
            p.id !== product.id && 
            p.upsell_category && 
            p.upsell_category.toLowerCase() === product.upsell_category.toLowerCase()
        );
    }
    
    // Embaralhar e limitar
    return upsellProducts.sort(() => Math.random() - 0.5).slice(0, maxItems);
}

// Helper: Buscar produtos complementares (outras categorias + fallback)
function getComplementaryProducts(product, excludeIds = [], maxItems = 10) {
    // 1. Prioridade: produtos de OUTRAS categorias (complementam o estilo)
    let complementary = allProductsLoaded.filter(p => 
        p.id !== product.id && 
        !excludeIds.includes(p.id) &&
        p.category_id !== product.category_id
    );
    
    // 2. Embaralhar para variedade
    complementary = complementary.sort(() => Math.random() - 0.5);
    
    // 3. Se não tiver suficiente, incluir da mesma categoria também
    if (complementary.length < maxItems) {
        const sameCategory = allProductsLoaded.filter(p => 
            p.id !== product.id && 
            !excludeIds.includes(p.id) &&
            p.category_id === product.category_id &&
            !complementary.find(c => c.id === p.id)
        ).sort(() => Math.random() - 0.5);
        
        complementary = [...complementary, ...sameCategory];
    }
    
    return complementary.slice(0, maxItems);
}

// Helper: Renderizar card de produto para recomendação (upsell - horizontal 3 colunas)
function renderUpsellCard(p) {
    const images = Array.isArray(p.images) ? p.images : [];
    const img = images[0] || 'https://via.placeholder.com/150';
    const hasVideoFirst = images.length > 0 && isVideoUrl(images[0]);
    return `
        <div class="upsell-product-card" onclick="openProductModal(${p.id})">
            <div class="upsell-product-image">
                <img src="${img}" alt="${p.name}" loading="lazy">
                ${hasVideoFirst ? '<div class="badge-video" style="width:30px;height:30px;font-size:1rem;"><i class="fas fa-play-circle"></i></div>' : ''}
            </div>
            <div class="upsell-product-name">${p.name}</div>
            <div class="upsell-product-price">R$ ${p.price.toFixed(2).replace('.', ',')}</div>
        </div>
    `;
}

// Helper: Renderizar card de produto para "Complemente seu Estilo" (grid 2 colunas)
function renderComplementCard(p) {
    const images = Array.isArray(p.images) ? p.images : [];
    const img = images[0] || 'https://via.placeholder.com/300';
    const hasVideoFirst = images.length > 0 && isVideoUrl(images[0]);
    return `
        <div class="complement-product-card" onclick="openProductModal(${p.id})">
            <div class="complement-product-image">
                <img src="${img}" alt="${p.name}" loading="lazy">
                ${hasVideoFirst ? '<div class="badge-video" style="width:34px;height:34px;font-size:1.1rem;"><i class="fas fa-play-circle"></i></div>' : ''}
            </div>
            <div class="complement-product-name">${p.name}</div>
            <div class="complement-product-price">
                <span class="complement-price-prefix">R$</span> 
                <span class="complement-price-value">${p.price.toFixed(2).replace('.', ',')}</span>
            </div>
        </div>
    `;
}

// Helper: Gerar HTML dos overlays de itens adicionais sobrepostos à imagem do produto
function getAdditionalItemsOverlay(product) {
    let html = '';

    // Item 1 - centro superior (mantendo formato original)
    if (product.tem_solitario && product.solitario_price > 0) {
        html += `
        <div class="solitario-overlay solitario-overlay-1">
            <i class="fas fa-gem"></i> ${product.additional_product_name || 'Solitário'} vendido separado: R$ ${product.solitario_price.toFixed(2).replace('.', ',')}
        </div>`;
    }

    // Item 2 - inferior esquerdo
    const price2 = parseFloat(product.additional_item_2_price) || 0;
    if (price2 > 0 && product.additional_item_2_name) {
        html += `
        <div class="solitario-overlay solitario-overlay-2">
            <i class="fas fa-gem"></i> ${product.additional_item_2_name}: R$ ${price2.toFixed(2).replace('.', ',')}
        </div>`;
    }

    // Item 3 - inferior direito
    const price3 = parseFloat(product.additional_item_3_price) || 0;
    if (price3 > 0 && product.additional_item_3_name) {
        html += `
        <div class="solitario-overlay solitario-overlay-3">
            <i class="fas fa-gem"></i> ${product.additional_item_3_name}: R$ ${price3.toFixed(2).replace('.', ',')}
        </div>`;
    }

    return html;
}

// Helper: Gerar linhas de info textual dos itens adicionais para o modal
function getAdditionalInfoLines(product) {
    let lines = '';

    if (product.tem_solitario && product.solitario_price > 0) {
        lines += `<div class="solitario-info-line"><i class="fas fa-gem"></i> ${product.additional_product_name || 'Solitário'} vendido separado: R$ ${product.solitario_price.toFixed(2).replace('.', ',')}</div>`;
    }

    const price2 = parseFloat(product.additional_item_2_price) || 0;
    if (price2 > 0 && product.additional_item_2_name) {
        lines += `<div class="solitario-info-line"><i class="fas fa-gem"></i> ${product.additional_item_2_name}: R$ ${price2.toFixed(2).replace('.', ',')}</div>`;
    }

    const price3 = parseFloat(product.additional_item_3_price) || 0;
    if (price3 > 0 && product.additional_item_3_name) {
        lines += `<div class="solitario-info-line"><i class="fas fa-gem"></i> ${product.additional_item_3_name}: R$ ${price3.toFixed(2).replace('.', ',')}</div>`;
    }

    return lines;
}

function openProductModal(id) {
    const product = allProductsLoaded.find(p => p.id === id) || allProductsCache.find(p => p.id === id);
    if (!product) return;


    currentModalProduct = product;
    const images = Array.isArray(product.images) ? product.images : [];
    const soldTodayHtml = product.sold_today ? '<div class="product-sold-today">Vendido Hoje</div>' : '';
    const viewersCount = productViewers[id] || (Math.floor(Math.random() * 38) + 3);
    const rating = product.default_rating || 5;
    const categoryName = getCategoryName(product.category_id);
    const salesCount = (product.id % 76) + 5;
    const _catNorm = (categoryName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const _nameNorm = product.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const _isNoDiscount = _catNorm.includes('alianca') || _catNorm.includes('anei') || _nameNorm.includes('alianca') || _nameNorm.includes('anel');
    const originalPrice = product.price.toFixed(2).replace('.', ',');
    const pixPrice = _isNoDiscount ? originalPrice : (product.price * 0.95).toFixed(2).replace('.', ',');
    const installmentValue = (product.price / 6).toFixed(2).replace('.', ',');
    const shippingMsg = '';
    const hasPixDiscount = product.has_pix_discount !== false;
    let _priceBlock;
    if (!hasPixDiscount) {
        _priceBlock = `<div class="modal-price-container">
             <div class="modal-main-price">R$ ${originalPrice}</div>
             <div class="modal-installment-line">ou 6x de R$ ${installmentValue} sem juros</div>
           </div>`;
    } else if (_isNoDiscount) {
        _priceBlock = `<div class="modal-price-container">
             <div class="modal-price-label">PREÇO EXCLUSIVO:</div>
             <div class="modal-main-price">R$ ${originalPrice}</div>
             <div class="modal-installment-line">ou 6x de R$ ${installmentValue} sem juros</div>
           </div>`;
    } else {
        _priceBlock = `<div class="modal-price-container">
             <div class="modal-price-old">De: R$ ${originalPrice}</div>
             <div class="modal-main-price">R$ ${pixPrice} <span class="pix-tag">no PIX</span></div>
             <div class="modal-discount-info">(5% de desconto \u00e0 vista)</div>
             <div class="modal-installment-line">ou 6x de R$ ${installmentValue} sem juros no cart\u00e3o</div>
           </div>`;
    }

    // ===== EVENTO DE VISUALIZAÇÃO DE PRODUTO (ViewContent) =====
    trackEvent('ViewContent', {
        content_name: product.name,
        content_category: categoryName,
        content_ids: [product.id],
        content_type: 'product',
        value: product.price,
        currency: 'BRL'
    });
    // ===== FIM DA ADIÇÃO =====

    // Criar lista de mídia para o modal
    // Detecta automaticamente URLs de vídeo dentro do array images
    currentMediaList = images.map((img, index) => ({
        type: isVideoUrl(img) ? 'video' : 'image',
        url: img,
        thumbnail: img,
        index: index
    }));

    // Adicionar vídeo do campo video_url se existir e não estiver já no array
    if (product.video_url) {
        const alreadyInList = currentMediaList.some(m => m.url === product.video_url);
        if (!alreadyInList) {
            currentMediaList.unshift({
                type: 'video',
                url: product.video_url,
                thumbnail: product.video_thumbnail || images[0] || 'https://via.placeholder.com/400',
                index: -1
            });
        } else {
            // Garantir que o item existente tenha type 'video'
            const existingItem = currentMediaList.find(m => m.url === product.video_url);
            if (existingItem) existingItem.type = 'video';
        }
    }

    // Thumbnails para navegação
    const thumbnailsHtml = currentMediaList.map((media, index) => `
        <div class="modal-thumb ${media.type === 'video' ? 'video-thumb' : ''} ${index === 0 ? 'active' : ''}" onclick="changeModalMedia(${index})">
            <img src="${media.thumbnail}" alt="">
            ${index === 0 && product.badge_text ? `<span class="thumb-badge">${product.badge_text}</span>` : ''}
        </div>
    `).join('');

    const solitarioOverlayHtml = getAdditionalItemsOverlay(product);

    // Botoes de navegacao de fotos no modal
    const mediaNavHtml = currentMediaList.length > 1 ? `
        <button class="modal-nav-btn modal-nav-prev" onclick="event.stopPropagation();changeModalMedia((currentMediaIndex - 1 + currentMediaList.length) % currentMediaList.length)">
            <i class="fas fa-chevron-left"></i>
        </button>
        <button class="modal-nav-btn modal-nav-next" onclick="event.stopPropagation();changeModalMedia((currentMediaIndex + 1) % currentMediaList.length)">
            <i class="fas fa-chevron-right"></i>
        </button>
    ` : '';

    // Buscar produtos para as seções de recomendação
    const upsellProducts = getUpsellProducts(product, 6);
    const upsellIds = upsellProducts.map(p => p.id);
    const complementProducts = getComplementaryProducts(product, upsellIds, 10);

    // Gerar HTML das seções de recomendação
    const upsellHtml = upsellProducts.length > 0 ? `
        <div class="upsell-section">
            <h3 class="upsell-title"><i class="fas fa-eye"></i> Quem viu, também gostou</h3>
            <div class="upsell-products-row">
                ${upsellProducts.map(p => renderUpsellCard(p)).join('')}
            </div>
        </div>
    ` : '';

    // Guardar IDs já exibidos para o scroll infinito
    complementShownIds = [product.id, ...upsellIds, ...complementProducts.map(p => p.id)];

    const complementHtml = `
        <div class="complement-section">
            <h3 class="complement-title"><i class="fas fa-infinity"></i> Complemente seu Estilo <span class="complement-scroll-hint">← deslize para ver mais</span></h3>
            <div class="complement-products-scroll" id="complementGrid">
                ${complementProducts.map(p => renderComplementCard(p)).join('')}
            </div>
            <div id="complementLoader" class="complement-loader" style="display:none; text-align:center; padding:10px;"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
    `;

    const modalHtml = `
            <div class="modal-media-container">
                <div class="modal-main-media" id="modalMainMedia" style="position: relative;">
                    ${currentMediaList[0]?.type === 'video'
                        ? renderVideoMedia(currentMediaList[0].url)
                        : `<img src="${currentMediaList[0]?.url || ''}" alt="${product.name}">`}
                    ${soldTodayHtml}
                    ${solitarioOverlayHtml}
                    ${mediaNavHtml}
                </div>
                <div class="modal-thumbnails">${thumbnailsHtml}</div>
            </div>
            <div class="modal-product-info">
                ${categoryName ? `<div class="modal-category-label">${categoryName.toUpperCase()}</div>` : ''}
                <h2>${product.name}</h2>
                <div class="modal-social-stars"><div class="social-stars-row">⭐⭐⭐⭐⭐</div><div class="social-sales-row">${salesCount} pessoas compraram este mês</div></div>
                ${getAdditionalInfoLines(product)}
                ${_priceBlock}
                <div class="looking-now" id="modalViewersCount" data-count="${viewersCount}"><i class="fas fa-eye"></i> <span id="viewersNumber">${viewersCount}</span> pessoas vendo agora</div>
                ${renderSizeSelectorHtml(product)}
                <div class="product-rating-large">${renderStars(rating)}</div>
                <div class="modal-buttons">
                    <button class="btn-mercadopago-modal" onclick="handleBuyClick(${product.id})" id="mpBtn-${product.id}">
                        <i class="fas fa-credit-card"></i> Comprar Agora
                    </button>
                    <button class="btn-whatsapp-modal" aria-label="Falar com atendente no WhatsApp sobre este produto" 
                    onclick="buyViaWhatsApp(${product.id})">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </button>
                </div>
                <div class="modal-buttons-secondary">
                    <button class="btn-add-cart-modal" onclick="addToCart(${product.id})">
                        <i class="fas fa-cart-plus"></i> Adicionar ao Carrinho
                    </button>
                </div>
                <div class="modal-delivery-urgency">${shippingMsg}</div>
                <div class="modal-buttons-share">
                    <div class="share-label"><i class="fas fa-share-alt"></i> Compartilhe</div>
                    <div class="share-buttons-row">
                        <a href="https://wa.me/?text=${encodeURIComponent(product.name + ' - R$ ' + originalPrice + ' | Etevalda Joias')}" target="_blank" class="share-btn share-whatsapp" aria-label="Compartilhar no WhatsApp"><i class="fab fa-whatsapp"></i></a>
                        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://www.etevaldajoias.com')}" target="_blank" class="share-btn share-facebook" aria-label="Compartilhar no Facebook"><i class="fab fa-facebook-f"></i></a>
                        <button class="share-btn share-copy" onclick="copyProductLink(${product.id})" aria-label="Copiar link"><i class="fas fa-link"></i></button>
                    </div>
                </div>
                <div class="modal-description">${product.description || ''}</div>
            </div>

            <!-- RECOMENDAÇÕES - Largura total (fora do info) -->
            <div class="modal-recommendations">
                ${upsellHtml}
                ${complementHtml}

                <!-- VER MAIS - Continuar navegando -->
                <div class="modal-see-more">
                    <div class="see-more-divider">
                        <span class="see-more-line"></span>
                        <span class="see-more-text"><i class="fas fa-th-large"></i> Veja mais produtos</span>
                        <span class="see-more-line"></span>
                    </div>
                    <div class="see-more-products" id="seeMoreGrid"></div>
                    <div id="seeMoreLoader" style="text-align:center; padding:15px; display:none;">
                        <i class="fas fa-spinner fa-spin" style="color:var(--gold-primary);"></i>
                    </div>
                    <div class="see-more-btn-wrap">
                        <button class="btn-see-more" onclick="loadMoreSeeMoreProducts()">
                            <i class="fas fa-plus-circle"></i> Carregar mais produtos
                        </button>
                    </div>
                </div>
            </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHtml;
    document.getElementById('productModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    document.querySelector('.header')?.classList.add('header-hidden');

    // JSON-LD Product structured data para o Google
    const existingLd = document.getElementById('product-ld-json');
    if (existingLd) existingLd.remove();
    const ldScript = document.createElement('script');
    ldScript.id = 'product-ld-json';
    ldScript.type = 'application/ld+json';
    ldScript.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': product.name,
        'image': images.length > 0 ? images : undefined,
        'description': product.description || product.name,
        'category': categoryName || undefined,
        'offers': {
            '@type': 'Offer',
            'price': product.price,
            'priceCurrency': 'BRL',
            'availability': 'https://schema.org/InStock',
            'url': 'https://www.etevaldajoias.com/'
        }
    });
    document.head.appendChild(ldScript);

    // Contador animado do salesCount
    const _salesEl = document.querySelector('.social-sales-row');
    if (_salesEl) {
        let _cur = 0;
        const _step = Math.max(1, Math.ceil(salesCount / 22));
        const _iv = setInterval(() => {
            _cur = Math.min(_cur + _step, salesCount);
            _salesEl.textContent = `${_cur} pessoas compraram este mês`;
            if (_cur >= salesCount) clearInterval(_iv);
        }, 35);
    }
    
    // Iniciar incremento inteligente de viewers
    startSmartViewerIncrement(id);
    
    // Configurar mídia do modal
    setupModalMediaClick();
    setupModalVideoAudio(product.video_has_audio);
    setupComplementInfiniteScroll();
    setupSizeSelector(product);
    
    // Scroll modal content para o topo (não a página)
    const modalContent = document.querySelector('#productModal .modal-content');
    if (modalContent) modalContent.scrollTop = 0;


        // Configurar botão voltar do celular
    window.history.pushState({ modalOpen: true, productId: product.id }, '', window.location.href);
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    document.querySelector('.header')?.classList.remove('header-hidden');
    // ===== PARAR TODOS OS VÍDEOS DO MODAL =====
    // Parar vídeos nativos (<video>)
    const videos = document.querySelectorAll('#modalMainMedia video, .modal-main-media video');
    videos.forEach(video => {
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
    });
    // Parar vídeos em iframes (YouTube, Vimeo, etc.) via postMessage
    const iframes = document.querySelectorAll('#modalMainMedia iframe, .modal-main-media iframe');
    iframes.forEach(iframe => {
        try {
            // YouTube
            iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            // Vimeo
            iframe.contentWindow.postMessage('{"method":"pause"}', '*');
        } catch (e) {
            // Ignorar erros de cross-origin
        }
    });
    // ===== FIM DA PAUSA DOS VÍDEOS =====
    
    // Remover JSON-LD Product do modal anterior
    const ldEl = document.getElementById('product-ld-json');
    if (ldEl) ldEl.remove();

    // Limpar estado do modal
    currentModalProduct = null;
    currentMediaList = [];
    currentMediaIndex = 0;
    
    // Limpar estado do scroll infinito de complementos
    complementShownIds = [];
    isLoadingMoreComplement = false;
    window.selectedSize = null;
    window.selectedGender = 'Masculino';
    window.selectedSizeMasc = null;
    window.selectedSizeFem = null;
    
    // Parar viewer increment timer se existir
    if (viewerIncrementTimeout) {
        clearTimeout(viewerIncrementTimeout);
        viewerIncrementTimeout = null;
    }
    
    // Remover scroll listener do complemento
    const scrollableEl = modal.querySelector('.modal-content');
    if (scrollableEl) {
        scrollableEl.removeEventListener('scroll', handleComplementScroll);
        scrollableEl.scrollTop = 0;
    }
    
    // NÃO chamar history.back() aqui também
    // Deixar o navegador gerenciar o histórico sozinho
}

function handleMobileBack(event) {
    const modal = document.getElementById('productModal');
    const superZoom = document.getElementById('superZoomOverlay');
    
    // Prioridade: Super Zoom > Modal
    if (superZoom && superZoom.style.display === 'flex') {
        // Fecha apenas o Super Zoom — NÃO zera currentModalProduct pois o modal ainda está aberto
        document.getElementById('superZoomOverlay').style.display = 'none';
        document.body.style.overflow = 'hidden'; // mantém scroll bloqueado pelo modal
        superZoomMediaList = [];
        currentZoomIndex = 0;
        // currentModalProduct permanece intacto (modal ainda aberto)
        
        event.preventDefault();
        event.stopPropagation();
    } else if (modal && modal.classList.contains('active')) {
        // Fecha o modal
        closeProductModal();
        event.preventDefault();
        event.stopPropagation();
    }
    // Se não for nenhum dos dois, deixar o comportamento normal do navegador
}

// FUNÇÃO INFINITA PARA COMPLEMENTE SEU ESTILO (scroll horizontal)
function setupComplementInfiniteScroll() {
    const complementGrid = document.getElementById('complementGrid');
    if (!complementGrid) return;

    // Remove listener anterior
    complementGrid.removeEventListener('scroll', handleComplementScroll);
    complementGrid.addEventListener('scroll', handleComplementScroll);
}

let complementScrollTimeout;
function handleComplementScroll() {
    clearTimeout(complementScrollTimeout);
    complementScrollTimeout = setTimeout(() => {
        checkAndLoadMoreComplement();
    }, 100);
}

function checkAndLoadMoreComplement() {
    const complementGrid = document.getElementById('complementGrid');
    if (!complementGrid || isLoadingMoreComplement) return;

    // Scroll horizontal: detecta quando está próximo ao final
    const distanceFromEnd = complementGrid.scrollWidth - (complementGrid.scrollLeft + complementGrid.clientWidth);

    if (distanceFromEnd < 200) {
        loadMoreComplementProducts();
    }
}

function loadMoreComplementProducts() {
    if (isLoadingMoreComplement) return;
    isLoadingMoreComplement = true;

    const complementGrid = document.getElementById('complementGrid');
    const loader = document.getElementById('complementLoader');

    if (loader) loader.style.display = 'block';

    // Buscar produtos disponíveis que ainda não foram mostrados
    let availableProducts = allProductsLoaded.filter(p => !complementShownIds.includes(p.id));

    // LOOP: Se não há mais, reseta e começa de novo (como a página principal)
    if (availableProducts.length === 0) {
        complementShownIds = complementShownIds.slice(0, 10); // Mantém só os 10 primeiros
        availableProducts = allProductsLoaded.filter(p => !complementShownIds.includes(p.id));
    }

    // Embaralhar e pegar 8 produtos por vez
    const shuffled = availableProducts.sort(() => Math.random() - 0.5);
    const newProducts = shuffled.slice(0, 8);

    if (newProducts.length === 0) {
        if (loader) loader.style.display = 'none';
        isLoadingMoreComplement = false;
        return;
    }
    
    // Adicionar os novos produtos ao grid
    setTimeout(() => {
        const newCardsHtml = newProducts.map(p => renderComplementCard(p)).join('');
        complementGrid.insertAdjacentHTML('beforeend', newCardsHtml);
        
        // Atualizar IDs mostrados
        complementShownIds.push(...newProducts.map(p => p.id));
        
        if (loader) loader.style.display = 'none';
        isLoadingMoreComplement = false;
    }, 500); // Pequeno delay para efeito de carregamento
}

// VER MAIS - No final do modal
let seeMoreShownIds = [];
let seeMorePage = 0;

function loadMoreSeeMoreProducts() {
    const grid = document.getElementById('seeMoreGrid');
    const loader = document.getElementById('seeMoreLoader');
    if (!grid) return;

    if (loader) loader.style.display = 'block';

    // Buscar produtos que ainda não foram mostrados nesta seção
    let available = allProductsLoaded.filter(p => !seeMoreShownIds.includes(p.id));

    // LOOP: se acabou, reseta
    if (available.length === 0) {
        seeMoreShownIds = [];
        seeMorePage = 0;
        available = [...allProductsLoaded];
    }

    // Embaralhar e pegar 24 produtos
    const shuffled = available.sort(() => Math.random() - 0.5);
    const batch = shuffled.slice(0, 24);

    setTimeout(() => {
        const html = batch.map(p => {
            const imgs = Array.isArray(p.images) ? p.images : [];
            const img = imgs[0] || 'https://via.placeholder.com/150';
            const price = p.price.toFixed(2).replace('.', ',');
            return `
                <div class="see-more-card" onclick="closeModal(); setTimeout(() => openProductModal(${p.id}), 300);">
                    <img src="${img}" alt="${p.name}" loading="lazy">
                    <div class="see-more-card-info">
                        <div class="see-more-card-name">${p.name}</div>
                        <div class="see-more-card-price">R$ ${price}</div>
                    </div>
                </div>
            `;
        }).join('');

        grid.insertAdjacentHTML('beforeend', html);
        seeMoreShownIds.push(...batch.map(p => p.id));
        seeMorePage++;

        if (loader) loader.style.display = 'none';
    }, 400);
}

function closeModal() {
    document.getElementById('productModal')?.classList.remove('active');
    document.body.style.overflow = '';
}

// 6. FUNÇÕES DO CARRINHO
function addToCart(productId) {
    const product = allProductsLoaded.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images?.[0] || 'https://via.placeholder.com/100',
            quantity: 1
        });
    }

    localStorage.setItem('etevalda_cart', JSON.stringify(cart));
    updateCartUI();
    showToast(`${product.name} adicionado ao carrinho!`);
}

function addToCartFly(event, productId) {
    const btn = event.currentTarget;
    const card = btn.closest('.product-card');
    const img = card ? card.querySelector('.product-img-main') : null;
    if (img) {
        _flyToCart(img, productId);
    } else {
        addToCart(productId);
    }
}

function _flyToCart(srcImg, productId) {
    const cartBtn = document.getElementById('cartBtn');
    if (!cartBtn) { addToCart(productId); return; }
    const r1 = srcImg.getBoundingClientRect();
    const r2 = cartBtn.getBoundingClientRect();
    const fly = document.createElement('img');
    fly.src = srcImg.src;
    fly.className = 'fly-to-cart';
    fly.style.left = r1.left + 'px';
    fly.style.top = r1.top + 'px';
    fly.style.width = r1.width + 'px';
    fly.style.height = r1.height + 'px';
    document.body.appendChild(fly);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const dx = r2.left - r1.left + r2.width / 2 - r1.width / 2;
            const dy = r2.top - r1.top + r2.height / 2 - r1.height / 2;
            fly.style.transform = `translate(${dx}px,${dy}px) scale(0.12) rotate(360deg)`;
            fly.style.opacity = '0';
        });
    });
    setTimeout(() => {
        fly.remove();
        addToCart(productId);
        cartBtn.classList.add('cart-shake');
        setTimeout(() => cartBtn.classList.remove('cart-shake'), 600);
        const countEl = document.getElementById('cartCount');
        if (countEl) {
            countEl.classList.add('cart-count-bump');
            setTimeout(() => countEl.classList.remove('cart-count-bump'), 350);
        }
        if (navigator.vibrate) navigator.vibrate(20);
    }, 870);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    localStorage.setItem('etevalda_cart', JSON.stringify(cart));
    updateCartUI();
}

function updateQuantity(productId, quantity) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = Math.max(1, quantity);
        localStorage.setItem('etevalda_cart', JSON.stringify(cart));
        updateCartUI();
    }
}

function toggleCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartSidebar) {
        cartSidebar.classList.toggle('active');
        if (cartOverlay) cartOverlay.classList.toggle('active');
        document.body.style.overflow = cartSidebar.classList.contains('active') ? 'hidden' : '';
    }
}

function updateCartUI() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');

    if (!cartItems || !cartCount || !cartTotal) return;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align:center; padding:20px;">Carrinho vazio</p>';
        cartCount.textContent = '0';
        cartTotal.textContent = 'R$ 0,00';
        renderMiniCart();
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>R$ ${item.price.toFixed(2).replace('.', ',')}</p>
            </div>
            <div class="cart-item-quantity">
                <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                <span>${item.quantity}</span>
                <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
            </div>
            <button onclick="removeFromCart(${item.id})" style="background: var(--danger); color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">×</button>
        </div>
    `).join('');

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    cartCount.textContent = itemCount;
    cartTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;

    renderMiniCart();
}

function loadCartFromStorage() {
    const savedCart = localStorage.getItem('etevalda_cart');
    if (savedCart) {
        try {
            cart = JSON.parse(savedCart);
        } catch (error) {
            console.error('Erro ao carregar carrinho:', error);
            cart = [];
        }
    }
    updateCartUI();
}

function closeCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartSidebar) {
        cartSidebar.classList.remove('active');
        if (cartOverlay) cartOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// 7. FUNÇÕES AUXILIARES
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function _proceedToWhatsApp(hasProduct) {
    // Vai direto pro WhatsApp — sem modal de cidade
    const knownCity = _getKnownCity() || detectedLocation.city || '';
    if (hasProduct) {
        sendWhatsAppMessage(window.currentWhatsAppProduct, knownCity);
    } else {
        sendWhatsAppMessage(null, knownCity);
    }
}

function handleFloatingWhatsApp() {
    window.currentWhatsAppProduct = null;
    const visitCount = window._dailyVisitCount || 1;
    if (visitCount > 1) {
        _showVisitToast(visitCount);
        setTimeout(() => _proceedToWhatsApp(false), 1800);
        return;
    }
    _proceedToWhatsApp(false);
}

function buyViaWhatsApp(productId) {
    const product = allProductsLoaded.find(p => p.id === productId) ||
                    (allProductsCache || []).find(p => p.id === productId);
    if (!product) return;
    window.currentWhatsAppProduct = product;

    const visitCount = window._dailyVisitCount || 1;
    if (visitCount > 1) {
        _showVisitToast(visitCount);
        setTimeout(() => _proceedToWhatsApp(true), 1800);
        return;
    }
    _proceedToWhatsApp(true);
}

// Remove acentos e converte para minúsculas para normalização de cidade
function _normCity(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Determina saudação baseada na cidade (Oi = unidade física, Olá = outras)
function _getGreetingAndCity(input) {
    const norm = _normCity(input.trim());
    if (norm === 'cba' || norm.includes('cuiaba')) return { greeting: 'Oi', city: 'Cuiabá' };
    if (norm === 'vg'  || norm.includes('varzea')) return { greeting: 'Oi', city: 'Várzea Grande' };
    if (norm === 'roo' || norm.includes('rondon') || norm.includes('rodon')) return { greeting: 'Oi', city: 'Rondonópolis' };
    if (norm.includes('sinop'))      return { greeting: 'Oi', city: 'Sinop' };
    if (norm.includes('diamantino')) return { greeting: 'Oi', city: 'Diamantino' };
    return { greeting: 'Olá', city: input.trim() || 'minha cidade' };
}

// Função para enviar a mensagem do WhatsApp (sem necessidade de cidade do cliente)
function sendWhatsAppMessage(product, city) {
    const cityInfo = city ? _getGreetingAndCity(city) : { greeting: 'Olá', city: '' };
    const { greeting } = cityInfo;

    let msg;
    if (!product) {
        msg = `${greeting}, vi seus produtos no site e gostei muito. Como funciona a entrega?`;
    } else {
        let extras = '';
        let totalExtra = 0;

        if (product.tem_solitario && product.solitario_price > 0) {
            extras += ` + *${product.additional_product_name || 'Solitário'}* (R$ ${product.solitario_price.toFixed(2).replace('.', ',')})`;
            totalExtra += product.solitario_price;
        }

        const price2 = parseFloat(product.additional_item_2_price) || 0;
        if (price2 > 0 && product.additional_item_2_name) {
            extras += ` + *${product.additional_item_2_name}* (R$ ${price2.toFixed(2).replace('.', ',')})`;
            totalExtra += price2;
        }

        const price3 = parseFloat(product.additional_item_3_price) || 0;
        if (price3 > 0 && product.additional_item_3_name) {
            extras += ` + *${product.additional_item_3_name}* (R$ ${price3.toFixed(2).replace('.', ',')})`;
            totalExtra += price3;
        }

        if (extras) {
            const total = product.price + totalExtra;
            msg = `${greeting}, gostei do produto: *${product.name}*${extras} - Total: R$ ${total.toFixed(2).replace('.', ',')}. Consegue me entregar?`;
        } else {
            msg = `${greeting}, gostei do produto: *${product.name}* - R$ ${product.price.toFixed(2).replace('.', ',')}. Consegue me entregar?`;
        }
    }

    if (product && window.selectedSize) {
        const isRing = window.selectedSizeType === 'ring';
        const genderInfo = isRing && window.selectedGender ? ` (${window.selectedGender})` : '';
        msg += ` | Numeração/Tamanho: *${window.selectedSize}${genderInfo}*`;
    }

    trackEvent('Contact', { content_name: 'WhatsApp' });

    window.open(`https://api.whatsapp.com/send/?phone=556593475496&text=${encodeURIComponent(msg)}`, '_blank');
}

// Modal de cidade removido — WhatsApp agora vai direto

let _activeFaqAudio = null;
let _activeFaqCard  = null;
let _faqFadeInterval = null;

function _duckMusicForFaq() {
    if (_faqFadeInterval) { clearInterval(_faqFadeInterval); _faqFadeInterval = null; }
    if (bgMusic && musicStarted) bgMusic.volume = 0.01;
}

function _restoreMusicAfterFaq() {
    if (!bgMusic || !musicStarted || isVideoPlaying) return;
    if (_faqFadeInterval) return;
    const target = originalVolume;
    _faqFadeInterval = setInterval(() => {
        const current = bgMusic.volume;
        if (current >= target - 0.005) {
            bgMusic.volume = target;
            clearInterval(_faqFadeInterval);
            _faqFadeInterval = null;
            return;
        }
        // Incremento progressivo: rápido no início, suave no fim
        const step = Math.max(0.008, (target - current) * 0.12);
        bgMusic.volume = Math.min(target, current + step);
    }, 60);
}

window.playFaqAudio = function(card) {
    const audio = card.querySelector('audio');
    if (!audio) return;

    // Se há outro FAQ tocando → para ele primeiro
    if (_activeFaqAudio && _activeFaqAudio !== audio) {
        _activeFaqAudio.pause();
        _activeFaqAudio.currentTime = 0;
        if (_activeFaqCard) {
            const prevIcon = _activeFaqCard.querySelector('.faq-icon i');
            if (prevIcon) prevIcon.className = 'fas fa-play';
        }
        _activeFaqAudio = null;
        _activeFaqCard  = null;
    }

    if (audio.paused) {
        audio.play();
        _activeFaqAudio = audio;
        _activeFaqCard  = card;
        card.querySelector('.faq-icon i').className = 'fas fa-stop';
        _duckMusicForFaq();

        audio.onended = function() {
            card.querySelector('.faq-icon i').className = 'fas fa-play';
            _activeFaqAudio = null;
            _activeFaqCard  = null;
            _restoreMusicAfterFaq();
        };
    } else {
        audio.pause();
        audio.currentTime = 0;
        card.querySelector('.faq-icon i').className = 'fas fa-play';
        _activeFaqAudio = null;
        _activeFaqCard  = null;
        _restoreMusicAfterFaq();
    }
};

// CHECKOUT POPUP — Smart Buy Flow
function showCheckoutPopup({ icon, title, message, btnOk = 'OK', btnCancel = null }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'chk-popup-overlay';
        const cancelHtml = btnCancel
            ? `<button class="chk-btn-secondary" data-val="cancel">${btnCancel}</button>`
            : '';
        overlay.innerHTML = `
            <div class="chk-popup-card">
                <div class="chk-popup-icon">${icon}</div>
                <div class="chk-popup-title">${title}</div>
                <div class="chk-popup-msg">${message}</div>
                <div class="chk-popup-btns">
                    ${cancelHtml}
                    <button class="chk-btn-primary" data-val="ok">${btnOk}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('chk-popup-show'));
        function close(val) {
            overlay.classList.remove('chk-popup-show');
            setTimeout(() => overlay.remove(), 300);
            resolve(val);
        }
        overlay.querySelectorAll('[data-val]').forEach(btn => {
            btn.addEventListener('click', () => close(btn.dataset.val));
        });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close('cancel'); });
    });
}

function showShippingPopup(product, halfPrice = false) {
    const basePrice = halfPrice ? product.price / 2 : product.price;
    const total = (basePrice + 14.99).toFixed(2).replace('.', ',');
    return showCheckoutPopup({
        icon: '🎁',
        title: 'Promoção de Frete!',
        message: `O frete normal para a sua região é <strong><s>R$ 45,00</s></strong>.<br><br>Hoje estamos fazendo por apenas <strong style="color:#d4af37;font-size:1.18em">R$ 14,99</strong>! 🎉<br><br>Valor total com frete: <strong>R$ ${total}</strong>`,
        btnOk: 'Ótimo! Finalizar Compra 🛒'
    });
}

function scrollToSizeSelector() {
    const modal = document.getElementById('productModal');
    const selector = modal ? modal.querySelector('.size-selector-wrap') : null;
    if (!selector) return;
    selector.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
        const panel = document.getElementById('sizePanel');
        const chevron = document.getElementById('sizeChevron');
        if (panel && !panel.classList.contains('size-panel-open')) {
            panel.classList.add('size-panel-open');
            if (chevron) chevron.style.transform = 'rotate(180deg)';
        }
        selector.classList.remove('size-selector-flash');
        void selector.offsetWidth;
        selector.classList.add('size-selector-flash');
        setTimeout(() => selector.classList.remove('size-selector-flash'), 2300);
    }, 420);
}

// MERCADO PAGO - CHECKOUT PRO
async function buyViaMercadoPago(productId, priceOverride = null) {
    const product = allProductsLoaded.find(p => p.id === productId);
    if (!product) return;

    const btn = document.getElementById(`mpBtn-${productId}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    }

    const categoryName = getCategoryName(product.category_id);
    const images = Array.isArray(product.images) ? product.images : [];

    // Facebook Pixel - Rastrear início de checkout
    trackEvent('InitiateCheckout', {
        content_name: product.name,
        content_category: categoryName,
        value: product.price,
        currency: 'BRL'
    });

    try {
        const response = await fetch('/api/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: product.name,
                price: (priceOverride !== null ? priceOverride : product.price) + 14.99,
                quantity: 1,
                category: categoryName,
                productId: product.id,
                picture_url: images[0] || ''
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Erro ao criar pagamento');
        }

        // Redirecionar para o Checkout Pro do Mercado Pago
        if (data.init_point) {
            window.location.href = data.init_point;
        } else {
            throw new Error('URL de pagamento não recebida');
        }

    } catch (error) {
        console.error('Erro Mercado Pago:', error);
        showToast('Erro ao processar pagamento. Tente via WhatsApp!', 'error');
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-credit-card"></i> Comprar Agora';
        }
    }
}

// SMART BUY HANDLER — intercepts "Comprar Agora" with size validation + shipping popup
async function handleBuyClick(productId) {
    const product = allProductsLoaded.find(p => p.id === productId) ||
                    (allProductsCache || []).find(p => p.id === productId);
    if (!product) return;

    const sizeType = product.size_type || (product.tem_numeracao ? _sizeCategory(product) : null);

    // ── CORRENTE: tamanho único, exibe info e segue ──────────────────────────
    if (sizeType === 'chain') {
        const res = await showCheckoutPopup({
            icon: '⛓️',
            title: 'A Mais Vendida do Brasil!',
            message: 'Você vai receber a <strong>Corrente de 70 cm</strong> — nosso tamanho campeão de vendas! ✅<br><br>Clique em <strong>Continuar</strong> para finalizar sua compra.',
            btnOk: 'Continuar 🛒'
        });
        if (res !== 'ok') return;
        await showShippingPopup(product);
        buyViaMercadoPago(productId);
        return;
    }

    // ── ALIANÇA / ANEL: fluxo inteligente de numeração ───────────────────────
    if (sizeType === 'ring') {
        const masc = window.selectedSizeMasc;
        const fem  = window.selectedSizeFem;

        // Nenhum tamanho selecionado → guia para o seletor
        if (!masc && !fem) {
            await showCheckoutPopup({
                icon: '💍',
                title: 'Escolha a Numeração Primeiro',
                message: 'Para garantirmos que você receba o tamanho <strong>perfeito</strong>, selecione a numeração logo abaixo antes de finalizar.<br><br>Nossa equipe também entra em contato antes do envio! 😊',
                btnOk: 'Escolher Tamanho'
            });
            scrollToSizeSelector();
            return;
        }

        // Apenas um gênero selecionado → pergunta se quer só 1 aliança
        if (!masc || !fem) {
            const selectedLabel = masc
                ? `Masculino <strong>${masc}</strong>`
                : `Feminino <strong>${fem}</strong>`;
            const halfFmt = (product.price / 2).toFixed(2).replace('.', ',');
            const fullFmt = product.price.toFixed(2).replace('.', ',');
            const res = await showCheckoutPopup({
                icon: '💍',
                title: 'Comprar Só 1 Aliança?',
                message: `Você selecionou apenas o tamanho ${selectedLabel}.<br><br>
                    👉 <strong>1 aliança</strong> — valor reduzido: <strong style="color:#d4af37">R$ ${halfFmt}</strong><br>
                    💑 <strong>Par completo</strong> — selecione também o outro tamanho para o valor cheio de R$ ${fullFmt}`,
                btnOk: '✅ Só 1 Aliança (R$ ' + halfFmt + ')',
                btnCancel: '💑 Completar o Par'
            });
            if (res === 'ok') {
                await showShippingPopup(product, true);
                buyViaMercadoPago(productId, product.price / 2);
            } else {
                // Direciona para o gênero ainda não selecionado
                const targetGender = masc ? 'Feminino' : 'Masculino';
                scrollToSizeSelector();
                setTimeout(() => {
                    document.querySelectorAll('.sz-gender-tab').forEach(t => {
                        if (t.textContent.includes(targetGender)) t.click();
                    });
                }, 500);
            }
            return;
        }

        // Ambos selecionados → popup de frete e compra
        await showShippingPopup(product);
        buyViaMercadoPago(productId);
        return;
    }

    // ── PULSEIRA: valida tamanho ──────────────────────────────────────────────
    if (sizeType === 'bracelet') {
        if (!window.selectedSize) {
            await showCheckoutPopup({
                icon: '📿',
                title: 'Escolha o Tamanho',
                message: 'Selecione o tamanho da pulseira para garantirmos o ajuste perfeito antes do envio! 😊',
                btnOk: 'Escolher Tamanho'
            });
            scrollToSizeSelector();
            return;
        }
        await showShippingPopup(product);
        buyViaMercadoPago(productId);
        return;
    }

    // ── SEM TAMANHO (outros produtos) → popup de frete direto ────────────────
    await showShippingPopup(product);
    buyViaMercadoPago(productId);
}

// 8. INICIALIZAÇÃO
async function initializeApp() {
    try {
        // Carregamento crítico: apenas categorias e produtos (above the fold)
        await Promise.all([
            loadCategories(),
            loadProducts(true)
        ]);

        renderCategories();
        applyHashCategory();
        applyHashCategoryBar();
        renderProducts();
        loadCartFromStorage();

        // Seções secundárias: carregadas após o evento 'load' (não bloqueia LCP/FCP)
        const loadSecondary = async () => {
            await Promise.allSettled([loadSiteSettings(), loadFaqs(), loadSocialProof(), loadReviews(), loadTeamCarousel()]);
            showSecondarySections();
        };

        if (document.readyState === 'complete') {
            'requestIdleCallback' in window
                ? requestIdleCallback(loadSecondary, { timeout: 3000 })
                : setTimeout(loadSecondary, 500);
        } else {
            window.addEventListener('load', () => {
                'requestIdleCallback' in window
                    ? requestIdleCallback(loadSecondary, { timeout: 3000 })
                    : setTimeout(loadSecondary, 500);
            }, { once: true });
        }
        
        // Header fixo — sem colapso

        // Detectar cidade/estado do cliente via IP
        initGeoLocationBackground();
        
        // Iniciar notificações geo-localizadas
        startGeoNotifications();

        // Contar visitas do dia (para toast de cliente recorrente)
        window._dailyVisitCount = _initVisitCounter();

        setTimeout(() => {
            const whatsappBtn = document.querySelector('.whatsapp-float');
            if (whatsappBtn) {
                whatsappBtn.style.opacity = '1';
                whatsappBtn.style.visibility = 'visible';
            }
        }, 8000);

        console.log('✅ Site carregado com sucesso!');

    } catch (error) {
        console.error('❌ Erro:', error);
    }
    
    // Event Listeners para modais e carrinho
    setupModalListeners();
    setupCartListeners();
    setupMiniCartListeners();
}

function setupModalListeners() {
    // Botão fechar modal
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeProductModal);
    }
    
    // Overlay do modal
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeProductModal);
    }
    
    // Botão fechar Super Zoom
    const superZoomClose = document.getElementById('superZoomClose');
    if (superZoomClose) {
        superZoomClose.addEventListener('click', closeSuperZoom);
    }
    
    // Tecla ESC para fechar modais
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const superZoom = document.getElementById('superZoomOverlay');
            const modal = document.getElementById('productModal');
            
            // Prioridade: Super Zoom > Modal
            if (superZoom && superZoom.style.display === 'flex') {
                closeSuperZoom();
            } else if (modal && modal.classList.contains('active')) {
                closeProductModal();
            }
        }
    });
}

function setupCartListeners() {
    // Botão do carrinho abre o MINI CARRINHO (dropdown) — ver setupMiniCartListeners
    const closeCartBtn = document.getElementById('closeCart');
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', () => {
            document.getElementById('cartSidebar').classList.remove('active');
            const overlay = document.getElementById('cartOverlay');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    const cartOverlay = document.getElementById('cartOverlay');
    if (cartOverlay) {
        cartOverlay.addEventListener('click', () => {
            document.getElementById('cartSidebar').classList.remove('active');
            cartOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    const clearCartBtn = document.getElementById('clearCartBtn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            cart = [];
            localStorage.setItem('etevalda_cart', JSON.stringify(cart));
            updateCartUI();
            showToast('Carrinho limpo!');
        });
    }
    
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                showToast('Carrinho vazio!');
                return;
            }
            
            let message = 'Olá! Gostaria de finalizar meu pedido:\n\n';
            cart.forEach(item => {
                message += `• ${item.name} - R$ ${item.price.toFixed(2).replace('.', ',')} (Qtd: ${item.quantity})\n`;
            });
            
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            message += `\nTotal: R$ ${total.toFixed(2).replace('.', ',')}`;

            trackEvent('Contact', { content_name: 'WhatsApp - Carrinho' });
            
            window.open(`https://api.whatsapp.com/send/?phone=556593475496&text=${encodeURIComponent(message)}`, '_blank');
        });
    }
}

// ========================================
// INICIALIZAÇÃO E EVENT LISTENERS
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();

    // ===== CAMPO DE BUSCA ATIVADO =====
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    if (searchInput) {
        const performSearch = () => {
            searchQuery = searchInput.value.trim();
            
            if (searchQuery.length > 0) {
                currentCategory = 'all';
                updateSectionVisibility('all');
            }
            
            loadProducts(true);
        };

        // Busca em tempo real (enquanto digita)
        searchInput.addEventListener('input', () => {
            clearTimeout(window.searchTimeout);
            window.searchTimeout = setTimeout(performSearch, 300);
        });

        // Busca ao clicar no botão
        if (searchBtn) {
            searchBtn.addEventListener('click', performSearch);
        }

        // ===== SUGESTÕES DE BUSCA (AUTOCOMPLETE) =====
        const searchDropdown = document.getElementById('searchDropdown');
        const searchResults = document.getElementById('searchResults');
        const searchCategoryList = document.getElementById('searchCategoryList');
        const searchOverlay = document.getElementById('searchOverlay');

        function toggleSearchOverlay(show) {
            if (searchOverlay) {
                searchOverlay.classList.toggle('active', show);
            }
        }

        if (searchDropdown && searchResults && searchCategoryList) {
            let suggestionIndex = -1;

            function getProductSource() {
                return allProductsCache.length > 0 ? allProductsCache : allProductsLoaded;
            }

            function renderSuggestions(query) {
                const q = query.trim().toLowerCase();

                // Always show categories when dropdown is open
                renderSearchCategories(q);

                if (q.length < 1) {
                    searchResults.innerHTML = '';
                    searchCategoryList.classList.remove('has-results');
                    searchDropdown.style.display = 'block';
                    toggleSearchOverlay(true);
                    return;
                }

                const source = getProductSource();
                if (source.length === 0) {
                    searchCategoryList.classList.remove('has-results');
                    searchDropdown.style.display = 'block';
                    toggleSearchOverlay(true);
                    return;
                }

                const matches = source.filter(p =>
                    p.name.toLowerCase().includes(q)
                ).slice(0, 5);

                suggestionIndex = -1;

                if (matches.length === 0) {
                    searchResults.innerHTML = '<div class="search-no-results">Nenhum produto encontrado</div>';
                    searchCategoryList.classList.remove('has-results');
                    searchDropdown.style.display = 'block';
                    toggleSearchOverlay(true);
                    return;
                }

                searchCategoryList.classList.add('has-results');

                const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedQ})`, 'gi');

                let html = matches.map(p => {
                    const price = p.price.toFixed(2).replace('.', ',');
                    const images = Array.isArray(p.images) ? p.images : [];
                    const img = images[0] || 'https://via.placeholder.com/50';
                    const nameHighlighted = p.name.replace(regex, '<strong style="color:var(--gold-primary)">$1</strong>');
                    return `
                        <div class="search-result-item" data-id="${p.id}">
                            <img src="${img}" alt="${p.name}" loading="lazy">
                            <div class="search-result-info">
                                <div class="search-result-name">${nameHighlighted}</div>
                                <div class="search-result-price">R$ ${price}</div>
                            </div>
                        </div>
                    `;
                }).join('');

                html += `
                    <div class="search-result-item search-view-all" data-action="viewall" data-query="${query}">
                        <div class="search-result-info" style="text-align:center;padding:10px;">
                            <span style="color:var(--gold-primary);font-weight:600;">🔍 Ver todos os resultados para "<span style="font-weight:800;">${query}</span>"</span>
                        </div>
                    </div>
                `;

                searchResults.innerHTML = html;
                searchDropdown.style.display = 'block';
                toggleSearchOverlay(true);
            }

            // Click delegation nos resultados
            searchResults.addEventListener('click', (e) => {
                const item = e.target.closest('.search-result-item');
                if (!item) return;

                const id = item.dataset.id;
                if (id) {
                    searchInput.value = '';
                    searchDropdown.style.display = 'none';
                    toggleSearchOverlay(false);
                    window.openProductModal(parseInt(id));
                    return;
                }

                const query = item.dataset.query;
                if (query) {
                    searchDropdown.style.display = 'none';
                    toggleSearchOverlay(false);
                    searchInput.value = query;
                    searchQuery = query;
                    currentCategory = 'all';
                    updateSectionVisibility('all');
                    loadProducts(true);
                }
            });

            // Navegação por teclado (setas + enter)
            searchInput.addEventListener('keydown', (e) => {
                if (searchDropdown.style.display !== 'block') return;
                const items = searchResults.querySelectorAll('.search-result-item');

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    suggestionIndex = Math.min(suggestionIndex + 1, items.length - 1);
                    items.forEach((el, i) => el.classList.toggle('active', i === suggestionIndex));
                    if (suggestionIndex >= 0) items[suggestionIndex].scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    suggestionIndex = Math.max(suggestionIndex - 1, -1);
                    items.forEach((el, i) => el.classList.toggle('active', i === suggestionIndex));
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    searchDropdown.style.display = 'none';
                    toggleSearchOverlay(false);
                    if (suggestionIndex >= 0 && items[suggestionIndex]) {
                        items[suggestionIndex].click();
                    } else {
                        performSearch();
                    }
                }
            });

            // Mostrar sugestões enquanto digita (mais rápido que a busca)
            let suggestTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(suggestTimeout);
                suggestTimeout = setTimeout(() => {
                    renderSuggestions(searchInput.value);
                }, 80);
            });

            // Esconder ao perder foco
            searchInput.addEventListener('blur', () => {
                setTimeout(() => {
                    searchDropdown.style.display = 'none';
                    toggleSearchOverlay(false);
                }, 200);
            });

            // Mostrar categorias ao focar (mesmo sem texto)
            searchInput.addEventListener('focus', () => {
                renderSuggestions(searchInput.value);
            });

            // Fechar ao clicar fora
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.header-search')) {
                    searchDropdown.style.display = 'none';
                    toggleSearchOverlay(false);
                }
            });

            // Fechar ao clicar no backdrop
            if (searchOverlay) {
                searchOverlay.addEventListener('click', () => {
                    searchDropdown.style.display = 'none';
                    toggleSearchOverlay(false);
                    searchInput.value = '';
                });
            }
        }
    }
    // ===== FIM DA ATIVAÇÃO DA BUSCA =====
});

// ========================================
// MOTOR DE MÚSICA SUPREMO (PC + IPHONE + ANDROID)
// ========================================

let bgMusic = null;
let musicStarted = false;
let originalVolume = 0.60; 
let isVideoPlaying = false;

const MUSICAS = [
    'https://rodriguesalex999-u.github.io/localizacao/eva00.mp3',
    'https://rodriguesalex999-u.github.io/localizacao/eva0.mp3',
    'https://rodriguesalex999-u.github.io/localizacao/eva1.mp3',
    'https://rodriguesalex999-u.github.io/localizacao/ytmusicaeva.mp3',
    'https://rodriguesalex999-u.github.io/localizacao/eva2.mp3'
];
let currentMusicIndex = 0;

function loadMusicIndex() {
    const saved = localStorage.getItem('etevalda_last_music_index');
    currentMusicIndex = saved !== null ? parseInt(saved) : 0;
}

function saveMusicIndex() {
    localStorage.setItem('etevalda_last_music_index', currentMusicIndex);
}

function playNextInSequence() {
    currentMusicIndex = (currentMusicIndex + 1) % MUSICAS.length;
    saveMusicIndex();
    if (bgMusic) {
        bgMusic.pause();
        bgMusic.src = MUSICAS[currentMusicIndex];
        bgMusic.load(); 
        bgMusic.play().catch(e => console.log("Toque na tela para ouvir a próxima"));
    }
}

function startBackgroundMusic() {
    bgMusic = document.getElementById('bgMusic');
    if (!bgMusic) return;

    loadMusicIndex();
    bgMusic.src = MUSICAS[currentMusicIndex];
    bgMusic.volume = originalVolume;
    
    // Essencial para iPhone e Android não bloquearem
    bgMusic.setAttribute('playsinline', 'true');
    bgMusic.load(); 

    bgMusic.addEventListener('ended', playNextInSequence);

    // TÉCNICA SUPREMA: Destravar o áudio no milésimo de segundo do toque
    const destravarNoToque = () => {
        if (!musicStarted && bgMusic) {
            // No celular, o play precisa ser IMEDIATO ao toque
            bgMusic.play().then(() => {
                musicStarted = true;
                console.log("✅ Som ativado no celular");
                // Uma vez ativado, removemos os avisos para economizar processamento
                document.removeEventListener('click', destravarNoToque);
                document.removeEventListener('touchstart', destravarNoToque);
            }).catch(e => {
                console.log("Navegador ainda bloqueando...");
            });
        }
    };

    // Tenta ligar sozinho (funciona no PC)
    bgMusic.play().then(() => { musicStarted = true; }).catch(() => {});

    // Gatilhos de toque para o celular
    document.addEventListener('click', destravarNoToque);
    document.addEventListener('touchstart', destravarNoToque);
}

function reduceBackgroundMusic() {
    if (!bgMusic) return;
    isVideoPlaying = true;
    bgMusic.volume = 0.08;
}

function restoreBackgroundMusic() {
    if (!bgMusic || isVideoPlaying === false) return;
    isVideoPlaying = false;
    bgMusic.volume = originalVolume;
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (bgMusic) bgMusic.pause();
    } else {
        // Quando volta pro site, toca música nova
        if (bgMusic && musicStarted && !isVideoPlaying) {
            playNextInSequence();
        }
    }
});

// LIGA O MOTOR IMEDIATAMENTE
startBackgroundMusic();

// ========================================
// INTEGRAÇÃO COM OS VÍDEOS DO MODAL
// ========================================

// Função para monitorar vídeos no modal (quando abrir)
function setupVideoAudioControl() {
    // Observa quando o modal é aberto para configurar os vídeos
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                // Verificar se há vídeos no modal
                const videos = document.querySelectorAll('#modalMainMedia video, .modal-main-media video');
                videos.forEach(video => {
                    // Evitar configurar múltiplas vezes
                    if (video.hasAttribute('data-audio-controlled')) return;
                    video.setAttribute('data-audio-controlled', 'true');
                    
                    // Quando o vídeo começar a tocar
                    video.addEventListener('play', function() {
                        reduceBackgroundMusic();
                    });
                    
                    // Quando o vídeo pausar
                    video.addEventListener('pause', function() {
                        restoreBackgroundMusic();
                    });
                    
                    // Quando o vídeo terminar
                    video.addEventListener('ended', function() {
                        restoreBackgroundMusic();
                    });
                    
                    // Quando o vídeo for removido
                    video.addEventListener('emptied', function() {
                        restoreBackgroundMusic();
                    });
                });
            }
        });
    });
    
    // Observar mudanças no modal
    const modal = document.getElementById('productModal');
    if (modal) {
        observer.observe(modal, { childList: true, subtree: true });
    }
    
    // Também observar quando o modal abre/fecha
    const originalOpenModal = window.openProductModal;
    if (originalOpenModal) {
        window.openProductModal = function(id) {
            // Chamar a função original
            originalOpenModal(id);
            // Aguardar o modal ser renderizado e configurar vídeos
            setTimeout(() => {
                const videos = document.querySelectorAll('#modalMainMedia video, .modal-main-media video');
                videos.forEach(video => {
                    if (video.hasAttribute('data-audio-controlled')) return;
                    video.setAttribute('data-audio-controlled', 'true');
                    
                    video.addEventListener('play', () => reduceBackgroundMusic());
                    video.addEventListener('pause', () => restoreBackgroundMusic());
                    video.addEventListener('ended', () => restoreBackgroundMusic());
                });
            }, 500);
        };
    }
    
    const originalCloseModal = window.closeProductModal;
    if (originalCloseModal) {
        window.closeProductModal = function() {
            originalCloseModal();
            // Quando fechar o modal, restaurar a música
            restoreBackgroundMusic();
        };
    }
}

// Iniciar o controle de vídeos após o carregamento
document.addEventListener('DOMContentLoaded', () => {
    setupVideoAudioControl();
});

// ========================================
// SELETOR DE NUMERAÇÃO / TAMANHO
// ========================================

function _sizeCategory(product) {
    const cat = (product.categories?.name || '').toLowerCase();
    if (cat.includes('alian') || cat.includes('anel')) return 'ring';
    if (cat.includes('corrente'))                       return 'chain';
    if (cat.includes('pulseira'))                       return 'bracelet';
    return 'ring'; // fallback padrão para tem_numeracao=true
}

function renderSizeSelectorHtml(product) {
    const type = product.size_type || (product.tem_numeracao ? _sizeCategory(product) : null);
    if (!type) return '';

    if (type === 'chain') {
        return `
        <div class="size-selector-wrap">
            <div class="size-chain-info">
                <i class="fas fa-ruler"></i>
                <span>Corrente <strong>70 cm</strong> <span class="size-badge-hot">mais vendido</span> ✅</span>
            </div>
        </div>`;
    }

    if (type === 'bracelet') {
        return `
        <div class="size-selector-wrap">
            <button class="size-toggle-btn" onclick="toggleSizePanel()">
                TAMANHO
                <i class="fas fa-chevron-down size-chevron" id="sizeChevron"></i>
            </button>
            <div class="size-panel" id="sizePanel">
                <div class="size-chips-row">
                    <button class="sz-chip sz-chip-active" onclick="selectSizeChip(this,'21 cm')">21</button>
                    <button class="sz-chip" onclick="selectSizeChip(this,'22 cm')">22</button>
                    <button class="sz-chip" onclick="selectSizeChip(this,'23 cm')">23</button>
                </div>
                <div class="size-confirm-msg" id="sizeConfirmMsg"></div>
            </div>
        </div>`;
    }

    // ring (aliaça / anel)
    const chips = Array.from({length: 27}, (_, i) => i + 10)
        .map(n => `<button class="sz-chip" onclick="selectSizeChip(this,'Nº ${n}')">${n}</button>`)
        .join('');
    return `
    <div class="size-selector-wrap">
        <button class="size-toggle-btn" onclick="toggleSizePanel()">
            NUMERAÇÃO
            <i class="fas fa-chevron-down size-chevron" id="sizeChevron"></i>
        </button>
        <div class="size-panel" id="sizePanel">
            <div class="size-gender-tabs">
                <button class="sz-gender-tab sz-gender-active" onclick="switchGenderTab(this,'Masculino')">&#128104; Masculino</button>
                <button class="sz-gender-tab" onclick="switchGenderTab(this,'Feminino')">&#128105; Feminino</button>
            </div>
            <div class="size-chips-row">${chips}</div>
            <div class="size-confirm-msg" id="sizeConfirmMsg"></div>
        </div>
    </div>`;
}

function setupSizeSelector(product) {
    window.selectedSize = null;
    window.selectedGender = 'Masculino';
    window.selectedSizeMasc = null;
    window.selectedSizeFem = null;
    window.selectedSizeType = product.size_type || (product.tem_numeracao ? _sizeCategory(product) : null);

    const type = window.selectedSizeType;
    if (!type) return;
    if (type === 'bracelet') {
        // Pre-select 21 and show panel open
        window.selectedSize = '21 cm';
        setTimeout(() => {
            const panel = document.getElementById('sizePanel');
            const chevron = document.getElementById('sizeChevron');
            if (panel) { panel.classList.add('size-panel-open'); }
            if (chevron) { chevron.style.transform = 'rotate(180deg)'; }
        }, 80);
    }
}

window.toggleSizePanel = function() {
    const panel = document.getElementById('sizePanel');
    const chevron = document.getElementById('sizeChevron');
    if (!panel) return;
    const open = panel.classList.toggle('size-panel-open');
    if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
};

window.switchGenderTab = function(btn, gender) {
    document.querySelectorAll('.sz-gender-tab').forEach(t => {
        t.classList.remove('sz-gender-active');
        t.classList.remove('sz-gender-tab-pulse');
    });
    btn.classList.add('sz-gender-active');
    window.selectedGender = gender;

    // Restore chip highlight for this gender's previously chosen size
    const saved = gender === 'Masculino' ? window.selectedSizeMasc : window.selectedSizeFem;
    document.querySelectorAll('.sz-chip').forEach(c => {
        c.classList.remove('sz-chip-active');
        if (saved && `Nº ${c.textContent.trim()}` === saved) c.classList.add('sz-chip-active');
    });
};

window.selectSizeChip = function(btn, size) {
    const isRing = window.selectedSizeType === 'ring';

    // Highlight only the clicked chip
    document.querySelectorAll('.sz-chip').forEach(c => c.classList.remove('sz-chip-active'));
    btn.classList.add('sz-chip-active');

    if (!isRing) {
        // Bracelet: single gender flow (unchanged)
        window.selectedSize = size;
        const conf = document.getElementById('sizeConfirmMsg');
        if (conf) {
            conf.innerHTML = `✅ Prontinho! Tamanho <strong>${size}</strong> selecionado. Agora é só clicar em Comprar — nossa equipe entrará em contato antes do envio. 😊`;
            conf.classList.add('size-confirm-show');
        }
        return;
    }

    // Ring: track per-gender
    const gender = window.selectedGender;
    if (gender === 'Masculino') {
        window.selectedSizeMasc = size;
    } else {
        window.selectedSizeFem = size;
    }

    const masc = window.selectedSizeMasc;
    const fem  = window.selectedSizeFem;
    const conf = document.getElementById('sizeConfirmMsg');

    if (masc && fem) {
        // Both selected — final message + auto-scroll to buy button
        window.selectedSize = `Masc. ${masc} / Fem. ${fem}`;
        document.querySelectorAll('.sz-gender-tab').forEach(t => t.classList.remove('sz-gender-tab-pulse'));
        if (conf) {
            conf.innerHTML = `✅ Prontinho! Masculino <strong>${masc}</strong> e Feminino <strong>${fem}</strong> selecionados. Agora é só clicar em <strong>Comprar Agora</strong>! 🛒`;
            conf.classList.add('size-confirm-show');
        }
        // Auto-scroll to buy button + pulse it
        setTimeout(() => {
            const mpBtn = document.querySelector('.btn-mercadopago-modal');
            if (mpBtn) {
                mpBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                mpBtn.classList.remove('mp-btn-glow');
                void mpBtn.offsetWidth;
                mpBtn.classList.add('mp-btn-glow');
                setTimeout(() => mpBtn.classList.remove('mp-btn-glow'), 2000);
            }
        }, 600);
    } else {
        // Only one selected — guide to the other
        window.selectedSize = gender === 'Masculino' ? `Masc. ${size}` : `Fem. ${size}`;
        const promptMsg = gender === 'Masculino'
            ? `✅ Masculino <strong>${size}</strong> selecionado. Agora escolha o tamanho <strong>feminino</strong> ao lado! 👉`
            : `✅ Feminino <strong>${size}</strong> selecionado. Agora escolha o tamanho <strong>masculino</strong> ao lado! 👈`;
        if (conf) {
            conf.innerHTML = promptMsg;
            conf.classList.add('size-confirm-show');
        }
        // Pulse the other tab
        document.querySelectorAll('.sz-gender-tab').forEach(t => {
            if (!t.classList.contains('sz-gender-active')) {
                t.classList.remove('sz-gender-tab-pulse');
                void t.offsetWidth;
                t.classList.add('sz-gender-tab-pulse');
            }
        });
        // Auto-switch to the other gender tab after 1.5s
        setTimeout(() => {
            document.querySelectorAll('.sz-gender-tab').forEach(t => {
                if (!t.classList.contains('sz-gender-active')) t.click();
            });
        }, 1500);
    }
};

// ========================================
// PRÉ-CARREGAMENTO INTELIGENTE DE IMAGENS
// ========================================
function preloadNearbyImages() {
    if (!window.IntersectionObserver) return;
    
    const preloadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const originalSrc = img.getAttribute('data-src');
                if (originalSrc && !img.src) {
                    img.src = originalSrc;
                }
                preloadObserver.unobserve(img);
            }
        });
    }, {
        rootMargin: '300px 0px 300px 0px'
    });
    
    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        preloadObserver.observe(img);
    });
}

// Chamar após cada renderização de produtos de forma segura
if (typeof window._renderInitialized === 'undefined') {
    window._renderInitialized = true;
    const originalRender = renderProducts;
    window.renderProducts = function() {
        originalRender();
        setTimeout(preloadNearbyImages, 100);
    };
}

// ========================================
// FUNÇÕES GLOBAIS (MANTIDAS)
// ========================================

window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.toggleCart = toggleCart;
window.closeCart = closeCart;
window.buyViaWhatsApp = buyViaWhatsApp;
window.buyViaMercadoPago = buyViaMercadoPago;
window.handleBuyClick = handleBuyClick;
window.hoverImage = hoverImage;
window.unhoverImage = unhoverImage;
window.openSuperZoom = openSuperZoom;
window.closeSuperZoom = closeSuperZoom;
window.changeZoom = changeZoom;
window.changeModalMedia = changeModalMedia;
window.shareProduct = shareProduct;
window.trackEvent = trackEvent;

// Exportar funções para uso global
window.handleFloatingWhatsApp = handleFloatingWhatsApp;
window.sendWhatsAppMessage = sendWhatsAppMessage;