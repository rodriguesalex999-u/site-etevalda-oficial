// ========================================
// FUNÇÕES REFACTORADAS - SUBSTITUA NO ARQUIVO script.js
// ========================================

// ========================================
// 1. TEMPORIZADOR REFACTORADO (startDeliveryTimer)
// ========================================
function startDeliveryTimer() {
    const timerElement = document.getElementById('deliveryTimer');
    if (!timerElement) return;
    
    // Limpar intervalo anterior se existir
    if (deliveryTimerInterval) {
        clearInterval(deliveryTimerInterval);
    }
    
    // Obter tempo salvo no sessionStorage ou iniciar com 2 horas
    let savedTime = sessionStorage.getItem('deliveryTimerTime');
    let startTime = savedTime ? parseInt(savedTime) : Date.now();
    const totalTime = 2 * 60 * 60 * 1000; // 2 horas em milissegundos
    
    function updateTimer() {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, totalTime - elapsed);
        
        if (remaining === 0) {
            // Tempo esgotado - mostrar mensagem padrão
            timerElement.innerHTML = `
                <i class="fas fa-clock"></i>
                <span class="delivery-today">Receba hoje e só pague na entrega</span>
            `;
            sessionStorage.removeItem('deliveryTimerTime');
            return;
        }
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        timerElement.innerHTML = `
            <i class="fas fa-clock"></i>
            <span class="timer-countdown">${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s</span>
            <span class="timer-text">para receber hoje!</span>
        `;
        
        // Salvar tempo atual no sessionStorage
        sessionStorage.setItem('deliveryTimerTime', startTime.toString());
    }
    
    updateTimer();
    deliveryTimerInterval = setInterval(updateTimer, 1000);
}

// ========================================
// 2. MODAL REFACTORADO (openProductModal)
// ========================================
function openProductModal(id) {
    const product = allProductsLoaded.find(p => p.id === id);
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
    
    let upsellProducts = [];
    if (product.upsell_category) {
        upsellProducts = allProductsLoaded.filter(p =>
            p.id !== product.id &&
            p.categories?.name?.toLowerCase().includes(product.upsell_category.toLowerCase())
        ).slice(0, 12);
    } else if (product.category_id) {
        upsellProducts = allProductsLoaded.filter(p =>
            p.id !== product.id &&
            p.category_id === product.category_id
        ).slice(0, 12);
    }
    
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
    
    if (crossSellProducts.length === 0 && product.category_id) {
        crossSellProducts = allProductsLoaded.filter(p =>
            p.id !== product.id &&
            p.category_id === product.category_id
        ).slice(0, 12);
    }
    
    const priceFormatted = product.price.toFixed(2).replace('.', ',');
    const solitarioFormatted = product.solitario_price?.toFixed(2).replace('.', ',');
    const rating = product.default_rating || 5;
    
    // Número aleatório de pessoas vendo
    const viewersCount = getRandomViewers();
    
    const thumbnailsHtml = currentMediaList.map((media, index) => `
        <div class="modal-thumb ${media.type === 'video' ? 'video-thumb' : ''} ${index === 0 ? 'active' : ''}" onclick="changeModalMedia(${index})">
            <img src="${media.thumbnail}" alt="">
        </div>
    `).join('');
    
    // Selo solitário com estilo mais discreto
    const solitarioHtml = product.tem_solitario && product.solitario_price > 0 ? `
        <div class="solitario-discreto">
            <i class="fas fa-gem"></i> Solitário vendido separadamente: R$ ${solitarioFormatted}
        </div>
    ` : '';
    
    // Construir HTML da descrição condicionalmente
    const descriptionHtml = product.description ? `
        <div class="modal-description">
            ${product.description}
        </div>
    ` : '';
    
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
            
            <!-- Selo solitário discreto -->
            ${solitarioHtml}
            
            <!-- Prova Social em tempo real -->
            <div class="looking-now">
                <i class="fas fa-eye"></i> ${viewersCount} pessoas estão vendo este produto agora
            </div>
            
            <!-- Caixa de urgência com cronômetro -->
            <div class="urgency-box">
                <div class="delivery-timer" id="deliveryTimer">
                    <i class="fas fa-clock"></i>
                    <span class="timer-countdown">00h 00m 00s</span>
                    <span class="timer-text">para receber hoje!</span>
                </div>
            </div>
            
            <div class="product-rating-large">${renderStars(rating)}</div>
            
            <!-- Botões com compartilhamento melhorado -->
            <div class="modal-buttons">
                <button class="btn-add-cart-modal" onclick="addToCart(${product.id})">
                    <i class="fas fa-cart-plus"></i> Carrinho
                </button>
                <button class="btn-whatsapp-modal" onclick="buyViaWhatsApp(${product.id})">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </button>
                <button class="btn-share" onclick="shareProduct(${JSON.stringify(product).replace(/"/g, '&quot;')})" aria-label="Compartilhar">
                    <i class="fas fa-share-alt"></i> <span>COMPARTILHE<br>COM SEU AMOR</span>
                </button>
            </div>
            
            <!-- Descrição condicional - só aparece se existir -->
            ${descriptionHtml}
            
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
    
    // Iniciar cronômetro de entrega
    startDeliveryTimer();
    
    // Adiciona estado no history para controle do botão voltar
    history.pushState({ modalOpen: true, productId: id }, '', `#product-${id}`);
    
    setupModalMediaClick();
    setupModalVideoAudio();
    setupNextPhotoButton();
    scrollToTop();
}

// ========================================
// 3. BOTÃO VOLTAR REFACTORADO (setupHistoryAPI)
// ========================================
function setupHistoryAPI() {
    window.addEventListener('popstate', (event) => {
        const modal = document.getElementById('productModal');
        const isModalOpen = modal && modal.classList.contains('active');
        
        // Se o modal está ativo e houver estado de modal, fecha o modal
        if (isModalOpen && (event.state?.modalOpen || location.hash.startsWith('#product-'))) {
            event.preventDefault();
            closeProductModal();
            
            // Limpa o hash da URL sem recarregar a página
            if (location.hash.startsWith('#product-')) {
                history.replaceState(null, '', location.pathname + location.search);
            }
            return;
        }
        
        // Se houver hash de produto na URL mas o modal não está ativo, limpa o hash
        if (location.hash.startsWith('#product-')) {
            history.replaceState(null, '', location.pathname + location.search);
        }
    });
}

// ========================================
// 4. FUNÇÃO closeProductModal ATUALIZADA (necessária para o botão voltar)
// ========================================
function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
    currentModalProduct = null;
    currentMediaList = [];
    
    // Limpar intervalo do cronômetro
    if (deliveryTimerInterval) {
        clearInterval(deliveryTimerInterval);
        deliveryTimerInterval = null;
    }
    
    // Limpa o estado do history para evitar cliques fantasmas
    if (history.state?.modalOpen) {
        history.replaceState(null, '', location.pathname + location.search);
    }
}
