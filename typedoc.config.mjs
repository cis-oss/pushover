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
    "typedoc-github-theme",
  ],
  customFooterHtml: '<p class="tsd-generator" style="display: inline-flex; flex-direction: row; justify-content: space-around; width: 100%;"> <span> Made with ❤ by <a href="https://b00tload.space">Alix von Schirp</a> @ <a href="https://github.com/cis-oss">CISLabs OSS</a> </span> <span> <a href="https://github.com/cis-oss/pushover" target="_blank">GitHub</a> | <a href="https://github.com/cis-oss/pushover/issues" target="_blank">Issues</a> | <a href="https://github.com/cis-oss/pushover/blob/main/LICENSE" target="_blank">License</a> </span> <span>Generated using <a href="https://typedoc.org/" target="_blank">TypeDoc </a> with <a href="https://github.com/JulianWowra/typedoc-github-theme" target="_blank">typedoc-github-theme</a></span></p>',
  coverageOutputType: "json",
  hideGenerator: true,
};

export default config;
