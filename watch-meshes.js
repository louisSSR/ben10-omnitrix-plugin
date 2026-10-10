/** Load reviewed, assembled meshes. Source-space transforms and material decisions are baked at build time. */
const MESH_WATCH_IDS = ['original', 'recalibrated', 'ultimatrix', 'omniverse'];
const MESH_GROUPS = ['body', 'core', 'lid-left', 'lid-right'];
const MESH_MAX_TRIANGLES = 150000;
const meshVector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const meshMaterial = value => Array.isArray(value) && value.length === 4 && value.slice(0, 3).every(v => Number.isFinite(v) && v >= 0 && v <= 1) && Number.isInteger(value[3]) && value[3] >= 0 && value[3] <= 4;
const meshAbort = signal => { if (signal?.aborted) { const error = new Error('Mesh load aborted'); error.name = 'AbortError'; throw error; } };

export function validateWatchMeshManifest(manifest, watch = manifest?.watch) {
  if (!MESH_WATCH_IDS.includes(watch) || manifest?.watch !== watch || manifest.modelKind !== 'source-mesh' || !/^[a-f0-9]{64}$/.test(manifest.sourceArchiveSha256 || '')) throw new TypeError('Invalid watch mesh identity');
  if (!meshVector(manifest.face?.center) || !Number.isFinite(manifest.face.radius) || manifest.face.radius <= 0 || !Number.isFinite(manifest.lift) || manifest.lift < 0 || manifest.lift > 4) throw new TypeError('Invalid watch mesh face or lift');
  if (!meshVector(manifest.bounds?.min) || !meshVector(manifest.bounds?.max) || manifest.bounds.min.some((v, i) => v > manifest.bounds.max[i] || Math.abs(v) > 32 || Math.abs(manifest.bounds.max[i]) > 32)) throw new TypeError('Invalid watch mesh bounds');
  if (manifest.camera !== undefined && (!Number.isFinite(manifest.camera?.distance) || manifest.camera.distance < 1 || manifest.camera.distance > 20 || !meshVector(manifest.camera.target) || manifest.camera.target.some(v => Math.abs(v) > 32))) throw new TypeError('Invalid watch mesh camera');
  if (manifest.sourceFinish !== undefined && !['interpreted', 'source-preserved'].includes(manifest.sourceFinish)) throw new TypeError('Invalid source mesh finish');
  if (manifest.sourceMotion !== undefined && (!manifest.sourceMotion || typeof manifest.sourceMotion !== 'object' || Array.isArray(manifest.sourceMotion) ||
    Object.keys(manifest.sourceMotion).some(key => !['core', 'lids'].includes(key)) ||
    typeof manifest.sourceMotion.core !== 'boolean' || typeof manifest.sourceMotion.lids !== 'boolean')) throw new TypeError('Invalid source motion capabilities');
  if (!Array.isArray(manifest.parts) || !manifest.parts.length || manifest.parts.length > 64) throw new TypeError('Invalid watch mesh parts');
  const ids = new Set(); let vertices = 0;
  for (const part of manifest.parts) {
    if (!part || !/^[a-z0-9][a-z0-9-]*$/.test(part.id || '') || ids.has(part.id) || !MESH_GROUPS.includes(part.group)) throw new TypeError('Invalid watch mesh part');
    ids.add(part.id);
    if (!/^(?:\.\/)?assets\/(?:runtime\/[a-f0-9]{64}\.(?:f32|bin)|watch-meshes\/[a-z0-9-]+\.(?:bin|pn\.f32))$/.test(part.file || '')) throw new TypeError('Invalid watch mesh file');
    const layout = part.vertexLayout || manifest.vertexLayout || 'pn6-f32le';
    if (!['pn6-f32le', 'pn-c10-f32le'].includes(layout) || !Number.isInteger(part.vertices) || part.vertices < 3 || part.vertices % 3 || part.vertices > MESH_MAX_TRIANGLES * 3) throw new TypeError('Invalid watch mesh vertex layout');
    if (layout === 'pn6-f32le' && !meshMaterial(part.material)) throw new TypeError('Invalid watch mesh material');
    if (part.bytes !== undefined && part.bytes !== part.vertices * (layout === 'pn6-f32le' ? 24 : 40)) throw new TypeError('Invalid watch mesh byte count');
    if (part.sha256 !== undefined && !/^[a-f0-9]{64}$/.test(part.sha256)) throw new TypeError('Invalid watch mesh hash');
    vertices += part.vertices;
  }
  const hasCore = manifest.parts.some(p => p.group === 'core'), hasLids = manifest.parts.some(p => p.group.startsWith('lid-'));
  if (manifest.sourceMotion && (manifest.sourceMotion.core !== hasCore || manifest.sourceMotion.lids !== hasLids || (!hasCore && manifest.lift !== 0))) throw new RangeError('Source motion does not match retained parts');
  if (vertices > MESH_MAX_TRIANGLES * 3 || !manifest.parts.some(p => p.group === 'body') || (!hasCore && manifest.sourceMotion?.core !== false)) throw new RangeError('Watch mesh exceeds triangle budget or lacks motion groups');
  return manifest;
}

