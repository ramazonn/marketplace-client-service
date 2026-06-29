import { Repository } from '@ubaytools/core';

export interface FindDeliveryRuleByAmountResult {
  deliveryPrice: number | null;
  ruleId: string | null;
  note: string | null;
}

/**
 * Finds the first matching delivery rule by total amount (sorted by priority ascending).
 * Returns deliveryPrice, ruleId, and note; or nulls if no rule matches.
 */
export class FindDeliveryRuleByAmountUseCase {
  static async execute(totalAmount: number): Promise<FindDeliveryRuleByAmountResult> {
    const rules = await Repository.DeliveryRules().list(
      {},
      { isActive: true },
      { priority: 1 }
    );

    const matchedRule = rules.find((rule) => {
      const minAmount = rule.getMinAmount() ?? 0;
      const maxAmount = rule.getMaxAmount();
      const meetsMin = totalAmount >= minAmount;
      const meetsMax = maxAmount === null || maxAmount === undefined || totalAmount <= maxAmount;
      return meetsMin && meetsMax;
    });

    if (!matchedRule) {
      return { deliveryPrice: null, ruleId: null, note: null };
    }

    return {
      deliveryPrice: matchedRule.getDeliveryPrice() ?? null,
      ruleId: matchedRule.getId()?.toString() ?? null,
      note: matchedRule.getNote() ?? null,
    };
  }
}
