import { expect, describeSuite, beforeAll } from "@moonwall/cli";

describeSuite({
  id: "U01",
  title: "This is a test suite that tests the update snapshot feature",
  foundationMethods: "read_only",
  testCases: ({ it, log }) => {
    let random: number

    beforeAll(() => {
      random = Math.floor(Math.random() * 100);
      log(`The random number is ${random}`);
    });

    it({
      id: "T01",
      title: "In-line snapshot",
      test: () => {
        // biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
        expect(random).toMatchInlineSnapshot(`43`);
      },
    });

    it({
      id: "T02",
      title: "Normal snapshot",
      test: () => {
        expect(random).toMatchSnapshot();
      },
    });

    it({
      id: "T03",
      title: "File snapshot",
      test: () => {
        expect(random).toMatchFileSnapshot("./timbo.txt");
      },
    });
  },
});
