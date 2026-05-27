"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { nanoid } from "nanoid";

export type ChatMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
};

type SocketContextType = {
  myId: string | null;
  messages: ChatMessage[];
  connectionLost: boolean;
  failedCount: number;
  otherTyping: boolean;
  instantHideTyping: boolean;
  setInstantHideTyping: (value: boolean) => void;
  sendMessage: (receiverId: string, content: string) => void;
  sendTyping: (receiverId: string) => void;
  queryOnlineStatus: (userIdsToCheck: string[]) => void;
  onlineUUIDs: { receiverId: string; online: boolean }[];
};

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionLost, setConnectionLost] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [otherTyping, setOtherTyping] = useState(false);
  const [onlineUUIDs, setOnlineUUIDs] = useState([]);

  const [instantHideTyping, setInstantHideTyping] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const shouldReconnect = useRef(true);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const removeOtherTyping = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyId(nanoid());
  }, []);

  useEffect(() => {
    if (!myId) return;

    function connect() {
      if (!shouldReconnect.current || !myId) return;

      const socket = new WebSocket(
        `ws://${window.location.hostname}:8080/ws?userId=${myId}`,
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
          case "SHOW_TYPING":
            setOtherTyping(true);
            setInstantHideTyping(false);

            if (removeOtherTyping.current) {
              clearTimeout(removeOtherTyping.current);
            }

            removeOtherTyping.current = setTimeout(() => {
              setOtherTyping(false);
            }, 5000);

            break;

          case "MESSAGE_RECEIVED":
            setInstantHideTyping(true);
            setOtherTyping(false);
            setMessages((prev) => [...prev, data]);

            if (removeOtherTyping.current) {
              clearTimeout(removeOtherTyping.current);
            }

            break;

          case "ONLINE_STATUS":
            console.log(data);
            setOnlineUUIDs(data["userIds"]);
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

      if (removeOtherTyping.current) {
        clearTimeout(removeOtherTyping.current);
      }

      socketRef.current?.close();
    };
  }, [myId]);

  function sendMessage(receiverId: string, content: string) {
    if (!myId || !content.trim()) return;

    socketRef.current?.send(
      JSON.stringify({
        senderId: myId,
        receiverId,
        content,
        type: "SEND_MESSAGE",
      }),
    );
  }

  function sendTyping(receiverId: string) {
    if (!myId) return;

    socketRef.current?.send(
      JSON.stringify({
        senderId: myId,
        receiverId,
        type: "TYPING",
      }),
    );
  }

  function queryOnlineStatus(userIdsToCheck: string[]) {
    if (!myId || userIdsToCheck.length === 0) return;

    socketRef.current?.send(
      JSON.stringify({
        type: "GET_ONLINE_STATUS",
        userIds: userIdsToCheck,
      }),
    );
  }

  return (
    <SocketContext.Provider
      value={{
        myId,
        messages,
        connectionLost,
        failedCount,
        otherTyping,
        instantHideTyping,
        setInstantHideTyping,
        sendMessage,
        sendTyping,
        queryOnlineStatus,
        onlineUUIDs,
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
