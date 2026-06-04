/**
 * AURUM STORE — JavaScript Principal
 * =====================================
 * Módulos:
 *  1. Estado Global
 *  2. Persistência (LocalStorage)
 *  3. Carregamento de Produtos (JSON)
 *  4. Renderização de Cards
 *  5. Carousel (touch + mouse)
 *  6. Categorias / Filtro
 *  7. Busca
 *  8. Modal de Produto
 *  9. Carrinho (drawer)
 * 10. Checkout + WhatsApp
 * 11. Toast Notifications
 * 12. Inicialização
 */

'use strict';

/* ============================================================
   1. ESTADO GLOBAL
   ============================================================ */
const State = {
    products: [],       // Produtos carregados do JSON
    filteredProducts: [],       // Produtos após filtro/busca
    cart: [],       // Itens no carrinho
    activeCategory: 'Todos',  // Categoria ativa
    searchQuery: '',       // Texto de busca
    currentProduct: null,     // Produto aberto no modal
    selectedColor: null,     // Cor selecionada no modal
    selectedSize: null,     // Tamanho selecionado no modal
    modalCarouselIdx: 0,        // Slide atual do modal
};

/* ============================================================
   2. PERSISTÊNCIA (LocalStorage)
   ============================================================ */
const CART_KEY = 'aurum_cart_v1';

/** Salva o carrinho no localStorage */
function saveCart() {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(State.cart));
    } catch (e) {
        console.warn('Não foi possível salvar o carrinho:', e);
    }
}

/** Carrega o carrinho do localStorage */
function loadCart() {
    try {
        const raw = localStorage.getItem(CART_KEY);
        if (raw) {
            State.cart = JSON.parse(raw);
        }
    } catch (e) {
        console.warn('Erro ao carregar carrinho:', e);
        State.cart = [];
    }
}

/* ============================================================
   3. CARREGAMENTO DE PRODUTOS (JSON)
   ============================================================ */
async function loadProducts() {
    try {
        const res = await fetch('products.json');
        if (!res.ok) throw new Error('Arquivo não encontrado');
        const data = await res.json();
        State.products = data.products;
        State.filteredProducts = [...State.products];
        // Configura informações da loja
        setupStoreInfo(data.store);
        // Renderiza categorias
        renderCategories(data.store.categories);
        return data;
    } catch (err) {
        console.error('Erro ao carregar produtos:', err);
        showToast('Erro ao carregar produtos. Usando dados de fallback.', 'error');
        State.products = getFallbackProducts();
        State.filteredProducts = [...State.products];
        return null;
    }
}

/** Configura informações da loja (nome, WhatsApp etc.) */
function setupStoreInfo(store) {
    if (!store) return;
    document.querySelectorAll('[data-store-name]').forEach(el => el.textContent = store.name);
    document.querySelectorAll('[data-store-whatsapp]').forEach(el => el.href = `https://wa.me/${store.whatsapp}`);
    // Armazena número do WhatsApp globalmente
    window.STORE_WHATSAPP = store.whatsapp || '5511999999999';
}

/* ============================================================
   4. RENDERIZAÇÃO DE CARDS DE PRODUTO
   ============================================================ */

