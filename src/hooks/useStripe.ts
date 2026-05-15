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

      const contentType = response.headers.get('content-type');
      let session;
      
      if (contentType && contentType.includes('application/json')) {
        session = await response.json();
      } else {
        const text = await response.text();
        console.error('Resposta não-JSON recebida:', text.substring(0, 100));
        throw new Error('O servidor retornou um erro inesperado (não-JSON). Verifique se as rotas de API estão configuradas corretamente.');
      }

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
