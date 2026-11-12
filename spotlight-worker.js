import { FilesetResolver, InteractiveSegmenter } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/vision_bundle.mjs';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/latest/interactive_segmentation.task';
let segmenter;
let currentImageKey = null;

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm');
      segmenter = await InteractiveSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' }
      });
      self.postMessage({ type: 'ready' });
      return;
    }

    if (data.type === 'select' && segmenter) {
      const { bitmap, imageKey, points, requestId } = data;
      if (imageKey !== currentImageKey) {
        segmenter.setImage(bitmap);
        currentImageKey = imageKey;
      } else {
        bitmap.close();
      }

      const mask = segmenter.segment(points);
      const pixels = new Float32Array(mask.getAsFloat32Array());
      const result = { type: 'mask', requestId, width: mask.width, height: mask.height, pixels: pixels.buffer };
      mask.close();
      self.postMessage(result, [pixels.buffer]);
    }
  } catch (error) {
    self.postMessage({ type: 'error', requestId: data.requestId, message: error?.message || 'Segmentation failed.' });
  }
};
