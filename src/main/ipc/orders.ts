import { ipcMain } from 'electron';
import { getDb } from '../db';
import * as clients from '../services/clients';
import * as orders from '../services/orders';
import type { ClientInput, OrderInput, OrderStatus } from '@shared/orders';

/** الجهات والطلبات — قنواتٌ رقيقة فوق خدماتٍ مختبرة بقاعدةٍ في الذاكرة. */
export function registerOrderIpc(): void {
  ipcMain.handle('clients:list', (_e, query?: string) => clients.listClients(getDb(), query ?? ''));
  ipcMain.handle('clients:save', (_e, input: ClientInput) => clients.saveClient(getDb(), input));
  ipcMain.handle('clients:setLogo', (_e, id: number, imagePath: string) => clients.setClientLogo(getDb(), id, imagePath));
  ipcMain.handle('clients:delete', (_e, id: number) => clients.deleteClient(getDb(), id));

  ipcMain.handle('orders:list', (_e, filter?: orders.OrderFilter) => orders.listOrders(getDb(), filter ?? {}));
  ipcMain.handle('orders:get', (_e, id: number) => orders.getOrder(getDb(), id));
  ipcMain.handle('orders:save', (_e, input: OrderInput) => orders.saveOrder(getDb(), input));
  ipcMain.handle('orders:setStatus', (_e, id: number, status: OrderStatus) => orders.setOrderStatus(getDb(), id, status));
  ipcMain.handle('orders:delete', (_e, id: number) => orders.deleteOrder(getDb(), id));
}
