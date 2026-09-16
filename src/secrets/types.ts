export interface SecretProvider {
  get(name: string): string | undefined;
}
