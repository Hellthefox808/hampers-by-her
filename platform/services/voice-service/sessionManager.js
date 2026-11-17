/**
 * Hampers by Her Atelier AI Platform — Voice Session Lifecycle State Machine
 * Enforces deterministic 12-state transitions and turn accounting.
 */

const { EventEmitter } = require("events");

const VALID_TRANSITIONS = {
  CREATED: ["AUTHENTICATED", "FAILED"],
  AUTHENTICATED: ["CONNECTING", "FAILED"],
  CONNECTING: ["CONNECTED", "RECONNECTING", "FAILED"],
  CONNECTED: ["LISTENING", "RECONNECTING", "ENDING", "FAILED"],
  LISTENING: ["PROCESSING", "INTERRUPTED", "RECONNECTING", "ENDING", "FAILED"],
  PROCESSING: ["RESPONDING", "INTERRUPTED", "RECONNECTING", "ENDING", "FAILED"],
  RESPONDING: ["LISTENING", "INTERRUPTED", "RECONNECTING", "ENDING", "FAILED"],
  INTERRUPTED: ["LISTENING", "PROCESSING", "RECONNECTING", "ENDING", "FAILED"],
  RECONNECTING: ["CONNECTED", "ENDING", "FAILED"],
  ENDING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: []
};

class InvalidStateTransitionError extends Error {
  constructor(from, to) {
    super(`Illegal voice session transition from ${from} to ${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

class VoiceSessionManager extends EventEmitter {
  constructor({ sessionId, tenantId, userId }) {
    super();
    this.sessionId = sessionId;
    this.tenantId = tenantId;
    this.userId = userId;
    this.state = "CREATED";
    this.startedAt = Date.now();
    this.turns = [];
    this.activeTurn = null;
    this.interruptionCount = 0;
  }

  transitionTo(nextState, reason = "") {
    const allowed = VALID_TRANSITIONS[this.state] || [];
    if (!allowed.includes(nextState)) {
      throw new InvalidStateTransitionError(this.state, nextState);
    }

    const previousState = this.state;
    this.state = nextState;

    if (nextState === "INTERRUPTED") {
      this.interruptionCount++;
    }

    this.emit("state_changed", {
      sessionId: this.sessionId,
      from: previousState,
      to: nextState,
      reason,
      timestamp: Date.now()
    });

    return this.state;
  }

  startTurn(speaker = "USER") {
    this.activeTurn = {
      turnId: `turn_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      speaker,
      startedAt: Date.now(),
      transcript: "",
      isFinal: false
    };
    return this.activeTurn;
  }

  completeTurn(transcript) {
    if (this.activeTurn) {
      this.activeTurn.transcript = transcript;
      this.activeTurn.endedAt = Date.now();
      this.activeTurn.isFinal = true;
      this.turns.push(this.activeTurn);
      const finished = this.activeTurn;
      this.activeTurn = null;
      return finished;
    }
    return null;
  }

  getDurationMs() {
    return Date.now() - this.startedAt;
  }
}

module.exports = { VoiceSessionManager, InvalidStateTransitionError };
