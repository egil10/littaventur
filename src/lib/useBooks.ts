"use client";

import { useEffect, useState } from "react";
import type { Book } from "./books";

// Bump to bust the browser cache when public/books.json is regenerated.
const DATA_VERSION = "1";

let cache: Book[] | null = null; // module-level in-memory cache

export function useBooks() {
  const [books, setBooks] = useState<Book[] | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) {
      setBooks(cache);
      return;
    }
    let alive = true;
    fetch(`/books.json?v=${DATA_VERSION}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Book[]) => {
        cache = data;
        if (alive) setBooks(data);
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  return { books, error };
}