/** A bounded CPU cache belongs to one renderer. A cancelled/failed load is never cached. */
export function createWatchMeshLoader({ manifests = {}, baseUrl = globalThis.document?.baseURI, fetchImpl = globalThis.fetch?.bind(globalThis), cryptoImpl = globalThis.crypto, maxCachedBytes = 32 * 1024 * 1024 } = {}) {
  const cache = new Map(); let cachedBytes = 0, disposed = false;
  if (!Number.isFinite(maxCachedBytes) || maxCachedBytes < 0) throw new RangeError('Invalid watch mesh cache budget');
  const touch = watch => {
    const entry = cache.get(watch);
    if (!entry) return null;
    cache.delete(watch); cache.set(watch, entry); return entry.geometry;
  };
  async function load(watch, { signal } = {}) {
    meshAbort(signal);
    if (disposed) throw new Error('Watch mesh loader disposed');
    const hit = touch(watch); if (hit) return hit;
    const manifest = manifests[watch]; if (!manifest) return null;
    validateWatchMeshManifest(manifest, watch);
    if (typeof fetchImpl !== 'function') throw new Error('Watch mesh fetch unavailable');
    const parts = []; let memoryBytes = 0;
    for (const part of manifest.parts) {
      meshAbort(signal);
      const layout = part.vertexLayout || manifest.vertexLayout || 'pn6-f32le', stride = layout === 'pn6-f32le' ? 6 : 10;
      const expectedBytes = part.vertices * stride * 4;
      const url = new URL(part.file, baseUrl);
      const response = await fetchImpl(url.href, { signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error('Watch mesh fetch failed');
      const announcedBytes = Number(response.headers?.get?.('content-length'));
      if (announcedBytes > expectedBytes) throw new RangeError('Watch mesh response exceeds expected bytes');
      const bytes = await response.arrayBuffer(); meshAbort(signal);
      if (bytes.byteLength !== expectedBytes) throw new RangeError('Watch mesh byte count mismatch');
      const expectedHash = part.sha256 || /\/([a-f0-9]{64})\.(?:f32|bin)$/.exec(part.file)?.[1];
      if (expectedHash && cryptoImpl?.subtle?.digest) {
        const hash = [...new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
        if (hash !== expectedHash) throw new Error('Watch mesh hash mismatch');
      }
      meshAbort(signal);
      const source = new DataView(bytes), positions = new Float32Array(part.vertices * 3), normals = new Float32Array(part.vertices * 3), colors = new Float32Array(part.vertices * 4);
      for (let i = 0; i < part.vertices; i++) {
        const byte = i * stride * 4;
        for (let axis = 0; axis < 3; axis++) {
          const position = source.getFloat32(byte + axis * 4, true), normal = source.getFloat32(byte + 12 + axis * 4, true);
          if (!Number.isFinite(position) || position < manifest.bounds.min[axis] - 1e-4 || position > manifest.bounds.max[axis] + 1e-4 || !Number.isFinite(normal)) throw new TypeError('Watch mesh has invalid positions or normals');
          positions[i * 3 + axis] = position; normals[i * 3 + axis] = normal;
        }
        if (Math.abs(Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) - 1) > .003) throw new TypeError('Watch mesh normal is not unit length');
        for (let channel = 0; channel < 4; channel++) {
          const color = stride === 10 ? source.getFloat32(byte + 24 + channel * 4, true) : part.material[channel];
          if (!Number.isFinite(color) || color < 0 || (channel < 3 ? color > 1 : !Number.isInteger(color) || color > 4)) throw new TypeError('Watch mesh has invalid vertex material');
          colors[i * 4 + channel] = color;
        }
      }
      parts.push({ id: part.id, group: part.group, positions, normals, colors });
      memoryBytes += positions.byteLength + normals.byteLength + colors.byteLength;
    }
    meshAbort(signal); if (disposed) throw new Error('Watch mesh loader disposed');
    const geometry = { watch, parts, face: { center: [...manifest.face.center], radius: manifest.face.radius }, lift: manifest.lift, bounds: { min: [...manifest.bounds.min], max: [...manifest.bounds.max] }, sourceArchiveSha256: manifest.sourceArchiveSha256, modelKind: 'source-mesh' };
    if (manifest.sourceMotion) geometry.sourceMotion = { ...manifest.sourceMotion };
    if (manifest.sourceFinish) geometry.sourceFinish = manifest.sourceFinish;
    if (manifest.camera) geometry.camera = { distance: manifest.camera.distance, target: [...manifest.camera.target] };
    if (memoryBytes <= maxCachedBytes) {
      while (cache.size && cachedBytes + memoryBytes > maxCachedBytes) { const oldest = cache.keys().next().value; cachedBytes -= cache.get(oldest).bytes; cache.delete(oldest); }
      const previous = cache.get(watch); if (previous) cachedBytes -= previous.bytes;
      cache.set(watch, { geometry, bytes: memoryBytes }); cachedBytes += memoryBytes;
    }
    return geometry;
  }
  load.peek = watch => disposed ? null : touch(watch);
  load.dispose = () => { disposed = true; cache.clear(); cachedBytes = 0; };
  return load;
}