/** Renderiza todos os cards de produto no grid */
function renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (products.length === 0) {
        grid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--TextoP);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 16px;opacity:.3">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p style="font-size:16px;">Nenhum produto encontrado</p>
        <button onclick="clearFilters()" style="margin-top:12px;color:var(--Borda);font-weight:600;text-decoration:underline;background:none;border:none;cursor:pointer;">Ver todos</button>
      </div>`;
        return;
    }

    grid.innerHTML = products.map(p => buildCardHTML(p)).join('');
    // Inicializa carouseis dos cards
    products.forEach(p => initCardCarousel(p.id));
    // Eventos dos cards
    attachCardEvents();
}

/** Gera o HTML de um card de produto */
function buildCardHTML(p) {
    const discount = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
    const starsHTML = buildStars(p.rating);
    const imagesHTML = p.images.map((img, i) => `
    <div class="carousel-slide">
      <img src="${img}" alt="${p.name} - foto ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}" draggable="false">
    </div>`).join('');
    const dotsHTML = p.images.map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}"></span>`).join('');

    return `
    <article class="product-card" data-product-id="${p.id}" role="button" tabindex="0" aria-label="Ver ${p.name}">
      <!-- Carousel de imagens -->
      <div class="card-carousel" data-carousel-id="${p.id}">
        <div class="carousel-track" data-track="${p.id}">${imagesHTML}</div>
        ${p.badge ? `<span class="card-badge">${p.badge}</span>` : ''}
        <button class="btn-wish" data-wish-id="${p.id}" aria-label="Favoritar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <div class="carousel-dots" data-dots="${p.id}">${dotsHTML}</div>
      </div>
      <!-- Informações do produto -->
      <div class="card-body">
        <span class="card-category">${p.category}</span>
        <h3 class="card-name">${p.name}</h3>
        <div class="card-rating">
          <span class="stars">${starsHTML}</span>
          <span class="rating-num">${p.rating} (${p.reviews})</span>
        </div>
        <div class="card-pricing">
          <div>
            <span class="price-current">R$ ${formatPrice(p.price)}</span>
            ${p.originalPrice ? `<span class="price-original"> R$ ${formatPrice(p.originalPrice)}</span>` : ''}
          </div>
          ${discount > 0 ? `<span class="price-discount">-${discount}%</span>` : ''}
          <button class="btn-quick-add" data-product-id="${p.id}" aria-label="Adicionar ao carrinho rapidamente">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </article>`;
}

/** Constrói HTML de estrelas com base na nota */
function buildStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    let html = '★'.repeat(full);
    if (half) html += '☆';
    return html;
}

/** Formata preço em reais */
function formatPrice(num) {
    return num.toFixed(2).replace('.', ',');
}

/** Anexa eventos de clique nos cards e botões */
function attachCardEvents() {
    // Clique no card → abre modal
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', e => {
            // Não abrir se clicou no botão de favorito ou quick-add
            if (e.target.closest('.btn-wish') || e.target.closest('.btn-quick-add')) return;
            const id = parseInt(card.dataset.productId);
            openProductModal(id);
        });
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const id = parseInt(card.dataset.productId);
                openProductModal(id);
            }
        });
    });

    // Botão quick-add → abre modal direto na aba de compra
    document.querySelectorAll('.btn-quick-add').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.productId);
            openProductModal(id);
        });
    });

    // Botão de favorito
    document.querySelectorAll('.btn-wish').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            btn.classList.toggle('active');
        });
    });
}

/* ============================================================
   5. CAROUSEL (touch + mouse drag)
   ============================================================ */

/** Inicializa o carousel de um card específico */
function initCardCarousel(productId) {
    const carousel = document.querySelector(`[data-carousel-id="${productId}"]`);
    const track = document.querySelector(`[data-track="${productId}"]`);
    const dotsWrap = document.querySelector(`[data-dots="${productId}"]`);
    if (!carousel || !track) return;

    const slides = track.querySelectorAll('.carousel-slide');
    if (slides.length <= 1) return;

    let current = 0;
    let startX = 0, isDragging = false, dragDelta = 0;

    const goTo = idx => {
        current = Math.max(0, Math.min(idx, slides.length - 1));
        track.style.transform = `translateX(-${current * 100}%)`;
        // Atualiza dots
        if (dotsWrap) {
            dotsWrap.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === current));
        }
    };

    // Touch events
    carousel.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        isDragging = true;
        track.style.transition = 'none';
    }, { passive: true });

    carousel.addEventListener('touchmove', e => {
        if (!isDragging) return;
        dragDelta = e.touches[0].clientX - startX;
        const offset = -current * 100 + (dragDelta / carousel.offsetWidth) * 100;
        track.style.transform = `translateX(${offset}%)`;
    }, { passive: true });

    carousel.addEventListener('touchend', () => {
        isDragging = false;
        track.style.transition = '';
        if (dragDelta < -50) goTo(current + 1);
        else if (dragDelta > 50) goTo(current - 1);
        else goTo(current);
        dragDelta = 0;
    });

    // Mouse drag (desktop)
    carousel.addEventListener('mousedown', e => {
        startX = e.clientX;
        isDragging = true;
        track.style.transition = 'none';
        carousel.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', e => {
        if (!isDragging) return;
        dragDelta = e.clientX - startX;
        const offset = -current * 100 + (dragDelta / carousel.offsetWidth) * 100;
        track.style.transform = `translateX(${offset}%)`;
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        track.style.transition = '';
        carousel.style.cursor = '';
        if (dragDelta < -60) goTo(current + 1);
        else if (dragDelta > 60) goTo(current - 1);
        else goTo(current);
        dragDelta = 0;
    });
}

