import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  Text,
  Banner,
  ResourceList,
  ResourceItem,
  InlineStack,
  Select,
  Badge,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import {
  createMilestoneRule,
  deleteMilestoneRule,
  getMilestoneRules,
  syncConfigToMetafield,
  toggleMilestoneRule,
  type RewardType,
} from "../models/milestones.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const rules = await getMilestoneRules(session.shop);
  return json({ rules });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  if (intent === "create") {
    await createMilestoneRule(session.shop, {
      thresholdAmount: Number(formData.get("thresholdAmount") ?? 0),
      rewardType: String(formData.get("rewardType")) as RewardType,
      rewardLabel: String(formData.get("rewardLabel") ?? "满额享折扣"),
      discountPercent: Number(formData.get("discountPercent") ?? 5),
    });
    await syncConfigToMetafield(admin, session.shop);
    return json({ ok: true, message: "阶梯规则已创建" });
  }

  if (intent === "delete") {
    await deleteMilestoneRule(session.shop, String(formData.get("id")));
    await syncConfigToMetafield(admin, session.shop);
    return json({ ok: true, message: "规则已删除" });
  }

  if (intent === "toggle") {
    await toggleMilestoneRule(
      session.shop,
      String(formData.get("id")),
      formData.get("enabled") === "true",
    );
    await syncConfigToMetafield(admin, session.shop);
    return json({ ok: true, message: "规则状态已更新" });
  }

  return json({ ok: false }, { status: 400 });
};

const rewardOptions = [
  { label: "订单百分比折扣", value: "order_discount" },
  { label: "仅展示文案（无折扣）", value: "message" },
];

function rewardBadge(type: string) {
  if (type === "message") return <Badge>文案</Badge>;
  return <Badge tone="success">订单折扣</Badge>;
}

export default function MilestonesPage() {
  const { rules } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [thresholdAmount, setThresholdAmount] = useState("80");
  const [rewardType, setRewardType] = useState<RewardType>("order_discount");
  const [rewardLabel, setRewardLabel] = useState("满 $80 享 5% 折扣");
  const [discountPercent, setDiscountPercent] = useState("5");

  const createRule = useCallback(() => {
    const payload = new FormData();
    payload.append("intent", "create");
    payload.append("thresholdAmount", thresholdAmount);
    payload.append("rewardType", rewardType);
    payload.append("rewardLabel", rewardLabel);
    payload.append("discountPercent", discountPercent);
    fetcher.submit(payload, { method: "POST" });
  }, [
    discountPercent,
    fetcher,
    rewardLabel,
    rewardType,
    thresholdAmount,
  ]);

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message);
    }
  }, [fetcher.data, shopify]);

  return (
    <Page title="阶梯规则" subtitle="配置购物车金额里程碑与奖励">
      <TitleBar title="阶梯规则" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                新建阶梯
              </Text>
              <FormLayout>
                <TextField
                  label="门槛金额（购物车小计）"
                  type="number"
                  value={thresholdAmount}
                  onChange={setThresholdAmount}
                  autoComplete="off"
                  prefix="$"
                />
                <Select
                  label="奖励类型"
                  options={rewardOptions}
                  value={rewardType}
                  onChange={(value) => setRewardType(value as RewardType)}
                />
                <TextField
                  label="前台展示文案"
                  value={rewardLabel}
                  onChange={setRewardLabel}
                  autoComplete="off"
                />
                {rewardType === "order_discount" ? (
                  <TextField
                    label="订单折扣百分比"
                    type="number"
                    value={discountPercent}
                    onChange={setDiscountPercent}
                    autoComplete="off"
                    suffix="%"
                  />
                ) : null}
                <Button
                  variant="primary"
                  onClick={createRule}
                  loading={fetcher.state !== "idle"}
                >
                  添加阶梯
                </Button>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                已配置阶梯
              </Text>
              {rules.length === 0 ? (
                <Banner tone="info">
                  <p>尚未配置阶梯。建议从 $50 免运费提示 + $80 享 5% 折扣开始。</p>
                </Banner>
              ) : (
                <ResourceList
                  items={rules}
                  renderItem={(rule) => (
                    <ResourceItem
                      id={rule.id}
                      onClick={() => {}}
                      accessibilityLabel={rule.rewardLabel}
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <InlineStack gap="200">
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              ${rule.thresholdAmount} — {rule.rewardLabel}
                            </Text>
                            {rewardBadge(rule.rewardType)}
                            {!rule.enabled ? (
                              <Badge tone="critical">已停用</Badge>
                            ) : null}
                          </InlineStack>
                          {rule.rewardType === "order_discount" ? (
                            <Text as="p" tone="subdued">
                              订单折扣 {rule.discountPercent}%
                            </Text>
                          ) : null}
                        </BlockStack>
                        <InlineStack gap="200">
                          <Button
                            size="slim"
                            onClick={() => {
                              const payload = new FormData();
                              payload.append("intent", "toggle");
                              payload.append("id", rule.id);
                              payload.append(
                                "enabled",
                                String(!rule.enabled),
                              );
                              fetcher.submit(payload, { method: "POST" });
                            }}
                          >
                            {rule.enabled ? "停用" : "启用"}
                          </Button>
                          <Button
                            size="slim"
                            tone="critical"
                            onClick={() => {
                              const payload = new FormData();
                              payload.append("intent", "delete");
                              payload.append("id", rule.id);
                              fetcher.submit(payload, { method: "POST" });
                            }}
                          >
                            删除
                          </Button>
                        </InlineStack>
                      </InlineStack>
                    </ResourceItem>
                  )}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
