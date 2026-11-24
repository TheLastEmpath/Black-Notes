"use client";

import { useRef } from "react";

/** Enter sends, Shift+Enter adds a line. Clears itself after sending. */
export function Composer({
  action,
  placeholder,
  button,
}: {
  action: (formData: FormData) => void | Promise<void>;
  placeholder: string;
  button: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      action={async (fd) => {
        await action(fd);
        form.current?.reset();
      }}
      className="grid gap-2"
    >
      <textarea
        name="body"
        required
        rows={2}
        maxLength={4000}
        placeholder={placeholder}
        className="field"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            form.current?.requestSubmit();
          }
        }}
      />
      <div>
        <button className="btn">{button}</button>
      </div>
    </form>
  );
}
