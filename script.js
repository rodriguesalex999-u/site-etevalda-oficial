// ========================================
// GRUPO ETEVALDA MT - MOBILE-FIRST SCRIPT
// VERSÃO OTIMIZADA PARA COREWEBVITALS
// ========================================

// ========================================
// 1. CONFIGURAÇÃO DO SUPABASE
// ========================================
const SUPABASE_URL = 'https://vnrfmsyanrvqqhmqyixk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xGLDFQarl-DhshRW0932FQ_asug0TUK';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========================================
// 2. ESTADO DA APLICAÇÃO
// ========================================
let products = [];
let categories = [];
let allReviews = [];
let faqs = [];
let socialProofImages = [];
let cart = [];
let currentCategory = 'all';
let searchQuery = '';

// Variáveis para Lazy Loading - Mobile first: 6 produtos
let currentPage = 1;
let productsPerPage = 12; // Aumentado para 12 para garantir que o sensor saia da tela inicial
let hasMoreProducts = true;
let isLoadingMore = false;
let allProductsLoaded = [];

// Variáveis do modal
let currentModalProduct = null;
let currentMediaList = [];

// Variáveis do Super Zoom
let currentZoomIndex = 0;
let superZoomMediaList = [];

// Variáveis para Touch Swipe
let touchStartX = 0;
let touchEndX = 0;

// Variáveis para o cronômetro de entrega
let deliveryTimerInterval = null;

// Link do WhatsApp
const WHATSAPP_BASE_URL = 'https://api.whatsapp.com/send/?phone=5565993337205&text=Já%20vi%20seu%20catálogo,%20quero%20comprar,%20consegue%20me%20entregar%20hoje?&type=phone_number&app_absent=0';

// Configuração da imagem da equipe
let teamImageUrl = '';

// ========================================
// 3. DICIONÁRIO DE BAIRROS
// ========================================
const NEIGHBORHOODS = {
    'Cuiabá': ['CPA', 'Pedra 90', 'Boa Esperança', 'Jardim das Américas', 'Centro', 'Jardim Europa', 'Bandeirantes', 'Goiabeiras'],
    'Várzea Grande': ['Cristo Rei', 'Parque do Lago', 'Mapim', 'Centro', 'Jardim América', 'Morada do Ouro']
};
const CUSTOMER_NAMES = [
    'Ana', 'Bruna', 'Carla', 'Daniela', 'Fernanda', 'Gabriela', 'Helena', 'Isabela',
    'João', 'Pedro', 'Lucas', 'Mateus', 'Rafael', 'Thiago'
];
let detectedLocation = { city: 'Cuiabá', neighborhoods: NEIGHBORHOODS['Cuiabá'] };

// ========================================
// 4. PWA - SMART INSTALL PROMPT
// ========================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const hasSeenPrompt = localStorage.getItem('pwa_prompt_shown');

    if (!hasSeenPrompt) {
        setTimeout(() => {
            showInstallPrompt();
        }, 165000);
    }
});

function showInstallPrompt() {
    if (localStorage.getItem('pwa_prompt_shown')) return;

    const promptBanner = document.createElement('div');
    promptBanner.id = 'pwa-install-banner';
    promptBanner.className = 'pwa-install-banner';
    promptBanner.innerHTML = `
        <div class="pwa-banner-content">
            <div class="pwa-icon"><i class="fas fa-crown"></i></div>
            <div class="pwa-text">
                <strong>Instale o App Etevalda MT</strong>
                <span>Tenha acesso rápido e ofertas exclusivas</span>
            </div>
            <div class="pwa-buttons">
                <button class="pwa-install-btn">Instalar App</button>
                <button class="pwa-later-btn">Agora não</button>
            </div>
        </div>
    `;

    document.body.appendChild(promptBanner);

    setTimeout(() => {
        promptBanner.classList.add('show');
    }, 100);

    promptBanner.querySelector('.pwa-install-btn').addEventListener('click', async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('Usuário aceitou instalar o PWA');
            trackPWAInteraction('installed');
        }

        deferredPrompt = null;
        promptBanner.remove();
    });

    promptBanner.querySelector('.pwa-later-btn').addEventListener('click', () => {
        trackPWAInteraction('dismissed');
        promptBanner.remove();
    });
}

function trackPWAInteraction(action) {
    localStorage.setItem('pwa_prompt_shown', 'true');
    localStorage.setItem('pwa_action', action);
    localStorage.setItem('pwa_timestamp', Date.now().toString());
}

// ========================================
// 5. MANIFEST.JSON
// ========================================
function createManifest() {
    const manifest = {
        name: 'Etevalda MT',
        short_name: 'Etevalda',
        description: 'A maior loja de variedades de Mato Grosso',
        start_url: '/',
        display: 'standalone',
        background_color: '#D4AF37',
        theme_color: '#D4AF37',
        icons: []
    };

    const manifestString = JSON.stringify(manifest);
    const blob = new Blob([manifestString], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(blob);

    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'manifest';
        document.head.appendChild(link);
    }
    link.href = manifestURL;
}

// ========================================
// 6. FUNÇÃO PARA FILTRAR IMAGENS POSTIMG.CC
// ========================================
function isValidImageUrl(url) {
    // Se existir um link, ele é válido. Simples assim.
    return url && url.trim() !== '';
}

function filterValidImages(images) {
    if (!Array.isArray(images)) return [];
    return images.filter(img => isValidImageUrl(img));
}

