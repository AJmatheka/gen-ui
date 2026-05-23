import { useRef, useState } from 'react';
import { loadCanvasReadyImage, MAX_UPLOAD_DIMENSION } from '../utils/image';

const idleState = {
  image: null,
  error: '',
  dragging: false,
  loading: false,
};

export function Upload({ inputId = 'parallaxFile', onImageReady }) {
  const inputRef = useRef(null);
  const [state, setState] = useState(idleState);

  async function handleFile(file, notifyLegacy = false) {
    if (!file) return;

    setState((current) => ({ ...current, error: '', loading: true }));

    try {
      const image = await loadCanvasReadyImage(file);
      setState({ image, error: '', dragging: false, loading: false });
      onImageReady?.(image);

      if (notifyLegacy) {
        window.dispatchEvent(
          new CustomEvent('genui:parallax-upload', { detail: { file, image } }),
        );
      }
    } catch (error) {
      setState({
        image: null,
        error: error instanceof Error ? error.message : 'Image upload failed.',
        dragging: false,
        loading: false,
      });
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0], true);
  }

  const status = state.image
    ? `${state.image.width} x ${state.image.height}px`
    : `Max ${MAX_UPLOAD_DIMENSION}px on the longest edge`;

  return (
    <div
      className={`upload-panel${state.dragging ? ' drag-over' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setState((current) => ({ ...current, dragging: true }));
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setState((current) => ({ ...current, dragging: false }))}
      onDrop={handleDrop}
    >
      <button className="upload-trigger primary" type="button" onClick={() => inputRef.current?.click()}>
        Upload Image
      </button>
      <input
        id={inputId}
        ref={inputRef}
        className="upload-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <div className="upload-preview" aria-live="polite">
        {state.image ? (
          <img src={state.image.dataUrl} alt="" />
        ) : (
          <span>{state.loading ? 'Preparing image' : 'Drop image here'}</span>
        )}
      </div>
      <p className={state.error ? 'warn' : 'hint'}>{state.error || status}</p>
    </div>
  );
}
