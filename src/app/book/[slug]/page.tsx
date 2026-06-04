"use client";

import { use } from "react";
import { BookingPage } from "@/app/book/page";

export default function BookSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <BookingPage initialSlug={slug} />;
}
