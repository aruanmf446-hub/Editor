import { z } from 'zod';
const finite = z.number().finite();
const positive = finite.positive();
export const transformSchema = z.object({x:finite,y:finite,z:finite,width:positive,height:positive,scaleX:finite.refine((value)=>value!==0),scaleY:finite.refine((value)=>value!==0),rotation:finite});
export const objectSchema = z.object({
  id:z.string().min(1),sceneId:z.string().min(1),type:z.string().min(1),name:z.string().min(1),assetId:z.string().optional(),transform:transformSchema,visible:z.boolean(),locked:z.boolean(),editorOnly:z.boolean(),gameOnly:z.boolean(),
  endingMode:z.enum(['next-scene','target-scene','complete-game']).optional(),targetSceneId:z.string().optional(),
}).passthrough();
const backgroundSchema = z.object({
  fit:z.enum(['cover','contain','stretch','original']).default('cover'),
  positionX:finite.default(50),
  positionY:finite.default(50),
  scale:positive.default(1),
  editorOpacity:finite.min(0).max(1).default(1),
}).default({fit:'cover',positionX:50,positionY:50,scale:1,editorOpacity:1});
export const projectSchema = z.object({
  format:z.literal('el-fuego-studio-project'),
  version:z.literal(1),
  project:z.object({id:z.string().min(1),name:z.string().min(1),createdAt:z.string().datetime(),updatedAt:z.string().datetime()}),
  settings:z.object({gravity:finite,gridSize:positive,snapEnabled:z.boolean(),defaultSceneWidth:positive,defaultSceneHeight:positive}),
  assets:z.array(z.object({id:z.string().min(1),name:z.string().min(1),originalName:z.string().min(1),mimeType:z.string().min(1),size:z.number().int().nonnegative(),checksum:z.string().optional(),category:z.enum(['background','model','texture','audio','thumbnail','other'])})),
  scenes:z.array(z.object({id:z.string().min(1),name:z.string().min(1),order:z.number().int().nonnegative(),width:positive,height:positive,backgroundAssetId:z.string().nullable(),background:backgroundSchema,objects:z.array(objectSchema)})).min(1),
});
