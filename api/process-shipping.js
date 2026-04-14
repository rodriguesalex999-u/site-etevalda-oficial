// Vercel Serverless Function - Melhor Envio Logística
// Variáveis de ambiente: MELHORENVIO_TOKEN, MP_ACCESS_TOKEN
// Opcionais: STORE_ADDRESS, STORE_NUMBER, STORE_DISTRICT, STORE_CEP

const MELHORENVIO_API = 'https://melhorenvio.com.br/api/v2';
const SHIPPING_COST = 14.99;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const ME_TOKEN = process.env.MELHORENVIO_TOKEN;
    const MP_TOKEN = process.env.MP_ACCESS_TOKEN;

    if (!ME_TOKEN) return res.status(500).json({ error: 'MELHORENVIO_TOKEN não configurado' });
    if (!MP_TOKEN) return res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' });

    const { payment_id } = req.body;
    if (!payment_id) return res.status(400).json({ error: 'payment_id obrigatório' });

    try {
        // 1. Buscar dados do pagamento no Mercado Pago
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
            headers: { 'Authorization': `Bearer ${MP_TOKEN}` }
        });

        if (!mpRes.ok) {
            const err = await mpRes.json();
            return res.status(mpRes.status).json({ error: err.message || 'Erro ao buscar pagamento no MP' });
        }

        const payment = await mpRes.json();

        if (payment.status !== 'approved') {
            return res.status(200).json({ message: `Pagamento com status "${payment.status}" — frete aguardando aprovação.` });
        }

        const payer = payment.payer || {};
        const addr = payment.additional_info?.shipments?.receiver_address || {};
        const buyerName = [payer.first_name, payer.last_name].filter(Boolean).join(' ') || 'Cliente';
        const totalValue = payment.transaction_amount || SHIPPING_COST;

        // 2. Montar payload para o Melhor Envio
        const cartPayload = {
            service: 1,
            from: {
                name: 'Grupo Etevalda MT',
                phone: '6521290640',
                email: 'contato@etevaldajoias.com',
                document: '55347120000151',
                company_document: '55347120000151',
                address: process.env.STORE_ADDRESS || 'Av. Historiador Rubens de Mendonça',
                number: process.env.STORE_NUMBER || '4293',
                district: process.env.STORE_DISTRICT || 'Centro Político Administrativo',
                city: 'Cuiabá',
                state_abbr: 'MT',
                country_id: 'BR',
                postal_code: (process.env.STORE_CEP || '78049000').replace(/\D/g, '')
            },
            to: {
                name: buyerName,
                phone: payer.phone ? `${payer.phone.area_code || ''}${payer.phone.number || ''}` : '',
                email: payer.email || '',
                document: payer.identification?.number || '',
                address: addr.street_name || '',
                number: String(addr.street_number || 's/n'),
                complement: addr.comment || '',
                district: addr.neighborhood || '',
                city: addr.city?.name || '',
                state_abbr: addr.state?.name || '',
                country_id: 'BR',
                postal_code: (addr.zip_code || '').replace(/\D/g, '')
            },
            products: [
                {
                    name: payment.additional_info?.items?.[0]?.title || 'Joia Etevalda',
                    quantity: 1,
                    unitary_value: SHIPPING_COST,
                    weight: 0.3,
                    width: 10,
                    height: 5,
                    length: 10
                }
            ],
            volumes: [
                { height: 5, width: 10, length: 10, weight: 0.3 }
            ],
            options: {
                insurance_value: totalValue,
                receipt: false,
                own_hand: false,
                reverse: false,
                non_commercial: false,
                platform: 'Grupo Etevalda MT',
                tags: [{ tag: String(payment_id), url: null }]
            }
        };

        // 3. Inserir no carrinho do Melhor Envio
        const meRes = await fetch(`${MELHORENVIO_API}/me/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${ME_TOKEN}`,
                'User-Agent': 'GrupoEtevaldaMT/1.0 (contato@etevaldajoias.com)'
            },
            body: JSON.stringify(cartPayload)
        });

        const meData = await meRes.json();

        if (!meRes.ok) {
            console.error('Erro Melhor Envio:', meData);
            return res.status(meRes.status).json({ error: meData.message || 'Erro ao criar frete no Melhor Envio' });
        }

        return res.status(200).json({
            success: true,
            order_id: meData.id,
            tracking: meData.tracking || null
        });

    } catch (error) {
        console.error('Erro interno process-shipping:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
}
