import { LOD_ZOOM } from './config.js';

export function resolveLod(zoom) {
  if (zoom <= LOD_ZOOM.block) return 'block';
  if (zoom <= LOD_ZOOM.mass) return 'mass';
  return 'detail';
}