// ========================================
// 7. INICIALIZAÇÃO PRINCIPAL - OTIMIZADA
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Grupo Etevalda MT - Versão Tempo Real');

    // Criar manifest PWA
    createManifest();

    try {
        renderSkeleton();
        // CARREGAMENTO PRIORITÁRIO: Produtos e Categorias
        await loadCategories();
        await loadProducts(true);
        
        // Configurar LCP - Preload da primeira imagem válida
        setupLCPPreload();
        
        // Renderização imediata dos produtos
        renderCategories();
        renderProducts();
        
        // Carregar carrinho do localStorage
        loadCartFromStorage();
        
        // Configurar eventos essenciais
        setupEventListeners();
        setupHistoryAPI();
        setupInfiniteScroll();
        setupScrollListener();
        
        // Inicializar busca preditiva
        initPredictiveSearch();
        
        // CARREGAMENTO NÃO PRIORITÁRIO (após 3 segundos)
        setTimeout(async () => {
            try {
                await loadReviews();
                await loadFaqs();
                await loadSocialProof();
                await loadTeamImage(); // NOVO: Carregar imagem da equipe
                
                // Renderizar seções secundárias
                renderCarousel();
                renderSocialProof();
                renderFaqs();
                
                // Mostrar as seções com fade-in
                showSecondarySections();
                
                // Iniciar geolocalização
                initGeoLocationBackground();
                
                // Timer da equipe
                startTeamTimer();
                
                // SuperZoom listeners
                setupSuperZoomListeners();
                
                // Touch listeners
                if ('ontouchstart' in window) {
                    setupTouchListeners();
                }
                
                console.log('✅ Seções secundárias carregadas');
            } catch (error) {
                console.error('Erro ao carregar seções secundárias:', error);
            }
        }, 3000);

        // Tawk.to após 10 segundos (conforme regra)
        setTimeout(() => {
            loadTawkTo();
        }, 10000);

    } catch (error) {
        console.error('❌ Erro:', error);
        showToast('Erro ao carregar produtos');
    } finally {
        setTimeout(() => showLoading(false), 500);
    }
});

// NOVA FUNÇÃO: Carregar Tawk.to apenas após 10s
function loadTawkTo() {
    var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
    (function() {
        var s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
        s1.async = true;
        s1.src = 'https://embed.tawk.to/65e8a3d28d261e1b5f5f8b2a/1hoh7vq1q';
        s1.charset = 'UTF-8';
        s1.setAttribute('crossorigin', '*');
        s0.parentNode.insertBefore(s1, s0);
    })();
}

// NOVA FUNÇÃO: Configurar LCP com preload da primeira imagem válida
function setupLCPPreload() {
    if (allProductsLoaded.length === 0) return;
    
    // Encontrar o primeiro produto com imagem válida (não postimg.cc)
    const firstValidProduct = allProductsLoaded.find(p => {
        const images = filterValidImages(p.images);
        return images.length > 0;
    });
    
    if (firstValidProduct) {
        const validImages = filterValidImages(firstValidProduct.images);
        if (validImages.length > 0) {
            const lcpPreload = document.getElementById('lcpPreload');
            if (lcpPreload) {
                lcpPreload.href = validImages[0];
                lcpPreload.setAttribute('imagesrcset', validImages[0]);
                console.log('🎯 LCP Preload configurado:', validImages[0]);
            }
        }
    }
}

// NOVA FUNÇÃO: Carregar imagem da equipe do banco de dados
async function loadTeamImage() {
    try {
        const { data, error } = await _supabase
            .from('social_proof')
            .select('image_url')
            .eq('caption', 'TEAM_IMAGE') // <-- ESTA É A LINHA NOVA
            .order('id', { ascending: false })
            .limit(1);
        
        if (!error && data && data.length > 0) {
            teamImageUrl = data[0].image_url;
        } else {
            // Fallback para uma imagem padrão (que não seja postimg.cc)
            teamImageUrl = 'https://via.placeholder.com/800x450?text=Equipe+Etevalda';
        }
        
        // Atualizar a imagem da equipe
        const teamImg = document.getElementById('teamImage');
        if (teamImg) {
            teamImg.src = teamImageUrl;
            teamImg.onerror = () => {
                teamImg.src = 'https://via.placeholder.com/800x450?text=Equipe+Etevalda';
            };
        }
    } catch (error) {
        console.error('Erro ao carregar imagem da equipe:', error);
    }
}

// ========================================
// 8. FUNÇÕES DE CARREGAMENTO (COM FILTRO POSTIMG.CC)
// ========================================
async function loadProducts(reset = false) {
    if (reset) {
        currentPage = 1;
        allProductsLoaded = [];
        hasMoreProducts = true; 
    }

    if (!hasMoreProducts || isLoadingMore) return;

    isLoadingMore = true;
    if (!reset) showLoadingMore();

    try {
        // Iniciamos a busca
        let query = _supabase.from('products').select('*');

        if (currentCategory !== 'all') {
            // Se for uma categoria (ex: Moeda Antiga), filtra por ela
            query = query.eq('category_id', currentCategory).order('id', { ascending: false }).limit(1000); 
            hasMoreProducts = false;    
        } else {
            // Se for "Todos", busca de forma aleatória estratégica usando o random_index
            const from = (currentPage - 1) * productsPerPage;
            const to = from + productsPerPage - 1;
            query = query.order('random_index').range(from, to);
            hasMoreProducts = true;
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
            let filteredData = data.filter(p => {
                const validImages = filterValidImages(p.images);
                return validImages.length > 0;
            }).map(p => ({
                ...p,
                images: filterValidImages(p.images)
            }));

            // AQUI ESTÁ O SEGREDO: Se for a aba "Todos", embaralha o novo pacote que chegou
            if (currentCategory === 'all') {
                filteredData = filteredData.sort(() => Math.random() - 0.5);
            }

            allProductsLoaded = reset ? filteredData : [...allProductsLoaded, ...filteredData];
            products = allProductsLoaded;

            // Se o banco mandou menos que 10, é porque acabaram os produtos
            if (currentCategory === 'all' && data.length < productsPerPage) {
                hasMoreProducts = false;
            }
            currentPage++;
        } else {
            hasMoreProducts = false;
        }

        renderProducts(); // Monta a vitrine na tela

    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    } finally {
        isLoadingMore = false;
        hideLoadingMore();
        showLoading(false);
    }
}

async function loadCategories() {
    const { data } = await _supabase.from('categories').select('*').order('id');
    categories = data || [];
}

async function loadReviews() {
    const { data } = await _supabase
        .from('reviews')
        .select('*, products(name)')
        .order('id', { ascending: false });
    allReviews = data || [];
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
    
    // Filtrar URLs inválidas
    socialProofImages = (data || []).filter(item => isValidImageUrl(item.image_url));
}

