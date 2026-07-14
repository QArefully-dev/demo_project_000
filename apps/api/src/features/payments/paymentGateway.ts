export type GatewayResult = { status: 'success' } | { status: 'declined' } | { status: 'timeout' };

export interface PaymentGateway {
  process(cardNumber: string): Promise<GatewayResult>;
}

const DECLINE_CARD = '4000000000000002';
const TIMEOUT_CARD = '4000000000000069';

export const simulatedPaymentGateway: PaymentGateway = {
  async process(cardNumber) {
    if (cardNumber === DECLINE_CARD) return { status: 'declined' };
    if (cardNumber === TIMEOUT_CARD) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return { status: 'timeout' };
    }
    return { status: 'success' };
  },
};
