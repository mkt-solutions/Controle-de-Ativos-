const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const useStripeCheckout = () => {
  const handleCheckout = async (planId: string, email: string, companyId: string) => {
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId, email, companyId }),
      });

      const session = await response.json();

      if (session.error) {
        throw new Error(session.error);
      }

      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error('Sessão de checkout não retornou URL.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Erro ao iniciar o pagamento. Por favor, tente novamente.');
    }
  };

  return { handleCheckout };
};
