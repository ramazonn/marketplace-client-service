export const ProductListFilterSwaggerSchema = {
  category: { type: 'string', required: false, description: 'Category id' },
  brands: { type: 'array', items: { type: 'string' }, required: false, description: 'Brand ids array' },
  models: { type: 'array', items: { type: 'string' }, required: false, description: 'Model ids array' },
  store: { type: 'string', required: false, description: 'Store id' },
  price: {
    type: 'object',
    properties: { from: { type: 'number', required: false }, to: { type: 'number', required: false } },
    required: false,
    description: 'Price from:to',
  },
  color: { type: 'string', required: false },
  rating: { type: 'number', required: false },
  isFavorite: { type: 'boolean', required: false },
}
