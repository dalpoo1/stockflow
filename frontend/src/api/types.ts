// Shared domain types for the whole frontend. No `any` on domain data.

export interface Product {
  id: number
  sku: string
  name: string
  price: number
  stock: number
  is_active: boolean
  created_at: string
  last_movement_at: string | null
}

export type MovementType = 'in' | 'out'

export interface StockMovement {
  id: number
  product_id: number
  type: MovementType
  qty: number
  note: string | null
  created_at: string
}

export type OrderStatus = 'CREATED' | 'CANCELLED'

export interface OrderItem {
  id: number
  sku: string
  qty: number
  unit_price: number
}

export interface Order {
  id: number
  customer: string
  status: OrderStatus
  total: number
  created_at: string
  cancelled_at: string | null
  items: OrderItem[]
}

export interface Summary {
  total_products: number
  active_products: number
  total_stock_value: number
  low_stock_count: number
}

export interface Paginated<T> {
  data: T[]
  page: number
  limit: number
  total: number
}

export type ProductStatusFilter = 'all' | 'active' | 'inactive' | 'low'

export interface StockAdjustInput {
  type: MovementType
  qty: number
  note?: string
}

export interface CreateOrderItemInput {
  sku: string
  qty: number
}

export interface CreateOrderInput {
  customer: string
  items: CreateOrderItemInput[]
}

export interface ProductCreateInput {
  sku: string
  name: string
  price: number
}

export interface ProductUpdateInput {
  sku?: string
  name?: string
  price?: number
  is_active?: boolean
}
