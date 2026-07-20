import { z } from 'zod';
const finite = z.number().finite();
const positive = finite.positive();
export const transformSchema = z.object({x:finite,y:finite,z:finite,width:positive,height:positive,scaleX:finite.refine((value)=>value!==0),scaleY:finite.refine((value)=>value!==0),rotation:finite});
export const objectSchema = z.object({id:z.string().min(1),sceneId:z.string().min(1),type:z.string().min(1),name:z.string().min(1),transform:transformSchema,visible:z.boolean(),locked:z.boolean(),editorOnly:z.boolean(),gameOnly:z.boolean()}).passthrough();
export const projectSchema = z.object({
  format:z.literal('el-fuego-studio-project'),
  version:z.literal(1),
  project:z.object({id:z.string().min(1),name:z.string().min(1),createdAt:z.string().datetime(),updatedAt:z.string().datetime()}),
  settings:z.object({gravity:finite,gridSize:positive,snapEnabled:z.boolean(),defaultSceneWidth:positive,defaultSceneHeight:positive}),
  assets:z.array(z.object({id:z.string().min(1),name:z.string().min(1),originalName:z.string().min(1),mimeType:z.string().min(1),size:z.number().int().nonnegative(),checksum:z.string().optional(),category:z.enum(['background','model','texture','audio','thumbnail','other'])})),
  scenes:z.array(z.object({id:z.string().min(1),name:z.string().min(1),order:z.number().int().nonnegative(),width:positive,height:positive,backgroundAssetId:z.string().nullable(),objects:z.array(objectSchema)})).min(1),
});