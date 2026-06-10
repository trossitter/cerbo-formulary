/**
 * Payment gateway seam. The PRD allows a stubbed payment step; this
 * interface is where a real processor (Stripe PaymentIntents + webhooks)
 * would plug in. The fake implementation borrows Stripe's test-card
 * convention so the demo can exercise both outcomes:
 *
 *   4242 4242 4242 4242 → succeeds
 *   4000 0000 0000 0002 → declined (generic)
 *   4000 0000 0000 9995 → declined (insufficient funds)
 *   any other 13–19 digit number → succeeds
 */

export interface ChargeRequest {
  amountCents: number;
  cardNumber: string;
}

export type ChargeResult =
  | { ok: true; cardLast4: string }
  | { ok: false; cardLast4: string; declineReason: string };

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

const DECLINE_CARDS: Record<string, string> = {
  "4000000000000002": "card_declined",
  "4000000000009995": "insufficient_funds",
};

export class FakePaymentGateway implements PaymentGateway {
  async charge({ amountCents, cardNumber }: ChargeRequest): Promise<ChargeResult> {
    const digits = cardNumber.replace(/[\s-]/g, "");
    const cardLast4 = digits.slice(-4) || "????";

    if (!/^\d{13,19}$/.test(digits)) {
      return { ok: false, cardLast4, declineReason: "invalid_card_number" };
    }
    if (amountCents <= 0) {
      return { ok: false, cardLast4, declineReason: "invalid_amount" };
    }

    const declineReason = DECLINE_CARDS[digits];
    if (declineReason) {
      return { ok: false, cardLast4, declineReason };
    }
    return { ok: true, cardLast4 };
  }
}

export const gateway: PaymentGateway = new FakePaymentGateway();
