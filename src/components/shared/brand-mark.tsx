"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ALEPH_VET_AUTH_LOGO_SRC,
  ALEPH_VET_SIDEBAR_LOGO_SRC,
  ALEPH_VET_STAFF_LOGO_SRC,
  ALEPH_VET_STAFF_WORDMARK,
} from "@/lib/brand";

type BrandMarkVariant = "header" | "sidebar" | "drawer" | "auth";

const variantClass: Record<BrandMarkVariant, string> = {
  header: "h-7 max-h-7 max-w-[10rem] object-left sm:max-w-[11rem]",
  sidebar: "h-9 max-h-9 max-w-[11.5rem] object-left",
  drawer: "h-10 max-h-10 max-w-[12rem] object-left",
  auth: "mx-auto h-12 max-h-12 max-w-[14rem] object-center sm:h-14 sm:max-h-14",
};

type BrandMarkProps = {
  variant: BrandMarkVariant;
  className?: string;
};

/**
 * `public/alephvet-03.png` (sidebar); `public/alephvet-09.png` (header, drawer);
 * `public/alephvet_Mesa de trabajo 1.png` (auth / login).
 * Falls back to two-tone wordmark if the image fails to load.
 */
export function BrandMark({ variant, className }: BrandMarkProps) {
  const [useFallback, setUseFallback] = useState(false);
  const src =
    variant === "sidebar"
      ? ALEPH_VET_SIDEBAR_LOGO_SRC
      : variant === "auth"
        ? ALEPH_VET_AUTH_LOGO_SRC
        : ALEPH_VET_STAFF_LOGO_SRC;

  if (useFallback) {
    return (
      <span
        className={cn(
          "text-brand-navy-800 inline-block font-semibold tracking-tight",
          variant === "header" && "text-sm",
          variant === "sidebar" && "text-base",
          variant === "drawer" && "text-lg",
          variant === "auth" && "text-xl sm:text-2xl",
          className,
        )}
      >
        Aleph <span className="text-brand-cyan-600">Vet</span> Staff
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local public asset; avoids build-time image size requirements
    <img
      src={src}
      alt={ALEPH_VET_STAFF_WORDMARK}
      className={cn("w-auto object-contain", variantClass[variant], className)}
      onError={() => setUseFallback(true)}
    />
  );
}
