"use client";

import { use } from "react";
import { MenuEditor } from "../menu-editor";

export function EditMenu({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);
  if (!Number.isInteger(id)) return <p className="py-10 text-ink/50">메뉴를 찾을 수 없습니다.</p>;
  return <MenuEditor key={id} itemId={id} />;
}