/** Carousel do modal de produto */
function initModalCarousel(images) {
    const track = document.getElementById('modalCarouselTrack');
    const dotsWrap = document.getElementById('modalDots');
    if (!track) return;

    track.innerHTML = images.map((img, i) => `
    <div class="modal-carousel-slide">
      <img src="${img}" alt="foto ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}">
    </div>`).join('');

    dotsWrap.innerHTML = images.map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}"></span>`).join('');

    State.modalCarouselIdx = 0;

    const goTo = idx => {
        State.modalCarouselIdx = Math.max(0, Math.min(idx, images.length - 1));
        track.style.transform = `translateX(-${State.modalCarouselIdx * 100}%)`;
        dotsWrap.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === State.modalCarouselIdx));
        // Sincroniza thumbs
        document.querySelectorAll('.gallery-thumb').forEach((t, i) => t.classList.toggle('active', i === State.modalCarouselIdx));
    };

    // Expõe função para thumbs
    window._modalCarouselGoTo = goTo;

    // Touch
    let startX = 0, isDragging = false, delta = 0;
    const gallery = document.getElementById('modalGallery');

    gallery.addEventListener('touchstart', e => { startX = e.touches[0].clientX; isDragging = true; }, { passive: true });
    gallery.addEventListener('touchmove', e => {
        if (!isDragging) return;
        delta = e.touches[0].clientX - startX;
        const off = -State.modalCarouselIdx * 100 + (delta / gallery.offsetWidth) * 100;
        track.style.transition = 'none';
        track.style.transform = `translateX(${off}%)`;
    }, { passive: true });
    gallery.addEventListener('touchend', () => {
        isDragging = false;
        track.style.transition = '';
        if (delta < -50) goTo(State.modalCarouselIdx + 1);
        else if (delta > 50) goTo(State.modalCarouselIdx - 1);
        else goTo(State.modalCarouselIdx);
        delta = 0;
    });
}

/* ============================================================
   6. CATEGORIAS / FILTRO
   ============================================================ */

/** Renderiza chips de categoria */
function renderCategories(categories) {
    const strip = document.getElementById('categoryStrip');
    if (!strip || !categories) return;

    strip.innerHTML = categories.map(cat => `
    <button class="cat-chip${cat === 'Todos' ? ' active' : ''}" data-cat="${cat}">${cat}</button>
  `).join('');

    strip.addEventListener('click', e => {
        const btn = e.target.closest('.cat-chip');
        if (!btn) return;
        strip.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        State.activeCategory = btn.dataset.cat;
        applyFilters();
    });
}

/** Aplica filtros de categoria e busca */
function applyFilters() {
    let result = [...State.products];

    // Filtro de categoria
    if (State.activeCategory !== 'Todos') {
        result = result.filter(p => p.category === State.activeCategory);
    }

    // Filtro de busca
    if (State.searchQuery.trim()) {
        const q = State.searchQuery.toLowerCase().trim();
        result = result.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        );
    }

    State.filteredProducts = result;
    renderProducts(result);
}

