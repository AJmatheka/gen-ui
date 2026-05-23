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

export async function packageAssets(files: ExportAsset[]): Promise<Blob> {
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.name, file.data);
  });

  return zip.generateAsync({ type: 'blob' });
}
