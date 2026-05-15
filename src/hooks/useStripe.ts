export const useStripeCheckout = () => {
  const handleCheckout = async (planId: string, email: string, companyId: string, interval: 'monthly' | 'annual') => {
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId, email, companyId, interval }),
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
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert(error.message || 'Erro ao iniciar o pagamento. Por favor, tente novamente.');
    }
  };

  return { handleCheckout };
};
