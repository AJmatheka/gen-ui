import { create } from 'zustand';

export type EditorMode = 'edit' | 'preview';

export type SelectionPoint = {
  id: string;
  x: number;
  y: number;
  type: 'positive' | 'negative';
};

export type MaskPayload = {
  id: string;
  width: number;
  height: number;
  data: Uint8Array | ImageData;
};

export type BackgroundLayer = {
  id: 'background';
  name: string;
  image: HTMLImageElement | ImageBitmap | ImageData | null;
  width: number;
  height: number;
  mask: MaskPayload | null;
  visible: true;
};

export type ObjectLayer = {
  id: string;
  name: string;
  image: HTMLImageElement | ImageBitmap | ImageData | null;
  width: number;
  height: number;
  mask: MaskPayload | null;
  depth: number;
  visible: boolean;
  order: number;
};

export type ActiveSelection = {
  points: SelectionPoint[];
  mask: MaskPayload | null;
  isBusy: boolean;
  error: string | null;
};

export type AddLayerInput = {
  id?: string;
  name?: string;
  image: ObjectLayer['image'];
  width: number;
  height: number;
  mask?: MaskPayload | null;
  depth?: number;
  visible?: boolean;
};

export type LayerStoreState = {
  mode: EditorMode;
  background: BackgroundLayer;
  layers: ObjectLayer[];
  activeLayerId: string | null;
  selection: ActiveSelection;
};

export type LayerStoreActions = {
  setMode: (mode: EditorMode) => void;
  toggleMode: () => void;
  setBackground: (image: BackgroundLayer['image'], width: number, height: number) => void;
  clearProject: () => void;
  addLayer: (input: AddLayerInput) => string;
  renameLayer: (layerId: string, name: string) => void;
  deleteLayer: (layerId: string) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  toggleLayerVisibility: (layerId: string) => void;
  reorderLayer: (layerId: string, toIndex: number) => void;
  setLayerDepth: (layerId: string, depth: number) => void;
  setLayerMask: (layerId: string, mask: MaskPayload | null) => void;
  setActiveLayer: (layerId: string | null) => void;
  setSelectionPoints: (points: SelectionPoint[]) => void;
  addSelectionPoint: (point: Omit<SelectionPoint, 'id'> & { id?: string }) => void;
  setSelectionMask: (mask: MaskPayload | null) => void;
  setSelectionBusy: (isBusy: boolean) => void;
  setSelectionError: (error: string | null) => void;
  resetSelection: () => void;
};

export type LayerStore = LayerStoreState & LayerStoreActions;

const emptySelection = (): ActiveSelection => ({
  points: [],
  mask: null,
  isBusy: false,
  error: null,
});

const emptyBackground = (): BackgroundLayer => ({
  id: 'background',
  name: 'Layer 0',
  image: null,
  width: 0,
  height: 0,
  mask: null,
  visible: true,
});

const clampDepth = (depth: number) => Math.min(2, Math.max(0.1, depth));

const normalizeLayerOrder = (layers: ObjectLayer[]) =>
  layers.map((layer, index) => ({
    ...layer,
    order: index,
  }));

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export const useLayerStore = create<LayerStore>()((set) => ({
  mode: 'edit',
  background: emptyBackground(),
  layers: [],
  activeLayerId: null,
  selection: emptySelection(),

  setMode: (mode) => set({ mode }),

  toggleMode: () =>
    set((state) => ({
      mode: state.mode === 'edit' ? 'preview' : 'edit',
    })),

  setBackground: (image, width, height) =>
    set({
      background: {
        ...emptyBackground(),
        image,
        width,
        height,
      },
      layers: [],
      activeLayerId: null,
      selection: emptySelection(),
      mode: 'edit',
    }),

  clearProject: () =>
    set({
      background: emptyBackground(),
      layers: [],
      activeLayerId: null,
      selection: emptySelection(),
      mode: 'edit',
    }),

  addLayer: (input) => {
    const id = input.id ?? createId('layer');

    set((state) => {
      const nextLayer: ObjectLayer = {
        id,
        name: input.name ?? `Layer ${state.layers.length + 1}`,
        image: input.image,
        width: input.width,
        height: input.height,
        mask: input.mask ?? null,
        depth: clampDepth(input.depth ?? 1),
        visible: input.visible ?? true,
        order: state.layers.length,
      };

      return {
        layers: [...state.layers, nextLayer],
        activeLayerId: id,
      };
    });

    return id;
  },

  renameLayer: (layerId, name) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, name: name.trim() || layer.name } : layer,
      ),
    })),

  deleteLayer: (layerId) =>
    set((state) => {
      const layers = normalizeLayerOrder(state.layers.filter((layer) => layer.id !== layerId));

      return {
        layers,
        activeLayerId: state.activeLayerId === layerId ? layers.at(-1)?.id ?? null : state.activeLayerId,
      };
    }),

  setLayerVisibility: (layerId, visible) =>
    set((state) => ({
      layers: state.layers.map((layer) => (layer.id === layerId ? { ...layer, visible } : layer)),
    })),

  toggleLayerVisibility: (layerId) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      ),
    })),

  reorderLayer: (layerId, toIndex) =>
    set((state) => {
      const fromIndex = state.layers.findIndex((layer) => layer.id === layerId);

      if (fromIndex === -1) {
        return state;
      }

      const layers = [...state.layers];
      const [layer] = layers.splice(fromIndex, 1);
      const boundedIndex = Math.min(Math.max(toIndex, 0), layers.length);
      layers.splice(boundedIndex, 0, layer);

      return {
        layers: normalizeLayerOrder(layers),
      };
    }),

  setLayerDepth: (layerId, depth) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, depth: clampDepth(depth) } : layer,
      ),
    })),

  setLayerMask: (layerId, mask) =>
    set((state) => ({
      layers: state.layers.map((layer) => (layer.id === layerId ? { ...layer, mask } : layer)),
    })),

  setActiveLayer: (layerId) =>
    set((state) => ({
      activeLayerId: layerId && state.layers.some((layer) => layer.id === layerId) ? layerId : null,
    })),

  setSelectionPoints: (points) =>
    set((state) => ({
      selection: {
        ...state.selection,
        points,
        error: null,
      },
    })),

  addSelectionPoint: (point) =>
    set((state) => ({
      selection: {
        ...state.selection,
        points: [
          ...state.selection.points,
          {
            ...point,
            id: point.id ?? createId('point'),
          },
        ],
        error: null,
      },
    })),

  setSelectionMask: (mask) =>
    set((state) => ({
      selection: {
        ...state.selection,
        mask,
        error: null,
      },
    })),

  setSelectionBusy: (isBusy) =>
    set((state) => ({
      selection: {
        ...state.selection,
        isBusy,
      },
    })),

  setSelectionError: (error) =>
    set((state) => ({
      selection: {
        ...state.selection,
        error,
        isBusy: false,
      },
    })),

  resetSelection: () => set({ selection: emptySelection() }),
}));

export const selectVisibleLayers = (state: LayerStore) =>
  state.layers.filter((layer) => layer.visible).sort((left, right) => left.order - right.order);

export const selectActiveLayer = (state: LayerStore) =>
  state.layers.find((layer) => layer.id === state.activeLayerId) ?? null;

export const getLayerStoreSnapshot = () => useLayerStore.getState();
