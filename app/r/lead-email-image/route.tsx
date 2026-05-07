import { ImageResponse } from "next/og";
import { parseImageCrop } from "@/lib/image-crop";

export const runtime = "nodejs";
const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 630;

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = normalizeSourceUrl(searchParams.get("src"));
  const crop = parseImageCrop(searchParams.get("crop"));
  const sourceWidth = parsePositiveNumber(searchParams.get("w"));
  const sourceHeight = parsePositiveNumber(searchParams.get("h"));

  if (!source) {
    return new Response("Missing image source.", { status: 400 });
  }

  const zoom = crop?.zoom ?? 1;
  const baseScale =
    sourceWidth && sourceHeight
      ? Math.min(OUTPUT_WIDTH / sourceWidth, OUTPUT_HEIGHT / sourceHeight)
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
          background: "#e8eef5",
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
      height: OUTPUT_HEIGHT
    }
  );
}
