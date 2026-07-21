import { Mesh, Texture, type Material, type Object3D } from 'three';

type ShaderLikeMaterial = Material & {
  uniforms?: Record<string, { value?: unknown } | unknown>;
};

function collectTextures(value: unknown, textures: Set<Texture>, visited: Set<object>, depth = 0): void {
  if (value instanceof Texture) {
    textures.add(value);
    return;
  }
  if (depth >= 4 || value == null || typeof value !== 'object') return;
  if (visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectTextures(item, textures, visited, depth + 1);
    return;
  }

  for (const nested of Object.values(value)) collectTextures(nested, textures, visited, depth + 1);
}

function collectMaterialTextures(material: Material, textures: Set<Texture>): void {
  const visited = new Set<object>();
  for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }

  const uniforms = (material as ShaderLikeMaterial).uniforms;
  if (!uniforms) return;
  for (const uniform of Object.values(uniforms)) {
    if (uniform && typeof uniform === 'object' && 'value' in uniform) {
      collectTextures((uniform as { value?: unknown }).value, textures, visited);
    } else {
      collectTextures(uniform, textures, visited);
    }
  }
}

export function disposeObject3DResources(root: Object3D): void {
  const geometries = new Set<{ dispose: () => void }>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (object.geometry) geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) {
      if (!material) continue;
      materials.add(material);
      collectMaterialTextures(material, textures);
    }
  });

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}