/** Limpa todos os filtros */
function clearFilters() {
    State.activeCategory = 'Todos';
    State.searchQuery = '';
    // Reset UI
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === 'Todos'));
    document.querySelectorAll('[data-search]').forEach(i => i.value = '');
    applyFilters();
}
window.clearFilters = clearFilters; // Expõe para HTML inline

/* ============================================================
   7. BUSCA
   ============================================================ */
function setupSearch() {
    const inputs = document.querySelectorAll('[data-search]');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            State.searchQuery = input.value;
            // Sincroniza outros inputs de busca
            inputs.forEach(i => { if (i !== input) i.value = input.value; });
            applyFilters();
        });
    });
}

/* ============================================================
   8. MODAL DE PRODUTO
   ============================================================ */

/** Abre o modal de detalhe de produto */
function openProductModal(productId) {
    const product = State.products.find(p => p.id === productId);
    if (!product) return;

    State.currentProduct = product;
    State.selectedColor = null;
    State.selectedSize = null;

    const overlay = document.getElementById('productModal');
    const discount = product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;

    // Preenche informações
    document.getElementById('modalCategory').textContent = product.category;
    document.getElementById('modalName').textContent = product.name;
    document.getElementById('modalPrice').textContent = `R$ ${formatPrice(product.price)}`;
    document.getElementById('modalDescription').textContent = product.description;
    document.getElementById('modalRatingNum').textContent = `${product.rating} · ${product.reviews} avaliações`;
    document.getElementById('modalStars').textContent = buildStars(product.rating);

    const origEl = document.getElementById('modalPriceOrig');
    const badgeEl = document.getElementById('modalPriceBadge');
    if (product.originalPrice) {
        origEl.textContent = `R$ ${formatPrice(product.originalPrice)}`;
        badgeEl.textContent = `-${discount}%`;
        origEl.style.display = '';
        badgeEl.style.display = '';
    } else {
        origEl.style.display = 'none';
        badgeEl.style.display = 'none';
    }

    // Inicializa carousel do modal
    initModalCarousel(product.images);

    // Thumbnails
    const thumbsWrap = document.getElementById('galleryThumbs');
    thumbsWrap.innerHTML = product.images.map((img, i) => `
    <button class="gallery-thumb${i === 0 ? ' active' : ''}" data-idx="${i}" aria-label="foto ${i + 1}">
      <img src="${img}" alt="thumb ${i + 1}" loading="lazy">
    </button>`).join('');
    thumbsWrap.querySelectorAll('.gallery-thumb').forEach(btn => {
        btn.addEventListener('click', () => window._modalCarouselGoTo(parseInt(btn.dataset.idx)));
    });

    // Seletores de cor
    const colorGrid = document.getElementById('colorGrid');
    const colorLabel = document.getElementById('colorLabel');
    colorGrid.innerHTML = product.colors.map(c => `
    <button class="color-swatch" data-color="${c.name}" data-hex="${c.hex}" title="${c.name}"
      style="background:${c.hex};" aria-label="${c.name}">
    </button>`).join('');
    colorGrid.querySelectorAll('.color-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
            colorGrid.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            State.selectedColor = btn.dataset.color;
            colorLabel.innerHTML = `Cor <span style="font-weight:400;color:var(--TextoP)">${State.selectedColor}</span>`;
        });
    });

    // Seletores de tamanho
    const sizeGrid = document.getElementById('sizeGrid');
    sizeGrid.innerHTML = product.sizes.map(s => `
    <button class="size-btn" data-size="${s}">${s}</button>`).join('');
    sizeGrid.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            sizeGrid.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            State.selectedSize = btn.dataset.size;
        });
    });

    // Abre overlay
    overlay.classList.add('open');
    document.body.classList.add('no-scroll');
}

/** Fecha o modal de produto */
function closeProductModal() {
    document.getElementById('productModal').classList.remove('open');
    document.body.classList.remove('no-scroll');
    State.currentProduct = null;
}

