// Small "STAGING" pill shown only in the staging build, so it's never mistaken for prod.
export const STAGING = import.meta.env.MODE === "staging";

export default function StagingTag({ class: cls = "" }: { class?: string }) {
  if (!STAGING) return null;
  return (
    <span class={"rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white align-middle " + cls}>
      STAGING
    </span>
  );
}
