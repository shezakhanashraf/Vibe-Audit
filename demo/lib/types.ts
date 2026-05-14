export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartResponse {
  items: CartItem[];
  totalPrice: number;
  itemCount: number;
}