// ========================================
// 9. RENDERIZAÇÃO DE PRODUTOS (COM FILTRO)
// ========================================
function renderProductCard(p, index) { // Adicionado o "index" aqui
    const images = Array.isArray(p.images) ? p.images : [];
    const mainImage = images[0] || 'https://via.placeholder.com/200';
    
    // MELHORIA DE PERFORMANCE: As 2 primeiras imagens carregam na hora (eager), o resto só no scroll (lazy)
    const loadingStrategy = index < 2 ? 'eager' : 'lazy';
    const priority = index === 0 ? 'fetchpriority="high"' : '';
    const secondImage = images[1] || mainImage;
    const priceFormatted = p.price.toFixed(2).replace('.', ',');

    const solitarioHtml = p.tem_solitario && p.solitario_price && p.solitario_price > 0
        ? `<div class="product-solitario"><i class="fas fa-gem"></i> Solitário: R$ ${p.solitario_price.toFixed(2).replace('.', ',')}</div>`
        : '';

    const soldTodayHtml = p.sold_today ? `<div class="product-sold-today">Vendido Hoje</div>` : '';

    return `
        <div class="product-card"
            onclick="openProductModal(${p.id})"
            onmouseenter="hoverImage(this, '${secondImage}')"
            onmouseleave="unhoverImage(this, '${mainImage}')"
            ontouchstart="hoverImage(this, '${secondImage}')"
            ontouchend="unhoverImage(this, '${mainImage}')"
            data-main-image="${mainImage}"
            data-second-image="${secondImage}">
            <div class="product-image">
                ${soldTodayHtml}
                ${p.badge_text ? `<div class="product-badge">${p.badge_text}</div>` : ''}
<img src="${mainImage}" alt="${p.name}" loading="${loadingStrategy}" ${priority} onerror="this.src='https://via.placeholder.com/200'">            </div>
            <div class="product-info">
                <span class="product-category">${p.categories?.name || ''}</span>
                <h3 class="product-name">${p.name}</h3>
                <div class="product-price">R$ ${priceFormatted}</div>
                ${solitarioHtml}
                <div class="product-buttons" onclick="event.stopPropagation()">
                    <button class="btn-primary" onclick="addToCart(${p.id})">
                        <i class="fas fa-cart-plus"></i>
                    </button>
                    <button class="btn-secondary" aria-label="Comprar ${p.name} pelo WhatsApp" onclick="buyViaWhatsApp(${p.id})">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.hoverImage = function(card, secondImage) {
    const img = card.querySelector('.product-image img');
    const mainImage = card.dataset.mainImage;
    if (secondImage !== mainImage) {
        img.src = secondImage;
    }
};

window.unhoverImage = function(card, mainImage) {
    const img = card.querySelector('.product-image img');
    img.src = mainImage;
};

function renderProducts() {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    let filtered = allProductsLoaded.filter(p => {
        const matchCat = currentCategory === 'all' || String(p.category_id) === String(currentCategory);
        const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">Nenhum produto encontrado</p>';
        return;
    }

    // ADICIONADO: Agora passamos a posição (index) para o card saber se deve carregar rápido ou devagar
    container.innerHTML = filtered.map((p, index) => renderProductCard(p, index)).join('');
}

function renderCategories() {
    const list = document.getElementById('categoryList');
    if (!list) return;

    list.innerHTML = '<li class="active" data-category="all">Todos</li>';

    categories.forEach(cat => {
        list.innerHTML += `<li data-category="${cat.id}">${cat.name}</li>`;
    });

    list.querySelectorAll('li').forEach(button => {
        button.addEventListener('click', () => {
            list.querySelectorAll('li').forEach(el => el.classList.remove('active'));
            button.classList.add('active');
            
            // RESET TOTAL PARA NOVA CATEGORIA
            currentCategory = button.dataset.category;
            currentPage = 1; 
            allProductsLoaded = []; 
            hasMoreProducts = true; 

            // Limpa a vitrine visualmente na hora
            const container = document.getElementById('productsContainer');
            if (container) container.innerHTML = ''; 
            
            showLoading(true); 
            loadProducts(true); // Dispara a busca do zero no banco 
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

function renderFaqs() {
    const grid = document.getElementById('faqGrid');
    if (!grid) return;

    if (!faqs || faqs.length === 0) {
        grid.innerHTML = '<p>Nenhuma FAQ</p>';
        return;
    }

    grid.innerHTML = faqs.map(f => `
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
}

window.playFaqAudio = function(card) {
    const audio = card.querySelector('audio');
    if (audio) {
        if (audio.paused) {
            audio.play();
            card.querySelector('.faq-icon i').className = 'fas fa-stop';
        } else {
            audio.pause();
            audio.currentTime = 0;
            card.querySelector('.faq-icon i').className = 'fas fa-play';
        }
    }
};

function renderSocialProof() {
    const grid = document.getElementById('socialProofGrid');
    if (!grid) return;

    if (!socialProofImages || socialProofImages.length === 0) {
        grid.innerHTML = '<p style="text-align:center;">Nenhuma imagem de prova social disponível</p>';
        return;
    }

    grid.innerHTML = socialProofImages.slice(0, 3).map(item => `
        <div class="social-proof-card">
            <div class="social-proof-image">
                <img src="${item.image_url}" alt="Prova Social" loading="lazy" style="aspect-ratio: 1/1; object-fit: cover;">
            </div>
            <div class="social-proof-overlay">
                <p class="social-proof-text">${item.caption || 'Cliente satisfeito'}</p>
            </div>
        </div>
    `).join('');
}

