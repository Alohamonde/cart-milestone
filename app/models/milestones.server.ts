import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";

export type RewardType = "order_discount" | "message";

export type MilestoneRuleInput = {
  enabled?: boolean;
  thresholdAmount: number;
  rewardType: RewardType;
  rewardLabel?: string;
  discountPercent?: number;
  sortOrder?: number;
};

export type MilestoneConfig = {
  enabled: boolean;
  freeShippingThreshold: number;
  barBgColor: string;
  barFillColor: string;
  barTextColor: string;
  suggestionCollectionId: string;
  suggestionCollectionTitle: string;
  suggestionCollectionHandle: string;
  tiers: Array<{
    id: string;
    enabled: boolean;
    thresholdAmount: number;
    rewardType: RewardType;
    rewardLabel: string;
    discountPercent: number;
    sortOrder: number;
  }>;
};

const METAFIELD_NAMESPACE = "$app:cart_milestone";
const METAFIELD_KEY = "config";

export async function getOrCreateShopSettings(shop: string) {
  return prisma.shopSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });
}

export async function updateShopSettings(
  shop: string,
  data: Partial<{
    enabled: boolean;
    freeShippingThreshold: number;
    barBgColor: string;
    barFillColor: string;
    barTextColor: string;
    suggestionCollectionId: string;
    suggestionCollectionTitle: string;
    suggestionCollectionHandle: string;
  }>,
) {
  await getOrCreateShopSettings(shop);
  return prisma.shopSettings.update({
    where: { shop },
    data,
  });
}

export async function getMilestoneRules(shop: string) {
  return prisma.milestoneRule.findMany({
    where: { shop },
    orderBy: [{ sortOrder: "asc" }, { thresholdAmount: "asc" }],
  });
}

export async function createMilestoneRule(shop: string, data: MilestoneRuleInput) {
  const count = await prisma.milestoneRule.count({ where: { shop } });
  return prisma.milestoneRule.create({
    data: {
      shop,
      enabled: data.enabled ?? true,
      thresholdAmount: data.thresholdAmount,
      rewardType: data.rewardType,
      rewardLabel: data.rewardLabel ?? "满额享折扣",
      discountPercent: data.discountPercent ?? 5,
      sortOrder: data.sortOrder ?? count,
    },
  });
}

export async function deleteMilestoneRule(shop: string, id: string) {
  return prisma.milestoneRule.deleteMany({
    where: { id, shop },
  });
}

export async function toggleMilestoneRule(
  shop: string,
  id: string,
  enabled: boolean,
) {
  return prisma.milestoneRule.updateMany({
    where: { id, shop },
    data: { enabled },
  });
}

export async function recordMilestoneEvent(
  shop: string,
  eventType: string,
  ruleId?: string,
) {
  return prisma.milestoneEvent.create({
    data: { shop, eventType, ruleId },
  });
}

export async function getMilestoneStats(shop: string) {
  const [impressions, tierReached, suggestionClicks, ruleCount, settings] =
    await Promise.all([
      prisma.milestoneEvent.count({
        where: { shop, eventType: "impression" },
      }),
      prisma.milestoneEvent.count({
        where: { shop, eventType: "tier_reached" },
      }),
      prisma.milestoneEvent.count({
        where: { shop, eventType: "suggestion_click" },
      }),
      prisma.milestoneRule.count({ where: { shop, enabled: true } }),
      getOrCreateShopSettings(shop),
    ]);

  const reachRate =
    impressions > 0
      ? ((tierReached / impressions) * 100).toFixed(1)
      : "0.0";

  return {
    impressions,
    tierReached,
    suggestionClicks,
    ruleCount,
    reachRate,
    freeShippingThreshold: settings.freeShippingThreshold,
  };
}

export async function buildMilestoneConfig(shop: string): Promise<MilestoneConfig> {
  const [settings, rules] = await Promise.all([
    getOrCreateShopSettings(shop),
    getMilestoneRules(shop),
  ]);

  return {
    enabled: settings.enabled && rules.some((rule) => rule.enabled),
    freeShippingThreshold: settings.freeShippingThreshold,
    barBgColor: settings.barBgColor,
    barFillColor: settings.barFillColor,
    barTextColor: settings.barTextColor,
    suggestionCollectionId: settings.suggestionCollectionId,
    suggestionCollectionTitle: settings.suggestionCollectionTitle,
    suggestionCollectionHandle: settings.suggestionCollectionHandle,
    tiers: rules.map((rule) => ({
      id: rule.id,
      enabled: rule.enabled,
      thresholdAmount: rule.thresholdAmount,
      rewardType: rule.rewardType as RewardType,
      rewardLabel: rule.rewardLabel,
      discountPercent: rule.discountPercent,
      sortOrder: rule.sortOrder,
    })),
  };
}

export async function syncConfigToMetafield(
  admin: AdminApiContext,
  shop: string,
) {
  const config = await buildMilestoneConfig(shop);

  const shopResponse = await admin.graphql(
    `#graphql
      query CartMilestoneShopId {
        shop {
          id
        }
      }
    `,
  );
  const shopJson = await shopResponse.json();
  const shopId = shopJson.data?.shop?.id;

  if (!shopId) {
    throw new Error("Unable to resolve shop id for metafield sync");
  }

  const response = await admin.graphql(
    `#graphql
      mutation CartMilestoneSyncConfig($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
            type: "json",
            value: JSON.stringify(config),
          },
        ],
      },
    },
  );

  const json = await response.json();
  const userErrors = json.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length) {
    throw new Error(userErrors.map((e: { message: string }) => e.message).join(", "));
  }

  return config;
}

export async function purgeShopData(shop: string) {
  await Promise.all([
    prisma.milestoneEvent.deleteMany({ where: { shop } }),
    prisma.milestoneRule.deleteMany({ where: { shop } }),
    prisma.shopSettings.deleteMany({ where: { shop } }),
  ]);
}
