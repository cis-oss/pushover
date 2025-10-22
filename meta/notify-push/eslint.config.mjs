import repoConfig from "@repo/configs/eslint";

export default [
  ...repoConfig,
  { ignores: ["dist/**", "docs/**"] },
  { files: ["**/*.{ts}"] },
];