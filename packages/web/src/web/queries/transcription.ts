import { useMutation } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useTranscribeChunk() {
  return useMutation(orpc.transcription.chunk.mutationOptions());
}
