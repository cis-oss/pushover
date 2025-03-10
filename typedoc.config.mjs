// @ts-nocheck
/** @type {import("typedoc").TypeDocOptions &
 * import("typedoc-plugin-extras").ExtrasOptions &
 * import("typedoc-plugin-coverage").CoverageOptions &
 * import("typedoc-plugin-mdn-links").MdnLinksOptions &
 * import("typedoc-plugin-zod").ZodOptions} */
const config = {
  compilerOptions: {
    skipLibCheck: true,
    strict: false,
  },
  entryPoints: ["src/index.ts"],
  out: "docs",
  plugin: [
    "typedoc-plugin-coverage",
    "typedoc-plugin-extras",
    "typedoc-plugin-inline-sources",
    "typedoc-plugin-mdn-links",
    "typedoc-plugin-zod",
    "typedoc-plugin-include-example",
    "@shipgirl/typedoc-plugin-versions",
  ],
  footerTypedocVersion: true,
  footerLastModified: true,
  coverageLabel: "Docs Coverage",
  coverageOutputType: "all",
  coverageSvgWidth: 130,
};

export default config;
