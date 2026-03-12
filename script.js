// ========================================
// GRUPO ETEVALDA MT - SCRIPT PRINCIPAL
// VERSÃO PREMIUM COM TODAS AS CORREÇÕES E ATUALIZAÇÕES
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

// ========================================
// 3. DICIONÁRIO DE BAIRROS (PROVA SOCIAL)
// ========================================
const NEIGHBORHOODS = {
    'Cuiabá': ['CPA', 'Pedra 90', 'Boa Esperança', 'Jardim das Américas', 'Centro', 'Jardim Europa', 'Bandeirantes', 'Goiabeiras', 'Porto', 'Santa Rosa', 'Coophamil', 'Osmar Cabral'],
    'Várzea Grande': ['Cristo Rei', 'Parque do Lago', 'Mapim', 'Centro', 'Jardim América', 'Morada do Ouro', 'Alvorada', 'Ipase', 'Água Vermelha', 'Jardim Paula'],
    'Rondonópolis': ['Vila Aurora', 'Sagrada Família', 'Vila Operária', 'Centro', 'Jardim Marajoara', 'Setor Comercial', 'Cidade Salmen', 'Vila Birigui'],
    'Sinop': ['Jardim Botânico', 'Residencial Florença', 'Setor Comercial', 'Centro', 'Jardim Imperial', 'Bairro das Flores', 'Jardim das Palmeiras', 'Residencial Petrópolis']
};

const CUSTOMER_NAMES = [
    'Ana', 'Bruna', 'Carla', 'Daniela', 'Fernanda', 'Gabriela', 'Helena', 'Isabela',
    'Juliana', 'Karina', 'Larissa', 'Mariana', 'Natália', 'Patrícia', 'Rafaela',
    'Amanda', 'Beatriz', 'Camila', 'Débora', 'Eduarda', 'Flávia', 'Giovana', 'Heloísa',
    'Inês', 'Joana', 'Letícia', 'Marta', 'Nathalia', 'Priscila', 'Rita', 'Sandra',
    'João', 'Pedro', 'Lucas', 'Mateus', 'Rafael', 'Thiago', 'Vinicius', 'Igor'
];

let detectedLocation = { city: 'Cuiabá', neighborhoods: NEIGHBORHOODS['Cuiabá'] };
let geoNotificationTimeout = null;

