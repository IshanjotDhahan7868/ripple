import { Suspense } from "react";
import { StockView } from "@/components/stock";

export default function Page() {
  return (
    <Suspense>
      <StockView />
    </Suspense>
  );
}
