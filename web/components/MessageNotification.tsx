"use client";

import { getUid } from "@/lib/auth";
import { ChatMessage, useSocket } from "@/providers/SocketProvider";
import { usePathname, useSearchParams } from "next/navigation";
import { RefObject, useEffect, useRef } from "react";
import { toast, Toaster } from "sonner";

function MessageToast({ message }: { message: ChatMessage }) {
  return (
    <div className="w-60 border border-neutral-300 bg-neutral-200 shadow-lg rounded-md px-5 py-3">
      <p className="text-sm">{message.senderId}</p>
      <p className="text-neutral-600 text-sm line-clamp-2">{message.content}</p>
    </div>
  );
}

let mainAudioBuffer: AudioBuffer | null = null;

async function playNotificationSound(
  audioCtxRef: RefObject<AudioContext | null>,
) {
  if (!audioCtxRef.current) return;

  if (!mainAudioBuffer) {
    const response = await fetch("/notification.wav", {
      cache: "force-cache",
    });

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);

    mainAudioBuffer = audioBuffer;
  }

  const source = audioCtxRef.current.createBufferSource();
  if (!source || !mainAudioBuffer) return;

  const gainNode = audioCtxRef.current.createGain();
  gainNode.gain.value = 0.25;

  source.buffer = mainAudioBuffer;
  source.connect(gainNode);
  gainNode.connect(audioCtxRef.current.destination);
  source.start(0);
}

export default function MessageNotification() {
  const uid = getUid();
  const audioCtxRef = useRef<AudioContext | null>(null);

  const socket = useSocket();

  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    audioCtxRef.current = new window.AudioContext();
  }, []);

  useEffect(() => {
    const cleanup = socket.onMessage((item) => {
      const conversationId = searchParams.get("conversationId");

      const isViewingConversation =
        pathname === "/messages" && conversationId === item.conversationId;

      if (item.senderId === uid || isViewingConversation) return;

      playNotificationSound(audioCtxRef);

      toast.custom(() => <MessageToast message={item} />, {
        duration: 5000,
        id: item.id,
      });
    });

    return cleanup;
  }, [uid, pathname, searchParams, socket]);

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        unstyled: true,
      }}
    />
  );
}
