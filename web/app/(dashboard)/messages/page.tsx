"use client";

import clsx from "clsx";
import { SubmitEvent, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, useSocket } from "@/providers/SocketProvider";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import React from "react";

export default function Page() {
  const {
    myId,
    connectionLost,
    failedCount,
    otherTyping,
    sendMessage,
    sendTyping,
    queryOnlineStatus,
    onlineUUIDs,
    instantHideTyping,
    setInstantHideTyping,
    onMessage,
    onOpen,
  } = useSocket();

  const [content, setContent] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [previousMessaged, setPreviouslyMessaged] = useState<string[]>([]);

  const searchParams = useSearchParams();
  const receiverId = searchParams.get("receiverId") || "NONE";
  const scrollRef = useRef<HTMLDivElement>(null);
  const forceScrollAfterFetchRef = useRef(false);

  useEffect(() => {
    const previouslyMessaged: string[] = JSON.parse(
      sessionStorage.getItem("previouslyMessaged") || "[]",
    );
    if (!previouslyMessaged.includes(receiverId)) {
      previouslyMessaged.push(receiverId);
      sessionStorage.setItem(
        "previouslyMessaged",
        JSON.stringify(previouslyMessaged),
      );
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviouslyMessaged(previouslyMessaged);
  }, [receiverId]);

  useEffect(() => {
    if (!myId) return;

    const cleanup = onMessage((message) => {
      if (message.senderId === receiverId || message.senderId === myId) {
        setMessages((prev) => [...prev, message]);
      }
      if (
        myId !== message.senderId &&
        !previousMessaged.includes(message.senderId)
      ) {
        setPreviouslyMessaged((prev) => [...prev, message.senderId]);
        sessionStorage.setItem(
          "previouslyMessaged",
          JSON.stringify(previousMessaged),
        );
      }
    });

    return cleanup;
  }, [myId, previousMessaged]);

  useEffect(() => {
    if (!myId) return;

    async function fetchMessages(id1: string, id2: string) {
      console.log("FETCHING");

      const params = new URLSearchParams();
      params.append("id1", id1);
      params.append("id2", id2);

      const response = await fetch(
        `http://${window.location.hostname}:8080/api/messages?${params}`,
        { method: "GET" },
      );

      if (!response.ok) {
        setMessages([]);
        return;
      }

      const output = await response.json();

      const messages: ChatMessage[] = output.map(
        (message: {
          id: string;
          senderId: string;
          receiverId: string;
          body: string;
          createdAt: string;
        }) => ({
          id: message.id,
          senderId: message.senderId,
          receiverId: message.receiverId,
          content: message.body,
          createdAt: message.createdAt,
        }),
      );

      forceScrollAfterFetchRef.current = true;

      console.log(output);
      setMessages(messages);
    }

    fetchMessages(myId, receiverId);

    const cleanup = onOpen(() => {
      fetchMessages(myId, receiverId);
      queryOnlineStatus([receiverId]);
    });

    return cleanup;
  }, [myId, receiverId]);

  useEffect(() => {
    if (!forceScrollAfterFetchRef.current) return;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
      });

      forceScrollAfterFetchRef.current = false;
    });
  }, [messages]);

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();

    if (!content.trim()) return;

    sendMessage(receiverId, content);
    setContent("");
  }

  useEffect(() => {
    if (!myId) return;
    queryOnlineStatus([receiverId]);

    const requeryUserStatus = setInterval(() => {
      queryOnlineStatus([receiverId]);
    }, 5000);

    return () => clearInterval(requeryUserStatus);
  }, [receiverId, myId]);

  const onlineUsers = new Map(
    onlineUUIDs.map((user) => [user.receiverId, user.online]),
  );

  useEffect(() => {
    const lastMessage = messages.at(-1);

    if (!lastMessage || !scrollRef.current) return;

    const el = scrollRef.current;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    const isNearBottom = distanceFromBottom < 250;

    if (lastMessage.senderId === myId || isNearBottom) {
      el.scrollTo({
        top: el.scrollHeight,
      });
    }
  }, [messages, myId]);

  function parseMessageDate(createdAt: string) {
    const hasTimezone = /Z|[+-]\d{2}:\d{2}$/.test(createdAt);

    return new Date(hasTimezone ? createdAt : `${createdAt}Z`);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex gap-2">
        {previousMessaged.map((item: string) => {
          return (
            <Link
              href={`/messages?receiverId=${item}`}
              className="px-2 bg-neutral-300 rounded-md text-neutral-700"
              key={item}
            >
              {item}
            </Link>
          );
        })}
      </div>
      <div className="max-w-3xl w-full mx-auto flex flex-col flex-1 min-h-0 py-20">
        {connectionLost && (
          <div className="bg-red-800 border border-red-800 text-center text-neutral-100 p-1 rounded-md">
            Connection lost. Retrying... ({failedCount} attempts)
          </div>
        )}

        <p className="text-sm text-neutral-500">Your ID</p>
        <p className="font-mono break-all">{myId}</p>
        <div className="flex items-center gap-1">
          {onlineUsers && (
            <div
              className={clsx("w-4 h-4 rounded-full", {
                "bg-green-500": onlineUsers.get(receiverId),
                "bg-red-500": !onlineUsers.get(receiverId),
              })}
            />
          )}
          {onlineUUIDs.map((item) => {
            return <p key={item.receiverId}>{item.receiverId}</p>;
          })}
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 p-2 overflow-y-scroll">
          <div className="min-h-full flex flex-col justify-end space-y-px">
            {messages.map((message, index) => {
              const previousMessage = messages[index - 1];
              const nextMessage = messages[index + 1];

              const messageDate = parseMessageDate(message.createdAt);
              const previousDate = previousMessage
                ? parseMessageDate(previousMessage.createdAt)
                : null;
              const nextDate = nextMessage
                ? parseMessageDate(nextMessage.createdAt)
                : null;

              const isMine = message.senderId === myId;

              const sameMinuteAsPrevious =
                previousDate &&
                previousDate.getFullYear() === messageDate.getFullYear() &&
                previousDate.getMonth() === messageDate.getMonth() &&
                previousDate.getDate() === messageDate.getDate() &&
                previousDate.getHours() === messageDate.getHours() &&
                previousDate.getMinutes() === messageDate.getMinutes();

              const sameMinuteAsNext =
                nextDate &&
                nextDate.getFullYear() === messageDate.getFullYear() &&
                nextDate.getMonth() === messageDate.getMonth() &&
                nextDate.getDate() === messageDate.getDate() &&
                nextDate.getHours() === messageDate.getHours() &&
                nextDate.getMinutes() === messageDate.getMinutes();

              const sameDayAsPrevious =
                previousDate &&
                previousDate.toDateString() === messageDate.toDateString();

              const previousIsSameUser =
                previousMessage?.senderId === message.senderId;

              const nextIsSameUser = nextMessage?.senderId === message.senderId;

              const showDate = !sameDayAsPrevious;
              const showTime = !sameMinuteAsPrevious;
              const showSender = !previousIsSameUser || showTime || showDate;

              const isFirstInGroup =
                !previousIsSameUser || showTime || showDate;
              const isLastInGroup = !nextIsSameUser || !sameMinuteAsNext;

              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <p className="text-xs text-neutral-500 text-center">
                      {messageDate.toLocaleDateString([], {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}

                  {showTime && (
                    <p className="text-xs text-neutral-500 mt-px text-center">
                      {messageDate.toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  )}

                  <div
                    className={clsx(
                      {
                        "mr-0 ml-auto": isMine,
                      },
                      "w-fit",
                    )}
                  >
                    {showSender && (
                      <div
                        className={clsx({
                          "text-right": isMine,
                        })}
                      >
                        <p className="text-xs text-neutral-500 mb-px">
                          {message.senderId}
                        </p>
                      </div>
                    )}

                    <div
                      className={clsx(
                        {
                          "bg-blue-600 text-neutral-200 mr-0 ml-auto": isMine,
                          "bg-neutral-300 text-neutral-900": !isMine,

                          "rounded-tr-none": isMine && !isFirstInGroup,
                          "rounded-br-none":
                            isMine && (!isLastInGroup || isFirstInGroup),

                          "rounded-tl-none": !isMine && !isFirstInGroup,
                          "rounded-bl-none":
                            !isMine && (!isLastInGroup || isFirstInGroup),
                        },
                        "rounded-md px-4 py-2 max-w-xl w-fit",
                      )}
                    >
                      <p>{message.content}</p>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {!instantHideTyping && (
          <AnimatePresence>
            {otherTyping && (
              <motion.div
                className="flex items-center gap-px"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { duration: 0.2, ease: "easeInOut" },
                }}
                exit={{
                  opacity: 0,
                  transition: {
                    duration: 2.5,
                    ease: "easeInOut",
                  },
                }}
              >
                <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-2 h-2 bg-neutral-600 rounded-full animate-bounce [animation-delay:300ms]" />
                <p className="text-sm ml-2 text-neutral-600">
                  {receiverId} is typing...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex">
            <input
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setInstantHideTyping(false);
                sendTyping(receiverId);
              }}
              placeholder="Message"
              className="border rounded-md px-3 py-2 flex-1"
            />

            <button
              type="submit"
              className="bg-black text-white rounded-md px-4 py-2"
            >
              SEND
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