// ========================================
// 4. INICIALIZAÇÃO PRINCIPAL
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Grupo Etevalda MT - Iniciando...');
    showLoading(true);

    try {
        // Carregar dados em cadeia
        await loadCategories();
        await loadProducts();
        await loadReviews();
        await loadFaqs();
        await loadSocialProof();

        // Carregar carrinho salvo
        loadCartFromStorage();

        // Renderizar tudo
        renderCategories();
        renderProducts();
        renderCarousel();
        renderSocialProof();
        renderFaqs();

        // Setup de listeners
        setupEventListeners();
        startTeamTimer();

        // Melhorias injetadas
        initPredictiveSearch();
        initGeoLocationBackground();

        console.log(`✅ ${products.length} produtos carregados com sucesso`);
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showToast('Erro ao carregar produtos. Tente novamente mais tarde.');

        // Mostrar mensagem de erro na página
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-container" style="grid-column: 1/-1; text-align:center; padding:60px; background:var(--white); border-radius:12px;">
                    <i class="fas fa-exclamation-triangle fa-4x" style="color:var(--gold-primary); margin-bottom:20px;"></i>
                    <h3 style="font-size:1.5rem; margin-bottom:15px;">Ops! Algo deu errado</h3>
                    <p style="color:var(--gray-medium); margin-bottom:25px;">Não foi possível carregar os produtos. Verifique sua conexão ou tente novamente.</p>
                    <button onclick="location.reload()" class="btn-primary" style="padding:12px 30px;">
                        <i class="fas fa-redo"></i> Tentar novamente
                    </button>
                </div>
            `;
        }
    } finally {
        // Esconder loading após um tempo
        setTimeout(() => showLoading(false), 1000);
    }
});

// ========================================
// 5. CONTROLE DE LOADING
// ========================================
function showLoading(status) {
    const el = document.getElementById('loading');
    if (el) {
        el.style.display = status ? 'flex' : 'none';
    }
}

// ========================================
// 6. FUNÇÕES DE CARREGAMENTO DO SUPABASE
// ========================================

async function loadCategories() {
    try {
        const { data, error } = await _supabase
            .from('categories')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;
        categories = data || [];
        return categories;
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        categories = [];
        return [];
    }
}

async function loadProducts() {
    try {
        console.log('📦 Carregando produtos com relacionamento explícito...');

        const { data, error } = await _supabase
            .from('products')
            .select('*, categories!category_id(name)')
            .order('id', { ascending: true });

        if (error) throw error;

        products = data || [];
        console.log(`✅ ${products.length} produtos carregados`);

        return products;
    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        products = [];
        throw error;
    }
}

async function loadReviews() {
    try {
        const { data, error } = await _supabase
            .from('reviews')
            .select('*, products(name)')
            .order('id', { ascending: false });

        if (error) throw error;
        allReviews = data || [];
        return allReviews;
    } catch (error) {
        console.error('Erro ao carregar avaliações:', error);
        allReviews = [];
        return [];
    }
}

async function loadFaqs() {
    try {
        const { data, error } = await _supabase
            .from('faqs')
            .select('*')
            .order('order_index', { ascending: true });

        if (error) throw error;
        faqs = data || [];
        return faqs;
    } catch (error) {
        console.error('Erro ao carregar FAQs:', error);
        faqs = [];
        return [];
    }
}

async function loadSocialProof() {
    try {
        const { data, error } = await _supabase
            .from('social_proof')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        socialProofImages = data || [];
        return socialProofImages;
    } catch (error) {
        console.error('Erro ao carregar prova social:', error);
        socialProofImages = [];
        return [];
    }
}

// ========================================
// 7. FUNÇÕES DE RENDERIZAÇÃO
// ========================================

function renderCategories() {
    const list = document.getElementById('categoryList');
    if (!list) return;

    list.innerHTML = '<li class="active" data-category="all">Todos</li>';
    categories.forEach(cat => {
        list.innerHTML += `<li data-category="${cat.id}">${cat.name.toUpperCase()}</li>`;
    });

    list.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', () => {
            list.querySelectorAll('li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            currentCategory = li.dataset.category;
            renderProducts();
        });
    });
}

function renderFaqs() {
    const grid = document.getElementById('faqGrid');
    if (!grid) return;

    if (!faqs || faqs.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column:1/-1; color:var(--gray-medium);">Nenhuma pergunta frequente cadastrada.</p>';
        return;
    }

    grid.innerHTML = faqs.map(f => `
        <div class="faq-card" onclick="playFaqAudio(this)">
            <div class="faq-icon"><i class="fas fa-headphones"></i></div>
            <h3>${f.question}</h3>
            <div class="faq-audio">
                <audio preload="none">
                    <source src="${f.audio_url}" type="audio/mpeg">
                </audio>
            </div>
        </div>
    `).join('');
}

// Função auxiliar para tocar áudio do FAQ
window.playFaqAudio = function(card) {
    const audio = card.querySelector('audio');
    if (audio) {
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
            audio.currentTime = 0;
        }
    }
};

function renderSocialProof() {
    const grid = document.getElementById('socialProofGrid');
    if (!grid) return;

    if (!socialProofImages || socialProofImages.length === 0) {
        // Fallback para cards de autoridade
        const fallbackCards = [
            {
                image: 'https://i.postimg.cc/HnbpfGbh/Equipeee.jpg',
                text: 'Cada Cliente é parte da nossa jornada de SUCESSO',
                icon: 'fa-heart'
            },
            {
                image: 'https://i.postimg.cc/wj65vgfr/Funcionarios.jpg',
                text: 'Tradição e carinho em cada detalhe',
                icon: 'fa-gem'
            },
            {
                image: 'https://i.postimg.cc/1Xw1PC9m/Grupo-Etevalda-MT.png',
                text: 'Excelência em joias há mais de 20 anos',
                icon: 'fa-crown'
            }
        ];

        grid.innerHTML = fallbackCards.map(item => `
            <div class="social-proof-card">
                <div class="social-proof-image">
                    <img src="${item.image}" alt="Prova Social" loading="lazy">
                </div>
                <div class="social-proof-overlay">
                    <p class="social-proof-text">${item.text}</p>
                </div>
                <div class="social-proof-icon">
                    <i class="fas ${item.icon}"></i>
                </div>
            </div>
        `).join('');
        return;
    }

    const imagesToShow = socialProofImages.slice(0, 3);
    grid.innerHTML = imagesToShow.map(item => `
        <div class="social-proof-card">
            <div class="social-proof-image">
                <img src="${item.image_url}" alt="Prova Social" loading="lazy">
            </div>
            <div class="social-proof-overlay">
                <p class="social-proof-text">${item.caption || 'Cliente satisfeito'}</p>
            </div>
            <div class="social-proof-icon">
                <i class="fas fa-heart"></i>
            </div>
        </div>
    `).join('');
}

function renderCarousel() {
    const carousel = document.getElementById('infiniteCarousel');
    if (!carousel || !products || products.length === 0) return;

    // Duplicar produtos para criar efeito infinito
    const carouselProducts = [...products, ...products, ...products];

    carousel.innerHTML = carouselProducts.map(p => {
        const images = Array.isArray(p.images) ? p.images :
            (typeof p.images === 'string' ? p.images.split(',').map(img => img.trim()) : []);
        const mainImage = images[0] || 'https://via.placeholder.com/250';
        const priceFormatted = p.price.toFixed(2).replace('.', ',');

        return `
            <div class="carousel-item" onclick="openProductModal(${p.id})">
                <img src="${mainImage}" alt="${p.name}" loading="lazy">
                <div class="carousel-item-info">
                    <div class="carousel-item-name">${p.name}</div>
                    <div class="carousel-item-price">R$ ${priceFormatted}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// 8. RENDERIZAÇÃO DE PRODUTOS
// ========================================

function getBadgeClass(text) {
    if (!text) return '';
    const lower = text.toLowerCase();
    if (lower.includes('mais vendido')) return 'badge-gold';
    if (lower.includes('oferta relâmpago')) return 'badge-offer';
    if (lower.includes('lançamento')) return 'badge-new';
    if (lower.includes('poucas') || lower.includes('últimas')) return 'badge-offer';
    return 'badge-neutral';
}

function renderProductCard(p) {
    const images = Array.isArray(p.images) ? p.images :
        (typeof p.images === 'string' ? p.images.split(',').map(img => img.trim()) : []);
    const mainImage = images[0] || 'https://via.placeholder.com/300';
    const priceFormatted = p.price.toFixed(2).replace('.', ',');
    const badgeClass = getBadgeClass(p.badge_text);

    // Destaque para solitário
    const solitarioHtml = p.tem_solitario && p.solitario_price && p.solitario_price > 0
        ? `<div class="product-solitario"><i class="fas fa-gem"></i> Solitário vendido separadamente por <span>R$ ${p.solitario_price.toFixed(2).replace('.', ',')}</span></div>`
        : '';

    return `
        <div class="product-card" data-id="${p.id}">
            <div class="product-image" onclick="openProductModal(${p.id})">
                ${p.badge_text ? `<div class="product-badge ${badgeClass}">${p.badge_text}</div>` : ''}
                <img src="${mainImage}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/300?text=Sem+imagem'">
            </div>
            <div class="product-info">
                <span class="product-category">${p.categories?.name || 'Geral'}</span>
                <h3 class="product-name">${p.name}</h3>
                <div class="product-price">R$ ${priceFormatted}</div>
                ${solitarioHtml}
                <div class="product-buttons">
                    <button class="btn-primary" onclick="event.stopPropagation(); addToCart(${p.id})">
                        <i class="fas fa-cart-plus"></i> Carrinho
                    </button>
                    <!-- Botão WhatsApp com novo estilo verde e pulsante -->
                    <button class="btn-secondary" onclick="event.stopPropagation(); buyViaWhatsApp(${p.id})">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderProducts() {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--gray-medium);">Nenhum produto disponível no momento.</p>';
        return;
    }

    let filtered = products.filter(p => {
        const matchCat = currentCategory === 'all' || p.category_id == currentCategory;
        const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });

    // Atualizar contador de produtos
    const productCount = document.getElementById('productCount');
    if (productCount) {
        productCount.textContent = `${filtered.length} produto${filtered.length !== 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; background:var(--white); border-radius:12px; grid-column:1/-1;">
                <i class="fas fa-search fa-3x" style="color:var(--gold-light); margin-bottom:20px;"></i>
                <h3 style="color:var(--dark-gray); margin-bottom:10px;">Nenhum produto encontrado</h3>
                <p style="color:var(--gray-medium); margin-bottom:20px;">Tente buscar com outros termos</p>
                <button onclick="resetFilters()" class="btn-primary">Limpar filtros</button>
            </div>
        `;
        return;
    }

    // Embaralhar se for "Todos" (MISTURAR PRODUTOS)
    if (currentCategory === 'all' && !searchQuery) {
        filtered = filtered.sort(() => Math.random() - 0.5);
    }

    container.innerHTML = filtered.map(p => renderProductCard(p)).join('');
}

// ========================================
// 9. BUSCA E FILTROS
// ========================================

function handleSearch(query) {
    searchQuery = query;
    renderProducts();
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
}

// ========================================
// 10. MODAL DE PRODUTO (COM UPSELL INTELIGENTE)
// ========================================

function getProductDescription(product) {
    // Descrição automática para alianças
    let desc = product.description || '';
    if (product.categories?.name?.toLowerCase().includes('aliança')) {
        desc = 'Fabricado em liga metálica nobre banhada a ouro. ' + desc;
    }

    // Adicionar informações de entrega
    desc += ' <div class="delivery-highlight">Entregamos hoje na sua casa. <strong>VOCÊ SÓ PAGA NA HORA DA ENTREGA!</strong></div>';

    return desc;
}

function openProductModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    currentModalProduct = product;

    // Construir lista de mídia
    currentMediaList = [];

    if (product.video_url && product.video_url.trim() !== '') {
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
        images = product.images.split(',').map(img => img.trim()).filter(img => img);
    }

    images.forEach(img => {
        if (img && img.trim() !== '') {
            currentMediaList.push({
                type: 'image',
                url: img,
                thumbnail: img
            });
        }
    });

    const productReviews = allReviews.filter(r => r.is_general || r.product_id === id);

    // UPSELL INTELIGENTE
    let upsellProducts = [];

    // Prioridade 1: Produtos da categoria de sugestão (upsell_category)
    if (product.upsell_category) {
        const keywords = product.upsell_category.split(',').map(k => k.trim().toLowerCase());
        upsellProducts = products.filter(p =>
            p.id !== product.id &&
            keywords.some(k =>
                p.name.toLowerCase().includes(k) ||
                p.categories?.name?.toLowerCase().includes(k)
            )
        );
    }

    // Prioridade 2: Produtos da mesma categoria
    if (upsellProducts.length < 3 && product.category_id) {
        const sameCategory = products.filter(p =>
            p.category_id === product.category_id &&
            p.id !== product.id &&
            !upsellProducts.includes(p)
        ).slice(0, 3 - upsellProducts.length);
        upsellProducts = [...upsellProducts, ...sameCategory];
    }

    // Prioridade 3: Produtos aleatórios da loja
    if (upsellProducts.length < 3) {
        const randomProducts = products.filter(p =>
            p.id !== product.id &&
            !upsellProducts.includes(p)
        ).sort(() => Math.random() - 0.5).slice(0, 3 - upsellProducts.length);
        upsellProducts = [...upsellProducts, ...randomProducts];
    }

    // Limitar a 3 produtos e embaralhar
    upsellProducts = upsellProducts.slice(0, 3).sort(() => Math.random() - 0.5);

    // Miniaturas
    const thumbnailsHtml = currentMediaList.map((media, index) => {
        const isVideo = media.type === 'video';
        const thumbSrc = isVideo ? media.thumbnail : media.url;
        if (!thumbSrc) return '';

        return `
            <div class="modal-thumb ${isVideo ? 'video-thumb' : ''} ${index === 0 ? 'active' : ''}"
                onclick="changeModalMedia(${index})">
                ${isVideo
                    ? `<video src="${media.url}" muted playsinline></video>`
                    : `<img src="${thumbSrc}" alt="Miniatura ${index + 1}">`}
            </div>
        `;
    }).filter(html => html !== '').join('');

    const priceFormatted = product.price.toFixed(2).replace('.', ',');
    const solitarioFormatted = product.solitario_price ? product.solitario_price.toFixed(2).replace('.', ',') : '';

    const productDescription = getProductDescription(product);

    const modalHtml = `
        <div class="modal-gallery">
            <div class="modal-main-media" id="modalMainMedia">
                ${currentMediaList.length > 0 ? (
                    currentMediaList[0].type === 'video'
                        ? `<video src="${currentMediaList[0].url}" autoplay muted loop playsinline></video>`
                        : `<img src="${currentMediaList[0].url}" alt="${product.name}">`
                ) : '<img src="https://via.placeholder.com/500" alt="Sem imagem">'}
            </div>
            <div class="modal-thumbnails" id="modalThumbnails">
                ${thumbnailsHtml || '<div style="padding:10px;">Sem outras imagens</div>'}
            </div>
        </div>
        <div class="modal-info">
            <span class="modal-category">${product.categories?.name || 'Geral'}</span>
            <h2 class="modal-title">${product.name}</h2>
            <div class="modal-price-main">R$ ${priceFormatted}</div>
            ${product.tem_solitario && product.solitario_price && product.solitario_price > 0 ?
                `<div style="color:var(--gold-dark); font-weight:700; margin-bottom:var(--spacing-md); background:var(--gold-light); padding:var(--spacing-sm); border-radius:var(--radius-sm);">
                    <i class="fas fa-gem"></i> Solitário vendido separadamente por R$ ${solitarioFormatted}
                </div>` : ''}
            <div class="modal-description">${productDescription}</div>

            ${upsellProducts.length > 0 ? `
                <div class="recommendations-section">
                    <h3 class="recommendations-title"><i class="fas fa-handshake"></i> Quem viu, também gostou</h3>
                    <div class="recommendations-grid">
                        ${upsellProducts.map(r => `
                            <div class="rec-card" onclick="openProductModal(${r.id})">
                                <img src="${Array.isArray(r.images) ? r.images[0] : (typeof r.images === 'string' ? r.images.split(',')[0].trim() : '')}" alt="${r.name}">
                                <h4>${r.name}</h4>
                                <div class="price">R$ ${r.price.toFixed(2).replace('.', ',')}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="modal-buttons">
                <button class="btn-add-cart-modal" onclick="addToCart(${product.id})">
                    <i class="fas fa-cart-plus"></i> Carrinho
                </button>
                <!-- Botão WhatsApp do Modal com novo estilo verde e pulsante -->
                <button class="btn-whatsapp-modal" onclick="buyViaWhatsApp(${product.id})">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </button>
            </div>

            <div class="scroll-indicator">
                <i class="fas fa-chevron-down"></i> Arraste para ver avaliações
            </div>

            ${productReviews.length > 0 ? `
                <div class="reviews-section">
                    <h3 class="reviews-title"><i class="fas fa-star"></i> Avaliações</h3>
                    <div class="reviews-grid">
                        ${productReviews.map(r => `
                            <div class="review-card">
                                <div class="review-header">
                                    ${r.image_url ? `<img src="${r.image_url}" class="review-avatar" alt="${r.customer_name}">` :
                                        `<div class="review-avatar" style="background:var(--gold-light); display:flex; align-items:center; justify-content:center;">
                                            <i class="fas fa-user"></i>
                                        </div>`}
                                    <div>
                                        <div class="review-name">${r.customer_name}</div>
                                        <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
                                    </div>
                                </div>
                                <p class="review-comment">${r.comment}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('modalContainer').innerHTML = modalHtml;
    document.getElementById('productModal').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function changeModalMedia(index) {
    if (!currentMediaList || index < 0 || index >= currentMediaList.length) return;

    const media = currentMediaList[index];
    const mainContainer = document.getElementById('modalMainMedia');

    if (!mainContainer) return;

    if (media.type === 'video') {
        mainContainer.innerHTML = `<video src="${media.url}" autoplay muted loop playsinline></video>`;
    } else {
        mainContainer.innerHTML = `<img src="${media.url}" alt="Produto">`;
    }

    document.querySelectorAll('.modal-thumb').forEach((thumb, i) => {
        if (i === index) {
            thumb.classList.add('active');
        } else {
            thumb.classList.remove('active');
        }
    });
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
    document.body.style.overflow = '';
    currentModalProduct = null;
    currentMediaList = [];
}

// ========================================
// 11. CARRINHO DE COMPRAS
// ========================================

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
        showToast(`+1 ${product.name} no carrinho!`);
    } else {
        const images = Array.isArray(product.images) ? product.images :
            (typeof product.images === 'string' ? product.images.split(',').map(img => img.trim()) : []);
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: images[0] || '',
            quantity: 1
        });
        showToast(`${product.name} adicionado ao carrinho!`);
    }

    saveCart();
    updateCartUI();
    animateCartIcon();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
    showToast('Produto removido');
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
    if (cart.length === 0) return;
    if (confirm('Deseja limpar todo o carrinho?')) {
        cart = [];
        saveCart();
        updateCartUI();
        closeCart();
        showToast('Carrinho limpo');
    }
}

function saveCart() {
    try {
        localStorage.setItem('grupoetevalda_cart', JSON.stringify(cart));
    } catch (e) {
        console.error('Erro ao salvar carrinho:', e);
    }
}

function loadCartFromStorage() {
    try {
        const saved = localStorage.getItem('grupoetevalda_cart');
        if (saved) {
            cart = JSON.parse(saved);
            updateCartUI();
        }
    } catch (e) {
        console.error('Erro ao carregar carrinho:', e);
    }
}

function updateCartUI() {
    const container = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const countEl = document.getElementById('cartCount');

    if (!container || !totalEl || !countEl) return;

    let total = 0;
    let qtdTotal = 0;

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--gray-medium);padding:40px"><i class="fas fa-shopping-bag fa-3x" style="color:var(--gold-light); margin-bottom:20px;"></i><br>Seu carrinho está vazio</p>';
        totalEl.textContent = 'R$ 0,00';
        countEl.textContent = '0';
        countEl.style.display = 'none';
        return;
    }

    container.innerHTML = cart.map(item => {
        total += item.price * item.quantity;
        qtdTotal += item.quantity;
        const priceFormatted = item.price.toFixed(2).replace('.', ',');

        return `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" loading="lazy">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">R$ ${priceFormatted}</div>
                    <div class="cart-item-quantity">
                        <button onclick="updateQuantity(${item.id}, -1)"><i class="fas fa-minus"></i></button>
                        <span>${item.quantity}</span>
                        <button onclick="updateQuantity(${item.id}, 1)"><i class="fas fa-plus"></i></button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${item.id})" aria-label="Remover">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');

    totalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    countEl.textContent = qtdTotal;
    countEl.style.display = qtdTotal > 0 ? 'flex' : 'none';
}

function animateCartIcon() {
    const cartIcon = document.getElementById('cartBtn');
    if (cartIcon) {
        cartIcon.classList.add('animate');
        setTimeout(() => cartIcon.classList.remove('animate'), 500);
    }
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (!sidebar) return;

    const isActive = sidebar.classList.contains('active');
    if (isActive) {
        closeCart();
    } else {
        updateCartUI();
        sidebar.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// ========================================
// 12. WHATSAPP
// ========================================

function buyViaWhatsApp(id) {
    const p = products.find(p => p.id === id);
    if (!p) return;

    const link = `${window.location.origin}${window.location.pathname}?product=${id}`;
    const priceFormatted = p.price.toFixed(2).replace('.', ',');
    const msg = `Olá! Vim pelo site e quero este produto: *${p.name}* | Valor: R$ ${priceFormatted} | Link: ${link}`;
    window.open(`https://wa.me/5565993337205?text=${encodeURIComponent(msg)}`, '_blank');
    showToast('Redirecionando...');
}

function checkoutWhatsApp() {
    if (cart.length === 0) {
        showToast('Seu carrinho está vazio!');
        return;
    }

    let itemsList = '';
    let total = 0;

    cart.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        const productLink = `${window.location.origin}${window.location.pathname}?product=${item.id}`;
        itemsList += `${index + 1}. *${item.name}* (x${item.quantity}) - R$ ${subtotal.toFixed(2).replace('.', ',')}\n🔗 ${productLink}\n\n`;
    });

    const totalFormatted = total.toFixed(2).replace('.', ',');
    const message = `🛍️ *NOVO PEDIDO - GRUPO ETEVALDA MT*\n\nOlá! Gostaria de comprar estes produtos:\n\n${itemsList}💰 *Total do Pedido: R$ ${totalFormatted}*\n\nPosso mandar meu endereço para você me entregar agora?`;

    const whatsappUrl = `https://wa.me/5565993337205?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    showToast('Redirecionando para WhatsApp...');
}

// ========================================
// 13. GEOLOCALIZAÇÃO (PROVA SOCIAL)
// ========================================

async function initGeoLocationBackground() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timeoutId);

        const data = await response.json();
        const city = data.city;

        if (city && NEIGHBORHOODS[city]) {
            detectedLocation = { city: city, neighborhoods: NEIGHBORHOODS[city] };
            console.log(`📍 Localização detectada: ${city}`);
        }

        startGeoNotifications();
    } catch (error) {
        console.log('🗺️ Geolocalização em background: usando padrão Cuiabá');
        startGeoNotifications();
    }
}

function startGeoNotifications() {
    // Primeira notificação após 25 segundos
    setTimeout(() => showGeoNotification(), 25000);
    // Agendar próximas notificações a cada 2 minutos
    scheduleNextGeoNotification(120000); // 2 minutos
}

function scheduleNextGeoNotification(delay) {
    geoNotificationTimeout = setTimeout(() => {
        showGeoNotification();
        scheduleNextGeoNotification(120000); // Continua a cada 2 minutos
    }, delay);
}

function showGeoNotification() {
    if (!products || products.length === 0) return;

    const neighborhood = detectedLocation.neighborhoods[Math.floor(Math.random() * detectedLocation.neighborhoods.length)];
    const customerName = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
    const randomProduct = products[Math.floor(Math.random() * products.length)];

    const notification = document.getElementById('geoNotification');
    const notificationText = document.getElementById('geoNotificationText');

    if (notification && notificationText) {
        notificationText.innerHTML = `<strong>${customerName}</strong> do <strong>${neighborhood}</strong> acabou de comprar <strong>${randomProduct.name}</strong>`;
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 8000);
    }
}

// ========================================
// 14. BUSCA PREDITIVA
// ========================================

function initPredictiveSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchDropdown = document.getElementById('searchDropdown');
    const searchResults = document.getElementById('searchResults');

    if (!searchInput || !searchDropdown || !searchResults) return;

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
            searchDropdown.style.display = 'none';
        }
    });

    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query.length < 2) {
            searchDropdown.style.display = 'none';
            return;
        }

        const results = products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.categories?.name?.toLowerCase().includes(query))
        ).slice(0, 5);

        if (results.length > 0) {
            searchResults.innerHTML = results.map(p => {
                const priceFormatted = p.price.toFixed(2).replace('.', ',');
                const images = Array.isArray(p.images) ? p.images :
                    (typeof p.images === 'string' ? p.images.split(',').map(img => img.trim()) : []);
                const img = images[0] || 'https://via.placeholder.com/50';
                return `
                    <div class="search-result-item" onclick="openProductModal(${p.id}); document.getElementById('searchDropdown').style.display='none';">
                        <img src="${img}" alt="${p.name}" loading="lazy">
                        <div class="search-result-info">
                            <div class="search-result-name">${p.name}</div>
                            <div class="search-result-price">R$ ${priceFormatted}</div>
                            <div class="search-result-category">${p.categories?.name || 'Geral'}</div>
                        </div>
                    </div>`;
            }).join('');
            searchDropdown.style.display = 'block';
        } else {
            searchResults.innerHTML = '<div class="search-no-results">Nenhum produto encontrado</div>';
            searchDropdown.style.display = 'block';
        }
    }, 200));

    // Navegação por teclado
    searchInput.addEventListener('keydown', (e) => {
        const items = searchDropdown.querySelectorAll('.search-result-item');
        if (items.length === 0) return;

        let activeIndex = Array.from(items).findIndex(item => item.classList.contains('active'));

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (activeIndex < items.length - 1) {
                if (activeIndex >= 0) items[activeIndex].classList.remove('active');
                items[activeIndex + 1].classList.add('active');
                items[activeIndex + 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (activeIndex > 0) {
                items[activeIndex].classList.remove('active');
                items[activeIndex - 1].classList.add('active');
                items[activeIndex - 1].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            items[activeIndex].click();
        }
    });
}

// ========================================
// 15. TIMER DA SEÇÃO DE EQUIPE
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
// 16. EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Busca
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleSearch(e.target.value);
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            if (searchInput) handleSearch(searchInput.value);
        });
    }

    // Filtros mobile
    const filterToggle = document.getElementById('filterToggle');
    if (filterToggle) {
        filterToggle.addEventListener('click', () => {
            document.querySelector('.nav-categories').scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Modal
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeProductModal);
    }

    const modalSecondaryCloseBtn = document.getElementById('modalSecondaryCloseBtn');
    if (modalSecondaryCloseBtn) {
        modalSecondaryCloseBtn.addEventListener('click', closeProductModal);
    }

    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeProductModal);
    }

    // Carrinho
    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
        cartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleCart();
        });
    }

    const closeCartBtn = document.getElementById('closeCart');
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeCart();
        });
    }

    const cartOverlay = document.getElementById('cartOverlay');
    if (cartOverlay) {
        cartOverlay.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeCart();
        });
    }

    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', checkoutWhatsApp);

    const clearCartBtn = document.getElementById('clearCartBtn');
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);

    // ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeProductModal();
            closeCart();
        }
    });
}

// ========================================
// 17. UTILITÁRIOS
// ========================================

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function debounce(fn, wait) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

// ========================================
// 18. EXPOR FUNÇÕES GLOBAIS
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