/** Configura eventos do modal */
function setupProductModal() {
    const overlay = document.getElementById('productModal');
    const closeBtn = document.getElementById('modalClose');

    closeBtn?.addEventListener('click', closeProductModal);
    overlay?.addEventListener('click', e => {
        if (e.target === overlay) closeProductModal();
    });

    // Botão Adicionar ao Carrinho
    document.getElementById('btnAddCart')?.addEventListener('click', () => {
        if (!validateProductSelection()) return;
        addToCart(State.currentProduct, State.selectedColor, State.selectedSize);
        closeProductModal();
    });

    // Botão Comprar Agora
    document.getElementById('btnBuyNow')?.addEventListener('click', () => {
        if (!validateProductSelection()) return;
        addToCart(State.currentProduct, State.selectedColor, State.selectedSize);
        closeProductModal();
        setTimeout(() => openCheckout(), 300);
    });
}

/** Valida se cor e tamanho foram selecionados */
function validateProductSelection() {
    if (!State.selectedColor) {
        showToast('Selecione uma cor antes de continuar', 'error');
        document.getElementById('colorGrid').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }
    if (!State.selectedSize) {
        showToast('Selecione um tamanho antes de continuar', 'error');
        document.getElementById('sizeGrid').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }
    return true;
}

/* ============================================================
   9. CARRINHO
   ============================================================ */

/** Adiciona produto ao carrinho */
function addToCart(product, color, size, qty = 1) {
    const key = `${product.id}-${color}-${size}`;
    const existing = State.cart.find(item => item.key === key);

    if (existing) {
        existing.qty += qty;
    } else {
        State.cart.push({
            key,
            productId: product.id,
            name: product.name,
            image: product.images[0],
            price: product.price,
            color,
            size,
            qty,
        });
    }

    saveCart();
    updateCartUI();
    showToast(`${product.name} adicionado ao carrinho!`, 'success');
}

/** Remove item do carrinho */
function removeFromCart(key) {
    State.cart = State.cart.filter(item => item.key !== key);
    saveCart();
    updateCartUI();
    renderCartItems();
}

/** Altera quantidade de um item */
function changeQty(key, delta) {
    const item = State.cart.find(i => i.key === key);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    saveCart();
    updateCartUI();
    renderCartItems();
}

/** Atualiza badges e totais do carrinho */
function updateCartUI() {
    const total = State.cart.reduce((acc, item) => acc + item.qty, 0);
    const totalStr = total > 99 ? '99+' : String(total);

    // Badge no header desktop
    const headerBadge = document.getElementById('cartBadgeHeader');
    if (headerBadge) {
        headerBadge.textContent = totalStr;
        headerBadge.classList.toggle('visible', total > 0);
    }

    // Badge no botão desktop
    const desktopBadge = document.getElementById('cartBadgeDesktop');
    if (desktopBadge) {
        desktopBadge.textContent = totalStr;
        desktopBadge.classList.toggle('visible', total > 0);
    }

    // Badge bottom nav mobile
    const bottomBadge = document.getElementById('cartBadgeBottom');
    if (bottomBadge) {
        bottomBadge.textContent = totalStr;
        bottomBadge.classList.toggle('visible', total > 0);
    }

    // Texto contador no drawer
    const countEl = document.getElementById('cartItemCount');
    if (countEl) countEl.textContent = `${total} ${total === 1 ? 'item' : 'itens'}`;
}

/** Renderiza itens dentro do drawer do carrinho */
function renderCartItems() {
    const body = document.getElementById('cartBody');
    if (!body) return;

    if (State.cart.length === 0) {
        body.innerHTML = `
      <div class="cart-empty">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <p>Seu carrinho está vazio</p>
        <button onclick="closeCart()" style="color:var(--Borda);font-weight:600;background:none;border:none;cursor:pointer;margin-top:4px;">Continuar comprando</button>
      </div>`;
        return;
    }

    body.innerHTML = State.cart.map(item => `
    <div class="cart-item" data-key="${item.key}">
      <div class="cart-item-img">
        <img src="${item.image}" alt="${item.name}" loading="lazy">
      </div>
      <div class="cart-item-info">
        <p class="cart-item-name">${item.name}</p>
        <p class="cart-item-meta">${item.color} · ${item.size}</p>
        <p class="cart-item-price">R$ ${formatPrice(item.price * item.qty)}</p>
      </div>
      <div class="cart-item-controls">
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty('${item.key}',-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.key}',1)">+</button>
        </div>
        <button class="btn-remove" onclick="removeFromCart('${item.key}')">Remover</button>
      </div>
    </div>`).join('');
}