function renderCarousel() {
    const carousel = document.getElementById('infiniteCarousel');
    if (!carousel || !allProductsLoaded.length) return;

    const carouselProducts = [...allProductsLoaded, ...allProductsLoaded];
    carousel.innerHTML = carouselProducts.map(p => {
        const images = Array.isArray(p.images) ? p.images : [];
        return `
            <div class="carousel-item" onclick="openProductModal(${p.id})">
                <img src="${images[0] || 'https://via.placeholder.com/150'}" alt="${p.name}" loading="lazy" style="aspect-ratio: 1/1; object-fit: cover;">
                <div class="carousel-item-info">
                    <div class="carousel-item-name">${p.name}</div>
                    <div class="carousel-item-price">R$ ${p.price.toFixed(2).replace('.', ',')}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// 10. DEMAIS FUNÇÕES (RESUMIDAS PARA ECONOMIA DE ESPAÇO)
// ========================================
function showSecondarySections() {
    const sections = ['socialProofSection', 'faqSection', 'carouselSection'];
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) {
            section.style.opacity = '1';
            section.style.height = 'auto';
            section.style.overflow = 'visible';
        }
    });
}

function showLoading(status) {
    const skeletons = document.querySelectorAll('.product-card.skeleton');
    if (status) {
        skeletons.forEach(s => s.style.display = 'block');
    } else {
        skeletons.forEach(s => s.style.display = 'none');
    }
}

function showLoadingMore() {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    if (document.getElementById('loadingMore')) return;
    
    const loadingEl = document.createElement('div');
    loadingEl.id = 'loadingMore';
    loadingEl.className = 'loading-more';
    loadingEl.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Carregando mais produtos...</p>
    `;
    container.appendChild(loadingEl);
}

function hideLoadingMore() {
    const loadingEl = document.getElementById('loadingMore');
    if (loadingEl) loadingEl.remove();
}

function setupInfiniteScroll() {
    const trigger = document.getElementById('infinite-scroll-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        // Se o sensor aparecer na tela e não estivermos carregando nada...
        if (entries[0].isIntersecting && !isLoadingMore && hasMoreProducts) {
            if (currentCategory === 'all') {
                loadProducts(false);
            }
        }
    }, {
        rootMargin: '100px' // Sensibilidade ajustada
    });

    observer.observe(trigger);
}

function setupScrollListener() {
    const header = document.querySelector('.header');
    const scrollThreshold = 100;
    let isCollapsed = false;

    window.addEventListener('scroll', debounce(() => {
        const scrollPosition = window.scrollY;
        const shouldBeCollapsed = scrollPosition > scrollThreshold;

        if (shouldBeCollapsed !== isCollapsed) {
            isCollapsed = shouldBeCollapsed;
            if (shouldBeCollapsed) {
                header.classList.add('header-collapsed');
            } else {
                header.classList.remove('header-collapsed');
            }
        }
    }, 10));
}

function setupHistoryAPI() {
    window.addEventListener('popstate', (event) => {
        const modal = document.getElementById('productModal');
        const isModalOpen = modal && modal.classList.contains('active');
        const superZoomOverlay = document.getElementById('superZoomOverlay');
        const isSuperZoomOpen = superZoomOverlay && superZoomOverlay.classList.contains('active');
        
        if (isSuperZoomOpen) {
            event.preventDefault();
            closeSuperZoom();
            return;
        }
        if (isModalOpen) {
            event.preventDefault();
            closeProductModal();
            if (location.hash.startsWith('#product-')) {
                history.replaceState(null, '', location.pathname + location.search);
            }
            return;
        }
        if (location.hash.startsWith('#product-')) {
            history.replaceState(null, '', location.pathname + location.search);
        }
    });
}

function setupTouchListeners() {
    const modalContent = document.querySelector('.modal-content');
    if (!modalContent) return;

    modalContent.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    modalContent.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const swipeThreshold = 50;
    if (touchEndX < touchStartX - swipeThreshold) {
        nextMedia();
    }
    if (touchEndX > touchStartX + swipeThreshold) {
        prevMedia();
    }
}

function nextMedia() {
    if (!currentMediaList || currentMediaList.length === 0) return;
    const thumbs = document.querySelectorAll('.modal-thumb');
    let currentIndex = 0;
    thumbs.forEach((thumb, index) => {
        if (thumb.classList.contains('active')) currentIndex = index;
    });
    const nextIndex = (currentIndex + 1) % thumbs.length;
    changeModalMedia(nextIndex);
    showToast(`Foto ${nextIndex + 1} de ${thumbs.length}`);
}

function prevMedia() {
    if (!currentMediaList || currentMediaList.length === 0) return;
    const thumbs = document.querySelectorAll('.modal-thumb');
    let currentIndex = 0;
    thumbs.forEach((thumb, index) => {
        if (thumb.classList.contains('active')) currentIndex = index;
    });
    const prevIndex = (currentIndex - 1 + thumbs.length) % thumbs.length;
    changeModalMedia(prevIndex);
    showToast(`Foto ${prevIndex + 1} de ${thumbs.length}`);
}

function setupVideoAudioControl(videoElement, hasAudio = true) {
    if (!videoElement) return;
    videoElement.muted = true;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.loop = true;

    if (hasAudio) {
        const audioBtn = document.createElement('button');
        audioBtn.className = 'video-audio-toggle';
        audioBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        audioBtn.setAttribute('aria-label', 'Ativar áudio');

        audioBtn.onclick = (e) => {
            e.stopPropagation();
            if (videoElement.muted) {
                videoElement.currentTime = 0;
                videoElement.muted = false;
                videoElement.play().catch(err => console.log('Autoplay bloqueado:', err));
                audioBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                audioBtn.setAttribute('aria-label', 'Desativar áudio');
            } else {
                videoElement.muted = true;
                audioBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
                audioBtn.setAttribute('aria-label', 'Ativar áudio');
            }
        };

        const container = videoElement.parentElement;
        if (container) {
            container.style.position = 'relative';
            container.appendChild(audioBtn);
        }
    }
}

async function openProductModal(id) {
    const { data: product, error } = await _supabase
        .from('products')
        .select('*, categories!category_id(name)')
        .eq('id', id)
        .single();

    if (error || !product) {
        console.error("Erro ao carregar detalhes:", error);
        return;
    }

    currentModalProduct = product;
    currentMediaList = [];

    if (product.video_url && product.video_url.trim()) {
        currentMediaList.push({
            type: 'video',
            url: product.video_url,
            thumbnail: product.images?.[0] || ''
        });
    }

    let images = Array.isArray(product.images) ? product.images : [];
    images.forEach(img => {
        if (img) {
            currentMediaList.push({
                type: 'image',
                url: img,
                thumbnail: img
            });
        }
    });

    const productReviews = allReviews.filter(r => r.is_general || r.product_id === id);
    let upsellProducts = allProductsLoaded.filter(p =>
        p.id !== product.id && p.category_id === product.category_id
    ).slice(0, 12);

    let crossSellProducts = [];
    if (product.related_keywords) {
        const keywords = product.related_keywords.toLowerCase().split(',').map(k => k.trim());
        crossSellProducts = allProductsLoaded.filter(p => {
            if (p.id === product.id) return false;
            if (!p.related_keywords) return false;
            const productKeywords = p.related_keywords.toLowerCase().split(',').map(k => k.trim());
            return keywords.some(k => productKeywords.includes(k));
        }).slice(0, 12);
    }

    if (crossSellProducts.length === 0) {
        crossSellProducts = allProductsLoaded.filter(p =>
            p.id !== product.id && p.category_id === product.category_id
        ).slice(0, 12);
    }

    const priceFormatted = product.price.toFixed(2).replace('.', ',');
    const solitarioFormatted = product.solitario_price?.toFixed(2).replace('.', ',');
    const rating = product.default_rating || 5;
    const viewersCount = Math.floor(Math.random() * 9) + 4;

    const thumbnailsHtml = currentMediaList.map((media, index) => `
    <div class="modal-thumb ${media.type === 'video' ? 'video-thumb' : ''} ${index === 0 ? 'active' : ''}" onclick="changeModalMedia(${index})">
        <img src="${media.thumbnail}" alt="">
        ${index === 0 && product.badge_text ? `<span class="thumb-badge">${product.badge_text}</span>` : ''}
    </div>
`).join('');

    const solitarioHtml = product.tem_solitario && product.solitario_price > 0 ? `
        <div class="solitario-discreto">
            <i class="fas fa-gem"></i> Solitário vendido separadamente: R$ ${solitarioFormatted}
        </div>
    ` : '';

    const modalHtml = `
    <div class="modal-gallery">
        <div class="modal-main-media" id="modalMainMedia" style="position: relative;">
            ${currentMediaList[0]?.type === 'video'
                ? `<video src="${currentMediaList[0].url}" autoplay muted loop playsinline></video>`
                : `<img src="${currentMediaList[0]?.url || ''}" alt="${product.name}">`}
            ${product.badge_text ? `<div class="product-badge modal-badge">${product.badge_text}</div>` : ''}
            ${product.sold_today ? `<div class="product-sold-today modal-sold-today">Vendido Hoje</div>` : ''}
        </div>
    </div>
        <div class="modal-thumbnails">${thumbnailsHtml}</div>
        <div class="modal-info">
            <span class="modal-category">${product.categories?.name || ''}</span>
            <h2 class="modal-title">${product.name}</h2>
            <div class="modal-price-main">R$ ${priceFormatted}</div>
            ${solitarioHtml}
            <div class="looking-now"><i class="fas fa-eye"></i> ${viewersCount} pessoas vendo agora</div>
            <div class="urgency-box">
                <div class="delivery-timer" id="deliveryTimer">
                    <i class="fas fa-clock"></i>
                    <span class="timer-countdown">00h 00m 00s</span>
                    <span class="timer-text">para receber hoje!</span>
                </div>
            </div>
            <div class="product-rating-large">${renderStars(rating)}</div>
            <div class="modal-buttons">
                <button class="btn-add-cart-modal" onclick="addToCart(${product.id})"><i class="fas fa-cart-plus"></i> Carrinho</button>
                <button class="btn-whatsapp-modal" aria-label="Falar com atendente no WhatsApp sobre este produto" 
                onclick="buyViaWhatsApp(${product.id})"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                <button class="btn-share" onclick="shareProduct(${product.id})"><i class="fas fa-share-alt"></i> <span>COMPARTILHE<br>COM SEU AMOR</span></button>
            </div>
            ${product.description ? `<div class="modal-description">${product.description}</div>` : ''}
            
            ${upsellProducts.length > 0 ? `
                <div class="recommendations-section">
                    <h4 class="recommendations-title"><i class="fas fa-handshake"></i> Quem viu, também gostou</h4>
                    <div class="recommendations-grid">
                        ${upsellProducts.map(r => `
                            <div class="rec-card" onclick="openProductModal(${r.id})">
                                <img src="${Array.isArray(r.images) ? r.images[0] : ''}" alt="${r.name}">
                                <h4>${r.name}</h4>
                                <div class="price">R$ ${r.price.toFixed(2).replace('.', ',')}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${crossSellProducts.length > 0 ? `
                <div class="cross-sell-section">
                    <h4 class="cross-sell-title"><i class="fas fa-link"></i> Complemente seu Estilo</h4>
                    <div class="cross-sell-grid">
                        ${crossSellProducts.map(r => `
                            <div class="cross-sell-card" onclick="openProductModal(${r.id}); scrollToTop();">
                                <img src="${Array.isArray(r.images) ? r.images[0] : ''}" alt="${r.name}">
                                <div class="info">
                                    <div class="name">${r.name}</div>
                                    <div class="price">R$ ${r.price.toFixed(2).replace('.', ',')}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHtml;
    document.getElementById('productModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('modalContainer').scrollTop = 0; // Garante o reset em todos os navegadores
    startDeliveryTimer();
    history.pushState({ modalOpen: true, productId: id }, '', `#product-${id}`);
    setupModalMediaClick();
    setupModalVideoAudio(product.video_has_audio);
    setupNextPhotoButton();
    scrollToTop();
}

function renderStars(rating) {
    const fullStars = '★'.repeat(rating);
    const emptyStars = '☆'.repeat(5 - rating);
    return `<span class="stars">${fullStars}${emptyStars}</span>`;
}

function setupNextPhotoButton() {
    const nextBtn = document.getElementById('nextPhotoBtn');
    if (!nextBtn) return;
    if (currentMediaList.length > 1) {
        nextBtn.style.display = 'flex';
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            nextMedia();
        };
    } else {
        nextBtn.style.display = 'none';
    }
}

function setupModalMediaClick() {
    const mainMedia = document.getElementById('modalMainMedia');
    if (!mainMedia) return;
    const img = mainMedia.querySelector('img');
    const video = mainMedia.querySelector('video');

    if (img) {
        img.style.cursor = 'zoom-in';
        img.onclick = (e) => {
            e.stopPropagation();
            const activeThumb = document.querySelector('.modal-thumb.active');
            let currentIndex = 0;
            if (activeThumb) {
                const thumbs = document.querySelectorAll('.modal-thumb');
                thumbs.forEach((thumb, index) => {
                    if (thumb.classList.contains('active')) currentIndex = index;
                });
            }
            openSuperZoom(img.src, 'image', currentMediaList, currentIndex);
        };
    }

    if (video) {
        video.style.cursor = 'zoom-in';
        video.onclick = (e) => {
            e.stopPropagation();
            const activeThumb = document.querySelector('.modal-thumb.active');
            let currentIndex = 0;
            if (activeThumb) {
                const thumbs = document.querySelectorAll('.modal-thumb');
                thumbs.forEach((thumb, index) => {
                    if (thumb.classList.contains('active')) currentIndex = index;
                });
            }
            openSuperZoom(video.src, 'video', currentMediaList, currentIndex);
        };
    }
}

function setupModalVideoAudio(hasAudio = true) {
    const mainMedia = document.getElementById('modalMainMedia');
    if (!mainMedia) return;
    const video = mainMedia.querySelector('video');
    if (video) {
        setupVideoAudioControl(video, hasAudio);
    }
}

function changeModalMedia(index) {
    if (!currentMediaList[index]) return;
    const media = currentMediaList[index];
    const mainContainer = document.getElementById('modalMainMedia');
    const hasAudio = currentModalProduct?.video_has_audio ?? true;

    if (media.type === 'video') {
        mainContainer.innerHTML = `<video src="${media.url}" autoplay muted loop playsinline></video>`;
        setupModalVideoAudio(hasAudio);
        setupModalMediaClick();
    } else {
        mainContainer.innerHTML = `<img src="${media.url}" alt="">`;
        setupModalMediaClick();
    }

    document.querySelectorAll('.modal-thumb').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    document.body.style.overflow = '';
    currentModalProduct = null;
    currentMediaList = [];
    if (deliveryTimerInterval) {
        clearInterval(deliveryTimerInterval);
        deliveryTimerInterval = null;
    }
    if (history.state?.modalOpen) {
        history.replaceState(null, '', location.pathname + location.search);
    }
}

function scrollToTop() {
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        modalContent.scrollTop = 0;
    }
}

function openSuperZoom(mediaUrl, type = 'image', mediaList = [], currentIndex = 0) {
    const overlay = document.getElementById('superZoomOverlay');
    const content = document.getElementById('superZoomContent');
    if (!overlay || !content) return;
    
    superZoomMediaList = mediaList.length > 0 ? mediaList : [{ url: mediaUrl, type: type }];
    currentZoomIndex = currentIndex;
    
    renderSuperZoomMedia();

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    history.pushState({ superZoomOpen: true }, '', '#super-zoom');
    setupSuperZoomSwipe();
}

function closeSuperZoom() {
    const overlay = document.getElementById('superZoomOverlay');
    const content = document.getElementById('superZoomContent');
    if (!overlay || !content) return;

    overlay.classList.remove('active');
    content.innerHTML = '';
    document.body.style.overflow = '';
    if (location.hash === '#super-zoom') {
        history.replaceState(null, '', location.pathname + location.search);
    }
}

function renderSuperZoomMedia() {
    const content = document.getElementById('superZoomContent');
    if (!content || superZoomMediaList.length === 0) return;
    
    const currentMedia = superZoomMediaList[currentZoomIndex];
    const hasMultiple = superZoomMediaList.length > 1;
    
    let navigationHTML = '';
    if (hasMultiple) {
        navigationHTML = `
            <button class="super-zoom-nav super-zoom-prev" onclick="prevSuperZoomMedia()">
                <i class="fas fa-chevron-left"></i>
            </button>
            <button class="super-zoom-nav super-zoom-next" onclick="nextSuperZoomMedia()">
                <i class="fas fa-chevron-right"></i>
            </button>
            <button class="next-photo-btn" onclick="nextSuperZoomMedia()">
                <i class="fas fa-arrow-right"></i>
            </button>
            <div class="super-zoom-counter">${currentZoomIndex + 1} / ${superZoomMediaList.length}</div>
        `;
    }
    
    let mediaHTML = '';
    if (currentMedia.type === 'video') {
    mediaHTML = `<video src="${currentMedia.url}" controls autoplay loop playsinline style="max-width:100%;max-height:90vh;object-fit:contain;"></video>`;
    } else {
    mediaHTML = `<img src="${currentMedia.url}" alt="Zoom" style="max-width:100%;max-height:90vh;object-fit:contain;">`;
}

// Botão WhatsApp no super zoom
if (currentModalProduct) {
    const product = currentModalProduct;
    let whatsappMessage = `Olá! Gostei do produto: *${product.name}* - R$ ${product.price.toFixed(2).replace('.', ',')}`;
    
    if (product.tem_solitario && product.solitario_price > 0) {
        const total = product.price + product.solitario_price;
        whatsappMessage = `Olá! Gostei do produto: *${product.name}* + *Solitário* (R$ ${product.solitario_price.toFixed(2).replace('.', ',')}) - Total: R$ ${total.toFixed(2).replace('.', ',')}`;
    }
    
    whatsappMessage += `. Consegue me entregar hoje?`;
    
    mediaHTML += `
        <a href="https://api.whatsapp.com/send/?phone=5565993337205&text=${encodeURIComponent(whatsappMessage)}" 
           target="_blank" 
           class="zoom-whatsapp-btn highlighted">
           <i class="fab fa-whatsapp"></i> FALAR NO WHATSAPP
        </a>
    `;
}

// Adicionar badge no super zoom
if (currentZoomIndex === 0 && currentModalProduct) { // Só no primeiro item da lista
    if (currentModalProduct.badge_text) {
        mediaHTML += `<div class="super-zoom-badge">${currentModalProduct.badge_text}</div>`;
    }
    if (currentModalProduct.sold_today) {
        mediaHTML += `<div class="super-zoom-sold">Vendido Hoje</div>`;
    }
}
    
    content.innerHTML = `
        ${navigationHTML}
        <div class="super-zoom-media-container">
            ${mediaHTML}
        </div>
    `;
}

function nextSuperZoomMedia() {
    if (superZoomMediaList.length <= 1) return;
    currentZoomIndex = (currentZoomIndex + 1) % superZoomMediaList.length;
    renderSuperZoomMedia();
    showToast(`Foto ${currentZoomIndex + 1} de ${superZoomMediaList.length}`);
}

function prevSuperZoomMedia() {
    if (superZoomMediaList.length <= 1) return;
    currentZoomIndex = (currentZoomIndex - 1 + superZoomMediaList.length) % superZoomMediaList.length;
    renderSuperZoomMedia();
    showToast(`Foto ${currentZoomIndex + 1} de ${superZoomMediaList.length}`);
}

function setupSuperZoomListeners() {
    document.getElementById('superZoomOverlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'superZoomOverlay') {
            closeSuperZoom();
        }
    });

    document.getElementById('superZoomClose')?.addEventListener('click', closeSuperZoom);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSuperZoom();
        }
    });
}

