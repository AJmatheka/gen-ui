import { toPng } from 'html-to-image';
import JSZip from 'jszip';

export type ExportAsset = {
  name: string;
  data: Blob | string;
};

export async function renderElementToPng(element: HTMLElement): Promise<string> {
  return toPng(element, {
    cacheBust: true,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.download = filename;
  link.href = url;
  link.click();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');

  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export async function packageAssets(files: ExportAsset[]): Promise<Blob> {
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.name, file.data);
  });

  return zip.generateAsync({ type: 'blob' });
}
