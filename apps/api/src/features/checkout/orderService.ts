import type { Order } from '@shop/contracts/orders';
import type { OrderRepository } from './orderRepository.js';

export interface OrderService {
  get(orderId: number): Order | undefined;
}

export function createOrderService(repository: OrderRepository): OrderService {
  return { get: (orderId) => repository.findById(orderId) };
}
