"use client";

import { useEffect } from "react";

type LeadThankYouTrackerProps = {
  leadId?: string | null;
};

export function LeadThankYouTracker({ leadId }: LeadThankYouTrackerProps) {
  useEffect(() => {
    if (!leadId) {
      return;
    }

    const payload = JSON.stringify({
      leadId,
      type: "thank_you_view"
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/leads/track", new Blob([payload], { type: "application/json" }));
      return;
    }

    void fetch("/api/leads/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: payload,
      keepalive: true
    });
  }, [leadId]);

  return null;
}
