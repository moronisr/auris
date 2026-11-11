"use client";
import { useRouter } from "next/navigation";

export default function SeletorData({ data }: { data: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      aria-label="Data dos atendimentos"
      value={data}
      onChange={(e) => e.target.value && router.push(`/dia?data=${e.target.value}`)}
      style={{ width: "auto" }}
    />
  );
}
