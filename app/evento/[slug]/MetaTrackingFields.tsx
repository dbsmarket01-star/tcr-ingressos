"use client";

import { useEffect, useState } from "react";

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return "";
  }

  const pattern = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return pattern ? decodeURIComponent(pattern[1]) : "";
}

function buildFbcFromUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get("fbclid")?.trim();

  if (!fbclid) {
    return "";
  }

  return `fb.1.${Date.now()}.${fbclid}`;
}

export function MetaTrackingFields() {
  const [fbp, setFbp] = useState("");
  const [fbc, setFbc] = useState("");

  useEffect(() => {
    const cookieFbp = readCookie("_fbp");
    const cookieFbc = readCookie("_fbc");

    setFbp(cookieFbp);
    setFbc(cookieFbc || buildFbcFromUrl());
  }, []);

  return (
    <>
      <input type="hidden" name="metaFbp" value={fbp} readOnly />
      <input type="hidden" name="metaFbc" value={fbc} readOnly />
    </>
  );
}
