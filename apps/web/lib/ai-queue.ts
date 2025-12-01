/**
 * AI Queue Management
 * Manages products queued for AI content generation
 */

export interface QueuedProduct {
  id: number;
  title: string;
  sku: string;
}

const QUEUE_KEY = 'ai-generation-queue';

/**
 * Get all products in the AI queue
 */
export function getAIQueue(): QueuedProduct[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading AI queue:', error);
    return [];
  }
}

/**
 * Add a product to the AI queue
 */
export function addToAIQueue(product: QueuedProduct): void {
  if (typeof window === 'undefined') return;
  
  try {
    const queue = getAIQueue();
    
    // Check if product already exists
    const exists = queue.some(p => p.id === product.id);
    if (exists) {
      console.log('Product already in queue');
      return;
    }
    
    queue.push(product);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    // Dispatch event to notify other components
    window.dispatchEvent(new Event('ai-queue-updated'));
  } catch (error) {
    console.error('Error adding to AI queue:', error);
  }
}

/**
 * Remove a product from the AI queue
 */
export function removeFromAIQueue(productId: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const queue = getAIQueue();
    const filtered = queue.filter(p => p.id !== productId);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    
    // Dispatch event to notify other components
    window.dispatchEvent(new Event('ai-queue-updated'));
  } catch (error) {
    console.error('Error removing from AI queue:', error);
  }
}

/**
 * Clear the entire AI queue
 */
export function clearAIQueue(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(QUEUE_KEY);
    window.dispatchEvent(new Event('ai-queue-updated'));
  } catch (error) {
    console.error('Error clearing AI queue:', error);
  }
}
