import { ImageResponse } from "next/og";
import { parseImageCrop } from "@/lib/image-crop";

export const runtime = "nodejs";

function normalizeSourceUrl(raw: string | null) {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = normalizeSourceUrl(searchParams.get("src"));
  const crop = parseImageCrop(searchParams.get("crop"));

  if (!source) {
    return new Response("Missing image source.", { status: 400 });
  }

  const scale = crop?.zoom ?? 1;
  const objectPosition = crop ? `${crop.x}% ${crop.y}%` : "center top";

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
            height: "100%",
            objectFit: "cover",
            objectPosition,
            transform: `scale(${scale})`,
            transformOrigin: objectPosition,
            width: "100%"
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630
    }
  );
}