function setupSuperZoomSwipe() {
    const overlay = document.getElementById('superZoomOverlay');
    if (!overlay) return;
    
    let touchStartX = 0;
    let touchEndX = 0;
    
    overlay.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    overlay.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSuperZoomSwipe();
    }, { passive: true });
    
    function handleSuperZoomSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) < swipeThreshold) return;
        if (diff > 0) {
            nextSuperZoomMedia();
        } else {
            prevSuperZoomMedia();
        }
    }
}

async function shareProduct(id) {
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
            await navigator.share(shareData);
            showToast('Compartilhado com sucesso!');
        } else {
            navigator.clipboard.writeText(shareData.url);
            showToast('Link copiado para a área de transferência!');
        }
    } catch (err) {
        console.log('Compartilhamento cancelado ou erro:', err);
    }
}

function startDeliveryTimer() {
    const timerElement = document.getElementById('deliveryTimer');
    if (!timerElement) return;
    
    if (deliveryTimerInterval) {
        clearInterval(deliveryTimerInterval);
    }
    
    let savedTime = sessionStorage.getItem('deliveryTimerTime');
    let startTime = savedTime ? parseInt(savedTime) : Date.now();
    const totalTime = 2 * 60 * 60 * 1000;
    
    function updateTimer() {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, totalTime - elapsed);
        
        if (remaining === 0) {
            timerElement.innerHTML = `
                <i class="fas fa-clock"></i>
                <span class="delivery-today">Receba hoje e só pague na entrega</span>
            `;
            sessionStorage.removeItem('deliveryTimerTime');
            return;
        }
        
        const totalSeconds = Math.floor(remaining / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        timerElement.innerHTML = `
            <i class="fas fa-clock"></i>
            <span class="timer-countdown">${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}</span>
            <span class="timer-text">para receber hoje!</span>
        `;
        
        sessionStorage.setItem('deliveryTimerTime', startTime.toString());
    }
    
    updateTimer();
    deliveryTimerInterval = setInterval(updateTimer, 1000);
}