/** Calcula total do carrinho */
function getCartTotal() {
    return State.cart.reduce((acc, item) => acc + item.price * item.qty, 0);
}

/** Abre drawer do carrinho */
function openCart() {
    renderCartItems();
    updateCartFooter();
    document.getElementById('cartOverlay').classList.add('open');
    document.body.classList.add('no-scroll');
    // Marca bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector('[data-nav="cart"]')?.classList.add('active');
}

/** Fecha drawer do carrinho */
function closeCart() {
    document.getElementById('cartOverlay').classList.remove('open');
    document.body.classList.remove('no-scroll');
    document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector('[data-nav="home"]')?.classList.add('active');
}
window.closeCart = closeCart;

/** Atualiza rodapé do carrinho (total) */
function updateCartFooter() {
    const subtotal = document.getElementById('cartSubtotal');
    if (subtotal) subtotal.textContent = `R$ ${formatPrice(getCartTotal())}`;
}

/** Configura eventos do carrinho */
function setupCart() {
    const overlay = document.getElementById('cartOverlay');

    // Fecha ao clicar fora
    overlay?.addEventListener('click', e => {
        if (e.target === overlay) closeCart();
    });

    // Botões de abrir carrinho
    document.querySelectorAll('[data-open-cart]').forEach(btn => {
        btn.addEventListener('click', openCart);
    });

    // Botão de checkout
    document.getElementById('btnCheckout')?.addEventListener('click', () => {
        if (State.cart.length === 0) {
            showToast('Seu carrinho está vazio!', 'error');
            return;
        }
        closeCart();
        setTimeout(() => openCheckout(), 200);
    });
}

/* ============================================================
   10. CHECKOUT + WHATSAPP
   ============================================================ */

/** Abre modal de checkout */
function openCheckout() {
    if (State.cart.length === 0) {
        showToast('Adicione produtos ao carrinho primeiro!', 'info');
        return;
    }
    renderCheckoutSummary();
    document.getElementById('checkoutOverlay').classList.add('open');
    document.body.classList.add('no-scroll');
}

/** Renderiza resumo do pedido no checkout */
function renderCheckoutSummary() {
    const wrap = document.getElementById('orderSummaryItems');
    if (!wrap) return;

    wrap.innerHTML = State.cart.map(item => `
    <div class="summary-item">
      <div class="summary-img"><img src="${item.image}" alt="${item.name}" loading="lazy"></div>
      <div class="summary-info">
        <p class="summary-name">${item.name}</p>
        <p class="summary-meta">${item.color} · ${item.size} · Qtd: ${item.qty}</p>
      </div>
      <p class="summary-price">R$ ${formatPrice(item.price * item.qty)}</p>
    </div>`).join('');

    const totalEl = document.getElementById('orderTotal');
    if (totalEl) totalEl.textContent = `R$ ${formatPrice(getCartTotal())}`;
}

/** Fecha checkout */
function closeCheckout() {
    document.getElementById('checkoutOverlay').classList.remove('open');
    document.body.classList.remove('no-scroll');
}

