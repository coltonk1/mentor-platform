"use client";

import { ChatMessage, useSocket } from "@/providers/SocketProvider";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast, Toaster } from "sonner";

function MessageToast({ message }: { message: ChatMessage }) {
  return (
    <div className="w-60 border border-neutral-300 bg-neutral-200 shadow-lg rounded-md px-5 py-3">
      <p className="text-sm">{message.senderId}</p>
      <p className="text-neutral-600 text-sm line-clamp-2">{message.content}</p>
    </div>
  );
}

export default function MessageNotification() {
  const { onMessage, myId } = useSocket();

  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const cleanup = onMessage((item) => {
      const receiverId = searchParams.get("receiverId");

      const isViewingConversation =
        pathname === "/messages" && receiverId === item.senderId;

      if (item.senderId === myId || isViewingConversation) return;

      toast.custom(() => <MessageToast message={item} />, {
        duration: 5000,
        id: item.id,
      });
    });

    return cleanup;
  }, [myId, pathname, searchParams]);

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        unstyled: true,
      }}
    />
  );
}
