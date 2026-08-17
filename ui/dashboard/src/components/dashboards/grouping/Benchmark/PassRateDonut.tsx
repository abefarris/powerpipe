import { classNames } from "@powerpipe/utils/styles";
import { getWrapperClasses } from "@powerpipe/utils/card";

// Geometry. The donut is drawn as a single stroked circle whose dash pattern is
// the arc, which keeps it to two SVG elements and needs no charting library -
// echarts is already a heavy part of this bundle and a two-slice ring does not
// justify mounting one per benchmark panel.
const SIZE = 104;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

export type PassRateDonutProps = {
  label: string;
  // undefined when nothing was evaluated - rendered as an empty ring and "-",
  // never as 0%, which would read as total failure rather than "not applicable".
  rate: number | undefined;
  displayType: "ok" | "alert" | "severity" | "skip";
  // the declared target, drawn as a notch on the ring. undefined when the
  // benchmark declares none.
  target: number | undefined;
  targetMet: boolean | undefined;
};

const arcColorClass = (displayType: string) => {
  switch (displayType) {
    case "ok":
      return "text-ok";
    case "alert":
      return "text-alert";
    case "severity":
      return "text-severity";
    default:
      return "text-skip";
  }
};

const PassRateDonut = ({
  label,
  rate,
  displayType,
  target,
  targetMet,
}: PassRateDonutProps) => {
  const arc = rate === undefined ? 0 : (CIRCUMFERENCE * rate) / 100;

  // The target notch is placed by rotating a radial tick to the target's angle.
  // -90 puts 0% at twelve o'clock, matching where the arc starts.
  const targetAngle = target === undefined ? 0 : (360 * target) / 100 - 90;

  return (
    <div
      className={classNames(
        "h-full flex flex-col items-center justify-center overflow-hidden bg-dashboard-panel text-foreground print:bg-white print:text-black shadow-sm p-3",
        getWrapperClasses(displayType),
      )}
    >
      <svg
        className="shrink-0 grow-0"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={
          rate === undefined
            ? `${label}: not applicable`
            : `${label}: ${rate.toFixed(1)}%${
                target !== undefined
                  ? `, target ${target.toFixed(1)}% ${
                      targetMet === undefined
                        ? "pending"
                        : targetMet
                          ? "met"
                          : "missed"
                    }`
                  : ""
              }`
        }
      >
        <circle
          className="text-black-scale-3"
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
        />
        {rate !== undefined && (
          <circle
            className={arcColorClass(displayType)}
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeDasharray={`${arc} ${CIRCUMFERENCE - arc}`}
            strokeLinecap="butt"
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        )}
        {target !== undefined && (
          <line
            className="text-foreground"
            x1={CENTER + RADIUS - STROKE / 2 - 2}
            y1={CENTER}
            x2={CENTER + RADIUS + STROKE / 2 + 2}
            y2={CENTER}
            stroke="currentColor"
            strokeWidth={2}
            transform={`rotate(${targetAngle} ${CENTER} ${CENTER})`}
          />
        )}
        {/* The rate sits inside the ring rather than beside it - the point of a
            square panel is that the number and the proportion occupy the same
            place, so the eye does not travel between them. */}
        <text
          className="fill-current font-semibold"
          x={CENTER}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={rate === undefined ? 22 : 20}
        >
          {rate === undefined ? "-" : `${rate.toFixed(1)}%`}
        </text>
      </svg>
      <p
        className="mt-2 text-sm text-center w-full truncate text-foreground-light"
        title={label}
      >
        {label}
      </p>
      {target !== undefined && (
        <p
          className={classNames(
            "text-xs text-center w-full truncate",
            targetMet === undefined
              ? "text-foreground-lighter"
              : targetMet
                ? "text-ok"
                : "text-alert",
          )}
          title={`Target ${target.toFixed(1)}%`}
        >
          {targetMet === undefined
            ? `Target ${target.toFixed(1)}%`
            : `Target ${target.toFixed(1)}% ${targetMet ? "MET" : "MISSED"}`}
        </p>
      )}
    </div>
  );
};

export default PassRateDonut;