/** Gera e envia mensagem para o WhatsApp */
function sendWhatsApp() {
    const fields = ['customerName', 'customerPhone', 'customerAddress', 'customerNumber', 'customerComplement', 'customerNeighborhood', 'customerCity'];
    const required = ['customerName', 'customerPhone', 'customerAddress', 'customerNumber', 'customerCity'];

    // Coleta dados do formulário
    const formData = {};
    let valid = true;

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) formData[id] = el.value.trim();
    });

    // Valida campos obrigatórios
    required.forEach(id => {
        const el = document.getElementById(id);
        if (!el || !el.value.trim()) {
            el?.style.setProperty('border-color', '#E53935');
            el?.addEventListener('input', () => el.style.removeProperty('border-color'), { once: true });
            valid = false;
        }
    });

    if (!valid) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }

    if (State.cart.length === 0) {
        showToast('Carrinho vazio!', 'error');
        return;
    }

    // Monta mensagem
    const items = State.cart.map(item => {
        const product = State.products.find(p => p.id === item.productId);
        return `
🛍️ Produto: ${item.name}
📸 Foto: ${item.image}
🎨 Cor: ${item.color}
📐 Tamanho: ${item.size}
🔢 Quantidade: ${item.qty}
💰 Preço unitário: R$ ${formatPrice(item.price)}
💵 Subtotal: R$ ${formatPrice(item.price * item.qty)}`;
    }).join('\n\n');

    const msg = `
================================
🛒 NOVO PEDIDO — AURUM STORE
================================

👤 Nome: ${formData.customerName}
📱 Telefone: ${formData.customerPhone}
📍 Endereço: ${formData.customerAddress}, ${formData.customerNumber}
${formData.customerComplement ? `📝 Complemento: ${formData.customerComplement}` : ''}
🏘️ Bairro: ${formData.customerNeighborhood || 'Não informado'}
🌆 Cidade: ${formData.customerCity}

================================
📦 ITENS DO PEDIDO:
================================
${items}

================================
💳 TOTAL DO PEDIDO: R$ ${formatPrice(getCartTotal())}
================================

Pedido realizado pelo site AURUM STORE.
  `.trim();

    const whatsapp = window.STORE_WHATSAPP || '5511999999999';
    const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    // Limpa carrinho após pedido
    State.cart = [];
    saveCart();
    updateCartUI();
    closeCheckout();
    showToast('Pedido enviado! Redirecionando para o WhatsApp...', 'success');
}

/** Configura eventos do checkout */
function setupCheckout() {
    document.getElementById('btnCloseCheckout')?.addEventListener('click', closeCheckout);
    document.getElementById('btnBackCheckout')?.addEventListener('click', closeCheckout);
    document.getElementById('btnSendWhatsApp')?.addEventListener('click', sendWhatsApp);

    // Fecha ao clicar fora
    document.getElementById('checkoutOverlay')?.addEventListener('click', e => {
        if (e.target.id === 'checkoutOverlay') closeCheckout();
    });
}

/* ============================================================
   11. TOAST NOTIFICATIONS
   ============================================================ */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span style="font-size:16px">${icons[type] || 'ℹ'}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3200);
}

/* ============================================================
   12. INICIALIZAÇÃO
   ============================================================ */
async function init() {
    // 1. Carrega carrinho salvo
    loadCart();
    updateCartUI();

    // 2. Carrega e renderiza produtos
    await loadProducts();
    renderProducts(State.filteredProducts);

    // 3. Configura busca
    setupSearch();

    // 4. Configura modais e carrinho
    setupProductModal();
    setupCart();
    setupCheckout();

    // 5. Bottom nav mobile
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const nav = item.dataset.nav;
            if (nav === 'cart') { openCart(); return; }
            if (nav === 'home') { closeCart(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
            document.querySelectorAll('.bottom-nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // 6. Scroll suave para produtos
    document.getElementById('btnShopNow')?.addEventListener('click', () => {
        document.getElementById('productsSection')?.scrollIntoView({ behavior: 'smooth' });
    });
}

/** Produtos de fallback caso o JSON não carregue */
function getFallbackProducts() {
    return [{
        id: 1,
        name: 'Camiseta Premium',
        category: 'Camisetas',
        price: 189.90,
        originalPrice: 249.90,
        description: 'Produto de demonstração.',
        images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80'],
        colors: [{ name: 'Preto', hex: '#111111' }, { name: 'Branco', hex: '#FFFFFF' }],
        sizes: ['P', 'M', 'G', 'GG'],
        badge: 'DEMO',
        rating: 4.9,
        reviews: 100
    }];
}

// Inicia quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);