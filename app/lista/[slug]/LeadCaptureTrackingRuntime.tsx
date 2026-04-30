"use client";

import { useEffect, useRef } from "react";
import type { TrackingParams } from "@/features/tracking/tracking";

type LeadCaptureTrackingRuntimeProps = {
  eventTitle: string;
  eventSlug: string;
  metaPixelId?: string | null;
  googleTagManagerId?: string | null;
  tracking: TrackingParams;
  mode: "view" | "lead";
  leadEventId?: string | null;
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export function LeadCaptureTrackingRuntime({
  eventTitle,
  eventSlug,
  metaPixelId,
  googleTagManagerId,
  tracking,
  mode,
  leadEventId
}: LeadCaptureTrackingRuntimeProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) {
      return;
    }

    const payload = {
      event_name: eventTitle,
      event_slug: eventSlug,
      funnel: "lead_capture",
      utm_source: tracking.utmSource,
      utm_medium: tracking.utmMedium,
      utm_campaign: tracking.utmCampaign,
      utm_content: tracking.utmContent,
      utm_term: tracking.utmTerm
    };

    if (googleTagManagerId) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: mode === "lead" ? "lead_capture_complete" : "view_lead_capture",
        ...payload
      });
    }

    if (!metaPixelId) {
      firedRef.current = true;
      return;
    }

    let attempts = 0;
    const maxAttempts = 40;

    const firePixelEvent = () => {
      if (typeof window.fbq !== "function") {
        attempts += 1;

        if (attempts < maxAttempts) {
          window.setTimeout(firePixelEvent, 120);
        }

        return;
      }

      firedRef.current = true;

      if (mode === "lead") {
        window.fbq(
          "track",
          "Lead",
          {
            content_name: eventTitle,
            content_category: "lead_capture",
            ...payload
          },
          leadEventId ? { eventID: leadEventId } : undefined
        );
      } else {
        window.fbq("track", "ViewContent", {
          content_name: eventTitle,
          content_category: "lead_capture",
          ...payload
        });
      }
    };

    firePixelEvent();
  }, [eventSlug, eventTitle, googleTagManagerId, leadEventId, metaPixelId, mode, tracking]);

  return null;
}