function addToCart(productId) {
    const product = allProductsLoaded.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: Array.isArray(product.images) ? product.images[0] : '',
            quantity: 1
        });
    }

    saveCart();
    updateCartUI();
    animateCart();
    showToast('Adicionado ao carrinho!');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {
        removeFromCart(productId);
    } else {
        saveCart();
        updateCartUI();
    }
}

function clearCart() {
    if (cart.length && confirm('Limpar carrinho?')) {
        cart = [];
        saveCart();
        updateCartUI();
        closeCart();
    }
}

function saveCart() {
    localStorage.setItem('grupoetevalda_cart', JSON.stringify(cart));
}

function loadCartFromStorage() {
    const saved = localStorage.getItem('grupoetevalda_cart');
    if (saved) {
        cart = JSON.parse(saved);
        updateCartUI();
    }
}

function updateCartUI() {
    const container = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const countEl = document.getElementById('cartCount');

    if (!container) return;

    let total = 0;
    let qtdTotal = 0;

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">Carrinho vazio</p>';
        totalEl.textContent = 'R$ 0,00';
        countEl.textContent = '0';
        countEl.style.display = 'none';
        return;
    }

    container.innerHTML = cart.map(item => {
        total += item.price * item.quantity;
        qtdTotal += item.quantity;
        return `
            <div class="cart-item">
                <img src="${item.image}" alt="">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">R$ ${item.price.toFixed(2).replace('.', ',')}</div>
                    <div class="cart-item-quantity">
                        <button onclick="updateQuantity(${item.id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="updateQuantity(${item.id}, 1)">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${item.id})"><i class="fas fa-times"></i></button>
            </div>
        `;
    }).join('');

    totalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    countEl.textContent = qtdTotal;
    countEl.style.display = qtdTotal > 0 ? 'flex' : 'none';
}

