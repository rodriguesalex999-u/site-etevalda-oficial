// Vercel Serverless Function - Meta Conversions API
// Envia eventos do servidor para o Facebook com desduplicação

const PIXEL_ID = process.env.FB_PIXEL_ID || '1002683195582228';
const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || 'EAAkX5PUFamABRwwT4r2Iu6U2vR7zoGNqmNTvRAFZBM2APT2zQN1ZATgKnZCryr5JbOQdz3peZB3uHsSJ3fhl5fwY7mNmfsyyXZAGKPZCD9whKcUyaqvIW8a9VNrr36y19IrcOpTlC38LFLCp7TEpdaq6PoPHBCQS5Jw2JkZAi4MJJBXZA7CQ0ybQZCGv2HFQCaAWzhAZDZD';
const TEST_EVENT_CODE = process.env.FB_TEST_EVENT_CODE || 'TEST93047';

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

    // Validar configuração de segurança
    if (!ACCESS_TOKEN) {
        return res.status(500).json({ 
            error: 'FB_ACCESS_TOKEN não configurado. Configure esta variável de ambiente na Vercel.' 
        });
    }

    try {
        const { 
            event_name, 
            event_id, 
            event_time, 
            user_data, 
            custom_data, 
            action_source 
        } = req.body;

        if (!event_name || !event_id) {
            return res.status(400).json({ error: 'Campos obrigatórios: event_name, event_id' });
        }

        // Construir payload para a Conversions API
        const payload = {
            data: [
                {
                    event_name: event_name,
                    event_id: event_id,
                    event_time: event_time || Math.floor(Date.now() / 1000),
                    action_source: action_source || 'website',
                    user_data: {
                        em: user_data?.em || null,
                        ph: user_data?.ph || null,
                        fn: user_data?.fn || null,
                        ln: user_data?.ln || null,
                        ct: user_data?.ct || null,
                        st: user_data?.st || null,
                        zp: user_data?.zp || null,
                        country: user_data?.country || 'BR',
                        client_ip_address: user_data?.client_ip_address || req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress,
                        client_user_agent: user_data?.client_user_agent || req.headers['user-agent'],
                        fbc: user_data?.fbc || null,
                        fbp: user_data?.fbp || null,
                        subscription_id: user_data?.subscription_id || null
                    },
                    custom_data: custom_data || {}
                }
            ],
            test_event_code: TEST_EVENT_CODE || undefined
        };

        // Enviar para a Conversions API do Facebook
        const response = await fetch(`https://graph.facebook.com/v18.0/${PIXEL_ID}/events`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Erro Facebook Conversions API:', data);
            return res.status(response.status).json({ error: data.error?.message || 'Erro ao enviar evento para Facebook' });
        }

        console.log('✅ Evento enviado para Facebook Conversions API:', event_name, event_id);
        return res.status(200).json({ 
            success: true, 
            fb_event_id: data.events_received?.[0]?.event_id,
            message: 'Evento enviado com sucesso'
        });

    } catch (error) {
        console.error('Erro interno facebook-conversions:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
}
