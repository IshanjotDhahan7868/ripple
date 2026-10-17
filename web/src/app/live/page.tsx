import type { Metadata } from "next";
import { LiveTape } from "@/components/tape";

export const metadata: Metadata = {
  title: "Live tape · Ripple",
  description: "Every call Ripple's news robot has made, graded against the S&P 500 in public.",
};

export default function Page() {
  return <LiveTape />;
}
