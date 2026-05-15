import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe Webhook Endpoint (needs raw body, MUST be before express.json())
  app.post("/api/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("❌ STRIPE_WEBHOOK_SECRET não configurada!");
      return res.status(400).send("Webhook secret missing");
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("❌ STRIPE_SECRET_KEY não configurada!");
      return res.status(400).send("Secret key missing");
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

    console.log(`[Stripe Webhook] Evento recebido: ${event.type}`);

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          const companyId = session.metadata?.companyId;
          const planId = session.metadata?.planId;

          if (companyId && companyId !== "unknown") {
            console.log(`✅ Webhook: Ativando plano ${planId} para empresa ${companyId}`);
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
          const customerId = subscription.customer;

          console.log(`⚠️ Webhook: Assinatura cancelada para cliente ${customerId}`);
          await supabase
            .from('empresas')
            .update({ plano: 'free' })
            .eq('stripe_customer_id', customerId);
          break;
        }
        
        case 'customer.subscription.updated': {
           const subscription = event.data.object as any;
           // Identificar o novo plano pelo item da assinatura
           const planItem = subscription.items.data[0];
           const priceId = planItem.price.id;
           
           // Mapear priceId para planId se necessário, ou usar metadados da assinatura
           // Por enquanto, apenas registramos
           console.log(`ℹ️ Webhook: Assinatura atualizada para cliente ${subscription.customer}`);
           break;
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("❌ Webhook Processing Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // Middleware for parsing JSON (ONLY for other routes)
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "test" });
  });

  // Stripe Checkout Endpoint
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

      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("A variável STRIPE_SECRET_KEY não foi configurada.");
      }

      if (!priceId) {
        throw new Error(`ID de preço não encontrado para o plano ${planId} (${interval}). Solicite ao administrador configurar as variáveis STRIPE_${planId.toUpperCase()}_...`);
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-04-10' as any,
      });

      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers['host'];
      const baseUrl = `${protocol}://${host}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        customer_email: email || undefined,
        metadata: {
          companyId: companyId || "unknown",
          planId,
          interval: interval || 'monthly',
        },
        success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${baseUrl}/?success=false`,
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message || "Erro ao criar checkout." });
    }
  });

  app.post("/api/create-portal-session", async (req, res) => {
    try {
      const { customerId } = req.body;

      if (!customerId) {
        return res.status(400).json({ error: "Customer ID é necessário" });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY não configurada");
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-04-10' as any,
      });

      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers['host'];
      const returnUrl = `${protocol}://${host}`;

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Portal Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/verify-session", async (req, res) => {
    try {
      const sessionId = req.query.session_id as string;
      if (!sessionId) {
        return res.status(400).json({ error: "session_id é obrigatório" });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY não configurada");
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-04-10' as any,
      });

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === 'paid' || session.status === 'complete') {
        const planId = session.metadata?.planId;
        const companyId = session.metadata?.companyId;
        const customerId = session.customer;

        // Atualizar o banco de dados proativamente no servidor
        if (companyId && planId) {
          try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
            
            console.log(`[Verify] Atualizando empresa ${companyId} para plano ${planId}`);
            await supabase
              .from('empresas')
              .update({ 
                plano: planId, 
                stripe_customer_id: customerId 
              })
              .eq('id', companyId);
          } catch (dbErr) {
            console.error("[Verify] Erro ao atualizar banco:", dbErr);
            // Não falha a requisição aqui, pois o webhook ainda pode funcionar
          }
        }

        res.json({
          success: true,
          planId,
          companyId,
          customerId
        });
      } else {
        res.json({ success: false, status: session.payment_status });
      }
    } catch (error: any) {
      console.error("Verify Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Garantir que chamadas de API não encontradas retornem JSON e não a página HTML (SPA fallback)
  app.all("/api/*", (req, res) => {
    res.status(404).json({ 
      error: "Rota de API não encontrada", 
      path: req.url,
      method: req.method,
      tip: "Verifique se o backend está rodando corretamente (npm run start)."
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
