import {
  DiscountClass,
  OrderDiscountSelectionStrategy,
} from "../generated/api";

function resolveBestTier(config, subtotal) {
  if (!config || !Array.isArray(config.tiers)) return null;

  const eligible = config.tiers
    .filter((tier) => tier.enabled !== false)
    .filter((tier) => tier.rewardType === "order_discount")
    .filter((tier) => subtotal >= Number(tier.thresholdAmount || 0))
    .sort(
      (a, b) => Number(b.thresholdAmount || 0) - Number(a.thresholdAmount || 0),
    );

  return eligible[0] ?? null;
}

export function cartLinesDiscountsGenerateRun(input) {
  if (!input.discount.discountClasses.includes(DiscountClass.Order)) {
    return { operations: [] };
  }

  const config = input.shop?.metafield?.jsonValue ?? null;
  if (config && config.enabled === false) {
    return { operations: [] };
  }

  const subtotal = Number(input.cart?.cost?.subtotalAmount?.amount ?? 0);
  const tier = resolveBestTier(config, subtotal);
  const percent = Number(tier?.discountPercent ?? 0);

  if (!tier || percent <= 0) {
    return { operations: [] };
  }

  const message =
    tier.rewardLabel || `Cart Milestone ${percent}% OFF`;

  return {
    operations: [
      {
        orderDiscountsAdd: {
          candidates: [
            {
              message,
              targets: [{ orderSubtotal: { excludedCartLineIds: [] } }],
              value: {
                percentage: {
                  value: Math.min(100, Math.max(0, percent)),
                },
              },
            },
          ],
          selectionStrategy: OrderDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}
