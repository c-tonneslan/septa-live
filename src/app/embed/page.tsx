import EmbedMap from "@/components/EmbedMap";

export const metadata = {
  title: "SEPTA Live · embed",
  description: "Embeddable live SEPTA map.",
};

// Chromeless map for iframe embedding. /embed shows everything; /embed?lines=PAO
// limits to one or more lines (comma-separated).
export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ lines?: string }>;
}) {
  const { lines } = await searchParams;
  const filter = lines
    ? lines.split(",").map((s) => s.trim()).filter(Boolean)
    : null;
  return <EmbedMap lineFilter={filter} />;
}
