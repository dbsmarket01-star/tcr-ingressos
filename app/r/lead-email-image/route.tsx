import { ImageResponse } from "next/og";
import { parseImageCrop } from "@/lib/image-crop";

export const runtime = "nodejs";
const OUTPUT_WIDTH = 960;
const OUTPUT_HEIGHT = 504;
const DEFAULT_ACCENT_COLOR = "#1f5fbf";

function normalizeSourceUrl(raw: string | null) {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function parsePositiveNumber(raw: string | null) {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeHexColor(raw: string | null) {
  const value = raw?.trim();

  if (!value) {
    return DEFAULT_ACCENT_COLOR;
  }

  const normalized = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : DEFAULT_ACCENT_COLOR;
}

function shiftHexColor(hex: string, offset: number) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16);
    return Math.max(0, Math.min(255, channel + offset)).toString(16).padStart(2, "0");
  });

  return `#${channels.join("")}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = normalizeSourceUrl(searchParams.get("src"));
  const crop = parseImageCrop(searchParams.get("crop"));
  const sourceWidth = parsePositiveNumber(searchParams.get("w"));
  const sourceHeight = parsePositiveNumber(searchParams.get("h"));
  const accentColor = normalizeHexColor(searchParams.get("accent"));
  const backgroundStart = shiftHexColor(accentColor, -95);
  const backgroundEnd = shiftHexColor(accentColor, -55);

  if (!source) {
    return new Response("Missing image source.", { status: 400 });
  }

  const zoom = crop?.zoom ?? 1;
  const baseScale =
    sourceWidth && sourceHeight
      ? Math.min(1, Math.min(OUTPUT_WIDTH / sourceWidth, OUTPUT_HEIGHT / sourceHeight))
      : 1;
  const fittedWidth = sourceWidth ? sourceWidth * baseScale * zoom : OUTPUT_WIDTH * zoom;
  const fittedHeight = sourceHeight ? sourceHeight * baseScale * zoom : OUTPUT_HEIGHT * zoom;
  const horizontal = crop ? crop.x / 100 : 0.5;
  const vertical = crop ? crop.y / 100 : 0.5;
  const left = (OUTPUT_WIDTH - fittedWidth) * horizontal;
  const top = (OUTPUT_HEIGHT - fittedHeight) * vertical;

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: `linear-gradient(180deg, ${backgroundStart} 0%, ${backgroundEnd} 100%)`,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
          width: "100%"
        }}
      >
        <img
          alt=""
          src={source}
          style={{
            height: fittedHeight,
            left,
            objectFit: "fill",
            position: "absolute",
            top,
            width: fittedWidth
          }}
        />
      </div>
    ),
    {
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "CDN-Cache-Control": "public, max-age=31536000, immutable",
        "Vercel-CDN-Cache-Control": "public, max-age=31536000, immutable"
      }
    }
  );
}