function animateCart() {
    const cartBtn = document.getElementById('cartBtn');
    if (!cartBtn) return;
    cartBtn.classList.add('cart-bounce', 'cart-glow');
    setTimeout(() => {
        cartBtn.classList.remove('cart-bounce', 'cart-glow');
    }, 500);
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
}

function closeCart() {
    document.getElementById('cartSidebar').classList.remove('active');
    document.getElementById('cartOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function checkoutWhatsApp() {
    if (cart.length === 0) {
        showToast('Carrinho vazio!');
        return;
    }

    let itemsList = '';
    let total = 0;

    cart.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        itemsList += `${index + 1}. ${item.name} (x${item.quantity}) - R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
    });

    const message = `🛍️ *NOVO PEDIDO*\n${itemsList}\n💰 *Total: R$ ${total.toFixed(2).replace('.', ',')}*\nPago na entrega.`;
    const url = `https://api.whatsapp.com/send/?phone=5565993337205&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
    window.open(url, '_blank');
}

function buyViaWhatsApp(id) {
    const p = allProductsLoaded.find(p => p.id === id);
    if (!p) {
        window.open(WHATSAPP_BASE_URL, '_blank');
        return;
    }

    let msg = `Olá! Gostei do produto: *${p.name}* - R$ ${p.price.toFixed(2).replace('.', ',')}`;
    
    if (p.tem_solitario && p.solitario_price > 0) {
        const total = p.price + p.solitario_price;
        msg = `Olá! Gostei do produto: *${p.name}* + *Solitário* (R$ ${p.solitario_price.toFixed(2).replace('.', ',')}) - Total: R$ ${total.toFixed(2).replace('.', ',')}`;
    }
    
    msg += `. Consegue me entregar hoje?`;
    
    const url = `https://api.whatsapp.com/send/?phone=5565993337205&text=${encodeURIComponent(msg)}&type=phone_number&app_absent=0`;
    window.open(url, '_blank');
}

function handleSearch(query) {
    searchQuery = query;
    renderProducts();

    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) {
        setTimeout(() => { dropdown.style.display = 'none'; }, 200);
    }
}

