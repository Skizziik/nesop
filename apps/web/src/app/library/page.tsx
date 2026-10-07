import { Suspense } from "react";
import { Library } from "@/components/library";

export default function LibraryPage() {
  return (
    <Suspense>
      <Library />
    </Suspense>
  );
}
