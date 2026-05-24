import { AutoProcessor, RawImage, SamModel } from "@huggingface/transformers";

const DEFAULT_MODEL = "Xenova/sam-vit-base";

export type SamClickPrompt = {
  x: number;
  y: number;
  label?: 0 | 1;
};

export type SamWorkerImageData = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type SamWorkerRequest =
  | {
      type: "load";
      id?: string;
      model?: string;
    }
  | {
      type: "segment";
      id?: string;
      model?: string;
      imageData: SamWorkerImageData;
      clicks: SamClickPrompt[];
    };

export type SamWorkerResponse =
  | {
      type: "status";
      id?: string;
      message: string;
    }
  | {
      type: "ready";
      id?: string;
      model: string;
    }
  | {
      type: "mask";
      id?: string;
      mask: Uint8Array;
      width: number;
      height: number;
      score: number | null;
    }
  | {
      type: "error";
      id?: string;
      message: string;
    };

type SamRuntime = {
  modelId: string;
  model: Awaited<ReturnType<typeof SamModel.from_pretrained>>;
  processor: SamProcessorRuntime;
};

type SamProcessorInputs = {
  original_sizes: [number, number][];
  reshaped_input_sizes: [number, number][];
  pred_masks?: unknown;
};

type TensorLike = {
  data: ArrayLike<number>;
};

type SamProcessorRuntime = Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> & {
  (
    image: RawImage,
    options: {
      input_points: [number, number][][];
      input_labels: number[][];
    },
  ): Promise<SamProcessorInputs>;
  post_process_masks(
    masks: unknown,
    originalSizes: [number, number][],
    reshapedInputSizes: [number, number][],
  ): Promise<TensorLike[]>;
};

let runtimePromise: Promise<SamRuntime> | null = null;
let activeModelId: string | null = null;

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<SamWorkerRequest>) => void) | null;
  postMessage(message: SamWorkerResponse, transfer?: Transferable[]): void;
};

function postStatus(message: string, id?: string): void {
  workerScope.postMessage({
    type: "status",
    id,
    message,
  } satisfies SamWorkerResponse);
}

async function loadRuntime(modelId = DEFAULT_MODEL): Promise<SamRuntime> {
  if (!runtimePromise) {
    activeModelId = modelId;
    const progress_callback = (progress: { status?: string; file?: string; progress?: number }) => {
      if (progress.status === "progress" && typeof progress.progress === "number") {
        postStatus(`Loading SAM model ${Math.round(progress.progress)}%`);
        return;
      }

      if (progress.status === "ready") {
        postStatus("Preparing SAM model...");
        return;
      }

      if (progress.file) {
        postStatus(`Loading ${progress.file}`);
      }
    };

    runtimePromise = Promise.all([
      SamModel.from_pretrained(modelId, {
        device: "wasm",
        dtype: "q8",
        progress_callback,
      }),
      AutoProcessor.from_pretrained(modelId, {
        progress_callback,
      }),
    ]).then(([model, processor]) => ({
      modelId,
      model,
      processor: processor as SamProcessorRuntime,
    }));
  }

  const runtime = await runtimePromise;
  if (runtime.modelId !== modelId) {
    throw new Error(`SAM worker already loaded "${runtime.modelId}"`);
  }

  return runtime;
}

function toPixelPoint(click: SamClickPrompt, width: number, height: number): [number, number] {
  const x = clamp(click.x, 0, 1) * width;
  const y = clamp(click.y, 0, 1) * height;
  return [x, y];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildMask(data: ArrayLike<number>, offset: number, length: number): Uint8Array {
  const mask = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    mask[index] = data[offset + index] ? 255 : 0;
  }
  return mask;
}

async function segmentImage(
  runtime: SamRuntime,
  imageData: SamWorkerImageData,
  clicks: SamClickPrompt[],
): Promise<Omit<Extract<SamWorkerResponse, { type: "mask" }>, "type" | "id">> {
  if (!clicks.length) {
    throw new Error("At least one click prompt is required.");
  }

  const image = new RawImage(imageData.data, imageData.width, imageData.height, 4);
  const inputPoints = [clicks.map((click) => toPixelPoint(click, imageData.width, imageData.height))];
  const inputLabels = [clicks.map((click) => click.label ?? 1)];
  const inputs = await runtime.processor(image, {
    input_points: inputPoints,
    input_labels: inputLabels,
  });
  const outputs = await runtime.model(inputs);
  const masks = await runtime.processor.post_process_masks(
    outputs.pred_masks,
    inputs.original_sizes,
    inputs.reshaped_input_sizes,
  );
  const maskTensor = masks[0];
  const pixelCount = imageData.width * imageData.height;
  const scores = Array.from(outputs.iou_scores.data as ArrayLike<number>);
  const bestMaskIndex = scores.reduce(
    (bestIndex, score, index) => (score > scores[bestIndex] ? index : bestIndex),
    0,
  );
  const mask = buildMask(maskTensor.data as ArrayLike<number>, bestMaskIndex * pixelCount, pixelCount);

  return {
    mask,
    width: imageData.width,
    height: imageData.height,
    score: scores[bestMaskIndex] ?? null,
  };
}

workerScope.onmessage = async (event: MessageEvent<SamWorkerRequest>) => {
  const { data } = event;

  try {
    if (data.type === "load" && activeModelId !== data.model) {
      postStatus("Loading SAM model...", data.id);
    }

    const runtime = await loadRuntime(data.model);

    if (data.type === "load") {
      workerScope.postMessage({
        type: "ready",
        id: data.id,
        model: runtime.modelId,
      } satisfies SamWorkerResponse);
      return;
    }

    postStatus("Encoding image for SAM...", data.id);
    const response = await segmentImage(runtime, data.imageData, data.clicks);
    workerScope.postMessage(
      {
        type: "mask",
        id: data.id,
        ...response,
      } satisfies SamWorkerResponse,
      [response.mask.buffer],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run SAM inference";
    workerScope.postMessage({
      type: "error",
      id: data.id,
      message,
    } satisfies SamWorkerResponse);
  }
};

self.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : "SAM worker promise failed";
  workerScope.postMessage({
    type: "error",
    message,
  } satisfies SamWorkerResponse);
});

self.addEventListener("error", (event) => {
  workerScope.postMessage({
    type: "error",
    message: event.message || "SAM worker failed",
  } satisfies SamWorkerResponse);
});
