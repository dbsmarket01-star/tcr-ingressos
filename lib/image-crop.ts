export type ImageCrop = {
  x: number;
  y: number;
  zoom: number;
};

const DEFAULT_IMAGE_CROP: ImageCrop = {
  x: 50,
  y: 50,
  zoom: 1
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function sanitizeImageCrop(input?: Partial<ImageCrop> | null): ImageCrop {
  return {
    x: clamp(Number(input?.x ?? DEFAULT_IMAGE_CROP.x), 0, 100),
    y: clamp(Number(input?.y ?? DEFAULT_IMAGE_CROP.y), 0, 100),
    zoom: clamp(Number(input?.zoom ?? DEFAULT_IMAGE_CROP.zoom), 1, 2.5)
  };
}

export function parseImageCrop(raw?: string | null): ImageCrop | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ImageCrop>;
    return sanitizeImageCrop(parsed);
  } catch {
    return null;
  }
}

export function stringifyImageCrop(crop?: Partial<ImageCrop> | null) {
  return JSON.stringify(sanitizeImageCrop(crop));
}

export function imageCropStyle(crop?: ImageCrop | null) {
  if (!crop) {
    return undefined;
  }

  return {
    objectPosition: `${crop.x}% ${crop.y}%`,
    transform: `scale(${crop.zoom})`,
    transformOrigin: `${crop.x}% ${crop.y}%`
  };
}

export function imageCropFromBannerPosition(position?: string | null): ImageCrop | null {
  if (!position) {
    return null;
  }

  const value = position.trim().toLowerCase();
  const base = { ...DEFAULT_IMAGE_CROP };

  if (value.includes("left")) {
    base.x = 22;
  } else if (value.includes("right")) {
    base.x = 78;
  }

  if (value.includes("top") || value.includes("18%")) {
    base.y = 24;
  } else if (value.includes("28%")) {
    base.y = 32;
  } else if (value.includes("bottom")) {
    base.y = 76;
  }

  return base;
}