function resetFilters() {
    searchQuery = '';
    currentCategory = 'all';
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('.category-list li').forEach(li => {
        li.classList.toggle('active', li.dataset.category === 'all');
    });

    renderProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initPredictiveSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchDropdown = document.getElementById('searchDropdown');
    const searchResults = document.getElementById('searchResults');

    if (!searchInput) return;

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchDropdown?.contains(e.target)) {
            if (searchDropdown) searchDropdown.style.display = 'none';
        }
    });

    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.trim().toLowerCase();
        handleSearch(query);

        if (query.length < 2 || !searchDropdown || !searchResults) {
            if (searchDropdown) searchDropdown.style.display = 'none';
            return;
        }

        const results = allProductsLoaded.filter(p =>
            p.name.toLowerCase().includes(query)
        ).slice(0, 5);

        if (results.length > 0) {
            searchResults.innerHTML = results.map(p => `
                <div class="search-result-item" onclick="openProductModal(${p.id}); searchDropdown.style.display='none';">
                    <img src="${Array.isArray(p.images) ? p.images[0] : ''}" alt="">
                    <div class="search-result-info">
                        <div class="search-result-name">${p.name}</div>
                        <div class="search-result-price">R$ ${p.price.toFixed(2).replace('.', ',')}</div>
                    </div>
                </div>
            `).join('');
            searchDropdown.style.display = 'block';
        } else {
            searchResults.innerHTML = '<div class="search-no-results">Nada encontrado</div>';
            searchDropdown.style.display = 'block';
        }
    }, 300));
}

async function initGeoLocationBackground() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.city && NEIGHBORHOODS[data.city]) {
            detectedLocation = { city: data.city, neighborhoods: NEIGHBORHOODS[data.city] };
        }
        startGeoNotifications();
    } catch {
        startGeoNotifications();
    }
}

function startGeoNotifications() {
    setTimeout(showGeoNotification, 25000);
    setInterval(showGeoNotification, 120000);
}

function showGeoNotification() {
    if (!allProductsLoaded.length) return;

    const neighborhood = detectedLocation.neighborhoods[Math.floor(Math.random() * detectedLocation.neighborhoods.length)];
    const customerName = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
    const randomProduct = allProductsLoaded[Math.floor(Math.random() * allProductsLoaded.length)];

    const notification = document.getElementById('geoNotification');
    const notificationText = document.getElementById('geoNotificationText');

    if (notification && notificationText) {
        notificationText.innerHTML = `<strong>${customerName}</strong> do <strong>${neighborhood}</strong> comprou <strong>${randomProduct.name}</strong>`;
        notification.style.display = 'block';
        setTimeout(() => notification.style.display = 'none', 8000);
    }
}

function startTeamTimer() {
    setTimeout(() => {
        const section = document.getElementById('teamSection');
        if (section) {
            section.style.display = 'block';
            setTimeout(() => section.classList.add('visible'), 100);
        }
    }, 20000);
}

function setupEventListeners() {
    document.getElementById('modalCloseBtn')?.addEventListener('click', closeProductModal);
    document.getElementById('modalOverlay')?.addEventListener('click', closeProductModal);
    document.getElementById('cartBtn')?.addEventListener('click', toggleCart);
    document.getElementById('closeCart')?.addEventListener('click', closeCart);
    document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
    document.getElementById('checkoutBtn')?.addEventListener('click', checkoutWhatsApp);
    document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);
    document.getElementById('searchBtn')?.addEventListener('click', () => {
        const input = document.getElementById('searchInput');
        if (input) handleSearch(input.value);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProductModal();
            closeCart();
            closeSuperZoom();
        }
    });
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function debounce(fn, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}
// ========================================
// FUNÇÃO RENDER SKELETON
// ========================================
function renderSkeleton() {
    const container = document.getElementById('productsContainer');
    if (!container) return;
    
    const skeletons = document.querySelectorAll('.product-card.skeleton');
    if (skeletons.length > 0) {
        skeletons.forEach(s => s.style.display = 'block');
    } else {
        container.innerHTML = `
            <div class="product-card skeleton"><div class="skeleton-image"></div><div class="product-info"><div class="skeleton-text skeleton-title"></div><div class="skeleton-text skeleton-price"></div></div></div>
            <div class="product-card skeleton"><div class="skeleton-image"></div><div class="product-info"><div class="skeleton-text skeleton-title"></div><div class="skeleton-text skeleton-price"></div></div></div>
            <div class="product-card skeleton"><div class="skeleton-image"></div><div class="product-info"><div class="skeleton-text skeleton-title"></div><div class="skeleton-text skeleton-price"></div></div></div>
            <div class="product-card skeleton"><div class="skeleton-image"></div><div class="product-info"><div class="skeleton-text skeleton-title"></div><div class="skeleton-text skeleton-price"></div></div></div>
            <div class="product-card skeleton"><div class="skeleton-image"></div><div class="product-info"><div class="skeleton-text skeleton-title"></div><div class="skeleton-text skeleton-price"></div></div></div>
            <div class="product-card skeleton"><div class="skeleton-image"></div><div class="product-info"><div class="skeleton-text skeleton-title"></div><div class="skeleton-text skeleton-price"></div></div></div>
        `;
    }
}

// ========================================
// FUNÇÃO PARA CARREGAR SUGESTÕES (QUEM VIU TAMBÉM GOSTOU)
// ========================================
async function showEndCategorySuggestions() {
    const container = document.getElementById('end-category-suggestions');
    const grid = document.getElementById('suggestionsGrid');
    if (!container || !grid) return;

    // Se já estiver visível, não faz nada
    if (container.style.display === 'block') return;

    // Busca 10 produtos de OUTRAS categorias
    const { data: suggestions } = await _supabase
        .from('products')
        .select('*, categories(name)')
        .neq('category_id', currentCategory) 
        .order('random_index')
        .limit(10);

    if (suggestions && suggestions.length > 0) {
        grid.innerHTML = suggestions.map((p, index) => renderProductCard(p, index + 100)).join('');
        container.style.display = 'block';
    }
}

// Expor funções globais
window.openProductModal = openProductModal;
window.changeModalMedia = changeModalMedia;
window.closeProductModal = closeProductModal;
window.buyViaWhatsApp = buyViaWhatsApp;
window.resetFilters = resetFilters;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.toggleCart = toggleCart;
window.closeCart = closeCart;
window.checkoutWhatsApp = checkoutWhatsApp;
window.clearCart = clearCart;
window.handleSearch = handleSearch;
window.playFaqAudio = playFaqAudio;
window.scrollToTop = scrollToTop;
window.openSuperZoom = openSuperZoom;
window.nextSuperZoomMedia = nextSuperZoomMedia;
window.prevSuperZoomMedia = prevSuperZoomMedia;
window.closeSuperZoom = closeSuperZoom;
window.hoverImage = hoverImage;
window.unhoverImage = unhoverImage;
window.nextMedia = nextMedia;
window.prevMedia = prevMedia;
window.shareProduct = shareProduct;