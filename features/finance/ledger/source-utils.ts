export { money } from "./rules";
export function snapshotNever(message: string): never {
  throw new Error(message);
}
