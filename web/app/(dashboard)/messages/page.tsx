"use client";

import clsx from "clsx";
import { SubmitEvent, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "@/providers/SocketProvider";

export default function Page() {
  const {
    myId,
    messages,
    connectionLost,
    failedCount,
    otherTyping,
    sendMessage,
    sendTyping,
    queryOnlineStatus,
    onlineUUIDs,
    instantHideTyping,
    setInstantHideTyping,
  } = useSocket();

  const [receiverId, setReceiverId] = useState("");
  const [content, setContent] = useState("");

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();

    if (!content.trim()) return;

    sendMessage(receiverId, content);
    setContent("");
  }

  useEffect(() => {
    const requeryUserStatus = setInterval(() => {
      queryOnlineStatus([receiverId]);
    }, 10000);

    return () => clearInterval(requeryUserStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiverId]);

  useEffect(() => {
    queryOnlineStatus([receiverId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiverId]);

  const onlineUsers = new Map(
    onlineUUIDs.map((user) => [user.receiverId, user.online]),
  );
  console.log(onlineUsers);

  return (
    <div className="max-w-3xl w-full mx-auto flex flex-col flex-1 py-20">
      {connectionLost && (
        <div className="bg-red-800 border border-red-800 text-center text-neutral-100 p-1 rounded-md">
          Connection lost. Retrying... ({failedCount} attempts)
        </div>
      )}

      <p className="text-sm text-neutral-500">Your ID</p>
      <p className="font-mono break-all">{myId}</p>
      {onlineUsers && (
        <div
          className={clsx("w-4 h-4 rounded-full", {
            "bg-green-500": onlineUsers.get(receiverId),
            "bg-red-500": !onlineUsers.get(receiverId),
          })}
        />
      )}

      <div className="space-y-3 flex-1 flex flex-col justify-end p-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={clsx(
              {
                "mr-0 ml-auto": message.senderId === myId,
              },
              "w-fit",
            )}
          >
            <div
              className={clsx({
                "text-right": message.senderId === myId,
              })}
            >
              <p className="text-xs text-neutral-500 mb-px">
                {message.senderId}
              </p>
            </div>

            <div
              className={clsx(
                {
                  "bg-blue-600 text-neutral-200 rounded-br-none mr-0 ml-auto":
                    message.senderId === myId,
                  "bg-neutral-300 text-neutral-900 rounded-bl-none":
                    message.senderId !== myId,
                },
                "rounded-md px-4 py-2 max-w-xl w-fit",
              )}
            >
              <p>{message.content}</p>
            </div>
          </div>
        ))}
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
        <input
          value={receiverId}
          onChange={(e) => setReceiverId(e.target.value)}
          placeholder="Receiver ID"
          className="border rounded-md px-3 py-2"
        />

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
  );
}
