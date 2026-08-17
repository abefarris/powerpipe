import { parseTargetPassRate, passRateDisplayType } from "./index";
import { CheckSeveritySummary, CheckSummary } from "./index";

describe("parseTargetPassRate", () => {
  // These cases mirror TestParseTargetPassRate in
  // internal/controlexecute/result_group_test.go. The two parsers must agree:
  // the Go side decides the CLI verdict and the exit code, this side decides
  // what the page says, and a disagreement shows as a green card over a
  // failing build. A case added to one belongs in the other.
  const cases: [string | undefined, number | undefined][] = [
    ["95", 95],
    ["99.5", 99.5],
    ["95%", 95],
    ["  95  ", 95],
    [" 95 % ", 95],
    ["0", 0],
    ["100", 100],
    ["", undefined],
    ["   ", undefined],
    ["abc", undefined],
    ["-5", undefined],
    ["150", undefined],
    ["95x", undefined],
    [undefined, undefined],
  ];

  test.each(cases)("parseTargetPassRate(%p) -> %p", (input, expected) => {
    expect(parseTargetPassRate(input)).toBe(expected);
  });
});

describe("passRateDisplayType", () => {
  const summary = (partial: Partial<CheckSummary>): CheckSummary => ({
    alarm: 0,
    ok: 0,
    info: 0,
    skip: 0,
    error: 0,
    ...partial,
  });

  const noSeverity: CheckSeveritySummary = {};

  it("is ok when nothing failed", () => {
    expect(passRateDisplayType(summary({ ok: 5 }), noSeverity)).toBe("ok");
  });

  it("is ok when only skips exist", () => {
    expect(passRateDisplayType(summary({ skip: 5 }), noSeverity)).toBe("ok");
  });

  it("is severity for failures with nothing critical or high", () => {
    expect(passRateDisplayType(summary({ ok: 5, alarm: 1 }), noSeverity)).toBe(
      "severity",
    );
    expect(
      passRateDisplayType(summary({ ok: 5, alarm: 1 }), { medium: 1, low: 2 }),
    ).toBe("severity");
  });

  it("is alert when a critical is failing", () => {
    expect(
      passRateDisplayType(summary({ ok: 5, alarm: 1 }), { critical: 1 }),
    ).toBe("alert");
  });

  it("is alert when a high is failing", () => {
    expect(passRateDisplayType(summary({ ok: 5, alarm: 1 }), { high: 1 })).toBe(
      "alert",
    );
  });

  it("is severity when critical exists but is not failing", () => {
    // severity_summary counts ALARMING results by severity; a present-but-zero
    // entry means the critical control exists and passes
    expect(
      passRateDisplayType(summary({ ok: 5, alarm: 1 }), { critical: 0 }),
    ).toBe("severity");
  });

  it("is alert on any error, even with no severity declared", () => {
    // an error is a check that could not run - louder than a graded failure
    expect(passRateDisplayType(summary({ ok: 5, error: 1 }), noSeverity)).toBe(
      "alert",
    );
  });

  it("errors outrank severity grading", () => {
    expect(
      passRateDisplayType(summary({ ok: 5, alarm: 1, error: 1 }), {
        medium: 1,
      }),
    ).toBe("alert");
  });
});
