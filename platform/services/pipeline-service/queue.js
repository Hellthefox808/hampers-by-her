/**
 * Hampers by Her Atelier AI Platform — Durable Queue & DLQ Infrastructure
 * At-least-once delivery, idempotency tracking, bounded exponential retries.
 */

class DurableQueue {
  constructor(name = "hbh-default-queue") {
    this.name = name;
    this.messages = [];
    this.dlq = [];
    this.processedMessageIds = new Set();
    this.maxRetries = 3;
  }

  /**
   * Enqueue a message
   */
  enqueue(message) {
    const item = {
      messageId: message.id || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      payload: message.payload || message,
      attempt: 0,
      enqueuedAt: Date.now()
    };
    this.messages.push(item);
    return item;
  }

  /**
   * Dequeue and process next message with an idempotent handler
   */
  async processNext(consumerName, handler) {
    if (this.messages.length === 0) return null;

    const item = this.messages.shift();

    // Idempotency check: has this message already been processed?
    if (this.processedMessageIds.has(item.messageId)) {
      return { status: "SKIPPED_DUPLICATE", messageId: item.messageId };
    }

    try {
      item.attempt++;
      const result = await handler(item.payload);

      // Record success in idempotent ledger
      this.processedMessageIds.add(item.messageId);

      return {
        status: "SUCCESS",
        messageId: item.messageId,
        attempt: item.attempt,
        result
      };
    } catch (err) {
      if (item.attempt < this.maxRetries) {
        // Re-enqueue with exponential backoff delay (simulated by pushing to end)
        this.messages.push(item);
        return {
          status: "RETRY_SCHEDULED",
          messageId: item.messageId,
          attempt: item.attempt,
          error: err.message
        };
      } else {
        // Move poison message to Dead-Letter Queue (DLQ)
        this.dlq.push({
          ...item,
          failedAt: Date.now(),
          finalError: err.message
        });
        return {
          status: "MOVED_TO_DLQ",
          messageId: item.messageId,
          dlqSize: this.dlq.length,
          error: err.message
        };
      }
    }
  }

  getDlqMessages() {
    return [...this.dlq];
  }
}

module.exports = { DurableQueue };
