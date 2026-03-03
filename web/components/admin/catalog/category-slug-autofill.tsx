"use client";

import { useRef, useState } from "react";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type Props = {
  defaultName?: string;
  defaultSlug?: string;
};

export function CategorySlugAutoFill({ defaultName = "", defaultSlug = "" }: Props) {
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState(defaultSlug);
  const slugManuallyEdited = useRef(!!defaultSlug);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setName(value);
    if (!slugManuallyEdited.current) {
      setSlug(generateSlug(value));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    slugManuallyEdited.current = true;
    setSlug(e.target.value);
  }

  return (
    <>
      <label className="space-y-1 text-sm">
        <span>Name</span>
        <input
          name="name"
          required
          value={name}
          onChange={handleNameChange}
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
        />
      </label>
      <label className="space-y-1 text-sm">
        <span>Slug</span>
        <input
          name="slug"
          required
          placeholder="home-accessories"
          value={slug}
          onChange={handleSlugChange}
          className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
        />
      </label>
    </>
  );
}
