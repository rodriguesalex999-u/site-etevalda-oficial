// ========================================
// GRUPO ETEVALDA MT - MOBILE-FIRST SCRIPT
// VERSÃO PERFEITA COM DESLIZE TOUCH
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

// Variáveis do modal
let currentModalProduct = null;
let currentMediaList = [];

// Variáveis do Super Zoom e Touch
let superZoomCurrentIndex = 0;
let superZoomMediaList = [];
let superZoomClickCount = 0;
let touchStartX = 0;
let touchEndX = 0;

// Link do WhatsApp
const WHATSAPP_BASE_URL = 'https://api.whatsapp.com/send/?phone=5565993337205&text=Já%20vi%20seu%20catálogo,%20quero%20comprar,%20consegue%20me%20entregar%20hoje?&type=phone_number&app_absent=0';

// Bairros para geolocalização
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
// 3. INICIALIZAÇÃO
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Grupo Etevalda MT - Com Deslize Touch');
    showLoading(true);
    
    try {
        await loadCategories();
        await loadProducts();
        await loadReviews();
        await loadFaqs();
        await loadSocialProof();
        loadCartFromStorage();
        renderCategories();
        renderProducts();
        renderCarousel();
        renderSocialProof();
        renderFaqs();
        setupEventListeners();
        setupHistoryAPI();
        setupSuperZoomListeners();
        setupTouchListeners(); // NOVA FUNÇÃO PARA DESLIZE
        startTeamTimer();
        initPredictiveSearch();
        initGeoLocationBackground();
        
        console.log(`✅ ${products.length} produtos carregados`);
    } catch (error) {
        console.error('❌ Erro:', error);
        showToast('Erro ao carregar produtos');
    } finally {
        setTimeout(() => showLoading(false), 500);
    }
});

function showLoading(status) {
    const skeletons = document.querySelectorAll('.product-card.skeleton');
    if (status) {
        skeletons.forEach(s => s.style.display = 'block');
    } else {
        skeletons.forEach(s => s.style.display = 'none');
    }
}

// ========================================
// 4. NOVA FUNÇÃO: SETUP TOUCH LISTENERS
// ========================================
function setupTouchListeners() {
    const superZoomOverlay = document.getElementById('superZoomOverlay');
    
    if (superZoomOverlay) {
        superZoomOverlay.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        });
        
        superZoomOverlay.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipeGesture();
        });
    }
}

function handleSwipeGesture() {
    const swipeThreshold = 50; // Sensibilidade do deslize
    
    if (touchEndX < touchStartX - swipeThreshold) {
        // Deslizou para esquerda - próxima foto
        nextSuperZoomPhoto();
    }
    
    if (touchEndX > touchStartX + swipeThreshold) {
        // Deslizou para direita - foto anterior
        prevSuperZoomPhoto();
    }
}

function nextSuperZoomPhoto() {
    if (!superZoomMediaList.length) return;
    
    superZoomCurrentIndex = (superZoomCurrentIndex + 1) % superZoomMediaList.length;
    displaySuperZoomMedia(superZoomCurrentIndex);
    showToast('→ Foto ' + (superZoomCurrentIndex + 1) + ' de ' + superZoomMediaList.length);
}

function prevSuperZoomPhoto() {
    if (!superZoomMediaList.length) return;
    
    superZoomCurrentIndex = (superZoomCurrentIndex - 1 + superZoomMediaList.length) % superZoomMediaList.length;
    displaySuperZoomMedia(superZoomCurrentIndex);
    showToast('← Foto ' + (superZoomCurrentIndex + 1) + ' de ' + superZoomMediaList.length);
}

// ========================================
// 5. HISTORY API
// ========================================
function setupHistoryAPI() {
    window.addEventListener('popstate', (event) => {
        if (event.state?.modalOpen || location.hash.startsWith('#product-')) {
            closeProductModal();
            if (location.hash.startsWith('#product-')) {
                history.replaceState(null, '', location.pathname + location.search);
            }
        }
    });
}

