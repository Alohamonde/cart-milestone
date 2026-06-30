import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Button,
  Badge,
  InlineGrid,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getMilestoneRules,
  getMilestoneStats,
} from "../models/milestones.server";
import {
  ensureMilestoneDiscount,
  getMilestoneDiscountStatus,
} from "../models/milestone-discount.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const [stats, rules, discountBefore] = await Promise.all([
    getMilestoneStats(shop),
    getMilestoneRules(shop),
    getMilestoneDiscountStatus(admin),
  ]);

  const discountResult = await ensureMilestoneDiscount(admin);
  const discount = discountResult.ok
    ? {
        ...discountResult,
        status: discountResult.status ?? discountBefore.status,
      }
    : { ...discountResult, status: discountBefore.status };

  return json({
    stats,
    totalRules: rules.length,
    discount,
  });
};

export default function Index() {
  const { stats, totalRules, discount } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Cart Milestone"
      subtitle="购物车里程碑：免运费进度条 + 阶梯奖励 + 凑单推荐"
    >
      <TitleBar title="Cart Milestone" />
      <BlockStack gap="500">
        {!discount.ok ? (
          <Banner tone="critical">
            <p>
              自动折扣创建失败：
              {discount.errors?.[0]?.message || "请刷新页面重试"}
            </p>
          </Banner>
        ) : discount.created || discount.repaired ? (
          <Banner tone="success">
            <p>
              已{discount.created ? "创建" : "修复"}自动折扣「Cart Milestone
              Reward」（{discount.status}）。
            </p>
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    活跃阶梯
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.ruleCount}
                  </Text>
                  <Text as="p" tone="subdued">
                    共 {totalRules} 条规则
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    进度条曝光
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.impressions}
                  </Text>
                  <Text as="p" tone="subdued">
                    购物车 / 抽屉展示
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    达标率
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.reachRate}%
                  </Text>
                  <Text as="p" tone="subdued">
                    达标 {stats.tierReached} 次
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    凑单点击
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.suggestionClicks}
                  </Text>
                  <Text as="p" tone="subdued">
                    免运费门槛 ${stats.freeShippingThreshold}
                  </Text>
                </BlockStack>
              </Card>
            </InlineGrid>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  模块概览
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      免运费进度条
                    </Text>
                    <Badge tone="success">Theme App Extension</Badge>
                    <Text as="p">
                      在购物车页 / 抽屉实时展示距免运费的进度，兼容 Dawn 等主流主题。
                    </Text>
                  </BlockStack>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      阶梯订单折扣
                    </Text>
                    <Badge tone="info">Shopify Function</Badge>
                    <Text as="p">
                      购物车小计达到阶梯门槛时，自动应用最高档订单百分比折扣。
                    </Text>
                  </BlockStack>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">
                      智能凑单
                    </Text>
                    <Badge>App Proxy + Analytics</Badge>
                    <Text as="p">
                      距下一档还差少量金额时，推荐系列商品帮助顾客快速凑单。
                    </Text>
                  </BlockStack>
                </InlineGrid>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  <Button url="/app/milestones" variant="primary">
                    管理阶梯规则
                  </Button>
                  <Button url="/app/settings">进度条与凑单设置</Button>
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
