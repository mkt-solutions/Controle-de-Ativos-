import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "test" });
  });

  // Stripe Checkout Endpoint
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { planId, email, companyId, interval } = req.body;

      if (planId !== "basico") {
        return res.status(400).json({ error: "No momento, apenas o plano Básico está disponível para checkout em teste." });
      }

      const priceId = interval === 'annual' 
        ? process.env.STRIPE_BASIC_ANNUAL_PRICE_ID 
        : process.env.STRIPE_BASIC_MONTHLY_PRICE_ID;

      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("A variável STRIPE_SECRET_KEY não foi configurada no painel de Settings.");
      }

      if (!priceId) {
        const varName = interval === 'annual' ? 'STRIPE_BASIC_ANNUAL_PRICE_ID' : 'STRIPE_BASIC_MONTHLY_PRICE_ID';
        throw new Error(`A variável ${varName} é obrigatória. Certifique-se de usar o ID de PREÇO (price_...) e não do produto.`);
      }

      if (priceId.startsWith('prod_')) {
        throw new Error("Você forneceu um ID de Produto (prod_...). A Stripe exige um ID de PREÇO (price_...). Procure no painel da Stripe em 'Preços' dentro do produto.");
      }

      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-04-10' as any,
      });

      // Detect base URL from headers
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers['host'];
      const baseUrl = `${protocol}://${host}`;

      console.log(`[Stripe] Criando sessão: ${email}, ${planId}, ${interval} em ${baseUrl}`);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
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
      res.status(500).json({ error: error.message || "Erro interno no servidor Stripe." });
    }
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
