"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/lib/actions";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export function PinPad() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function press(key: string) {
    if (pending) return;
    setError(null);
    if (key === "⌫") {
      setPin((current) => current.slice(0, -1));
      return;
    }
    if (!key) return;
    const next = (pin + key).slice(0, 4);
    setPin(next);
    if (next.length < 4) return;
    startTransition(async () => {
      const result = await loginAction(next);
      if (result?.error) {
        setPin("");
        setError(result.error);
      }
    });
  }

  return (
    <div className="pin-pad">
      <div className="pin-dots" aria-label="Κωδικός">
        {[0, 1, 2, 3].map((index) => (
          <i key={index} className={index < pin.length ? "on" : ""} />
        ))}
      </div>
      {error ? <p className="banner banner-danger">{error}</p> : null}
      <div className="pin-keys">
        {keys.map((key) =>
          key === "" ? (
            <span key="gap" />
          ) : (
            <button key={key} type="button" onClick={() => press(key)} disabled={pending}>
              {key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
