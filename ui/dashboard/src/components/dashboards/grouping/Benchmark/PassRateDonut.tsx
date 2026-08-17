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

  // Says how far short, rather than restating the two numbers the reader can
  // already see. Percentage points, not percent: 85.7 against 95 is 9.3 points
  // below, and calling that "9.8% below" would be a different, wronger number.
  const targetTooltip =
    target === undefined
      ? ""
      : rate === undefined
        ? `Target ${target.toFixed(1)}% - nothing evaluated`
        : targetMet === undefined
          ? `Target ${target.toFixed(1)}% - still running`
          : targetMet
            ? `Target ${target.toFixed(1)}% met, ${(rate - target).toFixed(1)} points clear`
            : `Target ${target.toFixed(1)}% missed by ${(target - rate).toFixed(1)} points`;

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
          >
            <title>{`${label}: ${rate.toFixed(1)}%`}</title>
          </circle>
        )}
        {target !== undefined && (
          <g transform={`rotate(${targetAngle} ${CENTER} ${CENTER})`}>
            {/* A 2px tick is close to unhoverable, so a transparent stroke
                sits over it purely to widen the hit area for the tooltip. */}
            <line
              x1={CENTER + RADIUS - STROKE}
              y1={CENTER}
              x2={CENTER + RADIUS + STROKE}
              y2={CENTER}
              stroke="transparent"
              strokeWidth={14}
            >
              <title>{targetTooltip}</title>
            </line>
            <line
              className="text-foreground"
              x1={CENTER + RADIUS - STROKE / 2 - 2}
              y1={CENTER}
              x2={CENTER + RADIUS + STROKE / 2 + 2}
              y2={CENTER}
              stroke="currentColor"
              strokeWidth={2}
              pointerEvents="none"
            />
          </g>
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
        // Deliberately quiet. The ring already carries the state in colour and
        // the notch shows the shortfall, so a second alarm-coloured shout is
        // noise - this line is the caption that names the number, not another
        // status indicator. The verdict stays spelled out so it does not
        // depend on colour, but in sentence case at caption weight.
        <p
          className="text-xs text-center w-full truncate text-foreground-lighter"
          title={targetTooltip}
        >
          {targetMet === undefined
            ? `Target ${target.toFixed(1)}%`
            : `Target ${target.toFixed(1)}% ${targetMet ? "met" : "missed"}`}
        </p>
      )}
    </div>
  );
};

export default PassRateDonut;
