import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  Texture,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeObject3DResources } from './disposeObject3D';

describe('disposeObject3DResources', () => {
  it('descarta recursos compartilhados apenas uma vez', () => {
    const root = new Group();
    const geometry = new BoxGeometry();
    const texture = new Texture();
    const material = new MeshStandardMaterial({ map: texture });
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const textureDispose = vi.spyOn(texture, 'dispose');

    root.add(new Mesh(geometry, material));
    root.add(new Mesh(geometry, material));
    disposeObject3DResources(root);

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
  });

  it('descarta texturas armazenadas em uniforms de ShaderMaterial', () => {
    const root = new Group();
    const texture = new Texture();
    const material = new ShaderMaterial({ uniforms: { diffuseMap: { value: texture } } });
    const textureDispose = vi.spyOn(texture, 'dispose');
    root.add(new Mesh(new BoxGeometry(), material));

    disposeObject3DResources(root);

    expect(textureDispose).toHaveBeenCalledTimes(1);
  });
});
