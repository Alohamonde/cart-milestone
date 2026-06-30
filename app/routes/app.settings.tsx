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
  Checkbox,
  ResourceList,
  ResourceItem,
  Thumbnail,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import {
  getOrCreateShopSettings,
  syncConfigToMetafield,
  updateShopSettings,
} from "../models/milestones.server";
import {
  searchCollections,
  type SearchCollection,
} from "../models/products.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getOrCreateShopSettings(session.shop);
  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  if (intent === "search_collections") {
    const query = String(formData.get("query") ?? "");
    const collections = await searchCollections(admin, query);
    return json({ collections });
  }

  if (intent === "save") {
    await updateShopSettings(session.shop, {
      enabled: formData.get("enabled") === "true",
      freeShippingThreshold: Number(formData.get("freeShippingThreshold") ?? 50),
      barBgColor: String(formData.get("barBgColor") ?? "#e5e7eb"),
      barFillColor: String(formData.get("barFillColor") ?? "#16a34a"),
      barTextColor: String(formData.get("barTextColor") ?? "#111827"),
      suggestionCollectionId: String(
        formData.get("suggestionCollectionId") ?? "",
      ),
      suggestionCollectionTitle: String(
        formData.get("suggestionCollectionTitle") ?? "",
      ),
      suggestionCollectionHandle: String(
        formData.get("suggestionCollectionHandle") ?? "",
      ),
    });
    await syncConfigToMetafield(admin, session.shop);
    return json({ ok: true, message: "设置已保存并同步到店面" });
  }

  return json({ ok: false }, { status: 400 });
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const searchFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [enabled, setEnabled] = useState(settings.enabled);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(
    String(settings.freeShippingThreshold),
  );
  const [barBgColor, setBarBgColor] = useState(settings.barBgColor);
  const [barFillColor, setBarFillColor] = useState(settings.barFillColor);
  const [barTextColor, setBarTextColor] = useState(settings.barTextColor);
  const [collectionQuery, setCollectionQuery] = useState("");
  const [selectedCollection, setSelectedCollection] =
    useState<SearchCollection | null>(
      settings.suggestionCollectionId
        ? {
            id: settings.suggestionCollectionId,
            title: settings.suggestionCollectionTitle,
            handle: settings.suggestionCollectionHandle,
            imageUrl: "",
          }
        : null,
    );

  const saveSettings = useCallback(() => {
    const payload = new FormData();
    payload.append("intent", "save");
    payload.append("enabled", String(enabled));
    payload.append("freeShippingThreshold", freeShippingThreshold);
    payload.append("barBgColor", barBgColor);
    payload.append("barFillColor", barFillColor);
    payload.append("barTextColor", barTextColor);
    payload.append(
      "suggestionCollectionId",
      selectedCollection?.id ?? "",
    );
    payload.append(
      "suggestionCollectionTitle",
      selectedCollection?.title ?? "",
    );
    payload.append(
      "suggestionCollectionHandle",
      selectedCollection?.handle ?? "",
    );
    fetcher.submit(payload, { method: "POST" });
  }, [
    barBgColor,
    barFillColor,
    barTextColor,
    enabled,
    fetcher,
    freeShippingThreshold,
    selectedCollection,
  ]);

  const searchCollectionsAction = useCallback(() => {
    const payload = new FormData();
    payload.append("intent", "search_collections");
    payload.append("query", collectionQuery);
    searchFetcher.submit(payload, { method: "POST" });
  }, [collectionQuery, searchFetcher]);

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message);
    }
  }, [fetcher.data, shopify]);

  const collections =
    searchFetcher.data && "collections" in searchFetcher.data
      ? searchFetcher.data.collections
      : [];

  return (
    <Page title="进度条设置" subtitle="免运费门槛、样式与凑单系列">
      <TitleBar title="进度条设置" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                基础设置
              </Text>
              <Checkbox
                label="启用购物车里程碑进度条"
                checked={enabled}
                onChange={setEnabled}
              />
              <FormLayout>
                <TextField
                  label="免运费门槛金额"
                  type="number"
                  value={freeShippingThreshold}
                  onChange={setFreeShippingThreshold}
                  autoComplete="off"
                  prefix="$"
                  helpText="进度条以此金额为 100% 目标"
                />
                <TextField
                  label="进度条背景色"
                  value={barBgColor}
                  onChange={setBarBgColor}
                  autoComplete="off"
                />
                <TextField
                  label="进度条填充色"
                  value={barFillColor}
                  onChange={setBarFillColor}
                  autoComplete="off"
                />
                <TextField
                  label="文字颜色"
                  value={barTextColor}
                  onChange={setBarTextColor}
                  autoComplete="off"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                凑单推荐系列
              </Text>
              <Banner tone="info">
                <p>
                  当顾客距下一阶梯还差少量金额时，前台会展示该系列中的商品帮助凑单。
                </p>
              </Banner>
              {selectedCollection ? (
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span">已选：{selectedCollection.title}</Text>
                  <Button size="slim" onClick={() => setSelectedCollection(null)}>
                    清除
                  </Button>
                </InlineStack>
              ) : null}
              <FormLayout>
                <TextField
                  label="搜索系列"
                  value={collectionQuery}
                  onChange={setCollectionQuery}
                  autoComplete="off"
                  connectedRight={
                    <Button onClick={searchCollectionsAction}>搜索</Button>
                  }
                />
              </FormLayout>
              {collections.length > 0 ? (
                <ResourceList
                  items={collections}
                  renderItem={(collection: SearchCollection) => (
                    <ResourceItem
                      id={collection.id}
                      media={
                        <Thumbnail
                          source={collection.imageUrl || ""}
                          alt={collection.title}
                        />
                      }
                      onClick={() => setSelectedCollection(collection)}
                      accessibilityLabel={collection.title}
                    >
                      <Text as="span">{collection.title}</Text>
                    </ResourceItem>
                  )}
                />
              ) : null}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Button
            variant="primary"
            onClick={saveSettings}
            loading={fetcher.state !== "idle"}
          >
            保存设置
          </Button>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
