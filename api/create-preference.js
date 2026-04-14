// Vercel Serverless Function - Mercado Pago Checkout Pro
// Usa variáveis de ambiente: MP_ACCESS_TOKEN

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) {
        return res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado no servidor' });
    }

    try {
        const { title, price, quantity, category, productId, picture_url } = req.body;

        if (!title || !price) {
            return res.status(400).json({ error: 'Campos obrigatórios: title, price' });
        }

        // Monta a URL base do site para redirecionamentos
        const baseUrl = req.headers.origin
            || process.env.SITE_URL
            || 'https://www.etevaldajoias.com';

        const totalPrice = parseFloat(price).toFixed(2);

        const preference = {
            items: [
                {
                    id: String(productId || Date.now()),
                    title: title,
                    description: `Produto Grupo Etevalda MT - ${category || 'Joias'}`,
                    picture_url: picture_url || '',
                    quantity: quantity || 1,
                    unit_price: parseFloat(price),
                    currency_id: 'BRL'
                }
            ],
            // ===== CORRIGIDO: Adicionado &valor na URL para o Pixel capturar =====
            back_urls: {
                success: `${baseUrl}/sucesso.html?categoria=${encodeURIComponent(category || '')}&status=approved&valor=${totalPrice}`,
                failure: `${baseUrl}/index.html?status=failure`,
                pending: `${baseUrl}/sucesso.html?categoria=${encodeURIComponent(category || '')}&status=pending&valor=${totalPrice}`
            },
            // ===== FIM DA CORREÇÃO =====
            auto_return: 'approved',
            statement_descriptor: 'ETEVALDA MT',
            external_reference: `product_${productId || Date.now()}_${Date.now()}`
        };

        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            body: JSON.stringify(preference)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Erro Mercado Pago:', data);
            return res.status(response.status).json({ error: data.message || 'Erro ao criar preferência' });
        }

        return res.status(200).json({
            id: data.id,
            init_point: data.init_point,
            sandbox_init_point: data.sandbox_init_point
        });

    } catch (error) {
        console.error('Erro interno:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
}
