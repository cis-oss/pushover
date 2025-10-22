import Pushover from "../src";

test("Pushover is exported", () => {
  expect(Pushover).toBeDefined();
  expect(Pushover).toBeInstanceOf(Object);
});

test("Pushover has expected functions", () => {
  expect(Pushover).toHaveProperty("prototype.constructor");
  expect(Pushover).toHaveProperty("prototype.send");
});
