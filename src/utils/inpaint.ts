const OPENCV_URL = 'https://docs.opencv.org/4.8.0/opencv.js';

type OpenCvMat = {
  delete: () => void;
};

type OpenCvModule = {
  Mat: new (rows: number, cols: number, type: number) => OpenCvMat & { data: Uint8ClampedArray };
  matFromImageData: (imageData: ImageData) => OpenCvMat;
  inpaint: (
    source: OpenCvMat,
    mask: OpenCvMat,
    destination: OpenCvMat,
    radius: number,
    algorithm: number,
  ) => void;
  imshow: (canvas: HTMLCanvasElement, source: OpenCvMat) => void;
  CV_8UC1: number;
  INPAINT_TELEA: number;
  onRuntimeInitialized?: () => void;
};

declare global {
  interface Window {
    cv?: OpenCvModule;
  }
}

let openCvPromise: Promise<OpenCvModule> | null = null;

function getOpenCv(): OpenCvModule | null {
  return window.cv ?? null;
}

function isOpenCvReady(cv: OpenCvModule): boolean {
  return typeof cv.matFromImageData === 'function' && typeof cv.inpaint === 'function';
}

function loadOpenCvScript(): Promise<OpenCvModule> {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${OPENCV_URL}"]`,
    );
    const script = existingScript ?? document.createElement('script');

    const fail = () => reject(new Error('OpenCV.js failed to load.'));
    const waitForRuntime = (cv: OpenCvModule) => {
      if (isOpenCvReady(cv)) {
        resolve(cv);
        return;
      }

      const previousReady = cv.onRuntimeInitialized;
      cv.onRuntimeInitialized = () => {
        previousReady?.();
        resolve(cv);
      };
    };
    const finish = () => {
      const cv = getOpenCv();
      if (!cv) {
        reject(new Error('OpenCV.js loaded without exposing window.cv.'));
        return;
      }

      waitForRuntime(cv);
    };

    const loadingCv = getOpenCv();
    if (loadingCv) {
      waitForRuntime(loadingCv);
      return;
    }

    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', fail, { once: true });

    if (!existingScript) {
      script.async = true;
      script.src = OPENCV_URL;
      document.head.append(script);
    }
  });
}

export async function loadOpenCv(): Promise<OpenCvModule> {
  const cv = getOpenCv();
  if (cv && isOpenCvReady(cv)) {
    return cv;
  }

  openCvPromise ??= loadOpenCvScript();
  return openCvPromise;
}

export type InpaintOptions = {
  radius?: number;
};

export async function inpaintSelectedRegion(
  imageData: ImageData,
  maskData: ImageData,
  options: InpaintOptions = {},
): Promise<ImageData> {
  if (imageData.width !== maskData.width || imageData.height !== maskData.height) {
    throw new Error('Image and mask dimensions must match.');
  }

  const cv = await loadOpenCv();
  const source = cv.matFromImageData(imageData);
  const mask = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC1);
  const destination = cv.matFromImageData(imageData);
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = imageData.width;
  outputCanvas.height = imageData.height;

  try {
    let hasTransparentPixels = false;
    for (let index = 3; index < maskData.data.length; index += 4) {
      if (maskData.data[index] === 0) {
        hasTransparentPixels = true;
        break;
      }
    }

    for (let sourceIndex = 0, maskIndex = 0; sourceIndex < maskData.data.length; sourceIndex += 4, maskIndex += 1) {
      const red = maskData.data[sourceIndex];
      const green = maskData.data[sourceIndex + 1];
      const blue = maskData.data[sourceIndex + 2];
      const alpha = maskData.data[sourceIndex + 3];
      const hasPaint = red > 0 || green > 0 || blue > 0;
      mask.data[maskIndex] = alpha > 0 && (hasPaint || hasTransparentPixels) ? 255 : 0;
    }

    cv.inpaint(source, mask, destination, options.radius ?? 3, cv.INPAINT_TELEA);
    cv.imshow(outputCanvas, destination);

    const context = outputCanvas.getContext('2d');
    if (!context) {
      throw new Error('This browser could not read the inpainted canvas.');
    }

    return context.getImageData(0, 0, imageData.width, imageData.height);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenCV.js inpainting failed.';
    throw new Error(message);
  } finally {
    source.delete();
    mask.delete();
    destination.delete();
  }
}
