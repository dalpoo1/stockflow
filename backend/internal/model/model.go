package model

import "time"

// Product is a stockable item. Money (price) and stock are integers.
type Product struct {
	ID             int        `json:"id"`
	SKU            string     `json:"sku"`
	Name           string     `json:"name"`
	Price          int        `json:"price"`
	Stock          int        `json:"stock"`
	IsActive       bool       `json:"is_active"`
	CreatedAt      time.Time  `json:"created_at"`
	LastMovementAt *time.Time `json:"last_movement_at"`
}

// StockMovement is an immutable ledger entry. History is never deleted.
type StockMovement struct {
	ID        int       `json:"id"`
	ProductID int       `json:"product_id"`
	Type      string    `json:"type"`
	Qty       int       `json:"qty"`
	Note      *string   `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}

// Order is a sales order. Status is CREATED or CANCELLED.
type Order struct {
	ID          int         `json:"id"`
	Customer    string      `json:"customer"`
	Status      string      `json:"status"`
	Total       int         `json:"total"`
	CreatedAt   time.Time   `json:"created_at"`
	CancelledAt *time.Time  `json:"cancelled_at"`
	Items       []OrderItem `json:"items"`
}

// OrderItem is a line on an order with a server-computed unit price snapshot.
type OrderItem struct {
	ID        int    `json:"id"`
	SKU       string `json:"sku"`
	Qty       int    `json:"qty"`
	UnitPrice int    `json:"unit_price"`
}

// Summary is the dashboard summary, derived from the products table.
type Summary struct {
	TotalProducts   int `json:"total_products"`
	ActiveProducts  int `json:"active_products"`
	TotalStockValue int `json:"total_stock_value"`
	LowStockCount   int `json:"low_stock_count"`
}
