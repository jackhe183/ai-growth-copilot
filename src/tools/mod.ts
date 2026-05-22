import { queryProduct } from './query_product.ts';

export { queryProduct };

type ToolFunc = (input: string) => Promise<string>;

export const TOOLKIT: Record<string, ToolFunc> = {
  query_product: queryProduct,
};