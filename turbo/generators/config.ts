import type { PlopTypes } from "@turbo/gen";

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  // create a generator
  plop.setGenerator("package", {
    description: "Generator description",
    // gather information from the user
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Package name",
      },
      {
        type: "input",
        name: "description",
        message: "Package description",
      },
      {
        type: "input",
        name: "author.name",
        message: "Author name",
      },
      {
        type: "input",
        name: "author.email",
        message: "Author email",
      },
      {
        type: "input",
        name: "author.url",
        message: "Author URL",
      },
    ],
    // perform actions based on the prompts
    actions: [
      {
        type: "addMany",
        destination: "packages/{{name}}",
        base: "templates/package",
        templateFiles: "templates/package/**/*",
        abortOnFail: true,
      },
    ],
  });
}
