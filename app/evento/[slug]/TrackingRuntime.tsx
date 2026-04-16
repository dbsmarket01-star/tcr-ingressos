"use client";

import { useEffect, useRef } from "react";
import type { TrackingParams } from "@/features/tracking/tracking";

type TrackingRuntimeProps = {
  eventTitle: string;
  eventSlug: string;
  metaPixelId?: string | null;
  googleTagManagerId?: string | null;
  tracking: TrackingParams;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export function TrackingRuntime({
  eventTitle,
  eventSlug,
  metaPixelId,
  googleTagManagerId,
  tracking
}: TrackingRuntimeProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) {
      return;
    }

    firedRef.current = true;
    const payload = {
      event_name: eventTitle,
      event_slug: eventSlug,
      utm_source: tracking.utmSource,
      utm_medium: tracking.utmMedium,
      utm_campaign: tracking.utmCampaign,
      utm_content: tracking.utmContent,
      utm_term: tracking.utmTerm
    };

    if (googleTagManagerId) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "view_event",
        ...payload
      });
    }

    if (metaPixelId && window.fbq) {
      window.fbq("track", "ViewContent", {
        content_name: eventTitle,
        content_category: "event",
        ...payload
      });
    }
  }, [eventSlug, eventTitle, googleTagManagerId, metaPixelId, tracking]);

  return null;
}
