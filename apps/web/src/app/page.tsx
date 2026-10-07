import { GenerateCard, Queue, RecentReady, ServiceStatus, Spend } from "@/components/home";

export default function HomePage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <h1 className="font-display text-3xl font-bold">Ciao! 👋</h1>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <GenerateCard />
        <ServiceStatus />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Queue />
        <Spend />
      </div>
      <RecentReady />
    </div>
  );
}
