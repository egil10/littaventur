"use client";

import { useEffect, useState } from "react";
import { useBooks } from "@/lib/useBooks";
import { type ModeKey } from "@/lib/books";
import Quiz from "@/components/Quiz";
import CategoryPicker from "@/components/CategoryPicker";
import ModePicker from "@/components/ModePicker";

const CAT_KEY = "litt.category.v1";
const MODE_KEY = "litt.mode.v1";

export default function Home() {
  const { books, error } = useBooks();
  const [category, setCategory] = useState("");
  const [mode, setMode] = useState<ModeKey>("author");
  const [catOpen, setCatOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);

  // restore persisted selection after mount
  useEffect(() => {
    const c = localStorage.getItem(CAT_KEY);
    const m = localStorage.getItem(MODE_KEY) as ModeKey | null;
    if (c != null) setCategory(c);
    if (m) setMode(m);
  }, []);

  if (error) {
    return (
      <main className="grid place-items-center min-h-dvh p-8 text-center">
        <div>
          <h1 className="text-xl font-bold">Kunne ikke laste bøkene</h1>
          <p className="text-ink-muted mt-2">{error}</p>
        </div>
      </main>
    );
  }

  if (!books) {
    return (
      <main className="grid place-items-center min-h-dvh">
        <div className="animate-fade-in text-ink-muted">Laster biblioteket …</div>
      </main>
    );
  }

  return (
    <main>
      <Quiz
        books={books}
        category={category}
        mode={mode}
        onOpenCategory={() => setCatOpen(true)}
        onOpenMode={() => setModeOpen(true)}
      />

      {catOpen && (
        <CategoryPicker
          books={books}
          current={category}
          onPick={(k) => {
            setCategory(k);
            localStorage.setItem(CAT_KEY, k);
            setCatOpen(false);
          }}
          onClose={() => setCatOpen(false)}
        />
      )}
      {modeOpen && (
        <ModePicker
          books={books}
          current={mode}
          onPick={(k) => {
            setMode(k);
            localStorage.setItem(MODE_KEY, k);
            setModeOpen(false);
          }}
          onClose={() => setModeOpen(false)}
        />
      )}
    </main>
  );
}