// ========================================
// 6. SUPER ZOOM FUNCTIONS
// ========================================
function openSuperZoom(mediaUrl, type = 'image') {
    const overlay = document.getElementById('superZoomOverlay');
    const content = document.getElementById('superZoomContent');
    const wppBtn = document.getElementById('superZoomWppBtn');
    const nextBtn = document.getElementById('nextPhotoBtn');
    
    if (!overlay || !content) return;

    superZoomClickCount = 1;
    superZoomCurrentIndex = 0;
    superZoomMediaList = currentMediaList;

    displaySuperZoomMedia(superZoomCurrentIndex);
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Mostrar botão de próxima foto se houver mais de uma mídia
    if (nextBtn) {
        if (superZoomMediaList.length > 1) {
            nextBtn.style.display = 'flex';
            // Adicionar evento ao botão
            nextBtn.onclick = (e) => {
                e.stopPropagation();
                nextSuperZoomPhoto();
            };
        } else {
            nextBtn.style.display = 'none';
        }
    }

    // Configurar botão WhatsApp
    if (currentModalProduct) {
        const msg = `Olá! Quero este produto: *${currentModalProduct.name}* - R$ ${currentModalProduct.price.toFixed(2).replace('.', ',')}`;
        wppBtn.href = `https://api.whatsapp.com/send/?phone=5565993337205&text=${encodeURIComponent(msg)}&type=phone_number&app_absent=0`;
        wppBtn.style.display = 'flex';
        wppBtn.classList.remove('highlight');
    }

    overlay.onclick = handleSuperZoomClick;
}

function displaySuperZoomMedia(index) {
    const content = document.getElementById('superZoomContent');
    const wppBtn = document.getElementById('superZoomWppBtn');
    if (!content || !superZoomMediaList[index]) return;

    const media = superZoomMediaList[index];
    if (media.type === 'video') {
        content.innerHTML = `<video src="${media.url}" autoplay muted loop playsinline></video>`;
    } else {
        content.innerHTML = `<img src="${media.url}" alt="">`;
    }

    // Destacar botão WhatsApp na última foto
    if (index === superZoomMediaList.length - 1) {
        wppBtn.classList.add('highlight');
    } else {
        wppBtn.classList.remove('highlight');
    }
}

function handleSuperZoomClick(e) {
    if (e.target.closest('.super-zoom-wpp-btn') || e.target.closest('.super-zoom-close') || e.target.closest('.btn-next-photo')) {
        return;
    }

    superZoomClickCount++;

    if (superZoomClickCount === 2) {
        nextSuperZoomPhoto();
    } else if (superZoomClickCount >= 3) {
        closeSuperZoom();
    }
}

