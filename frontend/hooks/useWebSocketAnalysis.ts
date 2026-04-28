import { useEffect, useRef, useCallback, useState } from "react";
import { MASResponse } from "@/lib/types";

export interface ThoughtMessage {
  type: "thought" | "done" | "error" | "result";
  node?: string;
  data?: {
    agent: string;
    timestamp: string;
    thought: string;
    output?: any;
  };
  session_id?: string;
  message?: string;
}

interface UseWebSocketAnalysisOptions {
  onThought?: (thought: ThoughtMessage) => void;
  onResult?: (result: MASResponse) => void;
  onDone?: (sessionId: string) => void;
  onError?: (error: string) => void;
}

export function useWebSocketAnalysis(
  options: UseWebSocketAnalysisOptions = {},
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [thoughts, setThoughts] = useState<ThoughtMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(
    async (payload: any) => {
      setIsAnalyzing(true);
      setThoughts([]);
      setSessionId(null); // Clear session ID on new connection attempt

      const resolveWsUrl = () => {
        const normalize = (rawUrl: string) => {
          const trimmed = rawUrl.trim();
          let url: URL;
          try {
            url = new URL(trimmed);
          } catch {
            // Allow providing host:port[/path] without a protocol
            url = new URL(`ws://${trimmed.replace(/^\/+/, "")}`);
          }
          // Allow providing http(s) URLs and converting to ws(s)
          if (url.protocol === "https:") url.protocol = "wss:";
          if (url.protocol === "http:") url.protocol = "ws:";

          url.search = "";
          url.hash = "";

          // If a base URL was provided, attach the default WS route
          if (!url.pathname || url.pathname === "/") {
            url.pathname = "/ws/analyze";
          }

          return url.toString();
        };

        const wsEnv = process.env.NEXT_PUBLIC_WS_URL;
        if (wsEnv) {
          try {
            return normalize(wsEnv);
          } catch {
            // Fall through to other strategies
          }
        }

        const apiEnv = process.env.NEXT_PUBLIC_API_URL || "https://agentic-canteen-dss.onrender.com";
        if (apiEnv) {
          try {
            return normalize(apiEnv);
          } catch {
            // Fall through to window-based default
          }
        }

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${window.location.hostname}:5500/ws/analyze`;
      };

      const wsUrl = resolveWsUrl();

      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
          ws.send(JSON.stringify(payload));
        };

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);

          // Ignore keepalive pings
          if (message.type === "ping") return;

          if (message.type === "thought") {
            setThoughts((prev) => [...prev, message]);
            options.onThought?.(message);
          }

          if (message.type === "result") {
            // Pass the result data to the callback
            const result: MASResponse = {
              session_id: message.session_id || "",
              ...message.data,
            };
            options.onResult?.(result);
          }

          if (message.type === "done") {
            setIsAnalyzing(false);
            setIsConnected(false);
            setSessionId(message.session_id || null); // Set session ID when done
            options.onDone?.(message.session_id || "");
          }

          if (message.type === "error") {
            setIsAnalyzing(false);
            setIsConnected(false);
            setSessionId(null); // Clear session ID on error
            options.onError?.(message.message || "Unknown error");
          }
        };

        ws.onerror = (event) => {
          const errorMsg = "WebSocket error occurred";
          setIsAnalyzing(false);
          setIsConnected(false);
          setSessionId(null); // Clear session ID on error
          options.onError?.(errorMsg);
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Do not clear sessionId here, as it might be needed after analysis is done
        };

        wsRef.current = ws;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Connection failed";
        setIsAnalyzing(false);
        setIsConnected(false);
        setSessionId(null); // Clear session ID on connection failure
        options.onError?.(errorMsg);
      }
    },
    [options],
  );

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsAnalyzing(false);
    setSessionId(null); // Clear session ID on explicit disconnect
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    isConnected,
    isAnalyzing,
    thoughts,
    sessionId, // Add sessionId to the return value
  };
}
