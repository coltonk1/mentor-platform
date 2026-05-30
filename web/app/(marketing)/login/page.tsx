"use client";

import { setUid } from "@/lib/auth";

// TEMPORARY LOGIN PAGE

export default function Page() {
  return (
    <div className="max-w-3xl mx-auto">
      <h2>Choose user</h2>
      {/* John */}
      <PickUser uuid={"550e8400-e29b-41d4-a716-446655440000"} />
      {/* Jane */}
      <PickUser uuid={"550e8400-e29b-41d4-a716-446655440001"} />
    </div>
  );
}

function PickUser({ uuid }: { uuid: string }) {
  return (
    <div
      onClick={() => {
        setUid(uuid);
      }}
      className="p-2 rounded bg-neutral-300 mt-2 cursor-pointer hover:bg-neutral-400"
    >
      {uuid}
    </div>
  );
}