function closeSuperZoom() {
    const overlay = document.getElementById('superZoomOverlay');
    const content = document.getElementById('superZoomContent');
    const wppBtn = document.getElementById('superZoomWppBtn');
    const nextBtn = document.getElementById('nextPhotoBtn');
    
    if (!overlay || !content) return;

    overlay.classList.remove('active');
    content.innerHTML = '';
    wppBtn.style.display = 'none';
    wppBtn.classList.remove('highlight');
    if (nextBtn) nextBtn.style.display = 'none';
    document.body.style.overflow = '';
    superZoomClickCount = 0;
    superZoomMediaList = [];
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

// ========================================
// 7. CONTROLE DE ÁUDIO
// ========================================
function setupVideoAudioControl(videoElement) {
    if (!videoElement) return;
    
    videoElement.muted = true;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.loop = true;
    
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

// ========================================
// 8. FUNÇÕES DE CARREGAMENTO
// ========================================
async function loadCategories() {
    const { data } = await _supabase.from('categories').select('*').order('id');
    categories = data || [];
}

async function loadProducts() {
    const { data } = await _supabase
        .from('products')
        .select('*, categories!category_id(name)')
        .order('id');
    products = data || [];
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
    socialProofImages = data || [];
}

// ========================================
// 9. RENDERIZAÇÃO
// ========================================
function renderCategories() {
    const list = document.getElementById('categoryList');
    if (!list) return;
    
    list.innerHTML = '<li class="active" data-category="all">Todos</li>';
    
    categories.forEach(cat => {
        list.innerHTML += `<li data-category="${cat.id}">${cat.name}</li>`;
    });
    
    list.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', () => {
            list.querySelectorAll('li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            currentCategory = li.dataset.category;
            renderProducts();
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
        const fallbackCards = [
            { image: 'https://i.postimg.cc/HnbpfGbh/Equipeee.jpg', text: 'Clientes satisfeitos' },
            { image: 'https://i.postimg.cc/wj65vgfr/Funcionarios.jpg', text: 'Tradição em MT' }
        ];
        
        grid.innerHTML = fallbackCards.map(item => `
            <div class="social-proof-card">
                <div class="social-proof-image">
                    <img src="${item.image}" alt="Prova Social" loading="lazy">
                </div>
                <div class="social-proof-overlay">
                    <p class="social-proof-text">${item.text}</p>
                </div>
            </div>
        `).join('');
        return;
    }
    
    grid.innerHTML = socialProofImages.slice(0, 3).map(item => `
        <div class="social-proof-card">
            <div class="social-proof-image">
                <img src="${item.image_url}" alt="Prova Social" loading="lazy">
            </div>
            <div class="social-proof-overlay">
                <p class="social-proof-text">${item.caption || 'Cliente satisfeito'}</p>
            </div>
        </div>
    `).join('');
}

function renderCarousel() {
    const carousel = document.getElementById('infiniteCarousel');
    if (!carousel || !products.length) return;
    
    const carouselProducts = [...products, ...products];
    
    carousel.innerHTML = carouselProducts.map(p => {
        const images = Array.isArray(p.images) ? p.images : [];
        return `
            <div class="carousel-item" onclick="openProductModal(${p.id})">
                <img src="${images[0] || 'https://via.placeholder.com/150'}" alt="${p.name}" loading="lazy">
                <div class="carousel-item-info">
                    <div class="carousel-item-name">${p.name}</div>
                    <div class="carousel-item-price">R$ ${p.price.toFixed(2).replace('.', ',')}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderStars(rating) {
    const fullStars = '★'.repeat(rating);
    const emptyStars = '☆'.repeat(5 - rating);
    return `<span class="stars">${fullStars}${emptyStars}</span>`;
}

// ========================================
// 10. RENDERIZAÇÃO DE PRODUTOS
// ========================================
function renderProductCard(p) {
    const images = Array.isArray(p.images) ? p.images : [];
    const mainImage = images[0] || 'https://via.placeholder.com/200';
    const secondImage = images[1] || mainImage;
    const priceFormatted = p.price.toFixed(2).replace('.', ',');
    
    const solitarioHtml = p.tem_solitario && p.solitario_price && p.solitario_price > 0
        ? `<div class="product-solitario"><i class="fas fa-gem"></i> Solitário: R$ ${p.solitario_price.toFixed(2).replace('.', ',')}</div>`
        : '';
    
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
                ${p.badge_text ? `<div class="product-badge">${p.badge_text}</div>` : ''}
                <img src="${mainImage}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/200'">
            </div>
            <div class="product-info">
                <span class="product-category">${p.categories?.name || ''}</span>
                <h3 class="product-name">${p.name}</h3>
                <div class="product-price">R$ ${priceFormatted}</div>
                ${solitarioHtml}
                <div class="product-buttons" onclick="event.stopPropagation()">
                    <button class="btn-primary" onclick="addToCart(${p.id})">
                        <i class="fas fa-cart-plus"></i>
                    </button>
                    <button class="btn-secondary" onclick="buyViaWhatsApp(${p.id})">
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
    
    let filtered = products.filter(p => {
        const matchCat = currentCategory === 'all' || p.category_id == currentCategory;
        const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px;">Nenhum produto encontrado</p>';
        return;
    }
    
    if (currentCategory === 'all' && !searchQuery) {
        filtered = filtered.sort(() => Math.random() - 0.5);
    }
    
    container.innerHTML = filtered.map(p => renderProductCard(p)).join('');
}

// ========================================
// 11. MODAL DE PRODUTO
// ========================================
function openProductModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    currentModalProduct = product;
    currentMediaList = [];
    
    if (product.video_url && product.video_url.trim()) {
        currentMediaList.push({
            type: 'video',
            url: product.video_url,
            thumbnail: product.images?.[0] || ''
        });
    }
    
    let images = [];
    if (Array.isArray(product.images)) {
        images = product.images;
    } else if (typeof product.images === 'string') {
        images = product.images.split(',').map(img => img.trim());
    }
    
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
    
    // Upsell e cross-sell (mantido igual)
    let upsellProducts = [];
    if (product.upsell_category) {
        upsellProducts = products.filter(p =>
            p.id !== product.id &&
            p.categories?.name?.toLowerCase().includes(product.upsell_category.toLowerCase())
        ).slice(0, 12);
    } else if (product.category_id) {
        upsellProducts = products.filter(p =>
            p.id !== product.id &&
            p.category_id === product.category_id
        ).slice(0, 12);
    }
    
    let crossSellProducts = [];
    if (product.related_keywords) {
        const keywords = product.related_keywords.toLowerCase().split(',').map(k => k.trim());
        crossSellProducts = products.filter(p => {
            if (p.id === product.id) return false;
            if (!p.related_keywords) return false;
            const productKeywords = p.related_keywords.toLowerCase().split(',').map(k => k.trim());
            return keywords.some(k => productKeywords.includes(k));
        }).slice(0, 12);
    }
    
    if (crossSellProducts.length === 0 && product.category_id) {
        crossSellProducts = products.filter(p =>
            p.id !== product.id &&
            p.category_id === product.category_id
        ).slice(0, 12);
    }
    
    const priceFormatted = product.price.toFixed(2).replace('.', ',');
    const solitarioFormatted = product.solitario_price?.toFixed(2).replace('.', ',');
    const rating = product.default_rating || 5;
    
    const thumbnailsHtml = currentMediaList.map((media, index) => `
        <div class="modal-thumb ${media.type === 'video' ? 'video-thumb' : ''} ${index === 0 ? 'active' : ''}" onclick="changeModalMedia(${index})">
            <img src="${media.thumbnail}" alt="">
        </div>
    `).join('');
    
    // NOTA: O swipe-indicator foi REMOVIDO (display: none no CSS)
    
    const modalHtml = `
        <div class="modal-gallery">
            <div class="modal-main-media" id="modalMainMedia">
                ${currentMediaList[0]?.type === 'video'
                    ? `<video src="${currentMediaList[0].url}" autoplay muted loop playsinline></video>`
                    : `<img src="${currentMediaList[0]?.url || ''}" alt="${product.name}">`}
            </div>
        </div>
        <div class="modal-thumbnails">
            ${thumbnailsHtml}
        </div>
        <div class="modal-info">
            <span class="modal-category">${product.categories?.name || ''}</span>
            <h2 class="modal-title">${product.name}</h2>
            <div class="modal-price-main">R$ ${priceFormatted}</div>
            ${product.tem_solitario && product.solitario_price > 0 ? `
                <div style="font-size:1rem; color:var(--gold-dark); margin:10px 0; background:var(--gold-light); padding:10px; border-radius:var(--radius-sm); text-align:center;">
                    <i class="fas fa-gem"></i> Solitário vendido separadamente: R$ ${solitarioFormatted}
                </div>
            ` : ''}
            <div class="product-rating-large">${renderStars(rating)}</div>
            <div class="modal-buttons">
                <button class="btn-add-cart-modal" onclick="addToCart(${product.id})">
                    <i class="fas fa-cart-plus"></i> Carrinho
                </button>
                <button class="btn-whatsapp-modal" onclick="buyViaWhatsApp(${product.id})">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </button>
            </div>
            <div class="modal-description">
                ${product.description || ''}
                <div class="delivery-highlight">💰 Pague só na entrega!</div>
            </div>
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
                            <div class="cross-sell-card" onclick="openProductModal(${r.id})">
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
            ${productReviews.length > 0 ? `
                <div class="reviews-section">
                    <h4 class="reviews-title"><i class="fas fa-star"></i> Avaliações</h4>
                    ${productReviews.slice(0, 2).map(r => `
                        <div class="review-card">
                            <div class="review-header">
                                ${r.image_url ? `<img src="${r.image_url}" class="review-avatar" alt="${r.customer_name}">` :
                                    `<div class="review-avatar" style="background:var(--gold-light); display:flex; align-items:center; justify-content:center;">
                                        <i class="fas fa-user"></i>
                                    </div>`}
                                <div>
                                    <div class="review-name">${r.customer_name}</div>
                                    <div class="review-stars">${'★'.repeat(r.rating)}</div>
                                </div>
                            </div>
                            <p class="review-comment">${r.comment}</p>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <div class="scroll-indicator">
                <i class="fas fa-chevron-up"></i> Arraste para ver mais
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').innerHTML = modalHtml;
    document.getElementById('productModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    
    history.pushState({ modalOpen: true, productId: id }, '', `#product-${id}`);
    
    setupModalMediaClick();
    setupModalVideoAudio();
    scrollToTop();
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
            openSuperZoom(img.src, 'image');
        };
    }
    
    if (video) {
        video.style.cursor = 'zoom-in';
        video.onclick = (e) => {
            e.stopPropagation();
            openSuperZoom(video.src, 'video');
        };
    }
}

function setupModalVideoAudio() {
    const mainMedia = document.getElementById('modalMainMedia');
    if (!mainMedia) return;
    
    const video = mainMedia.querySelector('video');
    if (video) {
        setupVideoAudioControl(video);
    }
}

function scrollToTop() {
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        modalContent.scrollTop = 0;
    }
}

function changeModalMedia(index) {
    if (!currentMediaList[index]) return;
    
    const media = currentMediaList[index];
    const mainContainer = document.getElementById('modalMainMedia');
    
    if (media.type === 'video') {
        mainContainer.innerHTML = `<video src="${media.url}" autoplay muted loop playsinline></video>`;
        setupModalVideoAudio();
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
    
    if (history.state?.modalOpen) {
        history.replaceState(null, '', location.pathname + location.search);
    }
}

// ========================================
// 12. BUSCA E FILTROS
// ========================================
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

// ========================================
// 13. CARRINHO
// ========================================
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
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

// ========================================
// 14. WHATSAPP
// ========================================
function buyViaWhatsApp(id) {
    const p = products.find(p => p.id === id);
    if (!p) {
        window.open(WHATSAPP_BASE_URL, '_blank');
        return;
    }
    
    const msg = `Olá! Quero este produto: *${p.name}* - R$ ${p.price.toFixed(2).replace('.', ',')}`;
    const url = `https://api.whatsapp.com/send/?phone=5565993337205&text=${encodeURIComponent(msg)}&type=phone_number&app_absent=0`;
    window.open(url, '_blank');
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

// ========================================
// 15. GEOLOCALIZAÇÃO
// ========================================
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
    if (!products.length) return;
    
    const neighborhood = detectedLocation.neighborhoods[Math.floor(Math.random() * detectedLocation.neighborhoods.length)];
    const customerName = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    
    const notification = document.getElementById('geoNotification');
    const notificationText = document.getElementById('geoNotificationText');
    
    if (notification && notificationText) {
        notificationText.innerHTML = `<strong>${customerName}</strong> do <strong>${neighborhood}</strong> comprou <strong>${randomProduct.name}</strong>`;
        notification.style.display = 'block';
        setTimeout(() => notification.style.display = 'none', 8000);
    }
}

// ========================================
// 16. BUSCA PREDITIVA
// ========================================
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
        
        const results = products.filter(p =>
            p.name.toLowerCase().includes(query)
        ).slice(0, 5);
        
        if (results.length > 0) {
            searchResults.innerHTML = results.map(p => `
                <div class="search-result-item" onclick="selectSuggestion('${p.name.replace(/'/g, "\\'")}'); openProductModal(${p.id});">
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
    }, 200));
}

window.selectSuggestion = function(productName) {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = productName;
        handleSearch(productName);
    }
    document.getElementById('searchDropdown').style.display = 'none';
};

// ========================================
// 17. TIMER DA EQUIPE
// ========================================
function startTeamTimer() {
    setTimeout(() => {
        const section = document.getElementById('teamSection');
        if (section) {
            section.style.display = 'block';
            setTimeout(() => section.classList.add('visible'), 100);
        }
    }, 20000);
}

// ========================================
// 18. EVENT LISTENERS
// ========================================
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

// ========================================
// 19. UTILITÁRIOS
// ========================================
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
// 20. EXPOR FUNÇÕES GLOBAIS
// ========================================
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
window.closeSuperZoom = closeSuperZoom;
window.selectSuggestion = selectSuggestion;
window.nextSuperZoomPhoto = nextSuperZoomPhoto;
window.prevSuperZoomPhoto = prevSuperZoomPhoto;