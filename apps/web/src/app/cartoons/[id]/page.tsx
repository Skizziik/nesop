import { CartoonView } from "@/components/cartoons";

export default async function CartoonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CartoonView id={id} />;
}
