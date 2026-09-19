export type Request = {
  id: string;
  kind: "nomination" | "assistance";
  label: string;
  question: string;
  context: string;
  createdAt: string;
};

export type RequestInput = Omit<Request, "id" | "createdAt">;

export function savePreview(
  requests: Request[],
  input: RequestInput,
  createId: () => string = () => crypto.randomUUID(),
): { request: Request; requests: Request[] } {
  const prior = requests.find(r => r.kind === input.kind && r.label === input.label && r.question === input.question && r.context === input.context);
  // retries return their stable receipt even when new requests are at capacity.
  if (prior) return { request: prior, requests };
  if (requests.length >= 100) throw new Error("This demo has reached its local request limit. Start a new tab to continue.");
  const request: Request = { ...input, id: createId(), createdAt: new Date().toISOString() };
  return { request, requests: [request, ...requests] };
}
