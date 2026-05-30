/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  createContext,
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getUid } from "@/lib/auth";

export type ChatMessage = {
  id: string;
  senderId: string;
  conversationId: string;
  content: string;
  createdAt: string;
};

type SocketContextType = {
  connectionLost: boolean;
  failedCount: number;

  sendMessage: (conversationId: string, content: string) => void;
  sendTyping: (conversationId: string) => void;
  sendReadReceipt: (conversationId: string) => void;

  queryOnlineStatus: (conversationId: string) => void;

  onMessage: (callback: (message: ChatMessage) => void) => () => void;
  onTyping: (callback: (data: any) => void) => () => void;
  onReadReceipt: (callback: (data: any) => void) => () => void;
  onOnlineStatus: (callback: (data: any) => void) => () => void;
  onConversationCreated: (callback: (data: any) => void) => () => void;
  onOpen: (callback: () => void) => () => void;

  socketRef: RefObject<WebSocket | null>;
};

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [connectionLost, setConnectionLost] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const shouldReconnect = useRef(true);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const openListenersRef = useRef<Set<() => void>>(new Set());
  const messageListenersRef = useRef<Set<(message: ChatMessage) => void>>(
    new Set(),
  );
  const typingListenersRef = useRef<Set<(data: unknown) => void>>(new Set());
  const readReceiptListenersRef = useRef<Set<(data: unknown) => void>>(
    new Set(),
  );
  const onlineStatusListenersRef = useRef<Set<(data: unknown) => void>>(
    new Set(),
  );
  const conversationListenersRef = useRef<Set<(data: unknown) => void>>(
    new Set(),
  );

  useEffect(() => {
    if (!getUid()) return;

    function connect() {
      if (!shouldReconnect.current || !getUid()) return;

      // TODO: Add authorization to websocket
      const socket = new WebSocket(
        `ws://${window.location.hostname}:8080/ws?userId=${getUid()}`,
      );

      const connectionTimeout = setTimeout(() => {
        if (socket.readyState === WebSocket.CONNECTING) {
          console.log("Connection timeout");
          socket.close();
        }
      }, 5000);

      socket.onopen = () => {
        clearTimeout(connectionTimeout);
        setConnectionLost(false);
        setFailedCount(0);

        openListenersRef.current.forEach((cb) => cb());
      };

      socket.onerror = (error) => {
        console.error("websocket error", error);
        clearTimeout(connectionTimeout);
        socket.close();
      };

      socket.onclose = (event) => {
        console.log("closed", event.code, event.reason);
        clearTimeout(connectionTimeout);

        if (!shouldReconnect.current) return;

        setConnectionLost(true);
        setFailedCount((prev) => prev + 1);

        reconnectTimeout.current = setTimeout(connect, 3000);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "START_TYPING":
            typingListenersRef.current.forEach((cb) => cb(data));
            break;

          case "MESSAGE_RECEIVED":
            messageListenersRef.current.forEach((cb) => cb(data));
            break;

          case "MESSAGE_READ":
            readReceiptListenersRef.current.forEach((cb) => cb(data));
            break;

          case "ONLINE_STATUS":
            onlineStatusListenersRef.current.forEach((cb) => cb(data));
            break;

          case "CONVERSATION_CREATED":
            conversationListenersRef.current.forEach((cb) => cb(data));
            break;
        }
      };

      socketRef.current = socket;
    }

    shouldReconnect.current = true;
    connect();

    return () => {
      shouldReconnect.current = false;

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }

      socketRef.current?.close();
    };
  }, []);

  function onOpen(callback: () => void) {
    openListenersRef.current.add(callback);

    return () => {
      openListenersRef.current.delete(callback);
    };
  }

  function onMessage(callback: (message: ChatMessage) => void) {
    messageListenersRef.current.add(callback);

    return () => {
      messageListenersRef.current.delete(callback);
    };
  }

  function onTyping(callback: (data: any) => void) {
    typingListenersRef.current.add(callback);
    return () => typingListenersRef.current.delete(callback);
  }

  function onReadReceipt(callback: (data: any) => void) {
    readReceiptListenersRef.current.add(callback);
    return () => readReceiptListenersRef.current.delete(callback);
  }

  function onOnlineStatus(callback: (data: any) => void) {
    onlineStatusListenersRef.current.add(callback);
    return () => onlineStatusListenersRef.current.delete(callback);
  }

  function onConversationCreated(callback: (data: any) => void) {
    conversationListenersRef.current.add(callback);
    return () => conversationListenersRef.current.delete(callback);
  }

  function sendMessage(conversationId: string, content: string) {
    if (!content.trim()) return;
    socketRef.current?.send(
      JSON.stringify({
        conversationId: conversationId,
        content,
        type: "SEND_MESSAGE",
      }),
    );
  }

  function sendReadReceipt(conversationId: string) {
    socketRef.current?.send(
      JSON.stringify({
        conversationId: conversationId,
        type: "SEND_READ",
      }),
    );
  }

  function sendTyping(conversationId: string) {
    socketRef.current?.send(
      JSON.stringify({
        conversationId,
        type: "SEND_TYPING",
      }),
    );
  }

  function queryOnlineStatus(conversationId: string) {
    socketRef.current?.send(
      JSON.stringify({
        type: "GET_ONLINE_STATUS",
        conversationId: conversationId,
      }),
    );
  }

  return (
    <SocketContext.Provider
      value={{
        connectionLost,
        failedCount,

        sendMessage,
        sendTyping,
        sendReadReceipt,

        queryOnlineStatus,

        onMessage,
        onOpen,
        onOnlineStatus,
        onTyping,
        onReadReceipt,
        onConversationCreated,

        socketRef,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used inside SocketProvider");
  }

  return context;
}
