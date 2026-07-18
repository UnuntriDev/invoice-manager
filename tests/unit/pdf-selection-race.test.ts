import { createLatestTaskGuard } from "@/lib/pdf/latest-task-guard";

it("ignores a late PDF A result after PDF B was selected", async () => {
  const guard = createLatestTaskGuard();
  const applied: string[] = [];
  let resolveA!: (value: string) => void;
  let resolveB!: (value: string) => void;
  const pdfA = new Promise<string>((resolve) => {
    resolveA = resolve;
  });
  const pdfB = new Promise<string>((resolve) => {
    resolveB = resolve;
  });

  async function extract(result: Promise<string>) {
    const token = guard.begin();
    const value = await result;
    if (guard.isCurrent(token)) applied.push(value);
  }

  const taskA = extract(pdfA);
  const taskB = extract(pdfB);
  resolveB("PDF B");
  await taskB;
  resolveA("PDF A");
  await taskA;

  expect(applied).toEqual(["PDF B"]);
});
