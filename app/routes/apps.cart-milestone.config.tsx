import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  buildMilestoneConfig,
  recordMilestoneEvent,
} from "../models/milestones.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const shop = session?.shop;

  if (!shop) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await buildMilestoneConfig(shop);
  return json(config);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const shop = session?.shop;

  if (!shop) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const eventType = String(formData.get("eventType") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "") || undefined;

  if (
    !["impression", "tier_reached", "suggestion_click"].includes(eventType)
  ) {
    return json({ error: "Invalid event" }, { status: 400 });
  }

  await recordMilestoneEvent(shop, eventType, ruleId);
  return json({ ok: true });
};
