import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const defaultHost =
  typeof window !== "undefined" && window.location.hostname
    ? window.location.hostname
    : "localhost";

const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

// Use the backend base URL from the API service (same host/port)
const BACKEND_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace("/api", "") ??
  (isHttps ? window.location.origin : `http://${defaultHost}:4000`);

// Singleton socket instance shared across all hook usages
let globalSocket: Socket | null = null;

function getSocket(): Socket {
  if (!globalSocket || !globalSocket.connected) {
    globalSocket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return globalSocket;
}

export type SocketEvent =
  | "recording_started"
  | "lock_released"
  | "clip_saved"
  | "clip_deleted"
  | "clip_transcribing"
  | "clip_transcribed"
  | "transcription_started"
  | "transcription_done"
  | "transcription_error"
  | "analysis_started"
  | "analysis_done"
  | "analysis_error"
  | "candidate_updated";

type EventHandler = (data: any) => void;

/**
 * Hook to subscribe to Socket.IO events and join rooms for real-time sync.
 *
 * Usage:
 *   useSocket({
 *     sessionId: "abc123",         // joins session:abc123 room
 *     joinRoster: true,            // joins roster room for candidate list updates
 *     on: {
 *       clip_saved: (data) => { ... },
 *       analysis_done: (data) => { ... },
 *     }
 *   })
 */
export function useSocket({
  sessionId,
  joinRoster,
  on,
}: {
  sessionId?: string;
  joinRoster?: boolean;
  on?: Partial<Record<SocketEvent, EventHandler>>;
}) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(on);
  handlersRef.current = on;

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (sessionId) {
      socket.emit("join_session", sessionId);
    }
    if (joinRoster) {
      socket.emit("join_roster");
    }

    // Register all event handlers
    const events = Object.keys(handlersRef.current || {}) as SocketEvent[];
    const boundHandlers: Record<string, EventHandler> = {};

    for (const event of events) {
      const handler = (data: any) => {
        handlersRef.current?.[event]?.(data);
      };
      boundHandlers[event] = handler;
      socket.on(event, handler);
    }

    return () => {
      // Remove only the handlers we added
      for (const [event, handler] of Object.entries(boundHandlers)) {
        socket.off(event, handler);
      }
      if (sessionId) {
        socket.emit("leave_session", sessionId);
      }
    };
  }, [sessionId, joinRoster]);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit, socket: socketRef };
}
