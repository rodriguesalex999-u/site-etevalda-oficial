// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://vnrfmsyanrvqqhmqyixk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xGLDFQarl-DhshRW0932FQ_asug0TUK';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const SENHA_ADMIN = '14659832';

let currentTab = 'products';
let deleteId = null;
let deleteType = null;
let currentRating = 5;
let categoriesList = [];

// LOGIN
function checkPassword() {
    const input = document.getElementById('passwordInput').value;
    if (input === SENHA_ADMIN) {
        document.getElementById('loginArea').style.display = 'none';
        document.getElementById('adminArea').style.display = 'block';
        loadAllData();
    } else {
        document.getElementById('loginError').style.display = 'block';
        setTimeout(() => document.getElementById('loginError').style.display = 'none', 3000);
    }
}

function logout() {
    document.getElementById('loginArea').style.display = 'flex';
    document.getElementById('adminArea').style.display = 'none';
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
}

async function loadAllData() {
    await Promise.all([
        loadCategories(),
        loadProducts(),
        loadReviews(),
        loadFaqs(),
        loadSocialProof()
    ]);
    updateStats();
}

// PARSE DE PREÇO
function parseCurrency(value) {
    if (!value) return 0;
    let cleaned = value.toString().replace(/[^0-9,.]/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        if (lastComma > lastDot) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            cleaned = cleaned.replace(/,/g, '');
        }
    } else if (cleaned.includes(',')) {
        cleaned = cleaned.replace(',', '.');
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.max(0, num);
}

