import express from "express";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Stripe Webhook Endpoint (needs raw body, MUST be before express.json())
app.post("/api/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET não configurada!");
    return res.status(400).send("Webhook secret missing");
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-04-10' as any,
  });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const companyId = session.metadata?.companyId;
        const planId = session.metadata?.planId;

        if (companyId && companyId !== "unknown") {
          await supabase
            .from('empresas')
            .update({ 
              plano: planId || 'basico', 
              stripe_customer_id: session.customer 
            })
            .eq('id', companyId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        await supabase
          .from('empresas')
          .update({ plano: 'free' })
          .eq('stripe_customer_id', subscription.customer);
        break;
      }
    }
    res.json({ received: true });
  } catch (error: any) {
    console.error("❌ Webhook Processing Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", environment: process.env.NODE_ENV });
});

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { planId, email, companyId, interval } = req.body;
    let priceId = '';
    
    if (planId === 'basico') {
      priceId = interval === 'annual' ? process.env.STRIPE_BASIC_ANNUAL_PRICE_ID! : process.env.STRIPE_BASIC_MONTHLY_PRICE_ID!;
    } else if (planId === 'profissional') {
      priceId = interval === 'annual' ? process.env.STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID! : process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID!;
    } else if (planId === 'enterprise') {
      priceId = interval === 'annual' ? process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID! : process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID!;
    }

    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY não configurada");
    if (!priceId) throw new Error(`Preço não configurado para ${planId} ${interval}`);

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-04-10' as any,
    });

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'];
    const baseUrl = `${protocol}://${host}`;

    if (!companyId || companyId === "unknown") {
      console.error("[Stripe Checkout] Erro: Tentativa de checkout sem ID de empresa válido.");
      return res.status(400).json({ error: "Erro de identificação: ID da empresa não encontrado. Recarregue a página e tente novamente." });
    }

    console.log(`[Stripe Checkout] Criando sessão: Email=${email}, Plano=${planId}, Empresa=${companyId}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      customer_email: email || undefined,
      metadata: { 
        companyId, 
        planId, 
        interval: interval || 'monthly' 
      },
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/?success=false`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/create-portal-session", async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId) return res.status(400).json({ error: "Customer ID ausente" });

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' as any });

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'];
    const returnUrl = `${protocol}://${host}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/verify-session", async (req, res) => {
  try {
    const sessionId = req.query.session_id as string;
    if (!sessionId) return res.status(400).json({ error: "session_id ausente" });

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' as any });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid' || session.status === 'complete') {
      const planId = session.metadata?.planId;
      const companyId = session.metadata?.companyId;
      const customerId = session.customer;

      console.log(`[Stripe Verify] Iniciando atualização: Empresa=${companyId}, Plano=${planId}, Session=${sessionId}`);

      let dbUpdateSuccess = false;
      let dbError = null;

      if (companyId && companyId !== "unknown" && planId) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          
          const supabaseUrl = process.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (!supabaseUrl || !supabaseKey) {
            console.error("[Stripe Verify] Erro: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no servidor.");
            dbError = "Variáveis de ambiente do Supabase ausentes no servidor.";
          } else {
            const supabase = createClient(supabaseUrl, supabaseKey);
            
            const { data, error } = await supabase
              .from('empresas')
              .update({ 
                plano: planId, 
                stripe_customer_id: customerId 
              })
              .eq('id', companyId)
              .select();

            if (error) {
              console.error(`[Stripe Verify] Erro Supabase:`, error);
              dbError = error.message;
            } else if (data && data.length > 0) {
              console.log(`[Stripe Verify] Sucesso! Empresa ${companyId} atualizada para ${planId}.`);
              dbUpdateSuccess = true;
            } else {
              console.warn(`[Stripe Verify] Aviso: Nenhuma linha foi atualizada. Verifique se o ID ${companyId} existe na tabela 'empresas'.`);
              dbError = "Nenhuma empresa encontrada com este ID.";
            }
          }
        } catch (err: any) {
          console.error(`[Stripe Verify] Exceção ao acessar banco:`, err.message);
          dbError = err.message;
        }
      } else {
        console.warn(`[Stripe Verify] Dados incompletos nos metadados:`, { companyId, planId });
        dbError = "Metadados incompletos na sessão do Stripe.";
      }

      res.json({ 
        success: true, 
        planId, 
        companyId, 
        customerId,
        dbUpdateSuccess,
        dbError 
      });
    } else {
      console.log(`[Stripe Verify] Pagamento não concluído: ${session.payment_status}`);
      res.json({ success: false, status: session.payment_status });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fallback para rotas de API inexistentes
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: "Rota de API não encontrada" });
});

export default app;
