"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page">
      <h1>Κάτι πήγε στραβά</h1>
      <p className="banner banner-danger">{error.message}</p>
      <button className="primary" type="button" onClick={reset}>
        Ξανά
      </button>
    </main>
  );
}