// CATEGORIAS - CORRIGIDO: Atualiza AMBOS os selects
async function loadCategories() {
    const { data } = await _supabase.from('categories').select('*').order('id');
    categoriesList = data || [];
    const tbody = document.getElementById('categoriesTableBody');
    if (tbody) {
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px;">
                <i class="fas fa-folder-open fa-3x" style="color:var(--medium-gray);"></i>
                <p>Nenhuma categoria cadastrada</p>
            </td></tr>`;
        } else {
            tbody.innerHTML = data.map(c => `
                <tr>
                    <td><strong>#${c.id}</strong></td>
                    <td>${c.name}</td>
                    <td>${c.hero_title || '—'}</td>
                    <td>${c.hero_subtitle || '—'}</td>
                    <td><button class="btn-danger" onclick="confirmDelete('category', ${c.id})"><i class="fas fa-trash"></i></button></td>
                </tr>
            `).join('');
        }
    }

    // CORRIGIDO: Atualizar AMBOS os selects: productCategory (com id) e upsellCategory (com name)
    const productSelect = document.getElementById('productCategory');
    const upsellSelect = document.getElementById('upsellCategory');

    if (productSelect && data) {
        productSelect.innerHTML = '<option value="">Selecione...</option>';
        data.forEach(c => {
            productSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    }

    if (upsellSelect && data) {
        upsellSelect.innerHTML = '<option value="">Selecione...</option>';
        data.forEach(c => {
            upsellSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });
    }
}

document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('categoryName').value.trim().toLowerCase();
    const heroTitle = document.getElementById('categoryTitle').value.trim() || null;
    const heroSubtitle = document.getElementById('categorySubtitle').value.trim() || null;

    if (!name) {
        showToast('Digite o nome da categoria!', 'error');
        return;
    }

    const { error } = await _supabase
        .from('categories')
        .insert([{ id: Math.max(...(categoriesList.map(c => c.id) || [4])) + 1, name, hero_title: heroTitle, hero_subtitle: heroSubtitle }]);

    if (!error) {
        showToast('✅ Categoria criada!');
        e.target.reset();
        await loadCategories();
        updateStats();
    } else {
        showToast('Erro ao salvar categoria', 'error');
    }
});

// PRODUTOS
async function loadProducts() {
    const { data } = await _supabase
        .from('products')
        .select('*, categories(name)')
        .order('id', { ascending: false });

    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px;">
            <i class="fas fa-box-open fa-3x" style="color:var(--medium-gray);"></i>
            <p>Nenhum produto cadastrado</p>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(p => {
        const img = p.images?.[0] || 'https://via.placeholder.com/60';
        const priceFormatted = parseFloat(p.price).toFixed(2).replace('.', ',');
        const solitarioFormatted = p.solitario_price && p.solitario_price > 0
            ? `R$ ${parseFloat(p.solitario_price).toFixed(2).replace('.', ',')}`
            : '—';
        const categoryName = p.categories?.name || 'Sem categoria';
        const upsellCategory = p.upsell_category || '—';

        return `<tr>
            <td><strong>#${p.id}</strong></td>
            <td><img src="${img}" class="prod-img" onerror="this.src='https://via.placeholder.com/60'"></td>
            <td>${p.name}</td>
            <td><strong>R$ ${priceFormatted}</strong></td>
            <td>${solitarioFormatted}</td>
            <td>${categoryName}</td>
            <td>${upsellCategory}</td>
            <td>${p.badge_text || '—'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" onclick="showToast('Edição em breve')"><i class="fas fa-edit"></i></button>
                    <button class="btn-danger" onclick="confirmDelete('product', ${p.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// FORMULÁRIO DE PRODUTO - CORRIGIDO: Captura badge_text como input e upsell_category
document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('productName').value.trim();
    const priceRaw = document.getElementById('productPrice').value.trim();
    const solitarioRaw = document.getElementById('solitarioPrice').value.trim();
    const categoryId = parseInt(document.getElementById('productCategory').value);
    const temSolitario = document.getElementById('temSolitario').checked;
    const badgeText = document.getElementById('badgeSelect').value.trim() || null;
    const upsellCategory = document.getElementById('upsellCategory').value || null;
    const relatedKeywords = document.getElementById('relatedKeywords').value.trim() || null;
    const videoUrl = document.getElementById('videoUrl').value.trim() || null;
    const description = document.getElementById('productDescription').value.trim() || null;
    const imagesRaw = document.getElementById('productImages').value.trim();

    if (!name || !priceRaw || !categoryId) {
        showToast('Preencha os campos obrigatórios!', 'error');
        return;
    }

    const images = imagesRaw.split('\n').map(l => l.trim()).filter(l => l);
    if (images.length === 0) {
        showToast('Adicione pelo menos uma imagem!', 'error');
        return;
    }

    const price = parseCurrency(priceRaw);
    if (price <= 0) {
        showToast('Preço inválido!', 'error');
        return;
    }

    let solitarioPrice = parseCurrency(solitarioRaw);
    if (temSolitario && solitarioPrice <= 0) {
        showToast('Preço do solitário inválido!', 'error');
        return;
    }
    if (!temSolitario) solitarioPrice = 0;

    const productData = {
        name,
        price,
        solitario_price: solitarioPrice,
        category_id: categoryId,
        tem_solitario: temSolitario,
        badge_text: badgeText,
        upsell_category: upsellCategory,
        related_keywords: relatedKeywords,
        video_url: videoUrl,
        description,
        images
    };

    const { error } = await _supabase.from('products').insert([productData]);

    if (!error) {
        showToast('✅ Produto cadastrado!');
        e.target.reset();
        document.getElementById('upsellCategory').value = '';
        await loadProducts();
        updateStats();
    } else {
        showToast('Erro ao cadastrar: ' + error.message, 'error');
        console.error(error);
    }
});

// AVALIAÇÕES
document.querySelectorAll('#ratingStars i').forEach(star => {
    star.addEventListener('click', function() {
        currentRating = parseInt(this.dataset.rating);
        document.getElementById('reviewRating').value = currentRating;
        document.querySelectorAll('#ratingStars i').forEach((s, i) => {
            s.className = i < currentRating ? 'fas fa-star' : 'far fa-star';
        });
    });
});

async function loadReviews() {
    const { data } = await _supabase
        .from('reviews')
        .select('*, products(name)')
        .order('id', { ascending: false });

    const tbody = document.getElementById('reviewsTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px;">
            <i class="fas fa-star fa-3x" style="color:var(--medium-gray);"></i>
            <p>Nenhuma avaliação cadastrada</p>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(r => `
        <tr>
            <td><strong>#${r.id}</strong></td>
            <td>${r.customer_name}</td>
            <td class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</td>
            <td>${r.comment.substring(0, 50)}${r.comment.length > 50 ? '...' : ''}</td>
            <td>${r.products?.name || 'Geral'}</td>
            <td><button class="btn-danger" onclick="confirmDelete('review', ${r.id})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');

    // Carregar produtos para o select
    const { data: products } = await _supabase.from('products').select('id, name').order('id');
    const select = document.getElementById('reviewProduct');
    if (select && products) {
        select.innerHTML = '<option value="">Geral (todos)</option>' +
            products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
}

document.getElementById('reviewForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('reviewName').value.trim();
    const rating = currentRating;
    const comment = document.getElementById('reviewComment').value.trim();
    const imageUrl = document.getElementById('reviewImage').value.trim() || null;
    const productId = document.getElementById('reviewProduct').value;
    const isGeneral = document.getElementById('reviewGeneral').checked;

    if (!name || !comment) {
        showToast('Preencha nome e comentário!', 'error');
        return;
    }

    const reviewData = {
        customer_name: name,
        rating,
        comment,
        image_url: imageUrl,
        product_id: isGeneral ? null : (productId ? parseInt(productId) : null),
        is_general: isGeneral
    };

    const { error } = await _supabase.from('reviews').insert([reviewData]);

    if (!error) {
        showToast('✅ Avaliação cadastrada!');
        e.target.reset();
        await loadReviews();
        updateStats();
    } else {
        showToast('Erro ao salvar avaliação', 'error');
    }
});

// FAQS
async function loadFaqs() {
    const { data } = await _supabase.from('faqs').select('*').order('order_index');
    const tbody = document.getElementById('faqsTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px;">
            <i class="fas fa-question-circle fa-3x" style="color:var(--medium-gray);"></i>
            <p>Nenhuma FAQ cadastrada</p>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(f => `
        <tr>
            <td><strong>#${f.id}</strong></td>
            <td>${f.order_index}</td>
            <td>${f.question}</td>
            <td><a href="${f.audio_url}" target="_blank" style="color:var(--info);">🔊 Ouvir</a></td>
            <td><button class="btn-danger" onclick="confirmDelete('faq', ${f.id})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

document.getElementById('faqForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const question = document.getElementById('faqQuestion').value.trim();
    const audioUrl = document.getElementById('faqAudio').value.trim();
    const orderIndex = parseInt(document.getElementById('faqOrder').value) || 0;

    if (!question || !audioUrl) {
        showToast('Preencha pergunta e URL do áudio!', 'error');
        return;
    }

    const { error } = await _supabase.from('faqs').insert([{ question, audio_url: audioUrl, order_index: orderIndex }]);

    if (!error) {
        showToast('✅ FAQ cadastrada!');
        e.target.reset();
        await loadFaqs();
        updateStats();
    } else {
        showToast('Erro ao salvar FAQ', 'error');
    }
});

// PROVA SOCIAL
async function loadSocialProof() {
    const { data } = await _supabase.from('social_proof').select('*').order('display_order');
    const tbody = document.getElementById('socialProofTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px;">
            <i class="fas fa-images fa-3x" style="color:var(--medium-gray);"></i>
            <p>Nenhuma imagem cadastrada</p>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(item => `
        <tr>
            <td><strong>#${item.id}</strong></td>
            <td><img src="${item.image_url}" class="prod-img" onerror="this.src='https://via.placeholder.com/60'"></td>
            <td>${item.caption || '—'}</td>
            <td>${item.display_order}</td>
            <td><span class="badge ${item.is_active ? 'badge-true' : 'badge-false'}">${item.is_active ? 'Ativo' : 'Inativo'}</span></td>
            <td><button class="btn-danger" onclick="confirmDelete('social_proof', ${item.id})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
}

document.getElementById('socialProofForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const imageUrl = document.getElementById('proofImage').value.trim();
    const caption = document.getElementById('proofCaption').value.trim() || null;
    const isActive = document.getElementById('proofActive').checked;
    const displayOrder = parseInt(document.getElementById('proofOrder').value) || 0;

    if (!imageUrl) {
        showToast('Digite a URL da imagem!', 'error');
        return;
    }

    const { error } = await _supabase
        .from('social_proof')
        .insert([{ image_url: imageUrl, caption, is_active: isActive, display_order: displayOrder }]);

    if (!error) {
        showToast('✅ Imagem cadastrada!');
        e.target.reset();
        document.getElementById('proofActive').checked = true;
        document.getElementById('proofOrder').value = '0';
        await loadSocialProof();
    } else {
        showToast('Erro ao salvar imagem', 'error');
    }
});

// ESTATÍSTICAS
async function updateStats() {
    const [products, categories, reviews, faqs] = await Promise.all([
        _supabase.from('products').select('*', { count: 'exact', head: true }),
        _supabase.from('categories').select('*', { count: 'exact', head: true }),
        _supabase.from('reviews').select('*', { count: 'exact', head: true }),
        _supabase.from('faqs').select('*', { count: 'exact', head: true })
    ]);

    document.getElementById('totalProducts').textContent = products.count || 0;
    document.getElementById('totalCategories').textContent = categories.count || 4;
    document.getElementById('totalReviews').textContent = reviews.count || 0;
    document.getElementById('totalFaqs').textContent = faqs.count || 0;
}

// CONFIRMAÇÃO DE EXCLUSÃO
function confirmDelete(type, id) {
    deleteType = type;
    deleteId = id;
    document.getElementById('confirmOverlay').classList.add('active');
}

function hideConfirm() {
    document.getElementById('confirmOverlay').classList.remove('active');
    deleteId = null;
    deleteType = null;
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!deleteId || !deleteType) return;

    const tables = {
        product: 'products',
        category: 'categories',
        review: 'reviews',
        faq: 'faqs',
        social_proof: 'social_proof'
    };

    const { error } = await _supabase.from(tables[deleteType]).delete().eq('id', deleteId);

    if (!error) {
        showToast('✅ Item excluído!');
        await loadAllData();
    } else {
        showToast('Erro ao excluir', 'error');
    }
    hideConfirm();
});

document.getElementById('confirmOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('confirmOverlay')) hideConfirm();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideConfirm();
});

// TOAST
function showToast(message, type = 'success') {
    const toast = document.getElementById('adminToast');
    toast.textContent = message;
    toast.className = 'toast';
    if (type === 'error') toast.classList.add('error');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}