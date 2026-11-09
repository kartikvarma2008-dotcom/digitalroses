import { RoseField } from "@/components/RoseField";

export default function Page() {
  return (
    <main className="stage">
      <RoseField />
      <div className="vignette" aria-hidden="true" />
    </main>
  );
}
