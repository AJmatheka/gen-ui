export type ImageDimensions = {
  width: number;
  height: number;
};

export type CanvasReadyImage = {
  file: File;
  dataUrl: string;
  imageData: ImageData;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  scale: number;
};

export const MAX_UPLOAD_DIMENSION = 1024;

export function getContainSize(source: ImageDimensions, frame: ImageDimensions): ImageDimensions {
  const scale = Math.min(frame.width / source.width, frame.height / source.height);

  return {
    width: Math.round(source.width * scale),
    height: Math.round(source.height * scale),
  };
}

export function isSupportedImageFile(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

export async function loadCanvasReadyImage(
  file: File,
  maxDimension = MAX_UPLOAD_DIMENSION,
): Promise<CanvasReadyImage> {
  if (!isSupportedImageFile(file)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }

  const bitmap = await createImageBitmap(file);
  const naturalWidth = bitmap.width;
  const naturalHeight = bitmap.height;
  const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('This browser could not prepare the image canvas.');
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return {
    file,
    dataUrl: canvas.toDataURL(file.type || 'image/png'),
    imageData: context.getImageData(0, 0, width, height),
    width,
    height,
    naturalWidth,
    naturalHeight,
    scale,
  };
}
