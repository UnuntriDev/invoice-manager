import { QueryClient } from "@tanstack/react-query";
import { invalidateDocumentViews } from "@/lib/hooks/use-documents";

it("invalidates registry and buffer after related dictionary mutations", () => {
  const queryClient = new QueryClient();
  const invalidate = jest
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue(undefined);

  invalidateDocumentViews(queryClient);

  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["documents"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["buffer"] });
});
