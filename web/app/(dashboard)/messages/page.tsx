"use client";

import clsx from "clsx";
import { SubmitEvent, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, useSocket } from "@/providers/SocketProvider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import React from "react";
import { getUid } from "@/lib/auth";

export default function Page() {
  const socket = useSocket();

  const [allConversations, setAllConversations] = useState<
    { id: string; lastMessageId: string; name: string; createdAt: string }[]
  >([]);
  const [openConversation, setOpenConversation] = useState<{
    id: string;
    lastMessageId: string;
    name: string;
    createdAt: string;
  } | null>(null);

  useEffect(() => {
    async function fetchConversations() {
      const response = await fetch(
        `http://${window.location.hostname}:8080/api/conversation`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getUid()}`,
          },
        },
      );

      if (!response.ok) {
        setAllConversations([]);
        return;
      }

      const output = await response.json();
      console.log("CONVOS:", output);
      setAllConversations(output);
    }

    fetchConversations();

    const cleanup = socket.onConversationCreated((data) => {
      setAllConversations((prev) => [data, ...prev]);
    });

    return cleanup;
  }, [socket]);

  // useEffect(() => {
  //   const previouslyMessaged: string[] = JSON.parse(
  //     sessionStorage.getItem("previouslyMessaged") || "[]",
  //   );
  //   if (!previouslyMessaged.includes(receiverId)) {
  //     previouslyMessaged.push(receiverId);
  //     sessionStorage.setItem(
  //       "previouslyMessaged",
  //       JSON.stringify(previouslyMessaged),
  //     );
  //   }

  //   // eslint-disable-next-line react-hooks/set-state-in-effect
  //   setPreviouslyMessaged(previouslyMessaged);
  // }, [receiverId]);

  // useEffect(() => {
  //   const uid = getUid();
  //   if (!uid) return;

  //   const cleanup = socket.onMessage((message) => {
  //     if (message.senderId === receiverId || message.senderId === uid) {
  //       setMessages((prev) => [...prev, message]);
  //     }
  //     if (
  //       uid !== message.senderId &&
  //       !previousMessaged.includes(message.senderId)
  //     ) {
  //       setPreviouslyMessaged((prev) => [...prev, message.senderId]);
  //       sessionStorage.setItem(
  //         "previouslyMessaged",
  //         JSON.stringify(previousMessaged),
  //       );
  //     }
  //   });

  //   return cleanup;
  // }, [previousMessaged]);

  // useEffect(() => {

  //   const uid = getUid();
  //   if (!uid || !openConversationId) return;

  //   fetchMessages(uid, openConversationId);

  //   const cleanup = socket.onOpen(() => {
  //     fetchMessages(uid, openConversationId);
  //     socket.queryOnlineStatus([openConversationId]);
  //   });

  //   return cleanup;
  // }, []);

  // useEffect(() => {
  //   if (!forceScrollAfterFetchRef.current) return;

  //   requestAnimationFrame(() => {
  //     scrollRef.current?.scrollTo({
  //       top: scrollRef.current.scrollHeight,
  //     });

  //     forceScrollAfterFetchRef.current = false;
  //   });
  // }, [messages]);

  // useEffect(() => {
  //   const uid = getUid();
  //   if (!uid || !openConversationId) return;
  //   socket.queryOnlineStatus([openConversationId]);

  //   const requeryUserStatus = setInterval(() => {
  //     socket.queryOnlineStatus([receiverId]);
  //   }, 5000);

  //   return () => clearInterval(requeryUserStatus);
  // }, []);

  // useEffect(() => {
  //   const lastMessage = messages.at(-1);

  //   if (!lastMessage || !scrollRef.current) return;

  //   const el = scrollRef.current;

  //   const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

  //   const isNearBottom = distanceFromBottom < 250;

  //   if (lastMessage.senderId === getUid() || isNearBottom) {
  //     el.scrollTo({
  //       top: el.scrollHeight,
  //     });
  //   }
  // }, [messages]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {socket.connectionLost && (
        <div className="bg-red-800 border border-red-800 text-center text-neutral-100 p-1 rounded-md">
          Connection lost. Retrying... ({socket.failedCount} attempts)
        </div>
      )}

      {allConversations.map((conversation) => {
        return <div key={conversation.id}>{conversation.name}</div>;
      })}

      {allConversations.length > 0 && (
        <MessagePanel
          conversation={
            allConversations.find(
              (conversation) =>
                conversation.id === "660e8400-e29b-41d4-a716-446655440000",
            )!
          }
        />
      )}
    </div>
  );
}

function MessagePanel({
  conversation,
}: {
  conversation: {
    id: string;
    lastMessageId: string;
    name: string;
    createdAt: string;
  };
}) {
  const conversationId = conversation.id;

  const socket = useSocket();
  const scrollRef = useRef<HTMLDivElement>(null);
  const forceScrollAfterFetchRef = useRef(false);

  const [uid, setUid] = useState<string | null>(null);
  const [conversationMembers, setConversationMembers] = useState<
    { id: string; name: string; lastReadAt: string }[]
  >([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [onlineUids, setOnlineUids] = useState<string[]>([]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!forceScrollAfterFetchRef.current) return;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
      });

      forceScrollAfterFetchRef.current = false;
    });
  }, [messages, conversationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUid(getUid());
  }, []);

  function parseMessageDate(createdAt: string) {
    const hasTimezone = /Z|[+-]\d{2}:\d{2}$/.test(createdAt);

    return new Date(hasTimezone ? createdAt : `${createdAt}Z`);
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();

    if (!content.trim()) return;

    socket.sendMessage(conversationId, content);
    setContent("");
  }

  useEffect(() => {
    if (!uid) return;

    async function getConversationMembers() {
      const response = await fetch(
        `http://${window.location.hostname}:8080/api/conversation/${conversationId}/members`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${uid}`,
          },
        },
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setConversationMembers(data);
    }

    async function fetchMessages() {
      const response = await fetch(
        `http://${window.location.hostname}:8080/api/conversation/${conversationId}/messages`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getUid()}`,
          },
        },
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

    getConversationMembers();
    fetchMessages();

    const cleanupSocket3 = socket.onMessage((message: ChatMessage) => {
      if (message.conversationId !== conversationId) return;
      setMessages((prev) => [...prev, message]);
    });

    const cleanupSocket2 = socket.onOpen(() => {
      getConversationMembers();
      fetchMessages();
    });

    const cleanupSocket = socket.onOnlineStatus(
      ({
        statuses,
        conversationId: responseConversationId,
      }: {
        statuses: { userId: string; online: boolean }[];
        conversationId: string;
      }) => {
        if (responseConversationId !== conversationId) return;

        const trueOnlienUids = statuses
          .filter((status) => status.online)
          .map((status) => status.userId);
        setOnlineUids(trueOnlienUids);
      },
    );

    return () => {
      cleanupSocket();
      cleanupSocket2();
      cleanupSocket3();
    };
  }, [conversationId, socket, uid]);

  useEffect(() => {
    socket.queryOnlineStatus(conversationId);

    const requeryUserStatus = setInterval(() => {
      socket.queryOnlineStatus(conversationId);
    }, 2500);

    return () => {
      clearInterval(requeryUserStatus);
    };
  }, [conversationId, conversationMembers, socket]);

  useEffect(() => {
    const lastMessage = messages.at(-1);

    if (!lastMessage || !scrollRef.current) return;

    const el = scrollRef.current;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    const isNearBottom = distanceFromBottom < 250;

    if (lastMessage.senderId === getUid() || isNearBottom) {
      el.scrollTo({
        top: el.scrollHeight,
      });
    }
  }, [messages]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const old = params.get("conversationId");
    if (old === conversationId) return;
    params.set("conversationId", conversationId);
    router.replace(`${pathname}?${params.toString()}`);
  }, [conversationId, pathname, router, searchParams]);

  if (!uid) return;
  return (
    <div className="flex gap-2 min-h-0">
      <div className="max-w-3xl w-full mx-auto flex flex-col flex-1 min-h-0 py-20">
        <div className="bg-black p-4 text-white rounded-lg">
          {conversation.name}
        </div>
        <div className="mr-2 ml-auto">
          {onlineUids &&
            conversationMembers.map((member) => (
              <div key={member.id} className="flex gap-1 items-center">
                <div
                  className={clsx("w-4 h-4 rounded-full", {
                    "bg-green-500": onlineUids.includes(member.id),
                    "bg-red-500": !onlineUids.includes(member.id),
                  })}
                />
                <p>{member.id === uid ? "You" : member.name}</p>
              </div>
            ))}
          {/* {onlineUUIDs.map((item) => {
            return <p key={item.receiverId}>{item.receiverId}</p>;
          })} */}
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 p-2 overflow-y-scroll">
          <div className="min-h-full flex flex-col justify-end space-y-px">
            {messages.length === 0 && (
              <p className="text-sm text-neutral-500 text-center">
                Start the conversation by sending a message.
              </p>
            )}
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

              const isMine = message.senderId === uid;

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
                          {
                            conversationMembers.find(
                              (member) => member.id === message.senderId,
                            )?.name
                          }
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
                          "mb-2": isLastInGroup,
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

        {!false && (
          <AnimatePresence>
            {false && (
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
                  {conversationId} is typing...
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
