// live regional map countLabels order and colours, with an added Other category
export const religionCategories = Object.freeze([
  { key: "christian", label: "Christian", color: "#e11d48" },
  { key: "muslim", label: "Muslim", color: "#16a34a" },
  { key: "hindu", label: "Hindu", color: "#f97316" },
  { key: "buddhist", label: "Buddhist", color: "#facc15" },
  { key: "jewish", label: "Jewish", color: "#2563eb" },
  { key: "sikh", label: "Sikh", color: "#7c3aed" },
  { key: "shinto", label: "Shinto", color: "#ec4899" },
  { key: "taoist", label: "Taoist", color: "#06b6d4" },
  { key: "unknown", label: "Unknown", color: "#9ca3af" },
  { key: "other", label: "Other", color: "#64748b" }
].map(Object.freeze));

const keys = new Set(religionCategories.map(({ key }) => key));

export function categoriseReligion(religion) {
  if (religion == null) return "unknown";
  const key = String(religion).trim().toLowerCase();
  if (key === "") return "unknown";
  return keys.has(key) ? key : "other";
}
